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
        const picks = page.locator('.case-pick');
        assert.equal(await picks.count(), 5, 'all five projects need a card in the rail');
        assert.equal(await page.locator('.deck-arrow').first().isVisible(), false, 'arrows are an enhancement and stay hidden without JavaScript');
        assert.ok(await page.locator('.deck-rail').evaluate(el => el.scrollWidth > el.clientWidth + 8), 'the rail must have somewhere to scroll');

        for (let i = 0; i < 5; i++) {
          if (i === 0) await picks.first().focus();
          else {
            await picks.nth(i - 1).focus();
            await page.keyboard.press('ArrowRight');
          }
          assert.equal(await picks.nth(i).isChecked(), true, 'arrow keys move between projects');
          const slug = await picks.nth(i).getAttribute('value');

          const open = [];
          for (const panel of await page.locator('.case-panel').all()) {
            if (await panel.isVisible()) open.push(await panel.getAttribute('data-case'));
          }
          assert.deepEqual(open, [slug], `selecting a card should open only its own project`);

          const figure = page.locator(`.case-panel[data-case="${slug}"] .case-figure`);
          if (!await figure.count()) {
            assert.equal(slug, 'robotics', 'robotics is the text-only case');
            continue;
          }
          const radios = figure.locator('input[type=radio]');
          await radios.nth(0).focus();
          for (let stage = 0; stage < 3; stage++) {
            if (stage) await page.keyboard.press('ArrowRight');
            assert.equal(await radios.nth(stage).isChecked(), true);
            assert.equal(await figure.locator(`.stage-caption[data-stage="${stage}"]`).isVisible(), true);
            assert.equal(await figure.locator(`.stage-caption[data-stage="${(stage + 1) % 3}"]`).isVisible(), false, 'only the selected explanation should be visible');
            assert.equal(await figure.locator(`.diagram-layer[data-stage="${stage}"]`).evaluate(el => getComputedStyle(el).opacity), '1');
            assert.equal(await figure.locator(`.diagram-layer[data-stage="${(stage + 1) % 3}"]`).evaluate(el => getComputedStyle(el).opacity), '0');
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'an open project must fit a narrow viewport');
        }
        // The dots are the pointer-only route to a project sitting off the rail.
        await page.locator('.deck-dot').nth(1).click();
        assert.equal(await picks.nth(1).isChecked(), true, 'a dot must select its project without JavaScript');
        assert.equal(await page.locator('.case-panel[data-case="documents"]').isVisible(), true);
        assert.equal(await page.locator('.case-panel[data-case="simulation"]').isVisible(), false);

        console.log(`PASS ${lang || 'en/'} the rail selects every project and diagrams switch with keyboard, without JavaScript`);
      } catch (e) { failed = true; console.error('FAIL', lang || 'en/', e.message); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); server.close(); }
  process.exitCode = failed ? 1 : 0;
})();
