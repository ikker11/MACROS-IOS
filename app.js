'use strict';
/* =====================================================================
   MacroFit · app principal
   Todo se guarda en el dispositivo (localStorage + copia en IndexedDB).
   ===================================================================== */

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = n => Math.round(n);
const r1 = n => Math.round(n * 10) / 10;
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => ymd(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const DAYN = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS3 = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shiftDay = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return ymd(d); };
function dateLabel(k) {
  if (k === todayKey()) return 'Hoy';
  if (k === shiftDay(todayKey(), -1)) return 'Ayer';
  const d = parseKey(k);
  return `${DAYN[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
const ANDROID = !!window.MacroFitAndroid;
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };

/* ---------- estado y persistencia ---------- */
const KEY = 'macrofit.v1';
let S = null;

function freshState() {
  return {
    v: 1,
    profile: { name: '', sex: 'm', age: '', cm: '', kg: '', act: 'light', goal: 'lose', rate: 'mod', diet: 'omni', done: false },
    logs: {}, workouts: {}, water: {}, weights: [], favs: [], custom: [], routine: null,
    coach: { chat: [], prefs: { likes: [], dislikes: [], injuries: [], diet: null, when: null, place: null, mins: null } },
    settings: { comp: 50, pin: null }
  };
}
function fillDefaults(target, def) {
  for (const k of Object.keys(def)) {
    if (target[k] === undefined) target[k] = JSON.parse(JSON.stringify(def[k]));
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && target[k] && typeof target[k] === 'object') fillDefaults(target[k], def[k]);
  }
  return target;
}
function migrate(s) { return fillDefaults(s || {}, freshState()); }

let idbTimer = null;
function idbOpen() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open('macrofit', 2);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv'); if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
}
async function idbPut(v) {
  try { const db = await idbOpen(); db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.stringify(v), KEY); } catch (e) { /* sin IndexedDB */ }
}
async function idbGet() {
  try {
    const db = await idbOpen();
    return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
  } catch (e) { return null; }
}
/* fotos propias de platos (IndexedDB, aparte de los datos) */
let PHOTOS = {};
async function loadPhotos() {
  try {
    const db = await idbOpen();
    await new Promise(res => {
      const st = db.transaction('photos').objectStore('photos'), q = st.openCursor();
      q.onsuccess = () => { const c = q.result; if (c) { PHOTOS[c.key] = c.value; c.continue(); } else res(); };
      q.onerror = () => res();
    });
  } catch (e) { /* */ }
}
async function photoPut(id, data) {
  if (data) PHOTOS[id] = data; else delete PHOTOS[id];
  try { const db = await idbOpen(); const st = db.transaction('photos', 'readwrite').objectStore('photos'); if (data) st.put(data, id); else st.delete(id); } catch (e) { /* */ }
}
function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = rej; img.src = rd.result;
    };
    rd.onerror = rej; rd.readAsDataURL(file);
  });
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* lleno o bloqueado */ }
  clearTimeout(idbTimer);
  idbTimer = setTimeout(() => idbPut(S), 400);
}
async function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { /* */ }
  if (!raw) raw = await idbGet();
  if (raw) { try { S = migrate(JSON.parse(raw)); } catch (e) { S = null; } }
  if (!S) S = freshState();
  save();
}

/* ---------- cálculo de macros (Mifflin-St Jeor) ---------- */
const ACT = {
  sed: { l: 'Sedentaria', d: 'Oficina, poco movimiento', f: 1.2 },
  light: { l: 'Ligera', d: 'De pie o caminas a ratos', f: 1.375 },
  mod: { l: 'Moderada', d: 'Muy activo/a en el día a día', f: 1.55 },
  high: { l: 'Alta', d: 'Trabajo físico exigente', f: 1.725 }
};
const GOALS = {
  lose: { l: 'Perder grasa', prot: 2.0, rates: { soft: ['Suave (−10%)', -0.10], mod: ['Moderado (−18%)', -0.18], fast: ['Rápido (−25%)', -0.25] } },
  maintain: { l: 'Mantener peso', prot: 1.6, rates: { mod: ['Mantener', 0] } },
  gain: { l: 'Ganar músculo', prot: 1.8, rates: { soft: ['Limpio (+8%)', 0.08], mod: ['Moderado (+12%)', 0.12], fast: ['Rápido (+18%)', 0.18] } },
  recomp: { l: 'Recomposición', prot: 2.2, rates: { mod: ['Recomposición (−5%)', -0.05] } }
};
const SLOTS = [
  { k: 'desayuno', l: 'Desayuno', e: '🌅', share: 0.25, type: 'desayuno' },
  { k: 'almuerzo', l: 'Almuerzo', e: '🍎', share: 0.10, type: 'snack' },
  { k: 'comida', l: 'Comida', e: '🍽️', share: 0.35, type: 'comida' },
  { k: 'merienda', l: 'Merienda', e: '🥪', share: 0.10, type: 'snack' },
  { k: 'cena', l: 'Cena', e: '🌙', share: 0.20, type: 'cena' }
];

function profileOk(p) { return num(p.age) >= 14 && num(p.age) <= 100 && num(p.cm) >= 120 && num(p.cm) <= 230 && num(p.kg) >= 30 && num(p.kg) <= 250; }

function calcPlan(pr) {
  if (!profileOk(pr)) return null;
  const kg = num(pr.kg), cm = num(pr.cm), age = num(pr.age);
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (pr.sex === 'm' ? 5 : -161);
  const tdee = bmr * ACT[pr.act].f;
  const g = GOALS[pr.goal] || GOALS.lose;
  const rkey = g.rates[pr.rate] ? pr.rate : Object.keys(g.rates)[0];
  const adj = g.rates[rkey][1];
  let kcal = tdee * (1 + adj);
  const floor = pr.sex === 'm' ? 1500 : 1200;
  let floored = false;
  if (kcal < floor) { kcal = floor; floored = true; }
  let p = Math.min(g.prot * kg, kcal * 0.4 / 4);
  let f = Math.max(0.8 * kg, 0.25 * kcal / 9);
  let c = (kcal - p * 4 - f * 9) / 4;
  if (c < 100) { c = 100; kcal = p * 4 + c * 4 + f * 9; }
  return {
    bmr: r0(bmr), tdee: r0(tdee), kcal: r0(kcal), p: r0(p), c: r0(c), f: r0(f), adj, floored,
    fiber: r0(kcal / 1000 * 14), water: Math.round(kg * 35 / 100) / 10, minor: age < 18
  };
}
const getPlan = () => (S.profile.done ? calcPlan(S.profile) : null);

/* ---------- datos del día ---------- */
const logOf = k => S.logs[k] || [];
const workoutsOf = k => S.workouts[k] || [];
function dayTotals(k) {
  return logOf(k).reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });
}
const burned = k => workoutsOf(k).reduce((a, w) => a + w.kcal, 0);
function budget(k) {
  const plan = getPlan();
  if (!plan) return null;
  const extra = burned(k) * S.settings.comp / 100;
  return { kcal: plan.kcal + extra, p: plan.p, c: plan.c + extra / 4, f: plan.f, extra };
}
function remaining(k) {
  const b = budget(k); if (!b) return null;
  const t = dayTotals(k);
  return { kcal: b.kcal - t.kcal, p: b.p - t.p, c: b.c - t.c, f: b.f - t.f };
}
function slotFor(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 10.5) return 'desayuno';
  if (h >= 10.5 && h < 12.5) return 'almuerzo';
  if (h >= 12.5 && h < 16.5) return 'comida';
  if (h >= 16.5 && h < 19.5) return 'merienda';
  return 'cena';
}
const slotInfo = k => SLOTS.find(s => s.k === k) || SLOTS[2];
const allFoods = () => FOODS.concat(S.custom.map(c => ({ ...c, cat: 'mine', emoji: '⭐' })));
const foodById = id => allFoods().find(f => f.id === id);
const gramsMacros = (f, g) => ({ kcal: f.kcal * g / 100, p: f.p * g / 100, c: f.c * g / 100, f: f.f * g / 100 });

/* ---------- gráficos ---------- */
function ringSVG(eaten, total) {
  const R = 74, C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(eaten / total, 1) : 0;
  const left = total - eaten;
  return `<svg class="ring" viewBox="0 0 180 180" role="img" aria-label="Calorías restantes">
    <circle class="ring-bg" cx="90" cy="90" r="${R}"/>
    <circle class="ring-fg ${left < 0 ? 'over' : ''}" cx="90" cy="90" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}" transform="rotate(-90 90 90)"/>
    <text class="ring-big ${left < 0 ? 'neg' : ''}" x="90" y="92" text-anchor="middle" ${left < 0 ? 'style="fill:var(--red)"' : ''}>${r0(Math.abs(left))}</text>
    <text class="ring-lbl" x="90" y="112" text-anchor="middle">${left < 0 ? 'kcal de más' : 'kcal restantes'}</text>
  </svg>`;
}
function macroBar(label, color, eaten, goal) {
  const left = goal - eaten;
  const pct = goal > 0 ? Math.min(eaten / goal, 1) * 100 : 0;
  return `<div class="mb">
    <div class="mb-top"><span class="dot" style="background:${color}"></span><b>${label}</b>
    <span class="mb-left ${left < 0 ? 'neg' : ''}">${left >= 0 ? r0(left) + ' g restantes' : r0(-left) + ' g de más'}</span></div>
    <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
    <div class="mb-sub">${r0(eaten)} / ${r0(goal)} g</div></div>`;
}
function weekChart() {
  const plan = getPlan();
  const keys = []; for (let i = 6; i >= 0; i--) keys.push(shiftDay(todayKey(), -i));
  const vals = keys.map(k => dayTotals(k).kcal);
  const targets = keys.map(k => (budget(k) || { kcal: 0 }).kcal);
  const max = Math.max(1, ...vals, ...targets) * 1.08;
  const H = 96;
  const tline = plan ? H - (plan.kcal / max) * H : null;
  const cols = keys.map((k, i) => {
    const v = vals[i], h = v > 0 ? Math.max(4, v / max * H) : 3;
    const over = targets[i] > 0 && v > targets[i] * 1.05;
    return `<div class="wcol"><i class="${v === 0 ? 'none' : over ? 'over' : ''}" style="height:${h}px" title="${r0(v)} kcal"></i><span>${DAYS3[parseKey(k).getDay()]}</span></div>`;
  }).join('');
  const logged = vals.filter(v => v > 0);
  const avg = logged.length ? r0(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  return `<div class="wbars">${tline !== null ? `<div class="wline" style="top:${tline + 6}px"></div>` : ''}${cols}</div>
    <p class="small muted" style="margin-top:8px">${logged.length ? `Media de los días registrados: <b>${avg} kcal</b>${plan ? ` · objetivo ${plan.kcal}` : ''}` : 'Registra comidas para ver tu semana.'}</p>`;
}
function weightChart() {
  const w = S.weights.slice(-40);
  if (w.length < 2) return '<p class="small muted">Anota tu peso al menos 2 veces para ver la gráfica.</p>';
  const W = 320, H = 130, pl = 28, pr = 8, pt = 10, pb = 20;
  const vals = w.map(x => x.kg);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mx - mn < 1) { mn -= .5; mx += .5; }
  const X = i => pl + (W - pl - pr) * (w.length === 1 ? 0 : i / (w.length - 1));
  const Y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  const pts = w.map((x, i) => `${X(i).toFixed(1)},${Y(x.kg).toFixed(1)}`).join(' ');
  const dots = w.map((x, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.kg).toFixed(1)}" r="3" fill="var(--acc)"/>`).join('');
  return `<svg class="wsvg" viewBox="0 0 ${W} ${H}">
    <line x1="${pl}" x2="${W - pr}" y1="${Y(mx)}" y2="${Y(mx)}" stroke="var(--sep)"/><line x1="${pl}" x2="${W - pr}" y1="${Y(mn)}" y2="${Y(mn)}" stroke="var(--sep)"/>
    <text x="2" y="${Y(mx) + 3}">${r1(mx)}</text><text x="2" y="${Y(mn) + 3}">${r1(mn)}</text>
    <polyline points="${pts}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}
    <text x="${pl}" y="${H - 4}">${w[0].d.slice(5).replace('-', '/')}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${w[w.length - 1].d.slice(5).replace('-', '/')}</text></svg>`;
}

