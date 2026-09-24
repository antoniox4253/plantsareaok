import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

/**
 * Utilidad CLI para remover fondos de imágenes y dejarlas con transparencia limpia (.png / .webp).
 *
 * Uso:
 *   node scripts/remove-background.mjs <imagen_entrada> [imagen_salida] [--threshold=30] [--color=auto|white|black|hex]
 */

function parseArgs() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log(`
Uso: node scripts/remove-background.mjs <input_path> [output_path] [opciones]

Opciones:
  --threshold=<num>  Tolerancia de color (defecto: 28, rango: 1-100)
  --feather=<num>    Suavizado de bordes/antialiasing (defecto: 12)
  --color=<tipo>     'auto' (esquinas), 'white', 'black', o hex como '#FFFFFF'
  --format=<fmt>     'webp' o 'png' (defecto: webp)
  --trim             Recortar espacio transparente sobrante (defecto: true)
`)
    process.exit(0)
  }

  let inputPath = args[0]
  let outputPath = null
  let threshold = 28
  let feather = 12
  let targetColorMode = 'auto'
  let format = 'webp'
  let trim = true

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--threshold=')) {
      threshold = Number(arg.split('=')[1])
    } else if (arg.startsWith('--feather=')) {
      feather = Number(arg.split('=')[1])
    } else if (arg.startsWith('--color=')) {
      targetColorMode = arg.split('=')[1].toLowerCase()
    } else if (arg.startsWith('--format=')) {
      format = arg.split('=')[1].toLowerCase()
    } else if (arg === '--no-trim') {
      trim = false
    } else if (!arg.startsWith('--') && !outputPath) {
      outputPath = arg
    }
  }

  if (!outputPath) {
    const dir = path.dirname(inputPath)
    const base = path.basename(inputPath, path.extname(inputPath))
    outputPath = path.join(dir, `${base}_transparent.${format}`)
  }

  return { inputPath, outputPath, threshold, feather, targetColorMode, format, trim }
}

async function removeBackground() {
  const { inputPath, outputPath, threshold, feather, targetColorMode, format, trim } = parseArgs()

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Archivo no encontrado: ${inputPath}`)
    process.exit(1)
  }

  console.log(`[BackgroundRemover] Procesando: ${inputPath}`)
  const image = sharp(inputPath).ensureAlpha()
  const metadata = await image.metadata()
  const { width, height } = metadata

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const channels = info.channels // 4 (RGBA)

  // 1. Determinar color de fondo
  let bgR = 255, bgG = 255, bgB = 255
  if (targetColorMode === 'white') {
    bgR = 255; bgG = 255; bgB = 255
  } else if (targetColorMode === 'black') {
    bgR = 0; bgG = 0; bgB = 0
  } else if (targetColorMode.startsWith('#')) {
    const hex = targetColorMode.replace('#', '')
    bgR = parseInt(hex.substring(0, 2), 16) || 255
    bgG = parseInt(hex.substring(2, 4), 16) || 255
    bgB = parseInt(hex.substring(4, 6), 16) || 255
  } else {
    // Modo AUTO: Muestrear las 4 esquinas de la imagen
    const corners = [
      0, // Top-Left
      (width - 1) * channels, // Top-Right
      ((height - 1) * width) * channels, // Bottom-Left
      ((height - 1) * width + (width - 1)) * channels, // Bottom-Right
    ]
    let sumR = 0, sumG = 0, sumB = 0
    for (const c of corners) {
      sumR += data[c]
      sumG += data[c + 1]
      sumB += data[c + 2]
    }
    bgR = Math.round(sumR / 4)
    bgG = Math.round(sumG / 4)
    bgB = Math.round(sumB / 4)
  }

  console.log(`[BackgroundRemover] Color de fondo objetivo: rgb(${bgR}, ${bgG}, ${bgB}) con tolerancia ${threshold}`)

  // 2. Procesar píxeles y aplicar canal alfa con suavizado en bordes
  const totalPixels = width * height
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * channels
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const a = data[offset + 3]

    if (a === 0) continue

    // Distancia Euclidiana en espacio RGB
    const dist = Math.sqrt(
      Math.pow(r - bgR, 2) +
      Math.pow(g - bgG, 2) +
      Math.pow(b - bgB, 2)
    )

    if (dist <= threshold) {
      data[offset + 3] = 0 // Transparente total
    } else if (dist < threshold + feather) {
      // Suavizado anti-alias en los bordes
      const factor = (dist - threshold) / feather
      data[offset + 3] = Math.min(a, Math.round(factor * 255))
    }
  }

  // 3. Reensamblar y optimizar imagen
  let pipeline = sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })

  if (trim) {
    try {
      pipeline = pipeline.trim()
    } catch {}
  }

  if (format === 'webp') {
    pipeline = pipeline.webp({ quality: 95, alphaQuality: 100, lossless: false })
  } else {
    pipeline = pipeline.png({ compressionLevel: 9 })
  }

  await pipeline.toFile(outputPath)
  console.log(`[BackgroundRemover] ✅ Guardado con éxito en: ${outputPath}`)
}

removeBackground().catch((err) => {
  console.error('[BackgroundRemover] Error fatal:', err)
  process.exit(1)
})
