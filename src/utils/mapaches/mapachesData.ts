// Definición de personajes y cinemática de los Mapaches (PumPum, Garritas, Puños, Navajas, Rey Garra)
// Basado en el taller de animación con corte de polígonos y jerarquía de articulaciones.

export type Point = [number, number]

export interface BackfillShape {
  color?: string
  clone?: [number, number]
  pts: Point[]
}

export interface PartDef {
  clip?: Point[]
  erase?: Point[]
  pivot?: Point
  exclude?: string[]
  backfill?: BackfillShape | BackfillShape[]
}

export type TreeNode = string | { n: string; c: TreeNode[] }

export interface JointPoint {
  chain: string[]
  pt: Point
}

export interface AtkConfig {
  dur: number
  cd: number
  hit: number
  fx: 'slash' | 'punch' | 'knife'
  fury?: { every: number; count: number; mult: number }
}

export interface MapacheCharDef {
  key: MapacheKey
  name: string
  src: string
  desc: string
  kind: 'ranged' | 'melee' | 'thrower' | 'boss'
  speed: [number, number]
  stopPx: number
  rangePx: number
  hp: number
  maxHp?: number
  scale?: number
  boss?: boolean
  vSpeed?: number
  patrolX?: number
  minRow?: number
  holdLabel: string
  moveAtkLabel: string
  holdBtn?: string
  wsBtn?: string
  jumpsWalls?: boolean
  jumpDur?: number
  flip?: boolean
  srcW?: number
  srcH?: number
  crop?: { x: number; y: number; w: number; h: number }
  knifeBox?: [number, number, number, number]
  atk?: AtkConfig
  parts: Record<string, PartDef>
  tree: TreeNode[]
  muzzle?: JointPoint
  shell?: JointPoint
  claw?: JointPoint
  fists?: JointPoint[]
  headTop?: JointPoint
  fist?: JointPoint
  knifeTip?: JointPoint
  iw?: number
  ih?: number
  urls?: Record<string, string>
  jumpPose?: (j: number, t: number) => Record<string, any>
  pose: (state: string, phase: number, t: number, act?: number | null, o?: any) => Record<string, any>
}

export type MapacheKey = 'pumpum' | 'garritas' | 'punos' | 'navajas' | 'reygarra'

export const COLORS = ['#00e5ff', '#ff2bd6', '#ffe100', '#3dff6e', '#ff5a36', '#ffffff', '#a77bff', '#ff9f1a']

/**
 * Devuelve una copia limpia del catálogo de mapaches para que prepareSource() pueda mutar
 * coordenadas sin afectar llamadas posteriores o reinicios de nivel.
 */
