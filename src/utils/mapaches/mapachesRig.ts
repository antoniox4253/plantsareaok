// Sistema de recorte en Canvas, jerarquía DOM de Rigs y actualización de Poses
// Reproduce con exactitud la animación por articulaciones de los 5 Mapaches.

import {
  type MapacheCharDef,
  type MapacheKey,
  type Point,
  COLORS,
  getRawMapacheTemplates,
} from './mapachesData'

const IW = 815
const IH = 1087
const RES = 0.6

export interface MapacheRigInstance {
  ch: MapacheCharDef
  root: HTMLDivElement
  el: Record<string, HTMLDivElement>
  names: string[]
  k: number
  W: number
  H: number
  xf: Record<string, any>
  jumpScale?: number
  lift?: number
}

// Caché en memoria para no re-procesar los recortes de Canvas en cada partida
const processedCharsCache: Partial<Record<MapacheKey, MapacheCharDef>> = {}
let charsInitPromise: Promise<Record<MapacheKey, MapacheCharDef>> | null = null

function path(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * RES, y * RES)
    else ctx.lineTo(x * RES, y * RES)
  })
  ctx.closePath()
}

/**
 * Aplica crop / flip a las imágenes que lo requieren (Navajas, Rey Garra)
 * y ajusta las coordenadas del esqueleto al nuevo marco de referencia.
 */
function prepareSource(ch: MapacheCharDef, img: HTMLImageElement): CanvasImageSource {
  if (!ch.crop) {
    ch.iw = IW
    ch.ih = IH
    return img
  }

  const { x: cx, y: cy, w, h } = ch.crop
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')
  if (!x) return img

  x.translate(-cx, -cy)
  if (ch.flip && ch.srcW) {
    x.translate(ch.srcW, 0)
    x.scale(-1, 1)
  }
  x.drawImage(img, 0, 0, ch.srcW || w, ch.srcH || h)

  const mv = ([px, py]: Point): Point => [px - cx, py - cy]

  for (const P of Object.values(ch.parts)) {
    if (P.clip) P.clip = P.clip.map(mv)
    if (P.erase) P.erase = P.erase.map(mv)
    if (P.pivot) P.pivot = mv(P.pivot)
    if (P.backfill) {
      const list = Array.isArray(P.backfill) ? P.backfill : [P.backfill]
      for (const sh of list) {
        sh.pts = sh.pts.map(mv)
      }
    }
  }

  const checkJoint = (v?: { chain: string[]; pt: Point }) => {
    if (v && v.pt) v.pt = mv(v.pt)
  }
  checkJoint(ch.headTop)
  checkJoint(ch.fist)
  checkJoint(ch.claw)
  checkJoint(ch.knifeTip)
  checkJoint(ch.muzzle)
  checkJoint(ch.shell)
  if (ch.fists) {
    ch.fists.forEach(checkJoint)
  }

  if (ch.knifeBox) {
    const [a, b, c2, d] = ch.knifeBox
    ch.knifeBox = [a - cx, b - cy, c2 - cx, d - cy]
  }

  ch.iw = w
  ch.ih = h
  return c
}

/**
 * Corta cada pieza anatómica usando polígonos sobre Canvas y genera data URLs.
 */
