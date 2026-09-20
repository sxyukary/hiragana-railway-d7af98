const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data.js');
const OUTPUT_PATH = path.join(ROOT, 'sources.html');

function loadData() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(DATA_PATH, 'utf8'), context, {
    filename: DATA_PATH,
  });
  return context.window.RAIL_DATA;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderCharacterLinks(characters) {
  const entries = Object.entries(characters);
  const orderedEntries = [
    ...entries.filter(([character]) => /[ぁ-ゖ]/u.test(character)),
    ...entries.filter(([character]) => !/[ぁ-ゖ]/u.test(character)),
  ];
  return orderedEntries
    .map(([character, data]) => `    <a href="${escapeHtml(data.source)}">${escapeHtml(character)}</a>`)
    .join('\n');
}

function renderCredit(card) {
  const isFamilyPhoto = card.source === `sources.html#${card.id}`;
  if (isFamilyPhoto) return `${escapeHtml(card.credit)} / ${escapeHtml(card.license)}`;
  return `${escapeHtml(card.credit)} / <a href="${escapeHtml(card.source)}">写真の原典</a> / <a href="${escapeHtml(card.licenseUrl)}">${escapeHtml(card.license)}</a>`;
}

function renderCard(card) {
  const isFamilyPhoto = card.source === `sources.html#${card.id}`;
  const sectionId = isFamilyPhoto ? ` id="${escapeHtml(card.id)}"` : '';
  const licenseNote = isFamilyPhoto ? '' : '写真のライセンスは元の条件を維持します。';
  return `  <section${sectionId}>
    <h3>${escapeHtml(card.name)}</h3>
    <img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}">
    <p>原題：${escapeHtml(card.sourceTitle)}</p>
    <p>${renderCredit(card)}</p>
    <p>${escapeHtml(card.change)}${licenseNote}</p>
    <p>${escapeHtml(card.fact)}</p>
    <a href="${escapeHtml(card.factSource)}">豆知識の根拠</a>（確認日 ${escapeHtml(card.checked)}）
  </section>`;
}

function renderSources(data) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, noimageindex">
  <meta name="googlebot" content="noindex, nofollow, noarchive, noimageindex">
  <title>写真と文字の出典</title>
  <style>
    body{max-width:850px;margin:30px auto;padding:20px;font-family:system-ui;line-height:1.8}
    img{max-width:100%;max-height:220px}
    section{border-bottom:1px solid #ddd;padding:20px 0}
    .notice{padding:14px 18px;background:#f4f1e8;border-radius:8px}
  </style>
</head>
<body>
  <a href="index.html">ゲームへ</a>
  <h1>写真と文字の出典</h1>
  <div class="notice"><strong>非公式の家庭向け学習ゲームです。</strong>鉄道各社・車両メーカー・Wikimedia Commons・KanjiVGによる公式提供、承認、協賛を受けたものではありません。各名称・ロゴ等の権利は、それぞれの権利者に帰属します。</div>
  <p>第三者素材は、各項目に記載したライセンス条件に基づいて使用しています。写真は表示用に縮小・圧縮していますが、描き換えはしていません。</p>

  <h2>アプリアイコン</h2>
  <p>OpenAIの画像生成機能で、このゲーム専用に作成しました。描かれた電車は架空のもので、実在の車両・鉄道会社を表すものではありません。</p>

  <h2>文字</h2>
  <p>KanjiVG © 2009/2010/2011 Ulrich Apel / <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>。色・線幅・表示方法を変更。改変した字形部分にも同ライセンスを適用します。</p>
  <p>
${renderCharacterLinks(data.characters)}
  </p>

  <h2>写真・豆知識</h2>
${data.cards.map(renderCard).join('\n')}
</body>
</html>
`;
}

const data = loadData();
fs.writeFileSync(OUTPUT_PATH, renderSources(data));
console.log(`Generated ${path.relative(ROOT, OUTPUT_PATH)} (${data.cards.length} cards, ${Object.keys(data.characters).length} characters)`);
