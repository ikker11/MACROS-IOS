'use strict';
/* =====================================================================
   Coach de MacroFit · asistente local (sin internet, sin API, sin coste)
   - Entiende preguntas frecuentes de nutrición y entrenamiento.
   - Usa tu perfil, tus registros y lo que le cuentas para personalizar.
   - Aprende de este dispositivo: gustos, molestias, hábitos y comidas frecuentes.
   ===================================================================== */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const Coach = (() => {
  const STOP = new Set(['de', 'con', 'sin', 'en', 'al', 'la', 'el', 'los', 'las', 'un', 'una', 'natural', 'entero', 'entera', 'crudo', 'cruda', 'crudos', 'crudas', 'cocido', 'cocida', 'cocidos', 'cocidas', 'lata', 'polvo', 'mezcla', 'light', 'fresco', 'escurrido', 'extra', 'virgen', 'blanco', 'blanca', 'magra', 'magro', 'proteina', 'solo', 'dulce', 'entero']);
  const tokens = s => norm(s).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9ñ\s%]/g, ' ').split(/\s+/).filter(Boolean);
  const sigTokens = s => tokens(s).filter(t => t.length > 2 && !STOP.has(t));
  const stem = t => (t.length > 5 ? t.slice(0, 5) : t);
  const has = (txt, re) => re.test(txt);

  function findFood(text) {
    const tt = tokens(text).map(stem);
    if (!tt.length) return null;
    let best = null, bestScore = 0;
    for (const f of allFoods()) {
      const ft = sigTokens(f.name);
      if (!ft.length) continue;
      const hit = ft.filter(t => tt.includes(stem(t))).length;
      if (!hit) continue;
      const score = hit / ft.length + hit * 0.01 - ft.length * 0.001;
      if (hit / ft.length >= 0.5 && score > bestScore) { bestScore = score; best = f; }
    }
    return best;
  }
  function findGrams(text, food) {
    const t = norm(text);
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos)\b/);
    if (m) return num(m[1]);
    m = t.match(/(\d+(?:[.,]\d+)?)\s+[a-z]/);
    if (m && food.ug && num(m[1]) <= 20) return num(m[1]) * food.ug;
    return food.ug || 100;
  }

  const fmtM = m => `${r0(m.kcal)} kcal · P ${r1(m.p)} g · H ${r1(m.c)} g · G ${r1(m.f)} g`;
  const plural = (n, a, b) => (n === 1 ? a : b);

  /* ---------------- estadísticas aprendidas del dispositivo ---------------- */
  function stats() {
    const plan = getPlan();
    const keys = []; for (let i = 0; i < 14; i++) keys.push(shiftDay(todayKey(), -i));
    const days = keys.filter(k => logOf(k).length);
    const freq = {}, slotKcal = {}, hours = [];
    days.forEach(k => logOf(k).forEach(e => {
      const key = e.fid || e.name; freq[key] = freq[key] || { n: 0, name: e.name, emoji: e.emoji }; freq[key].n++;
      slotKcal[e.slot] = (slotKcal[e.slot] || 0) + e.kcal;
      if (e.t) hours.push(parseInt(e.t.slice(0, 2), 10));
    }));
    const top = Object.values(freq).filter(x => x.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5);
    const tot = days.map(k => dayTotals(k));
    const avg = tot.length ? { kcal: tot.reduce((a, x) => a + x.kcal, 0) / tot.length, p: tot.reduce((a, x) => a + x.p, 0) / tot.length, c: tot.reduce((a, x) => a + x.c, 0) / tot.length, f: tot.reduce((a, x) => a + x.f, 0) / tot.length } : null;
    const lines = [];
    if (days.length >= 2) lines.push(`Has registrado comida ${days.length} de los últimos 14 días.`);
    if (avg && plan) {
      lines.push(`Media diaria: ${r0(avg.kcal)} kcal (objetivo ${plan.kcal}) y ${r0(avg.p)} g de proteína (objetivo ${plan.p}).`);
      const adh = days.filter(k => { const b = budget(k); const t = dayTotals(k); return b && Math.abs(t.kcal - b.kcal) <= b.kcal * 0.1; }).length;
      lines.push(`Días dentro de ±10% de tu objetivo: ${adh} de ${days.length}.`);
    }
    if (top.length) lines.push('Tus alimentos más repetidos: ' + top.map(x => x.name.replace(/\s*\(.*?\)/g, '')).join(', ') + '.');
    const big = Object.entries(slotKcal).sort((a, b) => b[1] - a[1])[0];
    if (big && days.length >= 3) lines.push(`Donde más calorías concentras: ${slotInfo(big[0]).l.toLowerCase()}.`);
    const late = hours.filter(h => h >= 22 || h < 4).length;
    if (late >= 3) lines.push('Sueles registrar comidas muy tarde (después de las 22:00).');
    const ws = Object.keys(S.workouts).filter(k => keys.includes(k) && S.workouts[k].length).length;
    if (ws) lines.push(`Has entrenado ${ws} ${plural(ws, 'día', 'días')} en las últimas 2 semanas.`);
    return { days: days.length, avg, top, lines, plan };
  }

  /* ---------------- aprendizaje a partir de lo que dices ---------------- */
  function pushUnique(arr, v) { v = v.trim().replace(/[.!?,;]+$/, ''); if (v && v.length < 40 && !arr.map(norm).includes(norm(v))) { arr.push(v); return true; } return false; }
  const cleanItem = s => s.replace(/^(el|la|los|las|un|una|comer|tomar)\s+/i, '').replace(/\s+(por favor|la verdad|nada)$/i, '').trim();

  function learn(raw) {
    const t = norm(raw), r = raw.toLowerCase(), P = S.coach.prefs, out = [];
    let m;
    if ((m = r.match(/(?:no me gusta(?:n)?|odio|detesto|no soporto|no quiero(?: comer)?)\s+(.+)/))) {
      m[1].split(/\s+(?:y|ni)\s+|,/).forEach(x => { x = cleanItem(x); if (x && pushUnique(P.dislikes, x)) out.push(`no te gusta ${x}`); });
    }
    if ((m = r.match(/alergi[ac]s?\s+(?:a|al|a la|a los|a las)\s+(.+)/)) || (m = r.match(/intolerancia\s+(?:a|al)\s+(.+)/))) {
      const x = cleanItem(m[1]); if (pushUnique(P.dislikes, x)) out.push(`evitar ${x} (alergia/intolerancia)`);
    }
    if (!/no me gusta/.test(t) && (m = r.match(/\bme (?:gusta(?:n)?|encanta(?:n)?|apetece(?:n)?)\s+(?:mucho\s+)?(?:el |la |los |las )?(.+)/))) {
      const x = cleanItem(m[1]);
      if (x && !/(entrenar|correr|gimnasio|hacer)/.test(norm(x)) && pushUnique(P.likes, x)) out.push(`te gusta ${x}`);
    }
    if (/\bsoy vegetarian[oa]\b/.test(t)) { S.profile.diet = 'veg'; out.push('eres vegetariano/a (lo he aplicado a tu perfil)'); }
    if (/\bsoy vegan[oa]\b/.test(t)) { S.profile.diet = 'vgn'; out.push('eres vegano/a (lo he aplicado a tu perfil)'); }
    if ((m = t.match(/\b(?:me duele|me duelen|dolor de|dolor en|lesion(?:ado|ada)? (?:de|en)(?: la| el)?|molestias? en|tengo (?:una )?lesion (?:de|en)(?: la| el)?)\s*(?:la |el |mi |las |los )?(rodillas?|espalda|lumbar(?:es)?|hombros?|tobillos?|munecas?|cadera|codos?|cuello)/))) {
      let p = m[1].replace(/s$/, '').replace('lumbare', 'lumbar'); if (p === 'muneca') p = 'muñeca';
      if (pushUnique(P.injuries, p)) out.push(`tienes molestias en ${p}: adaptaré los ejercicios`);
    }
    if ((m = t.match(/\bentreno (?:por la |en la |de )?(manana|tarde|noche)/))) { P.when = m[1] === 'manana' ? 'mañana' : m[1]; out.push(`entrenas por la ${P.when}`); }
    if ((m = t.match(/\btengo (\d{2,3})\s*(?:min|minutos)/))) { P.mins = Math.max(20, Math.min(120, +m[1])); out.push(`dispones de ${P.mins} min por sesión`); }
    if (/\b(?:no tengo gimnasio|entreno en casa|entreno desde casa|solo en casa)\b/.test(t)) { P.place = 'c'; out.push('entrenas en casa'); }
    if (/\b(?:voy al gimnasio|tengo gimnasio|entreno en el gimnasio|entreno en el gym)\b/.test(t)) { P.place = 'g'; out.push('entrenas en gimnasio'); }
    if (out.length) save();
    return out;
  }

  /* ---------------- respuestas ---------------- */
  function welcome() {
    const n = S.profile.name ? S.profile.name.split(' ')[0] : '';
    return `¡Hola${n ? ', ' + n : ''}! Soy tu coach de nutrición y deporte. Vivo dentro de esta app y funciono sin internet.\n\nPuedo decirte qué te queda por comer, proponerte platos que encajen con tus macros, consultar los macros de un alimento, ajustar tu entrenamiento o resolver dudas. Cuanto más uses la app, mejor te conoceré.`;
  }
  const baseChips = () => ['¿Qué me queda hoy?', '¿Qué puedo comer ahora?', 'Recomiéndame un batido', 'Rutina de hoy'];

  function needPlan() {
    return { t: 'Para darte cifras exactas necesito tu perfil (edad, altura, peso y objetivo). Complétalo en la pestaña **Perfil** y calcularé tus macros al instante.', chips: ['Cuánta proteína necesito', 'Consejos para perder grasa'] };
  }

  function answerRemaining() {
    const plan = getPlan(); if (!plan) return needPlan();
    const k = todayKey(), rem = remaining(k), tot = dayTotals(k), b = budget(k);
    if (!logOf(k).length) return { t: `Hoy todavía no has registrado nada. Tu objetivo es **${r0(b.kcal)} kcal**: ${plan.p} g de proteína, ${r0(b.c)} g de hidratos y ${plan.f} g de grasas.`, chips: ['¿Qué desayuno?', '¿Qué puedo comer ahora?'] };
    let t = `Llevas **${r0(tot.kcal)} kcal** y te quedan **${r0(rem.kcal)} kcal**.\n- Proteína: ${r0(rem.p)} g restantes\n- Hidratos: ${r0(rem.c)} g restantes\n- Grasas: ${r0(rem.f)} g restantes`;
    if (rem.kcal < 0) t = `Hoy has superado tu objetivo en **${r0(-rem.kcal)} kcal**. No pasa nada: un día no define el progreso. Mañana vuelve a tu plan y prioriza proteína y verduras.`;
    else if (rem.p > 25) t += `\n\nTe falta bastante proteína: una buena forma de cubrirla es con ${proteinIdeas(rem).join(', ')}.`;
    else if (rem.p <= 5 && rem.kcal > 150) t += '\n\nLa proteína ya está cubierta; usa lo que queda en fruta, verdura o hidratos de calidad.';
    return { t, chips: ['¿Qué puedo comer ahora?', 'Ideas de snack'] };
  }

  function proteinIdeas(rem) {
    const prefD = S.coach.prefs.dislikes.map(norm);
    const pool = FOODS.filter(f => f.p >= 12 && f.kcal / Math.max(f.p, 1) < 9 && !prefD.some(d => d.length > 2 && norm(f.name).includes(d)));
    const dietOK = f => S.profile.diet === 'omni' || !['prot'].includes(f.cat) || /Tofu|Tempeh|Seit|vegetal|Huevo|Clara|whey/.test(f.name);
    return pool.filter(dietOK).sort((a, b) => b.p / b.kcal - a.p / a.kcal).slice(0, 4).map(f => f.name.replace(/\s*\(.*?\)/g, '').toLowerCase());
  }

  function suggestDishes(type, count = 3) {
    const plan = getPlan();
    let list = DISHES.filter(d => d.type === type && dishAllowed(d));
    const st = stats(), liked = S.coach.prefs.likes.map(norm), topNames = st.top.map(x => norm(x.name));
    const scored = list.map(d => {
      const tg = dishTarget(d.type); const sc = tg ? dishScale(d, tg.kcal) : 1;
      let fit = plan ? dishFit(d, sc) : 0.5;
      const hay = norm(d.name + ' ' + d.items.map(i => i.food.name).join(' '));
      if (liked.some(l => l.length > 2 && hay.includes(l))) fit += 0.12;
      if (topNames.some(n => d.items.some(i => norm(i.food.name) === n))) fit += 0.05;
      return { d, sc, fit };
    }).sort((a, b) => b.fit - a.fit);
    return scored.slice(0, count);
  }
  function answerSuggest(text) {
    const plan = getPlan();
    let slot = null;
    if (/desayun/.test(text)) slot = 'desayuno'; else if (/almuerz/.test(text)) slot = 'almuerzo'; else if (/merend|snack|pica|tentempie/.test(text)) slot = 'merienda';
    else if (/cen[ao]|cenar/.test(text)) slot = 'cena'; else if (/(comer|comida|como|mediodia)\b/.test(text) && !/ahora/.test(text)) slot = 'comida';
    if (!slot) slot = slotFor(new Date());
    const shake = /batido|smoothie|zumo|licuado/.test(text);
    const type = shake ? 'batido' : slotInfo(slot).type, picks = suggestDishes(type);
    if (!picks.length) return { t: 'No encuentro platos que encajen con tus preferencias. Prueba a quitar algún «no me gusta» desde el botón 🧠 Aprendido.', chips: baseChips() };
    const rem = plan ? remaining(todayKey()) : null;
    let t = `Para ${shake ? 'un batido' : type === 'snack' ? 'un snack' : 'tu ' + slotInfo(slot).l.toLowerCase()}${rem ? ` (te quedan ${r0(rem.kcal)} kcal)` : ''} te recomiendo:\n`;
    picks.forEach(({ d, sc }) => { const m = { kcal: d.m.kcal * sc, p: d.m.p * sc, c: d.m.c * sc, f: d.m.f * sc }; t += `- **${d.name}**${sc !== 1 ? ` (ración ×${sc})` : ''}: ${r0(m.kcal)} kcal · P ${r0(m.p)} · H ${r0(m.c)} · G ${r0(m.f)}\n`; });
    t += '\nTienes la receta de cada uno en la pestaña **Restaurante**, donde puedes añadirlos a tu día con un toque.';
    return { t, chips: ['Otra idea de snack', '¿Qué me queda hoy?', 'Proteína rápida'] };
  }

  function answerFood(text) {
    const f = findFood(text); if (!f) return null;
    const g = findGrams(text, f), m = gramsMacros(f, g);
    let t = `**${f.name}** (${r0(g)} g): ${fmtM(m)}.`;
    const plan = getPlan();
    if (plan && /(puedo|me cabe|encaja|me como|comer|tomar|va bien)/.test(norm(text))) {
      const rem = remaining(todayKey());
      const after = rem.kcal - m.kcal;
      t += after >= 0 ? `\n\nSí te cabe: después te quedarían ${r0(after)} kcal y ${r0(rem.p - m.p)} g de proteína.` : `\n\nTe pasarías ${r0(-after)} kcal hoy. Si te apetece, reduce la cantidad o compénsalo con una comida más ligera.`;
    }
    if (f.p >= 18 && f.kcal < 200) t += '\n\nEs una fuente de proteína muy eficiente por calorías.';
    else if (f.kcal > 450) t += '\n\nEs muy denso en calorías: mide la ración con báscula, que unos gramos de más suman rápido.';
    return { t, chips: ['¿Qué me queda hoy?', 'Proteína rápida'] };
  }

  function answerProteinNeeds() {
    const kg = num(S.profile.kg), plan = getPlan();
    if (!kg) return { t: 'Las guías deportivas recomiendan entre **1,6 y 2,2 g de proteína por kg de peso** al día si entrenas fuerza (más cerca de 2,0-2,2 g/kg cuando estás en déficit). Pon tu peso en el perfil y te doy tu cifra exacta.', chips: ['Consejos para perder grasa'] };
    return { t: `Para tu objetivo (${GOALS[S.profile.goal].l.toLowerCase()}) tu objetivo es **${plan ? plan.p : r0(kg * 1.8)} g de proteína al día** (~${(((plan ? plan.p : kg * 1.8) / kg)).toFixed(1).replace('.', ',')} g/kg).\n\nRepártela en 3-5 tomas de 25-40 g: es lo que mejor funciona para mantener y construir músculo. Buenas fuentes: ${proteinIdeas({ p: 40 }).join(', ')}.`, chips: ['Proteína rápida', '¿Qué me queda hoy?'] };
  }
  function answerQuickProtein() {
    const ideas = FOODS.filter(f => f.p >= 10 && f.kcal < 220 && (S.profile.diet === 'omni' || /Tofu|Tempeh|Seit|vegetal|Huevo|Clara|whey|Skyr|Yogur|Queso|Edamame|Lentejas/.test(f.name))).sort((a, b) => b.p / b.kcal - a.p / a.kcal).slice(0, 6);
    return { t: 'Opciones rápidas y ricas en proteína por calorías:\n' + ideas.map(f => `- **${f.name.replace(/\s*\(.*?\)/g, '')}**: ${f.p} g de proteína por 100 g (${r0(f.kcal)} kcal)`).join('\n'), chips: ['¿Qué me queda hoy?', 'Ideas de snack'] };
  }

  function answerProgress() {
    const st = stats(), plan = st.plan;
    if (st.days < 2) return { t: 'Todavía tengo pocos datos tuyos. Registra tus comidas unos días y te haré un resumen con tu media de calorías, proteína y hábitos.', chips: ['¿Qué me queda hoy?'] };
    let t = '**Tu resumen de las últimas semanas**\n' + st.lines.map(l => '- ' + l).join('\n');
    if (plan && st.avg) {
      const dk = st.avg.kcal - plan.kcal, dp = st.avg.p - plan.p;
      t += '\n\n**Mi lectura:** ';
      if (Math.abs(dk) <= plan.kcal * 0.07) t += 'vas muy ajustado a tu objetivo calórico, buen trabajo. ';
      else if (dk > 0) t += `de media te pasas unas ${r0(dk)} kcal; mira qué comida concentra el exceso y recorta ahí. `;
      else t += `de media te quedas ${r0(-dk)} kcal por debajo; comer muy poco frena el rendimiento y la recuperación. `;
      if (dp < -10) t += `Te faltan unos ${r0(-dp)} g de proteína al día: es el ajuste con más impacto.`;
      else t += 'La proteína está bien cubierta.';
    }
    const w = S.weights; if (w.length >= 2) { const a = w[Math.max(0, w.length - 8)], b = w[w.length - 1]; t += `\n\nPeso: ${a.kg} → ${b.kg} kg (${b.kg - a.kg >= 0 ? '+' : ''}${r1(b.kg - a.kg)} kg).`; }
    return { t, chips: ['Consejos para mejorar', 'Rutina de hoy'] };
  }

  function answerWorkout() {
    const r = S.routine, P = S.coach.prefs;
    if (!r) return { t: `Aún no tienes rutina. Ve a **Deporte → Mi rutina**, elige días, nivel y dónde entrenas, y la genero según tu objetivo${P.injuries.length ? ' evitando ejercicios que castiguen ' + P.injuries.join(', ') : ''}.`, chips: ['Cuántas calorías gasto'] };
    const dow = new Date().getDay(); const idx = (dow + 6) % 7; // lunes=0
    const spread = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[r.cfg.days];
    const di = spread.indexOf(idx);
    if (di < 0) return { t: `Hoy toca descanso activo según tu plan de ${r.cfg.days} días. Un paseo de 30-40 minutos y movilidad suave te ayudan a recuperar.\n\nLa próxima sesión: **${r.days[0].name}**.`, chips: ['Cuántas calorías gasto'] };
    const d = r.days[di];
    return { t: `Hoy te toca **${d.name}** (≈ ${r0(d.est)} kcal):\n` + d.items.map(it => `- ${it.ex.n}: ${it.sets}×${it.reps}`).join('\n') + (d.cardio ? `\n- Cardio: ${d.cardio.name} ${d.cardio.min} min` : '') + '\n\nCuando termines, regístrala desde **Deporte → Mi rutina** para sumar el gasto.', chips: ['Cuántas calorías gasto', 'Consejos de recuperación'] };
  }

  function answerExercise(text) {
    const tt = tokens(text).map(stem);
    let best = null, bs = 0;
    EXERCISES.forEach(e => {
      const et = sigTokens(e.n); if (!et.length) return;
      const hit = et.filter(t => tt.includes(stem(t))).length;
      const sc = hit / et.length + hit * 0.05;
      if (hit && sc > bs) { bs = sc; best = e; }
    });
    if (!best) return null;
    return { t: `**${best.n}** (${MUSCLES[best.g]}, ${EX_PLACE[best.place].toLowerCase()}):\n${best.tip}\n\nEn **Deporte → Ejercicios** tienes la animación del movimiento y el botón para ver el vídeo.`, chips: ['Rutina de hoy', 'Consejos de recuperación'] };
  }

  const SUPP = 'Lo que tiene respaldo sólido:\n- **Creatina monohidrato**: 3-5 g al día, cualquier hora. Es el suplemento más estudiado para fuerza y masa muscular.\n- **Proteína en polvo**: solo es comodidad; sirve si no llegas a tu proteína con comida.\n- **Cafeína**: 3-6 mg/kg antes de entrenar mejora el rendimiento; evítala 6-8 h antes de dormir.\n\nCon el resto (quemagrasas, BCAA…) la evidencia es floja o nula. Si tienes alguna condición médica o tomas medicación, consúltalo con tu médico.';

  const TOPICS = [
    { re: /(creatina|suplement|whey|batido de proteina|cafeina|bcaa|quemagrasa|preentreno)/, a: () => ({ t: SUPP, chips: ['Cuánta proteína necesito', '¿Qué me queda hoy?'] }) },
    { re: /(estanc|no bajo|no adelgazo|plateau|no pierdo|no progreso|no avanzo)/, a: () => ({ t: 'Si el peso no se mueve, repasa en orden:\n- **Registro**: ¿pesas y anotas todo (aceites, salsas, picoteo)? Es la causa nº 1.\n- **Tiempo**: el peso fluctúa 1-2 kg por agua y sal; juzga por la media de 2-3 semanas.\n- **Pasos**: si has bajado tu actividad diaria, tu gasto real baja.\n- **Sueño y estrés**: dormir poco aumenta el hambre y retiene líquidos.\n\nSi llevas 3 semanas sin cambios, reduce unas 100-150 kcal o suma 2.000 pasos al día. Evita recortes bruscos.', chips: ['¿Cómo voy esta semana?', 'Consejos para perder grasa'] }) },
    { re: /(perder grasa|adelgazar|bajar de peso|definir|deficit|perder peso)/, a: () => ({ t: 'Para perder grasa conservando músculo:\n- Déficit moderado (10-20%): perder 0,5-0,8% de tu peso por semana es un buen ritmo.\n- Proteína alta (~2 g/kg) y entrenamiento de fuerza 3-4 días.\n- Muchos pasos diarios (7.000-10.000) y comida con volumen: verduras, fruta, legumbres.\n- Duerme 7-9 h.\n\nTu plan ya está calculado en la pestaña **Perfil**.', chips: ['Cuánta proteína necesito', '¿Qué me queda hoy?'] }) },
    { re: /(ganar musculo|masa muscular|volumen|aumentar peso|hipertrofia|ganar peso)/, a: () => ({ t: 'Para ganar músculo:\n- Superávit pequeño (+8-12%): más de eso añade sobre todo grasa.\n- Proteína 1,6-2,2 g/kg repartida en el día.\n- Fuerza con progresión: añade peso o repeticiones poco a poco, 10-20 series por grupo muscular a la semana.\n- Duerme bien y no te saltes los descansos.\n\nEspera ganar ~0,25-0,5 kg al mes de músculo siendo principiante-intermedio.', chips: ['Rutina de hoy', 'Cuánta proteína necesito'] }) },
    { re: /(calorias.*(quem|gast)|(quem|gast).*calorias|cuantas calorias gasto)/, a: () => { const k = todayKey(); return { t: `Hoy llevas **${r0(burned(k))} kcal** gastadas en ejercicio. Las calculo con la fórmula MET: (MET − 1) × peso × horas, que resta tu metabolismo basal para no contarlo dos veces. Es una estimación: puede variar ±15% respecto a un pulsómetro.`, chips: ['Rutina de hoy', '¿Qué me queda hoy?'] }; } },
    { re: /(rutina|entrenar hoy|que entreno|ejercicio de hoy|toca hoy)/, a: answerWorkout },
    { re: /(cardio|correr|caminar|pasos|hiit)/, a: () => ({ t: 'El cardio suma gasto y salud cardiovascular, pero la base de una buena composición corporal es la **fuerza**. Reglas simples:\n- Caminar a diario (7.000-10.000 pasos) es lo más fácil de sostener.\n- 1-2 sesiones de cardio moderado de 20-30 min o 1 sesión corta de HIIT a la semana.\n- No hagas el HIIT en días de pierna pesada.', chips: ['Rutina de hoy', 'Cuántas calorías gasto'] }) },
    { re: /(descans|recuper|agujetas|sobreentren|fatiga)/, a: () => ({ t: 'Para recuperar mejor:\n- 7-9 horas de sueño.\n- Proteína y carbohidratos suficientes tras entrenar.\n- Al menos 1-2 días de descanso a la semana (puedes caminar).\n- Las agujetas se alivian con movimiento suave; si hay dolor agudo o articular, para y adapta el ejercicio.', chips: ['Rutina de hoy'] }) },
    { re: /(agua|hidrat|beber)/, a: () => { const plan = getPlan(); return { t: `Una referencia sencilla es ~35 ml por kg de peso${plan ? `: **${plan.water} L** al día para ti` : ''}, más si haces deporte o hace calor. Tu orina clara y amarillo pálido es buena señal. Puedes contar los vasos en la pestaña **Hoy**.`, chips: ['¿Qué me queda hoy?'] }; } },
    { re: /(sueno|dormir|insomnio|descansar bien)/, a: () => ({ t: 'Dormir 7-9 horas es de lo más rentable: mejora el hambre, la fuerza y la recuperación. Cena al menos 2 h antes de acostarte, evita cafeína por la tarde y mantén horarios regulares.', chips: ['Consejos de recuperación'] }) },
    { re: /(hambre|antojo|ansiedad por comer|dulce|picoteo|picar)/, a: () => ({ t: 'Para controlar el hambre y los antojos:\n- Sube la proteína y la fibra en cada comida (te sacian más).\n- Elige alimentos voluminosos: verdura, fruta entera, legumbres, sopas.\n- Deja un snack planificado en vez de «prohibir» el dulce: una onza de chocolate negro cabe en cualquier plan.\n- Duerme bien y bebe agua.\n\nSi sientes que pierdes el control al comer con frecuencia, hablarlo con un profesional de la salud es una buena idea.', chips: ['Ideas de snack', 'Proteína rápida'] }) },
    { re: /(fibra|estrenimiento)/, a: () => ({ t: 'Apunta a ~14 g de fibra por cada 1.000 kcal (unos 25-35 g/día). Suma verduras, fruta con piel, legumbres, avena y frutos secos, y bebe agua suficiente.', chips: ['¿Qué puedo comer ahora?'] }) },
    { re: /(ayuno|intermitente|16.?8)/, a: () => ({ t: 'El ayuno intermitente no quema más grasa por sí mismo: funciona si te ayuda a cumplir tu déficit y tu proteína. Si te va bien, perfecto; si te deja sin energía para entrenar, no hace falta. Lo importante es el total diario.', chips: ['¿Qué me queda hoy?'] }) },
    { re: /(carbohidrato|hidratos|low carb|keto)/, a: () => ({ t: 'Los hidratos no engordan por sí mismos: manda el total de calorías. Son el mejor combustible para entrenar. Prioriza integrales, legumbres, fruta y tubérculos, y colócalos alrededor del entrenamiento.', chips: ['¿Qué me queda hoy?'] }) },
    { re: /(grasa|aceite|omega)/, a: () => ({ t: 'Necesitas grasa (≥0,8 g/kg) para las hormonas y absorber vitaminas. Usa aceite de oliva virgen extra, frutos secos, aguacate y pescado azul. Ojo con medir el aceite: una cucharada son ~90 kcal.', chips: ['¿Qué me queda hoy?'] }) },
    { re: /(resumen|como voy|progreso|esta semana|mi semana|estadisticas|consejos para mejorar)/, a: answerProgress },
    { re: /(proteina rapida|rica en proteina|mas proteina|me falta proteina|fuentes de proteina)/, a: answerQuickProtein },
    { re: /(cuanta proteina|proteina necesito|cuanta proteina)/, a: answerProteinNeeds },
    { re: /(macros|cuantas calorias necesito|mis calorias|mi objetivo|cuanto debo comer)/, a: () => { const plan = getPlan(); if (!plan) return needPlan(); return { t: `Tu objetivo diario es **${plan.kcal} kcal**: ${plan.p} g de proteína, ${plan.c} g de hidratos y ${plan.f} g de grasas (más ${plan.fiber} g de fibra). Se calcula con la fórmula Mifflin-St Jeor y tu nivel de actividad.`, chips: ['¿Qué me queda hoy?', '¿Qué puedo comer ahora?'] }; } },
    { re: /(me queda|quedan|restante|falta por|que llevo|cuanto llevo|cuanto me falta)/, a: answerRemaining },
    { re: /(foto|etiqueta|imagen|escane|camara|envase|codigo de barras)/, a: () => ({ t: 'Puedo trabajar con fotos:\n- **Leer etiqueta**: haz una foto a la tabla nutricional de un envase y leo las calorías y macros por 100 g. Revisas los valores, le pones nombre y sección, y queda guardado para añadirlo cuando quieras.\n- **Analizar plato**: haz una foto a tu comida, dime qué lleva y el tamaño comparado con tu mano, y te calculo las calorías y te doy consejo.\n\nTienes los dos botones arriba del chat. Todo se procesa en tu móvil.', chips: baseChips() }) },
    { re: /(que (puedo )?(comer|cenar|desayunar|merendar|almorzar)|idea|receta|sugerencia|sugiere|recomienda|que como|que ceno|que desayuno|snack|merienda|plato|batido|smoothie)/, a: null },
    { re: /^(hola|buenas|hey|buenos dias|buenas tardes|buenas noches|que tal)\b/, a: () => ({ t: `¡Hola! ¿En qué te ayudo hoy?`, chips: baseChips() }) },
    { re: /(gracias|genial|perfecto|vale|ok\b)/, a: () => ({ t: '¡Para eso estoy! Si necesitas algo más, aquí me tienes.', chips: baseChips() }) },
    { re: /(quien eres|que puedes hacer|ayuda|que sabes)/, a: () => ({ t: 'Soy el coach de MacroFit. Puedo:\n- Decirte lo que te queda por comer hoy.\n- Proponerte platos según tus macros y la hora.\n- Darte los macros de cualquier alimento («¿cuánto tienen 150 g de pollo?»).\n- Adaptar tu entreno a lesiones o tiempo.\n- Resolver dudas de nutrición y deporte.\n\nTambién aprendo: dime cosas como «no me gusta el pescado» o «me duele la rodilla».', chips: baseChips() }) }
  ];

  const ED = /(vomit|purg|atracon|bulimi|anorexi|dejar de comer|no comer nada|castigarme|me da asco comer|culpa por comer)/;
  const MED = /(diabet|embaraz|lactan|hipertens|celiaqu|renal|rinon|tiroid|medicacion|enfermedad)/;

  function reply(raw) {
    const t = norm(raw);
    if (ED.test(t)) return { t: 'Gracias por contármelo. Lo que describes merece apoyo de verdad, y yo no puedo darte pautas de dieta ahora. Habla con tu médico de cabecera o con un profesional de salud mental especializado en conducta alimentaria; no tienes que pasar por esto sola/o. Si estás en España, puedes llamar al 024 (línea de atención a la conducta suicida y emocional) si te sientes desbordado/a.\n\nCuando quieras, aquí sigo para hablar de entrenar o de comer sin presión.', chips: ['Rutina de hoy'] };
    const learned = learn(raw);
    let res = null;
    const onlyLearn = learned.length && !/\?/.test(raw) && !/(que|cual|como|cuanto|puedo|dime)/.test(t);
    if (onlyLearn) {
      return { t: `Anotado: ${learned.join('; ')}.\n\nLo tendré en cuenta en mis recomendaciones y en tus rutinas.`, chips: baseChips() };
    }
    // técnica de un ejercicio
    if (/(como se hace|como hago|como hacer|tecnica|video|ejecucion|ejecutar)/.test(t)) res = answerExercise(raw);
    // alimento concreto
    if (!res && /(cuant[oa]s?|macros|calorias|proteina[s]? (tiene|lleva|hay)|tiene|lleva|puedo (comer|tomar)|me (como|tomo)|vale|hay en)/.test(t) && !/(me queda|resumen|como voy)/.test(t)) res = answerFood(raw);
    if (!res) {
      for (const tp of TOPICS) {
        if (tp.re.test(t)) { res = tp.a ? tp.a() : answerSuggest(t); break; }
      }
    }
    if (!res) res = answerFood(raw);
    if (!res) res = { t: 'No estoy seguro de haberte entendido. Puedes preguntarme, por ejemplo:\n- «¿Qué me queda hoy?»\n- «¿Qué ceno?»\n- «¿Cuánta proteína tiene el atún?»\n- «Rutina de hoy»\n- «No avanzo, ¿qué hago?»', chips: baseChips() };
    if (learned.length) res.t = `Anotado: ${learned.join('; ')}.\n\n` + res.t;
    if (MED.test(t)) res.t += '\n\nImportante: con una condición de salud (diabetes, embarazo, hipertensión…) las pautas generales pueden no valerte. Consulta a tu médico o dietista antes de cambiar tu alimentación.';
    return res;
  }

  return { welcome, reply, learn, stats };
})();
