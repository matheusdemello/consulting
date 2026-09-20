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
  let paused = false, visible = true, particles = [], colors;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, energy: 0, active: false, down: false };
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function palette() {
    const css = getComputedStyle(document.documentElement);
    colors = { ink: css.getPropertyValue('--ink').trim(), red: dark.matches ? '#e27e65' : '#ae3828' };
  }
  function layout() {
    const count = width < 500 ? 1000 : 2100;
    particles = Array.from({length: count}, (_, i) => ({
      u: hash(i + 1), v: hash(i + 407), layer: hash(i + 1907),
      px: 0, py: 0, vx: 0, vy: 0
    }));
  }
  // A continuously folding, three-dimensional field. No object silhouettes or SVG targets.
  function position(p, time, step = 0) {
    const a = p.u * TAU + time * (.18 + p.layer * .055) + step;
    const b = p.v * TAU + time * .12;
    const tube = .19 + p.layer * .1 + Math.sin(a * 3 - time * .5) * .04;
    const radius = .68 + tube * Math.cos(b);
    let x = radius * Math.cos(a);
    let y = radius * Math.sin(a);
    let z = tube * Math.sin(b) + .23 * Math.sin(a * 2 + time * .24);
    // The volume tilts, while directors travel around it at independent speeds.
    const tilt = .9 + Math.sin(time * .17) * .3;
    const turn = -.5 + time * .075;
    const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
    const xx = x * Math.cos(turn) + zz * Math.sin(turn);
    z = -x * Math.sin(turn) + zz * Math.cos(turn);
    const perspective = 2.9 / (2.9 - z);
    const scale = Math.min(width * .46, height * .49);
    return { x: width * .5 + xx * scale * perspective, y: height * .5 + yy * scale * perspective, z, perspective };
  }
  function render(still = false, dt = 1 / 60) {
    const time = still ? 5 : elapsed;
    const smooth = 1 - Math.exp(-dt * 8);
    pointer.x += (pointer.tx - pointer.x) * smooth;
    pointer.y += (pointer.ty - pointer.y) * smooth;
    pointer.energy += ((pointer.active && !still ? 1 : 0) - pointer.energy) * smooth;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    const projected = particles.map(p => ({p, point: position(p,time)}));
    projected.sort((a,b) => a.point.z - b.point.z);
    for (const {p, point:q} of projected) {
      const tangent = position(p,time,.013);
      let angle = Math.atan2(tangent.y-q.y,tangent.x-q.x);
      const dx = pointer.x-q.x, dy = pointer.y-q.y;
      const distance = Math.hypot(dx,dy);
      const influence = pointer.energy * Math.exp(-distance*distance/(width*width*.065));
      if (!still) {
        const polarity = pointer.down ? -1.15 : .5;
        const targetX = dx * influence * polarity;
        const targetY = dy * influence * polarity;
        p.vx += (targetX-p.px)*dt*22;
        p.vy += (targetY-p.py)*dt*22;
        p.vx *= Math.exp(-dt*5); p.vy *= Math.exp(-dt*5);
        p.px += p.vx*dt; p.py += p.vy*dt;
        const toward = Math.atan2(dy,dx);
        angle += Math.atan2(Math.sin(2*(toward-angle)),Math.cos(2*(toward-angle))) * influence * .48;
      }
      const x = q.x + (still ? 0 : p.px), y = q.y + (still ? 0 : p.py);
      const depth = Math.max(0,Math.min(1,(q.z+1)/2));
      const domain = Math.sin(p.v*TAU + p.u*3 + time*.24);
      const accent = domain > .24 || influence > .42;
      const half = (1.45 + p.layer * 1.35) * q.perspective * (width < 500 ? .85 : 1);
      const edge = Math.max(0,Math.min(1,Math.min(x,y,width-x,height-y)/28));
      ctx.globalAlpha = (.12 + depth*.67 + influence*.14) * edge;
      ctx.strokeStyle = accent ? colors.red : colors.ink;
      ctx.lineWidth = .65 + depth*.65;
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
  function tick(now) {
    frame = 0;
    if (!running()) { last = 0; return; }
    const dt = last ? Math.min((now-last)/1000,.04) : 1/60;
    elapsed += dt; last = now;
    render(false,dt);
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    toggle.hidden = reduced.matches;
    toggle.textContent = paused ? (ja ? '再生' : 'Resume') : (ja ? '一時停止' : 'Pause');
    toggle.setAttribute('aria-pressed',String(paused));
    if (reduced.matches) { pointer.energy=0; render(true); }
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
