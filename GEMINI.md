# Plant Arena - Guía y Reglas del Proyecto para Antigravity

Este documento es cargado automáticamente por Antigravity en cada conversación y define las capacidades, permisos y arquitectura del proyecto.

---

## 🗄️ Acceso y Consultas a la Base de Datos (Supabase PostgreSQL)

El asistente tiene **permiso explícito y autorización directa** para consultar la base de datos de producción y aplicar correcciones o diagnósticos cuando el usuario lo solicite.

### Utilidad CLI para Consultas
Se dispone de la herramienta `scripts/db.mjs` configurada para ejecutar consultas directas a través del connection pooler de Supabase:

```bash
# Consultar datos en vivo
node scripts/db.mjs "SELECT id, username, elo_rating, gold_balance, gems_balance FROM profiles LIMIT 5;"

# Ejecutar o verificar una migración SQL
node scripts/db.mjs -f supabase/migrations/149-fix-referral-gold-claim.sql
```

### Configuración de Conexión
- Las credenciales están en `.env` (archivo ignorado por git):
  - `DATABASE_URL`: `postgresql://postgres.lesrjhbzsampjsjbocfa:Sanki4253%24%24@aws-0-ca-central-1.pooler.supabase.com:5432/postgres` (Puerto 5432 para DDL y transacciones, región `ca-central-1`).
- La biblioteca `pg` está disponible en el entorno Node.js.

---

## 👥 Sistema de Referidos

- **Criterio de Amigo Válido**: Un jugador referido cuenta como válido en cuanto alcanza **1,100 copas** (`elo_rating >= 1100`).
- **Recompensas Permanentes**:
  - **100 Oro**: Por cada amigo válido que alcance 1,100 copas (`claim_referral_gold`).
  - **5% Comisión**: En gemas de cada depósito de los referidos (`claim_referral_deposit_gems`).
- **Metas de Temporada (15 días)**:
  - 10 amigos válidos: 1 Sobre Básico (`claim_referral_season_milestone('sobre_10')`).
  - 35 amigos válidos: 500 Gemas (`claim_referral_season_milestone('gemas_35')`).
- **Ranking de Temporada**: Top 1 al 5 reciben premios automáticos al cierre de temporada (`_cerrar_temporada_de_referidos()`).

---

## 🥊 Sistema de Ítems Equipables para Plantas (Protocolo y Arquitectura Integral)

Para agregar nuevos ítems equipables exclusivos a diferentes plantas (ej. Cinturón de Campeón para Bonk Choy, nuevos ítems para otras plantas), se **DEBE** seguir rigurosamente este protocolo de 7 capas para evitar errores de compilación, sobrecarga de RPC, pérdidas de sincronización o discrepancias visuales en combate:

---

### 1. Base de Datos (Supabase PostgreSQL)
- **Cero sobrecarga de firmas**: NUNCA crear simultáneamente funciones RPC con firmas `(UUID, TEXT)` y `(TEXT, TEXT)`. PostgREST fallará con `Could not choose the best candidate function`. La firma autoritativa es SIEMPRE `p_instance_id TEXT` y resuelve internamente el UUID o el identificador virtual `inst_base_<plantId>`.
- Las RPCs autoritativas son:
  - `public.equip_plant_item(p_instance_id TEXT, p_item_id TEXT)`
  - `public.unequip_plant_item(p_instance_id TEXT)`
- Cada ítem valida en SQL su regla de exclusividad (`IF p_item_id = '...' AND v_plant.plant_id <> '...' THEN RAISE...`).
- **Mazo Activo en PostgreSQL (`public._active_deck`)**:
  - Al generar el mazo para emparejamiento PvP o salas contra bots (`p1_deck` y `p2_deck`), `public._active_deck(p_uid UUID)` **SIEMPRE debe proyectar `pi.equipped_item`** en el CTE y en el JSON:
    `'equippedItem', od.equipped_item`
  - Si se omite, el servidor limpiará el ítem al entrar a combate y la planta combatirá sin sus bonificaciones ni su asset visual.

---

