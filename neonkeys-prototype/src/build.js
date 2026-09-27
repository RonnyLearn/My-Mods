// NeonKeys prototype v3 — own layout: side dock, HUD capsule, centered sheets. Visual only.
const fs = require('fs');
const path = require('path');
const ICONS = Object.assign(require('./icons.js'), {
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>',
  minus: '<path d="M5 12h14"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  door: '<path d="M14 4H6v16h8"/><path d="M11 12h9M17 9l3 3-3 3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  studio: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M8 9v6M12 8v8M16 10v4"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16"/>',
  echo: '<path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-1 1.4-2.1-.6-1.2.2-2.4 1.5-2.4h1.9a3.7 3.7 0 0 0 3.7-3.7C20.5 7.3 16.7 3.5 12 3.5z"/><circle cx="8" cy="11" r="1.1"/><circle cx="11" cy="7.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/>',
  keys: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v9M12 5v9M16 5v9M6.5 5v5.5h3V5M14.5 5v5.5h3V5"/>',
  shield: '<path d="M12 3.5l7 3v5.5c0 4.4-3 7.6-7 8.5-4-.9-7-4.1-7-8.5V6.5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  wand: '<path d="M4 20L15 9M14 4v3M18.5 5.5l-2 2M20 10h-3M9 5.5l1.5 1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
});

let seed = 23;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const S = n => `calc(${n}*var(--s))`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</defs></svg>`;

const STOPS = ['#f0c27b', '#f0c27b'];
const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function grad(t, stops = STOPS) {
  t = Math.max(0, Math.min(1, t));
  const seg = (stops.length - 1) * t, i = Math.min(stops.length - 2, Math.floor(seg)), f = seg - i;
  const a = hex2(stops[i]), b = hex2(stops[i + 1]);
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('');
}

// ---------------- controls (own style: fields, switches, tiles) ----------------
let uid = 0;
const nid = p => `${p}${++uid}`;
const pills = (opts, act, { apply = '', vals = null } = {}) => `<div class="pills" ${apply ? `data-apply="${apply}"` : ''}>${opts.map((o, i) => `<button type="button" class="${o === act ? 'on' : ''}" ${vals ? `data-v="${vals[i]}"` : ''}>${o}</button>`).join('')}</div>`;
const tags = (opts, act = [], { multi = false, apply = '', vals = null } = {}) => `<div class="tags" ${multi ? 'data-multi' : 'data-single'} ${apply ? `data-apply="${apply}"` : ''}>${opts.map((o, i) => `<button type="button" class="tag${act.includes(o) ? ' on' : ''}" ${vals ? `data-v="${vals[i]}"` : ''}>${o}</button>`).join('')}</div>`;
const tog = (label, on = false, apply = '', desc = '') => `<button type="button" class="toggle${on ? ' on' : ''}" role="switch" aria-checked="${on}" ${apply ? `data-apply="${apply}"` : ''}><span class="tl"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span><i></i></button>`;
const togs = (arr, on = [], apply = '') => arr.map((t, i) => tog(t, on.includes(i), apply ? `${apply}:${i}` : '')).join('');
const minis = (arr, on = []) => `<div class="minis">${arr.map((t, i) => `<button type="button" class="mini${on.includes(i) ? ' on' : ''}">${t}</button>`).join('')}</div>`;
function fmtVal(v, unit, fmt) {
  if (fmt === 'off0' && Number(v) === 0) return 'выкл';
  if (fmt === 'sign') return (v > 0 ? '+' : '') + v + unit;
  if (fmt === 'time') { const m = Math.floor(v / 60), s = v % 60; return m + ':' + String(s).padStart(2, '0'); }
  return v + unit;
}
const field = (label, min, max, val, unit = '', { step = 1, apply = '', fmt = '', hint = '' } = {}) => {
  const i = nid('r');
  return `<div class="field"><div class="fl"><label for="${i}">${label}</label><output>${fmtVal(val, unit, fmt)}</output></div><input type="range" id="${i}" min="${min}" max="${max}" step="${step}" value="${val}" data-unit="${unit}" ${fmt ? `data-fmt="${fmt}"` : ''} ${apply ? `data-apply="${apply}"` : ''} style="--p:${((val - min) / (max - min) * 100).toFixed(1)}%">${hint ? `<small class="fh">${hint}</small>` : ''}</div>`;
};
const line = (label, ctrl, desc = '') => `<div class="line"><span class="ll"><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span><div class="lc">${ctrl}</div></div>`;
const dd = v => `<button type="button" class="dd">${v}${icon('down')}</button>`;
const inp = (ph, v = '', cls = '') => `<input class="in ${cls}" id="${nid('t')}" placeholder="${esc(ph)}" value="${esc(v)}">`;
const bind = (label, key) => `<div class="bind"><span>${label}</span><button type="button" class="cap${key ? '' : ' empty'}">${key || '—'}</button></div>`;
const colorDot = (label, hex) => line(label, `<button type="button" class="cdot" style="--cd:${hex}"></button><code>${hex}</code>`);
const btn = (t, ic = '', cls = '', attrs = '') => `<button type="button" class="btn ${cls}" ${attrs}>${ic ? icon(ic) : ''}${t ? `<span>${t}</span>` : ''}</button>`;
const card = (title, inner, sub = '') => `<section class="card"><header><h4>${title}</h4>${sub ? `<small>${sub}</small>` : ''}</header>${inner}</section>`;
const cap = t => `<div class="cap-t">${t}</div>`;
const note = t => `<p class="note">${t}</p>`;
const curve = d => `<svg class="curve" viewBox="0 0 100 100"><path d="M0 50H100M50 0V100" class="grid"/><path d="${d}" class="cv"/></svg>`;

// ---------------- scene ----------------
const NOTE = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const isBlack = m => [1, 3, 6, 8, 10].includes(m % 12);
const VP = '1!2@34$5%6^78*9(0qQwWeErtTyYuiIoOpPasSdDfgGhHjJklLzZxcCvVbBnm';
const W = 1600, WK = W / 52;
const keyX = {}; let wx = 0;
for (let m = 21; m <= 108; m++) {
  if (!isBlack(m)) { keyX[m] = { x: wx * WK, w: WK, black: false }; wx++; }
  else { const bw = WK * 0.58; keyX[m] = { x: wx * WK - bw / 2, w: bw, black: true }; }
}
const colorAt = m => grad((keyX[m].x + keyX[m].w / 2) / W);
const pressed = {};
let keysHtml = '';
for (const pass of [false, true]) for (let m = 21; m <= 108; m++) {
  const k = keyX[m]; if (k.black !== pass) continue;
  const on = pressed[m] !== undefined;
  const name = NOTE[m % 12].replace('♯', '#') + (Math.floor(m / 12) - 1);
  const vp = (m >= 36 && m <= 96) ? VP[m - 36] : '';
  keysHtml += `<div class="${k.black ? 'bk' : 'wk'}${on ? ' down demo-down' : ''}" data-m="${m}" style="left:${S(k.x.toFixed(2))};width:${S(k.w.toFixed(2))};--c:${colorAt(m)}">${vp ? `<span class="vp">${esc(vp)}</span>` : ''}<span class="nn">${name}</span></div>`;
}
let demo = '';
for (const [m, vel] of Object.entries(pressed)) {
  const k = keyX[m], c = colorAt(m), h = 110 + (vel - 80) * 3.4, bw = k.black ? k.w * 0.9 : k.w * 0.6;
  demo += `<div class="beam held demo" style="left:${S((k.x + k.w / 2 - bw / 2).toFixed(1))};width:${S(bw.toFixed(1))};height:${S(h.toFixed(0))};--c:${c}"><i></i></div>`;
  demo += `<div class="ripple demo" style="left:${S((k.x + k.w / 2).toFixed(1))};--c:${c}"></div>`;
}
const floating = [[57, 520, 80, 0], [62, 380, 60, 1.4], [69, 460, 100, .5], [74, 300, 70, 2.2], [76, 540, 120, .9], [79, 240, 60, 1.7], [48, 420, 130, .3], [50, 250, 70, 2.8], [84, 400, 60, 1.2], [55, 180, 60, 3], [88, 310, 50, 2.4], [41, 340, 90, 1.9]];
for (const [m, b, h, d] of []) {
  const k = keyX[m], c = colorAt(m), bw = k.black ? k.w * 0.9 : k.w * 0.6;
  demo += `<div class="beam float demo" style="left:${S((k.x + k.w / 2 - bw / 2).toFixed(1))};width:${S(bw.toFixed(1))};height:${S(h)};--b:${b};--c:${c};animation-delay:-${d}s"><i></i></div>`;
}
const dust = Array.from({ length: 34 }, () => `<i style="left:${(rnd() * 100).toFixed(1)}%;bottom:${(rnd() * 60).toFixed(1)}%;--d:${(6 + rnd() * 8).toFixed(1)}s;animation-delay:-${(rnd() * 10).toFixed(1)}s;--z:${(1 + rnd() * 2.2).toFixed(1)}"></i>`).join('');
function stars(n, maxA) { const a = []; for (let i = 0; i < n; i++) a.push(`${S((rnd() * 1600).toFixed(0))} ${S((rnd() * 900).toFixed(0))} 0 rgba(255,236,220,${(0.15 + rnd() * maxA).toFixed(2)})`); return a.join(','); }
const rain = Array.from({ length: 70 }, () => `<i style="left:${(rnd() * 100).toFixed(1)}%;animation-delay:-${(rnd() * 1.2).toFixed(2)}s;animation-duration:${(0.7 + rnd() * .5).toFixed(2)}s"></i>`).join('');
const snow = Array.from({ length: 60 }, () => `<i style="left:${(rnd() * 100).toFixed(1)}%;animation-delay:-${(rnd() * 10).toFixed(2)}s;animation-duration:${(7 + rnd() * 6).toFixed(1)}s;--sz:${(2 + rnd() * 4).toFixed(1)}"></i>`).join('');
const petals = Array.from({ length: 26 }, () => `<i style="left:${(rnd() * 100).toFixed(1)}%;animation-delay:-${(rnd() * 12).toFixed(2)}s;animation-duration:${(9 + rnd() * 6).toFixed(1)}s"></i>`).join('');
const fireflies = Array.from({ length: 30 }, () => `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(20 + rnd() * 55).toFixed(1)}%;animation-delay:-${(rnd() * 6).toFixed(2)}s"></i>`).join('');

const DOCK = [['library', 'F1', 'book', 'Библиотека'], ['train', 'F2', 'target', 'Тренировки'], ['rooms', 'F3', 'users', 'Комнаты'], ['studio', 'F4', 'studio', 'Студия'], ['sound', 'F5', 'wave', 'Звук'], ['notepad', 'F6', 'note', 'Блокнот']];
const TOOLS = [['circle', 'circle5', 'Квинтовый круг'], ['webcam', 'cam', 'Камера на сцене'], ['video', 'film', 'Видео поверх'], ['ai', 'ai', 'Аудио → MIDI'], ['monitor', 'pulse', 'MIDI-монитор'], ['pitch', 'sliders', 'Питч и вибрато'], ['browser', 'globe', 'Браузер'], ['ideas', 'bulb', 'Идеи сообщества'], ['bug', 'bug', 'Сообщить о проблеме']];

