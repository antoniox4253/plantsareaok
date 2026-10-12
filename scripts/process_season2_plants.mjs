import { execSync } from 'child_process'
import path from 'path'

const inputDir = 'C:/Users/familia/Downloads/plantas 2da temporada'
const outputDir = 'public/game-assets/plants'

const plantFiles = [
  { in: 'explodeonut.jpg', out: 'explodeonut.webp' },
  { in: 'gatling.jpg', out: 'gatlingpea.webp' },
  { in: 'ghostpeper.jpg', out: 'ghostpepper.webp' },
  { in: 'guacodile.jpg', out: 'guacodile.webp' },
  { in: 'marigold.jpg', out: 'marigold.webp' },
  { in: 'pickledpeper.jpg', out: 'pickledpepper.webp' },
  { in: 'snowpea.jpg', out: 'snowpea.webp' },
  { in: 'toad.jpg', out: 'toadstool.webp' },
  { in: 'torchwood.jpg', out: 'torchwood.webp' },
]

for (const p of plantFiles) {
  const inPath = path.join(inputDir, p.in)
  const outPath = path.join(outputDir, p.out)
  console.log(`Convirtiendo ${p.in} -> ${p.out}...`)
  execSync(`node scripts/remove-background.mjs "${inPath}" "${outPath}" --color=white --threshold=25 --feather=10`, {
    stdio: 'inherit',
  })
}

console.log('✅ Todas las 9 plantas fueron procesadas exitosamente!')
