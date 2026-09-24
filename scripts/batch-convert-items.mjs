import path from 'path'
import fs from 'fs'
import { processImageTransparent } from './process-item-skins.mjs'

const srcDir = 'C:/Users/familia/Downloads/items'

const conversions = [
  // Items
  { src: 'gafas.jpg', destWebp: 'public/game-assets/farming/sunflower_glasses.webp', destPng: 'public/game-assets/farming/sunflower_glasses.png', threshold: 30 },
  { src: 'armaduracactus.jpg', destWebp: 'public/game-assets/farming/cactus_armor.webp', destPng: 'public/game-assets/farming/cactus_armor.png', threshold: 30 },
  { src: 'superman.jpg', destWebp: 'public/game-assets/farming/superman_suit.webp', destPng: 'public/game-assets/farming/superman_suit.png', threshold: 30 },
  { src: 'spiderman.jpg', destWebp: 'public/game-assets/farming/spiderman_suit.webp', destPng: 'public/game-assets/farming/spiderman_suit.png', threshold: 30 },
  { src: 'batman.jpg', destWebp: 'public/game-assets/farming/batman_suit.webp', destPng: 'public/game-assets/farming/batman_suit.png', threshold: 30 },
  { src: 'ironman.jpg', destWebp: 'public/game-assets/farming/ironman_suit.webp', destPng: 'public/game-assets/farming/ironman_suit.png', threshold: 30 },
  { src: '24k.jpg', destWebp: 'public/game-assets/farming/gold_24k.webp', destPng: 'public/game-assets/farming/gold_24k.png', threshold: 30 },
  { src: 'samurai.jpg', destWebp: 'public/game-assets/farming/samurai_armor.webp', destPng: 'public/game-assets/farming/samurai_armor.png', threshold: 30 },

  // Skins (Equipped plant assets)
  { src: 'gafasgirasol.jpg', destWebp: 'public/game-assets/skins/gafasgirasol.webp', destPng: 'public/game-assets/skins/gafasgirasol.png', threshold: 32 },
  { src: 'armaduraconcactus.jpg', destWebp: 'public/game-assets/skins/armaduraconcactus.webp', destPng: 'public/game-assets/skins/armaduraconcactus.png', threshold: 32 },
  { src: 'papasuperman.jpg', destWebp: 'public/game-assets/skins/papasuperman.webp', destPng: 'public/game-assets/skins/papasuperman.png', threshold: 32 },
  { src: 'papaspiderman (1).jpg', destWebp: 'public/game-assets/skins/papaspiderman.webp', destPng: 'public/game-assets/skins/papaspiderman.png', threshold: 32 },
  { src: 'papabatman.jpg', destWebp: 'public/game-assets/skins/papabatman.webp', destPng: 'public/game-assets/skins/papabatman.png', threshold: 32 },
  { src: 'papaironman.jpg', destWebp: 'public/game-assets/skins/papaironman.webp', destPng: 'public/game-assets/skins/papaironman.png', threshold: 32 },
  { src: 'papa24k.jpg', destWebp: 'public/game-assets/skins/papa24k.webp', destPng: 'public/game-assets/skins/papa24k.png', threshold: 32 },
  { src: 'ajosamurai.jpg', destWebp: 'public/game-assets/skins/squashsamurai.webp', destPng: 'public/game-assets/skins/squashsamurai.png', threshold: 32 },
]

async function run() {
  console.log(`Starting conversion of ${conversions.length} images...`)
  for (const item of conversions) {
    const inputPath = path.join(srcDir, item.src)
    if (!fs.existsSync(inputPath)) {
      console.error(`Missing input file: ${inputPath}`)
      continue
    }

    const outWebp = path.resolve(process.cwd(), item.destWebp)
    const outPng = path.resolve(process.cwd(), item.destPng)

    await processImageTransparent(inputPath, outWebp, { threshold: item.threshold, feather: 3, trim: true })
    await processImageTransparent(inputPath, outPng, { threshold: item.threshold, feather: 3, trim: true })
  }
  console.log('All 16 assets successfully converted to transparent WebP & PNG!')
}

run().catch(console.error)
