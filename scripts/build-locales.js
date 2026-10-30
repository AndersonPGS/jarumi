// Run after editing locales/*.json: npm run build:locales
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const catalogs={};
for(const locale of ['pt-BR','en','es'])catalogs[locale]=JSON.parse(fs.readFileSync(path.join(root,'locales',locale+'.json'),'utf8'));
const keys=Object.keys(catalogs['pt-BR']);
for(const [locale,catalog]of Object.entries(catalogs)){
 if(Object.keys(catalog).length!==keys.length||keys.some(k=>typeof catalog[k]!=='string'))throw Error('Incomplete locale: '+locale);
 for(const key of keys){const params=s=>(s.match(/\{\w+\}/g)||[]).sort().join();if(params(key)!==params(catalog[key]))throw Error('Mismatched placeholders: '+locale+' / '+key);}
}
fs.writeFileSync(path.join(root,'js','locales.js'),'const JARUMI_LOCALES = '+JSON.stringify(catalogs)+';\n');
console.log('Built '+keys.length+' translations for '+Object.keys(catalogs).join(', '));
