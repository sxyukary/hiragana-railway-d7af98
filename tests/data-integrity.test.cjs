const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const courses=require('../data/courses.js');
const hiraganaEntries=require('../data/characters/hiragana.js');
const kanjiEntries=require('../data/characters/kanji-grade1.js');
const cards=require('../data/cards.js');
const data=require('../data/index.js');
const C=require('../core.js');

const HIRAGANA=['や','せ','ふ','ほ','も','む','よ','い','つ','し','く','へ','り','こ','う','て','と','に','か','た','な','の','あ','え','お'];
const KANJI=['一','二','三','四','五','六','七','八','九','十','山','川','木','目','月','上','下'];
const CARD_IDS=['redwing','500','n700','800','883','885','787','railstar','doctor-yellow','kizashi','urara','n700s','e5','e6','w7','sunrise','yakumo273','ginga','mizukaze','sevenstars','ef210','eh500','eh200','ef510','ef66','323','panda-kuroshio','225','221','rapit'];
const ROOT=path.resolve(__dirname,'..');
const unique=values=>new Set(values).size===values.length;
const nonempty=value=>typeof value==='string'&&value.length>0;

assert.deepEqual(Object.keys(courses),['hiragana','kanji']);
assert.deepEqual(courses.hiragana,HIRAGANA);
assert.deepEqual(courses.kanji,KANJI);
const courseCharacters=Object.values(courses).flat();
assert.equal(unique(courseCharacters),true,'course characters must not be duplicated');

for(const [name,entries]of [['hiragana',hiraganaEntries],['kanji-grade1',kanjiEntries]]){
 assert.equal(Array.isArray(entries),true,name+' character data must be an ordered entry list');
 assert.equal(unique(entries.map(([char])=>char)),true,name+' character entries must not be duplicated');
 for(const [char,record]of entries){
  assert.equal(nonempty(char),true,name+' character key must not be empty');
  assert.equal(Array.isArray(record.paths)&&record.paths.length>0,true,char+' paths must not be empty');
  assert.equal(record.paths.every(nonempty),true,char+' paths must contain only nonempty strings');
  for(const key of ['source','viewBox','license','author','review'])assert.equal(nonempty(record[key]),true,char+' '+key+' must not be empty');
 }
}
for(const [char,record]of kanjiEntries)assert.equal(nonempty(record.reading),true,char+' reading must not be empty');

const allEntries=[...kanjiEntries,...hiraganaEntries],entryCharacters=allEntries.map(([char])=>char);
assert.equal(unique(entryCharacters),true,'character data must not be duplicated across files');
assert.deepEqual([...entryCharacters].sort(),[...courseCharacters].sort(),'course membership and character data must match exactly');
assert.deepEqual(Object.keys(data),['characters','cards']);
assert.deepEqual(Object.keys(data.characters),[...KANJI,...HIRAGANA]);
assert.deepEqual(data.characters,Object.fromEntries(allEntries));
assert.strictEqual(C.GROUPS,courses,'core must use the canonical course definition');
assert.deepEqual(C.CHARS,courseCharacters);

assert.deepEqual(cards.map(card=>card.id),CARD_IDS);
assert.equal(unique(cards.map(card=>card.id)),true,'card ids must not be duplicated');
assert.equal(unique(cards.map(card=>card.image)),true,'card images must not be duplicated');
for(const card of cards){
 for(const key of ['id','name','reading','category','image','fact','factSource','checked','credit','sourceTitle','license','licenseUrl','source','change','photoDescription'])assert.equal(nonempty(card[key]),true,card.id+' '+key+' must not be empty');
 assert.match(card.id,/^[a-z0-9-]+$/);
 assert.equal(fs.existsSync(path.join(ROOT,card.image)),true,card.image+' must exist');
}
assert.strictEqual(data.cards,cards);
assert.equal(courses.hiragana.length,25);
assert.equal(courses.kanji.length,17);
assert.equal(cards.length,30);

console.log('PASS: canonical courses, 42 character shapes, 30 cards, ordering, uniqueness, required fields, and image references');
