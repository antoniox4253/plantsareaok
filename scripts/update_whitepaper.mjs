import fs from 'fs';
import path from 'path';

const wpPath = path.resolve('Plant_Arena_Whitepaper_v2.html');
const pubWpPath = path.resolve('public/whitepaper.html');

let content = fs.readFileSync(wpPath, 'utf8');

// 1. Agregar chip de Token $PLANTS en la portada
const oldChips = `<div class="chip">🌾 Farming & Crafting</div>
      <div class="chip">🏆 Torneos, Ranked & Duelos</div>
      <div class="chip">👥 Clanes & Tesoros</div>`;

const newChips = `<div class="chip">🌾 Farming & Crafting</div>
      <div class="chip">🌱 Token $PLANTS & Curva AMM</div>
      <div class="chip">🏆 Torneos, Ranked & Duelos</div>
      <div class="chip">👥 Clanes & Tesoros</div>`;

content = content.replace(oldChips, newChips);

// 2. Actualizar Tabla de Contenidos (TOC)
const oldToc = `    <a href="#tokenomics"><span>10. Tokenomics & Distribución de Pools</span><span>Cap. 10</span></a>
    <a href="#pase-vip"><span>11. Pase VIP (Pase de Batalla)</span><span>Cap. 11</span></a>
    <a href="#clanes-intro"><span>12. Clanes: Economía del Tesoro</span><span>Cap. 12</span></a>
    <a href="#clanes-guia"><span>13. Clanes: Flujo de Bóveda & Membresía</span><span>Cap. 13</span></a>
    <a href="#clanes-guerras"><span>14. Clanes: Asaltos, ELO & Protección</span><span>Cap. 14</span></a>
    <a href="#clanes-reparto"><span>15. Clanes: Cierre & Reparto de Temporada</span><span>Cap. 15</span></a>
    <a href="#clanes-donaciones"><span>16. Clanes: Donaciones de Semillas</span><span>Cap. 16</span></a>
    <a href="#seguridad"><span>17. Seguridad, Transacciones & Auditoría</span><span>Cap. 17</span></a>
    <a href="#roadmap"><span>18. Conclusión & Hoja de Ruta</span><span>Cap. 18</span></a>`;

const newToc = `    <a href="#tokenomics"><span>10. Tokenomics, Token $PLANTS & Curva AMM</span><span>Cap. 10</span></a>
    <a href="#mecanicas-token"><span>11. Ganancias Ranked, Halving & Quema</span><span>Cap. 11</span></a>
    <a href="#pase-vip"><span>12. Pase VIP (Pase de Batalla)</span><span>Cap. 12</span></a>
    <a href="#clanes-intro"><span>13. Clanes: Economía del Tesoro</span><span>Cap. 13</span></a>
    <a href="#clanes-guia"><span>14. Clanes: Flujo de Bóveda & Membresía</span><span>Cap. 14</span></a>
    <a href="#clanes-guerras"><span>15. Clanes: Asaltos, ELO & Protección</span><span>Cap. 15</span></a>
    <a href="#clanes-reparto"><span>16. Clanes: Cierre & Reparto de Temporada</span><span>Cap. 16</span></a>
    <a href="#clanes-donaciones"><span>17. Clanes: Donaciones de Semillas</span><span>Cap. 17</span></a>
    <a href="#seguridad"><span>18. Seguridad, Transacciones & Auditoría</span><span>Cap. 18</span></a>
    <a href="#roadmap"><span>19. Conclusión & Hoja de Ruta</span><span>Cap. 19</span></a>`;

content = content.replace(oldToc, newToc);

