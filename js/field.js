(() => {
  'use strict';
  const canvas = document.querySelector('#dipole-field');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = canvas.parentElement;
  const toggle = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const ja = document.documentElement.lang === 'ja';
  const TAU = Math.PI * 2;
  let width = 1, height = 1, frame = 0, last = 0, elapsed = 0;
  let paused = false, visible = true, particles = [], drawOrder = [], colors;
  let entrance = !reduced.matches, entranceTime = 0;
  try { entrance = entrance && sessionStorage.getItem('consulting-field-intro') !== 'seen'; } catch {}
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, energy: 0, active: false, down: false, speed: 0, heading: 0 };
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function palette() {
    const css = getComputedStyle(document.documentElement);
    colors = { ink: css.getPropertyValue('--ink').trim(), red: dark.matches ? '#e27e65' : '#ae3828' };
    // Precompute smooth teal / vermilion / amber transitions, not per-frame RGB strings.
    const stops = dark.matches
      ? [[88, 175, 188], [237, 103, 79], [242, 184, 119]]
      : [[24, 91, 104], [185, 53, 35], [175, 111, 39]];
    colors.field = Array.from({length: 256}, (_, i) => {
      const t = i / 255 * 2, segment = Math.min(1, Math.floor(t));
      const blend = t - segment;
      const rgb = stops[segment].map((v, c) => Math.round(v + (stops[segment + 1][c] - v) * blend));
      return `rgb(${rgb.join(',')})`;
    });
  }
  function layout() {
    const count = width < 500 ? 2600 : 5400;
    particles = Array.from({length: count}, (_, i) => ({
      u: hash(i + 1), v: hash(i + 407), layer: hash(i + 1907),
      sx: .08 + hash(i + 2917) * .84, sy: .08 + hash(i + 3907) * .84,
      px: 0, py: 0, vx: 0, vy: 0, heat: 0, wakeAngle: 0, point: {}, tangent: {}
    }));
    drawOrder = particles.slice();
  }
  // A continuously folding, three-dimensional field. No object silhouettes or SVG targets.
  function position(p, time, step, camera, out) {
    const a = p.u * TAU + time * (.18 + p.layer * .055) + step;
    const b = p.v * TAU + time * .12;
    const tube = .19 + p.layer * .1 + Math.sin(a * 3 - time * .5) * .04;
    const radius = .68 + tube * Math.cos(b);
    let x = radius * Math.cos(a);
    let y = radius * Math.sin(a);
    let z = tube * Math.sin(b) + .23 * Math.sin(a * 2 + time * .24);
    // The volume tilts, while directors travel around it at independent speeds.
    const yy = y * camera.ct - z * camera.st;
    const zz = y * camera.st + z * camera.ct;
    const xx = x * camera.cr + zz * camera.sr;
    z = -x * camera.sr + zz * camera.cr;
    const perspective = 2.9 / (2.9 - z);
    out.x = width * .5 + xx * camera.scale * perspective;
    out.y = height * .5 + yy * camera.scale * perspective;
    out.z = z; out.perspective = perspective;
  }
  function render(still = false, dt = 1 / 60) {
    const time = still ? 5 : elapsed;
    const scatter = !still && entrance ? Math.pow(1 - Math.min(1, entranceTime / 1.2), 3) : 0;
    const smooth = 1 - Math.exp(-dt * 8);
    const previousX = pointer.x, previousY = pointer.y;
    pointer.x += (pointer.tx - pointer.x) * smooth;
    pointer.y += (pointer.ty - pointer.y) * smooth;
    const travelX = pointer.x - previousX, travelY = pointer.y - previousY;
    pointer.speed = pointer.active && !still ? Math.min(1, Math.hypot(travelX, travelY) / (width * dt) * 2.5) : 0;
    if (pointer.speed > .01) pointer.heading = Math.atan2(travelY, travelX);
    pointer.energy += ((pointer.active && !still ? 1 : 0) - pointer.energy) * smooth;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    const tilt = .9 + Math.sin(time * .17) * .3, turn = -.5 + time * .075;
    const camera = { ct: Math.cos(tilt), st: Math.sin(tilt), cr: Math.cos(turn), sr: Math.sin(turn), scale: Math.min(width*.46,height*.49) };
    for (const p of particles) {
      position(p,time,0,camera,p.point);
      position(p,time,.013,camera,p.tangent);
    }
    // Reuse the nearly sorted depth order and projection objects between frames.
    drawOrder.sort((a,b) => a.point.z - b.point.z);
    const wakeDecay = Math.exp(-dt * 2.1);
    for (const p of drawOrder) {
      const q = p.point, tangent = p.tangent;
      let angle = Math.atan2(tangent.y-q.y,tangent.x-q.x);
      const dx = pointer.x-q.x, dy = pointer.y-q.y;
      const distance = Math.hypot(dx,dy);
      const influence = pointer.energy * Math.exp(-distance*distance/(width*width*.065));
      if (!still) {
        // Carry a fading mark on the strokes themselves, so the wake moves with the field.
        p.heat *= wakeDecay;
        const brushX = dx - p.px, brushY = dy - p.py;
        const brush = pointer.speed > .001 ? pointer.speed * Math.exp(-(brushX*brushX + brushY*brushY)/(width*width*.008)) : 0;
        if (brush > p.heat) { p.heat = brush; p.wakeAngle = pointer.heading; }
        if (p.heat < .004) p.heat = 0;
        const polarity = pointer.down ? -1.15 : .5;
        const targetX = dx * influence * polarity;
        const targetY = dy * influence * polarity;
        p.vx += (targetX-p.px)*dt*22;
        p.vy += (targetY-p.py)*dt*22;
        p.vx *= Math.exp(-dt*5); p.vy *= Math.exp(-dt*5);
        p.px += p.vx*dt; p.py += p.vy*dt;
        const toward = Math.atan2(dy,dx);
        angle += Math.atan2(Math.sin(2*(toward-angle)),Math.cos(2*(toward-angle))) * influence * .48;
        if (p.heat > 0) angle += Math.atan2(Math.sin(2*(p.wakeAngle-angle)),Math.cos(2*(p.wakeAngle-angle))) * p.heat * .4;
      }
      const x = (q.x + (still ? 0 : p.px)) * (1-scatter) + width * p.sx * scatter;
      const y = (q.y + (still ? 0 : p.py)) * (1-scatter) + height * p.sy * scatter;
      angle += Math.atan2(Math.sin(p.layer*TAU-angle),Math.cos(p.layer*TAU-angle)) * scatter;
      const depth = Math.max(0,Math.min(1,(q.z+1)/2));
      const domain = Math.sin(p.v*TAU + p.u*3 + time*.24);
      const front = Math.max(0,Math.min(1,(depth-.15)/.7));
      const heat = still ? 0 : p.heat;
      // Depth supplies the broad color regions; folds and cursor movement add warm highlights.
      const colorPhase = .04 + front*.82 + (domain+1)*.07;
      const warmth = Math.min(1, heat * .85 + influence * .15);
      const colorIndex = Math.round(255 * (colorPhase + (Math.max(colorPhase,.88)-colorPhase)*warmth));
      const half = (1.15 + p.layer * 1.05) * q.perspective * (width < 500 ? .85 : 1);
      const edge = Math.max(0,Math.min(1,Math.min(x,y,width-x,height-y)/28));
      ctx.globalAlpha = Math.min(1, (dark.matches ? .13 : .07) + Math.pow(depth,1.45)*.95 + heat*.18 + influence*.08) * edge * (1-scatter*.3);
      ctx.strokeStyle = colors.field[colorIndex];
      ctx.lineWidth = .38 + depth*.82 + heat*.12;
      ctx.beginPath();
      ctx.moveTo(x-Math.cos(angle)*half,y-Math.sin(angle)*half);
      ctx.lineTo(x+Math.cos(angle)*half,y+Math.sin(angle)*half);
      ctx.stroke();
    }
    if (!still && pointer.energy > .03) {
      ctx.globalAlpha = pointer.energy * .6;
      ctx.strokeStyle = colors.red; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(pointer.x,pointer.y,pointer.down ? 12 : 5,0,TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pointer.x-2,pointer.y); ctx.lineTo(pointer.x+2,pointer.y);
      if (!pointer.down) { ctx.moveTo(pointer.x,pointer.y-2); ctx.lineTo(pointer.x,pointer.y+2); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function running() { return !paused && !reduced.matches && visible && !document.hidden; }
  function finishEntrance() {
    if (!entrance) return;
    entrance = false;
    try { sessionStorage.setItem('consulting-field-intro', 'seen'); } catch {}
  }
  function tick(now) {
    frame = 0;
    if (!running()) { last = 0; return; }
    const dt = last ? Math.min((now-last)/1000,.04) : 1/60;
    elapsed += dt; last = now;
    if (entrance) { entranceTime += dt; if (entranceTime >= 1.2) finishEntrance(); }
    render(false,dt);
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    toggle.hidden = reduced.matches;
    toggle.textContent = paused ? (ja ? '再生' : 'Resume') : (ja ? '一時停止' : 'Pause');
    toggle.setAttribute('aria-pressed',String(paused));
    if (reduced.matches) {
      finishEntrance(); pointer.energy=0; pointer.speed=0;
      particles.forEach(p=>{p.heat=0;}); render(true);
    }
    else if (running()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const box = stage.getBoundingClientRect();
    width = Math.max(1,box.width); height = Math.max(1,box.height);
    const ratio = Math.min(devicePixelRatio || 1,2);
    canvas.width = Math.round(width*ratio); canvas.height = Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    layout(); render(reduced.matches);
  }
  function move(event) {
    const box = canvas.getBoundingClientRect();
    pointer.tx = event.clientX-box.left; pointer.ty = event.clientY-box.top;
    if (!pointer.active) { pointer.x=pointer.tx; pointer.y=pointer.ty; }
    pointer.active = true;
  }
  function release() { pointer.down=false; }
  palette(); resize(); stage.classList.add('is-ready');
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  canvas.addEventListener('pointermove',move,{passive:true});
  canvas.addEventListener('pointerdown',event=>{move(event);pointer.down=true;});
  canvas.addEventListener('pointerleave',()=>{pointer.active=false;pointer.down=false;});
  window.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',()=>{release();pointer.active=false;});
  window.addEventListener('blur',()=>{release();pointer.active=false;});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  dark.addEventListener('change',()=>{palette();render(reduced.matches);});
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize',resize);
  sync();
})();
