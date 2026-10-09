'use strict';
/* =====================================================================
   MacroFit · base de datos local
   Valores nutricionales por 100 g (referencia BEDCA / USDA, redondeados).
   Carnes y pescados en crudo; arroz, pasta y legumbres cocidos (se indica).
   ===================================================================== */

const CATS = {
  prot: { l: 'Proteínas', e: '🍗' },
  lact: { l: 'Lácteos y bebidas', e: '🥛' },
  cer: { l: 'Cereales y tubérculos', e: '🍚' },
  leg: { l: 'Legumbres', e: '🫘' },
  ver: { l: 'Verduras', e: '🥦' },
  fru: { l: 'Frutas', e: '🍎' },
  gra: { l: 'Grasas y frutos secos', e: '🥜' },
  otr: { l: 'Otros', e: '🍯' }
};

// [nombre, categoría, kcal, prot, hidr, grasa, unidad, gramos/unidad, emoji?]
const FOOD_ROWS = [
  // ---- Proteínas ----
  ['Pechuga de pollo (cruda)', 'prot', 110, 23, 0, 1.5, 'filete', 150, '🍗'],
  ['Muslo de pollo sin piel (crudo)', 'prot', 121, 20, 0, 4.5, 'muslo', 120, '🍗'],
  ['Pechuga de pavo (cruda)', 'prot', 105, 24, 0, 1, 'filete', 150, '🦃'],
  ['Ternera magra / solomillo (crudo)', 'prot', 143, 22, 0, 6, 'filete', 150, '🥩'],
  ['Ternera picada magra 5% (cruda)', 'prot', 137, 21, 0, 5.5, 'hamburguesa', 120, '🥩'],
  ['Lomo de cerdo (crudo)', 'prot', 143, 21, 0, 6, 'filete', 150, '🥩'],
  ['Huevo entero', 'prot', 143, 12.6, 0.7, 9.5, 'huevo', 55, '🥚'],
  ['Clara de huevo', 'prot', 52, 10.9, 0.7, 0.2, 'clara', 33, '🥚'],
  ['Salmón (crudo)', 'prot', 208, 20, 0, 13, 'lomo', 150, '🐟'],
  ['Merluza (cruda)', 'prot', 71, 16, 0, 0.8, 'filete', 150, '🐟'],
  ['Bacalao fresco (crudo)', 'prot', 82, 18, 0, 0.7, 'lomo', 150, '🐟'],
  ['Dorada (cruda)', 'prot', 121, 20, 0, 4.2, 'ración', 150, '🐟'],
  ['Lubina (cruda)', 'prot', 97, 18, 0, 2.5, 'ración', 150, '🐟'],
  ['Atún al natural (lata)', 'prot', 116, 26, 0, 1, 'lata', 52, '🐟'],
  ['Atún en aceite (escurrido)', 'prot', 198, 29, 0, 8.2, 'lata', 52, '🐟'],
  ['Sardinas en lata', 'prot', 208, 25, 0, 11.5, 'lata', 85, '🐟'],
  ['Caballa (cruda)', 'prot', 205, 19, 0, 14, 'filete', 120, '🐟'],
  ['Gambas (crudas)', 'prot', 85, 18, 0.2, 1.1, 'ración', 150, '🦐'],
  ['Mejillones (crudos)', 'prot', 86, 12, 3.7, 2.2, 'ración', 150, '🦪'],
  ['Pulpo (cocido)', 'prot', 164, 30, 4.4, 2.1, 'ración', 150, '🐙'],
  ['Calamar (crudo)', 'prot', 92, 15.6, 3.1, 1.4, 'ración', 150, '🦑'],
  ['Salmón ahumado', 'prot', 172, 25, 0, 8, 'ración', 50, '🐟'],
  ['Jamón cocido extra', 'prot', 110, 18, 1.5, 3.5, 'loncha', 20, '🥓'],
  ['Fiambre de pavo', 'prot', 95, 17, 1.5, 2, 'loncha', 20, '🥓'],
  ['Jamón serrano', 'prot', 241, 31, 0, 13, 'loncha', 15, '🥓'],
  ['Tofu firme', 'prot', 120, 13, 2, 7, 'ración', 150, '🧈'],
  ['Tempeh', 'prot', 192, 20, 7.6, 11, 'ración', 100, '🫘'],
  ['Seitán', 'prot', 130, 25, 5, 1.5, 'ración', 100, '🌾'],
  ['Proteína whey (polvo)', 'prot', 380, 80, 6, 5, 'scoop', 30, '🥤'],
  ['Proteína vegetal (polvo)', 'prot', 370, 75, 8, 6, 'scoop', 30, '🥤'],

  // ---- Lácteos y bebidas ----
  ['Leche semidesnatada', 'lact', 46, 3.4, 4.8, 1.6, 'vaso', 200, '🥛'],
  ['Leche desnatada', 'lact', 35, 3.5, 5, 0.1, 'vaso', 200, '🥛'],
  ['Bebida de soja sin azúcar', 'lact', 33, 3.3, 0.8, 1.8, 'vaso', 200, '🥛'],
  ['Bebida de avena', 'lact', 45, 1, 7.5, 1.5, 'vaso', 200, '🥛'],
  ['Bebida de almendras sin azúcar', 'lact', 15, 0.5, 0.3, 1.1, 'vaso', 200, '🥛'],
  ['Yogur natural', 'lact', 61, 3.5, 4.7, 3.3, 'yogur', 125, '🥣'],
  ['Yogur griego natural', 'lact', 97, 9, 4, 5, 'yogur', 125, '🥣'],
  ['Yogur griego 0%', 'lact', 54, 10, 3.5, 0.2, 'yogur', 125, '🥣'],
  ['Skyr natural', 'lact', 63, 11, 4, 0.2, 'tarrina', 150, '🥣'],
  ['Queso fresco batido 0%', 'lact', 46, 8, 4, 0.2, 'tarrina', 125, '🥣'],
  ['Queso cottage', 'lact', 98, 11, 3.4, 4.3, 'tarrina', 180, '🧀'],
  ['Queso fresco (Burgos)', 'lact', 174, 13, 3.5, 12, 'ración', 50, '🧀'],
  ['Mozzarella light', 'lact', 165, 18, 1, 10, 'bola', 125, '🧀'],
  ['Queso curado', 'lact', 402, 25, 1.3, 33, 'loncha', 20, '🧀'],
  ['Kéfir natural', 'lact', 55, 3.5, 4.5, 3, 'vaso', 200, '🥛'],
  ['Zumo de naranja natural', 'lact', 45, 0.7, 10, 0.2, 'vaso', 200, '🍊'],

  // ---- Cereales y tubérculos ----
  ['Arroz blanco (cocido)', 'cer', 130, 2.7, 28, 0.3, 'ración', 150, '🍚'],
  ['Arroz integral (cocido)', 'cer', 123, 2.7, 25.6, 1, 'ración', 150, '🍚'],
  ['Pasta (cocida)', 'cer', 158, 5.8, 31, 0.9, 'plato', 200, '🍝'],
  ['Pasta integral (cocida)', 'cer', 150, 6, 30, 1.2, 'plato', 200, '🍝'],
  ['Quinoa (cocida)', 'cer', 120, 4.4, 21, 1.9, 'ración', 150, '🌾'],
  ['Cuscús (cocido)', 'cer', 112, 3.8, 23, 0.2, 'ración', 150, '🌾'],
  ['Avena en copos (cruda)', 'cer', 372, 13.5, 60, 7, 'ración', 40, '🌾'],
  ['Muesli sin azúcar', 'cer', 360, 10, 62, 6, 'ración', 40, '🥣'],
  ['Pan integral', 'cer', 247, 9, 41, 3.4, 'rebanada', 30, '🍞'],
  ['Pan blanco', 'cer', 265, 9, 52, 1, 'rebanada', 30, '🍞'],
  ['Pan de centeno', 'cer', 259, 8.5, 48, 3.3, 'rebanada', 30, '🍞'],
  ['Tortilla de trigo (wrap)', 'cer', 300, 8, 50, 7, 'wrap', 60, '🌯'],
  ['Tortita de arroz', 'cer', 387, 8, 82, 3, 'tortita', 9, '🍘'],
  ['Patata (cocida)', 'cer', 86, 1.9, 20, 0.1, 'patata mediana', 150, '🥔'],
  ['Boniato (cocido)', 'cer', 90, 2, 21, 0.1, 'boniato', 150, '🍠'],
  ['Maíz dulce (lata)', 'cer', 86, 3, 19, 1.4, 'lata', 140, '🌽'],
  ['Palomitas (sin mantequilla)', 'cer', 387, 13, 78, 4.5, 'bol', 20, '🍿'],

  // ---- Legumbres ----
  ['Lentejas (cocidas)', 'leg', 116, 9, 20, 0.4, 'plato', 200, '🫘'],
  ['Garbanzos (cocidos)', 'leg', 164, 8.9, 27, 2.6, 'ración', 150, '🫘'],
  ['Alubias (cocidas)', 'leg', 127, 8.7, 23, 0.5, 'ración', 150, '🫘'],
  ['Guisantes (cocidos)', 'leg', 81, 5, 14, 0.4, 'ración', 100, '🫛'],
  ['Edamame', 'leg', 121, 12, 9, 5, 'ración', 100, '🫛'],
  ['Hummus', 'leg', 177, 8, 14, 10, 'cucharada', 25, '🫘'],

  // ---- Verduras ----
  ['Brócoli', 'ver', 34, 2.8, 7, 0.4, 'ración', 150, '🥦'],
  ['Espinacas', 'ver', 23, 2.9, 3.6, 0.4, 'ración', 100, '🥬'],
  ['Lechuga', 'ver', 15, 1.4, 2.9, 0.2, 'ración', 80, '🥬'],
  ['Rúcula', 'ver', 25, 2.6, 3.7, 0.7, 'puñado', 30, '🥬'],
  ['Tomate', 'ver', 18, 0.9, 3.9, 0.2, 'tomate', 120, '🍅'],
  ['Tomate triturado', 'ver', 24, 1.3, 4, 0.2, 'ración', 100, '🍅'],
  ['Pepino', 'ver', 15, 0.7, 3.6, 0.1, 'pepino', 200, '🥒'],
  ['Zanahoria', 'ver', 41, 0.9, 10, 0.2, 'zanahoria', 80, '🥕'],
  ['Calabacín', 'ver', 17, 1.2, 3.1, 0.3, 'ración', 150, '🥒'],
  ['Pimiento rojo', 'ver', 31, 1, 6, 0.3, 'pimiento', 150, '🫑'],
  ['Cebolla', 'ver', 40, 1.1, 9, 0.1, 'cebolla', 110, '🧅'],
  ['Champiñones', 'ver', 22, 3.1, 3.3, 0.3, 'ración', 100, '🍄'],
  ['Coliflor', 'ver', 25, 1.9, 5, 0.3, 'ración', 150, '🥦'],
  ['Judías verdes', 'ver', 31, 1.8, 7, 0.2, 'ración', 150, '🫛'],
  ['Berenjena', 'ver', 25, 1, 6, 0.2, 'ración', 150, '🍆'],
  ['Espárragos', 'ver', 20, 2.2, 3.9, 0.1, 'ración', 100, '🌿'],
  ['Calabaza', 'ver', 26, 1, 6.5, 0.1, 'ración', 150, '🎃'],
  ['Remolacha (cocida)', 'ver', 44, 1.7, 10, 0.2, 'ración', 100, '🟣'],
  ['Aguacate', 'ver', 160, 2, 8.5, 14.7, 'medio aguacate', 100, '🥑'],
  ['Kale / col rizada', 'ver', 49, 4.3, 9, 0.9, 'ración', 80, '🥬'],
  ['Ajo', 'ver', 149, 6.4, 33, 0.5, 'diente', 4, '🧄'],
  ['Aceitunas', 'ver', 145, 1, 4, 15, 'puñado', 30, '🫒'],

  // ---- Frutas ----
  ['Plátano', 'fru', 89, 1.1, 23, 0.3, 'plátano', 120, '🍌'],
  ['Manzana', 'fru', 52, 0.3, 14, 0.2, 'manzana', 180, '🍎'],
  ['Naranja', 'fru', 47, 0.9, 12, 0.1, 'naranja', 180, '🍊'],
  ['Mandarina', 'fru', 53, 0.8, 13, 0.3, 'mandarina', 80, '🍊'],
  ['Pera', 'fru', 57, 0.4, 15, 0.1, 'pera', 170, '🍐'],
  ['Fresas', 'fru', 32, 0.7, 7.7, 0.3, 'ración', 150, '🍓'],
  ['Arándanos', 'fru', 57, 0.7, 14, 0.3, 'puñado', 80, '🫐'],
  ['Frambuesas', 'fru', 52, 1.2, 12, 0.7, 'puñado', 80, '🍓'],
  ['Frutos rojos (mezcla)', 'fru', 45, 0.8, 10, 0.4, 'ración', 100, '🫐'],
  ['Kiwi', 'fru', 61, 1.1, 15, 0.5, 'kiwi', 75, '🥝'],
  ['Piña', 'fru', 50, 0.5, 13, 0.1, 'rodaja', 100, '🍍'],
  ['Sandía', 'fru', 30, 0.6, 7.6, 0.2, 'ración', 250, '🍉'],
  ['Melón', 'fru', 34, 0.8, 8, 0.2, 'ración', 200, '🍈'],
  ['Uvas', 'fru', 69, 0.7, 18, 0.2, 'puñado', 100, '🍇'],
  ['Mango', 'fru', 60, 0.8, 15, 0.4, 'ración', 150, '🥭'],
  ['Melocotón', 'fru', 39, 0.9, 10, 0.3, 'melocotón', 150, '🍑'],
  ['Granada', 'fru', 83, 1.7, 19, 1.2, 'ración', 100, '🍎'],
  ['Cerezas', 'fru', 63, 1, 16, 0.2, 'puñado', 100, '🍒'],
  ['Dátiles', 'fru', 282, 2.5, 75, 0.4, 'dátil', 24, '🌴'],
  ['Higos', 'fru', 74, 0.8, 19, 0.3, 'higo', 50, '🫐'],
  ['Papaya', 'fru', 43, 0.5, 11, 0.3, 'ración', 150, '🍈'],
  ['Limón', 'fru', 29, 1.1, 9, 0.3, 'limón', 60, '🍋'],

  // ---- Grasas y frutos secos ----
  ['Aceite de oliva virgen extra', 'gra', 884, 0, 0, 100, 'cucharada', 10, '🫒'],
  ['Almendras', 'gra', 579, 21, 22, 50, 'puñado', 30, '🥜'],
  ['Nueces', 'gra', 654, 15, 14, 65, 'puñado', 30, '🥜'],
  ['Anacardos', 'gra', 553, 18, 30, 44, 'puñado', 30, '🥜'],
  ['Cacahuetes naturales', 'gra', 567, 26, 16, 49, 'puñado', 30, '🥜'],
  ['Pistachos', 'gra', 560, 20, 28, 45, 'puñado', 30, '🥜'],
  ['Avellanas', 'gra', 628, 15, 17, 61, 'puñado', 30, '🌰'],
  ['Crema de cacahuete 100%', 'gra', 598, 25, 20, 50, 'cucharada', 16, '🥜'],
  ['Semillas de chía', 'gra', 486, 17, 42, 31, 'cucharada', 12, '🌱'],
  ['Semillas de lino', 'gra', 534, 18, 29, 42, 'cucharada', 10, '🌱'],
  ['Semillas de calabaza', 'gra', 559, 30, 11, 49, 'cucharada', 10, '🌱'],
  ['Mantequilla', 'gra', 717, 0.9, 0.1, 81, 'porción', 10, '🧈'],
  ['Chocolate negro 85%', 'gra', 590, 10, 19, 46, 'onza', 10, '🍫'],
  ['Cacao puro en polvo', 'gra', 228, 20, 58, 14, 'cucharada', 8, '🍫'],

  // ---- Otros ----
  ['Miel', 'otr', 304, 0.3, 82, 0, 'cucharadita', 7, '🍯'],
  ['Mermelada', 'otr', 250, 0.4, 60, 0, 'cucharada', 15, '🍓'],
  ['Café solo', 'otr', 1, 0.1, 0, 0, 'taza', 50, '☕'],
  ['Tomate frito', 'otr', 80, 1.5, 10, 4, 'ración', 50, '🍅'],
  ['Salsa de soja', 'otr', 53, 8, 5, 0.6, 'cucharada', 15, '🥢'],
  ['Mostaza', 'otr', 66, 4, 5, 4, 'cucharadita', 5, '🌭'],
  ['Vinagre balsámico', 'otr', 88, 0.5, 17, 0, 'cucharada', 15, '🍇'],
  ['Caldo de verduras', 'otr', 5, 0.2, 0.8, 0.1, 'taza', 250, '🍲']
];

