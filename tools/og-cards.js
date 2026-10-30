'use strict';

// Draws each post's share card (1200x630) into source/images/og/, the
// picture chat apps and social sites show when the post's link is shared.
// Run it after writing or retitling a post, then commit the cards:
//
//   node tools/og-cards.js            cards for posts that don't have one
//   node tools/og-cards.js --all      redraw every card
//   node tools/og-cards.js --site     redraw the site card (images/og-card.png)
//
// Needs Playwright with Chromium (not a dependency of the site; the site
// build only uses the PNGs). The title font is Noto Serif SC: point
// OG_FONT_CSS at a stylesheet for it (for example @fontsource/noto-serif-sc's
// 900.css), otherwise the system's serif is used.

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Hexo = require('hexo');
const cardName = require('./og-name');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'source', 'images', 'og');
const asset = file => pathToFileURL(path.join(ROOT, 'source', file)).href;

const escape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A skyline that is the same every time for the same post.
function skyline(seed) {
  let state = [...seed].reduce((sum, c) => (sum * 31 + c.codePointAt(0)) >>> 0, 7);
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  let x = 0;
  let towers = '';
  let windows = '';
  while (x < 1200) {
    const w = 28 + random() * 70;
    const h = 40 + random() * (x > 700 ? 150 : 90);
    towers += `<rect x="${x.toFixed(1)}" y="${(630 - h).toFixed(1)}" width="${(w - 3).toFixed(1)}" height="${h.toFixed(1)}"/>`;
    for (let i = 0; i < 3; i++) {
      if (random() < 0.5) {
        const color = random() < 0.7 ? '124,236,255' : '255,92,138';
        windows += `<rect x="${(x + 4 + random() * (w - 14)).toFixed(1)}" y="${(630 - h + 8 + random() * (h - 16)).toFixed(1)}" width="3" height="2" fill="rgba(${color},.55)"/>`;
      }
    }
    x += w;
  }
  return `<svg class="city" viewBox="0 0 1200 630" preserveAspectRatio="none"><g fill="#0b0d18">${towers}</g>${windows}</svg>`;
}