const feed = {
  world: [['Мира', '#ff8fb8', 'кто сыграет Лунную сонату в «Ночном зале»?'], ['serbez', '#7aa8ff', 'я, только разыграюсь'], ['小星星', '#ffd36e', '今天练了两个小时', 'tr'], ['noa', '#ffb35c', 'в библиотеке новая подборка: саундтреки игр', 'mod'], ['NeonKeys', '#b69bff', 'в 23:00 короткий перезапуск сервера', 'team'], ['Ронни', 'me', 'жду снег в новой теме']],
  room: [['•', '#a39cae', 'Ты в «Ночном зале». Режим: по очереди.'], ['Мира', '#ff8fb8', 'следующая играю я, потом Ронни'], ['kaminari', '#ffb15a', 'поставьте зал «Собор», пожалуйста']],
  dm: [['Мира', '#ff8fb8', 'скинь ноты Interstellar'], ['Ронни', 'me', 'держи, в библиотеке по названию'], ['Мира', '#ff8fb8', 'спасибо!!']],
};
const bubble = ([n, c, t, tag]) => n === '•' ? `<div class="sys">${t}</div>` : `<div class="fm${c === 'me' ? ' me' : ''}">${c === 'me' ? '' : `<span class="fa">${esc(n[0])}</span>`}<div class="fb"><b>${esc(n)}${tag === 'mod' ? '<em class="role">модератор</em>' : tag === 'team' ? '<em class="role team">команда</em>' : ''}</b><p>${esc(t)}</p>${tag === 'tr' ? '<button type="button" class="trn">перевести</button>' : ''}</div></div>`;

const scene = `
<div class="sky"><i class="st a"></i><i class="st b"></i><i class="haze"></i><i class="vign"></i></div>
<div class="weather rain">${rain}</div><div class="weather snow">${snow}</div><div class="weather petals">${petals}</div><div class="weather flies">${fireflies}</div>

<nav class="dock" aria-label="Разделы">
  <button type="button" class="mark" data-open="about" aria-label="О NeonKeys"><span>NK</span></button>
  <div class="dk">${DOCK.map(([k, key, ic, t]) => `<button type="button" class="di" data-open="${k}" data-tip="${t} · ${key}">${icon(ic)}<small>${t}</small></button>`).join('')}</div>
  <div class="dk sep"><button type="button" class="di" data-flyout="tools" data-tip="Инструменты · F7">${icon('grid')}<small>Ещё</small></button></div>
  <div class="dk end"><button type="button" class="di" data-open="profile" data-tip="Профиль · F8">${icon('user')}<small>Профиль</small></button><button type="button" class="di" data-open="settings" data-tip="Настройки · F9">${icon('gear')}<small>Настройки</small></button></div>
</nav>
<div class="flyout" id="fly-tools" hidden>${cap('Инструменты')}${TOOLS.map(([k, i, t]) => `<button type="button" data-win="${k}">${icon(i)}<span>${t}</span></button>`).join('')}</div>

<div class="today" data-open="profile" role="button" tabindex="0">
  <span class="tdot"></span><b>Сегодня</b><span><em id="tNotes">5 908</em> нот</span><span><em>34</em> мин</span><span class="tsep"></span><span>за всё время <em>63 ч</em></span>
</div>

<div class="hud">
  <button type="button" class="streak" data-modal="daily" data-tip="Ежедневная награда">${icon('flame')}<b>12</b><i class="dot"></i></button>
  <button type="button" class="goal" data-pop="quest" data-tip="Цель дня"><span class="ring" style="--p:60%"></span><small>9/15</small></button>
  <span class="hsep"></span>
  <button type="button" class="money" data-open="shop"><span class="coin"></span><b>10 730</b></button>
  <button type="button" class="money" data-open="shop"><span class="gem"></span><b>2 700</b><i class="plus">${icon('plus')}</i></button>
  <span class="hsep"></span>
  <button type="button" class="hb" data-pop="notifs" aria-label="Уведомления">${icon('bell')}<i class="badge">2</i></button>
  <button type="button" class="hb" data-feed aria-label="Лента">${icon('chat')}<i class="badge">3</i></button>
  <button type="button" class="avatar" data-pop="me"><span class="av">Р</span><span class="avn"><b>Ронни</b><small>в сети</small></span>${icon('down')}</button>
</div>

<aside class="feed" id="feed" data-tabgroup>
  <div class="fh">${[['world', 'globe', 'Мир'], ['room', 'users', 'Комната'], ['dm', 'chat', 'Личное']].map(([k, i, t], n) => `<button type="button" class="${n ? '' : 'on'}" data-tab="${k}">${icon(i)}${t}${k === 'dm' ? '<i>2</i>' : ''}</button>`).join('')}<button type="button" class="fcol" data-feed aria-label="Свернуть">${icon('x')}</button></div>
  ${Object.entries(feed).map(([k, arr], i) => `<div class="flist" data-pane="${k}" ${i ? 'hidden' : ''}>${arr.map(bubble).join('')}</div>`).join('')}
  <form class="fin" id="feedForm"><input id="feedInput" placeholder="Сообщение… Enter — отправить" autocomplete="off"><button type="button" class="emo" aria-label="Эмодзи">${icon('smile')}</button><button type="submit" aria-label="Отправить">${icon('send')}</button></form>
</aside>

<div class="caption"><span id="capMain">Ронни</span><small id="capSub">вечерняя импровизация</small></div>
<canvas id="fx" aria-hidden="true"></canvas>
<div class="chord"><b id="chordName">Am7</b><small id="chordNotes">A · E · C · E · G · B</small></div>
<div class="staff"><svg viewBox="0 0 156 140" class="staffsvg" id="staff"></svg></div>

<div class="ctl">
  <div class="cg ped"><button type="button" class="cb" data-toggle>Soft</button><button type="button" class="cb" data-toggle>Sost</button><button type="button" class="cb on sus" id="sus" data-toggle>${icon('sun')}Педаль</button><button type="button" class="cm" id="susMode" data-cycle="Держать|Всегда|Щелчок">Всегда</button></div>
  <div class="cg"><button type="button" class="cb" id="trDown">${icon('minus')}</button><span class="cv"><b id="trVal">0</b><small>тон</small></span><button type="button" class="cb" id="trUp">${icon('plus')}</button></div>
  <div class="cg"><button type="button" class="cb" id="metroBtn">${icon('metro')}</button><span class="cv"><b>96</b><small>bpm</small></span><span class="beats"><i></i><i></i><i></i><i></i></span></div>
  <div class="cg shl" id="shiftLock" hidden>SHIFT</div>
</div>


<div class="piano" id="piano">${keysHtml}<div class="sheen"></div></div>
<div class="pet" hidden><i></i></div>`;

// ---------------- settings (centered sheet with text nav) ----------------
const themes = [['Янтарь', 'amber', '#f0c27b'], ['Лунный', 'moon', '#dfe6f2'], ['Лёд', 'ice', '#9fd4ff'], ['Роза', 'rose', '#f2a7b8'], ['Мята', 'mint', '#a8e6cf'], ['Сирень', 'lilac', '#c3b3f2']];
const accents = [];
const beamStyles = [['Сияние', 'glow'], ['Нить', 'thread'], ['Столп', 'pillar'], ['Дым', 'smoke'], ['Нет', 'none']];

