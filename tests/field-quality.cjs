const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { createServer } = require('./serve.cjs');
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/consulting/`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'msedge' });
  let failures = 0;
  async function page() {
    const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await p.clock.install({ time: new Date('2026-09-20T00:00:00Z') });
    await p.clock.pauseAt(new Date('2026-09-20T00:00:01Z'));
    await p.addInitScript(() => {
      const proto = CanvasRenderingContext2D.prototype;
      const clear = proto.clearRect, stroke = proto.stroke;
      proto.clearRect = function (...args) {
        if (this.canvas.id === 'dipole-field') window.fieldColors = [];
        return clear.apply(this, args);
      };
      proto.stroke = function (...args) {
        if (this.canvas.id === 'dipole-field') window.fieldColors.push(this.strokeStyle);
        return stroke.apply(this, args);
      };
    });
    await p.goto(base);
    await p.evaluate(() => document.fonts.ready);
    return p;
  }
  try {
    const p = await page();
    try {
      const first = await p.locator('canvas').evaluate(c => c.toDataURL());
      await p.clock.runFor(1600);
      await p.reload();
      await p.evaluate(() => document.fonts.ready);
      const second = await p.locator('canvas').evaluate(c => c.toDataURL());
      await p.reload();
      await p.evaluate(() => document.fonts.ready);
      const third = await p.locator('canvas').evaluate(c => c.toDataURL());
      assert.notEqual(first, second, 'First visit must begin with a distinct gathering state');
      assert.equal(second, third, 'Returning visits must skip the entrance consistently');
      console.log('PASS entrance gathers once per tab session');
    } catch(e) { failures++; console.error('FAIL entrance', e.message); }
    finally { await p.close(); }

    const samples = [];
    for (const moving of [false, true]) {
      const p = await page();
      try {
        await p.clock.runFor(1800);
        const box = await p.locator('canvas').boundingBox();
        for (let i=0; i<12; i++) {
          if (moving) await p.mouse.move(box.x+box.width*(.24+i*.045), box.y+box.height*.55);
          await p.clock.runFor(30);
        }
        await p.mouse.move(0,0);
        await p.clock.runFor(1500);
        const wake = await p.evaluate(() => window.fieldColors);
        await p.clock.runFor(5000);
        samples.push({ wake, settled: await p.evaluate(() => window.fieldColors) });
      } finally { await p.close(); }
    }
    try {
      // Only stroke colors are compared: spring displacement or a cursor ring cannot satisfy this.
      assert.notDeepEqual(samples[0].wake, samples[1].wake, 'A color wake must outlive cursor hover');
      assert.deepEqual(samples[0].settled, samples[1].settled, 'The wake must fade completely');
      console.log('PASS mouse wake persists briefly and then fully fades');
    } catch(e) { failures++; console.error('FAIL wake', e.message.slice(0,180)); }
  } finally { await browser.close(); server.close(); }
  process.exitCode = failures ? 1 : 0;
})();
