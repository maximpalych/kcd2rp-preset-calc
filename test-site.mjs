import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const htmlPath=path.join(root,'index.html');
const jsonPath=path.join(root,'recipes.json');
const [html,jsonText]=await Promise.all([fs.readFile(htmlPath,'utf8'),fs.readFile(jsonPath,'utf8')]);
const db=JSON.parse(jsonText);
const missingRussian=db.recipes.filter(r=>!r.display_item_ru);
if(missingRussian.length)throw new Error(`Missing Russian item names: ${missingRussian.length}`);
const match=html.match(/<script id="recipeData" type="application\/json">([\s\S]*?)<\/script>/);
if(!match)throw new Error('Embedded recipe database missing');
const embedded=JSON.parse(match[1]);
if(embedded.recipes.length!==db.recipes.length)throw new Error('Embedded and external databases differ');
for(const needle of ['function calculate()','function exportSet()','async function importSet','const I18N=','id="langBtn"','function applyLanguage()','professionTitle','data-owned','data-price','Кузнец','Лучное дело','Equipment Set Builder','Конструктор снаряжения'])if(!html.includes(needle))throw new Error(`Missing feature: ${needle}`);

const recipeMap=new Map(db.recipes.map(r=>[r.recipe_key,r]));
const steel=recipeMap.get('Кузнец|steel');
if(!steel||steel.output_qty!==2)throw new Error('Steel route missing');
const steelIngredients=Object.fromEntries(steel.ingredients.map(i=>[i.name,i.qty]));
if(steelIngredients['iron ore']!==3||steelIngredients.coal!==2)throw new Error('Steel recipe mismatch');

function calculate(items){
  const components=new Set(db.recipes.flatMap(r=>r.ingredients.map(i=>i.recipe_key).filter(Boolean)));
  const memo=new Map();
  const depth=key=>{
    if(memo.has(key))return memo.get(key);
    memo.set(key,0);let value=0;
    for(const i of recipeMap.get(key)?.ingredients||[])if(i.recipe_key)value=Math.max(value,1+depth(i.recipe_key));
    memo.set(key,value);return value;
  };
  const order=[...components].sort((a,b)=>depth(b)-depth(a));
  const demand=new Map(),base=new Map();let fee=0;
  const add=(map,key,value)=>map.set(key,(map.get(key)||0)+value);
  const feed=(i,multiplier)=>i.recipe_key?add(demand,i.recipe_key,i.qty*multiplier):add(base,i.name,i.qty*multiplier);
  for(const item of items){const r=recipeMap.get(item.recipeKey);const runs=Math.ceil(item.quantity/r.output_qty);fee+=runs*r.craft_fee;r.ingredients.forEach(i=>feed(i,runs));}
  for(const key of order){const need=demand.get(key)||0;if(!need)continue;const r=recipeMap.get(key);const runs=Math.ceil(need/r.output_qty);fee+=runs*r.craft_fee;r.ingredients.forEach(i=>feed(i,runs));}
  return{base:Object.fromEntries(base),fee};
}
const coif=[...recipeMap.values()].find(r=>r.display_item==='Mail coif (heavy)');
if(!coif)throw new Error('Verification recipe missing');
if(coif.display_item_ru!=='Кольчужный койф (тяжёлый)')throw new Error(`Unexpected Russian item name: ${coif.display_item_ru}`);
const cervelliere=[...recipeMap.values()].find(r=>r.display_item==='Rondel scullcap');
if(!cervelliere||cervelliere.display_item_ru!=='Цервельер с ронделями')throw new Error('Cervelliere translation is missing');
const chainmailGloves=[...recipeMap.values()].find(r=>r.display_item==='Chainmail gauntlets');
if(!chainmailGloves||chainmailGloves.display_item_ru!=='Кольчужные перчатки')throw new Error('Chainmail gloves translation is missing');
const plainPlateSleeves=[...recipeMap.values()].find(r=>r.display_item==='Plain laminar sleeves');
if(!plainPlateSleeves||plainPlateSleeves.display_item_ru!=='Простые пластинчатые рукава')throw new Error('Plain plate sleeves translation is missing');
const oldPlateLegs=[...recipeMap.values()].find(r=>r.display_item==='Old brigandine legs');
if(!oldPlateLegs||oldPlateLegs.display_item_ru!=='Старые пластинчатые поножи')throw new Error('Old plate legs translation is missing');
const aventailNames=['Простая бармица','Усиленная бармица','Бармица со значком','Бацинет с бармицей (тяжёлый)','Бацинет с бармицей'];
for(const name of aventailNames)if(![...recipeMap.values()].some(r=>r.display_item_ru===name))throw new Error(`Aventail translation is missing: ${name}`);
const one=calculate([{recipeKey:coif.recipe_key,quantity:1}]);
const two=calculate([{recipeKey:coif.recipe_key,quantity:2}]);
const expectedOne={coal:12,'iron ore':9,nettles:3,hides:1};
const expectedTwo={coal:24,'iron ore':18,nettles:3,hides:1};
for(const [key,value] of Object.entries(expectedOne))if(one.base[key]!==value)throw new Error(`One-item calculation mismatch for ${key}`);
for(const [key,value] of Object.entries(expectedTwo))if(two.base[key]!==value)throw new Error(`Combined calculation mismatch for ${key}`);
if(one.fee!==10||two.fee!==20)throw new Error('Craft fee calculation mismatch');

const scriptBlocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const appScript=scriptBlocks.at(-1);
new vm.Script(appScript,{filename:'site-inline.js'});
console.log(JSON.stringify({recipes:db.recipes.length,russianItemNames:db.recipes.length-missingRussian.length,resources:db.base_resources.length,professions:[...new Set(db.recipes.map(r=>r.profession))],languages:['ru','en'],steel:steelIngredients,oneItem:one,twoItems:two,htmlSyntax:'ok',embeddedDatabase:'ok'},null,2));