const SET = {};
SET.general = [
  card('Язык', tags(['Русский', 'English', 'Українська', 'Deutsch', 'Español', 'Français', 'Português', 'Polski', 'Türkçe', '日本語', '한국어', '中文'], ['Русский'])),
  card('Клавиатура на экране', `<div class="kbsel" data-single>${[88, 76, 61, 49, 37, 25].map(n => `<button type="button" class="${n === 88 ? 'on' : ''}"><span class="kbar" style="--n:${n}"></span><b>${n}</b></button>`).join('')}</div>` + tog('Сдвигать под сыгранную ноту', false, '', 'Если на MIDI сыграна нота за краем — клавиатура подвинется сама') + field('Высота клавиш', 50, 150, 72, '%', { apply: 'ph' })),
  card('Производительность', pills(['Экономно', 'Сбалансированно', 'Максимум'], 'Сбалансированно') + field('Кадров в секунду', 30, 240, 60, '') + field('Чёткость', 20, 100, 100, '%') + tog('Сглаживание краёв', true) + tog('HDR-блики', false, '', 'На совместимых мониторах') + tog('Показывать FPS', false, 'fps') + field('Не гасить экран', 0, 120, 10, ' мин', { step: 5, fmt: 'off0' }), 'Пресет задаёт всё сразу'),
  card('Окно', line('Режим', pills(['Окно', 'Полный экран'], 'Окно')) + line('Формат', pills(['16:9', '9:16 для роликов'], '16:9')) + tags(['Во весь экран', '1920 × 1080', '1600 × 900', '1280 × 720'], ['1920 × 1080'])),
  card('Файлы', line('Открывать .mid', pills(['NeonKeys', 'Спрашивать', 'Нет'], 'NeonKeys')) + line('Открывать MusicXML', pills(['NeonKeys', 'Спрашивать', 'Нет'], 'NeonKeys')) + line('Открывать .sf2', pills(['NeonKeys', 'Спрашивать', 'Нет'], 'Спрашивать'))),
  card('Профили настроек', `<div class="presets">${['Основной', 'Стрим', 'Ролик 9:16'].map((p, i) => `<button type="button" class="preset${i === 0 ? ' on' : ''}"><b>${p}</b><small>${['изменён сегодня', 'тёмная сцена, чат скрыт', 'вертикальный кадр'][i]}</small></button>`).join('')}<button type="button" class="preset add">${icon('plus')}<b>Новый</b></button></div>` + btn('Вернуть всё по умолчанию', 'trash', 'ghost danger')),
];
SET.scene = [
  card('Свет сцены', `<div class="themes" data-single data-apply="acc">${themes.map(([n, k, c], i) => `<button type="button" class="theme${i === 0 ? ' on' : ''}" data-v="${c}" style="--tc:${c}"><i></i><b>${n}</b></button>`).join('')}</div>`, 'Один цвет на всё: лучи, искры, горизонт и интерфейс'),
  card('Фон', pills(['Звёзды', 'Туман', 'Пусто'], 'Звёзды', { apply: 'bg', vals: ['stars', 'fog', 'none'] }) + tog('Пыль в воздухе', true, 'dust', 'Медленные частицы с глубиной резкости') + field('Прозрачность окна', 0, 100, 100, '%', { hint: 'Для OBS и записи' })),
  card('Погода', togs(['Дождь', 'Снег', 'Лепестки', 'Светлячки', 'Зарницы'], [], 'env') + field('Плотность', 10, 100, 50, '%') + field('Ветер', -100, 100, 15, '', { fmt: 'sign' }) + tog('Ветер тянется за курсором', true)),
  card('Своя картинка', `<div class="upl">${btn('Фон сцены', 'upload')}${btn('Узор на клавишах', 'upload')}</div>` + note('Картинки и видео хранятся только на этом компьютере.')),
  card('Подпись сцены', `<div class="stack">${inp('Главная строка', 'Ронни', 'capIn')}${inp('Вторая строка', 'вечерняя импровизация', 'capSubIn')}</div>` + line('Шрифт', dd('Syne')) + field('Размер', 30, 180, 100, '%', { apply: 'capsize' }) + tog('Показывать подпись', true, 'caption')),
  card('Компаньон', tog('Показывать компаньона', false, 'pet', 'Бегает по горизонту и прыгает на лучи') + `<div class="pets" data-single>${['Лис', 'Кот', 'Совёнок', 'Робот', 'Слизень', 'Дракончик'].map((p, i) => `<button type="button" class="${i === 0 ? 'on' : ''}"><i style="--h:${20 + i * 50}"></i>${p}</button>`).join('')}</div>` + field('Размер', 18, 64, 34, '') + field('Резвость', 25, 200, 100, '%')),
];
SET.light = [
  card('Лучи', `<div class="bstyles" data-single data-apply="beam">${beamStyles.map(([n, v], i) => `<button type="button" class="bs-${v}${i === 0 ? ' on' : ''}" data-v="${v}"><i></i><small>${n}</small></button>`).join('')}</div>` + field('Скорость', 50, 1500, 280, '', { step: 10, apply: 'bspeed' }) + field('Толщина', 40, 160, 100, '%', { apply: 'bwidth' }) + line('Живые лучи', pills(['Вверх', 'Навстречу клавишам'], 'Вверх'), 'Навстречу — удобно для стрима, но с задержкой') + tog('Пружинить при касании клавиш')),
  card('Частицы', tog('Искры при ударе', true, 'fx:sparks', 'Разлетаются с гравитацией и трением') + tog('Угли над лучами', true, 'fx:embers', 'Поднимаются и закручиваются') + tog('Ударная волна', true, 'fx:shock', 'Кольцо по горизонту от каждой ноты') + field('Количество', 0, 200, 100, '%', { apply: 'fxamount' })),
  card('Шлейф от педали', tog('Нота под педалью оставляет тающий столб', true, 'fx:trail') + field('Длина шлейфа', 0, 3, 1.2, ' с', { step: 0.1, apply: 'trail' })),
  card('Горизонт', pills(['Свечение', 'Тонкая линия', 'Нет'], 'Свечение', { apply: 'horizon', vals: ['glow', 'line', 'off'] }) + field('Яркость', 0, 200, 100, '%', { apply: 'hbright' }) + tog('Горизонт подсвечивается под нотами', true, 'fx:hreact')),
  card('Свет на клавишах', pills(['Сцена', 'Студия', 'Полумрак', 'Закат'], 'Сцена') + field('Яркость клавиш в покое', 0, 150, 70, '%', { apply: 'amb' }) + field('Сила подсветки нажатой', 0, 150, 110, '%') + field('Затухание после отпускания', 0, 1000, 180, ' мс', { step: 10 }) + tog('Тени от чёрных клавиш', true)),
];
SET.keys = [
  card('Подписи на клавишах', `<div class="lblsel" data-single data-apply="labels">${[['Авто', 'auto', 'e / E4'], ['Буквы', 'qwerty', 'e'], ['Ноты', 'notes', 'E4'], ['До-ре-ми', 'notes', 'ми'], ['Без подписей', 'hidden', '']].map(([n, v, ex], i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-v="${v}"><span class="kex">${ex || '·'}</span><small>${n}</small></button>`).join('')}</div>` + tog('Октавы у названий нот', true) + tog('Диезы вместо бемолей', true) + tog('Подписывать только «до»') + tog('Показывать клавиши с Ctrl', true)),
  card('Подписи на лучах', pills(['Как на клавишах', 'Буквы', 'Ноты', 'Нет'], 'Как на клавишах')),
  card('Клавиши', `<div class="keyskins" data-single data-apply="keyskin">${[['Дымчатое стекло', 'glass'], ['Слоновая кость', 'ivory'], ['Ночь', 'night'], ['Янтарь', 'amber']].map(([n, v], i) => `<button type="button" class="ks-${v}${i === 0 ? ' on' : ''}" data-v="${v}"><i></i><small>${n}</small></button>`).join('')}</div>` + colorDot('Белые', '#221d33') + colorDot('Чёрные', '#0b0912') + colorDot('Текст', '#f3eee8')),
  card('Сила удара', tog('Тихие ноты тусклее и тоньше', true, '', 'Громкие — ярче, шире и с большим числом искр') + field('Контраст по силе', 0, 200, 100, '%')),
];
SET.input = [
  card('Клавиатура компьютера', line('Раскладка', dd('Виртуальное пианино')) + tags(['Виртуальное пианино', 'QWERTZ', 'AZERTY', 'Минорная', 'Своя…'], ['Виртуальное пианино']) + tog('Подгонять ноты под мою раскладку', true) + tog('Shift + клавиша без пары = на полутон выше', true) + tog('Разрешить для ЙЦУКЕН') + tog('Отключить игру с клавиатуры')),
  card('Сила нажатия', line('Как считать', pills(['По скорости', 'Случайно', 'Фиксированно'], 'По скорости')) + field('Минимум', 1, 127, 60, '') + field('Максимум', 1, 127, 127, '') + `<div class="curvebox">${curve('M0 100 C35 70 65 30 100 0')}${pills(['Ровно', 'Мягко', 'Жёстко', 'Своя'], 'Мягко')}</div>` + tog('Alt + 1…0 — громкость клавиатуры')),
  card('MIDI-устройства', `<div class="devs">${[['SE61', 'вход и выход', true], ['MIDIIN2 (SE61)', 'вход', true], ['loopMIDI Port', 'виртуальный', false]].map(([n, t, on]) => `<div class="dev"><i class="${on ? 'ok' : ''}"></i><span><b>${n}</b><small>${t}</small></span>${tog('', on)}</div>`).join('')}</div><div class="upl">${btn('Найти снова', 'loop', 'sm')}${btn('Bluetooth MIDI', 'plus', 'sm')}</div>` + tog('Подсвечивать клавиши на пианино с подсветкой', true) + tog('Инвертировать педаль') + tog('Сглаживать перенажатие педали', true) + tog('Печатать текст клавишами пианино')),
  card('Мышь и аналоговые клавиатуры', tog('Громче ближе к краю клавиши', true) + field('Сила клика', 1, 127, 96, '') + btn('Подключить Wooting', 'plus', 'sm') + field('Порог срабатывания', 10, 230, 96, '')),
];
SET.hotkeys = [
  card('Разделы', DOCK.map(([, k, , t]) => bind(t, k)).join('') + bind('Инструменты', 'F7') + bind('Профиль', 'F8') + bind('Настройки', 'F9') + bind('Закрыть окно', 'Esc')),
  card('Игра', bind('Педаль', 'Пробел') + bind('Режим педали', 'Tab') + bind('Транспозиция +1 / −1', '↑ / ↓') + bind('Октава вверх / вниз', '→ / ←') + bind('Сбросить транспозицию', 'Alt + 0') + bind('Мягкая педаль', '') + bind('Громче / тише', 'PgUp / PgDn')),
  card('Практика и студия', bind('Следующая нота', ']') + bind('Предыдущая нота', '[') + bind('К началу петли', 'Home') + bind('Сохранить MIDI', 'Ctrl + S') + bind('Снимок экрана', 'Ctrl + Shift + S') + bind('Говорить в комнате', 'V')),
];
SET.ui = [
  card('Размер', field('Масштаб интерфейса', 90, 140, 100, '%')),
  card('Боковая панель', line('Подписи', pills(['Всегда', 'При наведении', 'Нет'], 'Всегда', { apply: 'docklabels', vals: ['on', 'hover', 'off'] })) + line('Положение', pills(['Слева', 'Справа'], 'Слева', { apply: 'dockside', vals: ['left', 'right'] }))),
  card('Виджеты сцены', tog('Аккорд над клавишами', true, 'w:chord') + tog('Нотный стан', true, 'w:staff') + tog('Полоса «Сегодня»', true, 'w:today') + tog('Панель педали и темпа', true, 'w:ctl') + tog('Лента чата', true, 'w:feed') + tog('Направляющие линии октав', false, 'guides')),
  card('Капсула сверху', minis(['Серия', 'Цель дня', 'Монеты', 'Кристаллы', 'Уведомления', 'Лента', 'Аватар'], [0, 1, 2, 3, 4, 5, 6])),
];
SET.account = [
  card('Профиль', `<div class="stack"><label>Имя${inp('Ронни', 'Ронни')}</label><label>Ник${inp('ronny', 'ronny')}</label><label>О себе<textarea class="in" rows="3">Играю на слух, учу Шопена.</textarea></label></div>` + line('Страна', dd('Автоматически')) + `<div class="upl">${btn('Сохранить', '', 'acc sm')}${btn('Отменить', '', 'sm')}</div>`),
  card('Приватность', line('Кто видит «в сети»', pills(['Все', 'Друзья', 'Никто'], 'Все')) + line('Кто пишет мне', pills(['Все', 'Друзья', 'Никто'], 'Друзья')) + line('Кто видит профиль', pills(['Все', 'Друзья', 'Никто'], 'Все')) + tog('Показывать игру в Discord', true)),
  card('Чат', line('Перевод сообщений', pills(['Сам', 'По кнопке', 'Нет'], 'По кнопке')) + line('Гифки', pills(['Сразу', 'По клику', 'Ссылкой'], 'По клику')) + tog('Звук личных сообщений', true)),
  card('Комнаты', tog('Слышать звуки других игроков', true) + tog('Делиться своими звуками', true) + line('Микрофон', pills(['По кнопке', 'Открытый', 'Выкл'], 'По кнопке')) + field('Сглаживание сети', 0, 500, 60, ' мс', { step: 10 }) + tog('Прямое соединение (меньше задержка)', true)),
  card('Соцсети', ['TikTok', 'Instagram', 'YouTube'].map(n => line(n, btn('Привязать', 'link', 'sm'))).join('')),
];
SET.about = [
  card('NeonKeys', `<div class="about"><span class="mark big"><span>NK</span></span><div><b>NeonKeys 1.0</b><small>Пианино-сцена для игры, тренировок и роликов</small></div></div><div class="upl">${btn('Руководства', 'book', 'sm')}${btn('Сообщить о проблеме', 'bug', 'sm', 'data-win="bug"')}${btn('Сообщество', 'chat', 'sm')}</div>`),
  card('Быстрый старт', `<ol class="steps"><li><b>Подключи пианино</b> по USB или Bluetooth — или играй на клавиатуре: <kbd>1</kbd> <kbd>q</kbd> <kbd>w</kbd>…</li><li><b>Открой песню</b> в Библиотеке <kbd>F1</kbd></li><li><b>Тренируйся</b> в разделе Тренировки <kbd>F2</kbd></li><li><b>Сними ролик</b> в Студии <kbd>F4</kbd></li></ol>`),
];
const SETNAV = [['general', 'Основное', 'sliders'], ['scene', 'Сцена', 'palette'], ['light', 'Лучи и свет', 'sun'], ['keys', 'Клавиши', 'keys'], ['input', 'Ввод', 'kbd'], ['hotkeys', 'Горячие клавиши', 'bolt'], ['ui', 'Интерфейс', 'monitor'], ['account', 'Аккаунт', 'shield'], ['about', 'О приложении', 'info']];
const settingsBody = `
<div class="sset" data-tabgroup>
  <aside class="snav"><label class="search">${icon('search')}<input id="setSearch" placeholder="Поиск…"></label>${SETNAV.map(([k, t, i], n) => `<button type="button" class="${n === 1 ? 'on' : ''}" data-tab="${k}">${icon(i)}<span>${t}</span></button>`).join('')}<div class="snote">Изменения применяются сразу</div></aside>
  <div class="smain">${SETNAV.map(([k, t], n) => `<div class="pane grid2" data-pane="${k}" ${n === 1 ? '' : 'hidden'}>${SET[k].join('')}</div>`).join('')}<div class="nores" hidden>Ничего не нашлось</div></div>
