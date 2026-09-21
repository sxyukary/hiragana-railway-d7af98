(function(root,factory){
"use strict";
const value=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=value;
else{root.MojitetsuData??={};root.MojitetsuData.courses=value;}
})(globalThis,function(){return {
  "hiragana": [
    "や",
    "せ",
    "ふ",
    "ほ",
    "も",
    "む",
    "よ",
    "い",
    "つ",
    "し",
    "く",
    "へ",
    "り",
    "こ",
    "う",
    "て",
    "と",
    "に",
    "か",
    "た",
    "な",
    "の",
    "あ",
    "え",
    "お"
  ],
  "kanji": [
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
    "山",
    "川",
    "木",
    "目",
    "月",
    "上",
    "下",
    "日",
    "口",
    "円",
    "力",
    "大"
  ]
};});