const FOODS = FOOD_ROWS.map((r, i) => ({
  id: 'f' + i, name: r[0], cat: r[1], kcal: r[2], p: r[3], c: r[4], f: r[5],
  unit: r[6] || null, ug: r[7] || null, emoji: r[8] || CATS[r[1]].e
}));
const FOOD_BY_NAME = Object.fromEntries(FOODS.map(f => [f.name, f]));

/* =====================================================================
   Platos (macros calculados automáticamente desde los ingredientes)
   type: desayuno | snack | comida | cena
   tags: hp = alta proteína, lc = bajo en hidratos, veg = vegetariano, vgn = vegano
   ===================================================================== */
const DISH_ROWS = [
  // ---------- DESAYUNOS ----------
  { n: 'Bowl de avena, plátano y whey', e: '🥣', type: 'desayuno', tags: ['hp', 'veg'], min: 8,
    ing: [['Avena en copos (cruda)', 50], ['Leche semidesnatada', 200], ['Plátano', 120], ['Proteína whey (polvo)', 30], ['Semillas de chía', 10]],
    steps: ['Calienta la leche con la avena a fuego medio 3-4 minutos, removiendo hasta que espese.', 'Retira del fuego y deja templar un minuto; añade el whey y mezcla bien para que no se formen grumos.', 'Pasa a un bol, añade el plátano en rodajas y espolvorea las semillas de chía.'] },
  { n: 'Tostada integral con aguacate y huevos', e: '🥑', type: 'desayuno', tags: ['veg'], min: 10,
    ing: [['Pan integral', 60], ['Aguacate', 70], ['Huevo entero', 110], ['Tomate', 60]],
    steps: ['Tuesta el pan.', 'Aplasta el aguacate con un tenedor, sazona con sal, pimienta y unas gotas de limón.', 'Cocina los huevos pochados o a la plancha con unas gotas de aceite.', 'Monta: pan, aguacate, rodajas de tomate y los huevos encima.'] },
  { n: 'Tortilla de claras con espinacas y pavo', e: '🍳', type: 'desayuno', tags: ['hp'], min: 10,
    ing: [['Clara de huevo', 165], ['Huevo entero', 55], ['Espinacas', 60], ['Fiambre de pavo', 40], ['Aceite de oliva virgen extra', 5], ['Pan integral', 60]],
    steps: ['Saltea las espinacas 1 minuto con el aceite y el pavo troceado.', 'Bate las claras con el huevo, sal y pimienta y viértelas en la sartén.', 'Cuaja a fuego medio-bajo, dobla la tortilla y sirve con el pan tostado.'] },
  { n: 'Skyr con frutos rojos, avena y nueces', e: '🫐', type: 'desayuno', tags: ['hp', 'veg'], min: 3,
    ing: [['Skyr natural', 200], ['Frutos rojos (mezcla)', 100], ['Avena en copos (cruda)', 30], ['Nueces', 15], ['Miel', 7]],
    steps: ['Pon el skyr en un bol.', 'Añade los frutos rojos, la avena y las nueces troceadas.', 'Termina con el hilo de miel.'] },
  { n: 'Pancakes de avena y plátano', e: '🥞', type: 'desayuno', tags: ['veg'], min: 15,
    ing: [['Avena en copos (cruda)', 60], ['Plátano', 120], ['Huevo entero', 110], ['Leche semidesnatada', 50], ['Miel', 7]],
    steps: ['Tritura la avena, el plátano, los huevos y la leche hasta obtener una masa fina.', 'Calienta una sartén antiadherente y vierte pequeñas porciones de masa.', 'Dora 2 minutos por cada lado.', 'Sirve con la miel por encima.'] },
  { n: 'Tostadas de pavo, tomate y AOVE', e: '🍞', type: 'desayuno', tags: ['hp'], min: 5,
    ing: [['Pan integral', 90], ['Fiambre de pavo', 60], ['Tomate', 100], ['Aceite de oliva virgen extra', 8], ['Kiwi', 75]],
    steps: ['Tuesta el pan.', 'Ralla o machaca el tomate y repártelo sobre las tostadas con el aceite.', 'Añade el fiambre de pavo y acompaña con el kiwi.'] },
  { n: 'Porridge de cacao con crema de cacahuete', e: '🍫', type: 'desayuno', tags: ['veg'], min: 8,
    ing: [['Avena en copos (cruda)', 50], ['Bebida de avena', 250], ['Cacao puro en polvo', 8], ['Crema de cacahuete 100%', 16], ['Plátano', 80]],
    steps: ['Cuece la avena con la bebida y el cacao 4-5 minutos a fuego medio.', 'Sirve en un bol con la crema de cacahuete en el centro.', 'Añade el plátano en rodajas.'] },

  // ---------- SNACKS ----------
  { n: 'Yogur griego con miel y nueces', e: '🥣', type: 'snack', tags: ['hp', 'veg'], min: 2,
    ing: [['Yogur griego 0%', 170], ['Nueces', 20], ['Miel', 7]],
    steps: ['Sirve el yogur en un bol.', 'Añade las nueces troceadas y la miel.'] },
  { n: 'Tortitas de arroz con crema de cacahuete y plátano', e: '🍘', type: 'snack', tags: ['vgn', 'veg'], min: 3,
    ing: [['Tortita de arroz', 27], ['Crema de cacahuete 100%', 20], ['Plátano', 100]],
    steps: ['Unta cada tortita con crema de cacahuete.', 'Cubre con rodajas finas de plátano.'] },
  { n: 'Hummus con bastones de verdura', e: '🥕', type: 'snack', tags: ['vgn', 'veg'], min: 5,
    ing: [['Hummus', 75], ['Zanahoria', 100], ['Pepino', 100], ['Pimiento rojo', 80]],
    steps: ['Corta la zanahoria, el pepino y el pimiento en bastones.', 'Sirve con el hummus para mojar.'] },
  { n: 'Batido de proteína con plátano y cacao', e: '🥤', type: 'snack', tags: ['hp', 'veg'], min: 3,
    ing: [['Proteína whey (polvo)', 30], ['Leche semidesnatada', 250], ['Plátano', 120], ['Cacao puro en polvo', 5]],
    steps: ['Pon todos los ingredientes en la batidora.', 'Tritura 30 segundos y bebe al momento (añade hielo si lo prefieres frío).'] },
  { n: 'Queso cottage con piña y chía', e: '🍍', type: 'snack', tags: ['hp', 'veg'], min: 3,
    ing: [['Queso cottage', 180], ['Piña', 120], ['Semillas de chía', 6]],
    steps: ['Pon el queso cottage en un bol.', 'Añade la piña en dados y las semillas de chía.'] },
  { n: 'Huevos duros con tomate', e: '🥚', type: 'snack', tags: ['hp', 'lc', 'veg'], min: 12,
    ing: [['Huevo entero', 110], ['Tomate', 150], ['Aceite de oliva virgen extra', 5], ['Pan integral', 30]],
    steps: ['Cuece los huevos 10 minutos en agua hirviendo y enfría en agua fría.', 'Pela, parte por la mitad y sirve con el tomate aliñado con aceite y sal.', 'Acompaña con el pan.'] },
  { n: 'Manzana con almendras y chocolate negro', e: '🍎', type: 'snack', tags: ['vgn', 'veg'], min: 2,
    ing: [['Manzana', 180], ['Almendras', 20], ['Chocolate negro 85%', 10]],
    steps: ['Corta la manzana en gajos.', 'Sirve con las almendras y el chocolate negro.'] },
  { n: 'Tortitas de arroz con atún y tomate', e: '🐟', type: 'snack', tags: ['hp'], min: 5,
    ing: [['Atún al natural (lata)', 104], ['Tortita de arroz', 27], ['Tomate', 60], ['Aceite de oliva virgen extra', 3]],
    steps: ['Escurre el atún y mézclalo con el aceite y un poco de pimienta.', 'Reparte sobre las tortitas y añade rodajas de tomate.'] },
  { n: 'Kéfir con kiwi y semillas', e: '🥝', type: 'snack', tags: ['veg'], min: 3,
    ing: [['Kéfir natural', 200], ['Kiwi', 75], ['Semillas de calabaza', 10]],
    steps: ['Sirve el kéfir en un vaso o bol.', 'Añade el kiwi en dados y las semillas.'] },

  // ---------- COMIDAS ----------
  { n: 'Pollo a la plancha con arroz integral y brócoli', e: '🍗', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Pechuga de pollo (cruda)', 200], ['Arroz integral (cocido)', 200], ['Brócoli', 200], ['Aceite de oliva virgen extra', 10]],
    steps: ['Cuece el arroz integral (unos 25 minutos) o usa arroz ya cocido.', 'Cuece el brócoli al vapor 5-6 minutos.', 'Sazona el pollo con sal, pimienta, ajo en polvo y pimentón; dóralo en la plancha 5-6 minutos por lado.', 'Sirve todo junto y alíñalo con el aceite crudo.'] },
  { n: 'Pasta integral con ternera y tomate', e: '🍝', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Pasta integral (cocida)', 250], ['Ternera picada magra 5% (cruda)', 150], ['Tomate triturado', 150], ['Cebolla', 60], ['Aceite de oliva virgen extra', 8]],
    steps: ['Cuece la pasta al dente según el envase.', 'Sofríe la cebolla picada con el aceite y añade la carne; deshazla hasta que esté dorada.', 'Añade el tomate triturado, sal y orégano y cuece 10 minutos.', 'Mezcla con la pasta y sirve.'] },
  { n: 'Salmón al horno con boniato y espárragos', e: '🐟', type: 'comida', tags: ['hp'], min: 30,
    ing: [['Salmón (crudo)', 160], ['Boniato (cocido)', 200], ['Espárragos', 150], ['Aceite de oliva virgen extra', 5], ['Limón', 30]],
    steps: ['Precalienta el horno a 200 °C.', 'Corta el boniato en gajos, ponlo en la bandeja con parte del aceite y hornea 15 minutos.', 'Añade los espárragos y el salmón sazonado con sal, pimienta y limón; hornea 12 minutos más.', 'Sirve con un chorrito de limón.'] },
  { n: 'Lentejas estofadas con verduras', e: '🫘', type: 'comida', tags: ['vgn', 'veg'], min: 40,
    ing: [['Lentejas (cocidas)', 300], ['Zanahoria', 80], ['Cebolla', 60], ['Pimiento rojo', 60], ['Tomate triturado', 80], ['Aceite de oliva virgen extra', 10]],
    steps: ['Sofríe la cebolla, el pimiento y la zanahoria picados con el aceite 8 minutos.', 'Añade el tomate, pimentón y comino y cocina 2 minutos.', 'Incorpora las lentejas cocidas con un poco de agua o caldo y cuece 10 minutos a fuego suave.', 'Rectifica de sal y sirve.'] },
  { n: 'Bowl de quinoa, pollo y aguacate', e: '🥗', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Quinoa (cocida)', 200], ['Pechuga de pollo (cruda)', 150], ['Aguacate', 70], ['Tomate', 100], ['Pepino', 80], ['Aceite de oliva virgen extra', 8]],
    steps: ['Cuece la quinoa 12-15 minutos y escúrrela.', 'Corta el pollo en tiras y dóralo en la plancha con sal y especias.', 'Corta el tomate, el pepino y el aguacate.', 'Monta el bowl con la quinoa de base, el resto encima y el aceite con limón.'] },
  { n: 'Merluza al horno con patata y judías verdes', e: '🐟', type: 'comida', tags: ['hp', 'lc'], min: 35,
    ing: [['Merluza (cruda)', 250], ['Patata (cocida)', 250], ['Judías verdes', 200], ['Aceite de oliva virgen extra', 10], ['Ajo', 4]],
    steps: ['Cuece la patata en rodajas y las judías verdes (15 y 8 minutos).', 'Coloca la merluza en una fuente con aceite, ajo laminado, sal y perejil.', 'Hornea a 190 °C unos 12 minutos.', 'Sirve con las verduras aliñadas.'] },
  { n: 'Salteado de ternera con verduras y arroz', e: '🥩', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Ternera magra / solomillo (crudo)', 160], ['Arroz blanco (cocido)', 200], ['Pimiento rojo', 100], ['Champiñones', 100], ['Cebolla', 60], ['Salsa de soja', 15], ['Aceite de oliva virgen extra', 8]],
    steps: ['Corta la ternera en tiras finas y las verduras en juliana.', 'Saltea la carne a fuego fuerte 2-3 minutos y reserva.', 'Saltea las verduras 5 minutos, devuelve la carne y añade la salsa de soja.', 'Sirve sobre el arroz cocido.'] },
  { n: 'Garbanzos con espinacas y huevo', e: '🥬', type: 'comida', tags: ['veg'], min: 20,
    ing: [['Garbanzos (cocidos)', 250], ['Espinacas', 200], ['Huevo entero', 55], ['Aceite de oliva virgen extra', 10], ['Ajo', 4]],
    steps: ['Dora el ajo laminado en el aceite sin que se queme.', 'Añade las espinacas y saltea hasta que se reduzcan.', 'Incorpora los garbanzos, pimentón y comino y cocina 5 minutos.', 'Cuece un huevo (duro o poché) y colócalo encima.'] },
  { n: 'Bowl burrito de pollo', e: '🌯', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Pechuga de pollo (cruda)', 170], ['Arroz blanco (cocido)', 150], ['Alubias (cocidas)', 120], ['Maíz dulce (lata)', 60], ['Tomate', 100], ['Aguacate', 50], ['Lechuga', 40]],
    steps: ['Sazona el pollo con comino, pimentón y ajo y dóralo en la plancha; córtalo en tiras.', 'Calienta el arroz y las alubias.', 'Monta el bowl: arroz, alubias, pollo, maíz, tomate, lechuga y aguacate.'] },
  { n: 'Pasta con atún y calabacín', e: '🍝', type: 'comida', tags: ['hp'], min: 20,
    ing: [['Pasta (cocida)', 250], ['Atún al natural (lata)', 104], ['Tomate triturado', 120], ['Calabacín', 150], ['Aceite de oliva virgen extra', 8]],
    steps: ['Cuece la pasta al dente.', 'Saltea el calabacín en dados con el aceite 5 minutos.', 'Añade el tomate y el atún escurrido y cocina 5 minutos.', 'Mezcla con la pasta.'] },
  { n: 'Pavo con puré de patata y calabacín', e: '🦃', type: 'comida', tags: ['hp'], min: 30,
    ing: [['Pechuga de pavo (cruda)', 180], ['Patata (cocida)', 250], ['Calabacín', 150], ['Leche semidesnatada', 40], ['Aceite de oliva virgen extra', 8]],
    steps: ['Cuece la patata en cubos 15 minutos y haz un puré con la leche, sal y nuez moscada.', 'Corta el calabacín en rodajas y dóralo en la plancha.', 'Marca el pavo en la plancha 4-5 minutos por lado.', 'Sirve con un chorrito de aceite.'] },
  { n: 'Arroz con gambas y verduras', e: '🦐', type: 'comida', tags: ['hp'], min: 25,
    ing: [['Arroz blanco (cocido)', 220], ['Gambas (crudas)', 200], ['Pimiento rojo', 80], ['Guisantes (cocidos)', 80], ['Aceite de oliva virgen extra', 8], ['Ajo', 4]],
    steps: ['Saltea el ajo y el pimiento en dados con el aceite 4 minutos.', 'Añade las gambas peladas y saltea 2-3 minutos.', 'Incorpora el arroz cocido y los guisantes, pimentón y sal, y saltea 3 minutos más.'] },
  { n: 'Tofu salteado con verduras y arroz integral', e: '🥢', type: 'comida', tags: ['vgn', 'veg', 'hp'], min: 25,
    ing: [['Tofu firme', 200], ['Arroz integral (cocido)', 200], ['Brócoli', 150], ['Zanahoria', 80], ['Salsa de soja', 15], ['Aceite de oliva virgen extra', 8]],
    steps: ['Escurre y prensa el tofu 10 minutos; córtalo en cubos.', 'Dóralo en la sartén con la mitad del aceite hasta que esté crujiente.', 'Saltea el brócoli y la zanahoria en el resto del aceite 5 minutos.', 'Añade el tofu y la salsa de soja y sirve sobre el arroz.'] },
  { n: 'Hamburguesa de ternera con patata al horno', e: '🍔', type: 'comida', tags: ['hp'], min: 35,
    ing: [['Ternera picada magra 5% (cruda)', 150], ['Patata (cocida)', 250], ['Lechuga', 40], ['Tomate', 80], ['Aceite de oliva virgen extra', 8]],
    steps: ['Corta la patata en gajos, aliña con aceite y especias y hornea a 200 °C 25 minutos.', 'Forma la hamburguesa con la carne, sal y pimienta.', 'Cocínala en la plancha 4 minutos por lado.', 'Sirve con la ensalada de lechuga y tomate.'] },
  { n: 'Lomo de cerdo con calabaza y ensalada', e: '🥩', type: 'comida', tags: ['hp'], min: 30,
    ing: [['Lomo de cerdo (crudo)', 170], ['Calabaza', 250], ['Lechuga', 60], ['Tomate', 80], ['Aceite de oliva virgen extra', 10]],
    steps: ['Corta la calabaza en cubos y hornéala a 200 °C 20 minutos con parte del aceite.', 'Dora el lomo en la plancha 4-5 minutos por lado.', 'Prepara la ensalada y alíñala con el resto del aceite.'] },
  { n: 'Tempeh con quinoa y verduras', e: '🌱', type: 'comida', tags: ['vgn', 'veg', 'hp'], min: 25,
    ing: [['Tempeh', 150], ['Quinoa (cocida)', 180], ['Espinacas', 100], ['Pimiento rojo', 100], ['Aceite de oliva virgen extra', 8]],
    steps: ['Corta el tempeh en láminas y dóralo en la sartén.', 'Saltea el pimiento y las espinacas 4 minutos.', 'Sirve sobre la quinoa con un chorrito de limón y salsa de soja.'] },
  { n: 'Pulpo con patata y pimentón', e: '🐙', type: 'comida', tags: ['hp', 'lc'], min: 20,
    ing: [['Pulpo (cocido)', 200], ['Patata (cocida)', 200], ['Aceite de oliva virgen extra', 10]],
    steps: ['Cuece las patatas en rodajas.', 'Calienta el pulpo cocido en rodajas.', 'Monta sobre la patata, añade aceite, pimentón y sal gruesa.'] },

  // ---------- CENAS ----------
  { n: 'Tortilla francesa de 3 huevos con ensalada', e: '🍳', type: 'cena', tags: ['hp', 'veg'], min: 10,
    ing: [['Huevo entero', 165], ['Aceite de oliva virgen extra', 5], ['Lechuga', 80], ['Tomate', 120], ['Pepino', 80], ['Pan integral', 60]],
    steps: ['Bate los huevos con sal.', 'Cuaja la tortilla en una sartén con el aceite, dóblala y sirve.', 'Acompaña con la ensalada y el pan integral.'] },
  { n: 'Ensalada completa de atún, huevo y aguacate', e: '🥗', type: 'cena', tags: ['hp', 'lc'], min: 12,
    ing: [['Atún al natural (lata)', 104], ['Huevo entero', 110], ['Aguacate', 70], ['Lechuga', 100], ['Tomate', 120], ['Maíz dulce (lata)', 40], ['Aceite de oliva virgen extra', 10]],
    steps: ['Cuece los huevos 10 minutos.', 'Trocea la lechuga, el tomate y el aguacate.', 'Añade el atún escurrido, el maíz y los huevos en cuartos.', 'Aliña con aceite, vinagre y sal.'] },
  { n: 'Crema de calabacín con pollo desmenuzado', e: '🍲', type: 'cena', tags: ['hp', 'lc'], min: 25,
    ing: [['Calabacín', 300], ['Patata (cocida)', 100], ['Cebolla', 50], ['Pechuga de pollo (cruda)', 150], ['Aceite de oliva virgen extra', 8]],
    steps: ['Pocha la cebolla con el aceite y añade el calabacín y la patata en trozos; cubre con agua y cuece 15 minutos.', 'Tritura hasta obtener una crema fina.', 'Cuece o plancha el pollo, desmenúzalo y colócalo sobre la crema.'] },
  { n: 'Dorada al horno con verduras', e: '🐟', type: 'cena', tags: ['hp'], min: 35,
    ing: [['Dorada (cruda)', 250], ['Patata (cocida)', 150], ['Pimiento rojo', 100], ['Cebolla', 60], ['Calabacín', 100], ['Aceite de oliva virgen extra', 10]],
    steps: ['Corta las verduras y la patata en láminas y colócalas en la bandeja.', 'Pon la dorada limpia encima, con sal, limón y aceite.', 'Hornea a 190 °C unos 25 minutos.'] },
  { n: 'Revuelto de champiñones y gambas', e: '🍄', type: 'cena', tags: ['hp'], min: 15,
    ing: [['Huevo entero', 110], ['Gambas (crudas)', 120], ['Champiñones', 150], ['Ajo', 4], ['Aceite de oliva virgen extra', 8], ['Pan integral', 60]],
    steps: ['Saltea el ajo y los champiñones laminados 5 minutos.', 'Añade las gambas peladas y cocina 2 minutos.', 'Incorpora los huevos batidos y remueve hasta que cuajen jugosos.', 'Sirve con el pan integral.'] },
  { n: 'Sándwich integral de pavo y queso fresco', e: '🥪', type: 'cena', tags: ['hp'], min: 7,
    ing: [['Pan integral', 90], ['Fiambre de pavo', 60], ['Queso fresco (Burgos)', 50], ['Tomate', 80], ['Lechuga', 30]],
    steps: ['Tuesta ligeramente el pan.', 'Monta con el queso fresco, el pavo, el tomate y la lechuga.', 'Cierra y córtalo por la mitad.'] },
  { n: 'Wrap de pollo y verduras', e: '🌯', type: 'cena', tags: ['hp'], min: 15,
    ing: [['Tortilla de trigo (wrap)', 120], ['Pechuga de pollo (cruda)', 130], ['Lechuga', 40], ['Tomate', 60], ['Yogur griego 0%', 40]],
    steps: ['Corta el pollo en tiras y dóralo en la plancha con especias.', 'Calienta los wraps 20 segundos por lado.', 'Rellena con pollo, lechuga, tomate y yogur como salsa; enrolla.'] },
  { n: 'Bacalao con tomate y pimientos', e: '🐟', type: 'cena', tags: ['hp', 'lc'], min: 30,
    ing: [['Bacalao fresco (crudo)', 250], ['Tomate triturado', 150], ['Pimiento rojo', 100], ['Cebolla', 60], ['Patata (cocida)', 150], ['Aceite de oliva virgen extra', 10]],
    steps: ['Sofríe la cebolla y el pimiento 8 minutos.', 'Añade el tomate y cocina 5 minutos más.', 'Coloca el bacalao encima, tapa y cuece 8 minutos.', 'Sirve con la patata cocida.'] },
  { n: 'Tofu al curry con verduras', e: '🍛', type: 'cena', tags: ['vgn', 'veg', 'hp'], min: 25,
    ing: [['Tofu firme', 200], ['Calabacín', 150], ['Pimiento rojo', 100], ['Bebida de soja sin azúcar', 100], ['Aceite de oliva virgen extra', 8], ['Arroz blanco (cocido)', 120]],
    steps: ['Dora el tofu en cubos con el aceite.', 'Añade las verduras troceadas y saltea 5 minutos.', 'Agrega curry en polvo y la bebida de soja y cuece 5 minutos.', 'Sirve con el arroz.'] },
  { n: 'Merluza a la plancha con puré de coliflor', e: '🐟', type: 'cena', tags: ['hp', 'lc'], min: 25,
    ing: [['Merluza (cruda)', 250], ['Coliflor', 250], ['Patata (cocida)', 80], ['Aceite de oliva virgen extra', 10]],
    steps: ['Cuece la coliflor y la patata 15 minutos y tritúralas con parte del aceite y sal.', 'Marca la merluza en la plancha 3-4 minutos por lado.', 'Sirve sobre el puré con un chorrito de aceite y limón.'] },
  { n: 'Ensalada templada de garbanzos y atún', e: '🥗', type: 'cena', tags: ['hp'], min: 10,
    ing: [['Garbanzos (cocidos)', 200], ['Atún al natural (lata)', 104], ['Tomate', 100], ['Cebolla', 40], ['Rúcula', 30], ['Aceite de oliva virgen extra', 10]],
    steps: ['Calienta ligeramente los garbanzos.', 'Mezcla con el atún, el tomate, la cebolla picada y la rúcula.', 'Aliña con aceite, vinagre y sal.'] }
];

