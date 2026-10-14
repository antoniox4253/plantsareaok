import sharp from 'sharp'
import path from 'path'

async function makeProjectiles() {
  const basePeaPath = 'public/game-assets/images/Plants/PB00.png'
  
  // 1. Frozen Pea (tinted ice blue / cyan)
  // Shift hue to cyan and boost lightness/saturation
  const frozenPea = await sharp(basePeaPath)
    .modulate({
      hue: 90, // from green towards cyan/blue
      saturation: 1.5,
      brightness: 1.1,
    })
    .toFile('public/game-assets/plants/projectile_frozen_pea.webp')

  // 2. Fire Pea (tinted fiery red/orange)
  const firePea = await sharp(basePeaPath)
    .modulate({
      hue: -85, // from green towards orange/red
      saturation: 2.0,
      brightness: 1.2,
    })
    .toFile('public/game-assets/plants/projectile_fire_pea.webp')

  console.log('✅ Proyectiles generados:', frozenPea, firePea)
}

makeProjectiles().catch(console.error)
