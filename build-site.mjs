import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'recipes.source.json');
const translationsPath=path.join(root,'item-translations.ru.json');
const templatePath=path.join(root,'site.template.html');
const htmlPath=path.join(root,'index.html');
const jsonPath=path.join(root,'recipes.json');

const [template,raw,translationsRaw]=await Promise.all([fs.readFile(templatePath,'utf8'),fs.readFile(source,'utf8'),fs.readFile(translationsPath,'utf8')]);
const data=JSON.parse(raw);
const translations=JSON.parse(translationsRaw);
if(!Array.isArray(data.recipes)||data.recipes.length<1)throw new Error('Recipe database is empty');
for(const recipe of data.recipes){
  recipe.display_item_ru=translations[recipe.display_item];
  if(!recipe.display_item_ru)throw new Error(`Missing Russian translation: ${recipe.display_item}`);
}
const embedded=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026');
const html=template.replace('__RECIPES_JSON__',embedded);
if(html.includes('__RECIPES_JSON__'))throw new Error('Recipe placeholder was not replaced');
await Promise.all([fs.writeFile(htmlPath,html,'utf8'),fs.writeFile(jsonPath,JSON.stringify(data,null,2),'utf8')]);
console.log(JSON.stringify({htmlPath,jsonPath,recipes:data.recipes.length,resources:data.base_resources.length,htmlBytes:Buffer.byteLength(html),jsonBytes:Buffer.byteLength(JSON.stringify(data,null,2))},null,2));