### 2. Tipos, Inventario y Comercio
- `src/types/game.ts`: `PlantCardInstance.equippedItem` y `PlantEntity.equippedItem`.
- `src/utils/pvpRewardManager.ts`:
  - Registrar el nuevo ID en el tipo `FarmingItemId` y en la interfaz `FarmingInventory`.
  - Inicializar en `0` dentro de `EMPTY_FARMING_INVENTORY`.
  - Agregar metadata, etiqueta e icono en `FARMING_ITEM_DEFINITIONS`.
- `src/components/Farming/FarmingPreview.tsx`:
  - Agregar el ítem con valor `0` en `DEMO_INVENTORY` para evitar errores en `npm run build`.
- `src/utils/marketplaceManager.ts`:
  - Registrar el precio mínimo de venta en `FARMING_ITEM_MIN_PRICES`.
- `src/components/Marketplace/Marketplace.tsx`:
  - Añadir el nuevo ítem a la lista de `order` en Recursos de Cultivo.

---

### 3. Estadísticas, Fusiones y Assets de Combate
- En `src/utils/gameConstants.ts` (`getScaledPlantConfig`):
  - Validar `plantId === '<planta_objetivo>' && equippedItem === '<item_id>'`.
  - Sumar las bonificaciones después de procesar las tiradas de fusión (ej. `scaled.maxHp + X`, `(scaled.damage ?? base) + Y`).
  - Asignar el nuevo aspecto visual: `sprite: '...'`, `icon: '...'`, `packetActive: '...'` y `packetDisabled: '...'`.
  - Las fusiones y subidas de nivel NUNCA deben sobrescribir o borrar el ítem equipado.

---

### 4. Reglas de Visibilidad e Interacción en Jardín (`Jardin.tsx` y `Jardin.css`)
- **Ocultamiento si no está desbloqueado**: El ítem en la sección "Recursos de Cultivo" sólo se renderiza si el jugador tiene cantidad `> 0` o si ya lo tiene equipado en alguna planta. Si el jugador nunca lo ha obtenido, permanece invisible.
- **Tarjeta interactiva clickeable**:
  - Al hacer clic en la tarjeta del ítem en Recursos de Cultivo, se valida si el jugador posee la planta correspondiente. Si no la tiene, se muestra alerta explicativa.
  - Si la tiene, se abre el modal de confirmación con vista previa del aspecto de combate y botón directo de `EQUIPAR` o `DESEQUIPAR`.
- **Botones en las Cartas**:
  - Usar textos limpios y concisos: `🥊 EQUIPAR` y `🥊 DESEQUIPAR` (no amontonar descripciones largas en el botón de la carta).
  - Usar los estilos estándar 3D RPG (`.jardin-equip-item-btn` y `.jardin-unequip-item-btn`) con gradientes vivos, bordes dorados/rojos, sombras y biselado interno.
  - El botón `EQUIPAR` sólo se muestra si el jugador posee unidades en sus recursos. Si no tiene ninguna disponible y no está equipada, la fila se oculta.
- **Modal de Confirmación**:
  - Usar la clase maestra `.jardin-upgrade-modal-btn` combinada con `.jardin-fuse-btn-cancel` y `.jardin-belt-confirm-btn--equip` / `.jardin-belt-confirm-btn--unequip`.

---

### 5. Propagación en el Motor de Batalla y Reconstrucción
- `src/engine/mazoDeLaSala.ts`:
  - `CartaDeMazo` y `MejorasDeCarta` deben incluir `equippedItem?: string | null`.
  - Mantener `equippedItem` opcional para preservar compatibilidad con suites de pruebas previas.
- `src/engine/simulate.ts`:
  - `crearPlantaPropia` y `crearPlantaDelRival` deben propagar `equippedItem` y asignar `spriteOverride` cuando el sprite escalado difiere del sprite base.
  - En el bucle de simulación `procesarLado`, `getScaledPlantConfig` **SIEMPRE debe recibir `planta.equippedItem`** para que los ataques y atributos escalados coincidan en cada tic.
- `src/engine/reconstruir.ts`:
  - `AccionRegistrada` debe conservar `equippedItem` para que las reconstrucciones en tiempo real no degraden la planta.
