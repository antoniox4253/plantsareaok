import path from 'path'
import { execSync } from 'child_process'

const MAPPINGS = [
  { file: '5102998142604480416.jpg', plantId: 'wallnut' },
  { file: '5102998142604480417.jpg', plantId: 'garlic' }, // Squash / Apisonaflor
  { file: '5102998142604480418.jpg', plantId: 'repeater' },
  { file: '5102998142604480419.jpg', plantId: 'iceberglettuce' },
  { file: '5102998142604480420.jpg', plantId: 'bonkchoy' },
  { file: '5102998142604480421.jpg', plantId: 'peashooter' },
  { file: '5102998142604480422.jpg', plantId: 'jalapeno' },
  { file: '5102998142604480423.jpg', plantId: 'sunflower' },
  { file: '5102998142604480424.jpg', plantId: 'twinsunflower' },
  { file: '5102998142604480425.jpg', plantId: 'melonpult' },
]

const SOURCE_DIR = 'c:/Users/familia/Downloads/doradas'
const DEST_DIR = 'public/game-assets/plants_golden'

console.log('🚀 Iniciando procesamiento de 10 Plantas Doradas...')

for (const item of MAPPINGS) {
  const input = path.join(SOURCE_DIR, item.file)
  const output = path.join(DEST_DIR, `${item.plantId}_golden.webp`)
  console.log(`Procesando ${item.plantId} (${item.file})...`)
  execSync(`node scripts/remove-background.mjs "${input}" "${output}" --color=white --threshold=25 --feather=10`, {
    stdio: 'inherit'
  })
}

console.log('✨ ¡Todas las 10 plantas doradas procesadas exitosamente!')
