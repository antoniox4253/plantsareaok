---
name: plant-skin-equipment
description: >-
  Guía operativa y herramientas para integrar nuevos ítems equipables, skins visuales
  y recompensas para plantas en Plants Arena siguiendo el protocolo estricto de 7 capas:
  Base de datos, inventario/comercio, escalado de combate, jardín, motor de simulación,
  previsualización en campo y remoción/optimización de fondos transparentes de assets.
---

# Skill: Integración de Skins e Ítems Equipables para Plantas (Plants Arena)

Esta skill define el procedimiento estricto y autoritativo para procesar assets visuales, remover fondos y cablear completamente un nuevo ítem equipable o skin visual para cualquier planta del juego (como el *Cinturón de Campeón* para Bonk Choy o la *Papa con Casco*).

---

## 🛠️ Herramienta CLI de Procesamiento de Fondos Transparentes

Se dispone de `scripts/remove-background.mjs` para convertir automáticamente cualquier imagen con fondo sólido (blanco, negro, verde o personalizado) en un asset limpio y transparente en formato `.webp` o `.png`:

```bash
# Procesar con detección automática de fondo
node scripts/remove-background.mjs public/game-assets/temp/mi_item.png public/game-assets/items/mi_item.webp

# Forzar eliminación de fondo blanco con suavizado de bordes
node scripts/remove-background.mjs input.png output.webp --color=white --threshold=30 --feather=12

# Generar formato PNG
node scripts/remove-background.mjs input.jpg output.png --format=png
```

---

## 🏛️ Protocolo de Integración de 7 Capas

Cada vez que se añade un nuevo ítem/skin, se deben recorrer estas 7 capas:

### 1. Base de Datos (Supabase PostgreSQL)
- **Firma autoritativa**: Nunca sobrecargar firmas `(UUID, TEXT)` vs `(TEXT, TEXT)`. Usar siempre `p_instance_id TEXT`.
- Validar exclusividad en `equip_plant_item(p_instance_id, p_item_id)`.
- **Mazo Activo (`_active_deck`)**: Proyectar siempre `'equippedItem', od.equipped_item` en el JSON de combate.

### 2. Tipos, Inventario y Comercio
- `src/types/game.ts`: `PlantCardInstance.equippedItem` y `PlantEntity.equippedItem`.
- `src/utils/pvpRewardManager.ts`:
  - Registrar ID en `FarmingItemId` y `FarmingInventory`.
  - Inicializar en `0` en `EMPTY_FARMING_INVENTORY`.
  - Agregar etiqueta, icono y descripción en `FARMING_ITEM_DEFINITIONS`.
- `src/utils/marketplaceManager.ts`: Registrar precio mínimo en `FARMING_ITEM_MIN_PRICES`.
- `src/components/Marketplace/Marketplace.tsx`: Añadir a la lista de catálogo.
- `src/components/Farming/FarmingPreview.tsx`: Inicializar en `0` en `DEMO_INVENTORY` para el build.

### 3. Estadísticas, Fusiones y Assets Visuales
- `src/utils/gameConstants.ts` (`getScaledPlantConfig`):
  - Validar `plantId === '<planta>' && equippedItem === '<item_id>'`.
  - Aplicar bonificaciones de estadísticas (`hp`, `damage`, `attackSpeed`, etc.).
  - Asignar los nuevos assets visuales:
    - `sprite`: Sprite animado o imagen para el campo de batalla.
    - `icon`: Icono para modales, jardín y colección.
    - `packetActive`: Imagen de la carta cuando hay sol suficiente.
    - `packetDisabled`: Imagen de la carta cuando no hay sol o está en cooldown.

### 4. Jardín y Equipamiento
- `src/components/Jardin/Jardin.tsx`:
  - Renderizar ítem en Recursos de Cultivo si `qty > 0` o ya está equipado.
  - Al hacer clic, abrir modal de previsualización 3D con botón directo de `EQUIPAR` o `DESEQUIPAR`.
  - Ocultar fila si el jugador no posee unidades y no está equipado.

### 5. Motor de Batalla y Línea Temporal
- `src/engine/mazoDeLaSala.ts`: Incluir `equippedItem?: string | null` en `CartaDeMazo`.
- `src/engine/simulate.ts`: Propagar `planta.equippedItem` a `crearPlantaPropia` y `getScaledPlantConfig`.
- `src/engine/asyncP1History.ts` & `asyncOpponent.ts`: Conservar `equippedItem` en reconstrucciones.
- `src/hooks/useGameEngine.ts`: Fallback a `localStorage('plant_instances')` si el mazo de sala viniese sin el campo.

### 6. Interfaz de Combate y Mano
- `src/components/Battlefield/Battlefield.tsx`:
  - `selectedCardConfig`: Resolver con `getScaledPlantConfig(cardId, statRolls, equippedItem)` para previsualización fantasma en césped.
- `src/components/Battlefield/PlantHand.tsx`:
  - Usar `scaledConfig.packetActive` y `packetDisabled`.
  - Mostrar badge del ítem en la esquina superior izquierda del paquete de semillas.

### 7. Verificación de Calidad
- Ejecutar suite de pruebas: `cmd /c npx vitest run`.
- Ejecutar build de producción: `cmd /c npm run build`.