</div>`;

// ---------------- library ----------------
const libRows = [['Past Lives', 'calaliva', 2, 1.5, 0, 'клавиатура'], ['Rick and Morty — For the Damaged Coda', 'vp trello', 4, 1.6, 12, 'клавиатура'], ['Floating in Reverie', 'fj sheets', 5, 2.2, 3, 'клавиатура'], ['Death Bed', 'fj sheets', 3, 1.9, 4, 'клавиатура'], ['Fly Me to the Moon', 'smile', 4, 2.1, 8, 'клавиатура'], ['His Theme — Undertale', 'VP sheets', 3, 1.4, 4, 'клавиатура'], ['Interstellar — Main Theme', 'noa', 3, 1.9, 4, 'клавиатура']];
const mxlRows = [['Clair de Lune', 'Debussy', 5, 'ре♭ мажор'], ['Golden Hour', 'JVKE', 3, 'ми мажор'], ['Merry-Go-Round of Life', 'Хисаиси', 4, 'ми♭ мажор'], ['Ocean Eyes', 'Billie Eilish', 2, 'ре мажор'], ['Creep (баллада)', 'Radiohead', 3, 'соль мажор'], ['I Have a Dream', 'ABBA', 1, 'си♭ мажор']];
const diff = n => `<span class="diff" title="Сложность ${n} из 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}" style="--dc:${grad((n - 1) / 4, ['#4fe3b0', '#ffc46b', '#ff4f8b'])}"></i>`).join('')}</span>`;
const songCard = (t, a, d, meta, acts) => `<div class="song"><span class="cover" style="--h:${Math.floor(rnd() * 360)}">${icon('note')}</span><div class="si"><b>${t}</b><small>${a}</small><span class="sm">${meta}</span></div>${diff(d)}<button type="button" class="fav${rnd() > .6 ? ' on' : ''}" aria-label="В избранное">${icon('star')}</button><div class="sacts">${acts}</div></div>`;
const library = `
<div class="lib" data-tabgroup>
  <div class="ltabs">${[['vp', 'kbd', 'Ноты для клавиатуры', '50 000+'], ['mxl', 'note', 'Ноты для пианино', '148'], ['disk', 'folder', 'Мои файлы', ''], ['ws', 'steam', 'Мастерская', ''], ['scan', 'scan', 'Скан с фото', 'новое']].map(([k, i, t, c], n) => `<button type="button" class="${n ? '' : 'on'}" data-tab="${k}">${icon(i)}<span>${t}</span>${c ? `<em>${c}</em>` : ''}</button>`).join('')}</div>
  <div class="pane" data-pane="vp">
    <div class="lbar"><label class="search grow">${icon('search')}<input placeholder="Песня, исполнитель или подборка…"></label>${dd('Сначала популярные')}${dd('Любая сложность')}</div>
    <div class="shelves">${tags(['Все', 'Избранное', 'Недавние', 'Без Shift', 'Короткие', 'Аниме', 'Игры', 'Классика'], ['Все'])}</div>
    <div class="songs">${libRows.map(([t, a, d, ch, sh]) => songCard(t, a, d, `аккорд ~${ch} · Shift ${sh}%`, `<button type="button" class="on" data-game="typing">Играть</button><button type="button" data-open="notepad">В блокнот</button>`)).join('')}</div>
  </div>
  <div class="pane" data-pane="mxl" hidden>
    <div class="lbar"><label class="search grow">${icon('search')}<input placeholder="Поиск нот для пианино…"></label>${dd('По названию')}</div>
    <div class="songs">${mxlRows.map(([t, a, d, k]) => songCard(t, a, d, k, `<button type="button" class="on" data-studio="practice">Учить</button><button type="button" data-studio="play">Слушать</button>`)).join('')}</div>
  </div>
  <div class="pane" data-pane="disk" hidden><div class="empty">${icon('folder')}<b>Подключи папку с MIDI и MusicXML</b><small>Вложенные папки, поиск и избранное — как в проводнике.</small>${btn('Выбрать папку', 'folder', 'acc')}</div></div>
  <div class="pane" data-pane="ws" hidden><div class="wsgrid">${['Hollow Knight — Main Theme', 'Megalovania', 'Dream Aria', 'Попурри Шопена', 'Lofi — Rainy Night', 'Zelda — Lost Woods'].map((t, i) => `<button type="button" class="ws"><i style="--h:${i * 60}"></i><b>${t}</b><small>${i % 2 ? 'MIDI' : 'ноты'} · ${120 + i * 37} подписок</small></button>`).join('')}</div><div class="upl">${btn('Опубликовать ноты', 'plus', 'sm')}${btn('Опубликовать MIDI', 'plus', 'sm')}</div></div>
  <div class="pane" data-pane="scan" hidden><div class="scan"><div class="drop">${icon('scan')}<b>Перетащи фото или PDF с нотами</b><small>NeonKeys распознает буквенные ноты и откроет их в блокноте</small>${btn('Выбрать файл', 'upload', 'acc')}</div><div class="scanprev"><span class="pg"></span><span class="pg"></span><span class="pg"></span></div></div></div>
</div>`;

// ---------------- trainings hub ----------------
const TR = [['song', 'Практика песни', 'Ноты летят к клавишам — играй вовремя', 'note', 'Песни', 7, '94%'], ['typing', 'Набор нот', 'Буквенные ноты по порядку, как тренажёр печати', 'kbd', 'Клавиатура', 5, '3 220'], ['reader', 'Нотный тренажёр', 'Случайные ноты на стане — найди клавишу', 'text', 'Чтение', 4, '30 подряд'], ['interval', 'Слух: интервалы', 'Две ноты — какое расстояние', 'ear', 'Слух', 3, '81%'], ['earchord', 'Слух: аккорды', 'Мажор, минор, обращения', 'midi', 'Слух', 2, '74%'], ['build', 'Сборка аккордов', 'Видишь символ — собери аккорд', 'chord', 'Чтение', 4, '22 подряд'], ['tap', 'Ритм-тапы', 'Послушай рисунок и отстучи', 'rhythm', 'Ритм', 3, '90%'], ['echo', 'Эхо-мелодия', 'Повтори фразу, которую сыграла сцена', 'echo', 'Слух', 1, 'новое'], ['scales', 'Гаммы', 'Гаммы и арпеджио с аппликатурой', 'scale', 'Техника', 5, '12 гамм'], ['meteor', 'Метеоры', 'Сыграй ноты метеора, пока он не упал', 'asteroid', 'Аркада', 6, '2 480'], ['speed', 'Скоропечать', 'Слова на время — можно на пианино', 'words', 'Клавиатура', 4, '71 сл/мин'], ['catch', 'Поймай луч', 'Для двоих: один играет, другой ловит', 'heart', 'Вдвоём', 2, '1 120']];
const trainHtml = `
<div class="train" data-filtergroup>
  <aside class="tcat">${['Все', 'Песни', 'Чтение', 'Слух', 'Ритм', 'Техника', 'Клавиатура', 'Аркада', 'Вдвоём'].map((c, i) => `<button type="button" class="${i ? '' : 'on'}" data-filter="${c}">${c}<em>${c === 'Все' ? TR.length : TR.filter(t => t[4] === c).length}</em></button>`).join('')}</aside>
  <div class="tmain">
    <div class="goalbar"><span class="ring big" style="--p:60%"></span><div><b>Цель дня: 15 минут</b><small>Осталось 6 минут · награда 170 монет</small></div><div class="gprog"><i style="width:60%"></i></div></div>
    <button type="button" class="hero" data-game="echo"><span class="hl">Рекомендуем сегодня</span><b>Эхо-мелодия</b><small>Новый режим: сцена играет короткую фразу, ты повторяешь. Фразы растут на ноту с каждым раундом.</small><span class="go">${icon('play')}Начать</span></button>
    <div class="tgrid">${TR.map(([k, t, d, i, c, lvl, best], n) => `<button type="button" class="tc" data-game="${k}" data-cat="${c}" style="--h:${(n * 29 + 10) % 360}"><span class="tlvl" style="--p:${lvl * 10}%"><b>${lvl}</b></span><span class="ti">${icon(i)}</span><b>${t}</b><small>${d}</small><span class="tb2"><em>${c}</em><span>${best}</span></span></button>`).join('')}</div>
  </div>
</div>`;

// ---------------- rooms ----------------
const ROOMS = [['Ночной зал', 'Мира', 'По очереди', 7, 16, 0, 1], ['Угадай саундтрек', 'serbez', 'Угадай песню', 11, 20, 0, 1], ['Нотный Pictionary', 'kaminari', 'Рисуем', 5, 12, 0, 0], ['Слово из 5', 'owl', 'Слово из 5', 4, 8, 1, 0], ['Свободный джем', '小星星', 'Все сразу', 14, 30, 0, 1], ['Виселица', 'noa', 'Виселица', 6, 10, 0, 0]];
const avs = n => Array.from({ length: Math.min(n, 4) }, (_, i) => `<i style="--ac:${grad(i / 4)}">${'МSKOН'[i]}</i>`).join('') + (n > 4 ? `<i class="more">+${n - 4}</i>` : '');
const rooms = `
<div class="rooms" data-tabgroup>
  <div class="pane" data-pane="lobby">
    <div class="lbar">${tags(['Все', 'По очереди', 'Все сразу', 'Рисуем', 'Угадай песню', 'Виселица', 'Слово из 5'], ['Все'])}<span class="grow"></span><span class="ping">${icon('pulse')}48 мс</span>${btn('Создать', 'plus', 'acc', 'data-modal="newroom"')}</div>
    <div class="rgrid">${ROOMS.map(([n, h, m, p, c, lock, v], i) => `<article class="rc" style="--h:${(i * 55 + 20) % 360}"><header><em>${m}</em>${lock ? icon('lock', 'tiny') : ''}${v ? `<span class="vtag">${icon('mic')}</span>` : ''}</header><b>${n}</b><small>ведёт ${h}</small><div class="rf"><span class="avs">${avs(p)}</span><span class="cap2">${p}/${c}</span></div><button type="button" class="btn sm wide" data-tab="room" data-join="${esc(n)}|${m}">Войти</button></article>`).join('')}</div>
  </div>
  <div class="pane" data-pane="room" hidden>
    <div class="lbar"><button type="button" class="btn sm" data-tab="lobby">${icon('back')}<span>Все комнаты</span></button><b class="rtitle" id="roomName">Ночной зал</b><em class="mode" id="roomMode">По очереди</em><span class="grow"></span><span class="ping">${icon('pulse')}21 мс</span>${btn('Выйти', 'door', 'sm ghost danger', 'data-tab="lobby"')}</div>
    <div class="rview">
      <div class="stagebox"><div class="now"><span class="nav2">М</span><div><small>Сейчас на сцене</small><b>Мира</b><span class="timer"><i></i>1:24 из 2:00</span></div></div><div class="eqb">${Array.from({ length: 32 }, () => `<i style="--d:${(rnd()).toFixed(2)}s"></i>`).join('')}</div><div class="upl">${btn('В очередь', 'plus', 'acc sm')}${btn('Чаевые', 'coin', 'sm')}${btn('Реакция', 'heart', 'sm')}</div></div>
      <div class="queue">${cap('Очередь и зрители')}${[['Мира', '#ff8fb8', 'играет', 1], ['Ронни', 'me', '2-й в очереди', 0], ['kaminari', '#ffb15a', '3-й в очереди', 0], ['serbez', '#7aa8ff', 'слушает', 1], ['owl', '#8ff0c8', 'зритель', 0]].map(([n, c, st, talk], i) => `<div class="qp${talk ? ' talk' : ''}"><em>${i + 1}</em><span class="fa" style="--ac:${c === 'me' ? 'var(--acc)' : c}">${n[0]}</span><span><b>${n}</b><small>${st}</small></span>${icon('mic', talk ? 'on' : '')}</div>`).join('')}<div class="ptt">${icon('mic')}Держи <kbd>V</kbd>, чтобы говорить</div></div>
    </div>
  </div>
</div>`;

