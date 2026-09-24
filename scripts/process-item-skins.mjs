import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

/**
 * Advanced transparent background converter for Plants Arena sprites & items.
 * Uses border flood-fill so internal whites (eyes, teeth, highlights) are NEVER erased.
 */
export async function processImageTransparent(inputPath, outputPath, options = {}) {
  const threshold = options.threshold ?? 32
  const feather = options.feather ?? 3
  const trim = options.trim ?? true

  const image = sharp(inputPath).ensureAlpha()
  const meta = await image.metadata()
  const { width: w, height: h } = meta

  const { data } = await image.raw().toBuffer({ resolveWithObject: true })
  // data is RGBA buffer of size w * h * 4

  const isBgCandidate = (idx) => {
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    // Distance from pure white [255, 255, 255]
    const dr = 255 - r
    const dg = 255 - g
    const db = 255 - b
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)
    return dist <= threshold
  }

  const visited = new Uint8Array(w * h) // 1 if external background
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0

  // 1. Seed border pixels
  for (let x = 0; x < w; x++) {
    // Top border (y = 0)
    let p0 = x
    let idx0 = p0 * 4
    if (isBgCandidate(idx0)) {
      visited[p0] = 1
      queue[tail++] = p0
    }
    // Bottom border (y = h - 1)
    let p1 = (h - 1) * w + x
    let idx1 = p1 * 4
    if (isBgCandidate(idx1)) {
      visited[p1] = 1
      queue[tail++] = p1
    }
  }

  for (let y = 0; y < h; y++) {
    // Left border (x = 0)
    let p0 = y * w
    let idx0 = p0 * 4
    if (!visited[p0] && isBgCandidate(idx0)) {
      visited[p0] = 1
      queue[tail++] = p0
    }
    // Right border (x = w - 1)
    let p1 = y * w + (w - 1)
    let idx1 = p1 * 4
    if (!visited[p1] && isBgCandidate(idx1)) {
      visited[p1] = 1
      queue[tail++] = p1
    }
  }

  // 2. BFS Flood-Fill external background
  while (head < tail) {
    const p = queue[head++]
    const cx = p % w
    const cy = Math.floor(p / w)

    // 4-way neighbors
    const neighbors = []
    if (cx > 0) neighbors.push(p - 1)
    if (cx < w - 1) neighbors.push(p + 1)
    if (cy > 0) neighbors.push(p - w)
    if (cy < h - 1) neighbors.push(p + w)

    for (const np of neighbors) {
      if (!visited[np]) {
        const nidx = np * 4
        if (isBgCandidate(nidx)) {
          visited[np] = 1
          queue[tail++] = np
        }
      }
    }
  }

  // 3. Apply transparency and anti-aliasing / edge de-fringing
  const outBuffer = Buffer.from(data)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const idx = p * 4

      if (visited[p]) {
        // Pure background
        outBuffer[idx + 3] = 0
      } else {
        // Check if this unvisited pixel is adjacent to any visited pixel (edge pixel)
        let hasBgNeighbor = false
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy
            const nx = x + dx
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              if (visited[ny * w + nx]) {
                hasBgNeighbor = true
                break
              }
            }
          }
          if (hasBgNeighbor) break
        }

        if (hasBgNeighbor) {
          // De-fringe: If this boundary pixel is very bright, reduce white halo and blend alpha
          const r = outBuffer[idx]
          const g = outBuffer[idx + 1]
          const b = outBuffer[idx + 2]
          const dr = 255 - r
          const dg = 255 - g
          const db = 255 - b
          const dist = Math.sqrt(dr * dr + dg * dg + db * db)

          // If distance from white is within the transition zone (up to threshold + feather * 6)
          const maxTransition = threshold + feather * 8
          if (dist < maxTransition) {
            const alphaFactor = Math.max(0, Math.min(1, (dist - threshold * 0.5) / (maxTransition - threshold * 0.5)))
            outBuffer[idx + 3] = Math.round(255 * alphaFactor)
            // Color decontaminate towards neighboring non-white color
            if (alphaFactor < 0.8) {
              outBuffer[idx] = Math.max(0, r - Math.round((255 - r) * 0.3))
              outBuffer[idx + 1] = Math.max(0, g - Math.round((255 - g) * 0.3))
              outBuffer[idx + 2] = Math.max(0, b - Math.round((255 - b) * 0.3))
            }
          }
        }
      }
    }
  }

  // Ensure output directory exists
  const outDir = path.dirname(outputPath)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  let finalImg = sharp(outBuffer, { raw: { width: w, height: h, channels: 4 } })
  if (trim) {
    finalImg = finalImg.trim()
  }

  const ext = path.extname(outputPath).toLowerCase()
  if (ext === '.webp') {
    await finalImg.webp({ quality: 92, alphaQuality: 100, lossless: false }).toFile(outputPath)
  } else {
    await finalImg.png({ compressionLevel: 8 }).toFile(outputPath)
  }

  console.log(`✓ Processed: ${inputPath} -> ${outputPath}`)
}
