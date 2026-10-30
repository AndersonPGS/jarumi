const path = require('path');
let dataDir = process.env.JARUMI_DATA_DIR || __dirname;
if (process.versions.electron && process.type !== 'renderer') {
  const { app } = require('electron');
  if (!process.env.JARUMI_DATA_DIR && app.isPackaged) dataDir = app.getPath('userData');
}
module.exports = { dataDir, gamesDir: path.join(dataDir, 'games'), screenshotsDir: path.join(dataDir, 'screenshots') };