function buildParts(ch: MapacheCharDef, img: HTMLImageElement): void {
  const preparedImg = prepareSource(ch, img)
  const w = Math.round((ch.iw || IW) * RES)
  const h = Math.round((ch.ih || IH) * RES)
  const out: Record<string, string> = {}

  const mk = (): HTMLCanvasElement => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  for (const [name, P] of Object.entries(ch.parts)) {
    if (!P.clip) continue
    const c = mk()
    const x = c.getContext('2d')
    if (!x) continue
    x.drawImage(preparedImg, 0, 0, w, h)

    const m = mk()
    const mx = m.getContext('2d')
    if (mx) {
      mx.lineWidth = 8
      mx.lineJoin = 'round'
      path(mx, P.clip)
      mx.fill()
      mx.stroke()
      x.globalCompositeOperation = 'destination-in'
      x.drawImage(m, 0, 0)
    }

    if (P.exclude) {
      x.globalCompositeOperation = 'destination-out'
      P.exclude.forEach((n) => {
        const excl = ch.parts[n]
        if (excl && excl.clip) {
          path(x, excl.clip)
          x.fill()
        }
      })
    }
    out[name] = c.toDataURL()
  }

  // Capa base con los orificios borrados
  const b = mk()
  const bx = b.getContext('2d')
  if (bx) {
    bx.drawImage(preparedImg, 0, 0, w, h)
    bx.globalCompositeOperation = 'destination-out'
    bx.lineWidth = 4
    bx.lineJoin = 'round'
    for (const P of Object.values(ch.parts)) {
      if (P.clip) {
        path(bx, P.erase || P.clip)
        bx.fill()
        bx.stroke()
      }
    }
  }
  out.base = b.toDataURL()

  // Rellenos oscuros o clonados para evitar huecos al rotar articulaciones
  for (const [name, P] of Object.entries(ch.parts)) {
    if (P.backfill) {
      const f = mk()
      const fx2 = f.getContext('2d')
      if (fx2) {
        const list = Array.isArray(P.backfill) ? P.backfill : [P.backfill]
        for (const sh of list) {
          if (sh.clone) {
            fx2.save()
            path(fx2, sh.pts)
            fx2.clip()
            fx2.drawImage(preparedImg, -sh.clone[0] * RES, -sh.clone[1] * RES, w, h)
            fx2.restore()
          } else if (sh.color) {
            fx2.fillStyle = sh.color
            path(fx2, sh.pts)
            fx2.fill()
          }
        }
      }
      out['fill:' + name] = f.toDataURL()
    }
  }

  // Sprite recortado del cuchillo arrojadizo (Navajas)
  if (ch.knifeBox) {
    const [x0, y0, x1, y1] = ch.knifeBox
    const kc = document.createElement('canvas')
    kc.width = Math.max(1, x1 - x0)
    kc.height = Math.max(1, y1 - y0)
    const kx = kc.getContext('2d')
    if (kx) {
      kx.drawImage(preparedImg, -x0, -y0)
      out.knifeSprite = kc.toDataURL()
    }
  }

  ch.urls = out
}

/**
 * Inicializa y corta todas las texturas de los 5 mapaches una sola vez.
 */
export async function ensureMapacheTextures(): Promise<Record<MapacheKey, MapacheCharDef>> {
  if (charsInitPromise) return charsInitPromise

  charsInitPromise = new Promise(async (resolve, reject) => {
    try {
      const templates = getRawMapacheTemplates()
      const keys = Object.keys(templates) as MapacheKey[]

      await Promise.all(
        keys.map(
          (key) =>
            new Promise<void>((res, rej) => {
              if (processedCharsCache[key]) {
                templates[key] = processedCharsCache[key]!
                res()
                return
              }
              const ch = templates[key]
              const img = new Image()
              img.crossOrigin = 'anonymous'
              img.onload = () => {
                try {
                  buildParts(ch, img)
                  processedCharsCache[key] = ch
                  res()
                } catch (e) {
                  rej(e)
                }
              }
              img.onerror = (e) => {
                console.error(`Error cargando imagen para mapache ${key}:`, ch.src, e)
                rej(new Error(`No se pudo cargar la imagen del mapache ${key}`))
              }
              img.src = ch.src
            })
        )
      )

      resolve(templates)
    } catch (err) {
      charsInitPromise = null
      reject(err)
    }
  })

  return charsInitPromise
}

/**
 * Crea la estructura de DOM anidada del rig con sus orígenes de transformación.
 */