export function getRawMapacheTemplates(): Record<MapacheKey, MapacheCharDef> {
  return {
    pumpum: {
      key: 'pumpum',
      name: 'PumPum',
      src: '/images/mapaches/pumpum.webp',
      desc: 'Artillero de rango. Avanza lento, dispara balas de cañón y se planta a 3 casillas de su objetivo.',
      kind: 'ranged',
      speed: [15, 19],
      stopPx: 300,
      rangePx: 500,
      hp: 14,
      holdLabel: 'quieto · disparando',
      moveAtkLabel: 'avanzando · disparando',
      parts: {
        tail: {
          clip: [[592, 650], [650, 592], [740, 566], [814, 596], [814, 700], [794, 802], [744, 866], [658, 868], [598, 848], [584, 780]],
          erase: [[648, 640], [700, 585], [740, 566], [814, 596], [814, 700], [794, 802], [744, 866], [662, 868], [644, 846], [646, 760]],
          pivot: [628, 800],
        },
        backLeg: {
          clip: [[468, 792], [560, 780], [612, 798], [652, 850], [664, 884], [724, 944], [726, 1012], [526, 1012], [526, 946], [503, 890], [466, 852]],
          erase: [[503, 862], [606, 862], [614, 836], [652, 858], [664, 884], [724, 944], [726, 1012], [526, 1012], [526, 946], [503, 890]],
          pivot: [566, 820],
        },
        frontLeg: {
          clip: [[104, 788], [180, 754], [262, 758], [348, 780], [368, 842], [338, 898], [258, 916], [244, 960], [244, 1034], [50, 1034], [56, 984], [96, 918], [110, 858]],
          erase: [[108, 806], [312, 800], [356, 842], [338, 898], [258, 916], [244, 960], [244, 1034], [50, 1034], [56, 984], [96, 918], [110, 858]],
          pivot: [292, 812],
        },
        arms: {
          clip: [[2, 446], [60, 414], [186, 446], [214, 426], [324, 426], [338, 470], [366, 494], [472, 524], [566, 554], [572, 642], [488, 694], [384, 704], [300, 706], [150, 694], [100, 648], [98, 604], [14, 622], [0, 560]],
          pivot: [520, 572],
        },
        head: {
          clip: [[164, 296], [200, 214], [276, 106], [352, 116], [432, 94], [502, 106], [560, 76], [648, 86], [664, 180], [654, 278], [696, 290], [702, 330], [682, 376], [640, 414], [600, 424], [640, 470], [662, 520], [656, 606], [600, 614], [554, 592], [520, 562], [470, 542], [420, 526], [354, 502], [336, 472], [324, 428], [240, 428], [200, 420], [172, 360]],
          erase: [[164, 296], [200, 214], [276, 106], [352, 116], [432, 94], [502, 106], [560, 76], [648, 86], [664, 180], [654, 278], [696, 290], [702, 330], [682, 376], [640, 414], [600, 424], [540, 450], [470, 468], [400, 470], [336, 462], [324, 428], [240, 428], [200, 420], [172, 360]],
          pivot: [468, 500],
          exclude: ['knot'],
        },
        knot: {
          clip: [[600, 424], [642, 398], [702, 362], [784, 370], [788, 542], [720, 502], [662, 482], [626, 470]],
          pivot: [616, 440],
        },
        torso: { pivot: [420, 800] },
      },
      tree: ['tail', 'backLeg', 'frontLeg', { n: 'torso', c: ['base', 'arms', { n: 'head', c: ['knot'] }] }],
      muzzle: { chain: ['torso', 'arms'], pt: [18, 515] },
      shell: { chain: ['torso'], pt: [585, 700] },
      pose(state, phase, t, act) {
        const rc = (act || 0) * (act || 0), P: Record<string, any> = {}
        if (state === 'rest') return P
        const s = Math.sin(phase), c = Math.cos(phase)
        if (state === 'walk') {
          P.frontLeg = { rot: 11 * s, ty: -Math.max(0, c) * 26 }
          P.backLeg = { rot: -11 * s, ty: -Math.max(0, -c) * 26 }
          P.torso = { ty: -Math.abs(c) * 22 + 6, rot: -2.5 + s * 1.6 }
          P.head = { rot: -Math.cos(2 * phase) * 2.2, ty: Math.abs(c) * 4 }
          P.arms = { rot: Math.sin(2 * phase) * 1.8, ty: Math.abs(c) * 6 }
          P.tail = { rot: Math.sin(phase + 1.2) * 9 }
          P.knot = { rot: Math.sin(t * 9) * 7 - 4 }
        } else {
          const br = Math.sin(t * 3)
          P.torso = { sy: 1 + br * 0.015, sx: 1 - br * 0.006, rot: Math.sin(t * 1.3) * 0.6 }
          P.head = { rot: Math.sin(t * 1.7) * 1.4, ty: -br * 3 }
          P.arms = { rot: Math.sin(t * 2.1) * 0.8, ty: -br * 4 }
          P.tail = { rot: Math.sin(t * 2.2) * 6 }
          P.knot = { rot: Math.sin(t * 6) * 5 - 3 }
        }
        P.arms = P.arms || {}
        P.arms.tx = (P.arms.tx || 0) + rc * 28
        P.arms.ty = (P.arms.ty || 0) + rc * 12
        P.arms.rot = (P.arms.rot || 0) + rc * 2.5
        P.torso = P.torso || {}
        P.torso.rot = (P.torso.rot || 0) + rc * 3
        P.torso.tx = (P.torso.tx || 0) + rc * 14
        P.head = P.head || {}
        P.head.rot = (P.head.rot || 0) + rc * 4
        P.knot = P.knot || {}
        P.knot.rot = (P.knot.rot || 0) - rc * 12
        P.tail = P.tail || {}
        P.tail.rot = (P.tail.rot || 0) + rc * 6
        return P
      },
    },

    garritas: {
      key: 'garritas',
      name: 'Garritas',
      src: '/images/mapaches/garritas.webp',
      desc: 'Rasguñador cuerpo a cuerpo. Avanza agazapado más rápido, se pega a la planta y la ataca con zarpazos.',
      kind: 'melee',
      speed: [22, 26],
      stopPx: 72,
      rangePx: 72,
      hp: 12,
      holdLabel: 'zarpazos',
      moveAtkLabel: 'avanzando',
      jumpsWalls: true,
      jumpDur: 1.15,
      holdBtn: 'Quieto rasguñando',
      wsBtn: 'Caminar + rasguñar',
      atk: { dur: 0.55, cd: 1.0, hit: 0.47, fx: 'slash' },
      parts: {
        tail: {
          clip: [[556, 560], [600, 510], [680, 488], [762, 498], [788, 540], [782, 640], [762, 742], [720, 802], [640, 824], [574, 812], [544, 762], [560, 700]],
          erase: [[646, 668], [650, 590], [624, 526], [680, 488], [762, 498], [788, 540], [782, 640], [762, 742], [720, 802], [640, 824], [580, 814], [568, 790], [572, 720]],
          pivot: [600, 760],
          exclude: ['backArm'],
        },
        backLeg: {
          clip: [[420, 790], [540, 780], [600, 800], [612, 840], [652, 880], [702, 918], [710, 976], [572, 980], [566, 930], [538, 894], [428, 894], [408, 840]],
          erase: [[425, 816], [566, 812], [606, 836], [652, 880], [702, 918], [710, 976], [572, 980], [566, 930], [538, 894], [428, 894]],
          pivot: [490, 810],
        },
        frontLeg: {
          clip: [[285, 790], [372, 788], [378, 840], [352, 910], [256, 910], [256, 860]],
          erase: [[285, 812], [372, 812], [378, 840], [352, 910], [256, 910], [256, 860]],
          pivot: [330, 805],
        },
        backArm: {
          clip: [[470, 525], [515, 505], [560, 515], [612, 550], [640, 590], [646, 652], [618, 666], [590, 648], [560, 646], [538, 624], [528, 594], [480, 580]],
          erase: [[515, 512], [560, 515], [612, 550], [640, 590], [646, 652], [618, 666], [590, 648], [560, 646], [538, 624], [528, 594], [512, 560]],
          pivot: [505, 548],
        },
        scarf: {
          clip: [[470, 470], [500, 440], [560, 410], [625, 383], [690, 372], [750, 428], [700, 420], [662, 442], [602, 470], [545, 498], [495, 520]],
          pivot: [485, 495],
        },
        frontArm: {
          clip: [[192, 668], [250, 660], [318, 690], [312, 760], [290, 805], [282, 850], [268, 882], [274, 940], [254, 980], [54, 980], [52, 912], [92, 876], [142, 858], [146, 800], [188, 768]],
          erase: [[194, 712], [316, 728], [300, 780], [290, 805], [282, 850], [268, 882], [274, 940], [254, 980], [54, 980], [52, 912], [92, 876], [142, 858], [146, 800], [188, 768]],
          pivot: [262, 690],
          backfill: { color: '#3a2924', pts: [[194, 712], [316, 728], [300, 780], [290, 812], [282, 850], [200, 856], [150, 822], [188, 768]] },
        },
        head: {
          clip: [[42, 470], [58, 400], [88, 330], [82, 250], [110, 228], [160, 238], [230, 202], [330, 206], [380, 212], [430, 146], [482, 138], [518, 200], [518, 280], [548, 340], [560, 400], [532, 442], [482, 470], [472, 520], [420, 562], [360, 577], [300, 582], [240, 572], [200, 562], [170, 547], [110, 532], [68, 512]],
          pivot: [330, 560],
        },
        torso: { pivot: [400, 800] },
      },
      tree: ['tail', 'backLeg', 'frontLeg', { n: 'torso', c: ['backArm', 'scarf', 'fill:frontArm', 'frontArm', 'base', 'head'] }],
      claw: { chain: ['torso', 'frontArm'], pt: [120, 930] },
      jumpPose(j, t) {
        const ease = (x: number) => x * x * (3 - 2 * x), P: Record<string, any> = {}
        let ry = 0, rr = 0
        if (j < 0.22) {
          const k = ease(j / 0.22)
          P.torso = { ty: 46 * k, sy: 1 - 0.1 * k, sx: 1 + 0.05 * k, rot: 4 * k }
          P.head = { rot: 4 * k, ty: 10 * k }
          P.frontArm = { rot: -22 * k }
          P.backArm = { rot: -10 * k }
          P.tail = { rot: 14 * k }
          P.scarf = { rot: -3 }
        } else if (j < 0.8) {
          const k = (j - 0.22) / 0.58, st = Math.max(0, 1 - k * 3)
          ry = -Math.sin(Math.PI * k) * 620
          rr = -14 + 26 * k
          P.torso = { sy: 1 + 0.08 * st, sx: 1 - 0.04 * st, ty: -10 }
          P.frontLeg = { rot: 30 * Math.sin(Math.PI * Math.min(1, k * 1.3)), ty: -40 }
          P.backLeg = { rot: -30, ty: -30 * Math.sin(Math.PI * k) }
          P.frontArm = { rot: 30 + 12 * Math.sin(Math.PI * k) }
          P.backArm = { rot: -25 }
          P.head = { rot: -5 + 9 * k }
          P.tail = { rot: -20 + 32 * k }
          P.scarf = { rot: -16 + Math.sin(t * 16) * 8 }
        } else {
          const q = 1 - ease((j - 0.8) / 0.2)
          P.torso = { ty: 48 * q, sy: 1 - 0.12 * q, sx: 1 + 0.06 * q }
          P.head = { rot: -3 * q, ty: 12 * q }
          P.frontArm = { rot: 10 * q }
          P.backArm = { rot: 8 * q }
          P.tail = { rot: -10 * q }
          P.scarf = { rot: -4 }
        }
        P._root = { ty: ry, rot: rr }
        return P
      },
      pose(state, phase, t, act) {
        const P: Record<string, any> = {}
        if (state === 'rest') return P
        if (state === 'jump') return this.jumpPose ? this.jumpPose(act ?? 0, t) : P
        const s = Math.sin(phase), c = Math.cos(phase)
        if (state === 'walk') {
          P.frontLeg = { rot: 12 * s, ty: -Math.max(0, c) * 22 }
          P.backLeg = { rot: -12 * s, ty: -Math.max(0, -c) * 22 }
          P.torso = { ty: -Math.abs(c) * 16 + 8, rot: -3 + s * 2 }
          P.frontArm = { rot: -s * 12, ty: -Math.max(0, -c) * 10 }
          P.backArm = { rot: s * 5 }
          P.head = { rot: -Math.cos(2 * phase) * 2, ty: Math.abs(c) * 5 }
          P.tail = { rot: Math.sin(phase + 1.2) * 11 }
          P.scarf = { rot: Math.sin(t * 10) * 6 - 3 }
        } else {
          const br = Math.sin(t * 3.4)
          P.torso = { sy: 1 + br * 0.018, sx: 1 - br * 0.007, ty: 6, rot: -1.5 }
          P.head = { rot: Math.sin(t * 1.9) * 1.6, ty: -br * 3 }
          P.frontArm = { rot: Math.sin(t * 2.6) * 3 }
          P.backArm = { rot: Math.sin(t * 3.1) * 6 }
          P.tail = { rot: Math.sin(t * 2.4) * 8 }
          P.scarf = { rot: Math.sin(t * 7) * 5 - 2 }
        }
        if (act != null) {
          const ease = (x: number) => x * x * (3 - 2 * x)
          let arm: number, tx: number, rot: number, head: number, back: number
          if (act < 0.4) {
            const k = ease(act / 0.4)
            arm = -22 * k; tx = 10 * k; rot = 3 * k; head = 2 * k; back = -6 * k
          } else if (act < 0.55) {
            const k = (act - 0.4) / 0.15
            arm = -22 + 58 * k; tx = 10 - 34 * k; rot = 3 - 7 * k; head = 2 - 5 * k; back = -6 + 14 * k
          } else {
            const k = 1 - ease((act - 0.55) / 0.45)
            arm = 36 * k; tx = -24 * k; rot = -4 * k; head = -3 * k; back = 8 * k
          }
          P.frontArm = P.frontArm || {}
          P.frontArm.rot = (P.frontArm.rot || 0) + arm
          P.torso = P.torso || {}
          P.torso.tx = (P.torso.tx || 0) + tx
          P.torso.rot = (P.torso.rot || 0) + rot
          P.head = P.head || {}
          P.head.rot = (P.head.rot || 0) + head
          P.backArm = P.backArm || {}
          P.backArm.rot = (P.backArm.rot || 0) + back
          P.tail = P.tail || {}
          P.tail.rot = (P.tail.rot || 0) - arm * 0.2
          P.frontLeg = P.frontLeg || {}
          P.backLeg = P.backLeg || {}
          P.frontLeg.tx = (P.frontLeg.tx || 0) + tx * 0.8
          P.backLeg.tx = (P.backLeg.tx || 0) + tx * 0.4
        }
        return P
      },
    },

    punos: {
      key: 'punos',
      name: 'Puños',
      src: '/images/mapaches/punos.webp',
      desc: 'Peleador cuerpo a cuerpo. Avanza pesado y golpea todo. Cada 5 golpes entra en FURIA: 4 golpes al doble de velocidad.',
      kind: 'melee',
      speed: [13, 16],
      stopPx: 70,
      rangePx: 70,
      hp: 18,
      holdLabel: 'a puñetazos',
      moveAtkLabel: 'avanzando',
      holdBtn: 'Quieto golpeando',
      wsBtn: 'Caminar + golpear',
      atk: { dur: 0.45, cd: 0.8, hit: 0.42, fx: 'punch', fury: { every: 5, count: 4, mult: 2 } },
      fists: [{ chain: ['torso', 'frontArm'], pt: [45, 545] }, { chain: ['torso', 'backArm'], pt: [450, 650] }],
      headTop: { chain: ['torso', 'head'], pt: [330, 190] },
      parts: {
        tail: {
          clip: [[585, 560], [640, 510], [720, 494], [782, 520], [798, 600], [787, 702], [752, 772], [690, 794], [620, 788], [574, 742], [590, 700], [600, 640]],
          erase: [[614, 700], [612, 560], [640, 508], [720, 494], [782, 520], [798, 600], [787, 702], [752, 772], [690, 794], [620, 788], [586, 762], [580, 732]],
          pivot: [610, 700],
          exclude: ['backArm'],
        },
        backLeg: {
          clip: [[420, 740], [560, 724], [622, 760], [612, 830], [642, 850], [682, 900], [682, 952], [513, 952], [510, 880], [470, 862], [420, 822]],
          erase: [[425, 780], [602, 775], [614, 830], [642, 850], [682, 900], [682, 952], [513, 952], [510, 880], [470, 862], [425, 830]],
          pivot: [505, 770],
        },
        frontLeg: {
          clip: [[150, 740], [230, 718], [332, 728], [352, 790], [322, 850], [297, 880], [292, 948], [118, 948], [123, 890], [163, 850], [148, 800]],
          erase: [[150, 776], [332, 770], [352, 800], [322, 850], [297, 880], [292, 948], [118, 948], [123, 890], [163, 850], [148, 800]],
          pivot: [290, 770],
        },
        scarf: {
          clip: [[490, 352], [520, 320], [560, 270], [640, 244], [707, 262], [748, 345], [732, 372], [697, 412], [640, 382], [590, 372], [540, 372], [500, 382]],
          pivot: [512, 352],
        },
        frontArm: {
          clip: [[28, 500], [80, 438], [150, 458], [200, 478], [240, 498], [278, 520], [282, 582], [262, 622], [215, 652], [150, 652], [100, 632], [48, 612], [22, 560]],
          pivot: [262, 525],
          backfill: { color: '#2f2626', pts: [[205, 500], [240, 490], [285, 515], [290, 600], [262, 632], [215, 656], [200, 600]] },
        },
        backArm: {
          clip: [[480, 500], [540, 490], [602, 500], [617, 560], [614, 652], [592, 702], [540, 724], [470, 717], [418, 682], [403, 630], [418, 580], [470, 560]],
          pivot: [548, 482],
          backfill: [
            { color: '#3b2c27', pts: [[470, 560], [545, 500], [560, 505], [560, 705], [540, 722], [470, 716], [420, 682], [405, 630], [420, 585]] },
            { color: '#a0959d', pts: [[556, 505], [605, 505], [614, 650], [592, 704], [556, 704]] },
            { color: '#5b3a23', pts: [[405, 668], [600, 690], [598, 726], [405, 712]] },
            { color: '#b9aeb4', pts: [[500, 505], [560, 498], [604, 508], [612, 560], [560, 545], [505, 540]] },
          ],
        },
        head: {
          clip: [[163, 330], [168, 250], [213, 168], [260, 172], [320, 178], [390, 132], [452, 148], [482, 230], [497, 300], [502, 332], [482, 362], [442, 402], [392, 432], [342, 462], [292, 477], [245, 472], [218, 432], [173, 417], [163, 380]],
          pivot: [330, 470],
        },
        torso: { pivot: [400, 780] },
      },
      tree: ['tail', 'backLeg', 'frontLeg', { n: 'torso', c: ['scarf', 'fill:frontArm', 'fill:backArm', 'base', 'backArm', 'frontArm', 'head'] }],
      pose(state, phase, t, act, o = {}) {
        const P: Record<string, any> = {}
        if (state === 'rest') return P
        const s = Math.sin(phase), c = Math.cos(phase), fury = o.fury > 0
        if (state === 'walk') {
          P.frontLeg = { rot: 9 * s, ty: -Math.max(0, c) * 24 }
          P.backLeg = { rot: -9 * s, ty: -Math.max(0, -c) * 24 }
          P.torso = { ty: -Math.abs(c) * 18 + 6, rot: -2 + s * 2 }
          P.frontArm = { rot: -s * 5, ty: Math.abs(c) * 8 }
          P.backArm = { rot: s * 6, ty: Math.abs(c) * 6 }
          P.head = { rot: -Math.cos(2 * phase) * 2, ty: Math.abs(c) * 5 }
          P.tail = { rot: Math.sin(phase + 1.2) * 8 }
          P.scarf = { rot: Math.sin(t * 9) * 7 - 4 }
        } else {
          const sp = fury ? 13 : 7, b = Math.sin(t * sp)
          P.torso = { ty: Math.abs(b) * 14, sy: 1 - Math.abs(b) * 0.02, rot: -1 }
          P.frontArm = { ty: Math.abs(b) * 6, rot: Math.sin(t * sp * 0.5) * 3 }
          P.backArm = { ty: Math.abs(b) * 5, rot: -Math.sin(t * sp * 0.5) * 4 }
          P.head = { rot: fury ? Math.sin(t * 40) * 2.5 : Math.sin(t * 2) * 1.5, ty: Math.abs(b) * 4 }
          P.tail = { rot: Math.sin(t * 3) * 7 }
          P.scarf = { rot: Math.sin(t * (fury ? 14 : 7)) * 7 - 3 }
        }
        P.frontLeg = P.frontLeg || {}
        P.backLeg = P.backLeg || {}
        if (act != null) {
          const ease = (x: number) => x * x * (3 - 2 * x)
          const w = act < 0.35 ? -ease(act / 0.35) : act < 0.5 ? -1 + 2 * ((act - 0.35) / 0.15) : 1 - ease((act - 0.5) / 0.5)
          const pos = Math.max(0, w), neg = Math.max(0, -w)
          P.frontArm = P.frontArm || {}
          P.backArm = P.backArm || {}
          if (!o.hand) {
            P.frontArm.tx = 20 * neg - 20 * pos
            P.frontArm.rot = (P.frontArm.rot || 0) - 5 * neg + 4 * pos
            P.frontArm.ty = (P.frontArm.ty || 0) - 6 * pos
            P.frontArm.sx = 1 + 0.32 * pos
            P.frontArm.sy = 1 - 0.05 * pos
            P.backArm.tx = 20 * pos
          } else {
            P.backArm.rot = (P.backArm.rot || 0) - 10 * neg + 28 * pos
            P.backArm.tx = 10 * neg - 60 * pos
            P.backArm.ty = (P.backArm.ty || 0) - 35 * pos
            P.backArm.sx = 1 + 0.1 * pos
            P.frontArm.tx = 25 * pos
            P.frontArm.rot = (P.frontArm.rot || 0) - 6 * pos
          }
          P.torso = P.torso || {}
          P.torso.tx = 14 * neg - 30 * pos
          P.torso.rot = (P.torso.rot || 0) + 4 * neg - 6 * pos
          P.head = P.head || {}
          P.head.rot = (P.head.rot || 0) + 2 * neg - 4 * pos
          P.tail = P.tail || {}
          P.tail.rot = (P.tail.rot || 0) + 6 * pos
          P.frontLeg.tx = -12 * pos
          P.backLeg.tx = -6 * pos
        }
        return P
      },
    },

    navajas: {
      key: 'navajas',
      name: 'Navajas',
      src: '/images/mapaches/navajas.webp',
      desc: 'Lanzador de cuchillos. Avanza ágil, se planta a 3,5 casillas y lanza cuchillos que vuelan en línea recta.',
      kind: 'thrower',
      speed: [20, 24],
      stopPx: 350,
      rangePx: 350,
      hp: 13,
      holdLabel: 'lanzando',
      moveAtkLabel: 'avanzando',
      holdBtn: 'Quieto lanzando',
      wsBtn: 'Caminar + lanzar',
      flip: true,
      srcW: 1152,
      srcH: 768,
      crop: { x: 150, y: -60, w: 860, h: 800 },
      atk: { dur: 0.75, cd: 1.5, hit: 0.47, fx: 'knife' },
      knifeTip: { chain: ['torso', 'throwArm'], pt: [262, 316] },
      knifeBox: [210, 284, 326, 346],
      parts: {
        tail: {
          clip: [[700, 420], [760, 380], [850, 368], [930, 398], [962, 460], [957, 542], [912, 602], [840, 620], [770, 602], [720, 562], [700, 500]],
          erase: [[796, 380], [850, 368], [930, 398], [962, 460], [957, 542], [912, 602], [840, 620], [792, 612], [772, 562], [772, 482], [796, 472]],
          pivot: [770, 520],
        },
        backLeg: {
          clip: [[620, 560], [700, 528], [772, 558], [792, 608], [832, 608], [872, 660], [874, 727], [728, 727], [724, 682], [700, 642], [640, 622]],
          erase: [[640, 592], [760, 586], [792, 608], [832, 608], [872, 660], [874, 727], [728, 727], [724, 682], [700, 642], [650, 626]],
          pivot: [690, 565],
        },
        frontLeg: {
          clip: [[410, 560], [470, 538], [542, 558], [532, 620], [512, 650], [517, 727], [333, 727], [338, 670], [393, 640], [403, 600]],
          erase: [[410, 586], [532, 586], [532, 620], [512, 650], [517, 727], [333, 727], [338, 670], [393, 640], [403, 600]],
          pivot: [475, 565],
        },
        scarf: {
          clip: [[728, 282], [760, 240], [820, 213], [892, 213], [928, 250], [902, 290], [934, 357], [880, 352], [830, 332], [780, 322], [744, 316]],
          pivot: [742, 292],
        },
        backArm: {
          clip: [[584, 312], [598, 290], [642, 282], [664, 326], [700, 298], [752, 308], [792, 370], [792, 462], [742, 477], [670, 487], [638, 472], [618, 442], [598, 402]],
          pivot: [722, 334],
          backfill: { color: '#3a2a24', pts: [[640, 330], [700, 305], [750, 315], [785, 380], [780, 455], [700, 470], [650, 450], [630, 400]] },
        },
        throwArm: {
          clip: [[208, 312], [300, 286], [362, 298], [402, 313], [452, 318], [497, 338], [502, 397], [462, 412], [410, 402], [370, 402], [328, 397], [314, 352], [240, 342]],
          pivot: [478, 358],
          exclude: ['knife'],
          backfill: { color: '#3a2a24', pts: [[440, 325], [497, 338], [502, 397], [462, 412], [440, 380]] },
        },
        knife: {
          clip: [[208, 312], [300, 286], [324, 300], [324, 336], [300, 344], [240, 342]],
          pivot: [330, 320],
        },
        head: {
          clip: [[403, 190], [418, 128], [468, 68], [500, 33], [542, 38], [582, 73], [640, 43], [702, 38], [732, 88], [737, 170], [737, 220], [762, 250], [746, 286], [700, 296], [665, 282], [640, 279], [612, 289], [585, 298], [546, 337], [500, 333], [460, 302], [423, 287], [413, 250]],
          pivot: [560, 320],
        },
        torso: { pivot: [580, 560] },
      },
      tree: ['tail', 'backLeg', 'frontLeg', { n: 'torso', c: ['scarf', 'fill:throwArm', 'fill:backArm', 'base', 'backArm', 'head', { n: 'throwArm', c: ['knife'] }] }],
      pose(state, phase, t, act) {
        const P: Record<string, any> = {}
        if (state === 'rest') return P
        const s = Math.sin(phase), c = Math.cos(phase)
        if (state === 'walk') {
          P.frontLeg = { rot: 12 * s, ty: -Math.max(0, c) * 26 }
          P.backLeg = { rot: -12 * s, ty: -Math.max(0, -c) * 26 }
          P.torso = { ty: -Math.abs(c) * 18 + 6, rot: -3 + s * 2 }
          P.throwArm = { rot: s * 5, ty: Math.abs(c) * 6 }
          P.backArm = { rot: -s * 6 }
          P.head = { rot: -Math.cos(2 * phase) * 2, ty: Math.abs(c) * 4 }
          P.tail = { rot: Math.sin(phase + 1.2) * 10 }
          P.scarf = { rot: Math.sin(t * 10) * 7 + 3 }
        } else {
          const br = Math.sin(t * 3)
          P.torso = { sy: 1 + br * 0.015, sx: 1 - br * 0.006, rot: Math.sin(t * 1.4) * 0.6 }
          P.throwArm = { rot: Math.sin(t * 2.2) * 1.5, ty: -br * 4 }
          P.backArm = { rot: Math.sin(t * 2.7) * 3 }
          P.head = { rot: Math.sin(t * 1.8) * 1.4, ty: -br * 3 }
          P.tail = { rot: Math.sin(t * 2.3) * 7 }
          P.scarf = { rot: Math.sin(t * 7) * 6 + 2 }
        }
        P.knife = {}
        if (act != null) {
          const ease = (x: number) => x * x * (3 - 2 * x)
          let arm: number, atx: number, tor: number, ttx: number, head: number
          if (act < 0.4) {
            const k = ease(act / 0.4)
            arm = 70 * k; atx = 30 * k; tor = 6 * k; ttx = 20 * k; head = 3 * k
          } else if (act < 0.52) {
            const k = (act - 0.4) / 0.12
            arm = 70 - 82 * k; atx = 30 - 60 * k; tor = 6 - 13 * k; ttx = 20 - 50 * k; head = 3 - 7 * k
          } else {
            const k = 1 - ease((act - 0.52) / 0.48)
            arm = -12 * k; atx = -30 * k; tor = -7 * k; ttx = -30 * k; head = -4 * k
          }
          P.throwArm = P.throwArm || {}
          P.throwArm.rot = (P.throwArm.rot || 0) + arm
          P.throwArm.tx = (P.throwArm.tx || 0) + atx
          P.torso = P.torso || {}
          P.torso.rot = (P.torso.rot || 0) + tor
          P.torso.tx = (P.torso.tx || 0) + ttx
          P.head = P.head || {}
          P.head.rot = (P.head.rot || 0) + head
          P.backArm = P.backArm || {}
          P.backArm.rot = (P.backArm.rot || 0) - arm * 0.15
          P.tail = P.tail || {}
          P.tail.rot = (P.tail.rot || 0) - tor * 1.5
          P.frontLeg = { tx: Math.min(0, ttx) * 0.5 }
          P.backLeg = { tx: Math.min(0, ttx) * 0.25 }
          if (act >= 0.47 && act < 0.85) {
            P.knife = { o: 0 }
          } else if (act >= 0.85) {
            const k = (act - 0.85) / 0.15
            P.knife = { o: k, sx: 0.5 + 0.5 * k, sy: 0.5 + 0.5 * k }
          }
        }
        return P
      },
    },

    reygarra: {
      key: 'reygarra',
      name: 'Rey Garra',
      src: '/images/mapaches/reygarra.webp',
      desc: 'Jefe Supremo. Patrulla los carriles, ruge para enfurecer a los mapaches cercanos (+velocidad y doble daño) e invoca Garritas continuamente.',
      kind: 'boss',
      boss: true,
      scale: 1.5,
      maxHp: 65,
      hp: 65,
      speed: [34, 34],
      vSpeed: 55,
      patrolX: 770,
      minRow: 1,
      stopPx: 0,
      rangePx: 0,
      holdBtn: 'Rugido',
      wsBtn: 'Invocar Garritas',
      holdLabel: 'Rey Garra',
      moveAtkLabel: 'Rey Garra',
      srcW: 1536,
      srcH: 1024,
      crop: { x: 100, y: -40, w: 1240, h: 1080 },
      headTop: { chain: ['torso', 'head'], pt: [640, 150] },
      fist: { chain: ['torso', 'fistArm'], pt: [1000, 580] },
      parts: {
        tail: {
          clip: [[985, 480], [1060, 423], [1180, 418], [1272, 468], [1304, 580], [1292, 700], [1252, 800], [1180, 862], [1100, 862], [1030, 800], [990, 700], [985, 600]],
          erase: [[1072, 560], [1070, 470], [1180, 418], [1272, 468], [1304, 580], [1292, 700], [1252, 790], [1160, 780], [1100, 720], [1075, 650]],
          pivot: [1040, 700],
        },
        capeR: {
          clip: [[958, 688], [1012, 698], [1082, 758], [1152, 818], [1204, 880], [1182, 922], [1110, 932], [1040, 912], [1000, 882], [958, 822]],
          erase: [[1002, 700], [1082, 758], [1152, 818], [1204, 880], [1182, 922], [1110, 932], [1040, 912], [1012, 880], [1012, 760]],
          pivot: [960, 700],
        },
        backLeg: {
          clip: [[858, 860], [920, 818], [1002, 828], [1012, 900], [1082, 958], [1088, 1012], [858, 1012], [848, 940]],
          erase: [[858, 880], [1002, 870], [1012, 900], [1082, 958], [1088, 1012], [858, 1012], [848, 940]],
          pivot: [910, 845],
        },
        frontLeg: {
          clip: [[328, 900], [390, 858], [472, 838], [522, 858], [517, 940], [507, 1012], [318, 1012], [313, 960]],
          erase: [[328, 920], [420, 905], [500, 880], [517, 940], [507, 1012], [318, 1012], [313, 960]],
          pivot: [455, 860],
        },
        capeL: {
          clip: [[328, 600], [450, 578], [562, 558], [642, 618], [602, 700], [522, 780], [442, 870], [412, 922], [328, 882], [258, 862], [198, 822], [168, 782], [198, 728], [268, 678]],
          pivot: [600, 600],
          backfill: { color: '#4a3a48', pts: [[430, 800], [540, 770], [565, 860], [490, 905], [425, 885]] },
        },
        clawArm: {
          clip: [[138, 440], [218, 318], [302, 318], [362, 378], [422, 438], [482, 468], [522, 518], [502, 602], [442, 617], [382, 622], [328, 592], [258, 562], [198, 602], [158, 520]],
          pivot: [472, 560],
        },
        fistArm: {
          clip: [[918, 580], [960, 543], [1022, 548], [1062, 588], [1077, 650], [1062, 702], [1010, 727], [958, 722], [928, 690]],
          pivot: [932, 640],
          backfill: { clone: [175, 0], pts: [[915, 585], [960, 543], [1022, 548], [1062, 588], [1080, 652], [1064, 704], [1010, 730], [958, 724], [926, 692]] },
        },
        crown: {
          clip: [[468, 100], [540, 8], [620, 13], [702, 28], [752, 60], [742, 200], [702, 240], [620, 266], [528, 262], [518, 200], [478, 140]],
          pivot: [630, 250],
          backfill: { color: '#5d4e5c', pts: [[522, 215], [745, 195], [748, 238], [704, 262], [620, 272], [526, 266]] },
        },
        head: {
          clip: [[468, 100], [540, 8], [620, 13], [700, 28], [740, 68], [760, 178], [800, 108], [842, 88], [882, 148], [902, 238], [946, 278], [962, 330], [902, 360], [862, 420], [802, 470], [742, 520], [682, 537], [620, 532], [560, 502], [520, 452], [500, 422], [438, 392], [428, 320], [448, 260], [438, 200], [468, 180]],
          pivot: [650, 520],
          exclude: ['crown'],
        },
        torso: { pivot: [700, 850] },
      },
      tree: ['tail', 'capeR', 'backLeg', 'frontLeg', { n: 'torso', c: ['fill:capeL', 'fill:fistArm', 'base', 'capeL', 'fistArm', { n: 'head', c: ['fill:crown', 'crown'] }, 'clawArm'] }],
      pose(state, phase, t, act, o = {}) {
        const P: Record<string, any> = {}
        if (state === 'rest') return P
        const s = Math.sin(phase), c = Math.cos(phase), ease = (x: number) => x * x * (3 - 2 * x)
        if (state === 'walk') {
          P.frontLeg = { rot: 7 * s, ty: -Math.max(0, c) * 22 }
          P.backLeg = { rot: -7 * s, ty: -Math.max(0, -c) * 22 }
          P.torso = { ty: -Math.abs(c) * 16 + 6, rot: -1.5 + s * 2.5 }
          P.capeL = { rot: Math.sin(phase - 0.6) * 5 }
          P.capeR = { rot: -Math.sin(phase - 0.6) * 5 }
          P.clawArm = { rot: s * 4, ty: Math.abs(c) * 6 }
          P.fistArm = { rot: -s * 5, ty: Math.abs(c) * 5 }
          P.head = { rot: -Math.cos(2 * phase) * 1.8, ty: Math.abs(c) * 5 }
          P.crown = { rot: Math.sin(phase * 2 - 0.8) * 3 }
          P.tail = { rot: Math.sin(phase + 1.2) * 8 }
        } else {
          const br = Math.sin(t * 2.6)
          P.torso = { sy: 1 + br * 0.018, sx: 1 - br * 0.007 }
          P.capeL = { rot: Math.sin(t * 1.8) * 2.5 }
          P.capeR = { rot: -Math.sin(t * 1.8 + 1) * 2.5 }
          P.clawArm = { rot: Math.sin(t * 2) * 2.5, ty: -br * 4 }
          P.fistArm = { rot: -Math.sin(t * 2.3) * 2.5, ty: -br * 3 }
          P.head = { rot: Math.sin(t * 1.5) * 1.5, ty: -br * 4 }
          P.crown = { rot: Math.sin(t * 1.5 - 0.5) * 1.5 }
          P.tail = { rot: Math.sin(t * 2) * 6 }
        }
        P.frontLeg = P.frontLeg || {}
        P.backLeg = P.backLeg || {}
        const add = (n: string, k: string, v: number) => {
          P[n] = P[n] || {}
          P[n][k] = (P[n][k] || (k[0] === 's' ? 1 : 0)) + v
        }
        if (act != null && o.action === 'roar') {
          if (act < 0.3) {
            const k = ease(act / 0.3)
            add('torso', 'rot', 5 * k)
            add('torso', 'ty', 20 * k)
            add('head', 'rot', 6 * k)
            add('clawArm', 'rot', -10 * k)
            add('fistArm', 'rot', 10 * k)
          } else {
            const q = act < 0.85 ? Math.min(1, (act - 0.3) / 0.08) : 1 - ease((act - 0.85) / 0.15)
            const sh = act < 0.85 ? Math.sin(t * 60) * 1.5 : 0
            add('torso', 'rot', -4 * q)
            add('torso', 'sx', 0.05 * q)
            add('torso', 'ty', -10 * q)
            add('head', 'rot', -5 * q + sh)
            add('crown', 'ty', -35 * q)
            add('crown', 'rot', -8 * q)
            add('clawArm', 'rot', 28 * q)
            add('fistArm', 'rot', -28 * q)
            add('fistArm', 'ty', -30 * q)
            add('capeL', 'rot', 8 * q)
            add('capeR', 'rot', -9 * q)
            add('tail', 'rot', 10 * q)
          }
        }
        if (act != null && o.action === 'summon') {
          const q = act < 0.4 ? ease(act / 0.4) : act < 0.7 ? 1 : 1 - ease((act - 0.7) / 0.3)
          const sh = act >= 0.4 && act < 0.7 ? Math.sin(t * 50) * 2 : 0
          add('fistArm', 'rot', -45 * q + sh)
          add('fistArm', 'ty', -45 * q)
          add('fistArm', 'sx', 0.15 * q)
          add('fistArm', 'sy', 0.15 * q)
          add('torso', 'rot', 3 * q)
          add('head', 'rot', -5 * q)
          add('crown', 'rot', -3 * q)
          add('capeR', 'rot', -8 * q)
          add('clawArm', 'rot', -6 * q)
        }
        return P
      },
    },
  }
}