// 3. Reemplazar Capítulo 10 por Capítulo 10 (Página 12) + Capítulo 10B (Página 13)
const oldCap10 = `<!-- ======================================================================= -->
<!-- CAPÍTULO 10: TOKENOMICS & DISTRIBUCIÓN DE POOLS -->
<!-- ======================================================================= -->
<section class="page" id="tokenomics">
  <span class="eyebrow">10 · Economía & Tokenomics</span>
  <h2>Economía Dual Sostenible: Gemas & Oro</h2>
  <p class="lead">La economía de Plant Arena está diseñada para evitar los errores clásicos de hiperinflación de los juegos Play-to-Earn, utilizando sumideros constantes y balances matemáticos transparentes.</p>

  <div class="grid2">
    <div class="card">
      <h3 style="margin-top:0;color:var(--lime)">💎 Gemas (Token Premium)</h3>
      <ul>
        <li><b>Adquisición:</b> Compras de temporada, torneos y premios de Top Ranking.</li>
        <li><b>Utilidad:</b> Inscripciones de torneos, Pase VIP, fundación de clanes, compra de packs legendarios y gobernanza.</li>
        <li><b>Deflación:</b> La tasa de fundación de clanes (500 💎) es 100% quemada/absorbida por el sistema (cero inflación).</li>
      </ul>
    </div>
    <div class="card">
      <h3 style="margin-top:0;color:var(--gold)">🪙 Oro (Token de Progresión)</h3>
      <ul>
        <li><b>Adquisición:</b> Victorias en Ranked, cofres PVP, misiones y cosechas en Farming.</li>
        <li><b>Utilidad:</b> Nutrición del Árbol Madre, compra de semillas comunes, crafteo de herramientas y fusiones.</li>
        <li><b>Sumidero:</b> Fusión de plantas (1,000 Oro quemado por combinación) y comisiones de mercado.</li>
      </ul>
    </div>
  </div>

  <h3 style="margin-top:24px">Distribución de las Pools del Ecosistema</h3>
  <div class="flow">
    <div class="step"><b>40% Pool Ranked</b><br><span class="money">Premios Top</span><br><small>Reparto cada 30 días</small></div><div class="arrow">→</div>
    <div class="step"><b>25% Guerra Clanes</b><br><span class="money">Bóvedas Guild</span><br><small>Reserva 2,800 💎</small></div><div class="arrow">→</div>
    <div class="step"><b>15% Torneos</b><br><span class="money">Pozos Coliseo</span><br><small>Eventos semanales</small></div><div class="arrow">→</div>
    <div class="step"><b>10% Farming & Stake</b><br><span class="money">Recompensas</span><br><small>Emisión controlada</small></div><div class="arrow">→</div>
    <div class="step"><b>10% Fondo Desarrollo</b><br><span class="money">Liquidez & Servidores</span><br><small>Crecimiento continuo</small></div>
  </div>

  <div class="footer"><span>Tokenomics & Pools</span><span>12</span></div>
</section>`;

