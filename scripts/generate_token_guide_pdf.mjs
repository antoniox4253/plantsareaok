import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const outputPath = path.resolve('Guia_Token_PLANTS_y_Curva_de_Liquidez.pdf');

// Crear documento PDF con márgenes estándar y tamaño A4
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  info: {
    Title: 'Guía Completa: Token PLANTS, Curva de Liquidez y Nuevas Mecánicas',
    Author: 'Plant Arena Team',
    Subject: 'Economía Web3, Tokenomics y Mecánicas de Juego',
    Keywords: 'Plant Arena, PLANTS Token, Liquidity Pool, AMM, Web3 Gaming'
  }
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Paleta de colores corporativa RPG
const COLORS = {
  primary: '#15803d',     // Verde hoja principal
  primaryDark: '#14532d', // Verde oscuro
  primaryLight: '#dcfce7',// Verde fondo suave
  accent: '#0284c7',      // Azul piscina de liquidez
  accentLight: '#e0f2fe', // Azul fondo suave
  gold: '#b45309',        // Dorado
  goldLight: '#fef3c7',   // Fondo dorado suave
  dark: '#0f172a',        // Texto principal pizarra oscuro
  muted: '#475569',       // Texto secundario
  border: '#cbd5e1',      // Bordes
  white: '#ffffff',
  boxBg: '#f8fafc'
};

// Helper: Título de sección con barra de color
function renderSectionHeader(title, icon = '🌱') {
  const y = doc.y;
  doc.rect(45, y, 4, 18).fill(COLORS.primary);
  doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.primaryDark)
     .text(`  ${icon}  ${title}`, 52, y + 2);
  doc.y = y + 26;
}

// Helper: Cuadro destacado (Callout box)
function renderCalloutBox(title, text, borderColor = COLORS.primary, bgColor = COLORS.primaryLight) {
  const startY = doc.y;
  const width = doc.page.width - 90;
  
  // Calcular altura tentativa
  doc.fontSize(9.5).font('Helvetica');
  const textHeight = doc.heightOfString(text, { width: width - 24 });
  const totalHeight = textHeight + 30;

  // Si no cabe, saltar página
  if (startY + totalHeight > doc.page.height - 50) {
    doc.addPage();
  }

  const boxY = doc.y;
  doc.roundedRect(45, boxY, width, totalHeight, 6).fillAndStroke(bgColor, borderColor);
  
  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark)
     .text(title, 57, boxY + 8, { width: width - 24 });
  doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
     .text(text, 57, boxY + 22, { width: width - 24, lineGap: 2 });

  doc.y = boxY + totalHeight + 10;
}

// Helper: Tarjeta de característica
function renderFeatureCard(title, description, icon = '✔', color = COLORS.accent) {
  const width = doc.page.width - 90;
  const startY = doc.y;
  
  doc.fontSize(9).font('Helvetica');
  const descHeight = doc.heightOfString(description, { width: width - 36 });
  const cardHeight = Math.max(38, descHeight + 20);

  if (startY + cardHeight > doc.page.height - 50) {
    doc.addPage();
  }

  const y = doc.y;
  doc.roundedRect(45, y, width, cardHeight, 5).fillAndStroke('#ffffff', '#e2e8f0');
  
  // Icono / viñeta
  doc.circle(58, y + 14, 7).fill(color);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text(icon, 55, y + 10);

  doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.dark)
     .text(title, 72, y + 6, { width: width - 40 });
  doc.fontSize(8.5).font('Helvetica').fillColor(COLORS.muted)
     .text(description, 72, y + 19, { width: width - 40, lineGap: 1.5 });

  doc.y = y + cardHeight + 6;
}

// =========================================================================
// PÁGINA 1: PORTADA Y FUNDAMENTOS DEL TOKEN
// =========================================================================

// Encabezado Banner
doc.rect(45, 35, doc.page.width - 90, 60).fill(COLORS.primaryDark);
doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
   .text('PLANTS ARENA - ECONOMÍA Y TOKEN $PLANTS', 55, 47);
doc.fontSize(10).font('Helvetica').fillColor('#bbf7d0')
   .text('Guía Oficial y Didáctica: Curva de Liquidez, Ganancias y Nuevas Mecánicas', 55, 72);

doc.y = 110;

