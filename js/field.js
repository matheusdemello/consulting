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
  let paused = false, visible = true, particles = [], colors, waves = [];
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, energy: 0, active: false, down: false, started: 0, origin: 0 };
  const cycle = TAU * 2;
  const wrap = a => Math.atan2(Math.sin(a / 2), Math.cos(a / 2)) * 2;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function palette() {
    const css = getComputedStyle(document.documentElement);
    colors = { ink: css.getPropertyValue('--ink').trim(), red: dark.matches ? '#e27e65' : '#ae3828' };
  }
  function layout() {
    const count = width < 500 ? 1100 : 2100;
    particles = Array.from({length: count}, (_, i) => ({
      u: hash(i + 1), v: hash(i + 407), layer: hash(i + 1907),
      px: 0, py: 0, vx: 0, vy: 0
    }));
    // One continuous boundary traverses both sides of the half-twisted ribbon.
    for (let i = 0; i < 300; i++) particles.push({
      u: i / 300, v: 1, layer: .5, edge: true, px: 0, py: 0, vx: 0, vy: 0
    });
  }
  // A half-twisted ribbon: the double angular cover lets each stroke travel
  // continuously onto the opposite face, without a jump at the seam.
  function position(p, time, step = 0) {
    const a = p.u * cycle + time * .13 + step;
    const across = p.v * .32;
    let ripple = 0;
    for (const wave of waves) {
      const age = time - wave.born;
      const d = wrap(a - wave.origin - age * 4.2);
      ripple += Math.cos(d * 6) * Math.exp(-d * d * 2.2 - age * .65) * wave.strength;
    }
    const radius = .70 + across * Math.cos(a / 2) + ripple * .045;
    let x = radius * Math.cos(a);
    let y = radius * Math.sin(a);
    let z = across * Math.sin(a / 2) + ripple * (.10 + p.v * .06);
    const tilt = .72 + Math.sin(time * .13) * .14;
    const turn = -.38 + Math.sin(time * .09) * .25;
    const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
    const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
    const xx = x * Math.cos(turn) + zz * Math.sin(turn);
    z = -x * Math.sin(turn) + zz * Math.cos(turn);
    const perspective = 2.9 / (2.9 - z);
    const scale = Math.min(width * .41, height * .43);
    // A gentle in-plane rotation keeps the twist visible rather than turning edge-on.
    const roll = -.36 + Math.sin(time * .07) * .12;
    const sx = xx * Math.cos(roll) - yy * Math.sin(roll);
    const sy = xx * Math.sin(roll) + yy * Math.cos(roll);
    return { x: width * .5 + sx * scale * perspective, y: height * .5 + sy * scale * perspective, z, perspective, a, ripple };
  }
  function render(still = false, dt = 1 / 60) {
    const time = still ? 5 : elapsed;
    if (still) waves = [];
    else waves = waves.filter(wave => time - wave.born < 6);
    const smooth = 1 - Math.exp(-dt * 8);
    pointer.x += (pointer.tx - pointer.x) * smooth;
    pointer.y += (pointer.ty - pointer.y) * smooth;
    pointer.energy += ((pointer.active && !still ? 1 : 0) - pointer.energy) * smooth;
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    const projected = particles.map(p => ({p, point: position(p,time)}));
    projected.sort((a,b) => a.point.z - b.point.z);
    if (pointer.down && !still) {
      let nearest = Infinity;
      for (const {point:q} of projected) {
        const d = (q.x-pointer.x)**2 + (q.y-pointer.y)**2;
        if (d < nearest) { nearest = d; pointer.origin = q.a; }
      }
    }
    for (const {p, point:q} of projected) {
      const tangent = position(p,time,.013);
      let angle = Math.atan2(tangent.y-q.y,tangent.x-q.x);
      const dx = pointer.x-q.x, dy = pointer.y-q.y;
      const distance = Math.hypot(dx,dy);
      const influence = pointer.energy * Math.exp(-distance*distance/(width*width*.065));
      const pulseDistance = wrap(q.a - time * 1.05);
      const pulse = Math.exp(-pulseDistance * pulseDistance * 2.6);
      if (!still) {
        const polarity = pointer.down ? -.85 : .32;
        const targetX = dx * influence * polarity;
        const targetY = dy * influence * polarity;
        p.vx += (targetX-p.px)*dt*22;
        p.vy += (targetY-p.py)*dt*22;
        p.vx *= Math.exp(-dt*4.5); p.vy *= Math.exp(-dt*4.5);
        p.px += p.vx*dt; p.py += p.vy*dt;
        const toward = Math.atan2(dy,dx);
        angle += Math.atan2(Math.sin(2*(toward-angle)),Math.cos(2*(toward-angle))) * influence * .48;
      }
      const x = q.x + (still ? 0 : p.px), y = q.y + (still ? 0 : p.py);
      const depth = Math.max(0,Math.min(1,(q.z+1)/2));
      angle += Math.sin(p.layer * TAU + time * .4) * .16 * (1-pulse);
      const accent = pulse > .20 || Math.abs(q.ripple) > .12 || influence > .55;
      const half = (p.edge ? 2.8 : 1.6 + p.layer * 1.25 + pulse * .6) * q.perspective * (width < 500 ? .82 : 1);
      const edge = Math.max(0,Math.min(1,Math.min(x,y,width-x,height-y)/28));
      ctx.globalAlpha = Math.min(1, .10 + depth*.62 + pulse*.22 + (p.edge ? .15 : 0)) * edge;
      ctx.strokeStyle = accent ? colors.red : colors.ink;
      ctx.lineWidth = (p.edge ? .65 : .55) + depth*.7 + pulse*.25;
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
  function release() {
    if (pointer.down && running()) {
      waves.push({ origin: pointer.origin, born: elapsed, strength: Math.min(1.3, .55 + elapsed - pointer.started) });
      waves = waves.slice(-3);
    }
    pointer.down=false;
  }
  function cancel() { pointer.down=false; pointer.active=false; }
  palette(); resize(); stage.classList.add('is-ready');
  toggle.addEventListener('click',()=>{paused=!paused;sync();});
  canvas.addEventListener('pointermove',move,{passive:true});
  canvas.addEventListener('pointerdown',event=>{
    if (event.button !== 0 || !event.isPrimary) return;
    move(event);pointer.down=true;pointer.started=elapsed;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerleave',()=>{if (!pointer.down) pointer.active=false;});
  window.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden) cancel();sync();});
  reduced.addEventListener('change',sync);
  dark.addEventListener('change',()=>{palette();render(reduced.matches);});
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize',resize);
  sync();
})();