function dishFromRow(r, i) {
  const items = r.ing.map(([name, g]) => {
    const f = FOOD_BY_NAME[name];
    if (!f) throw new Error('Ingrediente no encontrado: ' + name + ' en ' + r.n);
    return { food: f, g };
  });
  const m = { kcal: 0, p: 0, c: 0, f: 0, g: 0 };
  items.forEach(({ food, g }) => {
    m.kcal += food.kcal * g / 100; m.p += food.p * g / 100;
    m.c += food.c * g / 100; m.f += food.f * g / 100; m.g += g;
  });
  return { id: 'd' + i, name: r.n, emoji: r.e, type: r.type, tags: r.tags, min: r.min, items, steps: r.steps, m };
}
const DISHES = DISH_ROWS.map(dishFromRow);

/* =====================================================================
   Deporte
   ===================================================================== */
// MET (Compendium of Physical Activities, valores orientativos)
const ACTIVITIES = [
  { n: 'Caminar a paso ligero (5 km/h)', met: 3.5, e: '🚶' },
  { n: 'Caminar rápido (6,5 km/h)', met: 5.0, e: '🚶' },
  { n: 'Senderismo / caminata en cuesta', met: 6.0, e: '🥾' },
  { n: 'Correr suave (8 km/h)', met: 8.3, e: '🏃' },
  { n: 'Correr (10 km/h)', met: 9.8, e: '🏃' },
  { n: 'Correr rápido (12 km/h)', met: 11.8, e: '🏃' },
  { n: 'Bicicleta suave', met: 5.8, e: '🚴' },
  { n: 'Bicicleta moderada (20 km/h)', met: 8.0, e: '🚴' },
  { n: 'Spinning / bici estática intensa', met: 8.8, e: '🚴' },
  { n: 'Elíptica', met: 5.0, e: '🏃' },
  { n: 'Remo (máquina) moderado', met: 7.0, e: '🚣' },
  { n: 'Natación suave', met: 5.8, e: '🏊' },
  { n: 'Natación intensa', met: 9.8, e: '🏊' },
  { n: 'HIIT / circuito', met: 8.0, e: '🔥' },
  { n: 'Comba', met: 11.0, e: '🪢' },
  { n: 'Subir escaleras', met: 8.8, e: '🪜' },
  { n: 'Entrenamiento de fuerza (moderado)', met: 3.5, e: '🏋️' },
  { n: 'Entrenamiento de fuerza (intenso)', met: 6.0, e: '🏋️' },
  { n: 'Calistenia', met: 4.0, e: '🤸' },
  { n: 'Crossfit / entrenamiento funcional', met: 8.0, e: '🔥' },
  { n: 'Yoga', met: 2.5, e: '🧘' },
  { n: 'Pilates', met: 3.0, e: '🧘' },
  { n: 'Estiramientos / movilidad', met: 2.3, e: '🤸' },
  { n: 'Baile / Zumba', met: 6.0, e: '💃' },
  { n: 'Fútbol', met: 7.0, e: '⚽' },
  { n: 'Pádel / tenis (dobles)', met: 6.0, e: '🎾' },
  { n: 'Baloncesto', met: 6.5, e: '🏀' },
  { n: 'Boxeo / saco', met: 6.0, e: '🥊' },
  { n: 'Artes marciales', met: 10.0, e: '🥋' },
  { n: 'Patinaje', met: 7.0, e: '⛸️' }
];

