import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const inputPath = 'C:/Users/familia/.gemini/antigravity/brain/f2db86d5-f7bf-47b4-9440-c9bad6f6f83c/.user_uploaded/media_1789837793470.jpg'
const outputWebp = path.join(__dirname, '../public/game-assets/greenfoot/mothertree_sentinel.webp')
const outputPng = path.join(__dirname, '../public/game-assets/farming/mother_tree_skin.png')

async function run() {
  const image = sharp(inputPath)
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  console.log(`Processing image ${width}x${height} with ${channels} channels...`)

  // Create an array for alpha channel
  const alpha = new Uint8Array(width * height)
  alpha.fill(255) // initially all opaque

  // Helper to get max brightness at (x, y)
  function getBrightness(x, y) {
    const idx = (y * width + x) * channels
    return Math.max(data[idx], data[idx + 1], data[idx + 2])
  }

  // BFS Queue for flood fill from the borders
  const visited = new Uint8Array(width * height)
  const queue = []

  // Push all border pixels that are dark
  const BG_THRESHOLD = 30

  for (let x = 0; x < width; x++) {
    if (getBrightness(x, 0) <= BG_THRESHOLD) {
      queue.push((0 * width) + x)
      visited[(0 * width) + x] = 1
    }
    if (getBrightness(x, height - 1) <= BG_THRESHOLD) {
      queue.push(((height - 1) * width) + x)
      visited[((height - 1) * width) + x] = 1
    }
  }

  for (let y = 0; y < height; y++) {
    if (getBrightness(0, y) <= BG_THRESHOLD) {
      queue.push((y * width) + 0)
      visited[(y * width) + 0] = 1
    }
    if (getBrightness(width - 1, y) <= BG_THRESHOLD) {
      queue.push((y * width) + (width - 1))
      visited[(y * width) + (width - 1)] = 1
    }
  }

  let head = 0
  while (head < queue.length) {
    const curr = queue[head++]
    const cx = curr % width
    const cy = Math.floor(curr / width)

    alpha[curr] = 0 // transparent background

    // Check 4 neighbors
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx
        if (!visited[nIdx]) {
          const b = getBrightness(nx, ny)
          if (b <= BG_THRESHOLD) {
            visited[nIdx] = 1
            queue.push(nIdx)
          }
        }
      }
    }
  }

  // Edge smoothing: pixels adjacent to transparent background that have low brightness
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (alpha[idx] > 0) {
        // Check if adjacent to background
        const isNearBg =
          alpha[idx - 1] === 0 ||
          alpha[idx + 1] === 0 ||
          alpha[idx - width] === 0 ||
          alpha[idx + width] === 0

        if (isNearBg) {
          const b = getBrightness(x, y)
          if (b < 60) {
            // Linear feathering
            const factor = Math.min(1, Math.max(0, (b - 8) / 52))
            alpha[idx] = Math.round(factor * 255)
          }
        }
      }
    }
  }

  // Create RGBA buffer
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const srcIdx = i * channels
    const dstIdx = i * 4
    rgba[dstIdx] = data[srcIdx]
    rgba[dstIdx + 1] = data[srcIdx + 1]
    rgba[dstIdx + 2] = data[srcIdx + 2]
    rgba[dstIdx + 3] = alpha[i]
  }

  // Save mothertree_sentinel.webp with target aspect ratio and high fidelity
  await sharp(rgba, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(outputWebp)

  console.log(`Saved transparent WebP to: ${outputWebp}`)

  // Also create a 256x256 square icon for farming resources
  await sharp(outputWebp)
    .resize(256, 256, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPng)

  console.log(`Saved transparent PNG icon to: ${outputPng}`)
}

run().catch(console.error)
