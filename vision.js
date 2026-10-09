'use strict';
/* =====================================================================
   MacroFit · Coach con imágenes
   1) Leer etiquetas nutricionales con OCR en el propio dispositivo
      (Tesseract, sin internet ni servidores).
   2) Analizar un plato a partir de su foto: estimación guiada por
      raciones visuales (palma, puño, pulgar) y consejo del coach.
   ===================================================================== */
const Vision = (() => {
  /* ------------------------------------------------------------------
     OCR
     ------------------------------------------------------------------ */
  let worker = null, workerReady = null, seq = 0;
  const pending = new Map();

  function workerMain() {
    let api = null, Mod = null;
    self.onmessage = async (e) => {
      const { id, type } = e.data;
      try {
        if (type === 'init') {
          Mod = await TesseractCore({});
          Mod.FS.writeFile('spa.traineddata', new Uint8Array(e.data.lang));
          api = new Mod.TessBaseAPI();
          const st = api.Init(null, 'spa', 1);
          if (st !== 0) throw new Error('No se pudo iniciar el lector (' + st + ')');
          api.SetVariable('preserve_interword_spaces', '1');
          self.postMessage({ id, ok: true });
        } else if (type === 'rec') {
          Mod.FS.writeFile('/input', new Uint8Array(e.data.img));
          api.SetVariable('tessedit_pageseg_mode', String(e.data.psm || 6));
          if (api.SetImageFile(1, 0) === 1) throw new Error('No se pudo leer la imagen');
          api.Recognize(null);
          self.postMessage({ id, text: api.GetUTF8Text() });
        }
      } catch (err) { self.postMessage({ id, error: String((err && err.message) || err) }); }
    };
  }
  function call(msg, transfer) {
    return new Promise((res, rej) => {
      const id = ++seq; pending.set(id, { res, rej });
      worker.postMessage(Object.assign({ id }, msg), transfer || []);
    });
  }
  function initOCR() {
    if (workerReady) return workerReady;
    workerReady = (async () => {
      const [code, lang] = await Promise.all([
        fetch('ocr-core.js').then(r => { if (!r.ok) throw new Error('falta ocr-core.js'); return r.text(); }),
        fetch('ocr-spa.traineddata').then(r => { if (!r.ok) throw new Error('falta ocr-spa.traineddata'); return r.arrayBuffer(); })
      ]);
      const url = URL.createObjectURL(new Blob([code + '\n;(' + workerMain.toString() + ')();'], { type: 'application/javascript' }));
      worker = new Worker(url);
      worker.onmessage = e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.rej(new Error(e.data.error)) : p.res(e.data); };
      await call({ type: 'init', lang }, [lang]);
    })();
    workerReady.catch(() => { workerReady = null; });
    return workerReady;
  }
  // prepara la foto: tamaño adecuado, escala de grises y contraste
  function prepImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const long = Math.max(img.width, img.height), sc = Math.min(2.2, 1800 / long);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
        const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
        let lo = 255, hi = 0; const lum = new Uint8ClampedArray(d.length / 4);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; lum[j] = v; }
        const hist = new Array(256).fill(0); lum.forEach(v => hist[v]++);
        let acc = 0; const n = lum.length; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.02) { lo = v; break; } }
        acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.02) { hi = v; break; } }
        const span = Math.max(30, hi - lo);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (lum[j] - lo) * 255 / span)); d[i] = d[i + 1] = d[i + 2] = v; }
        g.putImageData(id, 0, 0);
        const preview = c.toDataURL('image/jpeg', 0.6);
        c.toBlob(b => { URL.revokeObjectURL(url); b.arrayBuffer().then(buf => res({ buf, preview })); }, 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo abrir la foto')); };
      img.src = url;
    });
  }

  /* ---------- interpretación del texto ---------- */
  const N = s => norm(s).replace(/[|]/g, ' ');
  function fixNums(s) {
    return s.replace(/(^|[\s:(])[oO](?=[,.]\d)/g, '$10').replace(/(\d)\s*[,]\s*(\d)/g, '$1.$2').replace(/(\d)\s+\.(\d)/g, '$1.$2');
  }
  function numAfter(line, idx) {
    const m = fixNums(line.slice(idx)).match(/<?\s*(\d+(?:\.\d+)?)(\s*(?:g|gr|9)\b)?/);
    if (!m) return null;
    let raw = m[1];
    // el OCR suele leer la "g" de gramos como un 9 pegado al número (7,0g -> 7,09)
    if (!m[2] && /9$/.test(raw) && (/\.\d{2,}$/.test(raw) || parseFloat(raw) > 100)) raw = raw.slice(0, -1).replace(/\.$/, '');
    return parseFloat(raw);
  }
  function parseLabel(text) {
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const out = {};
    // energía
    for (const l of lines) {
      const n = fixNums(N(l));
      let m = n.match(/(\d+(?:\.\d+)?)\s*k\s*c\s*a\s*l/);
      if (m) { out.kcal = parseFloat(m[1]); break; }
    }
    if (out.kcal == null) {
      for (const l of lines) {
        const n = fixNums(N(l));
        const m = n.match(/(\d+(?:\.\d+)?)\s*kj/);
        if (m) { out.kcal = Math.round(parseFloat(m[1]) / 4.184); out.fromKj = true; break; }
      }
    }
    const find = (re, exclude) => {
      for (const l of lines) {
        const n = N(l); const m = n.match(re);
        if (!m || (exclude && exclude.test(n))) continue;
        const v = numAfter(n, m.index + m[0].length);
        if (v != null && v < 1000) return v;
      }
      return null;
    };
    out.f = find(/grasas?|lipidos|materia grasa|fat/, /saturad|satur|trans|mono|poli|de las cuales/);
    out.c = find(/hidratos( de carbono)?|carbohidratos|glucidos|carbohydrate/, /azucar|sugar|de los cuales/);
    out.p = find(/proteinas?|protein/);
    out.sug = find(/azucares|azucar|sugars?/);
    out.fib = find(/fibra|fibre|fiber/);
    out.salt = find(/\bsal\b|salt/);
    // coherencia
    const calc = (out.p || 0) * 4 + (out.c || 0) * 4 + (out.f || 0) * 9;
    if (out.kcal == null && calc > 0) { out.kcal = Math.round(calc); out.kcalCalc = true; }
    out.found = ['kcal', 'p', 'c', 'f'].filter(k => out[k] != null).length;
    out.incoherent = out.kcal != null && calc > 0 && Math.abs(out.kcal - calc) > Math.max(40, out.kcal * 0.3);
    return out;
  }
  // sección probable según los macros
  function guessSection(v) {
    const p = v.p || 0, c = v.c || 0, f = v.f || 0, k = v.kcal || 1;
    if (p * 4 / k > 0.4) return 'prot';
    if (f * 9 / k > 0.6 && k > 350) return 'gra';
    if (c * 4 / k > 0.6 && k > 200) return 'cer';
    if (k < 80 && c < 15) return 'ver';
    return 'otr';
  }

  async function readLabel(file) {
    openSheet(`<div class="sheet-h"><h2>Leer etiqueta</h2><button class="x" data-act="closeSheet">✕</button></div>
      <div class="card" style="text-align:center"><div class="spinner"></div><p class="bold" id="ocr-st">Preparando la foto…</p>
      <p class="small muted">Todo se procesa en tu móvil, sin enviar nada a internet. La primera vez tarda un poco más.</p></div>`, true);
    const st = t => { const el = $('#ocr-st'); if (el) el.textContent = t; };
    try {
      const { buf, preview } = await prepImage(file);
      st('Cargando el lector de etiquetas…');
      await initOCR();
      st('Leyendo los valores nutricionales…');
      let res = await call({ type: 'rec', img: buf, psm: 6 }, [buf]);
      let v = parseLabel(res.text);
      if (v.found < 3) { // segundo intento con otra segmentación
        const again = await prepImage(file);
        const res2 = await call({ type: 'rec', img: again.buf, psm: 4 }, [again.buf]);
        const v2 = parseLabel(res2.text);
        if (v2.found > v.found) { v = v2; res = res2; }
      }
      if (!$('#sheet').classList.contains('open')) return;
      const note = v.found >= 3
        ? `He leído la etiqueta${v.fromKj ? ' (calorías calculadas desde kJ)' : ''}. Revisa los valores y ponle nombre antes de guardar.`
        : 'No he podido leer bien todos los valores. Rellena o corrige lo que falte (haz la foto de frente, con buena luz y solo la tabla).';
      newFoodSheet({ img: preview, name: '', sec: guessSection(v), kcal: v.kcal != null ? Math.round(v.kcal) : '', p: v.p ?? '', c: v.c ?? '', f: v.f ?? '',
        note: note + (v.incoherent ? ' Ojo: las calorías no cuadran con los macros, compruébalo.' : ''), warn: v.found < 3 || v.incoherent }, 'coach');
    } catch (e) {
      openSheet(`<div class="sheet-h"><h2>Leer etiqueta</h2><button class="x" data-act="closeSheet">✕</button></div>
        <div class="after bad">No he podido leer la foto (${esc(e.message)}). Puedes introducir los valores a mano.</div>
        <button class="btn" data-act="labelManual">Introducir a mano</button>`, true);
    }
  }
  function afterLabelSaved(food) {
    closeSheet();
    const k = food.kcal || 1, pp = Math.round((food.p * 4 / k) * 100);
    let ev = [];
    if (food.p >= 15 && pp >= 30) ev.push('es una buena fuente de proteína');
    if (food.kcal >= 400) ev.push('es muy calórico, mide bien la ración');
    if (food.f * 9 / k > 0.5 && food.kcal > 250) ev.push('la mayoría de sus calorías vienen de la grasa');
    if (food.c * 4 / k > 0.7 && food.kcal > 300) ev.push('es rico en hidratos: mejor alrededor del entrenamiento');
    if (!ev.length) ev.push('encaja sin problema en tu plan si respetas la ración');
    lastLabelFood = food.id;
    S.coach.chat.push({ r: 'bot', t: `He guardado **${food.name}** en **${CATS[food.cat].l}**.\nPor 100 g: ${Math.round(food.kcal)} kcal · P ${food.p} g · H ${food.c} g · G ${food.f} g.\n\nMi opinión: ${ev.join('; ')}.`, chips: ['➕ Añadir al diario', '¿Qué me queda hoy?'] });
    save(); setTab('coach');
  }
  let lastLabelFood = null;

  /* ------------------------------------------------------------------
     Análisis de plato
     ------------------------------------------------------------------ */
  // raciones visuales (método de la mano)
  const PORTIONS = {
    prot: [['½ palma', 60], ['1 palma', 120], ['2 palmas', 240]],
    cer: [['½ puño', 75], ['1 puño', 150], ['2 puños', 300]],
    leg: [['½ puño', 75], ['1 puño', 150], ['2 puños', 300]],
    ver: [['1 puño', 80], ['2 puños', 160], ['3 puños', 240]],
    fru: [['½ pieza', 0.5], ['1 pieza', 1], ['2 piezas', 2]],
    lact: [['½ ración', 0.5], ['1 ración', 1], ['2 raciones', 2]],
    gra: [['1 pulgar', 10], ['2 pulgares', 20], ['3 pulgares', 30]],
    otr: [['poco', 0.5], ['1 ración', 1], ['mucho', 2]]
  };
  const unitBased = cat => cat === 'fru' || cat === 'lact' || cat === 'otr';
  let plateCtx = null;

  function portionGrams(food, idx) {
    const opts = PORTIONS[food.cat] || PORTIONS.otr, v = opts[idx][1];
    if (unitBased(food.cat)) return Math.round(v * (food.ug || (food.cat === 'fru' ? 150 : food.cat === 'lact' ? 125 : 15)));
    if (food.cat === 'gra' && /Aceite/.test(food.name)) return v;
    if (food.cat === 'gra' && food.ug) return Math.round(v / 10 * food.ug);
    return v;
  }
  async function analyzePlate(file) {
    let photo = null;
    try { photo = await resizeImage(file, 900); } catch (e) { /* sin foto */ }
    plateCtx = { photo, items: [], q: '', slot: slotFor(new Date()) };
    renderPlate();
  }
  function plateTotals() {
    return plateCtx.items.reduce((a, it) => { const m = gramsMacros(it.food, it.g); return { kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, g: a.g + it.g }; }, { kcal: 0, p: 0, c: 0, f: 0, g: 0 });
  }
  function advice(t) {
    const plan = getPlan(), out = [];
    if (!plateCtx.items.length) return '';
    const shares = { desayuno: 0.25, almuerzo: 0.1, comida: 0.35, merienda: 0.1, cena: 0.2 };
    const rem = remaining(curDate);
    if (plan) {
      const target = plan.kcal * shares[plateCtx.slot];
      if (rem && t.kcal > rem.kcal) out.push(`Con este plato te pasarías <b>${r0(t.kcal - rem.kcal)} kcal</b> hoy. Prueba a dejar un tercio de los hidratos o reducir el aceite.`);
      else if (t.kcal > target * 1.3) out.push(`Es un plato abundante para ${slotInfo(plateCtx.slot).l.toLowerCase()} (lo ideal serían ~${r0(target)} kcal), pero te cabe en el día.`);
      else if (t.kcal < target * 0.6) out.push(`Es ligero para ${slotInfo(plateCtx.slot).l.toLowerCase()}: podrías añadir algo más (lo ideal serían ~${r0(target)} kcal).`);
      else out.push(`Tamaño adecuado para ${slotInfo(plateCtx.slot).l.toLowerCase()} (objetivo ~${r0(target)} kcal).`);
      const pTarget = plan.p * shares[plateCtx.slot];
      if (t.p < Math.min(25, pTarget * 0.7) && ['desayuno', 'comida', 'cena'].includes(plateCtx.slot)) out.push('Le falta proteína: añade pollo, pescado, huevos, legumbres o un yogur proteico.');
    }
    if (t.kcal > 0 && t.f * 9 / t.kcal > 0.45) out.push('Gran parte de las calorías vienen de la grasa: ojo con el aceite, las salsas y el queso.');
    if (!plateCtx.items.some(it => it.food.cat === 'ver')) out.push('Añade verdura o ensalada: más volumen y fibra por pocas calorías.');
    if (out.length === 1 && plan) out.push('¡Buen plato, bien equilibrado!');
    return out.map(x => `<li>${x}</li>`).join('');
  }
  function searchResults(q) {
    q = norm(q.trim()); if (q.length < 2) return '';
    const toks = q.split(/\s+/);
    const dishes = DISHES.filter(d => toks.every(t => norm(d.name).includes(t))).slice(0, 4);
    const foods = allFoods().filter(f => toks.every(t => norm(f.name).includes(t))).slice(0, 8);
    if (!dishes.length && !foods.length) return '<div class="empty">Sin resultados</div>';
    return dishes.map(d => `<button class="item" data-act="plateDish" data-id="${d.id}"><div class="em">${ico(d.emoji)}</div><div class="grow"><div class="t">${esc(d.name)}</div><div class="s">Plato completo · ${r0(d.m.kcal)} kcal</div></div><div class="r">＋</div></button>`).join('')
      + foods.map(f => `<button class="item" data-act="plateFood" data-id="${f.id}"><div class="em">${ico(f.emoji)}</div><div class="grow"><div class="t">${esc(f.name)}</div><div class="s">${r0(f.kcal)} kcal / 100 g</div></div><div class="r">＋</div></button>`).join('');
  }
  const QUICK = ['Pechuga de pollo (cruda)', 'Arroz blanco (cocido)', 'Pasta (cocida)', 'Patata (cocida)', 'Huevo entero', 'Salmón (crudo)', 'Ternera magra / solomillo (crudo)', 'Lechuga', 'Tomate', 'Brócoli', 'Aceite de oliva virgen extra', 'Pan blanco', 'Lentejas (cocidas)', 'Aguacate'];
  function renderPlate(keepScroll) {
    const sc = keepScroll ? $('#sheet-body').scrollTop : 0;
    const t = plateTotals(), ctx = plateCtx;
    const rows = ctx.items.map((it, i) => {
      const opts = PORTIONS[it.food.cat] || PORTIONS.otr;
      return `<div class="pitem"><div class="row"><div class="em">${ico(it.food.emoji)}</div><div class="grow"><div class="t">${esc(it.food.name)}</div><div class="s">${r0(it.g)} g · ${r0(gramsMacros(it.food, it.g).kcal)} kcal</div></div><button class="x" data-act="plateDel" data-i="${i}" aria-label="Quitar">✕</button></div>
        <div class="seg sm">${opts.map((o, k) => `<button class="${it.pi === k ? 'on' : ''}" data-act="platePortion" data-i="${i}" data-k="${k}">${o[0]}</button>`).join('')}<button class="${it.pi === -1 ? 'on' : ''}" data-act="plateGrams" data-i="${i}">g</button></div></div>`;
    }).join('');
    openSheet(`<div class="sheet-h"><h2 class="pagetitle">Analizar plato</h2><button class="x" data-act="closeSheet">✕</button></div>
      ${ctx.photo ? `<div class="hero"><img src="${ctx.photo}" alt="Tu plato"><span class="exlbl">Tu plato</span></div>` : ''}
      <p class="small muted" style="margin:10px 4px">Dime qué hay en el plato y el tamaño de cada cosa comparándolo con tu mano (palma = carne o pescado, puño = arroz, pasta o verdura, pulgar = aceite o frutos secos). Yo calculo las calorías y te aconsejo.</p>
      <div class="search"><span>🔍</span><input id="plate-q" type="search" placeholder="Buscar alimento o plato…" autocomplete="off" value="${esc(ctx.q)}"></div>
      <div class="list" id="plate-res">${searchResults(ctx.q)}</div>
      ${ctx.q ? '' : `<div class="chips" style="flex-wrap:wrap;overflow:visible">${QUICK.map(n => FOOD_BY_NAME[n]).filter(Boolean).filter(f => !ctx.items.some(it => it.food.id === f.id)).map(f => `<button class="chip" data-act="plateFood" data-id="${f.id}">${ico(f.emoji, 'chipico')} ${esc(f.name.replace(/\s*\(.*?\)/g, ''))}</button>`).join('')}</div>`}
      ${rows ? `<div class="section-h"><h2 style="font-size:18px">En tu plato</h2></div><div class="list">${rows}</div>` : ''}
      ${ctx.items.length ? `<div class="macrobox"><div class="mbx"><b>${r0(t.kcal)}</b><span>kcal</span></div><div class="mbx"><b style="color:var(--p)">${r0(t.p)}</b><span>Prot</span></div><div class="mbx"><b style="color:var(--c)">${r0(t.c)}</b><span>Hidr</span></div><div class="mbx"><b style="color:var(--f)">${r0(t.f)}</b><span>Grasa</span></div></div>
      <div class="card"><h3>Consejo del coach</h3><ul class="adv">${advice(t)}</ul></div>
      <div class="chips" style="margin-bottom:6px">${SLOTS.map(s => `<button class="chip ${ctx.slot === s.k ? 'on' : ''}" data-act="plateSlot" data-k="${s.k}">${s.e} ${s.l}</button>`).join('')}</div>
      <button class="btn" data-act="plateAdd">Añadir al diario (${slotInfo(ctx.slot).l})</button>
      <p class="hint" style="margin-top:10px;text-align:center">Es una estimación: el reconocimiento automático de comida por foto necesitaría una IA externa con internet.</p>` : ''}`, true);
    if (keepScroll) $('#sheet-body').scrollTop = sc;
  }
  function addFood(food, g, pi) {
    plateCtx.items.push({ food, g, pi });
  }
  const actions = {
    labelManual: () => newFoodSheet({ sec: 'otr' }, 'coach'),
    plateFood: el => { const f = foodById(el.dataset.id); if (!f) return; const pi = 1; addFood(f, portionGrams(f, pi), pi); plateCtx.q = ''; renderPlate(true); },
    plateDish: el => { const d = DISHES.find(x => x.id === el.dataset.id); if (!d) return; d.items.forEach(it => plateCtx.items.push({ food: it.food, g: it.g, pi: -1 })); plateCtx.q = ''; renderPlate(true); toast('Ingredientes añadidos: ajusta las cantidades'); },
    plateDel: el => { plateCtx.items.splice(+el.dataset.i, 1); renderPlate(true); },
    platePortion: el => { const it = plateCtx.items[+el.dataset.i]; it.pi = +el.dataset.k; it.g = portionGrams(it.food, it.pi); renderPlate(true); },
    plateGrams: el => { const it = plateCtx.items[+el.dataset.i]; const v = prompt(`Gramos de ${it.food.name}`, r0(it.g)); if (v == null) return; const g = num(v); if (g > 0) { it.g = g; it.pi = -1; renderPlate(true); } },
    plateSlot: el => { plateCtx.slot = el.dataset.k; renderPlate(true); },
    plateAdd: () => {
      const now = new Date(), k = curDate;
      plateCtx.items.forEach(it => { const m = gramsMacros(it.food, it.g); (S.logs[k] = S.logs[k] || []).push({ id: uid(), t: `${pad(now.getHours())}:${pad(now.getMinutes())}`, slot: plateCtx.slot, name: it.food.name, g: r1(it.g), kcal: r1(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fid: it.food.id, emoji: it.food.emoji }); });
      const t = plateTotals();
      save(); closeSheet(); toast(`${slotInfo(plateCtx.slot).e} ${r0(t.kcal)} kcal añadidas a ${slotInfo(plateCtx.slot).l}`);
      S.coach.chat.push({ r: 'bot', t: `He añadido tu plato (${r0(t.kcal)} kcal · P ${r0(t.p)} · H ${r0(t.c)} · G ${r0(t.f)}) a ${slotInfo(plateCtx.slot).l.toLowerCase()}.`, chips: ['¿Qué me queda hoy?', '¿Qué puedo comer ahora?'] });
      save(); if (tab === 'coach') render();
    }
  };
  function onInput(t) { if (t.id === 'plate-q' && plateCtx) { plateCtx.q = t.value; const el = $('#plate-res'); if (el) el.innerHTML = searchResults(t.value); return true; } return false; }
  async function recognize(file, psm) { const { buf } = await prepImage(file); await initOCR(); return (await call({ type: 'rec', img: buf, psm: psm || 6 }, [buf])).text; }
  return { readLabel, analyzePlate, afterLabelSaved, actions, onInput, parseLabel, initOCR, recognize, lastFood: () => lastLabelFood };
})();