const MUSCLES = {
  pecho: 'Pecho', espalda: 'Espalda', pierna: 'Pierna', gluteo: 'Glúteo e isquios',
  hombro: 'Hombro', biceps: 'Bíceps', triceps: 'Tríceps', core: 'Core'
};

// [nombre, grupo, lugar(c casa|g gimnasio), tipo(comp|iso), riesgos(rod,hom,esp,mun), consejo, imagen (Free Exercise DB)]
const EX_ROWS = [
  // ----- CASA -----
  ['Flexiones', 'pecho', 'c', 'comp', ['hom', 'mun'], 'Cuerpo en línea, codos a 45° del tronco, baja hasta casi tocar el suelo.', 'Pushups'],
  ['Flexiones inclinadas (manos en silla)', 'pecho', 'c', 'comp', [], 'Versión más fácil: manos en una superficie elevada.', 'Incline_Push-Up'],
  ['Flexiones diamante', 'triceps', 'c', 'comp', ['mun'], 'Manos juntas bajo el pecho, codos pegados al cuerpo.', 'Push-Ups_-_Close_Triceps_Position'],
  ['Fondos de tríceps en silla', 'triceps', 'c', 'comp', ['hom'], 'Espalda cerca de la silla, baja hasta 90° en los codos.', 'Bench_Dips'],
  ['Remo con mochila cargada', 'espalda', 'c', 'comp', ['esp'], 'Torso inclinado con espalda recta, lleva la mochila al ombligo.', 'Bent_Over_Two-Dumbbell_Row'],
  ['Remo invertido bajo una mesa', 'espalda', 'c', 'comp', ['hom'], 'Cuerpo recto, tira del pecho hacia el borde de la mesa.', 'Inverted_Row'],
  ['Superman', 'espalda', 'c', 'iso', [], 'Eleva brazos y piernas a la vez, mantén 2 s arriba.', 'Superman'],
  ['Sentadilla con peso corporal', 'pierna', 'c', 'comp', ['rod'], 'Rodillas alineadas con los pies, baja con el pecho alto.', 'Bodyweight_Squat'],
  ['Sentadilla búlgara', 'pierna', 'c', 'comp', ['rod'], 'Pie trasero apoyado en una silla, baja controlando.', 'Split_Squats'],
  ['Zancadas alternas', 'pierna', 'c', 'comp', ['rod'], 'Paso largo, rodilla delantera sin pasar mucho la punta del pie.', 'Bodyweight_Walking_Lunge'],
  ['Elevación de talones a una pierna', 'pierna', 'c', 'iso', [], 'Sube lento y baja lento, pausa arriba.', 'Standing_Calf_Raises'],
  ['Peso muerto rumano con mochila', 'gluteo', 'c', 'comp', ['esp'], 'Cadera atrás, espalda neutra, piernas casi rectas.', 'Stiff-Legged_Dumbbell_Deadlift'],
  ['Puente de glúteo', 'gluteo', 'c', 'iso', [], 'Aprieta glúteos arriba 2 segundos.', 'Butt_Lift_Bridge'],
  ['Hip thrust con la espalda en el sofá', 'gluteo', 'c', 'comp', [], 'Barbilla al pecho, empuja con los talones.', 'Barbell_Hip_Thrust'],
  ['Press de hombros con mochila o garrafas', 'hombro', 'c', 'comp', ['hom'], 'Core firme, empuja por encima de la cabeza sin arquear la zona lumbar.', 'Dumbbell_Shoulder_Press'],
  ['Elevaciones laterales con botellas', 'hombro', 'c', 'iso', [], 'Codos ligeramente flexionados, sube hasta la altura del hombro.', 'Side_Lateral_Raise'],
  ['Curl de bíceps con mochila', 'biceps', 'c', 'iso', [], 'Codos pegados al cuerpo, sin balancear.', 'Dumbbell_Bicep_Curl'],
  ['Plancha', 'core', 'c', 'iso', [], 'Cuerpo recto, abdomen y glúteos apretados. Mantén el tiempo indicado.', 'Plank'],
  ['Plancha lateral', 'core', 'c', 'iso', [], 'Cadera alta, cuerpo en línea. Cambia de lado.', 'Side_Bridge'],
  ['Dead bug', 'core', 'c', 'iso', [], 'Lumbar pegada al suelo mientras alternas brazo y pierna.', 'Dead_Bug'],
  ['Mountain climbers', 'core', 'c', 'iso', ['mun'], 'Ritmo constante, caderas bajas.', 'Mountain_Climbers'],
  ['Crunch abdominal', 'core', 'c', 'iso', [], 'Sube con control, sin tirar del cuello.', 'Crunches'],
  // ----- GIMNASIO -----
  ['Press de banca con barra', 'pecho', 'g', 'comp', ['hom'], 'Escápulas juntas, barra al pecho medio, empuja en vertical.', 'Barbell_Bench_Press_-_Medium_Grip'],
  ['Press inclinado con mancuernas', 'pecho', 'g', 'comp', ['hom'], 'Banco a 30°, baja hasta sentir estiramiento en el pecho.', 'Incline_Dumbbell_Press'],
  ['Aperturas en polea', 'pecho', 'g', 'iso', [], 'Codos ligeramente flexionados, junta las manos al frente.', 'Cable_Crossover'],
  ['Jalón al pecho', 'espalda', 'g', 'comp', [], 'Tira hacia la clavícula llevando los codos abajo.', 'Wide-Grip_Lat_Pulldown'],
  ['Remo con barra', 'espalda', 'g', 'comp', ['esp'], 'Torso a 45°, espalda recta, tira hacia el ombligo.', 'Bent_Over_Barbell_Row'],
  ['Remo en polea baja', 'espalda', 'g', 'comp', [], 'Pecho alto, junta escápulas al final.', 'Seated_Cable_Rows'],
  ['Remo con mancuerna a una mano', 'espalda', 'g', 'comp', [], 'Apoya una mano en el banco y tira con el codo hacia la cadera.', 'One-Arm_Dumbbell_Row'],
  ['Sentadilla con barra', 'pierna', 'g', 'comp', ['rod', 'esp'], 'Barra estable en trapecios, baja hasta paralelo o más.', 'Barbell_Squat'],
  ['Prensa de piernas', 'pierna', 'g', 'comp', ['rod'], 'Pies a la anchura de caderas, no bloquees las rodillas.', 'Leg_Press'],
  ['Extensión de cuádriceps', 'pierna', 'g', 'iso', ['rod'], 'Controla la bajada, pausa arriba.', 'Leg_Extensions'],
  ['Curl femoral tumbado', 'gluteo', 'g', 'iso', [], 'Cadera pegada al banco, baja lento.', 'Lying_Leg_Curls'],
  ['Peso muerto rumano con barra', 'gluteo', 'g', 'comp', ['esp'], 'Cadera atrás, barra pegada a las piernas, espalda neutra.', 'Romanian_Deadlift'],
  ['Hip thrust con barra', 'gluteo', 'g', 'comp', [], 'Empuja con talones, aprieta glúteos arriba.', 'Barbell_Hip_Thrust'],
  ['Zancadas con mancuernas', 'pierna', 'g', 'comp', ['rod'], 'Pasos largos y controlados.', 'Dumbbell_Lunges'],
  ['Elevación de gemelos de pie', 'pierna', 'g', 'iso', [], 'Recorrido completo, pausa arriba.', 'Standing_Calf_Raises'],
  ['Press militar con mancuernas', 'hombro', 'g', 'comp', ['hom'], 'Core firme, empuja sin arquear la espalda.', 'Dumbbell_Shoulder_Press'],
  ['Elevaciones laterales con mancuernas', 'hombro', 'g', 'iso', [], 'Sube hasta la altura del hombro, baja lento.', 'Side_Lateral_Raise'],
  ['Face pull en polea', 'hombro', 'g', 'iso', [], 'Tira hacia la cara abriendo los codos.', 'Face_Pull'],
  ['Curl de bíceps con mancuernas', 'biceps', 'g', 'iso', [], 'Sin balanceo, supina la muñeca al subir.', 'Dumbbell_Bicep_Curl'],
  ['Curl martillo', 'biceps', 'g', 'iso', [], 'Agarre neutro, codos fijos.', 'Hammer_Curls'],
  ['Extensión de tríceps en polea', 'triceps', 'g', 'iso', [], 'Codos pegados, extiende por completo.', 'Triceps_Pushdown'],
  ['Press francés con mancuerna', 'triceps', 'g', 'iso', ['hom'], 'Baja detrás de la cabeza con control.', 'Standing_Dumbbell_Triceps_Extension'],
  ['Fondos en paralelas', 'triceps', 'g', 'comp', ['hom'], 'Torso algo inclinado, baja hasta 90° en los codos.', 'Dips_-_Triceps_Version'],
  ['Crunch en polea', 'core', 'g', 'iso', [], 'Redondea el torso llevando los codos a las rodillas.', 'Cable_Crunch'],
  ['Plancha con peso', 'core', 'g', 'iso', [], 'Anillo o disco sobre la espalda, cuerpo recto.', 'Plank'],
  ['Elevación de piernas colgado', 'core', 'g', 'iso', ['esp'], 'Sin balanceo, sube las rodillas al pecho.', 'Hanging_Leg_Raise']
];
const EXERCISES = EX_ROWS.map((r, i) => ({ id: 'e' + i, n: r[0], g: r[1], place: r[2], kind: r[3], risk: r[4], tip: r[5], img: r[6] || null }));
const EX_PLACE = { c: 'Casa', g: 'Gimnasio' };