/* ---------- navegación ---------- */
const TABS = [
  { k: 'hoy', l: 'Hoy', i: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>' },
  { k: 'rest', l: 'Restaurante', i: '<path d="M7 3v8M4 3v5a3 3 0 0 0 3 3 3 3 0 0 0 3-3V3M7 11v10"/><path d="M17 3c-2 2-3 4.5-3 7s1 3 3 3v8"/>' },
  { k: 'dep', l: 'Deporte', i: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>' },
  { k: 'coach', l: 'Coach', i: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>' },
  { k: 'perfil', l: 'Perfil', i: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>' }
];
let tab = 'hoy', curDate = todayKey();
const ui = { restType: 'auto', restTag: '', depSeg: 'rutina', typing: false };

function renderTabs() {
  $('#tabbar').innerHTML = TABS.map(t => `<button class="tab ${tab === t.k ? 'on' : ''}" data-act="tab" data-k="${t.k}"><svg viewBox="0 0 24 24">${t.i}</svg>${t.l}</button>`).join('');
}
function render() {
  renderTabs();
  const v = { hoy: viewHoy, rest: viewRest, dep: viewDep, coach: viewCoach, perfil: viewPerfil }[tab]();
  $('#app').innerHTML = `<div class="view">${v}</div>` + (tab === 'hoy' ? `<button class="fab" data-act="addFood"><span style="font-size:20px;line-height:1">＋</span> Añadir alimento</button>` : '');
  if (tab === 'coach') { $('#app').insertAdjacentHTML('beforeend', composerHTML()); scrollChat(); }
}
function setTab(k) { tab = k; window.scrollTo(0, 0); render(); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}
function openSheet(html) { $('#sheet-body').innerHTML = html; $$('#sheet-body .chips').forEach(c => { const on = c.querySelector('.chip.on'); if (on) c.scrollLeft = Math.max(0, on.offsetLeft - 24); }); $('#sheet').classList.add('open'); $('#sheet').setAttribute('aria-hidden', 'false'); document.body.classList.add('noscroll'); }
function closeSheet() { $('#sheet').classList.remove('open'); $('#sheet').setAttribute('aria-hidden', 'true'); document.body.classList.remove('noscroll'); addCtx = null; }

/* =====================================================================
   HOY
   ===================================================================== */
function viewHoy() {
  const k = curDate, plan = getPlan(), t = dayTotals(k), b = budget(k), bd = burned(k);
  const isToday = k === todayKey();
  let h = `<div class="nav"><div><div class="large">${S.profile.name ? 'Hola, ' + esc(S.profile.name.split(' ')[0]) : 'Hoy'}</div><div class="sub">Tu control de macros</div></div>
    <div class="daynav"><button data-act="dayPrev" aria-label="Día anterior">‹</button><span>${dateLabel(k)}</span><button data-act="dayNext" ${isToday ? 'disabled' : ''} aria-label="Día siguiente">›</button></div></div>`;

  if (!plan) {
    h += `<div class="card cta"><h2 style="font-size:22px">Calcula tus macros</h2><p>Dime tus datos y tu objetivo (perder grasa, mantener o ganar músculo) y calculo tus calorías y macros con la fórmula Mifflin-St Jeor.</p><button class="btn white" data-act="tab" data-k="perfil">Completar mi perfil</button></div>`;
  } else {
    h += `<div class="card"><div class="ringwrap">${ringSVG(t.kcal, b.kcal)}<div class="stats">
      <div class="stat"><b>${r0(b.kcal)}</b><span>Objetivo kcal${b.extra > 0 ? ` (+${r0(b.extra)} por deporte)` : ''}</span></div>
      <div class="stat"><b>${r0(t.kcal)}</b><span>Consumidas</span></div>
      <div class="stat"><b>${r0(bd)}</b><span>Gastadas en deporte</span></div></div></div>
      ${macroBar('Proteína', 'var(--p)', t.p, b.p)}${macroBar('Hidratos', 'var(--c)', t.c, b.c)}${macroBar('Grasas', 'var(--f)', t.f, b.f)}</div>`;
  }

  // comidas por franjas
  const log = logOf(k);
  SLOTS.forEach(s => {
    const items = log.filter(e => e.slot === s.k);
    const kc = items.reduce((a, e) => a + e.kcal, 0);
    h += `<div class="section-h"><h2>${s.e} ${s.l}</h2><div class="row"><span class="k">${items.length ? r0(kc) + ' kcal' : ''}</span><button class="plus" data-act="addFood" data-slot="${s.k}" aria-label="Añadir a ${s.l}">+</button></div></div>`;
    h += items.length ? `<div class="list">${items.map(e => `<button class="item" data-act="editEntry" data-id="${e.id}"><div class="em">${esc(e.emoji || '🍽️')}</div><div class="grow"><div class="t">${esc(e.name)}</div><div class="s">${r0(e.g)} g · P ${r0(e.p)} · H ${r0(e.c)} · G ${r0(e.f)}</div></div><div class="r"><b style="color:var(--txt)">${r0(e.kcal)}</b><br>kcal</div></button>`).join('')}</div>` : `<div class="list"><div class="empty">Nada registrado todavía</div></div>`;
  });

  // agua
  const glasses = S.water[k] || 0, goalG = plan ? Math.max(6, Math.round(plan.water * 4)) : 8;
  h += `<div class="card"><h3>Agua</h3><div class="water"><div><b style="font-size:22px">${(glasses * 0.25).toFixed(2).replace(/\.?0+$/, '')} L</b><span class="muted small"> de ${plan ? plan.water : 2} L</span></div><div class="row"><button class="btn sm sec" data-act="water" data-d="-1">−</button><button class="btn sm ghost" data-act="water" data-d="1">+ vaso</button></div></div>
    <div class="glasses">${Array.from({ length: Math.max(goalG, glasses) }, (_, i) => `<span class="${i < glasses ? '' : 'off'}">💧</span>`).join('')}</div></div>`;

  h += `<div class="card"><h3>Últimos 7 días</h3>${weekChart()}</div>`;
  return h;
}

/* ---------- añadir / editar alimento ---------- */
let addCtx = null;
function openAdd(slot) {
  addCtx = { slot: slot || slotFor(new Date()), auto: !slot, cat: 'all', q: '', food: null, edit: null };
  renderAddList();
}
function recentFoods() {
  const seen = new Set(), out = [];
  const keys = Object.keys(S.logs).sort().reverse().slice(0, 14);
  for (const k of keys) for (const e of S.logs[k].slice().reverse()) {
    if (e.fid && !seen.has(e.fid) && foodById(e.fid)) { seen.add(e.fid); out.push(foodById(e.fid)); if (out.length >= 20) return out; }
  }
  return out;
}
function foodMatches() {
  const q = norm(addCtx.q.trim());
  let list = allFoods();
  if (addCtx.cat === 'fav') list = list.filter(f => S.favs.includes(f.id));
  else if (addCtx.cat === 'rec') list = recentFoods();
  else if (addCtx.cat === 'mine') list = list.filter(f => f.cat === 'mine');
  else if (addCtx.cat !== 'all') list = list.filter(f => f.cat === addCtx.cat);
  if (q) { const toks = q.split(/\s+/); list = allFoods().filter(f => { const n = norm(f.name); return toks.every(t => n.includes(t)); }); }
  return list;
}
function foodRows(list) {
  if (!list.length) return '<div class="empty">No hay resultados. Puedes crear tu propio alimento abajo.</div>';
  return list.slice(0, 80).map(f => `<button class="item" data-act="pickFood" data-id="${f.id}"><div class="em">${f.emoji}</div><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">por 100 g · P ${f.p} · H ${f.c} · G ${f.f}</div></div><div class="r"><b style="color:var(--txt)">${r0(f.kcal)}</b><br>kcal</div></button>`).join('');
}
function renderAddList() {
  const cats = [['all', 'Todos'], ['rec', '🕘 Recientes'], ['fav', '⭐ Favoritos'], ...Object.entries(CATS).map(([k, v]) => [k, v.l])];
  if (S.custom.length) cats.splice(3, 0, ['mine', 'Mis alimentos']);
  openSheet(`<div class="sheet-h"><h2>Añadir alimento</h2><button class="x" data-act="closeSheet">✕</button></div>
    <div class="after" style="margin-top:0">${slotInfo(addCtx.slot).e} Se añadirá a <b>${slotInfo(addCtx.slot).l}</b>${addCtx.auto ? ' (detectado por la hora)' : ''}</div>
    <div class="search"><span>🔍</span><input id="addq" type="search" placeholder="Buscar alimento…" value="${esc(addCtx.q)}" autocomplete="off"></div>
    <div class="chips" id="addcats">${cats.map(([k, l]) => `<button class="chip ${addCtx.cat === k ? 'on' : ''}" data-act="addCat" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="list" id="addlist">${foodRows(foodMatches())}</div>
    <button class="btn ghost" data-act="newFood">＋ Crear alimento propio</button>`);
}
function updateAddList() { const el = $('#addlist'); if (el) el.innerHTML = foodRows(foodMatches()); }

function qtyGrams() { const q = addCtx.qty; return q.mode === 'u' && addCtx.food.ug ? q.val * addCtx.food.ug : q.val; }
function openFoodDetail(food, edit) {
  addCtx = addCtx || { slot: slotFor(new Date()), auto: true, cat: 'all', q: '' };
  addCtx.food = food; addCtx.edit = edit || null;
  const g = edit ? edit.g : (food.ug || 100);
  addCtx.qty = { mode: 'g', val: r1(g) };
  if (!edit && food.ug) addCtx.qty = { mode: 'u', val: 1 };
  if (edit) addCtx.slot = edit.slot;
  renderFoodDetail();
}
function renderFoodDetail() {
  const f = addCtx.food, q = addCtx.qty, edit = addCtx.edit;
  const fav = S.favs.includes(f.id);
  openSheet(`<div class="sheet-h"><button class="x" data-act="${edit ? 'closeSheet' : 'backAdd'}" aria-label="Atrás">‹</button><div class="grow" style="text-align:center"><div class="bold">${edit ? 'Editar' : 'Añadir'}</div></div>${f.cat === 'mine' && !edit ? '<span style="width:30px"></span>' : `<button class="x" data-act="toggleFav" style="color:${fav ? '#ffb100' : 'var(--txt2)'}">${fav ? '★' : '☆'}</button>`}</div>
    <div class="row"><div class="big-emoji">${f.emoji}</div><div class="grow"><div class="bold" style="font-size:20px;line-height:1.2">${esc(f.name)}</div><div class="small muted">por 100 g: ${r0(f.kcal)} kcal · P ${f.p} · H ${f.c} · G ${f.f}</div></div></div>
    ${f.ug ? `<div class="seg" style="margin-top:14px"><button class="${q.mode === 'g' ? 'on' : ''}" data-act="qmode" data-m="g">Gramos</button><button class="${q.mode === 'u' ? 'on' : ''}" data-act="qmode" data-m="u">${esc(f.unit)} (${f.ug} g)</button></div>` : '<div style="height:12px"></div>'}
    <div class="stepper"><button data-act="qstep" data-d="-1">−</button><input id="qty" inputmode="decimal" value="${q.val}" aria-label="Cantidad"><button data-act="qstep" data-d="1">+</button></div>
    <div class="small muted" id="qtyhelp" style="text-align:center">${qtyHelp()}</div>
    <div class="macrobox" id="mbox">${macroBoxHTML()}</div>
    <div id="afterbox">${afterHTML()}</div>
    <div class="small muted" style="margin:4px 2px 6px">Franja${addCtx.auto && !edit ? ' (detectada por la hora)' : ''}</div>
    <div class="chips" style="margin-bottom:6px">${SLOTS.map(s => `<button class="chip ${addCtx.slot === s.k ? 'on' : ''}" data-act="slot" data-k="${s.k}">${s.e} ${s.l}</button>`).join('')}</div>
    <button class="btn" data-act="${edit ? 'saveEdit' : 'confirmAdd'}">${edit ? 'Guardar cambios' : 'Añadir a ' + slotInfo(addCtx.slot).l}</button>
    ${edit ? '<div style="height:10px"></div><button class="btn danger" data-act="delEntry">Eliminar</button>' : ''}`);
}
function qtyHelp() { const g = qtyGrams(); return addCtx.qty.mode === 'u' ? `= ${r0(g)} g` : (addCtx.food.ug ? `≈ ${r1(g / addCtx.food.ug)} ${addCtx.food.unit}` : ''); }
function macroBoxHTML() {
  const m = gramsMacros(addCtx.food, qtyGrams());
  return `<div class="mbx"><b>${r0(m.kcal)}</b><span>kcal</span></div><div class="mbx"><b style="color:var(--p)">${r1(m.p)}</b><span>Prot</span></div><div class="mbx"><b style="color:var(--c)">${r1(m.c)}</b><span>Hidr</span></div><div class="mbx"><b style="color:var(--f)">${r1(m.f)}</b><span>Grasa</span></div>`;
}
function afterHTML() {
  const rem = remaining(curDate); if (!rem) return '';
  const m = gramsMacros(addCtx.food, qtyGrams());
  let r = { kcal: rem.kcal - m.kcal, p: rem.p - m.p, c: rem.c - m.c, f: rem.f - m.f };
  if (addCtx.edit) { const e = addCtx.edit; r = { kcal: r.kcal + e.kcal, p: r.p + e.p, c: r.c + e.c, f: r.f + e.f }; }
  const bad = r.kcal < 0;
  return `<div class="after ${bad ? 'bad' : ''}">${bad ? `Te pasarías ${r0(-r.kcal)} kcal` : `Te quedarán ${r0(r.kcal)} kcal`} · P ${r0(r.p)} · H ${r0(r.c)} · G ${r0(r.f)} g</div>`;
}
function refreshDetail() {
  $('#qtyhelp').textContent = qtyHelp(); $('#mbox').innerHTML = macroBoxHTML(); $('#afterbox').innerHTML = afterHTML();
}
function makeEntry() {
  const f = addCtx.food, g = qtyGrams(), m = gramsMacros(f, g), now = new Date();
  return { id: uid(), t: curDate === todayKey() ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '12:00', slot: addCtx.slot, name: f.name, g: r1(g), kcal: r1(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fid: f.id, emoji: f.emoji };
}
function confirmAdd() {
  if (qtyGrams() <= 0) return toast('Indica una cantidad');
  const e = makeEntry();
  (S.logs[curDate] = S.logs[curDate] || []).push(e);
  save(); const s = slotInfo(e.slot); closeSheet(); render(); toast(`${s.e} Añadido a ${s.l}`);
}
function saveEdit() {
  const ed = addCtx.edit, list = S.logs[curDate] || [], i = list.findIndex(x => x.id === ed.id);
  if (i < 0 || qtyGrams() <= 0) return;
  const n = makeEntry(); n.id = ed.id; n.t = ed.t; list[i] = n; save(); closeSheet(); render(); toast('Cambios guardados');
}
function delEntry() {
  const ed = addCtx.edit; S.logs[curDate] = (S.logs[curDate] || []).filter(x => x.id !== ed.id);
  save(); closeSheet(); render(); toast('Eliminado');
}
function newFoodSheet() {
  openSheet(`<div class="sheet-h"><button class="x" data-act="backAdd">‹</button><div class="bold">Alimento propio</div><span style="width:30px"></span></div>
    <div class="form"><div class="field"><label>Nombre</label><input id="nf-n" placeholder="Ej. Mi pan favorito" maxlength="60"></div>
    <div class="field"><label>Calorías / 100 g</label><input id="nf-k" type="number" inputmode="decimal" placeholder="0"></div>
    <div class="field"><label>Proteína / 100 g</label><input id="nf-p" type="number" inputmode="decimal" placeholder="0"></div>
    <div class="field"><label>Hidratos / 100 g</label><input id="nf-c" type="number" inputmode="decimal" placeholder="0"></div>
    <div class="field"><label>Grasas / 100 g</label><input id="nf-f" type="number" inputmode="decimal" placeholder="0"></div>
    <div class="field"><label>Peso por unidad (g)</label><input id="nf-u" type="number" inputmode="decimal" placeholder="opcional"></div></div>
    <button class="btn" data-act="saveFood">Guardar alimento</button>`);
}
function saveFood() {
  const name = $('#nf-n').value.trim(); if (!name) return toast('Ponle un nombre');
  const f = { id: 'u' + uid(), name, kcal: num($('#nf-k').value), p: num($('#nf-p').value), c: num($('#nf-c').value), f: num($('#nf-f').value), unit: null, ug: null };
  const u = num($('#nf-u').value); if (u > 0) { f.unit = 'unidad'; f.ug = u; }
  if (f.kcal <= 0 && f.p + f.c + f.f > 0) f.kcal = r0(f.p * 4 + f.c * 4 + f.f * 9);
  S.custom.push(f); save(); toast('Alimento creado');
  addCtx = addCtx || { slot: slotFor(new Date()), auto: true, cat: 'all', q: '' };
  openFoodDetail({ ...f, cat: 'mine', emoji: '⭐' });
}

/* =====================================================================
   RESTAURANTE
   ===================================================================== */
const DISH_TYPES = [['auto', '✨ Para ahora'], ['all', 'Todos'], ['desayuno', 'Desayunos'], ['snack', 'Snacks'], ['comida', 'Comidas'], ['cena', 'Cenas']];
const DISH_TAGS = [['', 'Cualquiera'], ['hp', 'Alta proteína'], ['lc', 'Bajo en hidratos'], ['veg', 'Vegetariano'], ['vgn', 'Vegano']];
const typeOfSlot = k => slotInfo(k).type;

function dishScale(d, kcalTarget) {
  const s = kcalTarget / d.m.kcal;
  return Math.max(0.5, Math.min(2, Math.round(s * 4) / 4));
}
function dishTarget(type) {
  const plan = getPlan(); if (!plan) return null;
  const share = type === 'desayuno' ? 0.25 : type === 'snack' ? 0.12 : type === 'comida' ? 0.35 : 0.25;
  const rem = remaining(todayKey());
  let kcal = plan.kcal * share;
  if (rem && rem.kcal > 0) kcal = Math.min(kcal, Math.max(rem.kcal, plan.kcal * 0.08));
  return { kcal, p: plan.p * share, c: plan.c * share, f: plan.f * share };
}
function dishFit(d, scale) {
  const tg = dishTarget(d.type); if (!tg) return 0.5;
  const m = { kcal: d.m.kcal * scale, p: d.m.p * scale, c: d.m.c * scale, f: d.m.f * scale };
  const err = Math.abs(m.kcal - tg.kcal) / tg.kcal * 0.45 + Math.max(0, tg.p - m.p) / tg.p * 0.4 + Math.abs(m.f - tg.f) / Math.max(tg.f, 1) * 0.1 + Math.abs(m.c - tg.c) / Math.max(tg.c, 1) * 0.05;
  return Math.max(0, 1 - err);
}
function dishAllowed(d) {
  const diet = S.profile.diet;
  if (diet === 'veg' && !(d.tags.includes('veg') || d.tags.includes('vgn'))) return false;
  if (diet === 'vgn' && !d.tags.includes('vgn')) return false;
  const bad = S.coach.prefs.dislikes.map(x => norm(x));
  if (bad.length) { const hay = norm(d.name + ' ' + d.items.map(i => i.food.name).join(' ')); if (bad.some(b => b.length > 2 && hay.includes(b))) return false; }
  return true;
}
function dishList() {
  let type = ui.restType;
  if (type === 'auto') type = typeOfSlot(slotFor(new Date()));
  let list = DISHES.filter(dishAllowed);
  if (type !== 'all') list = list.filter(d => d.type === type);
  if (ui.restTag) list = list.filter(d => d.tags.includes(ui.restTag));
  const plan = getPlan();
  const rows = list.map(d => { const tg = dishTarget(d.type); const sc = tg ? dishScale(d, tg.kcal) : 1; return { d, sc, fit: plan ? dishFit(d, sc) : 0 }; });
  if (plan) rows.sort((a, b) => b.fit - a.fit);
  return { rows, type };
}
function viewRest() {
  const plan = getPlan(), { rows, type } = dishList();
  const rem = remaining(todayKey());
  let h = `<div class="nav"><div><div class="large">Restaurante</div><div class="sub">Platos pensados para tus macros, con receta</div></div></div>`;
  if (!plan) h += `<div class="card cta"><p style="margin:0 0 10px">Completa tu perfil y te ordeno los platos según lo que te falta por comer.</p><button class="btn white" data-act="tab" data-k="perfil">Ir a mi perfil</button></div>`;
  else if (rem) h += `<div class="after" style="margin-top:0">Hoy te quedan <b>${r0(rem.kcal)} kcal</b> · P ${r0(rem.p)} · H ${r0(rem.c)} · G ${r0(rem.f)} g</div>`;
  h += `<div class="chips">${DISH_TYPES.map(([k, l]) => `<button class="chip ${ui.restType === k ? 'on' : ''}" data-act="restType" data-k="${k}">${l}</button>`).join('')}</div>`;
  h += `<div class="chips">${DISH_TAGS.map(([k, l]) => `<button class="chip ${ui.restTag === k ? 'on' : ''}" data-act="restTag" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (ui.restType === 'auto') h += `<p class="small muted" style="margin:-2px 4px 10px">Mostrando ${type === 'snack' ? 'snacks' : type + 's'} para esta franja horaria.</p>`;
  h += rows.length ? `<div class="list">${rows.map(({ d, sc, fit }) => {
    const m = { kcal: d.m.kcal * sc, p: d.m.p * sc, c: d.m.c * sc, f: d.m.f * sc };
    return `<button class="item" data-act="dish" data-id="${d.id}"><div class="em xl">${dishThumb(d)}</div><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${r0(m.kcal)} kcal · P ${r0(m.p)} · H ${r0(m.c)} · G ${r0(m.f)}${sc !== 1 ? ` · ración ×${sc}` : ''}</div><div style="margin-top:4px">${plan && fit > 0.78 ? '<span class="pill">Encaja contigo</span>' : ''}${d.tags.includes('hp') ? '<span class="pill gray">Alta proteína</span>' : ''}<span class="pill gray">${d.min} min</span></div></div></button>`;
  }).join('')}</div>` : '<div class="list"><div class="empty">No hay platos con ese filtro.</div></div>';
  return h;
}
/* ---------- ilustración de cada plato (emplatado visto desde arriba) ---------- */
const PLATE_BG = { desayuno: ['#ffe7c2', '#ffcf8f'], snack: ['#dff3dc', '#b9e3b3'], comida: ['#e2ebff', '#bcd0ff'], cena: ['#ece3ff', '#cfbdfd'] };
const PLATE_POS = [[-14, -8, 60], [30, -27, 42], [31, 26, 42], [-22, 39, 36], [-37, -35, 31], [46, 2, 29]];
function plateSVG(d, cls) {
  const [c1, c2] = PLATE_BG[d.type] || PLATE_BG.comida;
  const small = f => f.cat === 'otr' || /Aceite|Ajo|Miel|Semillas|Cacao|Lim[oó]n/.test(f.name);
  const seen = new Set();
  const items = d.items.filter(i => !small(i.food) || i.g >= 60).sort((a, b) => b.g - a.g)
    .filter(i => { if (seen.has(i.food.emoji)) return false; seen.add(i.food.emoji); return true; }).slice(0, 6);
  const oil = d.items.some(i => /Aceite/.test(i.food.name));
  const gid = 'pg' + d.id;
  const food = items.map((it, k) => { const [x, y, sz] = PLATE_POS[k]; return `<text x="${100 + x}" y="${100 + y}" font-size="${sz}" text-anchor="middle" dominant-baseline="central">${it.food.emoji}</text>`; }).join('');
  const drizzle = oil ? '<g fill="#e3b505" opacity=".75"><ellipse cx="62" cy="128" rx="5" ry="2.6"/><ellipse cx="74" cy="134" rx="3.4" ry="1.8"/><ellipse cx="136" cy="70" rx="4" ry="2"/></g>' : '';
  return `<svg class="${cls || ''}" viewBox="${cls === 'thumb' ? '22 22 156 156' : '0 0 200 200'}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustración de ${esc(d.name)}"><defs>
    <linearGradient id="${gid}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <radialGradient id="${gid}r" cx=".5" cy=".45" r=".55"><stop offset=".78" stop-color="#ffffff"/><stop offset="1" stop-color="#e4e4ea"/></radialGradient></defs>
    <rect width="200" height="200" fill="url(#${gid}b)"/>
    <circle cx="103" cy="106" r="86" fill="rgba(0,0,0,.10)"/><circle cx="100" cy="100" r="86" fill="url(#${gid}r)"/>
    <circle cx="100" cy="100" r="68" fill="#fff" stroke="#ececf1" stroke-width="1.5"/>${food}${drizzle}</svg>`;
}
function dishThumb(d) { return PHOTOS[d.id] ? `<img src="${PHOTOS[d.id]}" alt="">` : plateSVG(d, 'thumb'); }
const photosURL = d => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(d.name);

let dishCtx = null;
function openDish(id) {
  const d = DISHES.find(x => x.id === id); const tg = dishTarget(d.type);
  dishCtx = { d, scale: tg ? dishScale(d, tg.kcal) : 1, slot: slotFor(new Date()) };
  renderDish();
}
function renderDish() {
  const { d, scale, slot } = dishCtx, m = { kcal: d.m.kcal * scale, p: d.m.p * scale, c: d.m.c * scale, f: d.m.f * scale };
  const rem = remaining(todayKey());
  const left = rem ? rem.kcal - m.kcal : null;
  const ph = PHOTOS[d.id];
  openSheet(`<div class="sheet-h"><div class="bold grow">${{ desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', cena: 'Cena' }[d.type]}</div><button class="x" data-act="closeSheet">✕</button></div>
    <div class="hero">${ph ? `<img src="${ph}" alt="Tu foto de ${esc(d.name)}">` : plateSVG(d)}<span class="exlbl">${ph ? 'Tu foto' : 'Ilustración'}</span></div>
    <div class="row" style="margin:10px 0 14px;gap:8px">
      <label class="btn sm onbg" style="flex:1;text-align:center;cursor:pointer;white-space:nowrap">📷 ${ph ? 'Cambiar foto' : 'Añadir mi foto'}<input type="file" accept="image/*" id="dish-photo" class="hidden"></label>
      ${ph ? '<button class="btn sm danger" data-act="dishPhotoDel">Quitar</button>' : ''}
      <a class="btn sm onbg" style="flex:1;text-align:center;white-space:nowrap" href="${photosURL(d)}" target="_blank" rel="noopener" data-ext>🔎 Fotos reales</a></div>
    <h2 style="font-size:24px;letter-spacing:-.4px;line-height:1.2">${esc(d.name)}</h2>
    <div style="margin:8px 0 2px">${d.tags.includes('hp') ? '<span class="pill">Alta proteína</span>' : ''}${d.tags.includes('lc') ? '<span class="pill">Bajo en hidratos</span>' : ''}${d.tags.includes('vgn') ? '<span class="pill">Vegano</span>' : d.tags.includes('veg') ? '<span class="pill">Vegetariano</span>' : ''}<span class="pill gray">⏱ ${d.min} min</span></div>
    <div class="macrobox"><div class="mbx"><b>${r0(m.kcal)}</b><span>kcal</span></div><div class="mbx"><b style="color:var(--p)">${r0(m.p)}</b><span>Prot</span></div><div class="mbx"><b style="color:var(--c)">${r0(m.c)}</b><span>Hidr</span></div><div class="mbx"><b style="color:var(--f)">${r0(m.f)}</b><span>Grasa</span></div></div>
    ${left !== null ? `<div class="after ${left < 0 ? 'bad' : ''}">${left < 0 ? `Te pasarías ${r0(-left)} kcal hoy` : `Después te quedarían ${r0(left)} kcal hoy`}</div>` : ''}
    <div class="row between" style="margin:6px 0"><div><div class="bold">Ración</div><div class="small muted">Ajusta el tamaño a tus macros</div></div>
      <div class="row"><button class="btn sm sec" data-act="dscale" data-d="-0.25">−</button><b style="min-width:42px;text-align:center">×${scale}</b><button class="btn sm sec" data-act="dscale" data-d="0.25">+</button></div></div>
    <div class="section-h"><h2 style="font-size:18px">Ingredientes</h2></div>
    <div class="list">${d.items.map(({ food, g }) => `<div class="item"><div class="em">${food.emoji}</div><div class="grow"><div class="t">${esc(food.name)}</div></div><div class="r"><b style="color:var(--txt)">${r0(g * scale)} g</b></div></div>`).join('')}</div>
    <div class="section-h"><h2 style="font-size:18px">Receta</h2></div>
    <ol class="steps">${d.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="small muted" style="margin:4px 2px 6px">Añadir a</div>
    <div class="chips" style="margin-bottom:6px">${SLOTS.map(s => `<button class="chip ${slot === s.k ? 'on' : ''}" data-act="dslot" data-k="${s.k}">${s.e} ${s.l}</button>`).join('')}</div>
    <button class="btn" data-act="dishAdd">Añadir a ${slotInfo(slot).l}</button>`);
}
function dishAdd() {
  const { d, scale, slot } = dishCtx, now = new Date();
  const e = { id: uid(), t: `${pad(now.getHours())}:${pad(now.getMinutes())}`, slot, name: d.name + (scale !== 1 ? ` (×${scale})` : ''), g: r0(d.m.g * scale), kcal: r1(d.m.kcal * scale), p: r1(d.m.p * scale), c: r1(d.m.c * scale), f: r1(d.m.f * scale), emoji: d.emoji, dish: d.id };
  (S.logs[todayKey()] = S.logs[todayKey()] || []).push(e);
  curDate = todayKey(); save(); closeSheet(); toast(`${slotInfo(slot).e} Añadido a ${slotInfo(slot).l}`); if (tab === 'hoy') render();
}

/* =====================================================================
   DEPORTE
   ===================================================================== */
const netKcal = (met, min) => Math.max(0, (met - 1) * num(S.profile.kg || 70) * min / 60);
function viewDep() {
  let h = `<div class="nav"><div><div class="large">Deporte</div><div class="sub">Rutinas a tu medida y gasto calórico</div></div></div>
    <div class="seg">${[['rutina', 'Mi rutina'], ['ejer', 'Ejercicios'], ['reg', 'Registrar'], ['hist', 'Historial']].map(([k, l]) => `<button class="${ui.depSeg === k ? 'on' : ''}" data-act="depSeg" data-k="${k}">${l}</button>`).join('')}</div>`;
  if (ui.depSeg === 'rutina') h += depRoutine();
  else if (ui.depSeg === 'ejer') h += depLibrary();
  else if (ui.depSeg === 'reg') h += depLog();
  else h += depHistory();
  return h;
}
const cfgDefault = () => ({ days: 3, level: 'beg', place: S.coach.prefs.place === 'g' ? 'g' : 'c', mins: S.coach.prefs.mins || 45 });
function depRoutine() {
  const r = S.routine, cfg = (r && r.cfg) || cfgDefault();
  let h = `<div class="form">
    <div class="field"><label>Días por semana</label><select data-cfg="days">${[2, 3, 4, 5, 6].map(n => `<option value="${n}" ${cfg.days === n ? 'selected' : ''}>${n} días</option>`).join('')}</select></div>
    <div class="field"><label>Nivel</label><select data-cfg="level">${[['beg', 'Principiante'], ['mid', 'Intermedio'], ['adv', 'Avanzado']].map(([k, l]) => `<option value="${k}" ${cfg.level === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Dónde entrenas</label><select data-cfg="place"><option value="c" ${cfg.place === 'c' ? 'selected' : ''}>En casa</option><option value="g" ${cfg.place === 'g' ? 'selected' : ''}>Gimnasio</option></select></div>
    <div class="field"><label>Tiempo por sesión</label><select data-cfg="mins">${[30, 45, 60, 75, 90].map(n => `<option value="${n}" ${cfg.mins === n ? 'selected' : ''}>${n} min</option>`).join('')}</select></div></div>
    <button class="btn" data-act="genRoutine" style="margin-bottom:14px">${r ? 'Generar una rutina nueva' : 'Generar mi rutina'}</button>`;
  if (!r) {
    h += `<div class="card"><p class="muted">${profileOk(S.profile) ? `Crearé tu plan según tu objetivo (<b>${GOALS[S.profile.goal].l.toLowerCase()}</b>), tu nivel y el material que tengas.` : 'Completa tu perfil para personalizarla (objetivo y peso). También puedes generarla ya con valores generales.'}</p></div>`;
    return h;
  }
  const inj = S.coach.prefs.injuries;
  h += `<div class="card"><h3>Tu plan · ${GOALS[r.goal].l}</h3><p class="small muted">${r.days.length} sesiones por semana · ${r.cfg.mins} min · ${r.cfg.place === 'g' ? 'gimnasio' : 'casa'}${inj.length ? ` · evita estrés en: ${esc(inj.join(', '))}` : ''}</p></div>`;
  h += `<div class="list">${r.days.map((d, i) => `<button class="item" data-act="routineDay" data-i="${i}"><div class="em">${i + 1}</div><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">${d.items.length} ejercicios${d.cardio ? ' + cardio ' + d.cardio.min + ' min' : ''} · ≈ ${r0(d.est)} kcal</div></div><div class="r">›</div></button>`).join('')}</div>`;
  h += `<p class="hint">Gasto estimado con la fórmula MET sobre tu peso. Es un cálculo orientativo: tu pulsómetro puede dar otra cifra.</p>`;
  if (r.goal === 'lose') h += `<div class="card"><h3>Consejo</h3><p class="small">Para perder grasa suma ${S.profile.act === 'sed' ? '8.000-10.000' : '7.000-9.000'} pasos diarios además de la fuerza: es lo que más ayuda a mantener el déficit sin perder músculo.</p></div>`;
  return h;
}
function pickEx(group, place, risks, seed, kind) {
  const pool = EXERCISES.filter(e => e.g === group && (e.place === place) && !e.risk.some(r => risks.includes(r)) && (!kind || e.kind === kind));
  const alt = EXERCISES.filter(e => e.g === group && !e.risk.some(r => risks.includes(r)) && (!kind || e.kind === kind));
  const p = pool.length ? pool : alt;
  return p.length ? p[seed % p.length] : null;
}
function genRoutine(cfg) {
  const goal = S.profile.goal, risks = [];
  S.coach.prefs.injuries.forEach(i => { if (/rodilla/.test(i)) risks.push('rod'); if (/hombro/.test(i)) risks.push('hom'); if (/espalda|lumbar|cadera/.test(i)) risks.push('esp'); if (/mu[nñ]eca|codo/.test(i)) risks.push('mun'); });
  const nEx = Math.max(3, Math.min(9, Math.round(cfg.mins / 8)));
  const SPL = {
    2: [['Cuerpo completo A', ['pierna', 'pecho', 'espalda', 'gluteo', 'hombro', 'core', 'triceps', 'biceps']], ['Cuerpo completo B', ['gluteo', 'espalda', 'pecho', 'pierna', 'core', 'hombro', 'biceps', 'triceps']]],
    3: [['Cuerpo completo A', ['pierna', 'pecho', 'espalda', 'gluteo', 'hombro', 'core', 'triceps', 'biceps']], ['Cuerpo completo B', ['gluteo', 'espalda', 'pecho', 'pierna', 'core', 'hombro', 'biceps', 'triceps']], ['Cuerpo completo C', ['pierna', 'hombro', 'espalda', 'pecho', 'gluteo', 'core', 'triceps', 'biceps']]],
    4: [['Torso A', ['pecho', 'espalda', 'hombro', 'triceps', 'biceps', 'core', 'pecho', 'espalda']], ['Pierna A', ['pierna', 'gluteo', 'pierna', 'gluteo', 'core', 'pierna', 'core', 'gluteo']], ['Torso B', ['espalda', 'pecho', 'hombro', 'biceps', 'triceps', 'core', 'espalda', 'pecho']], ['Pierna B', ['gluteo', 'pierna', 'gluteo', 'pierna', 'core', 'gluteo', 'core', 'pierna']]],
    5: [['Pecho y tríceps', ['pecho', 'pecho', 'hombro', 'triceps', 'triceps', 'core', 'pecho', 'hombro']], ['Espalda y bíceps', ['espalda', 'espalda', 'espalda', 'biceps', 'biceps', 'core', 'hombro', 'espalda']], ['Pierna', ['pierna', 'gluteo', 'pierna', 'gluteo', 'pierna', 'core', 'gluteo', 'pierna']], ['Hombro y core', ['hombro', 'hombro', 'core', 'hombro', 'core', 'triceps', 'biceps', 'core']], ['Cuerpo completo', ['pierna', 'pecho', 'espalda', 'gluteo', 'hombro', 'core', 'biceps', 'triceps']]],
    6: [['Empuje A', ['pecho', 'hombro', 'triceps', 'pecho', 'triceps', 'hombro', 'core', 'pecho']], ['Tirón A', ['espalda', 'espalda', 'biceps', 'espalda', 'biceps', 'core', 'espalda', 'hombro']], ['Pierna A', ['pierna', 'gluteo', 'pierna', 'gluteo', 'pierna', 'core', 'gluteo', 'pierna']], ['Empuje B', ['hombro', 'pecho', 'triceps', 'pecho', 'hombro', 'triceps', 'core', 'pecho']], ['Tirón B', ['espalda', 'biceps', 'espalda', 'biceps', 'espalda', 'core', 'hombro', 'espalda']], ['Pierna B', ['gluteo', 'pierna', 'gluteo', 'pierna', 'gluteo', 'core', 'pierna', 'gluteo']]]
  }[cfg.days];
  const sets = cfg.level === 'beg' ? 3 : cfg.level === 'mid' ? 3 : 4;
  const repsComp = goal === 'gain' ? '6-10' : goal === 'lose' ? '10-12' : '8-12';
  const repsIso = goal === 'gain' ? '10-12' : '12-15';
  const rest = goal === 'gain' ? '90-120 s' : '60-75 s';
  const days = SPL.map(([name, groups], di) => {
    const used = new Set(), items = [];
    groups.slice(0, nEx).forEach((g, gi) => {
      const kindPref = items.filter(x => x.ex.g === g).length === 0 ? 'comp' : 'iso';
      let ex = null;
      for (let t = 0; t < 12 && !ex; t++) { const c = pickEx(g, cfg.place, risks, di + gi + t * 2, t < 6 ? kindPref : null); if (c && !used.has(c.id)) ex = c; }
      if (!ex) return;
      used.add(ex.id);
      const plank = /Plancha|Superman|Dead bug|Mountain/.test(ex.n);
      items.push({ ex, sets: ex.kind === 'comp' ? sets : Math.max(2, sets - (cfg.level === 'beg' ? 1 : 0)), reps: plank ? '30-45 s' : (ex.kind === 'comp' ? repsComp : repsIso), rest });
    });
    let cardio = null;
    if (goal === 'lose') cardio = { name: cfg.level === 'beg' ? 'Caminar a paso ligero (5 km/h)' : 'HIIT / circuito', min: cfg.level === 'beg' ? 20 : 12, met: cfg.level === 'beg' ? 3.5 : 8 };
    else if (goal === 'recomp') cardio = { name: 'Caminar rápido (6,5 km/h)', min: 15, met: 5 };
    const est = netKcal(5, cfg.mins) + (cardio ? netKcal(cardio.met, cardio.min) : 0);
    return { name, items, cardio, est };
  });
  return { cfg, goal, days, created: todayKey() };
}
function routineDaySheet(i) {
  const d = S.routine.days[i];
  d.items.forEach(it => { const fresh = EXERCISES.find(e => e.id === it.ex.id); if (fresh) it.ex = fresh; });
  openSheet(`<div class="sheet-h"><div><h2>${esc(d.name)}</h2><div class="small muted">${d.items.length} ejercicios · ≈ ${r0(d.est)} kcal</div></div><button class="x" data-act="closeSheet">✕</button></div>
    <div class="card" style="padding:4px 14px"><p class="small muted" style="padding:8px 0">Calentamiento: 5 min de movilidad articular y 1-2 series ligeras del primer ejercicio.</p></div>
    <p class="small muted" style="margin:0 4px 8px">Toca un ejercicio para ver cómo se hace.</p>
    <div class="list">${d.items.map((it, n) => `<button class="item" data-act="exInfo" data-id="${it.ex.id}" data-day="${i}"><div class="em lg">${exThumb(it.ex)}<span class="num">${n + 1}</span></div><div class="grow"><div class="t">${esc(it.ex.n)}</div><div class="s">${MUSCLES[it.ex.g]} · descanso ${it.rest}</div></div><div class="r"><b style="color:var(--txt);font-size:16px">${it.sets}×${it.reps.replace(' s', '')}</b>${/ s$/.test(it.reps) ? '<br>segundos' : '<br>reps'}</div></button>`).join('')}</div>
    ${d.cardio ? `<div class="card"><h3>Cardio final</h3><b>${esc(d.cardio.name)}</b> · ${d.cardio.min} min</div>` : ''}
    <button class="btn" data-act="logRoutine" data-i="${i}">Registrar esta sesión</button>`);
}
const exFrames = ex => (ex && ex.img && window.EX_IMG && window.EX_IMG[ex.img]) || null;
function exThumb(ex) {
  const f = exFrames(ex);
  return f ? `<img src="${f[0]}" alt="" loading="lazy">` : '🏋️';
}
const videoURL = ex => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.n.replace(/\s*\(.*?\)/g, '') + ' técnica correcta ejercicio');
function exerciseSheet(id, day) {
  const ex = EXERCISES.find(e => e.id === id); if (!ex) return;
  const f = exFrames(ex);
  const risk = { rod: 'rodillas', hom: 'hombros', esp: 'zona lumbar', mun: 'muñecas' };
  const back = day !== undefined && day !== '' ? `data-act="routineDay" data-i="${day}"` : 'data-act="closeSheet"';
  openSheet(`<div class="sheet-h"><button class="x" ${back} aria-label="Atrás">${day !== undefined && day !== '' ? '‹' : '✕'}</button><div class="bold grow" style="text-align:center">${MUSCLES[ex.g]}</div><span style="width:30px"></span></div>
    ${f ? `<div class="exanim"><img src="${f[0]}" alt="Posición inicial de ${esc(ex.n)}"><img class="b" src="${f[1]}" alt="Posición final de ${esc(ex.n)}"><span class="exlbl">Movimiento</span></div>` : ''}
    <h2 style="font-size:23px;letter-spacing:-.4px;line-height:1.2;margin-top:14px">${esc(ex.n)}</h2>
    <div style="margin:8px 0 12px"><span class="pill">${EX_PLACE[ex.place]}</span><span class="pill gray">${ex.kind === 'comp' ? 'Multiarticular' : 'Aislamiento'}</span></div>
    <div class="card"><h3>Cómo hacerlo</h3><p>${esc(ex.tip)}</p>${ex.risk.length ? `<p class="small muted" style="margin-top:8px">Ten cuidado si tienes molestias en: ${ex.risk.map(r => risk[r]).join(', ')}.</p>` : ''}</div>
    <a class="btn" href="${videoURL(ex)}" target="_blank" rel="noopener" data-ext>▶ Ver vídeo del ejercicio</a>
    <p class="hint" style="margin-top:10px;text-align:center">El vídeo se abre en YouTube. Imágenes: Free Exercise DB (dominio público).</p>`);
}
function depLibrary() {
  const g = ui.exG || '', pl = ui.exP || '';
  let list = EXERCISES.filter(e => (!g || e.g === g) && (!pl || e.place === pl));
  const seen = new Set(); list = list.filter(e => { const k = e.n; if (seen.has(k)) return false; seen.add(k); return true; });
  return `<div class="chips">${[['', 'Todos'], ...Object.entries(MUSCLES)].map(([k, l]) => `<button class="chip ${g === k ? 'on' : ''}" data-act="exG" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="chips">${[['', 'Casa y gimnasio'], ['c', 'En casa'], ['g', 'Gimnasio']].map(([k, l]) => `<button class="chip ${pl === k ? 'on' : ''}" data-act="exP" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="list">${list.map(e => `<button class="item" data-act="exInfo" data-id="${e.id}"><div class="em lg">${exThumb(e)}</div><div class="grow"><div class="t">${esc(e.n)}</div><div class="s">${MUSCLES[e.g]} · ${EX_PLACE[e.place]}</div></div><div class="r">▶</div></button>`).join('') || '<div class="empty">Sin ejercicios con ese filtro.</div>'}</div>`;
}
function logRoutineSheet(i) {
  const d = S.routine.days[i], mins = S.routine.cfg.mins;
  openSheet(`<div class="sheet-h"><button class="x" data-act="routineDay" data-i="${i}">‹</button><div class="bold">Registrar sesión</div><span style="width:30px"></span></div>
    <p class="muted" style="margin-bottom:10px">${esc(d.name)} · ¿cuánto ha durado el entrenamiento de fuerza?</p>
    <div class="stepper"><button data-act="lrstep" data-d="-5">−</button><input id="lr-min" inputmode="numeric" value="${mins}"><button data-act="lrstep" data-d="5">+</button></div>
    <p class="small muted" style="text-align:center">minutos</p>
    <div class="seg" style="margin-top:12px"><button class="on" id="lr-int-m" data-act="lrint" data-v="m">Moderada</button><button id="lr-int-h" data-act="lrint" data-v="h">Intensa</button></div>
    <div class="after" id="lr-est"></div>
    <button class="btn" data-act="lrsave" data-i="${i}">Guardar</button>`);
  lrUpdate();
}
let lrIntense = false;
function lrUpdate() {
  const el = $('#lr-est'); if (!el) return;
  const min = num($('#lr-min').value); lrIntense = $('#lr-int-h').classList.contains('on');
  el.textContent = `Gasto estimado: ${r0(netKcal(lrIntense ? 6 : 5, min))} kcal (${lrIntense ? 'MET 6' : 'MET 5'}, neto)`;
}
function depLog() {
  const k = todayKey();
  return `<div class="form"><div class="field"><label>Actividad</label><select id="act-sel">${ACTIVITIES.map((a, i) => `<option value="${i}">${a.e} ${esc(a.n)}</option>`).join('')}</select></div>
    <div class="field"><label>Minutos</label><input id="act-min" type="number" inputmode="numeric" value="30"></div></div>
    <div class="after" id="act-est"></div>
    <button class="btn" data-act="actSave">Anotar actividad</button>
    <p class="hint" style="margin-top:12px">Gasto = (MET − 1) × peso (kg) × horas. Restamos el metabolismo basal porque ya está incluido en tu objetivo. Hoy llevas <b>${r0(burned(k))} kcal</b> en deporte.</p>`;
}
function actUpdate() {
  const el = $('#act-est'); if (!el) return;
  const a = ACTIVITIES[+$('#act-sel').value], min = num($('#act-min').value);
  el.textContent = `≈ ${r0(netKcal(a.met, min))} kcal en ${min} min (MET ${a.met})`;
}
function depHistory() {
  const keys = []; for (let i = 0; i < 14; i++) keys.push(shiftDay(todayKey(), -i));
  const days = keys.filter(k => workoutsOf(k).length);
  const weekTotal = keys.slice(0, 7).reduce((a, k) => a + burned(k), 0);
  let h = `<div class="card"><h3>Últimos 7 días</h3><div class="row between"><div><b style="font-size:26px">${r0(weekTotal)}</b> <span class="muted">kcal gastadas</span></div><div class="muted small">${keys.slice(0, 7).reduce((a, k) => a + workoutsOf(k).length, 0)} sesiones</div></div></div>`;
  if (!days.length) return h + '<div class="list"><div class="empty">Aún no has anotado ejercicio.</div></div>';
  days.forEach(k => {
    h += `<div class="section-h"><h2 style="font-size:17px;text-transform:capitalize">${dateLabel(k)}</h2><span class="k">${r0(burned(k))} kcal</span></div><div class="list">${workoutsOf(k).map(w => `<button class="item" data-act="delWorkout" data-k="${k}" data-id="${w.id}"><div class="em">${w.e || '🏃'}</div><div class="grow"><div class="t">${esc(w.name)}</div><div class="s">${w.min} min · toca para eliminar</div></div><div class="r"><b style="color:var(--txt)">${r0(w.kcal)}</b><br>kcal</div></button>`).join('')}</div>`;
  });
  return h;
}
function addWorkout(name, min, kcal, emoji) {
  const k = todayKey(); (S.workouts[k] = S.workouts[k] || []).push({ id: uid(), name, min: r0(min), kcal: r1(kcal), e: emoji || '🏃' }); save();
}

/* =====================================================================
   COACH
   ===================================================================== */
function fmtBot(t) {
  let h = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = h.split('\n'); let out = '', inList = false;
  lines.forEach(l => {
    if (/^\s*[-•]\s+/.test(l)) { if (!inList) { out += '<ul>'; inList = true; } out += '<li>' + l.replace(/^\s*[-•]\s+/, '') + '</li>'; }
    else { if (inList) { out += '</ul>'; inList = false; } out += (out && !out.endsWith('</ul>') ? '<br>' : '') + l; }
  });
  if (inList) out += '</ul>';
  return out;
}
function viewCoach() {
  const chat = S.coach.chat;
  const msgs = chat.length ? chat : [{ r: 'bot', t: Coach.welcome() }];
  const last = chat.length ? chat[chat.length - 1] : msgs[0];
  return `<div class="nav"><div><div class="large">Coach</div><div class="sub">Nutrición y deporte · funciona sin internet</div></div><button class="btn sm sec" data-act="learned">🧠 Aprendido</button></div>
    <div class="chat" id="chat">${msgs.map(m => `<div class="bub ${m.r === 'me' ? 'me' : 'bot'}">${m.r === 'me' ? esc(m.t) : fmtBot(m.t)}</div>`).join('')}${ui.typing ? '<div class="bub bot typing"><span></span><span></span><span></span></div>' : ''}</div>
    ${last && last.chips && !ui.typing ? `<div class="chips" style="margin-top:8px;flex-wrap:wrap;overflow:visible">${last.chips.map(c => `<button class="chip" data-act="chip" data-t="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="chat-pad"></div>`;
}
function composerHTML() { return `<div class="composer"><form id="coach-form" autocomplete="off"><input id="coach-in" placeholder="Pregunta sobre nutrición, entrenos…" maxlength="300"><button type="submit" aria-label="Enviar">➤</button></form></div>`; }
function scrollChat() { setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 30); }
function askCoach(text) {
  text = text.trim(); if (!text) return;
  S.coach.chat.push({ r: 'me', t: text }); ui.typing = true; render(); save();
  const res = Coach.reply(text);
  setTimeout(() => {
    ui.typing = false;
    S.coach.chat.push({ r: 'bot', t: res.t, chips: res.chips });
    if (S.coach.chat.length > 80) S.coach.chat = S.coach.chat.slice(-80);
    save(); if (tab === 'coach') render();
  }, 380 + Math.min(700, res.t.length));
}
function learnedSheet() {
  const p = S.coach.prefs, st = Coach.stats();
  const tags = (arr, key) => arr.length ? `<div class="tagrow">${arr.map((x, i) => `<span class="tag">${esc(x)}<button data-act="forget" data-k="${key}" data-i="${i}" aria-label="Olvidar">✕</button></span>`).join('')}</div>` : '<p class="small muted">Nada todavía.</p>';
  openSheet(`<div class="sheet-h"><h2>Lo que he aprendido</h2><button class="x" data-act="closeSheet">✕</button></div>
    <p class="small muted" style="margin-bottom:10px">Se guarda solo en este dispositivo. Cuéntame cosas como «no me gusta el brócoli», «me duele la rodilla» o «entreno por la tarde» y las tendré en cuenta.</p>
    <div class="card"><h3>Me gusta</h3>${tags(p.likes, 'likes')}</div>
    <div class="card"><h3>Evito o no me gusta</h3>${tags(p.dislikes, 'dislikes')}</div>
    <div class="card"><h3>Lesiones o molestias</h3>${tags(p.injuries, 'injuries')}</div>
    <div class="card"><h3>Hábitos detectados</h3>${st.lines.length ? '<ul style="margin:0;padding-left:18px">' + st.lines.map(l => `<li>${esc(l)}</li>`).join('') + '</ul>' : '<p class="small muted">Registra comidas unos días y empezaré a detectar tus patrones.</p>'}</div>
    <button class="btn danger" data-act="resetCoach">Borrar lo que ha aprendido el coach</button>`);
}

/* =====================================================================
   PERFIL
   ===================================================================== */
function planCard() {
  const plan = calcPlan(S.profile);
  if (!plan) return `<div class="card"><h3>Tu objetivo diario</h3><p class="muted small">Rellena edad, altura y peso para calcular tus calorías y macros.</p></div>`;
  const g = GOALS[S.profile.goal];
  return `<div class="card"><h3>Tu objetivo diario</h3>
    <div class="row between"><div><div style="font-size:40px;font-weight:800;letter-spacing:-1px;line-height:1">${plan.kcal}</div><div class="muted small">kcal al día</div></div><div class="muted small" style="text-align:right">${g.l}<br>${plan.adj === 0 ? 'Sin déficit ni superávit' : (plan.adj > 0 ? '+' : '') + Math.round(plan.adj * 100) + '% sobre tu gasto'}</div></div>
    <div class="macrobox"><div class="mbx"><b style="color:var(--p)">${plan.p} g</b><span>Proteína</span></div><div class="mbx"><b style="color:var(--c)">${plan.c} g</b><span>Hidratos</span></div><div class="mbx"><b style="color:var(--f)">${plan.f} g</b><span>Grasas</span></div><div class="mbx"><b>${plan.fiber} g</b><span>Fibra</span></div></div>
    <div class="kv small"><span class="muted">Metabolismo basal (Mifflin-St Jeor)</span><b>${plan.bmr} kcal</b><span class="muted">Gasto diario estimado (sin entrenar)</span><b>${plan.tdee} kcal</b><span class="muted">Agua recomendada</span><b>${plan.water} L</b></div>
    ${plan.floored ? '<p class="small neg" style="margin-top:10px">He subido tu objetivo hasta el mínimo recomendado (1.200 kcal mujer / 1.500 kcal hombre). Un déficit mayor requiere supervisión profesional.</p>' : ''}
    ${plan.minor ? '<p class="small neg" style="margin-top:10px">Eres menor de edad: estos cálculos son para adultos. Consulta con tu médico o pediatra antes de hacer dieta.</p>' : ''}</div>`;
}
function viewPerfil() {
  const p = S.profile, g = GOALS[p.goal], rkey = g.rates[p.rate] ? p.rate : Object.keys(g.rates)[0];
  const sel = (key, opts, cur) => `<select data-p="${key}">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const lastW = S.weights.length ? S.weights[S.weights.length - 1] : null;
  const standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="nav"><div><div class="large">Perfil</div><div class="sub">Tus datos y objetivo</div></div></div>
    <div class="form">
      <div class="field"><label>Nombre</label><input data-p="name" value="${esc(p.name)}" placeholder="Opcional" maxlength="30"></div>
      <div class="field"><label>Sexo</label>${sel('sex', [['m', 'Hombre'], ['f', 'Mujer']], p.sex)}</div>
      <div class="field"><label>Edad</label><input data-p="age" type="number" inputmode="numeric" value="${esc(p.age)}" placeholder="años"></div>
      <div class="field"><label>Altura</label><input data-p="cm" type="number" inputmode="numeric" value="${esc(p.cm)}" placeholder="cm"></div>
      <div class="field"><label>Peso</label><input data-p="kg" type="number" inputmode="decimal" step="0.1" value="${esc(p.kg)}" placeholder="kg"></div>
    </div>
    <div class="form">
      <div class="field"><label>Actividad diaria</label>${sel('act', Object.entries(ACT).map(([k, v]) => [k, v.l]), p.act)}</div>
      <div class="field"><label>Objetivo</label>${sel('goal', Object.entries(GOALS).map(([k, v]) => [k, v.l]), p.goal)}</div>
      ${Object.keys(g.rates).length > 1 ? `<div class="field"><label>Ritmo</label>${sel('rate', Object.entries(g.rates).map(([k, v]) => [k, v[0]]), rkey)}</div>` : ''}
      <div class="field"><label>Alimentación</label>${sel('diet', [['omni', 'De todo'], ['veg', 'Vegetariana'], ['vgn', 'Vegana']], p.diet)}</div>
    </div>
    <p class="hint">«Actividad diaria» es tu día a día <b>sin contar los entrenos</b>: los entrenos los sumas desde Deporte.</p>
    <div id="plan-card">${planCard()}</div>
    <div class="form"><div class="field"><label>Sumar deporte al objetivo</label>${sel('comp', [['0', 'No sumar'], ['50', 'La mitad (recomendado)'], ['100', 'Todo']], String(S.settings.comp)).replace('data-p="comp"', 'data-s="comp"')}</div></div>
    <p class="hint">Si entrenas, parte de las calorías gastadas se añade al objetivo del día para que tengas energía y recuperes.</p>

    <div class="section-h"><h2>Peso</h2></div>
    <div class="card">${weightChart()}<div class="row" style="margin-top:12px"><input class="inp" id="w-in" inputmode="decimal" placeholder="Peso de hoy (kg)" value="${lastW ? '' : ''}"><button class="btn sm" data-act="addWeight" style="white-space:nowrap">Anotar</button></div>
    ${lastW ? `<p class="small muted" style="margin-top:8px">Último registro: ${lastW.kg} kg (${lastW.d.split('-').reverse().join('/')})</p>` : ''}</div>

    <div class="section-h"><h2>Tus datos</h2></div>
    <div class="card"><p class="small muted" style="margin-bottom:12px">Todo se guarda en este dispositivo. Al actualizar la app <b>no se pierde nada</b>. Aun así, haz una copia de vez en cuando (por ejemplo, antes de cambiar de móvil o borrar los datos del navegador).</p>
      <button class="btn ghost" data-act="export" style="margin-bottom:10px">⬇ Guardar copia de seguridad</button>
      <button class="btn sec" data-act="importPick">⬆ Restaurar copia</button><input type="file" id="import-file" accept="application/json,.json" class="hidden">
      <p class="small muted" id="persist-status" style="margin-top:12px"></p></div>
    <div class="form"><button class="item" data-act="pin"><div class="grow"><div class="t">${S.settings.pin ? 'Cambiar o quitar PIN' : 'Proteger con PIN'}</div><div class="s">${S.settings.pin ? 'La app pide el PIN al abrirse' : 'Bloquea la app al abrirla'}</div></div><div class="r">${S.settings.pin ? '🔒' : '›'}</div></button></div>
    ${standalone || ANDROID ? '' : `<div class="card"><h3>Instalar en tu móvil</h3><p class="small">${isIOS ? 'En iPhone/iPad (Safari): pulsa <b>Compartir</b> ⬆ y después <b>Añadir a pantalla de inicio</b>.' : 'En Android (Chrome): menú ⋮ y <b>Instalar aplicación</b> / <b>Añadir a pantalla de inicio</b>.'}</p><button class="btn ghost sm hidden" id="install-btn" style="margin-top:10px">Instalar ahora</button></div>`}
    <button class="btn danger" data-act="wipe" style="margin-top:6px">Borrar todos mis datos</button>
    <p class="hint" style="margin-top:12px;text-align:center">MacroFit calcula con fórmulas estándar (Mifflin-St Jeor, MET) y es orientativa; no sustituye el consejo de un médico o dietista, sobre todo si tienes alguna condición de salud.</p>`;
}
function updatePlanCard() { const el = $('#plan-card'); if (el) el.innerHTML = planCard(); }
function onProfileChange(key, val) {
  const p = S.profile;
  if (['age', 'cm', 'kg'].includes(key)) p[key] = val === '' ? '' : num(val);
  else p[key] = val;
  if (key === 'goal') p.rate = Object.keys(GOALS[val].rates)[val === 'lose' || val === 'gain' ? 1 : 0] || 'mod';
  p.done = profileOk(p);
  if (key === 'kg' && p.kg) { const k = todayKey(), last = S.weights[S.weights.length - 1]; if (!last || last.d !== k) S.weights.push({ d: k, kg: num(p.kg) }); else last.kg = num(p.kg); }
  save();
  if (['goal', 'sex', 'act', 'rate', 'diet'].includes(key)) render(); else updatePlanCard();
}
function exportData() {
  const json = JSON.stringify(Object.assign({}, S, { photos: PHOTOS }));
  const name = `macrofit-copia-${todayKey()}.json`;
  if (ANDROID) { window.MacroFitAndroid.saveFile(name, json); return; }
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Copia guardada en tus descargas');
}
function importData(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || typeof d !== 'object' || !d.profile || !d.logs) throw new Error('formato');
      if (!confirm('Esto reemplazará los datos actuales por los de la copia. ¿Continuar?')) return;
      const ph = d.photos || {}; delete d.photos;
      S = migrate(d); save();
      Object.keys(PHOTOS).forEach(k => { if (!ph[k]) photoPut(k, null); });
      Object.entries(ph).forEach(([k, v]) => photoPut(k, v));
      render(); toast('Copia restaurada');
    } catch (e) { toast('Ese archivo no es una copia válida'); }
  };
  rd.readAsText(file);
}
function pinSheet() {
  openSheet(`<div class="sheet-h"><h2>PIN de acceso</h2><button class="x" data-act="closeSheet">✕</button></div>
    <p class="muted small" style="margin-bottom:10px">Elige 4 números. Se pedirá al abrir la app. Si lo olvidas, tendrás que borrar los datos del navegador (o restaurar tu copia de seguridad).</p>
    <input id="pin-new" class="inp" inputmode="numeric" maxlength="4" placeholder="Nuevo PIN de 4 cifras" style="margin-bottom:12px">
    <button class="btn" data-act="pinSave">Guardar PIN</button>${S.settings.pin ? '<div style="height:10px"></div><button class="btn danger" data-act="pinOff">Quitar PIN</button>' : ''}`);
}
async function hashPin(pin) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('macrofit:' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'p:' + pin; }
}
function showLock() {
  const el = $('#lock'); el.classList.remove('hidden');
  el.innerHTML = `<div class="welcome-emoji">🔒</div><h2>MacroFit</h2><input id="lock-in" type="password" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off"><div class="small muted" id="lock-msg">Introduce tu PIN</div>`;
  const inp = $('#lock-in'); setTimeout(() => inp.focus(), 100);
  inp.addEventListener('input', async () => {
    if (inp.value.length === 4) {
      if (await hashPin(inp.value) === S.settings.pin) el.classList.add('hidden');
      else { $('#lock-msg').textContent = 'PIN incorrecto'; inp.value = ''; }
    }
  });
}

/* ---------- eventos ---------- */
const ACTIONS = {
  tab: el => setTab(el.dataset.k),
  closeSheet,
  dayPrev: () => { curDate = shiftDay(curDate, -1); render(); },
  dayNext: () => { if (curDate < todayKey()) { curDate = shiftDay(curDate, 1); render(); } },
  addFood: el => openAdd(el.dataset.slot),
  addCat: el => { addCtx.cat = el.dataset.k; addCtx.q = ''; renderAddList(); },
  pickFood: el => openFoodDetail(foodById(el.dataset.id)),
  backAdd: () => renderAddList(),
  editEntry: el => { const e = logOf(curDate).find(x => x.id === el.dataset.id); if (!e) return; addCtx = { slot: e.slot, auto: false, cat: 'all', q: '' }; const f = (e.fid && foodById(e.fid)) || { id: 'x' + e.id, name: e.name, kcal: e.g ? e.kcal / e.g * 100 : 0, p: e.g ? e.p / e.g * 100 : 0, c: e.g ? e.c / e.g * 100 : 0, f: e.g ? e.f / e.g * 100 : 0, unit: null, ug: null, cat: 'mine', emoji: e.emoji || '🍽️' }; openFoodDetail(f, e); },
  toggleFav: () => { const id = addCtx.food.id; const i = S.favs.indexOf(id); if (i >= 0) S.favs.splice(i, 1); else S.favs.push(id); save(); renderFoodDetail(); },
  qmode: el => { const q = addCtx.qty, f = addCtx.food, g = qtyGrams(); q.mode = el.dataset.m; q.val = q.mode === 'u' ? Math.max(0.5, Math.round(g / f.ug * 2) / 2) : r1(g); renderFoodDetail(); },
  qstep: el => { const q = addCtx.qty, d = +el.dataset.d; const step = q.mode === 'u' ? 0.5 : (q.val >= 100 ? 10 : 5); q.val = Math.max(q.mode === 'u' ? 0.5 : 1, r1(q.val + d * step)); $('#qty').value = q.val; refreshDetail(); },
  slot: el => { addCtx.slot = el.dataset.k; addCtx.auto = false; renderFoodDetail(); },
  confirmAdd, saveEdit, delEntry,
  newFood: newFoodSheet, saveFood,
  water: el => { const k = curDate; S.water[k] = Math.max(0, (S.water[k] || 0) + (+el.dataset.d)); save(); render(); },
  restType: el => { ui.restType = el.dataset.k; render(); },
  restTag: el => { ui.restTag = el.dataset.k; render(); },
  dish: el => openDish(el.dataset.id),
  dscale: el => { dishCtx.scale = Math.max(0.25, Math.min(3, Math.round((dishCtx.scale + +el.dataset.d) * 4) / 4)); const sc = $('#sheet-body').scrollTop; renderDish(); $('#sheet-body').scrollTop = sc; },
  dslot: el => { dishCtx.slot = el.dataset.k; const sc = $('#sheet-body').scrollTop; renderDish(); $('#sheet-body').scrollTop = sc; },
  dishAdd,
  dishPhotoDel: async () => { await photoPut(dishCtx.d.id, null); renderDish(); render(); toast('Foto quitada'); },
  depSeg: el => { ui.depSeg = el.dataset.k; render(); if (ui.depSeg === 'reg') actUpdate(); },
  genRoutine: () => {
    const cfg = { ...cfgDefault(), ...(ui.cfg || {}) };
    $$('[data-cfg]').forEach(s => { cfg[s.dataset.cfg] = s.dataset.cfg === 'place' || s.dataset.cfg === 'level' ? s.value : +s.value; });
    S.routine = genRoutine(cfg); save(); render(); toast('Rutina generada');
  },
  routineDay: el => routineDaySheet(+el.dataset.i),
  exInfo: el => exerciseSheet(el.dataset.id, el.dataset.day),
  exG: el => { ui.exG = el.dataset.k; render(); },
  exP: el => { ui.exP = el.dataset.k; render(); },
  logRoutine: el => logRoutineSheet(+el.dataset.i),
  lrstep: el => { const i = $('#lr-min'); i.value = Math.max(5, num(i.value) + +el.dataset.d); lrUpdate(); },
  lrint: el => { $('#lr-int-m').classList.toggle('on', el.dataset.v === 'm'); $('#lr-int-h').classList.toggle('on', el.dataset.v === 'h'); lrUpdate(); },
  lrsave: el => { const d = S.routine.days[+el.dataset.i], min = num($('#lr-min').value); if (min <= 0) return; let kc = netKcal(lrIntense ? 6 : 5, min); if (d.cardio) { kc += netKcal(d.cardio.met, d.cardio.min); } addWorkout('Rutina · ' + d.name, min + (d.cardio ? d.cardio.min : 0), kc, '🏋️'); closeSheet(); render(); toast(`+${r0(kc)} kcal anotadas`); },
  actSave: () => { const a = ACTIVITIES[+$('#act-sel').value], min = num($('#act-min').value); if (min <= 0) return toast('Indica los minutos'); const kc = netKcal(a.met, min); addWorkout(a.n, min, kc, a.e); render(); toast(`+${r0(kc)} kcal anotadas`); },
  delWorkout: el => { const k = el.dataset.k; if (!confirm('¿Eliminar esta actividad?')) return; S.workouts[k] = (S.workouts[k] || []).filter(w => w.id !== el.dataset.id); save(); render(); },
  chip: el => askCoach(el.dataset.t),
  learned: learnedSheet,
  forget: el => { S.coach.prefs[el.dataset.k].splice(+el.dataset.i, 1); save(); learnedSheet(); },
  resetCoach: () => { if (!confirm('¿Borrar lo aprendido y la conversación?')) return; S.coach = freshState().coach; save(); closeSheet(); render(); },
  addWeight: () => { const v = num($('#w-in').value); if (v < 30 || v > 250) return toast('Escribe un peso válido'); const k = todayKey(), last = S.weights[S.weights.length - 1]; if (last && last.d === k) last.kg = v; else S.weights.push({ d: k, kg: v }); S.profile.kg = v; S.profile.done = profileOk(S.profile); save(); render(); toast('Peso anotado'); },
  export: exportData,
  importPick: () => $('#import-file').click(),
  pin: pinSheet,
  pinSave: async () => { const v = $('#pin-new').value; if (!/^\d{4}$/.test(v)) return toast('Usa 4 números'); S.settings.pin = await hashPin(v); save(); closeSheet(); render(); toast('PIN guardado'); },
  pinOff: () => { S.settings.pin = null; save(); closeSheet(); render(); toast('PIN quitado'); },
  wipe: () => { if (!confirm('Se borrarán TODOS tus datos de esta app. ¿Seguro?')) return; if (!confirm('Última confirmación: no se puede deshacer (salvo que tengas una copia).')) return; S = freshState(); save(); curDate = todayKey(); setTab('hoy'); toast('Datos borrados'); }
};

document.addEventListener('click', e => {
  const ext = e.target.closest('a[data-ext]');
  if (ext) { if (ANDROID) { e.preventDefault(); window.MacroFitAndroid.openUrl(ext.href); } return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACTIONS[el.dataset.act]; if (fn) fn(el);
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'addq' && addCtx) { addCtx.q = t.value; updateAddList(); }
  else if (t.id === 'qty' && addCtx && addCtx.qty) { addCtx.qty.val = num(t.value); refreshDetail(); }
  else if (t.id === 'lr-min') lrUpdate();
  else if (t.id === 'act-min' || t.id === 'act-sel') actUpdate();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.p) onProfileChange(t.dataset.p, t.value);
  else if (t.dataset && t.dataset.s === 'comp') { S.settings.comp = +t.value; save(); toast('Guardado'); }
  else if (t.dataset && t.dataset.cfg) { ui.cfg = ui.cfg || {}; ui.cfg[t.dataset.cfg] = (t.dataset.cfg === 'place' || t.dataset.cfg === 'level') ? t.value : +t.value; }
  else if (t.id === 'act-sel') actUpdate();
  else if (t.id === 'import-file' && t.files[0]) importData(t.files[0]);
  else if (t.id === 'dish-photo' && t.files[0] && dishCtx) {
    resizeImage(t.files[0], 1000).then(async url => { await photoPut(dishCtx.d.id, url); renderDish(); render(); toast('Foto guardada'); }).catch(() => toast('No se pudo leer la imagen'));
  }
});
document.addEventListener('submit', e => {
  if (e.target.id === 'coach-form') { e.preventDefault(); const i = $('#coach-in'); const v = i.value; i.value = ''; askCoach(v); }
});
window.__macrofitBack = () => {
  if ($('#sheet').classList.contains('open')) { closeSheet(); return true; }
  if (tab !== 'hoy') { setTab('hoy'); return true; }
  return false;
};
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = $('#install-btn'); if (b) { b.classList.remove('hidden'); b.onclick = () => { deferredInstall.prompt(); }; } });

/* ---------- arranque ---------- */
async function boot() {
  await loadState();
  await loadPhotos();
  if (S.settings.pin) showLock();
  render();
  if (navigator.storage && navigator.storage.persist) { try { navigator.storage.persist().then(ok => { window.__persisted = ok; const s = $('#persist-status'); if (s) s.textContent = ok ? '✓ Almacenamiento protegido por el navegador.' : ''; }); } catch (e) { /* */ } }
  if (!ANDROID && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !window.__reloaded) { window.__reloaded = true; location.reload(); } });
  }
  if (typeof window.__macrofitReady === 'function') window.__macrofitReady();
}
boot();