// ---------------- studio (player + practice + editor + record + looper) ----------------
const heat = Array.from({ length: 48 }, () => rnd());
const tl = `<div class="tline"><div class="heat">${heat.map((h, i) => `<i style="--h:${h.toFixed(2)}" class="${i >= 16 && i <= 22 ? 'loop' : ''}"></i>`).join('')}</div><div class="bar"><b></b></div><div class="tt"><span>1:58</span><span>5:12</span></div></div>`;
const transport = `<div class="transport"><button type="button" class="pbig playbtn" aria-label="Играть">${icon('play', 'pl')}${icon('pause', 'pa')}</button><button type="button" class="rb">${icon('back')}</button><button type="button" class="rb">${icon('chevron')}</button>${tl}</div>`;
const roll = (() => { let s = ''; for (let i = 0; i < 50; i++) { const x = rnd() * 92, y = Math.floor(rnd() * 22), w = 3 + rnd() * 9; s += `<i style="left:${x.toFixed(1)}%;top:${(y * 4.4).toFixed(1)}%;width:${w.toFixed(1)}%;--c:${grad(1 - y / 22)}"></i>`; } return s; })();
const hands = modes => `<div class="hands">${[['Правая рука', 2018, '#ff9f5a'], ['Левая рука', 1244, '#6f8cff'], ['Педаль', 186, '#a39cae']].map(([n, c, col], i) => `<div class="hand"><i style="--hc:${col}"></i><span><b>${n}</b><small>${c} нот</small></span>${pills(modes, modes[Math.min(i, modes.length - 1)])}</div>`).join('')}</div>`;
const studio = `
<div class="studio" data-tabgroup>
  <div class="stabs">${[['play', 'play', 'Слушать'], ['practice', 'target', 'Учить'], ['edit', 'grid', 'Редактор'], ['rec', 'rec', 'Запись'], ['loop', 'loop', 'Лупер']].map(([k, i, t], n) => `<button type="button" class="${n === 1 ? 'on' : ''}" data-tab="${k}">${icon(i)}${t}</button>`).join('')}</div>
  <div class="nowfile"><span class="cover" style="--h:260">${icon('note')}</span><div><b>Clair de Lune</b><small>Debussy · MusicXML · 5:12</small></div>${btn('Другой файл', 'folder', 'sm')}${btn('Очередь 2/5', 'shuffle', 'sm')}</div>
  <div class="pane" data-pane="play" hidden>
    ${transport}
    ${field('Темп', 0.25, 2, 1, '×', { step: 0.05 })}
    <div class="twocol">${tog('Ноты на экране')}${tog('Подогнать под клавиатуру', true)}${tog('Камера следит за игрой')}${tog('Лучи', true)}</div>
    ${line('Повтор', pills(['Очередь', 'Песня', 'Нет'], 'Очередь'))}
    <div class="acts">${['Экспорт WAV', 'Видео', 'В буквенные ноты', 'Упростить', 'Пальцы (ИИ)', 'PDF'].map((a, i) => btn(a, '', 'sm', i === 1 ? 'data-modal="render"' : '')).join('')}</div>
    ${hands(['Вкл', 'Выкл'])}
  </div>
  <div class="pane" data-pane="practice">
    ${transport}
    <div class="scorebar">${[['Очки', '12 480'], ['Серия', '37'], ['Рекорд', '52'], ['Точность', '94%'], ['Ошибки', '6']].map(([a, b]) => `<span><small>${a}</small><b>${b}</b></span>`).join('')}</div>
    <div class="loopline">${cap('Фрагмент')}${btn('A', '', 'sm')}${btn('B', '', 'sm')}${dd('Такты 13–18 · 5 раз')}${btn('Нарезать песню', 'wand', 'sm')}</div>
    ${field('Темп', 0.25, 1.5, 0.7, '×', { step: 0.05 })}
    ${line('Ждать правильную ноту', pills(['Всегда', 'Один раз', 'Нет'], 'Всегда'))}
    <div class="twocol">${tog('Ноты на экране', true)}${tog('Тепловая карта ошибок', true)}${tog('Звук за пропущенные', false)}${tog('Автопедаль')}</div>
    ${hands(['Я', 'Сцена', 'Тихо'])}
  </div>
  <div class="pane" data-pane="edit" hidden>
    <div class="etools">${pills(['Выбор', 'Карандаш', 'Ластик', 'Педаль'], 'Карандаш')}${dd('Сетка 1/8')}${btn('Темп', '', 'sm')}${btn('Писать с клавиш', 'rec', 'sm')}</div>
    <div class="roll"><div class="rkeys">${Array.from({ length: 22 }, (_, i) => `<i class="${[1, 3, 6, 8, 10].includes((21 - i) % 12) ? 'b' : ''}"></i>`).join('')}</div><div class="rgrid2">${roll}<span class="ph"></span></div></div>
    <div class="etools">${btn('Дорожка', 'plus', 'sm')}${btn('Разделить', '', 'sm')}${btn('Объединить', '', 'sm')}<span class="grow"></span>${btn('', 'minus', 'sm')}<code>100%</code>${btn('', 'plus', 'sm')}</div>
  </div>
  <div class="pane" data-pane="rec" hidden>
    <div class="recmain"><span class="live"><i></i>MIDI пишется всегда</span><div class="bignum"><b>1 284</b><small>нот</small><b>12:07</b><small>за сессию</small></div><div class="wave">${Array.from({ length: 56 }, () => `<i style="--h:${(0.15 + rnd() * .85).toFixed(2)}"></i>`).join('')}</div><div class="upl">${btn('Сохранить MIDI', 'save', 'acc')}${btn('Сбросить', 'trash', 'ghost danger')}</div>${note('После минуты тишины запись ставится на паузу.')}</div>
    <div class="recgrid">
      <button type="button" class="rtile recbtn">${icon('mic')}<b>Запись звука</b><small>WAV со всеми эффектами</small></button>
      <button type="button" class="rtile" data-modal="render">${icon('film')}<b>Видео из файла</b><small>Покадровый рендер, 9:16 и 16:9</small></button>
      <button type="button" class="rtile recbtn">${icon('cam')}<b>Запись экрана</b><small>Как есть, с интерфейсом</small></button>
      <button type="button" class="rtile gold" data-modal="submit">${icon('gift')}<b>Ролик за награду</b><small><span class="coin"></span>100 000 и <span class="gem"></span>2 000</small></button>
    </div>
  </div>
  <div class="pane" data-pane="loop" hidden>
    <div class="looper"><div class="lring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="lt"/><circle cx="60" cy="60" r="52" class="lp"/></svg><b>2 / 4</b><small>такт</small></div><div class="lctl">${btn('Запись', 'rec', 'danger')}${btn('Играть', 'play')}${btn('Отменить', 'back')}${btn('Очистить', 'trash', 'ghost')}</div></div>
    ${field('Темп', 30, 300, 100, ' bpm')}${field('Длина', 1, 16, 4, ' такта')}
    ${line('Квантизация', pills(['Нет', '1/4', '1/8', '1/16'], 'Нет'))}
    <div class="twocol">${tog('Клик на каждую долю', true)}${tog('Сохранять инструмент петли', true)}${tog('Показывать ноты петли', true)}${tog('Добавлять в MIDI-запись')}</div>
  </div>
</div>`;

