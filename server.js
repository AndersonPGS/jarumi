const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const PORT = process.env.PORT || 8765;
const BASE_DIR = __dirname;
const { gamesDir: GAMES_DIR } = require('./paths');

// MIME types table
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jar': 'application/java-archive',
  '.jad': 'text/vnd.sun.j2me.app-descriptor; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
  '.amr': 'audio/amr',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// In-memory cache for game metadata
const metadataCache = new Map();

// Parse MANIFEST.MF content
function parseManifest(text) {
  const meta = {};
  if (!text) return meta;
  // Handle folded lines (RFC 822 / JAR manifest spec: line starting with space continues previous line)
  const unfolded = text.replace(/\r\n /g, '').replace(/\n /g, '');
  const lines = unfolded.split(/\r?\n/);
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      meta[key] = val;
    }
  }
  return meta;
}

// Extract metadata and icon from a JAR buffer
async function extractJarMetadata(filename, buffer) {
  const stats = fs.statSync(path.join(GAMES_DIR, filename));
  const result = {
    filename,
    title: filename.replace(/\.jar$/i, ''),
    vendor: 'Unknown',
    version: '1.0',
    mainClass: '',
    iconUrl: '',
    size: stats.size,
    modified: stats.mtimeMs,
    config: 'CLDC-1.1',
    profile: 'MIDP-2.0'
  };

  try {
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file('META-INF/MANIFEST.MF') || zip.file('meta-inf/manifest.mf');
    let iconPath = '';

    if (manifestFile) {
      const manifestText = await manifestFile.async('string');
      const parsed = parseManifest(manifestText);

      // Vendor metadata is optional; never infer resolution from arbitrary bytecode constants.
      const declaredSize = parsed['Nokia-MIDlet-Original-Display-Size'];
      const dimensions = declaredSize && /^(\d+)\s*[,x]\s*(\d+)$/i.exec(declaredSize.trim());
      const supported = new Set(['128x128','128x160','176x208','176x220','240x320','320x240','240x400','360x640','640x360']);
      if (dimensions && supported.has(dimensions[1]+'x'+dimensions[2])) result.screenResolution = dimensions[1]+'x'+dimensions[2];
      if (parsed['MIDlet-Name']) result.title = parsed['MIDlet-Name'];
      if (parsed['MIDlet-Vendor']) result.vendor = parsed['MIDlet-Vendor'];
      if (parsed['MIDlet-Version']) result.version = parsed['MIDlet-Version'];
      if (parsed['MicroEdition-Configuration']) result.config = parsed['MicroEdition-Configuration'];
      if (parsed['MicroEdition-Profile']) result.profile = parsed['MicroEdition-Profile'];

      // Extract main class and icon from MIDlet-1 or any MIDlet-N: "Name, /icon.png, com.foo.Bar"
      const midletKey = Object.keys(parsed).find(k => /^MIDlet-\d+$/i.test(k)) || 'MIDlet-1';
      if (parsed[midletKey]) {
        const parts = parsed[midletKey].split(',').map(s => s.trim());
        if (parts.length >= 3) {
          if (!iconPath && parts[1]) iconPath = parts[1].replace(/^\//, '');
          result.mainClass = parts[2];
        } else if (parts.length === 2) {
          result.mainClass = parts[1];
        }
      }

      if (!iconPath && parsed['MIDlet-Icon']) {
        iconPath = parsed['MIDlet-Icon'].replace(/^\//, '');
      }
    }

    // Try finding the icon file in the zip
    let iconFile = null;
    if (iconPath) {
      iconFile = zip.file(iconPath) || zip.file(iconPath.toLowerCase());
    }
    if (!iconFile) {
      const commonIcons = ['icon.png', 'i.png', 'icons/icon.png', 'icon.ico', 'icon.gif', 'res/icon.png'];
      for (const candidate of commonIcons) {
        iconFile = zip.file(candidate);
        if (iconFile) break;
      }
    }

    if (iconFile) {
      const base64 = await iconFile.async('base64');
      const mime = iconFile.name.endsWith('.gif') ? 'image/gif' : 'image/png';
      result.iconUrl = `data:${mime};base64,${base64}`;
    }
  } catch (err) {
    console.error(`Error reading metadata from ${filename}:`, err.message);
  }

  return result;
}

// Scan the games folder and return metadata for all JARs
async function scanGames() {
  if (!fs.existsSync(GAMES_DIR)) {
    fs.mkdirSync(GAMES_DIR, { recursive: true });
  }

  const files = fs.readdirSync(GAMES_DIR).filter(f => f.toLowerCase().endsWith('.jar'));
  const games = [];

  for (const file of files) {
    const fullPath = path.join(GAMES_DIR, file);
    const stats = fs.statSync(fullPath);

    const cached = metadataCache.get(file);
    if (cached && cached.modified === stats.mtimeMs && cached.size === stats.size) {
      games.push(cached);
      continue;
    }

    try {
      const buffer = fs.readFileSync(fullPath);
      const meta = await extractJarMetadata(file, buffer);
      metadataCache.set(file, meta);
      games.push(meta);
    } catch (err) {
      console.error(`Failed to scan game ${file}:`, err);
    }
  }

  // Sort by title alphabetically
  games.sort((a, b) => a.title.localeCompare(b.title));
  return games;
}

// Create the HTTP server
function startServer(port = PORT) {
  const server = http.createServer(async (req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { res.writeHead(403); res.end('Forbidden host'); return; }
    // Mutations are limited to our local UI, including browser deployments.
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      res.writeHead(403); res.end('Forbidden origin'); return;
    }
    // Enable CORS
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let pathname, parsedUrl;
    try { parsedUrl = new URL(req.url, 'http://localhost'); pathname = decodeURIComponent(parsedUrl.pathname); }
    catch { res.writeHead(400); res.end('Bad URL'); return; }

    // API: /api/games
    if (pathname === '/api/games') {
      try {
        const games = await scanGames();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: games.length, games }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    // API: /api/upload (Upload .jar directly via multipart or binary buffer)
    if (pathname === '/api/upload' && req.method === 'POST') {
      const filename = parsedUrl.searchParams.get('filename') || `game_${Date.now()}.jar`;
      const sanitized = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      if (!/^[^/\\]+\.jar$/i.test(sanitized)) { res.writeHead(400); res.end('Expected .jar'); return; }
      fs.mkdirSync(GAMES_DIR, { recursive: true });
      const targetPath = path.join(GAMES_DIR, sanitized);

      const chunks = []; let received = 0; let rejected = false;
      req.on('data', chunk => {
        received += chunk.length;
        if (received > 64 * 1024 * 1024) { if (!rejected) { rejected = true; res.writeHead(413); res.end('JAR too large'); } return; }
        if (!rejected) chunks.push(chunk);
      });
      req.on('end', async () => {
        if (rejected) return;
        try {
          const buffer = Buffer.concat(chunks);
          await JSZip.loadAsync(buffer);
          fs.writeFileSync(targetPath, buffer);
          const meta = await extractJarMetadata(sanitized, buffer);
          metadataCache.set(sanitized, meta);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, game: meta }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    // Default to index.html if root requested
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Only public runtime assets and the user's game files are served.
    const publicFile = /^\/(index\.html|player\.html|icon\.(png|ico))$/.test(pathname);
    const publicTree = /^\/(assets|css|js|style|bld|config|libs|polyfill|java)\//.test(pathname);
    const gameFile = /^\/games\/[^/\\]+\.jar$/i.test(pathname);
    if ((!publicFile && !publicTree && !gameFile) || pathname.includes('\\') || pathname.split('/').some(p => p === '..' || p.startsWith('.'))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const root = gameFile ? GAMES_DIR : BASE_DIR;
    const safePath = path.resolve(root, gameFile ? pathname.slice(7) : '.' + pathname);
    const relative = path.relative(root, safePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) { res.writeHead(403); res.end('Forbidden'); return; }

    fs.stat(safePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
        return;
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Support basic range requests for audio / jar
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
        const chunksize = end - start + 1;
        const fileStream = fs.createReadStream(safePath, { start, end });
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': stats.size,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(safePath).pipe(res);
      }
    });
  });

  return new Promise((resolve, reject) => {
    function tryListen(p) {
      server.listen(p, '127.0.0.1', () => {
        const actualPort = server.address().port;
        console.log(`[Jarumi Server] Running at http://127.0.0.1:${actualPort}`);
        resolve({ server, port: actualPort });
      });

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && p > 0 && p < 8790) {
          console.warn(`[Jarumi Server] Port ${p} in use, trying ${p + 1}...`);
          tryListen(p + 1);
        } else {
          reject(err);
        }
      });
    }

    tryListen(port);
  });
}

// If run directly from CLI
if (require.main === module) {
  startServer().then(({ port }) => {
    console.log(`Open http://127.0.0.1:${port} in your browser.`);
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, scanGames, extractJarMetadata };
