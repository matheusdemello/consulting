const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/consulting/`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  let failures = 0;
  async function check(name, fn) {
    const context = await browser.newContext();
    // Automated regression runs never submit to the real inbox.
    await context.route('https://formspree.io/f/**', route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    try { await fn(page, context); console.log('PASS', name); }
    catch (error) { failures++; console.error('FAIL', name, error.message); }
    finally { await context.close(); }
  }
  try {
    await check('fixed header stays readable over scrolling hero content', async page => {
      await page.goto(base);
      await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
      await page.waitForTimeout(200);
      assert.notEqual(await page.locator('.site-header').evaluate(h => getComputedStyle(h).backgroundColor), 'rgba(0, 0, 0, 0)');
    });
    await check('dark action button has readable text contrast', async page => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(base);
      const colors = await page.locator('.hero .primary').evaluate(el => ({ text: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
      const lum = rgb => {
        const c = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
      };
      const a = lum(colors.text), b = lum(colors.background);
      assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5, 'button text contrast must be at least 4.5:1');
    });
    for (const lang of ['', 'jp/']) {
      await check(`${lang || 'en/'} disconnected form cannot send or pretend success`, async page => {
        await page.route(base + lang, async route => {
          const response = await route.fetch();
          await route.fulfill({ response, body: (await response.text()).replace(/data-endpoint="[^"]*"/, 'data-endpoint=""') });
        });
        const posts = [];
        page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
        await page.goto(base + lang);
        assert.equal(await page.locator('#contact-form button[type=submit]').isDisabled(), true);
        await page.locator('#problem').fill('An example project question.');
        await page.locator('#email').fill('test@example.org');
        await page.locator('#contact-form').evaluate(form => form.requestSubmit());
        assert.equal(posts.length, 0);
        assert.equal(await page.locator('#problem').inputValue(), 'An example project question.');
        assert.match(await page.locator('#form-status').innerText(), /not connected|未接続/);
      });
      await check(`${lang || 'en/'} problem link selects an editable topic and reaches contact`, async page => {
        await page.goto(base + lang);
        await page.locator('[data-topic="robotics"]').click();
        assert.equal(await page.locator('#topic').inputValue(), 'robotics');
        assert.equal(new URL(page.url()).hash, '#contact');
        await page.locator('#topic').selectOption('documents');
        assert.equal(await page.locator('#topic').inputValue(), 'documents');
      });
    }
    await check('pause preserves frame; resume updates it', async page => {
      await page.goto(base);
      const pause = page.locator('#motion-toggle');
      await pause.click();
      const frame = await page.locator('canvas').evaluate(c => c.toDataURL());
      await page.waitForTimeout(160);
      assert.equal(await page.locator('canvas').evaluate(c => c.toDataURL()), frame);
      await pause.click();
      await page.waitForTimeout(160);
      assert.notEqual(await page.locator('canvas').evaluate(c => c.toDataURL()), frame);
    });
    await check('reduced motion renders one still frame', async page => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(base);
      await page.waitForTimeout(180);
      const frame = await page.locator('canvas').evaluate(c => c.toDataURL());
      const box = await page.locator('canvas').boundingBox();
      await page.mouse.move(box.x + box.width * .6, box.y + box.height * .5);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(160);
      assert.equal(await page.locator('canvas').evaluate(c => c.toDataURL()), frame);
      assert.equal(await page.locator('#motion-toggle').isVisible(), false);
    });
    await check('old projects URL resolves to the problem section', async page => {
      await page.goto(base + 'projects.html');
      await page.waitForURL(base + '#problems');
      assert.equal(await page.locator('#problems').count(), 1);
    });
    await check('a link to one project opens it and scrolls there', async page => {
      await page.goto(base + '#work-medical');
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.case-pick:checked').inputValue(), 'medical');
      const panel = page.locator('.case-panel[data-case="medical"]');
      assert.equal(await panel.isVisible(), true);
      // The fragment resolves while the panel is still hidden, so the scroll is
      // the script's job; it must clear the fixed header when it lands.
      const header = await page.locator('.site-header').evaluate(el => el.getBoundingClientRect().height);
      const top = await panel.evaluate(el => el.getBoundingClientRect().top);
      assert.ok(top >= header - 1 && top < 400, `panel landed at ${top} behind a ${header} header`);
    });
    await check('field stops drawing off-screen and resumes on return', async page => {
      await page.goto(base);
      await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
      await page.waitForTimeout(160);
      const frame = await page.locator('canvas').evaluate(c => c.toDataURL());
      await page.waitForTimeout(160);
      assert.equal(await page.locator('canvas').evaluate(c => c.toDataURL()), frame);
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(160);
      assert.notEqual(await page.locator('canvas').evaluate(c => c.toDataURL()), frame);
    });
    await check('attract and repel move field strokes beyond the cursor indicator', async () => {
      const samples = [];
      for (const mode of ['idle', 'attract', 'repel']) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        try {
          await page.clock.install({ time: new Date('2026-09-19T00:00:00Z') });
          await page.clock.pauseAt(new Date('2026-09-19T00:00:01Z'));
          await page.goto(base);
          await page.evaluate(() => document.fonts.ready);
          await page.clock.runFor(1000);
          const box = await page.locator('canvas').boundingBox();
          if (mode !== 'idle') await page.mouse.move(box.x + box.width * .63, box.y + box.height * .4);
          if (mode === 'repel') await page.mouse.down();
          await page.clock.runFor(1200);
          samples.push(await page.locator('canvas').evaluate(canvas => {
            const ratio = canvas.width / canvas.getBoundingClientRect().width;
            // This region excludes the cursor ring. A ring alone cannot pass this check.
            return Array.from(canvas.getContext('2d').getImageData(canvas.width * .57, canvas.height * .52, Math.round(80 * ratio), Math.round(80 * ratio)).data);
          }));
        } finally { await page.close(); }
      }
      assert.notDeepEqual(samples[0], samples[1], 'Attraction must displace field strokes');
      assert.notDeepEqual(samples[1], samples[2], 'Repulsion must differ from attraction');
    });
    for (const lang of ['', 'jp/']) {
      await check(`${lang || 'en/'} rejected submission keeps input; accepted retry clears it`, async page => {
        // All requests to this synthetic endpoint are intercepted. No message leaves the browser.
        await page.route(base + lang, async route => {
          const response = await route.fetch();
          await route.fulfill({ response, body: (await response.text()).replace(/data-endpoint="[^"]*"/, 'data-endpoint="https://formspree.io/f/testonly"') });
        });
        let reject = true, posts = 0, payload;
        await page.route('https://formspree.io/f/testonly', async route => {
          posts++;
          payload = route.request().postData();
          await route.fulfill({ status: reject ? 422 : 200, contentType: 'application/json', body: reject ? '{"errors":[{"message":"Test rejection"}]}' : '{"ok":true}' });
        });
        await page.goto(base + lang);
        assert.equal(await page.locator('#privacy-connected').isVisible(), true);
        assert.equal(await page.locator('#privacy-offline').isVisible(), false);
        await page.locator('#problem').fill('Please inspect this example data problem.');
        await page.locator('#email').fill('test@example.org');
        await page.locator('#topic').selectOption('robotics');
        await page.locator('#contact-form button').click();
        await page.waitForFunction(() => /could not|送信できません/.test(document.querySelector('#form-status').textContent));
        assert.equal(await page.locator('#problem').inputValue(), 'Please inspect this example data problem.');
        assert.equal(await page.locator('#email').inputValue(), 'test@example.org');
        assert.equal(await page.locator('#topic').inputValue(), 'robotics');
        assert.match(payload, /name="message"/);
        assert.match(payload, /Please inspect this example data problem\./);
        reject = false;
        await page.locator('#contact-form button').click();
        await page.waitForFunction(() => /was received|受け付けました/.test(document.querySelector('#form-status').textContent));
        assert.equal(await page.locator('#problem').inputValue(), '');
        assert.equal(posts, 2);
      });
    }
    await check('no-JavaScript page keeps navigation and a still illustration', async (_page, _context) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        await page.goto(base);
        assert.equal(await page.locator('.field-fallback').isVisible(), true);
        assert.equal(await page.locator('#motion-toggle').isVisible(), false);
        assert.equal(await page.locator('#contact-form button').isDisabled(), true);
        await page.locator('.language-link').click();
        assert.equal(await page.locator('html').getAttribute('lang'), 'ja');
        await page.locator('nav a[href="#contact"]').click();
        assert.equal(new URL(page.url()).hash, '#contact');
      } finally { await context.close(); }
    });
    await check('bilingual pages keep links, images and narrow layouts intact', async page => {
      for (const lang of ['', 'jp/']) {
        await page.goto(base + lang);
        const paths = await page.locator('a[href], link[rel=stylesheet], img, script[src]').evaluateAll(nodes => nodes.map(n => n.href || n.src).filter(Boolean));
        for (const address of new Set(paths)) {
          const url = new URL(address);
          if (!url.href.startsWith(base)) continue;
          const response = await page.request.get(address);
          assert.ok(response.ok(), `broken resource ${address}`);
          if (url.hash && url.pathname === new URL(page.url()).pathname) assert.equal(await page.locator(url.hash).count(), 1, `missing target ${url.hash}`);
        }
        await page.locator('.portrait img').scrollIntoViewIfNeeded();
        await page.locator('.portrait img').evaluate(img => img.decode());
        for (const width of [320, 390, 768, 1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow ${lang} at ${width}`);
        }
      }
    });
    // Search engines and link previews read the published address, not the test server.
    const PUBLIC = 'https://matheusdemello.github.io/consulting/';
    await check('search metadata is complete, consistent and keeps contact details private', async page => {
      const cluster = { en: PUBLIC, ja: PUBLIC + 'jp/', 'x-default': PUBLIC };
      for (const [lang, self] of [['', PUBLIC], ['jp/', PUBLIC + 'jp/']]) {
        await page.goto(base + lang);
        const meta = await page.evaluate(() => {
          const prop = p => document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.content;
          return {
            title: document.title,
            canonical: document.querySelector('link[rel=canonical]')?.href,
            alternates: Object.fromEntries([...document.querySelectorAll('link[rel=alternate][hreflang]')].map(l => [l.hreflang, l.href])),
            ogUrl: prop('og:url'), image: prop('og:image'), imageAlt: prop('og:image:alt'),
            imageSize: [prop('og:image:width'), prop('og:image:height')], siteName: prop('og:site_name'),
            localeAlt: prop('og:locale:alternate'), card: prop('twitter:card'),
            ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent)
          };
        });
        assert.match(meta.title, lang ? /東京/ : /Tokyo/, 'the title carries the location people search with');
        assert.ok(meta.title.includes('Matheus de Mello'));
        assert.equal(meta.canonical, self);
        assert.equal(meta.ogUrl, self, 'og:url must match the canonical');
        assert.deepEqual(meta.alternates, cluster, 'hreflang must be reciprocal across both languages');
        assert.ok(meta.siteName && meta.localeAlt && meta.imageAlt, 'site name, alternate locale and image alt are all set');
        assert.equal(meta.card, 'summary_large_image');
        assert.deepEqual(meta.imageSize, ['1200', '630']);
        assert.ok(meta.image.startsWith(PUBLIC + 'i/'), 'og:image must be an absolute public URL');
        const png = await (await page.request.get(meta.image.replace(PUBLIC, base))).body();
        assert.equal(png.toString('ascii', 1, 4), 'PNG');
        assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], 'the share image must be exactly the size it declares');

        assert.equal(meta.ld.length, 1, 'one structured-data block per page');
        const data = JSON.parse(meta.ld[0]);
        const types = data['@graph'].map(node => node['@type']);
        for (const type of ['Person', 'ProfessionalService', 'WebSite']) assert.ok(types.includes(type), `structured data needs a ${type}`);
        // The site never publishes contact details; structured data is published too.
        const keys = new Set();
        (function walk(value) {
          if (Array.isArray(value)) value.forEach(walk);
          else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) { keys.add(key); walk(inner); }
        })(data);
        for (const key of ['email', 'telephone', 'faxNumber', 'streetAddress', 'postalCode']) assert.ok(!keys.has(key), `structured data must not carry ${key}`);
        assert.doesNotMatch(meta.ld[0], /mailto:|@[a-z0-9-]+\.[a-z]{2,}|\+?\d[\d\s-]{7,}\d/i, 'no address or number that could be contact details');
      }
    });
    await check('sitemap lists both languages as one hreflang cluster', async page => {
      const response = await page.request.get(base + 'sitemap.xml');
      assert.ok(response.ok());
      const xml = await response.text();
      await page.goto(base);
      const urls = await page.evaluate(source => {
        const doc = new DOMParser().parseFromString(source, 'application/xml');
        if (doc.querySelector('parsererror')) return null;
        return [...doc.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9', 'url')].map(url => ({
          loc: url.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9', 'loc')[0].textContent.trim(),
          alternates: Object.fromEntries([...url.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')].map(l => [l.getAttribute('hreflang'), l.getAttribute('href')]))
        }));
      }, xml);
      assert.ok(urls, 'sitemap must be well-formed XML');
      assert.deepEqual(urls.map(url => url.loc), [PUBLIC, PUBLIC + 'jp/'], 'only the two real pages, never the redirect');
      for (const url of urls) assert.deepEqual(url.alternates, { en: PUBLIC, ja: PUBLIC + 'jp/', 'x-default': PUBLIC });
    });
    await check('portrait stays within a sensible download budget', async page => {
      await page.goto(base + '#about');
      const image = page.locator('.portrait img');
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.decode());
      const source = await image.evaluate(img => img.currentSrc);
      const bytes = (await (await page.request.get(source)).body()).length;
      assert.ok(bytes < 200 * 1024, `portrait is ${Math.round(bytes / 1024)}KB; it renders at most about 340x390`);
      assert.ok(await image.evaluate(img => img.naturalWidth >= 2 * img.getBoundingClientRect().width), 'still sharp on a 2x screen');
    });
  } finally { await browser.close(); server.close(); }
  process.exitCode = failures ? 1 : 0;
})();