// Introducción
doc.fontSize(9.5).font('Helvetica').fillColor(COLORS.dark)
   .text('Esta guía explica de forma simple, visual y sin complicaciones cómo funciona el nuevo token ', { continued: true })
   .font('Helvetica-Bold').text('$PLANTS', { continued: true })
   .font('Helvetica').text(', el sistema automático de respaldo con dólares reales (Curva de Liquidez), cómo ganarlo jugando y por qué su valor está diseñado para crecer de manera sostenible.', { lineGap: 3 });

doc.moveDown(0.8);

// SECCIÓN 1: ¿Qué es el Token PLANTS?
renderSectionHeader('1. ¿Qué es el Token $PLANTS y cuál es su función?', '🪙');

doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
   .text('El token $PLANTS es el activo principal de la economía del juego. A diferencia de monedas ficticias de otros juegos, $PLANTS está respaldado por dinero real en dólares digitales (USDT) y posee utilidad directa dentro del juego:', { lineGap: 2 });

doc.moveDown(0.4);

renderFeatureCard(
  'Respaldo con Dinero Real (USDT)',
  'Cada token en circulación tiene valor respaldado por una reserva real de dólares USDT en la cadena BSC. No es un número inventado: si tienes tokens, siempre hay liquidez para cambiarlos por dólares.',
  '💵',
  '#059669'
);

renderFeatureCard(
  'Moneda de Recompensa y Canje',
  'Es la recompensa que ganas al competir en las ligas altas del juego. Puedes acumularlo, cambiarlo por gemas con un bono del +20%, o venderlo en la piscina por dólares USDT.',
  '💎',
  '#0284c7'
);

renderFeatureCard(
  'Oferta Limitada y Deflacionaria',
  'Nunca habrá tokens infinitos. Solo se minan a través de victorias competitivas y su emisión se reduce a la mitad periódicamente (Halving), mientras que al usarse en el juego se destruyen (queman).',
  '🔥',
  '#dc2626'
);

doc.moveDown(0.6);

// SECCIÓN 2: La Curva de Liquidez (Explicación para todos)
renderSectionHeader('2. ¿Cómo funciona la Curva de Liquidez? (Explicado con Manzanas)', '🌊');

renderCalloutBox(
  '💡 Imagina una "Máquina Expendedora Automática"',
  'Imagina una caja fuerte mágica que tiene dos compartimentos: uno con DÓLARES (USDT) y otro con TOKENS (PLANTS).\n\n' +
  '• Nadie fija el precio con el dedo: La máquina tiene una regla fija matemática (Fórmula AMM: x * y = k).\n' +
  '• Cuando entra dinero a la preventa: El 60% de cada compra va directamente a llenar la caja fuerte de dólares. Al haber más dólares respaldando y menos tokens libres, ¡el precio de cada token sube automáticamente!\n' +
  '• Cuando alguien quiere retirar: La máquina le entrega sus dólares directamente de la caja fuerte. El fondo nunca se queda vacío porque la fórmula equilibra la relación.',
  COLORS.accent,
  COLORS.accentLight
);

renderFeatureCard(
  'Inyección Automática del 60% en Preventa',
  'De cada pack vendido en preventa ($10, $25 o $50 USDT), el 60% entra cerrado e intocable al Pool de Liquidez. Esto asegura que el fondo crezca con cada compra de la comunidad.',
  '📈',
  '#059669'
);

renderFeatureCard(
  'Subida de Precio Garantizada con las Compras',
  'En el lanzamiento el precio inicial era $0.00020 USDT. Con las primeras compras de preventa, el precio ya subió a más de $0.00035 USDT (+76% de crecimiento respaldado al 100%).',
  '🚀',
  '#7c3aed'
);

// Salto a Página 2
doc.addPage();

// =========================================================================
// PÁGINA 2: CÓMO SE GANA Y EL SISTEMA DE HALVING
// =========================================================================

renderSectionHeader('3. ¿Cómo se Gana el Token $PLANTS Jugando?', '🏆');

doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
   .text('El sistema de ganancias está diseñado para premiar el mérito, la habilidad y el juego limpio, protegiendo la economía de cuentas falsas y granjas automáticas:', { lineGap: 2 });

doc.moveDown(0.4);

renderFeatureCard(
  'Requisito: Arena 3 en Adelante (2,001+ Copas)',
  'Para poder ganar tokens jugando en el modo Ranked, el jugador debe alcanzar la Arena 3 (2,001 copas). Esto garantiza que solo jugadores reales y con experiencia accedan al pozo de recompensas, evitando que bots en ligas bajas desangren el juego.',
  '🛡️',
  '#b45309'
);

