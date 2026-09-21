// Renders the 1200x630 link-preview images, i/og.png and i/og-jp.png, from the
// site's own illustration, wordmark and type. Rerun after changing the hero copy:
//   node tools/og-image.cjs
// Needs Playwright and network access for the Google Fonts the site uses.
const { chromium } = require('playwright');
const path = require('node:path');
const { createServer } = require('../tests/serve.cjs');

const CARDS = [
  {
    file: 'i/og.png', lang: 'en',
    headline: 'Order<br>from <em>noise.</em>',
    line: 'AI &amp; machine learning consulting · Tokyo · EN / 日本語'
  },
  {
    file: 'i/og-jp.png', lang: 'ja',
    headline: 'ノイズから、<br>秩序を。',
    line: 'AI・機械学習の技術コンサルティング · 東京 · 日本語 / EN'
  }
];

const page = card => `<!doctype html>
<html lang="${card.lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&family=Noto+Sans+JP:wght@400;500&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #f4f1ea; color: #1a1a1a; font: 400 16px/1.6 'Noto Sans JP', sans-serif; display: grid; grid-template-columns: 1fr 500px; }
  main { padding: 64px 0 56px 72px; display: flex; flex-direction: column; justify-content: space-between; }
  .mark { display: flex; align-items: center; gap: 16px; }
  .mark img { width: 42px; height: 42px; }
  .name { font: 400 30px/1 'Newsreader', serif; letter-spacing: -.035em; }
  .sub { display: block; margin-top: 8px; font: 500 11px/1 'Noto Sans JP', sans-serif; letter-spacing: .16em; }
  h1 { font: 400 112px/.92 'Newsreader', serif; letter-spacing: -.045em; }
  h1 em { font-style: italic; }
  html[lang=ja] h1 { font: 400 82px/1.25 'Noto Sans JP', sans-serif; letter-spacing: -.04em; }
  .line { border-top: 1px solid #ccc8be; padding-top: 18px; font-size: 13px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #6b6961; }
  html[lang=ja] .line { letter-spacing: .06em; }
  figure { display: grid; place-items: center; padding: 40px 48px 40px 0; }
  /* The still frame's strokes are translucent; two copies stacked read at
     thumbnail size in a feed without changing the drawing itself. */
  figure img { grid-area: 1 / 1; width: 100%; height: auto; }
</style></head>
<body>
  <main>
    <div class="mark"><img src="i/mark.svg" alt=""><div><span class="name">matheus de mello</span><span class="sub">SCIENTIFIC CONSULTING</span></div></div>
    <h1>${card.headline}</h1>
    <p class="line">${card.line}</p>
  </main>
  <figure><img src="i/field-still.svg" alt=""><img src="i/field-still.svg" alt=""></figure>
</body></html>`;

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/consulting/`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  try {
    for (const card of CARDS) {
      const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
      await tab.setContent(page(card).replace('<head>', `<head><base href="${base}">`), { waitUntil: 'networkidle' });
      await tab.evaluate(() => document.fonts.ready);
      const family = card.lang === 'ja' ? '82px "Noto Sans JP"' : '112px Newsreader';
      if (!await tab.evaluate(font => document.fonts.check(font), family)) throw new Error(`${family} did not load; the image would use a fallback font`);
      await tab.screenshot({ path: path.join(__dirname, '..', card.file), type: 'png' });
      console.log(`wrote ${card.file}`);
      await tab.close();
    }
  } finally { await browser.close(); server.close(); }
})();
