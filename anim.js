'use strict';
/* =====================================================================
   MacroFit · animaciones de ejercicios
   Silueta (hombre o mujer) dibujada y animada en el propio móvil, con el
   músculo que trabaja resaltado. Vista lateral, mirando a la derecha.
   Ángulos en grados: 0 = derecha, 90 = abajo, -90 = arriba, 180 = izquierda.
   ===================================================================== */
const ExAnim = (() => {
  const L = { torso: 50, neck: 9, head: 11, ua: 28, fa: 26, th: 40, sh: 40, foot: 13 };
  const FLOOR = 186;

  const P = (o) => Object.assign({ t: -90, aN: 92, fN: 92, aF: 88, fF: 88, lN: 90, kN: 90, lF: 90, kF: 90, ftN: null, ftF: null }, o);
  const STAND = P({});

  /* ---- biblioteca de movimientos ----
     a, b: poses extremas · anchor: punto que queda fijo · eq: material */
  const M = {
    squat: { a: STAND, b: P({ t: -52, aN: 0, fN: 0, aF: 4, fF: 4, lN: 8, kN: 112, lF: 12, kF: 112 }), anchor: 'ankleN', eq: [] },
    squatBar: { a: P({ aN: 150, fN: -55, aF: 150, fF: -55 }), b: P({ t: -50, aN: 175, fN: -35, aF: 175, fF: -35, lN: 8, kN: 112, lF: 12, kF: 112 }), anchor: 'ankleN', eq: ['barBack'] },
    squatDb: { a: P({ aN: 90, fN: 90, aF: 90, fF: 90 }), b: P({ t: -62, aN: 100, fN: 95, aF: 100, fF: 95, lN: 8, kN: 112, lF: 12, kF: 112 }), anchor: 'ankleN', eq: ['db'] },
    lunge: { a: P({ lN: 75, kN: 95, lF: 108, kF: 100, aN: 95, fN: 95 }), b: P({ lN: 2, kN: 92, lF: 100, kF: 172, ftF: 170, aN: 92, fN: 92 }), anchor: 'ankleN', eq: [] },
    lungeDb: { a: P({ lN: 75, kN: 95, lF: 108, kF: 100 }), b: P({ lN: 2, kN: 92, lF: 100, kF: 172, ftF: 170 }), anchor: 'ankleN', eq: ['db'] },
    split: { a: P({ lN: 70, kN: 92, lF: 112, kF: 112, ftF: 160 }), b: P({ lN: 2, kN: 92, lF: 98, kF: 170, ftF: 170 }), anchor: 'ankleN', eq: ['box'] },
    hinge: { a: P({ lN: 88, kN: 94, lF: 88, kF: 94 }), b: P({ t: -12, aN: 88, fN: 88, aF: 88, fF: 88, lN: 76, kN: 98, lF: 76, kF: 98 }), anchor: 'ankleN', eq: ['db'] },
    hingeBar: { a: P({ lN: 88, kN: 94, lF: 88, kF: 94 }), b: P({ t: -12, aN: 88, fN: 88, aF: 88, fF: 88, lN: 76, kN: 98, lF: 76, kF: 98 }), anchor: 'ankleN', eq: ['bar'] },
    calf: { a: STAND, b: P({ ftN: 62, ftF: 62 }), anchor: 'toeN', eq: [] },
    bridge: { a: P({ t: 180, lN: -40, kN: 70, lF: -36, kF: 70, aN: 175, fN: 175, aF: 175, fF: 175 }), b: P({ t: 160, lN: -14, kN: 85, lF: -10, kF: 85, aN: 172, fN: 172, aF: 172, fF: 172 }), anchor: 'neck', eq: [] },
    thrust: { a: P({ t: -155, lN: -28, kN: 92, lF: -24, kF: 92, aN: 120, fN: 100, aF: 120, fF: 100 }), b: P({ t: 180, lN: 0, kN: 90, lF: 4, kF: 90, aN: 110, fN: 95, aF: 110, fF: 95 }), anchor: 'neck', eq: ['benchBack', 'barHip'] },
    pushup: { a: P({ t: -10, lN: 170, kN: 170, lF: 170, kF: 170, aN: 88, fN: 88, aF: 88, fF: 88 }), b: P({ t: -2, lN: 178, kN: 178, lF: 178, kF: 178, aN: 200, fN: 70, aF: 200, fF: 70 }), anchor: 'toeN', eq: [] },
    pushupIncline: { a: P({ t: -32, lN: 148, kN: 148, lF: 148, kF: 148, aN: 70, fN: 70, aF: 70, fF: 70 }), b: P({ t: -22, lN: 158, kN: 158, lF: 158, kF: 158, aN: 185, fN: 45, aF: 185, fF: 45 }), anchor: 'toeN', eq: ['boxHands'] },
    benchDip: { a: P({ t: -86, aN: 104, fN: 98, aF: 104, fF: 98, lN: -2, kN: 30, lF: -2, kF: 30 }), b: P({ t: -84, aN: 200, fN: 88, aF: 200, fF: 88, lN: 14, kN: 46, lF: 14, kF: 46 }), anchor: 'handN', eq: ['benchBehind'] },
    dip: { a: P({ t: -84, aN: 95, fN: 90, aF: 95, fF: 90, lN: 100, kN: 150, lF: 96, kF: 148 }), b: P({ t: -72, aN: 210, fN: 95, aF: 210, fF: 95, lN: 105, kN: 150, lF: 100, kF: 148 }), anchor: 'handN', eq: ['bars'] },
    row: { a: P({ t: -22, aN: 90, fN: 90, aF: 90, fF: 90, lN: 78, kN: 100, lF: 78, kF: 100 }), b: P({ t: -22, aN: 215, fN: 92, aF: 215, fF: 92, lN: 78, kN: 100, lF: 78, kF: 100 }), anchor: 'ankleN', eq: ['db'] },
    rowBar: { a: P({ t: -22, aN: 90, fN: 90, aF: 90, fF: 90, lN: 78, kN: 100, lF: 78, kF: 100 }), b: P({ t: -22, aN: 205, fN: 85, aF: 205, fF: 85, lN: 78, kN: 100, lF: 78, kF: 100 }), anchor: 'ankleN', eq: ['bar'] },
    rowOne: { a: P({ t: -12, aN: 90, fN: 90, aF: 60, fF: 92, lN: 82, kN: 96, lF: 92, kF: 150 }), b: P({ t: -12, aN: 215, fN: 92, aF: 60, fF: 92, lN: 82, kN: 96, lF: 92, kF: 150 }), anchor: 'ankleN', eq: ['db', 'benchFront'] },
    invRow: { a: P({ t: -14, aN: -78, fN: -78, aF: -80, fF: -80, lN: 166, kN: 166, lF: 166, kF: 166 }), b: P({ t: -26, aN: 200, fN: -70, aF: 200, fF: -70, lN: 154, kN: 154, lF: 154, kF: 154 }), anchor: 'handN', eq: ['table'] },
    seatedRow: { a: P({ t: -82, aN: -2, fN: -2, aF: 2, fF: 2, lN: 2, kN: 10, lF: 2, kF: 10 }), b: P({ t: -98, aN: 160, fN: 5, aF: 160, fF: 5, lN: 2, kN: 10, lF: 2, kF: 10 }), anchor: 'hip', eq: ['cableFront', 'seatLow'] },
    pulldown: { a: P({ t: -96, aN: -78, fN: -78, aF: -82, fF: -82, lN: 0, kN: 92, lF: 2, kF: 92 }), b: P({ t: -100, aN: 112, fN: -62, aF: 112, fF: -62, lN: 0, kN: 92, lF: 2, kF: 92 }), anchor: 'hip', eq: ['cableTop', 'seat'] },
    facepull: { a: P({ aN: -8, fN: -8, aF: -4, fF: -4 }), b: P({ aN: 192, fN: -28, aF: 192, fF: -28 }), anchor: 'ankleN', eq: ['cableFront'] },
    press: { a: P({ aN: 72, fN: -90, aF: 76, fF: -90 }), b: P({ aN: -88, fN: -90, aF: -92, fF: -92 }), anchor: 'ankleN', eq: ['db'] },
    raise: { a: P({ aN: 88, fN: 85, aF: 92, fF: 88 }), b: P({ aN: 0, fN: -5, aF: 4, fF: 0 }), anchor: 'ankleN', eq: ['db'] },
    curl: { a: P({ aN: 95, fN: 92, aF: 92, fF: 90 }), b: P({ aN: 98, fN: -62, aF: 95, fF: -60 }), anchor: 'ankleN', eq: ['db'] },
    pushdown: { a: P({ t: -84, aN: 98, fN: -38, aF: 96, fF: -36 }), b: P({ t: -84, aN: 96, fN: 92, aF: 94, fF: 90 }), anchor: 'ankleN', eq: ['cableTop'] },
    overhead: { a: P({ aN: -102, fN: 150, aF: -104, fF: 150 }), b: P({ aN: -96, fN: -92, aF: -98, fF: -94 }), anchor: 'ankleN', eq: ['db'] },
    bench: { a: P({ t: 180, aN: 98, fN: -90, aF: 102, fF: -90, lN: 42, kN: 98, lF: 46, kF: 98 }), b: P({ t: 180, aN: -88, fN: -90, aF: -92, fF: -92, lN: 42, kN: 98, lF: 46, kF: 98 }), anchor: 'hip', eq: ['bench', 'barHands'] },
    incline: { a: P({ t: -148, aN: 105, fN: -70, aF: 108, fF: -70, lN: 30, kN: 95, lF: 34, kF: 95 }), b: P({ t: -148, aN: -62, fN: -62, aF: -66, fF: -66, lN: 30, kN: 95, lF: 34, kF: 95 }), anchor: 'hip', eq: ['benchIncline', 'db'] },
    fly: { a: P({ aN: 175, fN: 172, aF: 178, fF: 175, t: -80 }), b: P({ aN: 25, fN: 35, aF: 28, fF: 38, t: -80 }), anchor: 'ankleN', eq: ['cableBack'] },
    plank: { a: P({ t: -4, lN: 176, kN: 176, lF: 176, kF: 176, aN: 92, fN: 0, aF: 92, fF: 0 }), b: P({ t: -6, lN: 174, kN: 174, lF: 174, kF: 174, aN: 92, fN: 0, aF: 92, fF: 0 }), anchor: 'toeN', eq: ['mat'] },
    sidePlank: { a: P({ t: -18, lN: 162, kN: 162, lF: 164, kF: 164, aN: 92, fN: 0, aF: -90, fF: -90 }), b: P({ t: -24, lN: 156, kN: 156, lF: 158, kF: 158, aN: 92, fN: 0, aF: -92, fF: -92 }), anchor: 'toeN', eq: ['mat'] },
    crunch: { a: P({ t: 180, aN: 205, fN: -20, aF: 205, fF: -20, lN: -48, kN: 62, lF: -44, kF: 62 }), b: P({ t: -145, aN: -150, fN: 10, aF: -150, fF: 10, lN: -48, kN: 62, lF: -44, kF: 62 }), anchor: 'hip', eq: ['mat'] },
    cableCrunch: { a: P({ t: -70, aN: -115, fN: 70, aF: -115, fF: 70, lN: 92, kN: 180, lF: 92, kF: 180, ftN: 180, ftF: 180 }), b: P({ t: 5, aN: -40, fN: 120, aF: -40, fF: 120, lN: 92, kN: 180, lF: 92, kF: 180, ftN: 180, ftF: 180 }), anchor: 'hip', eq: ['cableTop', 'mat'] },
    deadbug: { a: P({ t: 180, aN: -90, fN: -90, aF: -90, fF: -90, lN: -90, kN: 0, lF: -88, kF: 0 }), b: P({ t: 180, aN: 185, fN: 185, aF: -90, fF: -90, lN: -90, kN: 0, lF: -8, kF: -8 }), anchor: 'hip', eq: ['mat'] },
    climber: { a: P({ t: -16, aN: 88, fN: 88, aF: 88, fF: 88, lN: 40, kN: 150, lF: 168, kF: 168 }), b: P({ t: -16, aN: 88, fN: 88, aF: 88, fF: 88, lN: 168, kN: 168, lF: 40, kF: 150 }), anchor: 'handN', eq: ['mat'], speed: 0.55 },
    superman: { a: P({ t: 0, aN: 0, fN: 0, aF: 2, fF: 2, lN: 180, kN: 180, lF: 180, kF: 180 }), b: P({ t: -14, aN: -18, fN: -18, aF: -16, fF: -16, lN: 166, kN: 166, lF: 166, kF: 166 }), anchor: 'hip', eq: ['mat'] },
    legExt: { a: P({ t: -100, aN: 100, fN: 60, aF: 100, fF: 60, lN: 0, kN: 100, lF: 2, kF: 100 }), b: P({ t: -100, aN: 100, fN: 60, aF: 100, fF: 60, lN: 0, kN: 0, lF: 2, kF: 2 }), anchor: 'hip', eq: ['seat', 'padAnkle'] },
    legCurl: { a: P({ t: 0, aN: 60, fN: 120, aF: 60, fF: 120, lN: 180, kN: 180, lF: 180, kF: 180 }), b: P({ t: 0, aN: 60, fN: 120, aF: 60, fF: 120, lN: 180, kN: -55, lF: 180, kF: -55 }), anchor: 'hip', eq: ['benchFlat', 'padAnkle'] },
    legPress: { a: P({ t: -150, aN: 110, fN: 30, aF: 110, fF: 30, lN: -70, kN: 15, lF: -66, kF: 15 }), b: P({ t: -150, aN: 110, fN: 30, aF: 110, fF: 30, lN: -38, kN: -38, lF: -36, kF: -36 }), anchor: 'hip', eq: ['seatRecline', 'sled'] },
    hang: { a: P({ aN: -90, fN: -90, aF: -90, fF: -90, lN: 92, kN: 92, lF: 90, kF: 90 }), b: P({ aN: -90, fN: -90, aF: -90, fF: -90, lN: -4, kN: -4, lF: -2, kF: -2, t: -96 }), anchor: 'handN', eq: ['pullbar'] },
    superset: null
  };

  // ejercicio (nombre en data.js) -> movimiento
  const MAP = {
    'Flexiones': 'pushup', 'Flexiones inclinadas (manos en silla)': 'pushupIncline', 'Flexiones diamante': 'pushup',
    'Fondos de tríceps en silla': 'benchDip', 'Remo con mochila cargada': 'row', 'Remo invertido bajo una mesa': 'invRow',
    'Superman': 'superman', 'Sentadilla con peso corporal': 'squat', 'Sentadilla búlgara': 'split', 'Zancadas alternas': 'lunge',
    'Elevación de talones a una pierna': 'calf', 'Peso muerto rumano con mochila': 'hinge', 'Puente de glúteo': 'bridge',
    'Hip thrust con la espalda en el sofá': 'thrust', 'Press de hombros con mochila o garrafas': 'press',
    'Elevaciones laterales con botellas': 'raise', 'Curl de bíceps con mochila': 'curl', 'Plancha': 'plank',
    'Plancha lateral': 'sidePlank', 'Dead bug': 'deadbug', 'Mountain climbers': 'climber', 'Crunch abdominal': 'crunch',
    'Press de banca con barra': 'bench', 'Press inclinado con mancuernas': 'incline', 'Aperturas en polea': 'fly',
    'Jalón al pecho': 'pulldown', 'Remo con barra': 'rowBar', 'Remo en polea baja': 'seatedRow',
    'Remo con mancuerna a una mano': 'rowOne', 'Sentadilla con barra': 'squatBar', 'Prensa de piernas': 'legPress',
    'Extensión de cuádriceps': 'legExt', 'Curl femoral tumbado': 'legCurl', 'Peso muerto rumano con barra': 'hingeBar',
    'Hip thrust con barra': 'thrust', 'Zancadas con mancuernas': 'lungeDb', 'Elevación de gemelos de pie': 'calf',
    'Press militar con mancuernas': 'press', 'Elevaciones laterales con mancuernas': 'raise', 'Face pull en polea': 'facepull',
    'Curl de bíceps con mancuernas': 'curl', 'Curl martillo': 'curl', 'Extensión de tríceps en polea': 'pushdown',
    'Press francés con mancuerna': 'overhead', 'Fondos en paralelas': 'dip', 'Crunch en polea': 'cableCrunch',
    'Plancha con peso': 'plank', 'Elevación de piernas colgado': 'hang'
  };
  // segmentos resaltados por grupo muscular
  const HL = {
    pecho: ['chest'], espalda: ['back'], pierna: ['thighN', 'thighF'], gluteo: ['glute', 'hamN', 'hamF'],
    hombro: ['delt'], biceps: ['uaN', 'uaF'], triceps: ['uaN', 'uaF'], core: ['abs']
  };
  const BODY_EQ_NONE = new Set(['pushup', 'squat', 'lunge', 'calf', 'bridge', 'superman', 'deadbug', 'crunch', 'plank', 'sidePlank', 'climber']);

  const rad = d => d * Math.PI / 180;
  const add = (p, len, ang) => [p[0] + len * Math.cos(rad(ang)), p[1] + len * Math.sin(rad(ang))];
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAng = (a, b, t) => a + (b - a) * t;

  function skeleton(p) {
    const hip = [0, 0];
    const neck = add(hip, L.torso, p.t);
    const head = add(neck, L.neck + L.head * 0.8, p.t);
    const sh = add(hip, L.torso - 4, p.t);
    const limb = (a, f) => { const e = add(sh, L.ua, a); return [e, add(e, L.fa, f)]; };
    const leg = (l, k, ft) => { const kn = add(hip, L.th, l); const an = add(kn, L.sh, k); const fa = ft == null ? k - 90 : ft; return [kn, an, add(an, L.foot, fa)]; };
    const [eN, hN] = limb(p.aN, p.fN), [eF, hF] = limb(p.aF, p.fF);
    const [kN, anN, toN] = leg(p.lN, p.kN, p.ftN), [kF, anF, toF] = leg(p.lF, p.kF, p.ftF);
    return { hip, neck, head, sh, eN, hN, eF, hF, kN, anN, toN, kF, anF, toF };
  }
  const ANCH = { ankleN: 'anN', toeN: 'toN', hip: 'hip', handN: 'hN', neck: 'sh' };
  function interp(a, b, t) { const o = {}; for (const k in a) o[k] = (a[k] == null || b[k] == null) ? (t < 0.5 ? a[k] : b[k]) : lerpAng(a[k], b[k], t); return o; }

  function bbox(sk) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k in sk) { const [x, y] = sk[k]; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  }
  // calcula el desplazamiento: el punto ancla queda fijo; la pose inicial toca el suelo
  function layout(mv) {
    const s0 = skeleton(mv.a), s1 = skeleton(mv.b);
    const key = ANCH[mv.anchor] || 'anN';
    const lift = mv.eq.includes('pullbar') ? 0 : null;
    // traslación para que el punto más bajo de la pose A (o B si está más baja) toque el suelo
    const rel = sk => { const o = {}; const a = sk[key]; for (const k in sk) o[k] = [sk[k][0] - a[0], sk[k][1] - a[1]]; return o; };
    const r0 = rel(s0), r1 = rel(s1);
    const b0 = bbox(r0), b1 = bbox(r1);
    const maxY = Math.max(b0.y1, b1.y1) + 6;
    let ay = FLOOR - maxY;
    if (lift !== null) ay = 30 - Math.min(b0.y0, b1.y0) + 0; // colgado: manos arriba
    const minX = Math.min(b0.x0, b1.x0), maxX = Math.max(b0.x1, b1.x1);
    const ax = 120 - (minX + maxX) / 2;
    return { key, ax, ay };
  }

  /* ---------- dibujo ---------- */
  function seg(a, b, w, col, op) { return `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${op ? ` opacity="${op}"` : ''}/>`; }
  const mid = (a, b, t = 0.5) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  function equipment(eq, s, layoutInfo, base) {
    let out = '';
    const metal = '#8e959e', dark = '#5b6169', soft = 'rgba(120,130,140,.35)';
    for (const e of eq) {
      if (e === 'db') {
        for (const [h, op] of [[s.hF, 0.5], [s.hN, 1]]) out += `<g opacity="${op}"><rect x="${(h[0] - 9).toFixed(1)}" y="${(h[1] - 3).toFixed(1)}" width="18" height="6" rx="3" fill="${dark}"/><circle cx="${(h[0] - 9).toFixed(1)}" cy="${h[1].toFixed(1)}" r="6.5" fill="${metal}"/><circle cx="${(h[0] + 9).toFixed(1)}" cy="${h[1].toFixed(1)}" r="6.5" fill="${metal}"/></g>`;
      } else if (e === 'bar' || e === 'barHands') {
        const h = s.hN; out += `<circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="17" fill="${metal}"/><circle cx="${h[0].toFixed(1)}" cy="${h[1].toFixed(1)}" r="5" fill="${dark}"/>`;
      } else if (e === 'barBack') {
        const p = add(s.sh, 9, 200); out += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="17" fill="${metal}"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${dark}"/>`;
      } else if (e === 'barHip') {
        const p = add(s.hip, 8, -60); out += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="16" fill="${metal}"/><circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" fill="${dark}"/>`;
      } else if (e === 'bench' || e === 'benchFlat') {
        const y = Math.max(s.hip[1], s.sh[1]) + 10; const x0 = Math.min(s.hip[0], s.neck[0]) - 18, x1 = Math.max(s.hip[0], s.neck[0]) + 18;
        out += `<rect x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${(x1 - x0).toFixed(1)}" height="9" rx="4" fill="${soft}"/><rect x="${((x0 + x1) / 2 - 4).toFixed(1)}" y="${(y + 9).toFixed(1)}" width="8" height="${(FLOOR - y - 9).toFixed(1)}" fill="${soft}"/>`;
      } else if (e === 'benchIncline' || e === 'seatRecline') {
        const a = add(s.hip, 12, 90), b = add(s.neck, 12, 90 + 0), c = add(s.hip, 10, 60);
        out += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${soft}" stroke-width="10" stroke-linecap="round"/><rect x="${(c[0] - 4).toFixed(1)}" y="${c[1].toFixed(1)}" width="8" height="${Math.max(0, FLOOR - c[1]).toFixed(1)}" fill="${soft}"/>`;
      } else if (e === 'benchBack') {
        const p = add(s.sh, 8, 90); out += `<rect x="${(p[0] - 30).toFixed(1)}" y="${(p[1] + 2).toFixed(1)}" width="44" height="${Math.max(0, FLOOR - p[1] - 2).toFixed(1)}" rx="5" fill="${soft}"/>`;
      } else if (e === 'benchFront') {
        const h = s.hF; out += `<rect x="${(h[0] - 30).toFixed(1)}" y="${(h[1] + 3).toFixed(1)}" width="60" height="${Math.max(0, FLOOR - h[1] - 3).toFixed(1)}" rx="5" fill="${soft}"/>`;
      } else if (e === 'seat' || e === 'seatLow') {
        const y = s.hip[1] + 10; out += `<rect x="${(s.hip[0] - 24).toFixed(1)}" y="${y.toFixed(1)}" width="48" height="8" rx="4" fill="${soft}"/><rect x="${(s.hip[0] - 4).toFixed(1)}" y="${(y + 8).toFixed(1)}" width="8" height="${Math.max(0, FLOOR - y - 8).toFixed(1)}" fill="${soft}"/>`;
      } else if (e === 'box') {
        const t = base.toF; out += `<rect x="${(t[0] - 26).toFixed(1)}" y="${(t[1] + 4).toFixed(1)}" width="44" height="${Math.max(0, FLOOR - t[1] - 4).toFixed(1)}" rx="5" fill="${soft}"/>`;
      } else if (e === 'boxHands') {
        const h = base.hN; out += `<rect x="${(h[0] - 22).toFixed(1)}" y="${(h[1] + 4).toFixed(1)}" width="44" height="${Math.max(0, FLOOR - h[1] - 4).toFixed(1)}" rx="5" fill="${soft}"/>`;
      } else if (e === 'benchBehind') {
        const h = base.hN; out += `<rect x="${(h[0] - 50).toFixed(1)}" y="${(h[1] + 4).toFixed(1)}" width="54" height="${Math.max(0, FLOOR - h[1] - 4).toFixed(1)}" rx="5" fill="${soft}"/>`;
      } else if (e === 'bars') {
        const h = base.hN; out += `<rect x="${(h[0] - 30).toFixed(1)}" y="${(h[1] + 3).toFixed(1)}" width="60" height="5" rx="2.5" fill="${metal}"/><rect x="${(h[0] + 22).toFixed(1)}" y="${(h[1] + 3).toFixed(1)}" width="5" height="${Math.max(0, FLOOR - h[1] - 3).toFixed(1)}" fill="${soft}"/>`;
      } else if (e === 'table') {
        const h = base.hN; out += `<rect x="${(h[0] - 50).toFixed(1)}" y="${(h[1] - 8).toFixed(1)}" width="100" height="7" rx="3" fill="${soft}"/><rect x="${(h[0] + 40).toFixed(1)}" y="${(h[1] - 1).toFixed(1)}" width="6" height="${Math.max(0, FLOOR - h[1] + 1).toFixed(1)}" fill="${soft}"/>`;
      } else if (e === 'pullbar') {
        const h = base.hN; out += `<rect x="${(h[0] - 60).toFixed(1)}" y="${(h[1] - 3).toFixed(1)}" width="120" height="6" rx="3" fill="${metal}"/>`;
      } else if (e === 'cableTop') {
        const h = s.hN; out += `<line x1="${h[0].toFixed(1)}" y1="${h[1].toFixed(1)}" x2="${(base.hN[0]).toFixed(1)}" y2="6" stroke="${dark}" stroke-width="1.6"/><circle cx="${base.hN[0].toFixed(1)}" cy="6" r="5" fill="${metal}"/>`;
      } else if (e === 'cableFront') {
        const h = s.hN; out += `<line x1="${h[0].toFixed(1)}" y1="${h[1].toFixed(1)}" x2="234" y2="${base.hN[1].toFixed(1)}" stroke="${dark}" stroke-width="1.6"/><rect x="232" y="10" width="6" height="${FLOOR - 10}" fill="${soft}"/>`;
      } else if (e === 'cableBack') {
        const h = s.hN; out += `<line x1="${h[0].toFixed(1)}" y1="${h[1].toFixed(1)}" x2="8" y2="40" stroke="${dark}" stroke-width="1.6"/><rect x="2" y="10" width="6" height="${FLOOR - 10}" fill="${soft}"/>`;
      } else if (e === 'padAnkle') {
        const a = s.anN; out += `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="7" fill="${soft}" stroke="${metal}" stroke-width="2"/>`;
      } else if (e === 'sled') {
        const t = s.toN; out += `<line x1="${(t[0] - 16).toFixed(1)}" y1="${(t[1] + 16).toFixed(1)}" x2="${(t[0] + 12).toFixed(1)}" y2="${(t[1] - 16).toFixed(1)}" stroke="${metal}" stroke-width="7" stroke-linecap="round"/>`;
      } else if (e === 'mat') {
        out += `<rect x="20" y="${FLOOR - 1}" width="200" height="4" rx="2" fill="rgba(48,180,90,.35)"/>`;
      }
    }
    return out;
  }

  function figure(p, mv, lay, sex, groups, colors) {
    const sk0 = skeleton(p), anc = sk0[lay.key], A = skeleton(mv.a), ancA = A[lay.key];
    const T = pt => [pt[0] - anc[0] + lay.ax, pt[1] - anc[1] + lay.ay];
    const s = {}; for (const k in sk0) s[k] = T(sk0[k]);
    const base = {}; for (const k in A) base[k] = [A[k][0] - ancA[0] + lay.ax, A[k][1] - ancA[1] + lay.ay];
    const f = sex === 'f';
    const C = colors.body, CF = colors.far, HLc = colors.hl;
    const W = { torso: f ? 19 : 22, ua: f ? 9 : 10.5, fa: f ? 7.5 : 8.5, th: f ? 13.5 : 14, sh: f ? 10 : 11, foot: 6 };
    let svg = '';
    svg += `<line x1="10" y1="${FLOOR + 3}" x2="230" y2="${FLOOR + 3}" stroke="${colors.floor}" stroke-width="2" stroke-linecap="round"/>`;
    const eqBack = mv.eq.filter(e => /bench|seat|box|table|bars|cable|sled|mat|pullbar/.test(e));
    const eqFront = mv.eq.filter(e => !eqBack.includes(e));
    svg += equipment(eqBack, s, lay, base);
    // extremidades lejanas
    svg += seg(s.hip, s.kF, W.th, CF) + seg(s.kF, s.anF, W.sh, CF) + seg(s.anF, s.toF, W.foot, CF);
    svg += seg(s.sh, s.eF, W.ua, CF) + seg(s.eF, s.hF, W.fa, CF);
    // tronco
    const chestPt = mid(s.hip, s.neck, 0.7), waist = mid(s.hip, s.neck, 0.3);
    svg += seg(s.hip, s.neck, W.torso, C);
    if (f) { svg += `<circle cx="${s.hip[0].toFixed(1)}" cy="${s.hip[1].toFixed(1)}" r="${(W.torso * 0.62).toFixed(1)}" fill="${C}"/>`; }
    else { svg += seg(mid(s.hip, s.neck, 0.62), s.neck, W.torso + 4, C); }
    // cabeza y cuello
    svg += seg(s.neck, mid(s.neck, s.head, 0.6), 8, C);
    svg += `<circle cx="${s.head[0].toFixed(1)}" cy="${s.head[1].toFixed(1)}" r="${L.head}" fill="${C}"/>`;
    if (f) {
      const bun = add(s.head, 10, p.t - 60), tail = add(bun, 15, p.t + 200);
      svg += `<circle cx="${bun[0].toFixed(1)}" cy="${bun[1].toFixed(1)}" r="5.5" fill="${C}"/>` + seg(bun, tail, 7, C);
    }
    // resaltado de músculos (bajo las extremidades cercanas)
    const hl = (a, b, w) => seg(a, b, w, HLc, 0.95);
    for (const gname of groups) {
      if (gname === 'chest') svg += hl(mid(s.hip, s.neck, 0.68), mid(s.hip, s.neck, 0.9), W.torso - 6);
      if (gname === 'back') svg += hl(mid(s.hip, s.neck, 0.45), mid(s.hip, s.neck, 0.92), W.torso - 6);
      if (gname === 'abs') svg += hl(mid(s.hip, s.neck, 0.12), mid(s.hip, s.neck, 0.55), W.torso - 7);
      if (gname === 'glute') svg += `<circle cx="${s.hip[0].toFixed(1)}" cy="${s.hip[1].toFixed(1)}" r="${(W.th * 0.62).toFixed(1)}" fill="${HLc}"/>`;
      if (gname === 'delt') svg += hl(s.sh, mid(s.sh, s.eN, 0.45), W.ua + 3);
    }
    // extremidades cercanas
    const legHL = groups.includes('thighN'), hamHL = groups.includes('hamN');
    svg += seg(s.hip, s.kN, W.th, C) + seg(s.kN, s.anN, W.sh, C) + seg(s.anN, s.toN, W.foot, C);
    if (legHL || hamHL) svg += hl(mid(s.hip, s.kN, 0.12), mid(s.hip, s.kN, 0.85), W.th - 5);
    if (mv === M.calf || groups.includes('calf')) svg += hl(mid(s.kN, s.anN, 0.15), mid(s.kN, s.anN, 0.6), W.sh - 3);
    svg += seg(s.sh, s.eN, W.ua, C) + seg(s.eN, s.hN, W.fa, C);
    if (groups.includes('uaN')) svg += hl(mid(s.sh, s.eN, 0.15), mid(s.sh, s.eN, 0.9), W.ua - 3);
    if (groups.includes('delt')) svg += hl(s.sh, mid(s.sh, s.eN, 0.35), W.ua + 1);
    svg += equipment(eqFront, s, lay, base);
    return svg;
  }

  function colorsFor() {
    const dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    return dark ? { body: '#e8e8ec', far: '#8d8d95', hl: '#ff5a5f', floor: '#3a3a40' } : { body: '#2b2f36', far: '#9aa0a8', hl: '#ff3b30', floor: '#d5d7dc' };
  }
  const ease = t => 0.5 - 0.5 * Math.cos(Math.PI * t);

  /** Inicia una animación dentro del elemento. Devuelve una función para pararla. */
  function play(el, ex, sex) {
    const key = MAP[ex.n] || 'squat', mv = M[key];
    const lay = layout(mv);
    let groups = (HL[ex.g] || []).slice();
    if (key === 'calf') groups = ['calf'];
    const colors = colorsFor();
    const period = 2400 / (mv.speed ? 1 / mv.speed : 1) * (key === 'plank' || key === 'sidePlank' ? 1.6 : 1);
    let raf = 0, start = performance.now(), paused = false, pausedAt = 0;
    const draw = now => {
      const ph = ((now - start) % period) / period;
      const t = ease(ph < 0.5 ? ph * 2 : (1 - ph) * 2);
      el.innerHTML = `<svg viewBox="0 0 240 200" class="exsvg" role="img" aria-label="Animación: ${ex.n}">${figure(interp(mv.a, mv.b, t), mv, lay, sex, groups, colors)}</svg>`;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const toggle = () => { if (paused) { start += performance.now() - pausedAt; paused = false; raf = requestAnimationFrame(draw); } else { paused = true; pausedAt = performance.now(); cancelAnimationFrame(raf); } return paused; };
    el._stop = () => cancelAnimationFrame(raf);
    el._toggle = toggle;
    return el._stop;
  }
  /** Fotograma fijo (miniaturas). */
  function still(ex, sex, t = 1) {
    const key = MAP[ex.n] || 'squat', mv = M[key], lay = layout(mv);
    let groups = (HL[ex.g] || []).slice(); if (key === 'calf') groups = ['calf'];
    return `<svg viewBox="28 22 184 170" class="exsvg" preserveAspectRatio="xMidYMid meet">${figure(interp(mv.a, mv.b, t), mv, lay, sex, groups, colorsFor())}</svg>`;
  }
  return { play, still, MAP, M };
})();
