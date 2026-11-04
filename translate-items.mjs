import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const sourcePath=path.join(root,'recipes.source.json');
const outputPath=path.join(root,'item-translations.ru.json');
const separator='__KCD_SEP__';
const db=JSON.parse(await fs.readFile(sourcePath,'utf8'));
const names=[...new Set(db.recipes.map(r=>r.display_item))];
let translations={};
try{translations=JSON.parse(await fs.readFile(outputPath,'utf8'))}catch{}

async function request(text){
  const url='https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q='+encodeURIComponent(text);
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!response.ok)throw new Error(`Translation request failed: ${response.status}`);
  const payload=await response.json();
  return payload[0].map(part=>part[0]).join('').trim();
}

const exact={
  'found horseshoes':'Найденные подковы','Half plate legs':'Полулатные поножи','Bavarian plate legs':'Баварские латные поножи','Saxon plate legs':'Саксонские латные поножи','Kuttenberg plate legs':'Куттенбергские латные поножи','Magdeburg plate arms':'Магдебургские латные наручи','Magdeburg plate arms (style 2)':'Магдебургские латные наручи (стиль 2)','Magdeburg plate arms (Bergov)':'Магдебургские латные наручи (Бергов)','Noble brigandine legs':'Дворянские бригандинные поножи','Noble brigandine legs (style 2)':'Дворянские бригандинные поножи (стиль 2)','Old brigandine legs':'Старые пластинчатые поножи','Plain laminar sleeves':'Простые пластинчатые рукава','Coat of arms surcoat':'Сюрко с гербом','Hose joined':'Цельные шоссы','Firm boots':'Прочные сапоги','Rondel scullcap':'Цервельер с ронделями','Rondel dagger':'Рондельный кинжал','Couters with rondel':'Налокотники с ронделем','Chainmail gauntlets':'Кольчужные перчатки','Mail collar (plain)':'Простая бармица','Mail collar (reinforced)':'Усиленная бармица','Mail collar with badge':'Бармица со значком'
};

function polish(text,source){
  if(exact[source])return exact[source];
  let result=text
    .replace(/тарелочн/gi,'латн')
    .replace(/длинный меч/gi,'полуторный меч')
    .replace(/боевой рок/gi,'ваффенрок')
    .replace(/кольчужный чепчик/gi,'кольчужный койф')
    .replace(/чепчик кольчуги/gi,'кольчужный койф')
    .replace(/стеган/gi,'стёган')
    .replace(/тяжел/gi,'тяжёл')
    .replace(/легк(ий|ая|ое|ие|ого|ому|ую|их|ими)/gi,match=>match.replace(/^легк/i,'лёгк'))
    .replace(/\s+/g,' ')
    .trim();
  if(/kettle hat/i.test(source))result=result.replace(/шапка-чайник|шляпа-чайник|чайник|котелок/gi,'шапель');
  if(/\bhose\b/i.test(source))result=result.replace(/шланг/gi,'шоссы').replace(/ослабленн/gi,'свободн');
  if(/\bcoat\b|overcoat/i.test(source))result=result.replace(/пальто|шуба|шинель/gi,'кафтан');
  if(/caparison/i.test(source))result=result.replace(/одеяние|плащ|турнирная одежда/gi,'попона');
  if(/\(light\)/i.test(source))result=result.replace(/\(светл(ый|ая|ое|ые)\)/gi,'(лёгкий)');
  if(/plate sleeves/i.test(source))result=result.replace(/пластинчатые (гильзы|втулки)|латные (гильзы|втулки)/gi,'латные рукава');
  if(/plate leg armour/i.test(source))result=result.replace(/латный доспех[^()]*/i,'латные поножи').replace(/пластинчатый доспех[^()]*/i,'латные поножи');
  return result.charAt(0).toUpperCase()+result.slice(1);
}

const missing=names.filter(name=>!translations[name]);
for(let offset=0;offset<missing.length;offset+=20){
  const batch=missing.slice(offset,offset+20);
  const joined=batch.join(`\n${separator}\n`);
  let parts=[];
  try{parts=(await request(joined)).split(separator).map(x=>x.trim())}catch{}
  if(parts.length!==batch.length){
    parts=[];
    for(const name of batch)parts.push(await request(name));
  }
  batch.forEach((name,index)=>translations[name]=polish(parts[index]||name,name));
  await fs.writeFile(outputPath,JSON.stringify(translations,null,2),'utf8');
  console.log(`translated ${Math.min(offset+batch.length,missing.length)}/${missing.length}`);
}

const unresolved=names.filter(name=>!translations[name]);
if(unresolved.length)throw new Error(`Missing translations: ${unresolved.length}`);
for(const name of names)translations[name]=polish(translations[name],name);
await fs.writeFile(outputPath,JSON.stringify(translations,null,2),'utf8');
console.log(JSON.stringify({items:names.length,translated:Object.keys(translations).length,outputPath},null,2));
