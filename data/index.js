(function(root,factory){
"use strict";
if(typeof module!=="undefined"&&module.exports){
 module.exports=factory(
  require("./characters/hiragana.js"),
  require("./characters/kanji-grade1.js"),
  require("./cards.js")
 );
}else{
 const parts=root.MojitetsuData;
 root.RAIL_DATA=factory(parts.characters.hiragana,parts.characters.kanjiGrade1,parts.cards);
}
})(globalThis,function(hiragana,kanjiGrade1,cards){
 return{
  characters:Object.fromEntries([...kanjiGrade1,...hiragana]),
  cards
 };
});