// ---------------- sound ----------------
const INST = { 'Рояли': [['Grand Lite', 'встроенный', '21 МБ'], ['Fantasy Piano', 'встроенный', '2 МБ'], ['Acoustic Grand', 'встроенный', '16 МБ'], ['E.Piano', 'встроенный', '1 МБ'], ['Honky Tonk', 'встроенный', '9 МБ']], 'Мои': [['Fazioli F308', 'D:\\SF2', '299 МБ'], ['Nice-Keys Ultimate', 'D:\\SF2', '505 МБ'], ['Abbey Steinway D', 'D:\\SF2', '36 МБ']], 'Оркестр': [['Струнные', 'встроенный', '4 МБ'], ['Арфа', 'встроенный', '19 МБ'], ['Флейта', 'встроенный', '1 МБ'], ['Хор «а»', 'встроенный', '2 МБ']], 'Синты': [['Полисинт', 'встроенный', '0.1 МБ'], ['Пила', 'встроенный', '0.1 МБ'], ['Чиптюн', 'встроенный', '0.01 МБ']], 'Шутки': [['Мяу', 'встроенный', '0.2 МБ'], ['Кря', 'встроенный', '0.01 МБ'], ['Буйнг', 'встроенный', '0.02 МБ']] };
const sound = `
<div class="sound" data-tabgroup>
  <div class="stabs">${[['inst', 'wave', 'Инструменты'], ['fx', 'sliders', 'Эффекты'], ['out', 'sound', 'Громкость и вывод']].map(([k, i, t], n) => `<button type="button" class="${n ? '' : 'on'}" data-tab="${k}">${icon(i)}${t}</button>`).join('')}</div>
  <div class="pane" data-pane="inst">
    <div class="instwrap" data-tabgroup>
      <div class="icats">${Object.keys(INST).map((c, i) => `<button type="button" class="${i ? '' : 'on'}" data-tab="${c}">${c}</button>`).join('')}</div>
      <div>${Object.entries(INST).map(([c, arr], i) => `<div class="pane" data-pane="${c}" ${i ? 'hidden' : ''}><div class="insts" data-single>${arr.map(([n, s, sz], j) => `<button type="button" class="inst${j ? '' : ' on'}"><span class="iw">${Array.from({ length: 9 }, () => `<i style="--h:${(0.2 + rnd() * .8).toFixed(2)}"></i>`).join('')}</span><b>${n}</b><small>${s} · ${sz}</small></button>`).join('')}</div></div>`).join('')}</div>
    </div>
    <div class="upl">${btn('Папка со звуками', 'folder', 'sm')}${btn('Загрузить .sf2', 'upload', 'sm')}${btn('Собрать свой', 'wand', 'sm', 'data-win="sf2"')}${btn('VST3', 'grid', 'sm')}</div>
    ${cap('Слои — звучат вместе')}
    <div class="layers">${[['Fazioli F308', 21, 108, 100], ['Струнные', 36, 59, 45]].map(([n, a, b, v], i) => `<div class="lay"><em>${i + 1}</em><b>${n}</b><span class="krange"><i style="left:${((a - 21) / 87 * 100).toFixed(1)}%;right:${(100 - (b - 21) / 87 * 100).toFixed(1)}%"></i></span><small>${NOTE[a % 12]}${Math.floor(a / 12) - 1}–${NOTE[b % 12]}${Math.floor(b / 12) - 1}</small><input type="range" min="0" max="300" value="${v}" style="--p:${v / 3}%"><output>${v}%</output><button type="button" class="x" aria-label="Убрать слой">${icon('x')}</button></div>`).join('')}<button type="button" class="addlay">${icon('plus')}Добавить слой</button></div>
  </div>
  <div class="pane" data-pane="fx" hidden>
    <div class="rack">
      <section class="mod"><header><b>Пространство</b>${tog('', true)}</header><div class="spaces" data-single>${[['Комната', '25% · 1.5 с'], ['Студия', '30% · 2 с'], ['Зал', '40% · 5 с'], ['Собор', '60% · 6 с'], ['Пещера', '50% · 4 с'], ['Бесконечность', '70% · 8 с']].map(([n, h], i) => `<button type="button" class="${i === 2 ? 'on' : ''}"><b>${n}</b><small>${h}</small></button>`).join('')}</div><div class="knobs">${[['Сила', 40], ['Хвост', 62], ['Пауза', 20], ['Тепло', 35]].map(([n, v]) => `<span class="knob" style="--v:${v}"><i></i><small>${n}</small><b>${v}</b></span>`).join('')}</div></section>
      <section class="mod"><header><b>Хорус</b>${tog('')}</header>${pills(['Лёгкий', 'Широкий', 'Плотный', 'Фланжер'], 'Широкий')}<div class="knobs">${[['Сила', 0], ['Скорость', 20], ['Глубина', 30]].map(([n, v]) => `<span class="knob" style="--v:${v}"><i></i><small>${n}</small><b>${v}</b></span>`).join('')}</div></section>
      <section class="mod"><header><b>Эхо</b>${tog('')}</header>${pills(['Короткое', 'Среднее', 'Длинное', 'Стерео'], 'Среднее')}<div class="knobs">${[['Сила', 0], ['Время', 55], ['Повторы', 60]].map(([n, v]) => `<span class="knob" style="--v:${v}"><i></i><small>${n}</small><b>${v}</b></span>`).join('')}</div></section>
      <section class="mod"><header><b>Эквалайзер</b>${tog('', true)}</header>${pills(['Ровный', 'Тёплый', 'Яркий', 'Басы'], 'Тёплый')}<div class="eq3">${[['Низ', 4], ['Сред', 2], ['Верх', -2]].map(([n, v]) => `<span><i style="--v:${v}"></i><small>${n} ${v > 0 ? '+' : ''}${v}</small></span>`).join('')}</div></section>
    </div>
    <div class="twocol">${field('Длина звучания после отпускания', 0, 10, 1, '×', { step: 0.1 })}${field('Максимум педали', 0, 120, 30, ' с')}${field('Строй A4', 400, 480, 440, ' Гц')}${line('Фон', pills(['Нет', 'Дождь', 'Винил', 'Лес'], 'Нет'))}</div>
  </div>
  <div class="pane" data-pane="out" hidden>
    <div class="mixer">${[['Общая', 70], ['MIDI', 100], ['Клавиатура', 100], ['Плеер', 49], ['Игроки', 80], ['Эффекты', 20], ['Метроном', 100], ['Голоса', 90]].map(([n, v]) => `<span class="fader"><span class="ft"><i style="--p:${v}%"></i></span><b>${v}</b><small>${n}</small></span>`).join('')}</div>
    ${line('Задержка', pills(['Минимальная', 'Баланс', 'Надёжная'], 'Баланс'))}
    ${line('Вывод', pills(['Обычный', 'WASAPI', 'ASIO'], 'Обычный'), 'WASAPI и ASIO дают меньшую задержку')}
    ${line('Устройство', dd('Системное по умолчанию'))}
    ${line('Качество', pills(['Лёгкое', 'Обычное', 'Лучшее'], 'Обычное'))}
    ${field('Одновременных нот', 100, 2000, 800, '', { step: 50 })}
    ${line('Виртуальные MIDI-порты', btn('Добавить', 'plus', 'sm'), 'Чтобы отправлять ноты в DAW')}
  </div>
</div>`;

// ---------------- notepad ----------------
const notepad = `
<div class="npad">
  <div class="npbar">${btn('', 'folder', 'sm', 'title="Открыть"')}${btn('', 'save', 'sm', 'title="Сохранить"')}${btn('', 'copy', 'sm', 'title="Копировать"')}${btn('', 'trash', 'sm', 'title="Очистить"')}<span class="vr"></span><button type="button" class="btn sm" id="npMinus"><span>A−</span></button><code id="npSize">16</code><button type="button" class="btn sm" id="npPlus"><span>A+</span></button><span class="grow"></span><span class="cnt s">Shift 128</span><span class="cnt c">Ctrl 0</span></div>
  <textarea class="sheet" id="npText" spellcheck="false">[6e] y [4q] 0 [8w] e [5t] o [30] [6e] y [4q] 0
[8w] r [5e] w [30] q [6e] y [4q] 0 [8w] e [5t] o [30] [yP]
| [6e] y [4q] 0 [8w] e [5t] o [30] [6e] y [4q] 0 [8w] r
[5e] w q [30] ~ [tp] o [6e] i u [4q] y t [8w] r e [5w] q</textarea>
  <div class="npfoot"><button type="button" class="pbig sm playbtn">${icon('play', 'pl')}${icon('pause', 'pa')}</button>${btn('По шагу', 'next', 'sm')}<code>128 bpm</code><span class="vr"></span>${btn('Подобрать тональность', 'wand', 'sm acc')}${btn('−1', '', 'sm')}${btn('+1', '', 'sm')}${btn('Упростить аккорды', '', 'sm')}<span class="grow"></span>${btn('Играть', 'kbd', 'sm', 'data-game="typing"')}${btn('Скоропечать', 'words', 'sm', 'data-game="speed"')}</div>
</div>`;

// ---------------- profile & shop ----------------
const calCells = Array.from({ length: 7 * 26 }, () => { const r = rnd(); return r < .35 ? 0 : r < .6 ? 1 : r < .8 ? 2 : r < .93 ? 3 : 4; });
const keyHeat = (() => { let s = ''; for (let m = 36; m <= 96; m++) { if (isBlack(m)) continue; const h = Math.max(0, 1 - Math.abs(m - 66) / 26) * (0.5 + rnd() * .5); s += `<i style="--h:${h.toFixed(2)}"></i>`; } return s; })();
const profile = `
<div class="prof" data-tabgroup>
  <div class="pcover"><span class="av xl">Р</span><div><b>Ронни</b><small>@ronny · в сети · с нами 214 дней</small><span class="chips2"><em>Полная версия</em><em>${icon('flame')}12 дней</em><em>Топ-500 клавиатуры</em></span></div>${btn('Изменить', 'pencil', 'sm', 'data-open-settings="account"')}</div>
  <div class="ptabs">${['Обзор', 'Рейтинги', 'Клавиши', 'Друзья'].map((t, i) => `<button type="button" class="${i ? '' : 'on'}" data-tab="${t}">${t}</button>`).join('')}</div>
  <div class="pane" data-pane="Обзор"><div class="kgrid">${[['Нот с клавиатуры', '92 940'], ['Нот с MIDI', '12 110'], ['Время игры', '63 ч'], ['Очки в тренировках', '9 724'], ['Подарено монет', '4 200'], ['Целей дня', '41']].map(([a, b]) => `<span><b>${b}</b><small>${a}</small></span>`).join('')}</div>${cap('Активность за полгода')}<div class="cal">${calCells.map(v => `<i class="l${v}"></i>`).join('')}</div></div>
  <div class="pane" data-pane="Рейтинги" hidden>${pills(['Клавиатура', 'MIDI', 'Тренировки', 'Щедрость'], 'Клавиатура')}<div class="board">${[['1', 'Мира', '48 210'], ['2', 'serbez', '41 877'], ['3', '小星星', '39 050'], ['4', 'kaminari', '33 912'], ['5', 'owl', '30 004'], ['128', 'Ронни', '12 480']].map(([r, n, s]) => `<div class="br${n === 'Ронни' ? ' me' : ''}"><em>${r}</em><b>${n}</b><span>${s}</span></div>`).join('')}</div></div>
  <div class="pane" data-pane="Клавиши" hidden>${note('Как часто нажимается каждая белая клавиша')}<div class="keyheat">${keyHeat}</div></div>
  <div class="pane" data-pane="Друзья" hidden><label class="search">${icon('search')}<input placeholder="Найти игрока…"></label>${[['Мира', '#ff8fb8', 'в «Ночном зале»', 1], ['kaminari', '#ffb15a', 'в сети', 1], ['serbez', '#7aa8ff', 'был 2 ч назад', 0], ['owl', '#8ff0c8', 'был вчера', 0]].map(([n, c, st, on]) => `<div class="friend"><span class="fa" style="--ac:${c}">${n[0]}</span><span><b>${n}</b><small>${st}</small></span><i class="od${on ? ' on' : ''}"></i><button type="button" class="btn sm" data-feed-dm>${icon('chat')}</button></div>`).join('')}</div>
</div>`;
const SHOP = [['Ник', 'Переливы', 4900, 'gem', 'rainbow'], ['Ник', 'Волна', 4900, 'gem', 'wave'], ['Карточка', 'Северное сияние', 8900, 'gem', 'aurora'], ['Карточка', 'Гроза', 14900, 'gem', 'storm'], ['Курсор', 'Инь-ян', 45000, 'coin', 'yin'], ['След курсора', 'Мелодия', 1900, 'gem', 'melody'], ['Ник', 'Снегопад', 900, 'gem', 'snowfx'], ['Шрифт ника', 'Комикс', 1900, 'gem', 'font']];
const shop = `
<div class="shop">
  <div class="sbanner"><div><b>Витрина недели</b><small>Обновится через 5:42:10</small></div><span class="grow"></span>${pills(['Всё', 'Ник', 'Курсор', 'Карточка'], 'Всё')}</div>
  <div class="items">${SHOP.map(([c, n, p, cur, fx]) => `<div class="item fx-${fx}"><span class="prev"><b>Ронни</b></span><small>${c}</small><b>${n}</b><button type="button" class="btn sm buy"><span class="${cur === 'gem' ? 'gem' : 'coin'}"></span><span>${p.toLocaleString('ru-RU').replace(/\u00a0/g, ' ')}</span></button></div>`).join('')}</div>
  ${cap('Кристаллы')}<div class="gembuy">${[['500', '0.99 $'], ['2 700', '4.99 $'], ['6 000', '9.99 $'], ['14 000', '19.99 $']].map(([g, p], i) => `<button type="button" class="gb${i === 2 ? ' best' : ''}"><span class="gem"></span><b>${g}</b><small>${p}</small></button>`).join('')}</div>
</div>`;