function card(post) {
  const category = post.categories.map(c => c.name)[0] || 'NOTE';
  const tags = post.tags.map(t => `#${escape(t.name)}`).join('  ');
  // Lines break between words, as on the site (scripts/signal-typeset.js).
  const words = [...new Intl.Segmenter('zh', { granularity: 'word' }).segment(post.title)].map(part => escape(part.segment));
  const title = words.join('<wbr>');
  const description = escape(post.description || '');
  const long = [...post.title].length > 18;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
${process.env.OG_FONT_CSS ? `<link rel="stylesheet" href="${pathToFileURL(path.resolve(process.env.OG_FONT_CSS)).href}">` : ''}
<style>
@font-face { font-family: "Big Shoulders Display"; src: url("${asset('fonts/big-shoulders-display.woff2')}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "JetBrains Mono"; src: url("${asset('fonts/jetbrains-mono.woff2')}") format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #05060b; }
body { position: relative; color: #e8ecf6; font-family: "Noto Serif SC", "Noto Serif CJK SC", serif; }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(124,236,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(124,236,255,.035) 1px, transparent 1px); background-size: 40px 40px; }
.glow { position: absolute; inset: 0; background: radial-gradient(520px 360px at 82% 30%, rgba(150,130,255,.16), transparent 70%), radial-gradient(600px 300px at 10% 100%, rgba(124,236,255,.08), transparent 70%); }
.city { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .9; }
.rain { position: absolute; inset: 0; background: repeating-linear-gradient(105deg, transparent 0 22px, rgba(170,200,255,.05) 22px 23px); }
.moon { position: absolute; top: 46px; right: 64px; width: 250px; opacity: .78; filter: saturate(.75) drop-shadow(0 0 28px rgba(255,214,170,.22)); }
.frame { position: absolute; inset: 28px; border: 1px solid rgba(124,236,255,.10); }
.meta { position: absolute; top: 70px; left: 76px; display: flex; gap: 18px; font: 500 20px "JetBrains Mono", monospace; letter-spacing: .14em; color: #7a86a8; }
.meta b { color: #7cecff; font-weight: 500; }
.text { position: absolute; top: 128px; left: 76px; width: 760px; }
h1 { font-weight: 900; font-size: ${long ? 58 : 70}px; line-height: 1.22; letter-spacing: .01em; word-break: keep-all; overflow-wrap: anywhere; text-shadow: 0 2px 24px rgba(5,6,11,.9); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
p { margin-top: 22px; font: 22px/1.6 "PingFang SC", "Noto Sans CJK SC", "WenQuanYi Zen Hei", sans-serif; color: #9aa4c2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.wave { position: absolute; left: 28px; right: 28px; top: 452px; height: 2px; background: linear-gradient(90deg, rgba(124,236,255,0), rgba(124,236,255,.55) 30%, rgba(176,150,255,.55) 70%, rgba(176,150,255,0)); box-shadow: 0 0 12px rgba(124,236,255,.35); }
.tags { position: absolute; left: 76px; top: 482px; font: 20px "JetBrains Mono", monospace; color: #7cecff; opacity: .85; }
.brand { position: absolute; right: 76px; bottom: 62px; text-align: right; }
.brand strong { display: block; font: 800 46px/1 "Big Shoulders Display", sans-serif; letter-spacing: .12em; color: #e8ecf6; }
.brand span { font: 17px "JetBrains Mono", monospace; letter-spacing: .1em; color: #7a86a8; }
</style></head><body>
<div class="grid"></div><div class="glow"></div>
<img class="moon" src="${asset('images/backdrop-moon.svg')}" alt="">
${skyline(post.path)}<div class="rain"></div><div class="frame"></div>
<div class="meta"><b>${escape(category.toUpperCase())}</b><span>${post.date.format('YYYY.MM.DD')}</span></div>
<div class="text"><h1>${title}</h1>${description ? `<p>${description}</p>` : ''}</div>
<div class="wave"></div>
<div class="tags">${tags}</div>
<div class="brand"><strong>SILEN1</strong><span>silen1.com</span></div>
</body></html>`;
}

// The site's own card, for the home page and every page without a post card:
// SILEN1 in dots over the signal line, as on the home page.
function siteCard() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Big Shoulders Display"; src: url("${asset('fonts/big-shoulders-display.woff2')}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Cormorant Garamond"; font-style: italic; src: url("${asset('fonts/cormorant-garamond-italic.woff2')}") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; src: url("${asset('fonts/jetbrains-mono.woff2')}") format("woff2"); }
* { margin: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #05060b; }
.grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(124,236,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(124,236,255,.035) 1px, transparent 1px); background-size: 40px 40px; }
.glow { position: absolute; inset: 0; background: radial-gradient(520px 300px at 50% 40%, rgba(124,236,255,.06), transparent 70%); }
.frame { position: absolute; inset: 28px; border: 1px solid rgba(124,236,255,.10); }
canvas { position: absolute; inset: 0; }
.poem { position: absolute; top: 412px; width: 100%; text-align: center; font: italic 60px "Cormorant Garamond", serif; color: #e8ecf6; }
.poem span { background: linear-gradient(90deg, #7cecff, #b096ff); -webkit-background-clip: text; color: transparent; }
.url { position: absolute; top: 512px; width: 100%; text-align: center; font: 18px "JetBrains Mono", monospace; letter-spacing: .12em; color: #6f86a0; }
</style></head><body>
<div class="grid"></div><div class="glow"></div><div class="frame"></div>
<canvas width="1200" height="630"></canvas>
<div class="poem">Signal, <span>out of noise.</span></div>
<div class="url">silen1.com</div>
<script>
document.fonts.load('900 200px "Big Shoulders Display"').then(() => {
  const g = document.querySelector('canvas').getContext('2d');
  const m = document.createElement('canvas');
  m.width = 1200; m.height = 630;
  const mg = m.getContext('2d');
  mg.font = '900 230px "Big Shoulders Display"';
  mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.letterSpacing = '24px';
  mg.fillText('SILEN1', 612, 210);
  const data = mg.getImageData(0, 0, 1200, 630).data;
  for (let y = 0; y < 630; y += 7) for (let x = 0; x < 1200; x += 7) {
    if (data[(y * 1200 + x) * 4 + 3] < 128) continue;
    const t = (x - 340) / 520;
    g.fillStyle = 'rgb(' + Math.round(124 + t * 52) + ',' + Math.round(236 - t * 86) + ',255)';
    g.globalAlpha = .75;
    g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = .6;
  g.strokeStyle = '#7cb8c8'; g.lineWidth = 1.5;
  g.beginPath();
  for (let x = 28; x <= 1172; x += 4) {
    const y = 360 + Math.sin(x / 190) * 5 + Math.sin(x / 61 + 1) * 2;
    x === 28 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.stroke();
  document.body.dataset.ready = '1';
});
</script></body></html>`;
}

(async () => {
  const all = process.argv.includes('--all');
  if (process.argv.includes('--site')) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    const scratch = path.join(ROOT, 'source', 'images', '.card.html');
    fs.writeFileSync(scratch, siteCard());
    await page.goto(pathToFileURL(scratch).href);
    await page.waitForSelector('body[data-ready]');
    await page.screenshot({ path: path.join(ROOT, 'source', 'images', 'og-card.png') });
    fs.rmSync(scratch, { force: true });
    await browser.close();
    console.log('source/images/og-card.png');
    return;
  }
  const hexo = new Hexo(ROOT, { silent: true });
  await hexo.init();
  await hexo.load();
  const posts = hexo.locals.get('posts').toArray();

  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  fs.mkdirSync(OUT, { recursive: true });
  const scratch = path.join(OUT, '.card.html');
  for (const post of posts) {
    const file = path.join(OUT, cardName(post.path));
    if (!all && fs.existsSync(file)) continue;
    fs.writeFileSync(scratch, card(post));
    await page.goto(pathToFileURL(scratch).href);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: file });
    console.log(`${path.relative(ROOT, file)}  ${post.title}`);
  }
  fs.rmSync(scratch, { force: true });
  await browser.close();
  await hexo.exit();
})();
