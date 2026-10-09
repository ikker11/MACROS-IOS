'use strict';
/* =====================================================================
   MacroFit · "fotos" de los platos
   Compone una imagen realista de cada receta (mesa, plato o bol de
   cerámica, sombras y los ingredientes en 3D) directamente en el móvil.
   ===================================================================== */
const DishArt = (() => {
  const W = 640, H = 480;
  const cache = new Map();
  const imgCache = new Map();

  // generador pseudoaleatorio estable por plato
  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function loadImg(src) {
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    imgCache.set(src, p);
    return p;
  }
  const icon = emoji => (window.FOOD3D && (FOOD3D[emoji] || FOOD3D[String(emoji).replace(/️/g, '')])) || null;

  /* ---------- superficies (mesa) ---------- */
  const SURF = {
    desayuno: { base: ['#f3e6d3', '#e6d2b6'], grain: '#c9a77c', kind: 'wood' },
    comida: { base: ['#d9b48a', '#c19468'], grain: '#8e6338', kind: 'wood' },
    cena: { base: ['#3a3f45', '#2a2e33'], grain: '#1d2024', kind: 'slate' },
    snack: { base: ['#eef0ec', '#dfe3dd'], grain: '#c7ccc4', kind: 'linen' },
    batido: { base: ['#f4f2ef', '#e4e0db'], grain: '#cfc9c1', kind: 'marble' }
  };
  const surfCache = {};
  function surface(type) {
    if (surfCache[type]) return surfCache[type];
    const s = SURF[type] || SURF.comida, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), r = rng('surf' + type);
    const lg = g.createLinearGradient(0, 0, W, H); lg.addColorStop(0, s.base[0]); lg.addColorStop(1, s.base[1]);
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    g.globalAlpha = s.kind === 'slate' ? 0.35 : 0.22;
    if (s.kind === 'wood') {
      g.strokeStyle = s.grain;
      for (let i = 0; i < 46; i++) {
        const y = r() * H; g.lineWidth = 0.6 + r() * 2.2; g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, y + Math.sin(x / 90 + i) * (2 + r() * 5));
        g.stroke();
      }
      g.globalAlpha = 0.18; g.fillStyle = s.grain;
      for (let i = 1; i < 4; i++) g.fillRect(0, (H / 4) * i - 1, W, 2);
    } else if (s.kind === 'marble') {
      g.strokeStyle = '#bdb6ad';
      for (let i = 0; i < 9; i++) {
        g.lineWidth = 0.5 + r() * 1.6; g.beginPath(); let x = r() * W, y = 0; g.moveTo(x, y);
        while (y < H) { x += (r() - 0.5) * 70; y += 30 + r() * 40; g.lineTo(x, y); }
        g.stroke();
      }
    } else if (s.kind === 'linen') {
      g.strokeStyle = s.grain; g.lineWidth = 1;
      for (let y = 0; y < H; y += 4) { g.globalAlpha = 0.05 + r() * 0.08; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let x = 0; x < W; x += 4) { g.globalAlpha = 0.04 + r() * 0.06; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    } else {
      for (let i = 0; i < 2200; i++) { g.fillStyle = r() > 0.5 ? '#ffffff' : '#000000'; g.globalAlpha = 0.03 + r() * 0.05; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
    }
    // ruido fino
    const id = g.getImageData(0, 0, W, H), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(id, 0, 0);
    // viñeta
    g.globalAlpha = 1;
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, s.kind === 'slate' ? 'rgba(0,0,0,.45)' : 'rgba(60,40,20,.22)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    surfCache[type] = c;
    return c;
  }

  /* ---------- vajilla ---------- */
  function plate(g, cx, cy, R, dark) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 34; g.shadowOffsetY = 14;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
    const rim = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R);
    rim.addColorStop(0, dark ? '#4a4d52' : '#ffffff'); rim.addColorStop(0.75, dark ? '#3b3e42' : '#f3f1ee'); rim.addColorStop(1, dark ? '#2c2e31' : '#dcd8d2');
    g.fillStyle = rim; g.fill();
    g.restore();
    // fondo del plato
    const r2 = R * 0.74;
    g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2);
    const well = g.createRadialGradient(cx + r2 * 0.2, cy + r2 * 0.25, r2 * 0.1, cx, cy, r2);
    well.addColorStop(0, dark ? '#45484d' : '#ffffff'); well.addColorStop(0.85, dark ? '#3a3d41' : '#f7f5f2'); well.addColorStop(1, dark ? '#2f3134' : '#e9e5df');
    g.fillStyle = well; g.fill();
    g.strokeStyle = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'; g.lineWidth = 2; g.stroke();
    // brillo
    g.beginPath(); g.arc(cx, cy, R * 0.93, Math.PI * 1.08, Math.PI * 1.42);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.stroke();
  }
  function bowl(g, cx, cy, R, col) {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.38)'; g.shadowBlur = 30; g.shadowOffsetY = 16;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
    const out = g.createRadialGradient(cx - R * 0.4, cy - R * 0.4, R * 0.1, cx, cy, R);
    out.addColorStop(0, col[0]); out.addColorStop(1, col[1]);
    g.fillStyle = out; g.fill(); g.restore();
    const r2 = R * 0.86;
    g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2);
    const inn = g.createRadialGradient(cx + r2 * 0.25, cy + r2 * 0.3, r2 * 0.1, cx, cy, r2);
    inn.addColorStop(0, '#fbf8f3'); inn.addColorStop(0.8, '#efe9e1'); inn.addColorStop(1, '#cfc6ba');
    g.fillStyle = inn; g.fill();
    // sombra interior
    g.save(); g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.clip();
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 26; g.shadowOffsetX = -10; g.shadowOffsetY = -12;
    g.lineWidth = 24; g.strokeStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.arc(cx, cy, r2 + 12, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.beginPath(); g.arc(cx, cy, R * 0.96, Math.PI * 1.1, Math.PI * 1.45); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3; g.stroke();
  }
  const BOWL_COL = { desayuno: ['#7fb3c9', '#3f7b96'], snack: ['#e6b68a', '#b97646'], comida: ['#5f8a73', '#2f5a45'], cena: ['#8a8f96', '#4b4f55'], batido: ['#c9b8e8', '#8c72c2'] };

  function napkin(g, type, r) {
    const dark = type === 'cena';
    g.save(); g.translate(W * 0.86, H * 0.78); g.rotate(-0.18 + r() * 0.1);
    g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.fillStyle = dark ? '#6d5a4b' : (type === 'comida' ? '#f4efe6' : '#e7efe9');
    g.fillRect(-80, -120, 160, 240); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 2; g.strokeRect(-70, -110, 140, 220);
    // cubiertos
    g.fillStyle = dark ? '#c9ccd1' : '#b9bec6';
    g.fillRect(-24, -100, 8, 200); g.fillRect(14, -100, 8, 200);
    g.beginPath(); g.ellipse(18, -88, 10, 26, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 4; i++) g.fillRect(-32 + i * 6, -110, 3, 30);
    g.restore();
  }

  /* ---------- ingredientes ---------- */
  const SMALL = /Aceite|Ajo|Miel|Semillas|Cacao|Lim[oó]n|Canela|Creatina|Hielo|Jengibre|Albahaca|Alga|Salsa|Mostaza|Vinagre|Caf[eé]|Proteína.*polvo|Leche|Bebida|Agua de coco/;
  const NO_ICON = new Set(['🥛', '🥤', '🥣', '🌾', '☕', '💪', '🧊', '🍯', '🫒', '🌿', '🌱']);

  // "camas" de comida que se dibujan como textura (arroz, pasta, salsas, cremas...)
  const BEDS = [
    { re: /^Arroz/, kind: 'rice' }, { re: /^Quinoa|^Cusc/, kind: 'quinoa' }, { re: /^Pasta/, kind: 'pasta' },
    { re: /^Lentejas/, kind: 'stew' }, { re: /^Hummus/, kind: 'hummus' },
    { re: /^Yogur|^Skyr|^Queso fresco batido|^K[eé]fir/, kind: 'cream' }, { re: /^Avena|^Muesli/, kind: 'oats' },
    { re: /^Tomate triturado/, kind: 'sauce', min: 100 }, { re: /^Calabaza/, kind: 'soup', soup: '#f29a3a' },
    { re: /^Calabac[ií]n/, kind: 'soup', soup: '#a6c66a' }, { re: /^Coliflor/, kind: 'puree' }, { re: /^Lechuga|^R[uú]cula|^Kale|^Espinacas/, kind: 'leaves', min: 60 }
  ];
  function pickBed(d) {
    const soupy = /Crema|Pur[eé]|Porridge|Bowl|Overnight|Yogur|Curry|Lentejas|Shakshuka|Boloñesa/i.test(d.name);
    for (const b of BEDS) {
      const it = d.items.find(i => b.re.test(i.food.name) && i.g >= (b.min || 0));
      if (!it) continue;
      if ((b.kind === 'soup' || b.kind === 'puree') && !soupy) continue;
      if (b.kind === 'cream' && !soupy && d.look !== 'bowl') continue;
      return { ...b, item: it };
    }
    return null;
  }
  function drawBed(g, bed, cx, cy, rad, r) {
    g.save(); g.beginPath();
    // contorno orgánico
    const pts = 18;
    for (let i = 0; i <= pts; i++) { const a = (i / pts) * Math.PI * 2, rr = rad * (0.9 + r() * 0.12); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath();
    g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 10; g.shadowOffsetY = 3;
    const base = { rice: '#f7f3ea', quinoa: '#e9d7b0', pasta: '#f1d27a', stew: '#8a5a2b', hummus: '#e8cf9e', cream: '#f6f1e7', oats: '#e8d6b4', sauce: '#c4382a', soup: bed.soup || '#f29a3a', puree: '#f3ede0', leaves: '#5f9e3a' }[bed.kind];
    const rg = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad);
    rg.addColorStop(0, shadeCol(base, 18)); rg.addColorStop(1, shadeCol(base, -12));
    g.fillStyle = rg; g.fill(); g.shadowColor = 'transparent'; g.clip();
    const R = () => r();
    if (bed.kind === 'rice') {
      for (let i = 0; i < 420; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; g.fillStyle = R() > 0.3 ? '#ffffff' : '#e9e2d4'; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4.5, 2, R() * 3.14, 0, 6.283); g.fill(); }
    } else if (bed.kind === 'quinoa' || bed.kind === 'oats') {
      for (let i = 0; i < 520; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; g.fillStyle = bed.kind === 'oats' ? (R() > 0.5 ? '#d9c197' : '#f3e6cc') : (R() > 0.5 ? '#d8bf8c' : '#f4e7c8'); g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, bed.kind === 'oats' ? 3.4 : 2.2, 0, 6.283); g.fill(); }
    } else if (bed.kind === 'pasta') {
      g.lineCap = 'round';
      for (let i = 0; i < 70; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; g.strokeStyle = R() > 0.5 ? '#f6dc8e' : '#e2b95a'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (R() - 0.5) * 90, y + (R() - 0.5) * 90, x + (R() - 0.5) * 90, y + (R() - 0.5) * 90, x + (R() - 0.5) * 60, y + (R() - 0.5) * 60); g.stroke(); }
    } else if (bed.kind === 'stew' || bed.kind === 'sauce') {
      for (let i = 0; i < (bed.kind === 'stew' ? 260 : 60); i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; g.fillStyle = bed.kind === 'stew' ? (R() > 0.5 ? '#6b4220' : '#a0703c') : 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, bed.kind === 'stew' ? 4 : 6, 0, 6.283); g.fill(); }
    } else if (bed.kind === 'leaves') {
      for (let i = 0; i < 26; i++) { const a = R() * 6.283, rr = Math.sqrt(R()) * rad; g.fillStyle = ['#7bbf4a', '#4f8f2f', '#9ccf62'][i % 3]; g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(R() * 6.283); g.beginPath(); g.ellipse(0, 0, 26, 13, 0, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.stroke(); g.restore(); }
    } else {
      // crema / sopa / puré / hummus: remolino
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
      g.beginPath(); for (let t = 0; t < 26; t += 0.15) { const rr = t * rad / 30, x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      if (bed.kind === 'hummus' || bed.kind === 'soup') { g.fillStyle = 'rgba(200,150,20,.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(cx + (R() - 0.5) * rad, cy + (R() - 0.5) * rad, 6, 3, R() * 3, 0, 6.283); g.fill(); } }
    }
    // brillo
    const sh = g.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, 0, cx - rad * 0.35, cy - rad * 0.4, rad * 0.7);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    g.restore();
  }
  function shadeCol(hex, pct) { return shade(hex, pct); }

  async function drawItems(g, d, cx, cy, R, r, isBowl) {
    const bed = pickBed(d);
    if (bed) drawBed(g, bed, isBowl ? cx : cx - R * 0.18, isBowl ? cy : cy + R * 0.04, isBowl ? R * 1.02 : R * 0.72, r);
    const seen = new Set();
    let items = d.items.filter(i => !(bed && i === bed.item) && !NO_ICON.has(i.food.emoji) && (!SMALL.test(i.food.name) || i.g >= 80))
      .sort((a, b) => b.g - a.g)
      .filter(i => { if (seen.has(i.food.emoji)) return false; seen.add(i.food.emoji); return true; }).slice(0, 5);
    if (!items.length && !bed) items = d.items.filter(i => !NO_ICON.has(i.food.emoji)).slice(0, 1);
    const maxG = Math.max(1, ...items.map(i => i.g));
    // posiciones: si hay cama, los ingredientes se reparten alrededor/encima
    const pos = bed
      ? (isBowl ? [[0.12, -0.08], [0.45, 0.42], [-0.42, 0.4], [-0.4, -0.42], [0.5, -0.5]] : [[0.52, -0.18], [0.36, 0.5], [-0.18, -0.55], [-0.6, 0.38], [0.66, 0.2]])
      : [[-0.15, 0.0], [0.55, -0.35], [0.52, 0.42], [-0.55, 0.5], [-0.5, -0.5]];
    const draws = [];
    items.forEach((it, k) => {
      const main = k === 0;
      const size = R * (main ? (bed ? 1.05 : 1.35) : 0.82) * (0.75 + 0.25 * Math.sqrt(it.g / maxG));
      const [px, py] = pos[k];
      const many = !main && (it.food.cat === 'fru' || it.food.cat === 'ver' || it.food.cat === 'leg' || it.food.cat === 'gra') && it.g >= 40;
      const n = many ? (it.g >= 120 ? 3 : 2) : 1;
      for (let j = 0; j < n; j++) {
        const jx = j ? (r() - 0.5) * size * 0.75 : 0, jy = j ? (r() - 0.5) * size * 0.65 : 0;
        draws.push({ e: it.food.emoji, x: cx + px * R + jx, y: cy + py * R + jy, s: size * (j ? 0.8 : 1), rot: (r() - 0.5) * 0.8, z: main ? 2 : (j ? 0 : 1) });
      }
    });
    draws.sort((a, b) => a.z - b.z || a.s - b.s);
    for (const dr of draws) {
      const src = icon(dr.e); if (!src) continue;
      const im = await loadImg(src); if (!im) continue;
      g.save(); g.translate(dr.x, dr.y); g.rotate(dr.rot);
      g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 16; g.shadowOffsetY = 7;
      g.drawImage(im, -dr.s / 2, -dr.s / 2, dr.s, dr.s);
      g.restore();
    }
  }
  function oilAndHerbs(g, d, cx, cy, R, r) {
    if (d.items.some(i => /Aceite/.test(i.food.name))) {
      g.save(); g.fillStyle = 'rgba(214,170,30,.5)';
      for (let i = 0; i < 8; i++) { const a = r() * Math.PI * 2, rr = R * (0.3 + r() * 0.5); g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3 + r() * 6, 2 + r() * 3, r() * 3, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    // hierbas frescas y pimienta
    g.save();
    for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, rr = r() * R * 0.9; g.fillStyle = r() > 0.5 ? '#3f8a2c' : '#5fae3e'; g.beginPath(); g.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 3.5, 1.8, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = 'rgba(40,30,20,.6)';
    for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, rr = r() * R * 0.85; g.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.7, 1.7); }
    g.restore();
  }

  /* ---------- batidos ---------- */
  async function drawShake(g, d, r) {
    const col = d.color || '#e9d3b0';
    const gx = W * 0.5, top = H * 0.12, bot = H * 0.9, wTop = 150, wBot = 120;
    // sombra
    g.save(); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(gx + 20, bot + 6, wBot * 0.75, 16, 0, 0, Math.PI * 2); g.fill(); g.restore();
    // ingredientes alrededor
    const seen = new Set();
    const items = d.items.filter(i => !NO_ICON.has(i.food.emoji) && !/Hielo|Leche|Bebida|Agua de coco|Café/.test(i.food.name))
      .filter(i => { if (seen.has(i.food.emoji)) return false; seen.add(i.food.emoji); return true; }).slice(0, 5);
    const spots = [[0.2, 0.76, 150], [0.8, 0.78, 140], [0.12, 0.42, 104], [0.88, 0.44, 100], [0.33, 0.95, 84]];
    for (let k = 0; k < items.length; k++) {
      const src = icon(items[k].food.emoji); if (!src) continue; const im = await loadImg(src); if (!im) continue;
      const [sx, sy, s] = spots[k];
      g.save(); g.translate(W * sx, H * sy); g.rotate((r() - 0.5) * 0.6);
      g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 12; g.shadowOffsetY = 6; g.drawImage(im, -s / 2, -s / 2, s, s); g.restore();
    }
    // vaso
    const path = () => { g.beginPath(); g.moveTo(gx - wTop / 2, top); g.lineTo(gx + wTop / 2, top); g.lineTo(gx + wBot / 2, bot); g.quadraticCurveTo(gx, bot + 14, gx - wBot / 2, bot); g.closePath(); };
    // líquido
    const lTop = top + 46;
    g.save(); path(); g.clip();
    const lg = g.createLinearGradient(gx - wTop / 2, 0, gx + wTop / 2, 0);
    lg.addColorStop(0, shade(col, -18)); lg.addColorStop(0.45, shade(col, 10)); lg.addColorStop(1, shade(col, -28));
    g.fillStyle = lg; g.fillRect(gx - wTop, lTop, wTop * 2, bot - lTop + 20);
    // espuma
    g.fillStyle = shade(col, 30); g.beginPath(); g.ellipse(gx, lTop, wTop / 2 - 6, 12, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(gx - 50 + r() * 100, lTop - 2 + r() * 8, 2 + r() * 4, 0, Math.PI * 2); g.fill(); }
    // vidrio
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(gx - wTop, top, wTop * 2, lTop - top);
    g.restore();
    path(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1.5; g.stroke();
    // reflejos
    g.save(); g.globalAlpha = 0.55; g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(gx - wTop / 2 + 16, top + 10); g.lineTo(gx - wTop / 2 + 30, top + 10); g.lineTo(gx - wBot / 2 + 26, bot - 16); g.lineTo(gx - wBot / 2 + 14, bot - 16); g.closePath(); g.fill(); g.restore();
    g.beginPath(); g.ellipse(gx, top, wTop / 2, 10, 0, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2.5; g.stroke();
    // pajita
    g.save(); g.translate(gx + 22, top + 30); g.rotate(0.32);
    g.fillStyle = '#ff5a78'; g.fillRect(-7, -150, 14, 170);
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let y = -150; y < 20; y += 26) g.fillRect(-7, y, 14, 9);
    g.restore();
  }
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * (pct > 0 ? 255 - v : v))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  /* ---------- composición ---------- */
  async function render(d) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), r = rng(d.id + d.name);
    const type = d.type || 'comida';
    g.drawImage(surface(type), 0, 0);
    if (d.look === 'shake') { await drawShake(g, d, r); }
    else {
      napkin(g, type, r);
      const cx = W * 0.47, cy = H * 0.52;
      if (d.look === 'bowl') { const R = 200; bowl(g, cx, cy, R, BOWL_COL[type] || BOWL_COL.comida); await drawItems(g, d, cx, cy, R * 0.8, r, true); oilAndHerbs(g, d, cx, cy, R * 0.72, r); }
      else { const R = 218; plate(g, cx, cy, R, type === 'cena'); await drawItems(g, d, cx, cy, R * 0.72, r, false); oilAndHerbs(g, d, cx, cy, R * 0.66, r); }
    }
    // luz cálida
    const lt = g.createLinearGradient(0, 0, W, H); lt.addColorStop(0, 'rgba(255,240,215,.16)'); lt.addColorStop(1, 'rgba(0,0,0,.06)');
    g.fillStyle = lt; g.fillRect(0, 0, W, H);
    return c.toDataURL('image/jpeg', 0.84);
  }
  function get(d) {
    if (!cache.has(d.id)) cache.set(d.id, render(d).catch(() => null));
    return cache.get(d.id);
  }
  /** Rellena todas las <img data-dart="id"> que haya en pantalla. */
  async function fill(root) {
    const els = [...(root || document).querySelectorAll('img[data-dart]')];
    for (const el of els) {
      const d = DISHES.find(x => x.id === el.dataset.dart); if (!d) continue;
      const url = await get(d); if (url && el.isConnected) { el.src = url; el.classList.add('ready'); }
    }
  }
  return { get, fill, icon };
})();