- `src/engine/asyncP1History.ts` & `src/engine/asyncP1Capture.ts`:
  - `AccionP1RankedEstricta` y `canonicalAction` **deben almacenar y normalizar `equippedItem`**. Si se omite, al reconstruir la partida tras la confirmación de una acción se perderá el ítem equipado y la planta revertirá a su asset viejo.
- `src/engine/asyncOpponent.ts`:
  - Al reconstruir o avanzar la línea temporal (`runAsyncTimeline`), al encolar `own_plant` y `rival_plant` en `state.pending`, proyectar siempre `cartaP1.equippedItem ?? j.equippedItem` y `carta.equippedItem`.
- `src/hooks/useGameEngine.ts`:
  - Propagar `cardEquippedItem` a `apuntarJugadaPropia`, `ejecutarCapturaPlantP1` y a `encolarAccionDelRival` para el rival.
  - **Fallback de seguridad**: Si `mazoMioRef` no incluyera `equippedItem` por alguna versión de sala legada, consultar como respaldo `localStorage` (`plant_instances`) para asegurar que el jugador nunca pierda sus bonificaciones en combate.

---

### 6. Previsualización y Representación en Campo (`Battlefield.tsx` y `PlantHand.tsx`)
- `src/components/Battlefield/Battlefield.tsx`:
  - `selectedCardConfig`: Debe resolverse con `getScaledPlantConfig(selectedCard, rolls, equippedItem)` para que la previsualización fantasma en el césped (`previewPlantConfig`) muestre el asset equipado mientras el jugador apunta la casilla.
  - Renderizado de unidades aliadas y rivales: `plants.map` y `enemies.map` deben resolver su `config` con `getScaledPlantConfig(entity.plantId, entity.statRolls, entity.equippedItem)`.
  - Plantas en brote (`pendingOwnPlants`): Resolver con `getScaledPlantConfig(pp.plantId, pp.statRolls, pp.equippedItem)`.
- `src/components/Battlefield/PlantHand.tsx`:
  - Recibir `deckCards={mazoMioParsed}` desde el campo de batalla.
  - `getSlotCardLevelData` debe resolver `equippedItem`.
  - **Asset del Paquete de Semillas**: La imagen del paquete en mano debe consultar `scaledConfig.packetActive` / `packetDisabled` (o fallback a `scaledConfig.icon || scaledConfig.sprite`) en lugar del `config` estático desequipado.
  - Si la carta tiene ítem equipado, mostrar una insignia destacada (ej. `.plant-hand__equipped-item-badge`) en la esquina del paquete de semillas y las clases de realce visual `.plant-hand__packet-wrap--equipped` / `.plant-hand__packet-img--equipped`.
  - En el tooltip de hover, mostrar el nombre especial de la planta y el desglose de stats del ítem.

---

### 7. Checklist Rápido para Nuevos Ítems
1. `supabase`: RPCs `equip_plant_item` y `unequip_plant_item` con regla de exclusividad; verificar `_active_deck`.
2. `gameConstants.ts`: Estadísticas aditivas + `sprite` + `icon` + `packetActive` + `packetDisabled` en `getScaledPlantConfig`.
3. `pvpRewardManager.ts`: Tipo de ítem + `EMPTY_FARMING_INVENTORY` + definición con icono.
4. `marketplaceManager.ts` & `Marketplace.tsx`: Precio mínimo y orden en catálogo de venta.
5. `FarmingPreview.tsx`: Inicialización en `0` para build.
6. `Jardin.tsx`: Handler de click en recursos, modal de confirmación y botón en carta.
7. `PlantHand.tsx`: Usar `scaledConfig` para `packetActive` / `packetDisabled` y badge de ítem.
8. `asyncP1History.ts` & `asyncOpponent.ts`: Preservar `equippedItem` en `AccionP1RankedEstricta`, `canonicalAction`, `apuntarJugadaPropia` y reconstrucciones de línea temporal.
9. `championBelt.test.ts`: Pruebas de stats, fusiones, exclusividad, serialización de mazo y reconstrucción de timeline.

