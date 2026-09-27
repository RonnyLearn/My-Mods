// NeonKeys prototype — UI behaviour + canvas light engine. Visual only: no audio, no saving, no network.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $('#app'), root = document.documentElement, piano = $('#piano');

  // ================= UI =================
  const toastEl = $('#toast'); let toastT;
  const toast = m => { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2200); };
  const KEYMAP = { F1: 'library', F2: 'train', F3: 'rooms', F4: 'studio', F5: 'sound', F6: 'notepad', F8: 'profile', F9: 'settings' };
  const game = $('#game'), modal = $('#modal'), fly = $('#fly-tools');
  function hideSheets(except) {
    $$('.sheetw').forEach(p => { if (p.id !== 'p-' + except) p.hidden = true; });
    $$('[data-open]').forEach(b => b.classList.remove('act'));
  }
  function openPanel(k, force) {
    const p = $('#p-' + k); if (!p) return;
    const willOpen = force || p.hidden;
    hideSheets(k); closePops(); fly.hidden = true; game.hidden = true;
    p.hidden = !willOpen;
    if (willOpen) $$(`.dock [data-open="${k}"]`).forEach(b => b.classList.add('act'));
    hideHint();
  }
  function selectTab(scope, name) {
    const g = scope.closest('[data-tabgroup]'); if (!g) return;
    $$('[data-tab]', g).forEach(t => { if (t.closest('[data-tabgroup]') === g && !t.dataset.join) t.classList.toggle('on', t.dataset.tab === name); });
    $$('[data-pane]', g).forEach(p => { if (p.closest('[data-tabgroup]') === g) p.hidden = p.dataset.pane !== name; });
  }
  const openTab = (panel, tab) => { openPanel(panel, true); const t = $(`#p-${panel} [data-tab="${tab}"]`); if (t) selectTab(t, tab); };
  function openGame(k) {
    if (k === 'song') { openTab('studio', 'practice'); return; }
    hideSheets(); closePops(); fly.hidden = true;
    game.hidden = false;
    $$(':scope > .pane', game).forEach(p => p.hidden = p.dataset.pane !== k);
    hideHint();
  }
  const closePops = () => $$('.pop').forEach(p => p.hidden = true);
  function openModal(k) { modal.hidden = false; $$('[data-m]', modal).forEach(p => p.hidden = p.dataset.m !== k); }
  let zTop = 30;
  function openWin(k) { const w = $('#w-' + k); if (w) { w.hidden = false; w.style.zIndex = ++zTop; } fly.hidden = true; }

  document.addEventListener('click', e => {
    const t = e.target, el = s => t.closest(s); let x;
    if (!el('.pop') && !el('[data-pop]')) closePops();
    if (!el('#fly-tools') && !el('[data-flyout]')) fly.hidden = true;

    if ((x = el('[data-join]'))) { const [n, m] = x.dataset.join.split('|'); $('#roomName').textContent = n; $('#roomMode').textContent = m; if (!modal.hidden) modal.hidden = true; openTab('rooms', 'room'); selectTab($('#feed [data-tab="room"]'), 'room'); toast('Ты в комнате «' + n + '»'); return; }
    if ((x = el('[data-studio]'))) { openTab('studio', x.dataset.studio); return; }
    if ((x = el('[data-open-settings]'))) { openTab('settings', x.dataset.openSettings); return; }
    if ((x = el('[data-open-profile]'))) { openTab('profile', x.dataset.openProfile); return; }
    if ((x = el('[data-game]'))) { openGame(x.dataset.game); return; }
    if ((x = el('[data-open]'))) { openPanel(x.dataset.open); return; }
    if ((x = el('[data-close]'))) { x.closest('.sheetw').hidden = true; $$('[data-open]').forEach(b => b.classList.remove('act')); return; }
    if ((x = el('[data-close-game]'))) { game.hidden = true; toast('Тренировка завершена'); return; }
    if ((x = el('.gset'))) { const d = x.closest('.pane').querySelector('.gdrawer'); if (d) d.hidden = !d.hidden; return; }
    if ((x = el('[data-modal]'))) { openModal(x.dataset.modal); closePops(); return; }
    if ((x = el('[data-close-modal]'))) { modal.hidden = true; return; }
    if (t === modal) { modal.hidden = true; return; }
    if ((x = el('[data-claim]'))) { x.innerHTML = '<span>Получено</span>'; x.disabled = true; $('.streak .dot')?.remove(); toast('+170 монет · серия 13 дней'); return; }
    if ((x = el('[data-pop]'))) { const p = $('#pop-' + x.dataset.pop), was = p.hidden; closePops(); p.hidden = !was; return; }
    if ((x = el('[data-flyout]'))) { fly.hidden = !fly.hidden; return; }
    if ((x = el('[data-win]'))) { openWin(x.dataset.win); return; }
    if ((x = el('[data-close-win]'))) { x.closest('.win').hidden = true; return; }
    if ((x = el('[data-feed]'))) { $('#feed').classList.toggle('closed'); return; }
    if ((x = el('[data-feed-dm]'))) { $('#feed').classList.remove('closed'); selectTab($('#feed [data-tab="dm"]'), 'dm'); return; }
    if ((x = el('[data-filter]'))) { $$('[data-filter]').forEach(b => b.classList.toggle('on', b === x)); const f = x.dataset.filter; $$('.tc').forEach(c => c.classList.toggle('dim', f !== 'Все' && c.dataset.cat !== f)); return; }
    if ((x = el('[data-tab]'))) { selectTab(x, x.dataset.tab); return; }
    if ((x = el('[data-cycle]'))) { const o = x.dataset.cycle.split('|'); x.textContent = o[(o.indexOf(x.textContent) + 1) % o.length]; return; }
    if ((x = el('[data-quiz] button'))) { $$('button', x.parentElement).forEach(b => b.classList.remove('ok', 'bad')); const ok = Math.random() > .4; x.classList.add(ok ? 'ok' : 'bad'); toast(ok ? 'Верно' : 'Не то — попробуй ещё'); return; }
    if ((x = el('.met'))) { x.classList.add('boom'); setTimeout(() => x.remove(), 420); toast('Метеор сбит · +120'); return; }
    if ((x = el('#tapBtn'))) { x.classList.add('hitme'); setTimeout(() => x.classList.remove('hitme'), 110); return; }
    if ((x = el('.fav'))) { x.classList.toggle('on'); return; }
    if ((x = el('.vote'))) { x.classList.toggle('on'); const b = x.querySelector('b'); b.textContent = +b.textContent + (x.classList.contains('on') ? 1 : -1); return; }
    if ((x = el('.cap'))) { $$('.cap.wait').forEach(k => k.classList.remove('wait')); x.classList.add('wait'); x.textContent = 'нажми…'; waitingKey = x; return; }
    if ((x = el('.playbtn'))) { x.classList.toggle('playing'); x.closest('.studio,.npad')?.classList.toggle('playing', x.classList.contains('playing')); return; }
    if ((x = el('.recbtn'))) { x.classList.toggle('recording'); toast(x.classList.contains('recording') ? 'Запись идёт (в макете — только вид)' : 'Запись остановлена'); return; }
    if ((x = el('.lay .x'))) { x.closest('.lay').remove(); return; }
    if ((x = el('.addlay'))) { toast('Выбери инструмент выше — он станет новым слоем'); return; }
    if ((x = el('.trn'))) { x.previousElementSibling.textContent = 'Сегодня занимался два часа'; x.remove(); return; }
    if ((x = el('.emo'))) { const i = $('#feedInput'); i.value += ' 🎹'; i.focus(); return; }
    if ((x = el('#trUp'))) { setTr(tr + 1); return; }
    if ((x = el('#trDown'))) { setTr(tr - 1); return; }
    if ((x = el('#metroBtn'))) { app.classList.toggle('metro-on'); x.classList.toggle('on'); return; }
    if ((x = el('.ctl [data-toggle]'))) { x.classList.toggle('on'); if (x.id === 'sus') sustain = x.classList.contains('on'); return; }
    if ((x = el('.pills > button'))) { $$('button', x.parentElement).forEach(b => b.classList.toggle('on', b === x)); applyCtl(x.parentElement, x); return; }
    if ((x = el('[data-single] > *'))) { $$(':scope > *', x.parentElement).forEach(b => b.classList.toggle('on', b === x)); applyCtl(x.parentElement, x); return; }
    if ((x = el('[data-multi] > .tag'))) { x.classList.toggle('on'); return; }
    if ((x = el('.toggle'))) { x.classList.toggle('on'); x.setAttribute('aria-checked', x.classList.contains('on')); applyCtl(x, x); return; }
    if ((x = el('.mini'))) { x.classList.toggle('on'); return; }
    if ((x = el('.btn, .rb, .dd, .cdot, .gb, .inst, .ws, .rtile, .preset'))) { const l = (x.textContent || x.title || '').trim(); toast((l ? '«' + l + '» ' : '') + '— в макете только кнопка'); }
  });

  // ---- visual settings ----
  const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function setAccent(hex) { const [r, g, b] = hexRgb(hex); root.style.setProperty('--acc', hex); root.style.setProperty('--acc-rgb', `${r},${g},${b}`); FX.setColor(r, g, b); }
  function applyCtl(box, item) {
    const a = box.dataset.apply; if (!a) return;
    const [kind, arg] = a.split(':'); const v = item.dataset.v; const on = item.classList.contains('on');
    switch (kind) {
      case 'acc': setAccent(v); break;
      case 'bg': app.dataset.bg = v; break;
      case 'beam': FX.o.beam = v; break;
      case 'horizon': app.dataset.horizon = v; FX.o.horizon = v; break;
      case 'labels': app.dataset.labels = v; break;
      case 'keyskin': app.dataset.keyskin = v; break;
      case 'docklabels': app.dataset.docklabels = v; break;
      case 'dockside': app.dataset.dockside = v; break;
      case 'dust': FX.o.dust = on; break;
      case 'fx': FX.o[arg] = on; break;
      case 'pet': $('.pet').hidden = !on; break;
      case 'caption': $('.caption').hidden = !on; break;
      case 'env': app.classList.toggle('env-' + ['rain', 'snow', 'petals', 'flies', 'storm'][+arg], on); break;
      case 'w': { const m = { chord: '.chord', staff: '.staff', today: '.today', ctl: '.ctl', feed: '#feed' }; $(m[arg]).hidden = !on; break; }
    }
  }
  const rangeApply = {
    ph: v => { app.style.setProperty('--ph', v / 72); FX.resize(); },
    bspeed: v => FX.o.speed = v / 280, bwidth: v => FX.o.width = v / 100,
    hbright: v => FX.o.hbright = v / 100, fxamount: v => FX.o.amount = v / 100, trail: v => FX.o.trailLen = v,
    amb: v => piano.style.filter = `brightness(${(.5 + v / 140).toFixed(2)})`,
    capsize: v => $('#capMain').style.fontSize = `calc(${46 * v / 100}*var(--s))`,
  };
  const fmt = (v, u, f) => f === 'off0' && +v === 0 ? 'выкл' : f === 'sign' ? (v > 0 ? '+' : '') + v + u : f === 'time' ? Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0') : v + u;
  function syncRange(r) {
    r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
    const out = r.closest('.field')?.querySelector('output') || (r.nextElementSibling?.tagName === 'OUTPUT' ? r.nextElementSibling : null);
    if (out) out.textContent = r.closest('.lay') ? r.value + '%' : fmt(r.value, r.dataset.unit || '', r.dataset.fmt);
    rangeApply[r.dataset.apply]?.(+r.value);
  }
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.type === 'range') syncRange(t);
    if (t.classList.contains('capIn')) $('#capMain').textContent = t.value;
    if (t.classList.contains('capSubIn')) $('#capSub').textContent = t.value;
    if (t.id === 'setSearch') filterSettings(t.value);
  });
  function filterSettings(q) {
    q = q.trim().toLowerCase(); const set = $('#p-settings .sset'), panes = $$('.smain > .pane', set);
    if (!q) { const cur = $('.snav .on', set)?.dataset.tab; panes.forEach(p => p.hidden = p.dataset.pane !== cur); $$('.card', set).forEach(c => c.classList.remove('hide')); $('.nores', set).hidden = true; return; }
    let any = false;
    panes.forEach(p => { let hit = false; $$('.card', p).forEach(c => { const h = c.textContent.toLowerCase().includes(q); c.classList.toggle('hide', !h); hit ||= h; }); p.hidden = !hit; any ||= hit; });
    $('.nores', set).hidden = any;
  }
  $('#feedForm').addEventListener('submit', e => {
    e.preventDefault(); const i = $('#feedInput'); if (!i.value.trim()) return;
    const pane = $$('#feed .flist').find(p => !p.hidden);
    const m = document.createElement('div'); m.className = 'fm me msg-new'; m.innerHTML = '<div class="fb"><b>Ронни</b><p></p></div>'; m.querySelector('p').textContent = i.value;
    pane.appendChild(m); pane.scrollTop = 1e6; i.value = '';
  });
  let npSize = 16;
  const npSet = d => { npSize = Math.max(10, Math.min(28, npSize + d)); $('#npText').style.fontSize = npSize + 'px'; $('#npSize').textContent = npSize; };
  $('#npPlus').addEventListener('click', e => { e.stopPropagation(); npSet(2); });
  $('#npMinus').addEventListener('click', e => { e.stopPropagation(); npSet(-2); });
  $$('.win .wh').forEach(h => h.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const w = h.parentElement; w.style.zIndex = ++zTop; const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop;
    const mv = ev => { w.style.left = Math.max(0, ev.clientX - sx) + 'px'; w.style.top = Math.max(0, ev.clientY - sy) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }));
  let hintOff = false; const hideHint = () => { if (!hintOff) { hintOff = true; $('#hint').classList.add('gone'); } };
  setTimeout(hideHint, 10000);

  // ================= LIGHT ENGINE =================
  const FX = (() => {
    const cv = $('#fx'), ctx = cv.getContext('2d');
    const o = { beam: 'glow', horizon: 'glow', dust: true, sparks: true, embers: true, shock: true, trail: true, hreact: true, speed: 1, width: 1, hbright: 1, amount: 1, trailLen: 1.2 };
    let W = 0, H = 0, dpr = 1, s = 1, hy = 0, col = [240, 194, 123];
    const beams = [], sparks = [], embers = [], shocks = [], flashes = [], ghosts = [], dust = [];
    const BINS = 200, energy = new Float32Array(BINS);
    let glow, glowW, dot;
    const rgba = (a, c = col) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    const mix = (t) => [col[0] + (255 - col[0]) * t, col[1] + (255 - col[1]) * t, col[2] + (255 - col[2]) * t].map(Math.round);
    function sprite(size, stops) {
      const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(([p, cc]) => gr.addColorStop(p, cc)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
    }
    function buildSprites() {
      glow = sprite(128, [[0, rgba(.9, mix(.6))], [.18, rgba(.55)], [.45, rgba(.14)], [1, rgba(0)]]);
      glowW = sprite(64, [[0, 'rgba(255,255,255,1)'], [.25, rgba(.8, mix(.5))], [.6, rgba(.2)], [1, rgba(0)]]);
      dot = sprite(32, [[0, 'rgba(255,255,255,.95)'], [.35, rgba(.6, mix(.3))], [1, rgba(0)]]);
    }
    function resize() {
      const r = app.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s = W / 1600; hy = piano.getBoundingClientRect().top - r.top;
      if (!dust.length) for (let i = 0; i < 110; i++) dust.push(newDust(true));
    }
    function newDust(anywhere) {
      const z = Math.random() ** 1.6; // 0 far .. 1 near
      return { x: Math.random() * W, y: anywhere ? Math.random() * hy : hy + 10, z, vx: (Math.random() - .5) * 6, vy: -(4 + z * 14), ph: Math.random() * 6.28, r: .6 + z * 2.6 };
    }
    function setColor(r, g, b) { col = [r, g, b]; buildSprites(); }
    const binOf = x => Math.max(0, Math.min(BINS - 1, Math.floor(x / W * BINS)));

    function noteOn(x, w, vel) {
      const v = vel / 127, k = o.amount;
      const b = { x, w, v, top: hy, bot: hy, held: true, t0: now, rel: 0, seed: Math.random() * 100 };
      beams.push(b);
      flashes.push({ x, y: hy, t: 0, life: .35, size: (46 + 64 * v) * s });
      if (o.shock) shocks.push({ x, y: hy, t: 0, life: .7 + .3 * v, r: (90 + 90 * v) * s });
      if (o.sparks) { const n = Math.round((5 + 15 * v) * k); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - .5) * 2.3, sp = (180 + 520 * Math.random() * v) * s; sparks.push({ x: x + (Math.random() - .5) * w, y: hy - 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .45 + Math.random() * .7, t: 0, w: .8 + Math.random() * 1.4, bounced: false }); } }
      return b;
    }
    function noteOff(b, sus) {
      if (!b || !b.held) return; b.held = false; b.rel = now;
      if (sus && o.trail) ghosts.push({ x: b.x, w: b.w, t: 0, life: o.trailLen, v: b.v });
    }
    let now = 0, last = performance.now(), fpsAcc = 0;
    function step(t) {
      const dt = Math.min(.05, (t - last) / 1000); last = t; now += dt;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      const speed = 280 * s * o.speed;
      // ---- dust (depth, drift, twinkle) ----
      if (o.dust) for (const d of dust) {
        d.x += (d.vx + Math.sin(now * .3 + d.ph) * 4 * d.z) * dt; d.y += d.vy * dt;
        if (d.y < -20 || d.x < -20 || d.x > W + 20) Object.assign(d, newDust(false));
        const tw = .55 + .45 * Math.sin(now * (1 + d.z * 2) + d.ph);
        const near = Math.max(0, 1 - Math.abs(d.y - hy) / (260 * s));
        const a = (.08 + .22 * d.z) * tw * (1 + near * 1.5 * energyAt(d.x));
        const r = d.r * s * (d.z > .8 ? 3.2 : 1.6);
        ctx.globalAlpha = Math.min(.8, a); ctx.drawImage(d.z > .8 ? glow : dot, d.x - r, d.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      // ---- energy for horizon ----
      for (let i = 0; i < BINS; i++) energy[i] *= Math.pow(.02, dt);
      // ---- sustain ghosts ----
      for (let i = ghosts.length - 1; i >= 0; i--) {
        const g = ghosts[i]; g.t += dt; const k = 1 - g.t / g.life; if (k <= 0) { ghosts.splice(i, 1); continue; }
        const h = 150 * s * (.6 + .4 * g.v), gw = g.w * 1.6 * o.width;
        const gr = ctx.createLinearGradient(0, hy - h, 0, hy); gr.addColorStop(0, rgba(0)); gr.addColorStop(1, rgba(.28 * k * k));
        ctx.fillStyle = gr; ctx.fillRect(g.x - gw / 2, hy - h, gw, h);
      }
      // ---- beams ----
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.top -= speed * dt; if (!b.held) b.bot -= speed * dt;
        if (b.bot < -40) { beams.splice(i, 1); continue; }
        if (b.held) { const bi = binOf(b.x); for (let j = -6; j <= 6; j++) { const q = bi + j; if (q >= 0 && q < BINS) energy[q] = Math.max(energy[q], (.55 + .45 * b.v) * Math.exp(-j * j / 10)); } }
        drawBeam(b);
        if (o.embers && Math.random() < dt * (b.held ? 9 : 3) * (0.4 + b.v) * o.amount) {
          const y = b.bot - Math.random() * Math.min(b.bot - b.top, 260 * s);
          embers.push({ x: b.x + (Math.random() - .5) * b.w, y, vx: (Math.random() - .5) * 20 * s, vy: -(30 + Math.random() * 60) * s, t: 0, life: 1.4 + Math.random() * 1.8, ph: Math.random() * 6.28, r: (1 + Math.random() * 1.8) * s });
        }
      }
      // ---- horizon ----
      drawHorizon();
      // ---- shockwaves ----
      for (let i = shocks.length - 1; i >= 0; i--) {
        const q = shocks[i]; q.t += dt; const k = q.t / q.life; if (k >= 1) { shocks.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k, 3), r = q.r * e;
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1, .16);
        ctx.strokeStyle = rgba(.4 * (1 - k)); ctx.lineWidth = (3.5 * (1 - k) + .5) * s / .16 * .16; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.stroke();
        ctx.strokeStyle = rgba(.1 * (1 - k)); ctx.lineWidth = 8 * s; ctx.beginPath(); ctx.arc(0, 0, r * .92, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
      // ---- impact flashes ----
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]; f.t += dt; const k = f.t / f.life; if (k >= 1) { flashes.splice(i, 1); continue; }
        const a = .8 * (1 - k) ** 2.2, z = f.size * (0.7 + .5 * k);
        ctx.globalAlpha = a; ctx.drawImage(glow, f.x - z, f.y - z * .55, z * 2, z * 1.1);
        ctx.globalAlpha = a * .9; const c = z * .35; ctx.drawImage(glowW, f.x - c, f.y - c * .6, c * 2, c * 1.2);
      }
      ctx.globalAlpha = 1;
      // ---- sparks: gravity, drag, one bounce, motion streaks ----
      ctx.lineCap = 'round';
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]; p.t += dt; if (p.t >= p.life) { sparks.splice(i, 1); continue; }
        const drag = Math.exp(-2.4 * dt); p.vx *= drag; p.vy = p.vy * drag + 1100 * s * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y > hy - 1 && !p.bounced) { p.y = hy - 1; p.vy *= -.28; p.vx *= .6; p.bounced = true; }
        const k = 1 - p.t / p.life, c = mix(Math.min(1, k * 1.2) * .8);
        ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(k * .95).toFixed(3)})`; ctx.lineWidth = p.w * s * (0.5 + k);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .028, p.y - p.vy * .028); ctx.stroke();
      }
      // ---- embers: rise, curl, flicker ----
      for (let i = embers.length - 1; i >= 0; i--) {
        const m = embers[i]; m.t += dt; if (m.t >= m.life) { embers.splice(i, 1); continue; }
        m.vx += Math.sin(now * 2.2 + m.ph + m.y * .01) * 40 * s * dt; m.vx *= Math.exp(-1.2 * dt);
        m.x += m.vx * dt; m.y += m.vy * dt;
        const k = m.t / m.life, a = Math.sin(Math.PI * k) * (.6 + .4 * Math.sin(now * 17 + m.ph));
        const r = m.r * (2.2 + 1.2 * (1 - k));
        ctx.globalAlpha = Math.max(0, a); ctx.drawImage(dot, m.x - r, m.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(step);
    }
    function energyAt(x) { return energy[binOf(x)]; }
    function drawBeam(b) {
      if (o.beam === 'none') return;
      const top = Math.max(-20, b.top), bot = b.bot, len = bot - top; if (len < 1) return;
      const cx = b.x, wv = b.w * o.width * (0.75 + .35 * b.v), vis = .55 + .45 * b.v;
      const flick = .92 + .08 * Math.sin(now * 23 + b.seed);
      const fadeTop = Math.min(len, 90 * s), fadeBot = b.held ? 0 : Math.min(len * .4, 70 * s);
      const layer = (hw, a, c) => {
        const g = ctx.createLinearGradient(0, top, 0, bot);
        const ft = fadeTop / len, fb = 1 - fadeBot / len;
        g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`); g.addColorStop(Math.min(.99, ft), `rgba(${c[0]},${c[1]},${c[2]},${a})`);
        g.addColorStop(Math.max(ft, Math.min(.999, fb)), `rgba(${c[0]},${c[1]},${c[2]},${a})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},${b.held ? a : 0})`);
        ctx.fillStyle = g; const r = Math.min(hw, 8 * s);
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - hw, top, hw * 2, len, r) : ctx.rect(cx - hw, top, hw * 2, len); ctx.fill();
      };
      const A = vis * flick;
      if (o.beam === 'glow') { layer(wv * 1.9, .05 * A, col); layer(wv * 1.1, .12 * A, col); layer(wv * .6, .38 * A, col); layer(wv * .32, .7 * A, mix(.45)); layer(wv * .1, .95 * A, mix(.9)); }
      else if (o.beam === 'thread') { layer(wv * .7, .08 * A, col); layer(wv * .12, .9 * A, mix(.8)); }
      else if (o.beam === 'pillar') { layer(wv * .95, .5 * A, col); layer(wv * .55, .35 * A, mix(.5)); }
      else if (o.beam === 'smoke') { for (let j = 0; j < 4; j++) layer(wv * (1.6 - j * .3), .07 * A, col); layer(wv * .2, .45 * A, mix(.6)); }
      // leading head
      const hz = wv * 2.2; ctx.globalAlpha = .55 * A; ctx.drawImage(glow, cx - hz, top + fadeTop * .5 - hz, hz * 2, hz * 2); ctx.globalAlpha = 1;
      if (b.held) { // contact flare, breathing
        const z = (26 + 22 * b.v) * s * (0.9 + .1 * Math.sin(now * 9 + b.seed));
        ctx.globalAlpha = .6 * A; ctx.drawImage(glow, cx - z, hy - z * .5, z * 2, z); ctx.globalAlpha = .9;
        const c = wv * 1.3; ctx.drawImage(glowW, cx - c, hy - c * .7, c * 2, c * 1.4); ctx.globalAlpha = 1;
      }
    }
    function drawHorizon() {
      if (o.horizon === 'off') return;
      const g = ctx.createLinearGradient(0, 0, W, 0);
      for (let i = 0; i < BINS; i += 4) { const e = o.hreact ? energy[i] : 0; g.addColorStop(i / (BINS - 1), rgba(Math.min(1, (.16 + .1 * Math.sin(now * .8 + i * .07) * .3 + e * .85) * o.hbright).toFixed(3))); }
      g.addColorStop(1, rgba(.16 * o.hbright));
      ctx.fillStyle = g;
      if (o.horizon === 'glow') { const rows = 14; for (let r = rows; r >= 1; r--) { ctx.globalAlpha = .06 * (1 - r / rows) ** 1.5 * 2.2; const h = r * 5 * s; ctx.fillRect(0, hy - h, W, h); } ctx.globalAlpha = 1; }
      ctx.fillRect(0, hy - 1.2 * s, W, 1.6 * s);
      ctx.globalAlpha = .6; ctx.fillRect(0, hy - .4 * s, W, .6 * s); ctx.globalAlpha = 1;
    }
    buildSprites(); resize(); addEventListener('resize', resize); requestAnimationFrame(step);
    return { o, noteOn, noteOff, setColor, resize };
  })();

  // ================= PIANO INPUT + DEMO =================
  const keyEls = {}; $$('#piano [data-m]').forEach(k => keyEls[k.dataset.m] = k);
  const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const held = new Map(); let tr = 0, sustain = true, lastUser = -1e9, notes = 5908;
  function keyGeom(m) { const el = keyEls[m]; const r = el.getBoundingClientRect(), a = app.getBoundingClientRect(); return [r.left - a.left + r.width / 2, r.width * (KEYS[m][2] ? .95 : .62)]; }
  function press(m, vel, user) {
    if (!keyEls[m] || held.has(m)) return;
    if (user) { lastUser = performance.now(); stopDemo(); hideHint(); }
    keyEls[m].classList.add('down');
    const [x, w] = keyGeom(m); held.set(m, FX.noteOn(x, w, vel));
    if (user) { notes++; $('#tNotes').textContent = notes.toLocaleString('ru-RU').replace(/ /g, ' '); }
    updateChord();
  }
  function release(m) { const b = held.get(m); if (!b) return; held.delete(m); keyEls[m]?.classList.remove('down'); FX.noteOff(b, sustain); updateChord(); }
  let mouse = false;
  piano.addEventListener('pointerdown', e => { const k = e.target.closest('[data-m]'); if (!k) return; mouse = true; k.dataset.mouse = 1; const r = k.getBoundingClientRect(); press(+k.dataset.m, 60 + 67 * Math.min(1, (e.clientY - r.top) / r.height), true); });
  piano.addEventListener('pointerover', e => { if (!mouse) return; const k = e.target.closest('[data-m]'); if (k) { k.dataset.mouse = 1; press(+k.dataset.m, 96, true); } });
  piano.addEventListener('pointerout', e => { const k = e.target.closest('[data-m]'); if (k?.dataset.mouse && !k.contains(e.relatedTarget)) { delete k.dataset.mouse; release(+k.dataset.m); } });
  addEventListener('pointerup', () => { if (!mouse) return; mouse = false; $$('[data-mouse]').forEach(k => { delete k.dataset.mouse; release(+k.dataset.m); }); });

  const SH = { 1: '!', 2: '@', 3: '#', 4: '$', 5: '%', 6: '^', 7: '&', 8: '*', 9: '(', 0: ')' };
  const base = c => /^Key[A-Z]$/.test(c) ? c[3].toLowerCase() : /^Digit\d$/.test(c) ? c[5] : null;
  function midiFor(e) { const b = base(e.code); if (b == null) return null; if (!e.shiftKey) { const i = VP.indexOf(b); return i < 0 ? null : 36 + i; } let i = VP.indexOf(/\d/.test(b) ? SH[b] : b.toUpperCase()); if (i >= 0) return 36 + i; i = VP.indexOf(b); return i < 0 ? null : 37 + i; }
  let waitingKey = null; const down = new Map();
  addEventListener('keydown', e => {
    if (waitingKey) { e.preventDefault(); waitingKey.textContent = e.key === 'Backspace' ? '—' : e.key === ' ' ? 'Пробел' : e.key.length === 1 ? e.key.toUpperCase() : e.key; waitingKey.classList.toggle('empty', e.key === 'Backspace'); waitingKey.classList.remove('wait'); waitingKey = null; return; }
    const typing = e.target.closest('input, textarea');
    if (e.key === 'Escape') { e.preventDefault(); if (typing) return e.target.blur(); if (!modal.hidden) return void (modal.hidden = true); const w = $$('.win').filter(x => !x.hidden).sort((a, b) => b.style.zIndex - a.style.zIndex)[0]; if (w) return void (w.hidden = true); if (!game.hidden) return void (game.hidden = true); hideSheets(); closePops(); fly.hidden = true; return; }
    if (KEYMAP[e.key]) { e.preventDefault(); openPanel(KEYMAP[e.key]); return; }
    if (e.key === 'F7') { e.preventDefault(); fly.hidden = !fly.hidden; return; }
    if (typing || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Enter') { e.preventDefault(); $('#feed').classList.remove('closed'); $('#feedInput').focus(); return; }
    if (e.code === 'ArrowUp') { e.preventDefault(); setTr(tr + 1); return; }
    if (e.code === 'ArrowDown') { e.preventDefault(); setTr(tr - 1); return; }
    if (e.code === 'ArrowRight') { e.preventDefault(); setTr(tr + 12); return; }
    if (e.code === 'ArrowLeft') { e.preventDefault(); setTr(tr - 12); return; }
    if (e.code === 'Space') { e.preventDefault(); sustain = !sustain; $('#sus').classList.toggle('on', sustain); return; }
    if (e.code === 'Tab') { e.preventDefault(); $('#susMode').click(); return; }
    if (e.repeat || e.altKey) return;
    let m = midiFor(e); if (m == null) return; e.preventDefault(); m += tr; if (!keyEls[m]) return;
    down.set(e.code, m); press(m, 85 + Math.random() * 40, true);
  });
  addEventListener('keyup', e => { const m = down.get(e.code); if (m != null) { down.delete(e.code); release(m); } });
  addEventListener('blur', () => { down.forEach(release); down.clear(); });
  function setTr(v) { tr = Math.max(-24, Math.min(24, v)); $('#trVal').textContent = (tr > 0 ? '+' : '') + tr; }

  // demo phrase: plays itself while nobody touches the piano (visual only)
  const PROG = [[45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [48, 55, 60, 64, 67], [43, 50, 55, 59, 62]];
  const MEL = [[76, 74, 72, 71], [72, 69, 67, 69], [67, 72, 76, 79], [74, 71, 67, 74]];
  let demoT = null, demoOn = false;
  function startDemo() {
    if (demoOn) return; demoOn = true; let bar = 0;
    const playBar = () => {
      if (!demoOn) return;
      const ch = PROG[bar % 4], mel = MEL[bar % 4], beat = 340;
      ch.forEach((m, i) => setTimeout(() => { if (!demoOn) return; press(m, 70 + i * 8); setTimeout(() => release(m), beat * 3.6 - i * 60); }, i * 120));
      mel.forEach((m, i) => setTimeout(() => { if (!demoOn) return; press(m, 100 + (i % 2) * 20); setTimeout(() => release(m), beat * .85); }, beat * i + 40));
      bar++; demoT = setTimeout(playBar, beat * 4);
    };
    playBar();
  }
  function stopDemo() { demoOn = false; clearTimeout(demoT); [...held.keys()].forEach(m => { if (![...down.values()].includes(m)) release(m); }); }
  setInterval(() => { if (!demoOn && performance.now() - lastUser > 7000 && !held.size) startDemo(); }, 1000);
  setTimeout(startDemo, 500);

  // chord name + staff
  const CH = [[[0, 4, 7], ''], [[0, 3, 7], 'm'], [[0, 3, 6], 'dim'], [[0, 4, 8], 'aug'], [[0, 4, 7, 10], '7'], [[0, 4, 7, 11], 'maj7'], [[0, 3, 7, 10], 'm7'], [[0, 2, 7], 'sus2'], [[0, 5, 7], 'sus4'], [[0, 3, 6, 10], 'm7♭5'], [[0, 3, 6, 9], 'dim7'], [[0, 4, 7, 11, 2], 'maj9'], [[0, 3, 7, 10, 2], 'm9']];
  const INT = ['унисон', 'м2', 'б2', 'м3', 'б3', 'ч4', 'тритон', 'ч5', 'м6', 'б6', 'м7', 'б7'];
  function updateChord() {
    const ns = [...held.keys()].sort((a, b) => a - b), nm = n => NAMES[n % 12];
    if (!ns.length) { $('#chordName').style.opacity = .25; return drawStaff([]); }
    $('#chordName').style.opacity = 1;
    const pcs = [...new Set(ns.map(n => n % 12))]; let name = nm(ns[0]);
    if (ns.length === 2) name = INT[(ns[1] - ns[0]) % 12];
    else if (pcs.length >= 3) for (const r of pcs) { const set = pcs.map(p => (p - r + 12) % 12).sort((a, b) => a - b).join(); const hit = CH.find(c => c[0].slice().sort((a, b) => a - b).join() === set); if (hit) { name = NAMES[r] + hit[1] + (r !== ns[0] % 12 ? '/' + nm(ns[0]) : ''); break; } }
    $('#chordName').textContent = name; $('#chordNotes').textContent = ns.map(nm).join(' · '); drawStaff(ns);
  }
  const DIA = { 0: 0, 1: 0, 2: 1, 3: 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6 };
  const st = m => (Math.floor(m / 12) - 1) * 7 + DIA[m % 12];
  function drawStaff(ns) {
    let h = '';
    for (let i = 0; i < 5; i++) h += `<line x1="26" x2="150" y1="${22 + i * 10}" y2="${22 + i * 10}"/><line x1="26" x2="150" y1="${92 + i * 10}" y2="${92 + i * 10}"/>`;
    h += '<text x="4" y="58" class="clef">𝄞</text><text x="6" y="118" class="clef b">𝄢</text>';
    ns.slice(0, 8).forEach((m, i) => { const y = m >= 60 ? 22 + (st(77) - st(m)) * 5 : 92 + (st(57) - st(m)) * 5, x = 92 + (i % 2) * 11; if (m === 60 || m === 61) h += '<line x1="84" x2="120" y1="72" y2="72" class="ledger"/>'; if ([1, 3, 6, 8, 10].includes(m % 12)) h += `<text x="${x - 16}" y="${y + 4}" class="acc2">♯</text>`; h += `<ellipse class="nh" cx="${x}" cy="${y}" rx="6" ry="4.4" transform="rotate(-18 ${x} ${y})"/>`; });
    $('#staff').innerHTML = h;
  }
  drawStaff([]);
  $$('input[type=range]').forEach(r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'));
  const hsh = location.hash.slice(1);
  if (hsh) { if ($('#p-' + hsh)) openPanel(hsh, true); else if ($(`#game > [data-pane="${hsh}"]`)) openGame(hsh); else if ($('#w-' + hsh)) openWin(hsh); }
})();
