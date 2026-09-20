const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');

(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/consulting/`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  let failed = false;
  try {
    for (const lang of ['', 'jp/']) {
      const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce', viewport: { width: 390, height: 900 } });
      const page = await context.newPage();
      try {
        await page.goto(base + lang);
        const stories = page.locator('.case-study');
        assert.equal(await stories.count(), 5, 'all five projects need accessible detail');
        for (const story of await stories.all()) {
          const summary = story.locator('summary');
          await summary.focus();
          await page.keyboard.press('Enter');
          assert.equal(await story.getAttribute('open'), '');
          const figure = story.locator('.case-figure');
          if (!await figure.count()) {
            assert.equal(await story.locator('..').locator('#case-robotics-title').count(), 1, 'robotics is the text-only case');
            await summary.focus();
            await page.keyboard.press('Enter');
            assert.equal(await story.getAttribute('open'), null);
            continue;
          }
          const radios = figure.locator('input[type=radio]');
          const first = radios.nth(0);
          await first.focus();
          for (let i = 0; i < 3; i++) {
            if (i) await page.keyboard.press('ArrowRight');
            assert.equal(await radios.nth(i).isChecked(), true);
            assert.equal(await figure.locator(`.stage-caption[data-stage="${i}"]`).isVisible(), true);
            assert.equal(await figure.locator(`.stage-caption[data-stage="${(i + 1) % 3}"]`).isVisible(), false, 'only the selected explanation should be visible');
            assert.equal(await figure.locator(`.diagram-layer[data-stage="${i}"]`).evaluate(el => getComputedStyle(el).opacity), '1');
            assert.equal(await figure.locator(`.diagram-layer[data-stage="${(i + 1) % 3}"]`).evaluate(el => getComputedStyle(el).opacity), '0');
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'expanded project must fit a narrow viewport');
          await summary.focus();
          await page.keyboard.press('Enter');
          assert.equal(await story.getAttribute('open'), null);
        }
        console.log(`PASS ${lang || 'en/'} all projects expand and diagrams switch with keyboard, without JavaScript`);
      } catch (e) { failed = true; console.error('FAIL', lang || 'en/', e.message); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  process.exitCode = failed ? 1 : 0;
})();