const newCap10And10B = `<!-- ======================================================================= -->
<!-- CAPÍTULO 10: TOKENOMICS, TOKEN $PLANTS & CURVA DE LIQUIDEZ AMM -->
<!-- ======================================================================= -->
<section class="page" id="tokenomics">
  <span class="eyebrow">10 · Economía, Token $PLANTS & AMM</span>
  <h2>Token $PLANTS & Curva de Liquidez Respaldada</h2>
  <p class="lead">Plant Arena integra un modelo económico armónico de tres monedas: <b>$PLANTS</b> (activo Web3 deflacionario respaldado 100% en USDT), <b>Gemas 💎</b> (token premium utilitario) y <b>Oro 🪙</b> (moneda de progresión e insumos).</p>

  <div class="grid3">
    <div class="card" style="border-color:var(--cyan)">
      <div class="num" style="color:var(--cyan);font-size:24px">🌱 $PLANTS</div>
      <div class="label" style="color:var(--cyan)">Token Oficial Web3</div>
      <p style="font-size:12px;margin-top:6px">Activo respaldado por reserva líquida en USDT (cadena BSC). Ganado por mérito competitivo y canjeable en el Automated Market Maker (AMM).</p>
    </div>
    <div class="card" style="border-color:var(--lime)">
      <div class="num" style="color:var(--lime);font-size:24px">💎 Gemas</div>
      <div class="label" style="color:var(--lime)">Moneda Premium</div>
      <p style="font-size:12px;margin-top:6px">Inscripción a torneos, Pase VIP, sobres garantizados y compra de packs de preventa. Paridad fija: 1 USDT = 100 Gemas.</p>
    </div>
    <div class="card" style="border-color:var(--gold)">
      <div class="num" style="color:var(--gold);font-size:24px">🪙 Oro</div>
      <div class="label" style="color:var(--gold)">Moneda de Progresión</div>
      <p style="font-size:12px;margin-top:6px">Nutrición del Árbol Madre, fusiones de cartas (1,000 Oro quemado por síntesis), recursos de cultivo y mercado P2P.</p>
    </div>
  </div>

  <h3 style="margin-top:20px">Curva de Liquidez Matemática (Automated Market Maker)</h3>
  <div class="formula">
    <span style="color:var(--cyan)">x (USDT Pool)</span> · <span style="color:var(--lime)">y (Virtual PLANTS)</span> = <span style="color:var(--gold)">k (200,000,000 Constante)</span>
  </div>

  <div class="grid2">
    <div class="card">
      <h4 style="margin:0 0 6px;color:var(--lime)">💧 Inyección Automática del 60%</h4>
      <p style="font-size:12.5px;color:#d8e8da;line-height:1.45">De cada pack adquirido en la preventa ($10, $25 o $50 USDT), el <b>60% de los fondos entra directamente y sin intermediarios al Pool de Liquidez USDT</b>. El 40% restante sustenta el desarrollo y servidores. Cada compra aumenta la reserva e incrementa el precio spot por ley matemática.</p>
    </div>
    <div class="card">
      <h4 style="margin:0 0 6px;color:var(--gold)">📈 Crecimiento Orgánico de Precio</h4>
      <p style="font-size:12.5px;color:#d8e8da;line-height:1.45">Con un precio base inicial de <b>$0.000200 USDT</b>, la liquidez ya se incrementó a más de <b>$266 USDT</b> y el precio spot superó los <b>$0.000353 USDT (+76.8% de apreciación real)</b>. Toda venta futura continúa impulsando el respaldo de cada token emitido.</p>
    </div>
  </div>

  <h3 style="margin-top:20px">Distribución de las Pools del Ecosistema</h3>
  <div class="flow">
    <div class="step"><b>40% Pool Ranked</b><br><span class="money">Premios Top</span><br><small>Reparto cada 30 días</small></div><div class="arrow">→</div>
    <div class="step"><b>25% Guerra Clanes</b><br><span class="money">Bóvedas Guild</span><br><small>Reserva 2,800 💎</small></div><div class="arrow">→</div>
    <div class="step"><b>15% Torneos</b><br><span class="money">Pozos Coliseo</span><br><small>Eventos semanales</small></div><div class="arrow">→</div>
    <div class="step"><b>10% Staking & Farm</b><br><span class="money">Recompensas</span><br><small>Emisión controlada</small></div><div class="arrow">→</div>
    <div class="step"><b>10% Fondo Dev</b><br><span class="money">Liquidez & Servidores</span><br><small>Soporte continuo</small></div>
  </div>

  <div class="footer"><span>Tokenomics, Token $PLANTS & AMM</span><span>12</span></div>
</section>

<!-- ======================================================================= -->
<!-- CAPÍTULO 11: GANANCIAS EN BATALLA, HALVING, STAKING & MECÁNICAS DE QUEMA -->
<!-- ======================================================================= -->
<section class="page" id="mecanicas-token">
  <span class="eyebrow">11 · Mecánicas de Emisión, Quema & Estabilidad</span>
  <h2>Ganancias Competitivas, Halving & Anti-Dumping</h2>
  <p class="lead">Para asegurar que el token mantenga su valor y premie la destreza del jugador, Plant Arena adopta un modelo deflacionario inspirado en Bitcoin, con filtros anti-bots y sumideros de absorción inmediata.</p>

  <div class="grid3">
    <div class="card">
      <div class="num">2,001+ 🏆</div>
      <div class="label">Arena 3 en Adelante</div>
      <p style="font-size:12px;margin-top:6px">Requisito obligatorio para minar $PLANTS en Ranked. Blindaje total contra granjas de cuentas secundarias y bots en ligas bajas.</p>
    </div>
    <div class="card">
      <div class="num">+20% 💎</div>
      <div class="label">Super Sink Deflacionario</div>
      <p style="font-size:12px;margin-top:6px">Canje directo de $PLANTS por Gemas con un 20% de bono gratuito. El <b>100% de los tokens canjeados es quemado (destruido)</b> para siempre.</p>
    </div>
    <div class="card">
      <div class="num">45 Días</div>
      <div class="label">Vesting Lineal Preventa</div>
      <p style="font-size:12px;margin-top:6px">Liberación diaria constante (1/45 por día). Protege a la comunidad contra ventas masivas y estabiliza la curva de liquidez.</p>
    </div>
  </div>

  <h3 style="margin-top:20px">El Modelo de Halving (Reducción Programada por Eras)</h3>
  <table class="table" style="margin-top:8px">
    <thead>
      <tr>
        <th>Era de Minado</th>
        <th>Rango de Tokens Acumulados</th>
        <th>Recompensa por Victoria</th>
        <th>Factor de Reducción</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:rgba(156,255,24,.07)">
        <td><b style="color:var(--lime)">Era 1 (Actual)</b></td>
        <td>0 a 500,000 $PLANTS</td>
        <td><b style="color:var(--lime)">5.0 PLANTS / win</b></td>
        <td>100% Emisión Base</td>
        <td><span class="check">● ACTIVA AHORA</span></td>
      </tr>
      <tr>
        <td><b>Era 2</b></td>
        <td>500,000 a 750,000 $PLANTS</td>
        <td><b>2.5 PLANTS / win</b></td>
        <td>50% de Reducción</td>
        <td>Próxima Etapa</td>
      </tr>
      <tr>
        <td><b>Era 3</b></td>
        <td>750,000 a 875,000 $PLANTS</td>
        <td><b>1.25 PLANTS / win</b></td>
        <td>75% de Reducción</td>
        <td>Programada</td>
      </tr>
      <tr>
        <td><b>Era 4</b></td>
        <td>875,000 a 937,500 $PLANTS</td>
        <td><b>0.625 PLANTS / win</b></td>
        <td>87.5% de Reducción</td>
        <td>Programada</td>
      </tr>
      <tr>
        <td><b>Era 5+</b></td>
        <td>Más de 937,500 $PLANTS</td>
        <td><b>0.3125 PLANTS / win</b></td>
        <td>Pozo de Emisión Final</td>
        <td>Estable</td>
      </tr>
    </tbody>
  </table>

  <h3 style="margin-top:20px">Staking en el Banco del Jardín (Multiplicador de Activos)</h3>
  <div class="grid3">
    <div class="card">
      <h4 style="margin:0 0 4px;color:var(--cyan)">Plan 30 Días</h4>
      <div style="font-size:18px;font-weight:900;color:var(--cyan)">12% APR</div>
      <p style="font-size:11.5px;color:#d8e8da;margin:4px 0">🎁 Recompensa: <b>1 Sobre Básico</b> de cartas directo a tu inventario.</p>
    </div>
    <div class="card">
      <h4 style="margin:0 0 4px;color:var(--lime)">Plan 60 Días</h4>
      <div style="font-size:18px;font-weight:900;color:var(--lime)">18% APR</div>
      <p style="font-size:11.5px;color:#d8e8da;margin:4px 0">🎁 Recompensa: <b>3 Sobres Básicos</b> (+1 Sobre Épico si ahorras &gt;15,000 tokens).</p>
    </div>
    <div class="card">
      <h4 style="margin:0 0 4px;color:var(--gold)">Plan 90 Días</h4>
      <div style="font-size:18px;font-weight:900;color:var(--gold)">28% APR</div>
      <p style="font-size:11.5px;color:#d8e8da;margin:4px 0">🎁 Recompensa: <b>3 Sobres Épicos + 1 Sobre Legendario + Skin Exclusiva Oro 24K</b>.</p>
    </div>
  </div>

  <div class="callout callout--lime" style="margin-top:16px">
    <strong>Retiro Sostenible a USDT:</strong> Para garantizar la liquidez perpetua de la piscina, las ventas directas aplican una tarifa del 10% (5% quema deflacionaria inmediata de tokens y 5% al fondo del ecosistema para premiar torneos y clanes) con un reloj de enfriamiento de 1 retiro cada 24 horas por usuario.
  </div>

  <div class="footer"><span>Mecánicas de Emisión, Halving & Quema</span><span>13</span></div>
</section>`;