renderFeatureCard(
  'Ganancias por Victoria Competitiva',
  'Cada victoria en partidas clasificatorias contra rivales de Arena 3 o superior acredita tokens $PLANTS directamente a tu balance líquido, listos para retirar, ahorrar o canjear.',
  '⚔️',
  '#15803d'
);

renderFeatureCard(
  'El Sistema de Halving (Como Bitcoin)',
  'Para que los tokens no pierdan valor con el tiempo, la recompensa por partida se reduce a la mitad conforme la comunidad progresa en eras de minado. Los primeros jugadores ganan más tokens por victoria, y luego cada token se vuelve más escaso y valioso.',
  '⏳',
  '#0284c7'
);

doc.moveDown(0.4);

// Tabla didáctica de Halving
const tableTop = doc.y;
const colWidths = [60, 140, 100, 110, 95];
const headers = ['Era', 'Rango de Tokens', 'Recompensa', 'Reducción', 'Estado'];

doc.rect(45, tableTop, doc.page.width - 90, 18).fill('#1e293b');
doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff');

let curX = 50;
headers.forEach((h, i) => {
  doc.text(h, curX, tableTop + 5, { width: colWidths[i] });
  curX += colWidths[i];
});

const halvingRows = [
  ['Era 1 (Actual)', '0 a 500,000 PLANTS', '5.0 PLANTS / win', '100% Recompensa', '🟢 ACTIVA AHORA'],
  ['Era 2', '500,000 a 750,000', '2.5 PLANTS / win', '50% Reducción', 'Próximamente'],
  ['Era 3', '750,000 a 875,000', '1.25 PLANTS / win', '75% Reducción', 'Futura'],
  ['Era 4', '875,000 a 937,500', '0.625 PLANTS / win', '87.5% Reducción', 'Futura'],
  ['Era 5+', 'Más de 937,500', '0.3125 PLANTS / win', 'Pozo mínimo final', 'Estable']
];

let curY = tableTop + 18;
halvingRows.forEach((row, rIdx) => {
  const bg = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
  doc.rect(45, curY, doc.page.width - 90, 16).fillAndStroke(bg, '#e2e8f0');
  
  doc.fontSize(8).font(rIdx === 0 ? 'Helvetica-Bold' : 'Helvetica')
     .fillColor(rIdx === 0 ? '#15803d' : COLORS.dark);
  
  let cellX = 50;
  row.forEach((cell, cIdx) => {
    doc.text(cell, cellX, curY + 4, { width: colWidths[cIdx] });
    cellX += colWidths[cIdx];
  });
  curY += 16;
});

doc.y = curY + 12;

// SECCIÓN 4: Staking y Vesting
renderSectionHeader('4. Multiplicadores: Staking y Vesting', '🌱');

renderCalloutBox(
  '🔒 Staking: Haz Crecer tus Tokens en el Banco del Jardín',
  'Si no deseas vender tus tokens de inmediato, puedes ponerlos en "Staking" (ahorro a plazo fijo):\n' +
  '• Plan 30 Días: 12% APR + 1 Sobre Básico de regalo.\n' +
  '• Plan 60 Días: 18% APR + 3 Sobres Básicos (+ 1 Sobre Épico si ahorras más de 15,000 tokens).\n' +
  '• Plan 90 Días: 28% APR + 3 Sobres Épicos + 1 Sobre Legendario + Skin Exclusiva Oro 24K.\n' +
  'Tus tokens quedan protegidos generando intereses diarios y regalos para tu mazo de combate.',
  COLORS.gold,
  COLORS.goldLight
);

renderFeatureCard(
  'Vesting Lineal de Preventa (45 Días)',
  'Los compradores de packs de preventa reciben sus tokens liberados día tras día durante 45 días (1/45 cada 24 horas). Esto protege a todos los jugadores evitando que un gran comprador venda todo en un día e impidiendo caídas bruscas del precio.',
  '📅',
  '#0284c7'
);

// Salto a Página 3
doc.addPage();

// =========================================================================
// PÁGINA 3: MECÁNICAS DE SOSTENIBILIDAD Y GUÍA EN 3 PASOS
// =========================================================================

renderSectionHeader('5. ¿Por qué el Token no va a desplomarse? (Mecánicas de Estabilidad)', '🛡️');

doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
   .text('Muchos juegos Web3 fracasaron porque la gente solo retiraba dinero y nadie lo gastaba dentro del juego. En Plants Arena implementamos tres motores económicos de absorción (Token Sinks):', { lineGap: 2 });