// ---------------- training screens ----------------
const intervals = ['м2', 'б2', 'м3', 'б3', 'ч4', 'тритон', 'ч5', 'м6', 'б6', 'м7', 'б7', 'октава'];
const readerSvg = (() => { let s = ''; for (let i = 0; i < 5; i++) s += `<line x1="10" x2="590" y1="${40 + i * 14}" y2="${40 + i * 14}"/>`; s += `<text x="12" y="104" class="clef">𝄞</text>`; [61, 54, 75, 47, 68, 40, 82, 61, 33, 54, 89, 68, 47, 75].forEach((y, i) => { s += `<ellipse class="${i === 0 ? 'cur' : ''}" cx="${110 + i * 34}" cy="${y}" rx="8" ry="6" transform="rotate(-18 ${110 + i * 34} ${y})"/>`; }); return `<svg viewBox="0 0 600 130" class="trsvg">${s}</svg>`; })();
const meteors = Array.from({ length: 6 }, (_, i) => `<span class="met" style="left:${8 + i * 15 + rnd() * 6}%;animation-delay:-${(rnd() * 8).toFixed(1)}s;--sz:${48 + rnd() * 30}px">${['C E G', 'A', 'F A C', 'D', 'G B', 'E'][i]}</span>`).join('');
const G = {
  typing: ['Набор нот', 'Past Lives', [['Очки', '3 220'], ['Серия', '41'], ['Точность', '97%']], `${field('Автодоигрывание аккорда', 0, 5, 0, '', { fmt: 'off0' })}${tog('Звук ошибки', true)}${tog('Ноты', true)}${tog('Падающие ноты', true)}`, `<div class="typing"><span class="done">[6e] y [4q] 0 [8w] e </span><span class="curc">[5t]</span><span class="todo"> o [30] [6e] y [4q] 0 [8w] r [5e] w [30] q [6e] y [4q] 0 [8w] e [5t] o [30] [yP] | [6e] y</span></div>`, 23],
  reader: ['Нотный тренажёр', 'скрипичный ключ · до мажор', [['Серия', '12'], ['Точность', '92%'], ['Всего', '64']], `${line('Ключ', pills(['Скрипичный', 'Басовый', 'Оба'], 'Скрипичный'))}${line('Диапазон', pills(['Лёгкий', 'Обычный', 'Добавочные линии', 'Свой'], 'Обычный'))}${line('Подсказка', pills(['Нет', 'После ошибки', 'Всегда'], 'После ошибки'))}`, readerSvg, 45],
  interval: ['Слух: интервалы', 'от −3 до +12 полутонов', [['Серия', '6'], ['Точность', '81%'], ['Всего', '42']], `${field('От', -24, 0, -3, '')}${field('До', 0, 24, 12, '')}${tog('Абсолютный слух (одна нота)')}`, `<div class="listen"><span class="wv">${icon('ear')}</span><b>Слушай…</b>${btn('Ещё раз', 'loop', 'sm')}</div><div class="answers" data-quiz>${intervals.map(t => `<button type="button">${t}</button>`).join('')}</div>`, 60],
  earchord: ['Слух: аккорды', 'мажор и минор', [['Серия', '3'], ['Точность', '74%'], ['Всего', '27']], `${minis(['Мажор', 'Минор', 'Уменьш.', 'Увелич.', 'Септ.', 'Мажор 7', 'Минор 7'], [0, 1])}`, `<div class="listen"><span class="wv">${icon('midi')}</span><b>Какой аккорд?</b>${btn('Ещё раз', 'loop', 'sm')}</div><div class="answers" data-quiz>${['Мажор', 'Минор', 'Уменьшённый', 'Увеличенный'].map(t => `<button type="button">${t}</button>`).join('')}</div>`, 30],
  build: ['Сборка аккордов', 'септаккорды', [['Серия', '9'], ['Точность', '88%'], ['Всего', '31']], `${minis(['maj', 'm', 'dim', 'aug', 'maj7', 'm7', '7', 'm7♭5'], [0, 1, 4, 5, 6])}${line('Запись', pills(['Буквы', 'Ступени'], 'Буквы'))}${tog('Подсказка на клавишах', true)}`, `<div class="bigchord"><b>F♯m7</b><small>первое обращение · нижняя нота — бас</small><span class="held">Собрано: F♯ · A · <i>?</i> · <i>?</i></span></div>`, 50],
  tap: ['Ритм-тапы', '4/4 · 100 bpm', [['Серия', '4'], ['Точность', '90%'], ['Всего', '18']], `${minis(['Половинные', 'Четверти', 'Восьмые', 'Триоли', 'Шестнадцатые', 'Паузы'], [1, 2])}${field('Темп', 40, 240, 100, ' bpm')}`, `<div class="rhythm">${['♩', '♪♪', '♩', '♪♪', '♩.', '♪', '♩', '𝄽'].map((n, i) => `<span class="${i < 3 ? 'hit' : i === 3 ? 'now' : ''}">${n}</span>`).join('')}</div><button type="button" class="tap" id="tapBtn">Стучи: пробел или любая клавиша</button>`, 38],
  echo: ['Эхо-мелодия', 'раунд 4 · фраза из 5 нот', [['Раунд', '4'], ['Рекорд', '9'], ['Точность', '100%']], `${line('Лад', pills(['Мажор', 'Минор', 'Пентатоника'], 'Пентатоника'))}${field('Темп фразы', 40, 200, 90, ' bpm')}${tog('Показывать ноты фразы')}`, `<div class="echo"><div class="phrase">${['C', 'E', 'G', 'E', '?'].map((n, i) => `<span class="${i < 4 ? 'ok' : 'wait'}">${n}</span>`).join('')}</div><small>Сцена сыграла фразу — повтори её на клавишах</small>${btn('Послушать снова', 'loop', 'sm')}</div>`, 70],
  scales: ['Гаммы', 'до мажор и ля минор', [['Готово', '3/12'], ['Точность', '96%']], ``, `<div class="scalesetup">${card('Что играем', tags(['Мажор', 'Натур. минор', 'Гарм. минор', 'Мелод. минор', 'Пентатоника', 'Блюз', 'Хроматика', 'Арпеджио', 'Септаккорды'], ['Мажор', 'Арпеджио'], { multi: true }))}${card('Тоники', tags(['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], ['C', 'A'], { multi: true }))}${card('Как играем', line('Руки', pills(['Левая', 'Правая', 'Обе', 'Навстречу'], 'Правая')) + line('Октавы', pills(['1', '2', '3'], '1')) + line('Аппликатура', pills(['Удобная', 'Классическая', 'Нет'], 'Удобная')) + line('Повторы', pills(['1', '2', '3', '∞'], '2')))}${btn('Начать', 'play', 'acc wide')}</div>`, 25],
  meteor: ['Метеоры', 'скорость 20 · 15 в минуту', [['Очки', '2 480'], ['Сбито', '31'], ['Промахи', '4']], `${field('Скорость', 10, 80, 20, '')}${field('Частота', 5, 40, 15, '/мин')}${line('Знаки', pills(['Нет', '♯', '♭', 'Все'], 'Нет'))}`, `<div class="metfield">${meteors}</div>`, 55],
  speed: ['Скоропечать', '30 секунд · 200 частых слов', [['Время', '0:30'], ['Слов/мин', '0'], ['Ошибки', '0']], `${field('Частых слов', 50, 1000, 200, '', { step: 50 })}${field('Время', 0, 120, 30, ' с', { step: 5 })}${tog('Чаще слабые слова')}${tog('Звук пианино')}`, `<div class="words"><span class="done">for</span> <span class="done">item</span> <span class="cur">center</span> <span>view</span> <span>a</span> <span>read</span> <span>life</span> <span>we</span> <span>here</span> <span>time</span> <span>click</span> <span>were</span> <span>email</span> <span>does</span> <span>web</span> <span>good</span></div>`, 10],
  catch: ['Поймай луч', 'для двоих', [['Очки', '1 120'], ['Серия', '14']], `${line('Засчитывать', pills(['Наведение', 'Клик'], 'Наведение'))}`, `<div class="catch"><span class="heartbig">${icon('heart')}</span><b>Один играет, второй ловит лучи курсором</b><small>Попробуй поиграть на клавишах внизу.</small></div>`, 0],
};
const gameHtml = `
<section class="gscreen" id="game" hidden data-tabgroup>
  ${Object.entries(G).map(([k, [t, sub, stats, ctl, stage, prog]]) => `<div class="pane" data-pane="${k}" hidden>
    <header class="gtop"><button type="button" class="btn sm ghost" data-open="train">${icon('back')}<span>Тренировки</span></button><div class="gname"><b>${t}</b><small>${sub}</small></div><span class="grow"></span>${stats.map(([a, b]) => `<span class="gst"><b>${b}</b><small>${a}</small></span>`).join('')}${ctl ? `<button type="button" class="btn sm gset" aria-label="Настройки">${icon('sliders')}</button>` : ''}<button type="button" class="btn sm ghost danger" data-close-game>${icon('x')}</button></header>
    <div class="gprog2"><i style="width:${prog}%"></i></div>
    ${ctl ? `<div class="gdrawer" hidden>${ctl}</div>` : ''}
    <div class="gstage">${stage}</div>
  </div>`).join('')}
</section>`;