content = content.replace(oldCap10, newCap10And10B);

// 4. Renumerar encabezados de capítulo y números de pie de página subsecuentes:
content = content.replace(
  `<span class="eyebrow">11 · Pase VIP (Pase de Batalla)</span>`,
  `<span class="eyebrow">12 · Pase VIP (Pase de Batalla)</span>`
);
content = content.replace(
  `<div class="footer"><span>Pase VIP</span><span>13</span></div>`,
  `<div class="footer"><span>Pase VIP</span><span>14</span></div>`
);

content = content.replace(
  `<span class="eyebrow">12 · Clanes & Sistema de Bóveda</span>`,
  `<span class="eyebrow">13 · Clanes & Sistema de Bóveda</span>`
);
content = content.replace(
  `<div class="footer"><span>Clanes · Resumen Ejecutivo</span><span>14</span></div>`,
  `<div class="footer"><span>Clanes · Resumen Ejecutivo</span><span>15</span></div>`
);

content = content.replace(
  `<span class="eyebrow">13 · Guía del Jugador: Bóveda de Clan</span>`,
  `<span class="eyebrow">14 · Guía del Jugador: Bóveda de Clan</span>`
);
content = content.replace(
  `<div class="footer"><span>Clanes · Flujo de Bóveda</span><span>15</span></div>`,
  `<div class="footer"><span>Clanes · Flujo de Bóveda</span><span>16</span></div>`
);

