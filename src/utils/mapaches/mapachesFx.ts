// Efectos visuales, proyectiles y animaciones de partículas para la batalla contra Mapaches

export interface ActiveFx {
  el: HTMLDivElement
  x: number
  y: number
  vx: number
  vy: number
  g: number
  life: number
  age: number
  s0: number
  s1: number
  o0: number
  o1: number
  rot: number
  vr: number
  dead?: boolean
  isBall?: boolean
  isKnife?: boolean
  isPea?: boolean
  lane?: number
  dmg?: number
  trailT?: number
  trailCls?: string
  target?: any
}

export const SLASH_SVG = `<svg viewBox="0 0 70 70" width="70" height="70" fill="none" stroke-linecap="round">
  <path d="M8 18 Q38 30 60 6" stroke="#fff" stroke-width="5"/>
  <path d="M8 18 Q38 30 60 6" stroke="#ffe08a" stroke-width="2"/>
  <path d="M6 36 Q38 48 64 22" stroke="#fff" stroke-width="5"/>
  <path d="M6 36 Q38 48 64 22" stroke="#ffe08a" stroke-width="2"/>
  <path d="M8 54 Q38 64 60 40" stroke="#fff" stroke-width="5"/>
  <path d="M8 54 Q38 64 60 40" stroke="#ffe08a" stroke-width="2"/>
</svg>`

export function spawnFx(
  layer: HTMLElement,
  cls: string,
  x: number,
  y: number,
  opts: Partial<ActiveFx> = {}
): ActiveFx {
  const el = document.createElement('div')
  el.className = 'fx ' + cls
  layer.appendChild(el)

  const fx: ActiveFx = {
    el,
    x,
    y,
    vx: opts.vx || 0,
    vy: opts.vy || 0,
    g: opts.g || 0,
    life: opts.life ?? 0.3,
    age: 0,
    s0: opts.s0 ?? 1,
    s1: opts.s1 ?? 1,
    o0: opts.o0 ?? 1,
    o1: opts.o1 ?? 0,
    rot: opts.rot || 0,
    vr: opts.vr || 0,
    ...opts,
  }

  return fx
}

export function spawnSlashFx(layer: HTMLElement, x: number, y: number, scale = 1): ActiveFx {
  const f = spawnFx(layer, 'slash', x, y, {
    life: 0.28,
    s0: 0.7 * scale,
    s1: 1.15 * scale,
    rot: -8,
    vr: 30,
  })
  f.el.innerHTML = SLASH_SVG
  return f
}

export function spawnRoarFx(layer: HTMLElement, x: number, y: number): void {
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      spawnFx(layer, 'ring', x, y + 20, {
        life: 0.75,
        s0: 0.4,
        s1: 8,
        o0: 0.95,
        o1: 0,
      })
    }, i * 140)
  }
  const f = spawnFx(layer, 'roartxt', x + 10, y - 25, {
    vy: -35,
    life: 1.2,
    s0: 0.7,
    s1: 1.4,
    o1: 0,
  })
  f.el.textContent = '¡GRRRR!'
}

export function spawnFuryFx(layer: HTMLElement, x: number, y: number, enter: boolean): void {
  if (enter) {
    const f = spawnFx(layer, 'furytxt', x, y - 20, {
      vy: -40,
      life: 1.1,
      s0: 0.7,
      s1: 1.3,
      o0: 1,
      o1: 0,
    })
    f.el.textContent = '¡FURIA!'
  } else {
    spawnFx(layer, 'steam', x + (Math.random() - 0.5) * 30, y - 10, {
      vx: (Math.random() - 0.5) * 30,
      vy: -50 - Math.random() * 30,
      life: 0.6,
      s0: 0.5,
      s1: 1.6,
      o0: 0.8,
    })
  }
}

export function spawnSummonFx(layer: HTMLElement, x: number, y: number): void {
  for (let i = 0; i < 10; i++) {
    spawnFx(layer, 'summon', x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 40, {
      vx: (Math.random() - 0.5) * 70,
      vy: -20 - Math.random() * 60,
      life: 0.65,
      s0: 0.5,
      s1: 1.8,
      o0: 0.9,
    })
  }
  spawnFx(layer, 'ring', x, y + 10, {
    life: 0.6,
    s0: 0.3,
    s1: 4,
    o0: 0.9,
    o1: 0,
  })
}