export function createRig(ch: MapacheCharDef, height: number): MapacheRigInstance {
  const ih = ch.ih || IH
  const iw = ch.iw || IW
  const k = height / ih
  const W = iw * k

  const root = document.createElement('div')
  root.className = 'rig'
  root.style.width = `${W}px`
  root.style.height = `${height}px`
  root.style.position = 'absolute'
  root.style.left = '0'
  root.style.top = '0'

  const el: Record<string, HTMLDivElement> = {}
  const names: string[] = []
  let ci = 0

  const build = (node: string | { n: string; c: any[] }, parent: HTMLElement) => {
    const name = typeof node === 'string' ? node : node.n
    const d = document.createElement('div')
    d.className = 'p ' + name
    d.style.position = 'absolute'
    d.style.left = '0'
    d.style.top = '0'
    d.style.width = '100%'
    d.style.height = '100%'
    parent.appendChild(d)

    if (name === 'base' || name.startsWith('fill:')) {
      d.className = 'p base'
      if (ch.urls && ch.urls[name]) {
        const im = new Image()
        im.src = ch.urls[name]
        im.style.position = 'absolute'
        im.style.left = '0'
        im.style.top = '0'
        im.style.width = '100%'
        im.style.height = '100%'
        d.appendChild(im)
      }
      return
    }

    const P = ch.parts[name]
    if (!P) return
    const pv = P.pivot || [0, 0]
    d.style.transformOrigin = `${pv[0] * k}px ${pv[1] * k}px`
    d.style.setProperty('--c', COLORS[ci++ % COLORS.length])

    if (P.clip && ch.urls && ch.urls[name]) {
      const im = new Image()
      im.src = ch.urls[name]
      im.draggable = false
      im.style.position = 'absolute'
      im.style.left = '0'
      im.style.top = '0'
      im.style.width = '100%'
      im.style.height = '100%'
      im.style.userSelect = 'none'
      d.appendChild(im)
    }

    el[name] = d
    names.push(name)

    if (typeof node !== 'string' && node.c) {
      node.c.forEach((cn) => build(cn, d))
    }
  }

  ch.tree.forEach((n) => build(n, root))

  return { ch, root, el, names, k, W, H: height, xf: {} }
}

/**
 * Aplica los cálculos de la pose en cada tic (translate, rotate, scale, opacity).
 */
export function applyPose(rig: MapacheRigInstance, pose: Record<string, any>): void {
  const R = pose._root || {}
  rig.root.style.transformOrigin = '50% 92%'
  rig.root.style.transform = `translateY(${(R.ty || 0) * rig.k * (rig.jumpScale || 1)}px) rotate(${R.rot || 0}deg)`
  rig.lift = -(R.ty || 0) * rig.k * (rig.jumpScale || 1)

  for (const name of rig.names) {
    const p = pose[name] || {}
    rig.xf[name] = p
    const elem = rig.el[name]
    if (elem) {
      elem.style.transform = `translate(${(p.tx || 0) * rig.k}px, ${(p.ty || 0) * rig.k}px) rotate(${p.rot || 0}deg) scale(${p.sx ?? 1}, ${p.sy ?? 1})`
      elem.style.opacity = p.o == null ? '' : String(p.o)
    }
  }
}

/**
 * Proyecta la posición en pantalla de un punto anatómico (ej: boca del cañón, punta de la garra)
 * recorriendo la cadena inversa de transformaciones.
 */
export function mapPoint(rig: MapacheRigInstance, joint?: { chain: string[]; pt: Point }): Point {
  if (!joint) return [0, 0]
  const { chain, pt } = joint
  let [x, y] = pt
  for (let i = chain.length - 1; i >= 0; i--) {
    const n = chain[i]
    const p = rig.xf[n] || {}
    const part = rig.ch.parts[n]
    if (!part || !part.pivot) continue
    const [ox, oy] = part.pivot
    const dx = (x - ox) * (p.sx ?? 1)
    const dy = (y - oy) * (p.sy ?? 1)
    const a = ((p.rot || 0) * Math.PI) / 180
    const c = Math.cos(a)
    const s = Math.sin(a)
    x = ox + dx * c - dy * s + (p.tx || 0)
    y = oy + dx * s + dy * c + (p.ty || 0)
  }
  return [x * rig.k, y * rig.k]
}