doc.moveDown(0.4);

renderFeatureCard(
  '1. Super Sink: Canje por Gemas con Bono del +20%',
  'Los jugadores pueden canjear sus $PLANTS directamente por Gemas dentro del juego recibiendo un 20% más de valor que su precio en dólares. ¡El 100% de los tokens canjeados de esta forma se QUEMAN (destruyen) inmediatamente, reduciendo la oferta en el mercado!',
  '🔥',
  '#dc2626'
);

renderFeatureCard(
  '2. Retiro Seguro a Dólares con Tarifa Sostenible (10%)',
  'Cuando un jugador retira a USDT, se aplica una comisión de retiro del 10%. El 5% se destruye en tokens para siempre (deflación) y el 5% va al pozo del ecosistema para premiar a los mejores clanes y torneos.',
  '🏦',
  '#059669'
);

renderFeatureCard(
  '3. Máximo 1 Retiro cada 24 Horas',
  'Se implementó un reloj de enfriamiento (cooldown) de 24 horas por usuario. Esto previene ataques de drenaje rápido y asegura que la liquidez del fondo siempre sea saludable y estable para todos.',
  '⏱️',
  '#7c3aed'
);

doc.moveDown(0.6);

// SECCIÓN 6: Resumen Express para Explicar a un Amigo
renderSectionHeader('6. Resumen en 3 Pasos: Para Explicar a Cualquiera en 1 Minuto', '💬');

const boxStepW = (doc.page.width - 90 - 20) / 3;
const stepY = doc.y;

// Paso 1
doc.roundedRect(45, stepY, boxStepW, 115, 6).fillAndStroke('#f0fdf4', '#86efac');
doc.fontSize(16).font('Helvetica-Bold').fillColor(COLORS.primary).text('1', 55, stepY + 8);
doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.primaryDark).text('Juega y Compite', 55, stepY + 30);
doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
   .text('Sube de copas a Arena 3 (2,001+). Cada victoria contra otros jugadores te da tokens reales $PLANTS.', 55, stepY + 45, { width: boxStepW - 20, lineGap: 1.5 });

// Paso 2
doc.roundedRect(45 + boxStepW + 10, stepY, boxStepW, 115, 6).fillAndStroke('#eff6ff', '#93c5fd');
doc.fontSize(16).font('Helvetica-Bold').fillColor('#0284c7').text('2', 55 + boxStepW + 10, stepY + 8);
doc.fontSize(10).font('Helvetica-Bold').fillColor('#0369a1').text('Respaldo Real', 55 + boxStepW + 10, stepY + 30);
doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
   .text('El 60% de todas las ventas va a un fondo intocable de dólares USDT. A más compras en el juego, más vale el token.', 55 + boxStepW + 10, stepY + 45, { width: boxStepW - 20, lineGap: 1.5 });

// Paso 3
doc.roundedRect(45 + (boxStepW + 10) * 2, stepY, boxStepW, 115, 6).fillAndStroke('#fefce8', '#fde047');
doc.fontSize(16).font('Helvetica-Bold').fillColor('#b45309').text('3', 55 + (boxStepW + 10) * 2, stepY + 8);
doc.fontSize(10).font('Helvetica-Bold').fillColor('#92400e').text('Tú Decides Qué Hacer', 55 + (boxStepW + 10) * 2, stepY + 30);
doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
   .text('Puedes retirar tus dólares USDT, ganar intereses en Staking, o cambiar por gemas con +20% de bono para mejorar tus plantas.', 55 + (boxStepW + 10) * 2, stepY + 45, { width: boxStepW - 20, lineGap: 1.5 });

doc.y = stepY + 125;

// Pie de página final
doc.rect(45, doc.y, doc.page.width - 90, 40).fill(COLORS.boxBg);
doc.fontSize(8.5).font('Helvetica-Bold').fillColor(COLORS.dark)
   .text('Plants Arena - Economía Justa, Sostenible y Respaldada al 100%', 55, doc.y + 8);
doc.fontSize(7.5).font('Helvetica').fillColor(COLORS.muted)
   .text('Documento oficial para la comunidad y creadores de contenido. Versión 1.0 - Temporada Preventa 2026.', 55, doc.y + 22);

// Finalizar y guardar el PDF
doc.end();

writeStream.on('finish', () => {
  console.log(`✅ PDF generado exitosamente en: ${outputPath}`);
});