// ---------------- windows / modals / pops ----------------
const cof = (() => { const maj = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'D♭', 'A♭', 'E♭', 'B♭', 'F'], min = ['Am', 'Em', 'Bm', 'F♯m', 'C♯m', 'G♯m', 'D♯m', 'B♭m', 'Fm', 'Cm', 'Gm', 'Dm']; let s = ''; for (let i = 0; i < 12; i++) { const a0 = (i * 30 - 105) * Math.PI / 180, a1 = ((i + 1) * 30 - 105) * Math.PI / 180; const P = (r, a) => `${(120 + r * Math.cos(a)).toFixed(1)} ${(120 + r * Math.sin(a)).toFixed(1)}`; s += `<path class="cs" style="--c:${grad(i / 11)}" d="M${P(112, a0)} A112 112 0 0 1 ${P(112, a1)} L${P(70, a1)} A70 70 0 0 0 ${P(70, a0)}Z"/>`; const am = (i * 30 - 90) * Math.PI / 180; s += `<text x="${(120 + 92 * Math.cos(am)).toFixed(1)}" y="${(124 + 92 * Math.sin(am)).toFixed(1)}" class="ct">${maj[i]}</text><text x="${(120 + 52 * Math.cos(am)).toFixed(1)}" y="${(123 + 52 * Math.sin(am)).toFixed(1)}" class="ct sm">${min[i]}</text>`; } return `<svg viewBox="0 0 240 240" class="cof">${s}<circle cx="120" cy="120" r="30" class="cc"/><text x="120" y="118" class="ct">C</text><text x="120" y="132" class="ct sm">без знаков</text></svg>`; })();
const WINS = {
  circle: ['Квинтовый круг', cof + note('Наведи на сектор — тональность и её аккорды.')],
  webcam: ['Камера на сцене', `<div class="cambox">${icon('cam')}<b>Камера выключена</b><small>Включается только вручную.</small>${btn('Включить', '', 'sm acc')}</div>${tog('За лучами, поверх фона')}`],
  video: ['Видео поверх', `<div class="cambox">${icon('film')}<b>Открой видео с диска</b>${btn('Выбрать', 'upload', 'sm acc')}</div>${tog('Повторять', true)}`],
  ai: ['Аудио → MIDI', `<div class="drop sm">${icon('ai')}<b>Перетащи аудио</b><small>mp3, wav, flac, ogg, m4a</small></div><div class="aiprog">${cap('song.mp3')}<div class="bar"><b style="width:64%"></b></div>${note('Распознаю ноты · 64%')}</div>`],
  monitor: ['MIDI-монитор', `<div class="upl">${btn('Пауза', 'pause', 'sm')}${btn('Очистить', 'trash', 'sm')}${btn('JSON', 'copy', 'sm')}</div><div class="mon">${[['04.120', 'SE61', 'нота вкл', 'C4 · 96'], ['04.388', 'SE61', 'нота выкл', 'C4'], ['04.402', 'клавиатура', 'нота вкл', 'C4 · 104'], ['05.010', 'SE61', 'педаль', '127'], ['05.221', 'выход', 'подсветка', 'E4']].map(r => `<div>${r.map(c => `<span>${c}</span>`).join('')}</div>`).join('')}</div>`],
  pitch: ['Питч и вибрато', `<div class="pm"><span class="vs"><input type="range" min="-100" max="100" value="0" class="vert"><small>ПИТЧ</small></span><span class="vs"><input type="range" min="0" max="127" value="0" class="vert"><small>ВИБРАТО</small></span><div>${field('Диапазон бенда', 1, 12, 2, ' пт')}${field('Плавность клавиш', 0, 500, 100, ' мс', { step: 25 })}${bind('Вверх', '')}${bind('Вниз', '')}${bind('Вибрато', '')}</div></div>`],
  browser: ['Браузер', `<div class="urlbar">${btn('', 'back', 'sm')}${btn('', 'loop', 'sm')}<span class="url">https://musescore.com</span></div><div class="fakepage"><b>MuseScore</b><small>ноты и MIDI — прямо внутри NeonKeys</small><i></i><i></i><i></i></div>`],
  ideas: ['Идеи сообщества', `${[['Дуэль 1 на 1 на скорость', 342], ['Свои раскладки для аналоговых клавиатур', 128], ['Экспорт MusicXML из редактора', 97]].map(([t, v], i) => `<div class="idea"><button type="button" class="vote${i === 0 ? ' on' : ''}">${icon('up')}<b>${v}</b></button><span>${t}</span></div>`).join('')}${btn('Предложить', 'plus', 'ghost wide')}`],
  bug: ['Сообщить о проблеме', `${cap('Что случилось?')}<textarea class="in" rows="4" placeholder="Что сделал, что ожидал, что вышло"></textarea>${tog('Приложить журнал', true)}${btn('Отправить', 'send', 'acc wide')}`],
  sf2: ['Собрать свой звук', `<div class="drop sm">${icon('upload')}<b>Перетащи сэмплы</b><small>Высоту беру из имени: C4.wav, A#3.wav</small></div>${tog('Растянуть на все 88 клавиш', true)}${btn('Собрать .sf2', 'save', 'acc wide')}`],
};
const winsHtml = Object.entries(WINS).map(([k, [t, b]], i) => `<section class="win" id="w-${k}" hidden style="left:${420 + (i % 4) * 40}px;top:${100 + (i % 4) * 30}px"><header class="wh"><b>${t}</b><button type="button" class="xb" data-close-win aria-label="Закрыть">${icon('x')}</button></header><div class="wb">${b}</div></section>`).join('');
const MODALS = {
  daily: `<div class="dailym"><span class="flbig">${icon('flame')}</span><b>12 дней подряд</b><small>Каждый день подряд добавляет +10 монет к награде</small><div class="week">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d, i) => `<span class="${i < 5 ? 'got' : i === 5 ? 'now' : ''}"><small>${d}</small><b>${110 + i * 10}</b></span>`).join('')}</div><button type="button" class="btn acc wide" data-claim><span>Забрать 170</span><span class="coin"></span></button></div>`,
  quit: `<div class="confirm"><b>Закрыть NeonKeys?</b><small>MIDI-запись этой сессии сохранится сама.</small><div class="upl">${btn('Остаться', '', '', 'data-close-modal')}${btn('Выйти из аккаунта', '', 'ghost', 'data-close-modal')}${btn('Закрыть', 'power', 'danger', 'data-close-modal')}</div></div>`,
  newroom: `<div class="form"><b class="mt">Новая комната</b><div class="stack">${inp('Название', 'Комната Ронни')}${inp('Пароль (необязательно)')}</div><div class="modes" data-single>${[['По очереди', 'каждый играет свой ход'], ['Все сразу', 'общий джем'], ['Рисуем', 'рисуешь — остальные угадывают'], ['Угадай песню', 'играешь — угадывают в чате'], ['Виселица', 'угадываем слово по буквам'], ['Слово из 5', 'шесть попыток на слово']].map(([n, d], i) => `<button type="button" class="${i ? '' : 'on'}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>${field('Мест', 4, 30, 12, '')}${field('Время хода', 15, 600, 120, '', { step: 15, fmt: 'time' })}${line('Голос', pills(['Все', 'Кто играет', 'По кнопке', 'Нет'], 'Кто играет'))}${tog('Зрители', true)}${tog('Голосование за исключение', true)}<div class="upl">${btn('Отмена', '', 'ghost', 'data-close-modal')}<button type="button" class="btn acc" data-close-modal data-tab="room" data-join="Комната Ронни|По очереди"><span>Создать</span></button></div></div>`,
  render: `<div class="form"><b class="mt">Видео из файла</b>${line('Кадр', pills(['16:9', '9:16', 'Оба'], '9:16'))}${line('Качество', pills(['720p', '1080p', '4K'], '1080p'))}${field('Кадров в секунду', 24, 60, 30, '')}${tog('Рамка безопасной зоны для соцсетей', true)}${tog('Отражение под пианино', true)}${tog('Ноты поверх видео')}${tog('Прозрачный фон')}<div class="upl">${btn('Отмена', '', 'ghost', 'data-close-modal')}${btn('Выбрать файл и начать', 'film', 'acc', 'data-close-modal')}</div></div>`,
  submit: `<div class="form"><b class="mt">Ролик за награду</b>${note('Ссылка на TikTok, Reels или YouTube с «NeonKeys» в названии или описании. Раз в сутки на каждую площадку.')}${inp('https://…')}${tog('Это мой ролик', true)}<div class="upl">${btn('Отмена', '', 'ghost', 'data-close-modal')}${btn('Отправить', 'send', 'acc', 'data-close-modal')}</div></div>`,
};
const modalHtml = `<div class="modal" id="modal" hidden><div class="mbox">${Object.entries(MODALS).map(([k, v]) => `<div class="pane" data-m="${k}" hidden>${v}</div>`).join('')}<button type="button" class="xb mclose" data-close-modal aria-label="Закрыть">${icon('x')}</button></div></div>`;
const pops = `
<div class="pop" id="pop-quest" hidden><div class="qrow"><span class="ring big" style="--p:60%"></span><div><b>Цель дня</b><small>15 минут игры · осталось 6</small></div></div><div class="bar"><b style="width:60%"></b></div>${note('Награда — 170 монет и +1 к серии целей')}</div>
<div class="pop" id="pop-notifs" hidden>${cap('Уведомления')}${[['heart', 'Мира отреагировала на сообщение', '5 мин'], ['users', 'owl и 小星星 подписались на тебя', '1 ч'], ['gift', 'Ежедневная награда ждёт', '3 ч']].map(([i, t, a]) => `<div class="ni">${icon(i)}<span>${t}</span><small>${a}</small></div>`).join('')}</div>
<div class="pop menu" id="pop-me" hidden>${[['user', 'Профиль', 'data-open="profile"'], ['users', 'Друзья', 'data-open-profile="Друзья"'], ['bag', 'Лавка', 'data-open="shop"'], ['shield', 'Аккаунт и приватность', 'data-open-settings="account"'], ['power', 'Выход', 'data-modal="quit"']].map(([i, t, a]) => `<button type="button" ${a}>${icon(i)}<span>${t}</span></button>`).join('')}</div>`;

const sheet = (k, title, sub, body, size = 'md') => `
<section class="sheetw ${size}" id="p-${k}" hidden aria-label="${title}">
  <header class="sh"><div><h3>${title}</h3><small>${sub}</small></div><button type="button" class="xb" data-close aria-label="Закрыть">${icon('x')}</button></header>
  <div class="sb">${body}</div>
</section>`;
const panels = [
  sheet('library', 'Библиотека', 'Найди песню и сразу играй', library, 'lg'),
  sheet('train', 'Тренировки', '12 режимов · уровень растёт с практикой', trainHtml, 'lg'),
  sheet('rooms', 'Комнаты', 'Играй вместе, по очереди или сразу', rooms, 'lg'),
  sheet('studio', 'Студия', 'Слушать, учить, править, записывать', studio, 'side'),
  sheet('sound', 'Звук', 'Инструменты, слои и эффекты', sound, 'md'),
  sheet('notepad', 'Блокнот', 'Буквенные ноты с автоплеером', notepad, 'md'),
  sheet('profile', 'Профиль', '', profile, 'md'),
  sheet('shop', 'Лавка', 'Украшения для ника, курсора и карточки', shop, 'lg'),
  sheet('settings', 'Настройки', 'Всё меняется сразу, без перезапуска', settingsBody, 'xl'),
].join('');

const css = fs.readFileSync(path.join(__dirname, 'style3.css'), 'utf8').replace('/*STARS_A*/', stars(180, .45)).replace('/*STARS_B*/', stars(60, .75));
const js = fs.readFileSync(path.join(__dirname, 'app3.js'), 'utf8');
const keyData = JSON.stringify(Object.fromEntries(Object.entries(keyX).map(([m, k]) => [m, [+k.x.toFixed(2), +k.w.toFixed(2), k.black ? 1 : 0]])));
const html = `<title>NeonKeys Prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap">
<style>${css}</style>
${sprite}
<div class="viewport"><div class="app" id="app" data-bg="stars" data-horizon="dawn" data-labels="auto" data-keyskin="glass" data-beam="trace" data-dock="on">
${scene}
${panels}
${gameHtml}
${winsHtml}
${pops}
${modalHtml}
<div class="hint" id="hint">${icon('keys')}<span>Играй на клавиатуре <kbd>1</kbd><kbd>q</kbd><kbd>w</kbd>… или мышью · <kbd>F1</kbd>–<kbd>F9</kbd> разделы · <kbd>Esc</kbd> закрыть</span></div>
<div class="toast" id="toast" role="status"></div>
</div></div>
<script>const KEYS=${keyData};const VP=${JSON.stringify(VP)};const STOPS=${JSON.stringify(STOPS)};
${js}</script>`;
fs.mkdirSync(path.join(__dirname, '..', 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'dist', 'index.html'), html);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