content = content.replace(
  `<span class="eyebrow">14 · Asaltos, ELO de Clan & Escudos</span>`,
  `<span class="eyebrow">15 · Asaltos, ELO de Clan & Escudos</span>`
);
content = content.replace(
  `<div class="footer"><span>Clanes · Guerras & ELO</span><span>16</span></div>`,
  `<div class="footer"><span>Clanes · Guerras & ELO</span><span>17</span></div>`
);

content = content.replace(
  `<span class="eyebrow">15 · Cierre de Temporada & Reparto</span>`,
  `<span class="eyebrow">16 · Cierre de Temporada & Reparto</span>`
);
content = content.replace(
  `<div class="footer"><span>Clanes · Reparto de Temporada</span><span>17</span></div>`,
  `<div class="footer"><span>Clanes · Reparto de Temporada</span><span>18</span></div>`
);

content = content.replace(
  `<span class="eyebrow">16 · Donaciones de Cartas & Blindaje</span>`,
  `<span class="eyebrow">17 · Donaciones de Cartas & Blindaje</span>`
);
content = content.replace(
  `<div class="footer"><span>Clanes · Donaciones & Blindaje</span><span>18</span></div>`,
  `<div class="footer"><span>Clanes · Donaciones & Blindaje</span><span>19</span></div>`
);

content = content.replace(
  `<span class="eyebrow">17 · Seguridad, Auditoría & Reglas Anti-Cheat</span>`,
  `<span class="eyebrow">18 · Seguridad, Auditoría & Reglas Anti-Cheat</span>`
);
content = content.replace(
  `<div class="footer"><span>Seguridad & Integridad</span><span>19</span></div>`,
  `<div class="footer"><span>Seguridad & Integridad</span><span>20</span></div>`
);

content = content.replace(
  `<span class="eyebrow">18 · Hoja de Ruta & Conclusión</span>`,
  `<span class="eyebrow">19 · Hoja de Ruta & Conclusión</span>`
);
content = content.replace(
  `<div class="footer"><span>Plant Arena · Master Whitepaper v2.0</span><span>20</span></div>`,
  `<div class="footer"><span>Plant Arena · Master Whitepaper v2.0</span><span>21</span></div>`
);

// Escribir en ambos archivos
fs.writeFileSync(wpPath, content, 'utf8');
fs.writeFileSync(pubWpPath, content, 'utf8');

console.log('✅ Ambos Whitepapers actualizados exitosamente con el Token $PLANTS y la Curva de Liquidez AMM');
