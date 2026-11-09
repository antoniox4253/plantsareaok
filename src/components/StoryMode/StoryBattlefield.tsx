import { useState, useEffect, useRef, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  type MapacheKey,
  type MapacheCharDef,
} from '../../utils/mapaches/mapachesData'
import {
  ensureMapacheTextures,
  createRig,
  applyPose,
  mapPoint,
  type MapacheRigInstance,
} from '../../utils/mapaches/mapachesRig'
import {
  getStoryLevelConfig,
  saveStoryProgress,
  type StoryLevelConfig,
} from '../../utils/mapaches/mapachesLevels'
import {
  spawnFx,
  spawnSlashFx,
  spawnRoarFx,
  spawnFuryFx,
  spawnSummonFx,
  type ActiveFx,
} from '../../utils/mapaches/mapachesFx'
import type { PlantId, PlantCardInstance } from '../../types/game'
import { PLANT_CONFIGS, getScaledPlantConfig } from '../../utils/gameConstants'
import './StoryBattlefield.css'

interface StoryBattlefieldProps {
  level: number
  activeDeck?: PlantId[]
  plantInstances?: PlantCardInstance[]
  onVictory?: (level: number, rewards: { gold: number; gems: number; tokens: number }) => void
  onExit: () => void
  onNextLevel?: (nextLvl: number) => void
}

interface PlacedPlant {
  id: string
  row: number
  col: number
  x: number
  y: number
  plantId: PlantId
  hp: number
  maxHp: number
  isWall: boolean
  isProducer: boolean
  lastActionTime: number
  attackCooldown: number
  shake: number
  flash: number
  dead?: boolean
}

interface ActiveRaccoon {
  id: string
  key: MapacheKey
  ch: MapacheCharDef
  row: number
  h: number
  hp: number
  maxHp: number
  speed: number
  x: number
  y: number
  el: HTMLDivElement
  rig: MapacheRigInstance
  shadow: HTMLDivElement
  bar: HTMLDivElement
  tag: HTMLDivElement
  state: string
  t: number
  phase: number
  cooldown: number
  recoil: number
  atk: number | null
  mult?: number
  hand?: number
  hits?: number
  fury?: number
  buff: number
  jump?: { j: number; x0: number; x1: number; landed: boolean } | null
  action?: 'roar' | 'summon' | null
  boss?: {
    mode: 'enter' | 'patrol'
    targetRow: number
    pause: number
    roarT: number
    summonT: number
  }
  dying?: boolean
  gone?: boolean
}

interface SunDrop {
  id: string
  x: number
  y: number
  targetY: number
  collected: boolean
}

const TILE_W = 100
const TILE_H = 100
const COLS = 9
const ROWS = 5
const STAGE_W = 900
const STAGE_H = 500
const RAC_H = 145

export default function StoryBattlefield({
  level,
  activeDeck = ['sunflower', 'peashooter', 'wallnut', 'repeater', 'bonkchoy', 'chomper'],
  plantInstances = [],
  onVictory,
  onExit,
  onNextLevel,
}: StoryBattlefieldProps) {
  const levelConfig: StoryLevelConfig = useMemo(() => getStoryLevelConfig(level), [level])

  // Estados del juego
  const [sunBank, setSunBank] = useState<number>(levelConfig.initialSun)
  const [selectedCard, setSelectedCard] = useState<PlantId | null>(null)
  const [isShovelActive, setIsShovelActive] = useState<boolean>(false)
  const [currentWaveIndex, setCurrentWaveIndex] = useState<number>(0)
  const [waveBanner, setWaveBanner] = useState<string | null>('🧟 ¡OLEADA 1: INCURSIÓN INICIAL!')
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | null>(null)
  const [bossHpData, setBossHpData] = useState<{ current: number; max: number; name: string } | null>(null)
  const [cardCooldowns, setCardCooldowns] = useState<Record<string, number>>({})
  const [lawnmowers, setLawnmowers] = useState<boolean[]>([true, true, true, true, true])
  const [isLoaded, setIsLoaded] = useState<boolean>(false)
  const [speedMul, setSpeedMul] = useState<number>(1)

  // Referencias DOM
  const stageRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const unitsRef = useRef<HTMLDivElement>(null)
  const fxlRef = useRef<HTMLDivElement>(null)
  const sunLayerRef = useRef<HTMLDivElement>(null)

  // Referencias mutables para el ciclo continuo de simulación a 60 fps
  const stateRef = useRef<{
    plants: PlacedPlant[]
    raccoons: ActiveRaccoon[]
    fx: ActiveFx[]
    suns: SunDrop[]
    shake: number
    lastTime: number
    waveStartTime: number
    spawnIndex: number
    sunBankRef: number
    chars: Record<MapacheKey, MapacheCharDef> | null
    activeLawnmowers: boolean[]
    waveNum: number
    waveTransitionTimer: number
    isEnded: boolean
    reqId?: number
  }>({
    plants: [],
    raccoons: [],
    fx: [],
    suns: [],
    shake: 0,
    lastTime: performance.now(),
    waveStartTime: performance.now(),
    spawnIndex: 0,
    sunBankRef: levelConfig.initialSun,
    chars: null,
    activeLawnmowers: [true, true, true, true, true],
    waveNum: 0,
    waveTransitionTimer: 0,
    isEnded: false,
  })

  // Sincronizar referencia de sol
  useEffect(() => {
    stateRef.current.sunBankRef = sunBank
  }, [sunBank])

  // Ajuste responsivo de la escala del tablero
  useEffect(() => {
    const handleResize = () => {
      if (!wrapRef.current || !stageRef.current) return
      const w = wrapRef.current.clientWidth
      const s = Math.min(1, w / STAGE_W)
      stageRef.current.style.transform = `scale(${s})`
      wrapRef.current.style.height = `${STAGE_H * s}px`
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Inicialización de texturas y ciclo de batalla
  useEffect(() => {
    let isCancelled = false

    ensureMapacheTextures()
      .then((templates: Record<MapacheKey, MapacheCharDef>) => {
        if (isCancelled) return
        stateRef.current.chars = templates
        setIsLoaded(true)

        // Banner inicial de oleada
        setTimeout(() => {
          setWaveBanner(null)
        }, 3200)

        // Arrancar ciclo
        stateRef.current.lastTime = performance.now()
        stateRef.current.waveStartTime = performance.now()
        runGameLoop()
      })
      .catch((err: unknown) => {
        console.error('Error cargando recursos de mapaches:', err)
      })

    return () => {
      isCancelled = true
      if (stateRef.current.reqId) {
        cancelAnimationFrame(stateRef.current.reqId)
      }
    }
  }, [level])

  // ── SPAWN DE MAPACHE ────────────────────────────────────────────────────────
  const addRaccoon = (key: MapacheKey, row: number, isSummon: boolean = false): ActiveRaccoon | null => {
    const chars = stateRef.current.chars
    if (!chars || !unitsRef.current) return null
    const ch = chars[key]
    if (!ch) return null

    const safeRow = Math.max(0, Math.min(ROWS - 1, row))
    const h = RAC_H * (ch.scale || 1)
    const rig = createRig(ch, h)

    const el = document.createElement('div')
    el.className = 'unit rac' + (ch.boss ? ' rac--boss' : '')
    el.style.width = `${rig.W}px`
    el.style.height = `${h}px`
    el.style.position = 'absolute'
    el.style.zIndex = String(safeRow * 10 + 5)

    const bar = document.createElement('div')
    bar.className = 'rhp' + (ch.boss ? ' boss' : '')
    bar.innerHTML = '<i style="width:100%"></i>'

    const sh = document.createElement('div')
    sh.className = 'shadow'
    sh.style.width = `${rig.W * 0.8}px`
    sh.style.left = `${rig.W * 0.08}px`
    sh.style.bottom = '6px'

    const tag = document.createElement('div')
    tag.className = 'tag'

    el.append(sh, rig.root, bar, tag)
    unitsRef.current.appendChild(el)

    const baseHp = ch.boss ? levelConfig.bossMaxHp : (ch.hp || 10) * levelConfig.hpMultiplier
    const speedRange = ch.speed[1] - ch.speed[0]
    const speed = ch.speed[0] + Math.random() * (speedRange > 0 ? speedRange : 1)

    const startX = isSummon ? STAGE_W - 20 : STAGE_W + rig.W / 2 + 10
    const startY = safeRow * TILE_H + TILE_H + 4

    const raccoon: ActiveRaccoon = {
      id: `rac_${key}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      key,
      ch,
      row: safeRow,
      h,
      hp: baseHp,
      maxHp: baseHp,
      speed,
      x: startX,
      y: startY,
      el,
      rig,
      shadow: sh,
      bar,
      tag,
      state: 'walk',
      t: Math.random() * 10,
      phase: Math.random() * 6,
      cooldown: 0.8,
      recoil: 0,
      atk: null,
      buff: 0,
    }

    if (ch.boss) {
      setBossHpData({ current: baseHp, max: baseHp, name: ch.name })
    }

    stateRef.current.raccoons.push(raccoon)
    return raccoon
  }

  // ── CICLO PRINCIPAL (REQUEST ANIMATION FRAME) ──────────────────────────────
  const runGameLoop = () => {
    const loop = (now: number) => {
      const state = stateRef.current
      if (state.isEnded) return

      const dt = Math.min(0.05, (now - state.lastTime) / 1000) * speedMul
      state.lastTime = now

      // 1. GESTIÓN DE OLEADAS Y SPAWNS
      const currentWave = levelConfig.waves[state.waveNum]
      if (currentWave) {
        const elapsed = now - state.waveStartTime
        while (
          state.spawnIndex < currentWave.spawns.length &&
          elapsed >= currentWave.spawns[state.spawnIndex].delayMs
        ) {
          const spawn = currentWave.spawns[state.spawnIndex]
          addRaccoon(spawn.key, spawn.lane)
          state.spawnIndex++
        }

        // Si ya salieron todos los de la oleada y no queda ninguno vivo en la oleada actual
        if (
          state.spawnIndex >= currentWave.spawns.length &&
          state.raccoons.filter((r) => !r.dying).length === 0
        ) {
          state.waveTransitionTimer += dt
          if (state.waveTransitionTimer >= 2.5) {
            // Avanzar a la siguiente oleada o victoria
            if (state.waveNum < 2) {
              state.waveNum++
              state.waveStartTime = now
              state.spawnIndex = 0
              state.waveTransitionTimer = 0
              setCurrentWaveIndex(state.waveNum)

              const nextWave = levelConfig.waves[state.waveNum]
              setWaveBanner(
                nextWave.hasBoss
                  ? '👑 ¡OLEADA 3: JEFE FINAL REY GARRA!'
                  : `⚠️ ¡${nextWave.title.toUpperCase()}!`
              )
              soundManager.playSound('click', 0.5)
              setTimeout(() => setWaveBanner(null), 3200)
            } else {
              // VICTORIA COMPLETA DE LAS 3 OLEADAS
              state.isEnded = true
              setGameResult('victory')
              saveStoryProgress(level, 3)
              soundManager.playSound('victory', 0.7)
              onVictory?.(level, levelConfig.rewards)
              return
            }
          }
        }
      }

      // 2. GENERACIÓN NATURAL DE SOL DESDE EL CIELO (CADA 8 SEGUNDOS)
      if (Math.random() < dt * 0.12 && state.suns.length < 5) {
        const col = Math.floor(Math.random() * (COLS - 2)) + 1
        const targetY = 80 + Math.random() * (STAGE_H - 160)
        state.suns.push({
          id: `sun_sky_${Date.now()}_${Math.random()}`,
          x: col * TILE_W + 20,
          y: -40,
          targetY,
          collected: false,
        })
      }

      // 3. ACTUALIZACIÓN DE PLANTAS
      for (const p of state.plants) {
        if (p.dead) continue
        p.shake = Math.max(0, p.shake - dt)
        p.flash = Math.max(0, p.flash - dt)

        // Producción de Sol (Girasol)
        if (p.isProducer) {
          p.lastActionTime += dt * 1000
          if (p.lastActionTime >= p.attackCooldown) {
            p.lastActionTime = 0
            state.suns.push({
              id: `sun_plant_${p.id}_${Date.now()}`,
              x: p.x + 20,
              y: p.y - 30,
              targetY: p.y - 10,
              collected: false,
            })
          }
        }

        // Ataque de Plantas de Rango (Lanzaguisantes, Repetidora, etc.)
        if (!p.isProducer && !p.isWall) {
          p.lastActionTime += dt * 1000
          // Buscar si hay mapaches en la misma fila y por delante de la planta
          const enemiesAhead = state.raccoons.filter(
            (r) => !r.dying && r.row === p.row && r.x > p.x - 20
          )

          if (enemiesAhead.length > 0 && p.lastActionTime >= p.attackCooldown) {
            p.lastActionTime = 0
            // Disparar guisante
            if (fxlRef.current) {
              const isRepeater = p.plantId === 'repeater'
              const cfg = PLANT_CONFIGS[p.plantId]
              const dmg = cfg?.damage || 20

              soundManager.playSound('pea_shoot', 0.25)
              spawnFx(fxlRef.current, 'pea-proj', p.x + 40, p.y - 30, {
                vx: 520,
                life: 3.0,
                isPea: true,
                lane: p.row,
                dmg,
              })

              if (isRepeater) {
                setTimeout(() => {
                  if (fxlRef.current) {
                    spawnFx(fxlRef.current, 'pea-proj', p.x + 40, p.y - 30, {
                      vx: 520,
                      life: 3.0,
                      isPea: true,
                      lane: p.row,
                      dmg,
                    })
                  }
                }, 140)
              }
            }
          }
        }

        // Ataque de Melee (Bonk Choy)
        if (p.plantId === 'bonkchoy') {
          p.lastActionTime += dt * 1000
          const nearEnemy = state.raccoons.find(
            (r) => !r.dying && r.row === p.row && Math.abs(r.x - p.x) <= 85
          )
          if (nearEnemy && p.lastActionTime >= p.attackCooldown) {
            p.lastActionTime = 0
            damageRaccoon(nearEnemy, 30)
            if (fxlRef.current) {
              spawnFx(fxlRef.current, 'boom', nearEnemy.x, nearEnemy.y - 40, {
                life: 0.2,
                s0: 0.3,
                s1: 0.9,
              })
            }
          }
        }
      }

      // 4. ACTUALIZACIÓN DE MAPACHES
      for (const r of state.raccoons) {
        if (r.dying) continue
        const ch = r.ch
        r.t += dt
        r.buff = Math.max(0, r.buff - dt)
        const speedBuff = r.buff > 0 ? 1.6 : 1
        const dmgBuff = r.buff > 0 ? 2 : 1

        // Buscar planta objetivo en la misma fila
        const targetPlant = ch.boss
          ? null
          : state.plants.find(
              (p) => !p.dead && p.row === r.row && p.x < r.x + 10
            )
        const dist = targetPlant ? r.x - targetPlant.x : Infinity
        const inRange = dist <= ch.rangePx

        // Comportamiento de JEFE (Rey Garra)
        if (ch.boss) {
          bossStep(r, dt)
        } else {
          // SALTO DE DEFENSA (Garritas salta troncos/nueces)
          if (
            !r.jump &&
            ch.jumpsWalls &&
            targetPlant &&
            targetPlant.isWall &&
            dist <= 125 &&
            r.atk == null
          ) {
            r.jump = { j: 0, x0: r.x, x1: targetPlant.x - 85, landed: false }
            if (fxlRef.current) {
              for (let i = 0; i < 5; i++) {
                spawnFx(
                  fxlRef.current,
                  'dust',
                  r.x + (Math.random() - 0.5) * 40,
                  r.y - 8,
                  { vx: (Math.random() - 0.5) * 80, vy: -30, life: 0.5, s0: 0.5, s1: 1.6 }
                )
              }
            }
          }

          if (r.jump) {
            const J = r.jump
            J.j = Math.min(1, J.j + dt / (ch.jumpDur || 1.15))
            const air = Math.min(1, Math.max(0, (J.j - 0.22) / 0.58))
            r.x = J.x0 + (J.x1 - J.x0) * air
            if (J.j >= 0.8 && !J.landed) {
              J.landed = true
              state.shake = Math.max(state.shake, 0.1)
              if (fxlRef.current) {
                for (let i = 0; i < 8; i++) {
                  spawnFx(
                    fxlRef.current,
                    'dust',
                    r.x + (Math.random() - 0.5) * 60,
                    r.y - 8,
                    { vx: (Math.random() - 0.5) * 160, vy: -40, life: 0.6, s0: 0.6, s1: 1.8 }
                  )
                }
              }
            }
            r.state = 'jump'
            if (J.j >= 1) r.jump = null
          } else {
            r.state = dist <= ch.stopPx ? 'hold' : 'walk'
            if (r.state === 'walk') {
              r.x -= r.speed * dt * speedBuff
              r.phase += dt * (ch.kind === 'melee' ? 5 : 4.2) * speedBuff
            }
          }

          r.cooldown -= dt * speedBuff

          // ATAQUE DE ARTILLERO (PumPum)
          if (ch.kind === 'ranged') {
            if (inRange && r.cooldown <= 0) {
              r.cooldown = r.state === 'hold' ? 1.3 : 2.1
              r.recoil = 1
              if (fxlRef.current) {
                const [mx, my] = mapPoint(r.rig, ch.muzzle)
                const [sx, sy] = mapPoint(r.rig, ch.shell)
                const ox = r.x - r.rig.W / 2
                const oy = r.y - r.h

                spawnFx(fxlRef.current, 'muzzle', ox + mx - 6, oy + my, { life: 0.12, s0: 0.6, s1: 1.3 })
                spawnFx(fxlRef.current, 'shell', ox + sx, oy + sy, {
                  vx: 60 + Math.random() * 40,
                  vy: -220,
                  g: 900,
                  life: 0.7,
                  vr: 900,
                  o1: 1,
                })

                // Proyectil bola de cañón
                const ball = spawnFx(fxlRef.current, 'ball', ox + mx, oy + my, {
                  vx: -480,
                  vy: -40,
                  g: 120,
                  life: 4,
                  isBall: true,
                  target: targetPlant,
                  lane: r.row,
                  dmg: 25 * dmgBuff * levelConfig.damageMultiplier,
                  trailT: 0,
                })
                state.fx.push(ball)
                state.shake = Math.max(state.shake, 0.12)
              }
            }
            r.recoil = Math.max(0, r.recoil - dt * 5)
          } else {
            // ATAQUE MELEE / LANZADOR (Garritas, Puños, Navajas)
            meleeRaccoonStep(r, dt, r.state === 'hold', (enter) => {
              if (!targetPlant || !fxlRef.current) return
              const ox = r.x - r.rig.W / 2
              const oy = r.y - r.h

              if (ch.atk?.fx === 'knife') {
                const [kx, ky] = mapPoint(r.rig, ch.knifeTip)
                const knife = spawnFx(fxlRef.current, 'knifefly', ox + kx, oy + ky, {
                  vx: -620,
                  life: 4,
                  isKnife: true,
                  target: targetPlant,
                  lane: r.row,
                  dmg: 18 * dmgBuff * levelConfig.damageMultiplier,
                  trailT: 0,
                  trailCls: 'spark',
                })
                if (ch.urls?.knifeSprite) {
                  const im = new Image()
                  im.src = ch.urls.knifeSprite
                  im.style.width = '24px'
                  knife.el.appendChild(im)
                }
                state.fx.push(knife)
                return
              }

              // Golpe melee físico
              hitPlantEntity(targetPlant, 18 * dmgBuff * levelConfig.damageMultiplier)
              state.shake = Math.max(state.shake, (r.fury ?? 0) > 0 ? 0.14 : 0.08)

              if (ch.atk?.fx === 'slash') {
                const [cx, cy] = mapPoint(r.rig, ch.claw)
                spawnSlashFx(fxlRef.current, ox + cx - 10, oy + cy - 40)
              } else {
                // Puños boom
                const [fxP, fyP] = mapPoint(r.rig, ch.fists?.[r.hand ? 1 : 0])
                spawnFx(fxlRef.current, 'boom', ox + fxP - 6, oy + fyP, { life: 0.2, s0: 0.3, s1: 1.1 })
              }

              if (enter) {
                spawnFuryFx(fxlRef.current, ox, oy, true)
              }
            })

            if ((r.fury ?? 0) > 0 && Math.random() < dt * 10 && fxlRef.current) {
              spawnFuryFx(fxlRef.current, r.x, r.y - r.h, false)
            }
          }
        }

        // Posicionar elementos visuales del mapache
        r.el.classList.toggle('buffed', r.buff > 0)
        r.el.classList.toggle('fury', (r.fury ?? 0) > 0)
        applyPose(
          r.rig,
          ch.pose(
            r.state,
            r.phase,
            r.t,
            r.state === 'jump'
              ? r.jump?.j ?? 1
              : ch.kind === 'ranged'
              ? r.recoil
              : r.atk,
            r
          )
        )

        const lift = r.rig.lift || 0
        r.shadow.style.transform = `scale(${Math.max(0.45, 1 - lift / 160)})`
        r.shadow.style.opacity = String(Math.max(0.35, 1 - lift / 120))
        r.el.style.zIndex = String(r.row * 10 + (r.state === 'jump' ? 8 : ch.boss ? 6 : 5))
        r.el.style.left = `${r.x - r.rig.W / 2}px`
        r.el.style.top = `${r.y - r.h}px`

        // Etiqueta flotante
        r.tag.textContent = ch.boss
          ? r.action === 'roar'
            ? '¡RUGIDO!'
            : r.action === 'summon'
            ? '¡invocando Garritas!'
            : 'REY GARRA'
          : (r.buff > 0 ? '⬆ ' : '') +
            ((r.fury ?? 0) > 0
              ? `¡FURIA! x${r.fury}`
              : r.state === 'jump'
              ? '¡saltando!'
              : r.state === 'hold'
              ? ch.holdLabel
              : inRange
              ? ch.moveAtkLabel
              : 'avanzando')

        // Barra de vida
        if (r.bar && r.bar.firstChild) {
          const fill = r.bar.firstChild as HTMLElement
          fill.style.width = `${Math.max(0, (r.hp / r.maxHp) * 100)}%`
        }

        // Si es el Rey Garra, actualizar la barra de vida superior del jefe
        if (ch.boss) {
          setBossHpData({ current: r.hp, max: r.maxHp, name: ch.name })
        }

        // LLEGADA A LA CASA DEL JUGADOR (x <= 15)
        if (r.x <= 20) {
          handleBreachHouse(r)
        }
      }

      // Limpiar mapaches eliminados
      state.raccoons = state.raccoons.filter((r) => !r.gone)

      // 5. ACTUALIZACIÓN DE PROYECTILES Y EFECTOS FX
      for (const f of state.fx) {
        f.age += dt
        f.vy += f.g * dt
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.rot += f.vr * dt
        const t = Math.min(1, f.age / f.life)

        f.el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}deg) scale(${
          f.s0 + (f.s1 - f.s0) * t
        })`
        f.el.style.opacity = String(f.o0 + (f.o1 - f.o0) * t)

        // Bola de cañón / Cuchillo impactando planta
        if (f.isBall || f.isKnife) {
          f.trailT = (f.trailT || 0) - dt
          if (f.trailT <= 0 && fxlRef.current) {
            f.trailT = 0.03
            spawnFx(fxlRef.current, f.trailCls || 'trail', f.x + 6, f.y, {
              life: 0.25,
              s0: 0.9,
              s1: 0.2,
              o0: 0.6,
            })
          }
          const target = state.plants.find(
            (p) => !p.dead && p.row === f.lane && Math.abs(p.x - f.x) <= 30
          )
          if (target) {
            hitPlantEntity(target, f.dmg || 20)
            f.age = f.life
            if (fxlRef.current) {
              spawnFx(fxlRef.current, 'boom', f.x, f.y, { life: 0.25, s0: 0.4, s1: 1.2 })
            }
          }
        }

        // Guisante aliado impactando a mapache
        if (f.isPea) {
          const hitRac = state.raccoons.find(
            (r) => !r.dying && r.row === f.lane && Math.abs(r.x - f.x) <= 35
          )
          if (hitRac) {
            damageRaccoon(hitRac, f.dmg || 20)
            f.age = f.life
            soundManager.playSound('pea_hit', 0.3)
            if (fxlRef.current) {
              spawnFx(fxlRef.current, 'boom', f.x, f.y, { life: 0.2, s0: 0.3, s1: 0.8 })
            }
          }
        }

        if (f.age >= f.life) {
          f.el.remove()
          f.dead = true
        }
      }
      state.fx = state.fx.filter((f) => !f.dead)

      // 6. ACTUALIZACIÓN DE SOLES
      for (const s of state.suns) {
        if (!s.collected && s.y < s.targetY) {
          s.y += dt * 90
        }
      }

      // 7. SCREEN SHAKE
      state.shake = Math.max(0, state.shake - dt)
      const sk = state.shake * 12
      if (unitsRef.current && fxlRef.current) {
        unitsRef.current.style.transform = fxlRef.current.style.transform = sk
          ? `translate(${(Math.random() - 0.5) * sk}px, ${(Math.random() - 0.5) * sk}px)`
          : ''
      }

      state.reqId = requestAnimationFrame(loop)
    }

    stateRef.current.reqId = requestAnimationFrame(loop)
  }

  // ── IA DEL JEFE REY GARRA ──────────────────────────────────────────────────
  const bossStep = (r: ActiveRaccoon, dt: number) => {
    const ch = r.ch
    const B =
      r.boss ||
      (r.boss = {
        mode: 'enter',
        targetRow: 2,
        pause: 0,
        roarT: 3,
        summonT: 1.5,
      })

    if (r.action) {
      const prev = r.atk || 0
      r.atk = (r.atk || 0) + dt / (r.action === 'roar' ? 1.3 : 1.0)
      if (r.action === 'roar' && prev < 0.32 && r.atk >= 0.32) {
        doBossRoar(r)
      }
      if (r.action === 'summon' && prev < 0.45 && r.atk >= 0.45) {
        doBossSummon(r)
      }
      if (r.atk >= 1) {
        r.action = null
        r.atk = null
      }
      r.state = 'hold'
      return
    }

    if (B.mode !== 'enter') {
      B.roarT -= dt
      B.summonT -= dt
      if (B.roarT <= 0) {
        B.roarT = 9
        r.action = 'roar'
        r.atk = 0
        return
      }
      if (B.summonT <= 0) {
        B.summonT = 6
        r.action = 'summon'
        r.atk = 0
        return
      }
    }

    if (B.mode === 'enter') {
      r.x -= r.speed * dt
      r.phase += dt * 4
      r.state = 'walk'
      if (r.x <= (ch.patrolX || 770)) {
        B.mode = 'patrol'
        B.pause = 0.6
      }
      return
    }

    // Patrulla vertical entre los 5 carriles
    const ty = B.targetRow * TILE_H + TILE_H + 4
    if (Math.abs(r.y - ty) < 1.5) {
      r.y = ty
      r.row = B.targetRow
      r.state = 'hold'
      B.pause -= dt
      if (B.pause <= 0) {
        let n = Math.floor(Math.random() * ROWS)
        while (n === B.targetRow) {
          n = Math.floor(Math.random() * ROWS)
        }
        B.targetRow = n
        B.pause = 1.0 + Math.random() * 1.4
      }
    } else {
      r.y += Math.sign(ty - r.y) * Math.min(Math.abs(ty - r.y), (ch.vSpeed || 55) * dt)
      r.row = Math.max(0, Math.min(ROWS - 1, Math.round((r.y - TILE_H - 4) / TILE_H)))
      r.state = 'walk'
      r.phase += dt * 4.5
    }
  }

  const doBossRoar = (r: ActiveRaccoon) => {
    if (fxlRef.current) {
      spawnRoarFx(fxlRef.current, r.x - r.rig.W / 2 + 30, r.y - r.h + 20)
    }
    stateRef.current.shake = Math.max(stateRef.current.shake, 0.35)
    // Otorgar buff a los mapaches aliados cercanos
    for (const o of stateRef.current.raccoons) {
      if (o === r || o.ch.boss || o.dying) continue
      if (Math.abs(o.x - r.x) < 380 && Math.abs(o.y - r.y) <= 180) {
        o.buff = 5
      }
    }
  }

  const doBossSummon = (r: ActiveRaccoon) => {
    if (fxlRef.current) {
      spawnSummonFx(fxlRef.current, r.x - r.rig.W / 2 + 50, r.y - r.h + 40)
    }
    // Invocar 1 Garritas en un carril al azar
    const randomLane = Math.floor(Math.random() * ROWS)
    addRaccoon('garritas', randomLane, true)
  }

  // ── RUTINAS MELEE MAPACHE ──────────────────────────────────────────────────
  const meleeRaccoonStep = (
    r: ActiveRaccoon,
    dt: number,
    canStart: boolean,
    onHit: (enterFury: boolean) => void
  ) => {
    const A = r.ch.atk
    if (!A) return
    const mult = (r.fury ?? 0) > 0 ? (A.fury ? A.fury.mult : 1) : 1
    if (r.atk == null && canStart && r.cooldown <= 0) {
      r.atk = 0
      r.hand = r.hand ? 0 : 1
      r.mult = mult
      r.cooldown = A.cd / mult
    }
    if (r.atk == null) return
    const prev = r.atk
    r.atk += (dt * (r.mult || 1)) / A.dur
    if (prev < A.hit && r.atk >= A.hit) {
      let enteredFury = false
      if (A.fury) {
        if ((r.fury ?? 0) > 0) {
          r.fury!--
        } else {
          r.hits = (r.hits || 0) + 1
          if (r.hits % A.fury.every === 0) {
            r.fury = A.fury.count
            enteredFury = true
          }
        }
      }
      onHit(enteredFury)
    }
    if (r.atk >= 1) r.atk = null
  }

  // Dañar a una planta aliada
  const hitPlantEntity = (plant: PlacedPlant, dmg: number) => {
    plant.hp -= dmg
    plant.shake = 0.25
    plant.flash = 0.1
    if (plant.hp <= 0 && !plant.dead) {
      plant.dead = true
      soundManager.playSound('pea_hit', 0.5)
      stateRef.current.plants = stateRef.current.plants.filter((p) => p !== plant)
    }
  }

  // Dañar a un mapache
  const damageRaccoon = (r: ActiveRaccoon, dmg: number) => {
    if (r.dying) return
    r.hp -= dmg
    r.el.classList.add('hurt')
    setTimeout(() => r.el.classList.remove('hurt'), 90)

    if (r.ch.boss) {
      setBossHpData({ current: r.hp, max: r.maxHp, name: r.ch.name })
    }

    if (r.hp <= 0) {
      r.dying = true
      r.el.style.transition = 'opacity 0.6s, transform 0.6s'
      r.el.style.opacity = '0'
      r.el.style.transform = 'translateY(20px) rotate(8deg)'
      if (fxlRef.current) {
        for (let i = 0; i < 8; i++) {
          spawnFx(
            fxlRef.current,
            'smoke',
            r.x + (Math.random() - 0.5) * 40,
            r.y - r.h * 0.4,
            { vx: (Math.random() - 0.5) * 80, vy: -40, life: 0.8, s0: 0.6, s1: 1.8 }
          )
        }
      }
      setTimeout(() => {
        r.el.remove()
        r.gone = true
        if (r.ch.boss) {
          setBossHpData(null)
        }
      }, 650)
    }
  }

  // Cuando un mapache llega al porche de la casa
  const handleBreachHouse = (r: ActiveRaccoon) => {
    const lane = r.row
    if (stateRef.current.activeLawnmowers[lane]) {
      // Activar cortacésped: arrasa con los mapaches del carril
      stateRef.current.activeLawnmowers[lane] = false
      setLawnmowers([...stateRef.current.activeLawnmowers])
      soundManager.playSound('click', 0.6)

      // Eliminar al mapache que lo activó y a los que estén en la misma fila
      for (const enemy of stateRef.current.raccoons) {
        if (!enemy.dying && enemy.row === lane) {
          damageRaccoon(enemy, 9999)
        }
      }
    } else {
      // Si ya no queda cortacésped en este carril: DERROTA
      stateRef.current.isEnded = true
      setGameResult('defeat')
      soundManager.playSound('defeat', 0.8)
    }
  }

  // ── PLANTAR EN UNA CASILLA ────────────────────────────────────────────────
  const handleTileClick = (row: number, col: number) => {
    if (isShovelActive) {
      // Eliminar planta de la casilla
      const existing = stateRef.current.plants.find((p) => p.row === row && p.col === col)
      if (existing) {
        existing.dead = true
        stateRef.current.plants = stateRef.current.plants.filter((p) => p !== existing)
        soundManager.playSound('click', 0.4)
      }
      setIsShovelActive(false)
      return
    }

    if (!selectedCard) return
    const cfg = PLANT_CONFIGS[selectedCard]
    if (!cfg) return

    // Comprobar si ya hay una planta en esta casilla
    const already = stateRef.current.plants.some((p) => p.row === row && p.col === col)
    if (already) return

    // Comprobar coste de sol
    if (sunBank < cfg.cost) {
      soundManager.playSound('click', 0.2)
      return
    }

    // Descontar sol y arrancar cooldown
    setSunBank((prev) => prev - cfg.cost)
    setSelectedCard(null)
    soundManager.playSound('click', 0.5)

    const cdKey = selectedCard
    setCardCooldowns((prev) => ({ ...prev, [cdKey]: 1 }))
    const cdDuration = cfg.cooldownMs || 6000
    const startCd = performance.now()
    const cdInterval = setInterval(() => {
      const el = performance.now() - startCd
      const pct = Math.max(0, 1 - el / cdDuration)
      setCardCooldowns((prev) => ({ ...prev, [cdKey]: pct }))
      if (pct <= 0) {
        clearInterval(cdInterval)
      }
    }, 100)

    // Instanciar la planta
    const isWall = cfg.category === 'defensive' || cfg.id === 'wallnut' || cfg.id === 'garlic'
    const isProducer = cfg.category === 'producer' || cfg.id === 'sunflower'

    const newPlant: PlacedPlant = {
      id: `p_${row}_${col}_${Date.now()}`,
      row,
      col,
      x: col * TILE_W + TILE_W / 2,
      y: row * TILE_H + TILE_H - 8,
      plantId: selectedCard,
      hp: cfg.maxHp || 300,
      maxHp: cfg.maxHp || 300,
      isWall,
      isProducer,
      lastActionTime: 0,
      attackCooldown: cfg.attackSpeedMs || 1400,
      shake: 0,
      flash: 0,
    }

    stateRef.current.plants.push(newPlant)
  }

  if (!isLoaded) {
    return (
      <div className="story-battlefield-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#facc15', fontSize: '1.2rem', fontWeight: 800 }}>
          🦝 Preparando recursos y animaciones de los Mapaches...
        </div>
      </div>
    )
  }

  // ── RECOGER SOL ────────────────────────────────────────────────────────────
  const handleCollectSun = (sunId: string) => {
    const s = stateRef.current.suns.find((item) => item.id === sunId)
    if (!s || s.collected) return
    s.collected = true
    soundManager.playSound('click', 0.5)
    setSunBank((prev) => prev + 25)
    stateRef.current.suns = stateRef.current.suns.filter((item) => item.id !== sunId)
  }

  return (
    <div className="story-battlefield-root">
      {/* BARRA SUPERIOR DE ESTADO Y OLEADAS */}
      <div className="story-top-hud">
        <div className="story-top-hud__left">
          <button
            type="button"
            className="story-hud-btn story-hud-btn--back"
            onClick={onExit}
            title="Salir al Menú"
          >
            ⬅ Salir
          </button>
          <div className="story-level-badge">
            <span>NIVEL {levelConfig.level}</span>
            <small>{levelConfig.title}</small>
          </div>
        </div>

        {/* INDICADOR DE OLEADAS */}
        <div className="story-wave-hud">
          <div className="story-wave-hud__title">
            {currentWaveIndex === 2 ? '👑 OLEADA FINAL (JEFE)' : `OLEADA ${currentWaveIndex + 1} / 3`}
          </div>
          <div className="story-wave-hud__dots">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className={`story-wave-dot ${
                  idx === currentWaveIndex
                    ? 'story-wave-dot--active'
                    : idx < currentWaveIndex
                    ? 'story-wave-dot--done'
                    : ''
                }`}
              />
            ))}
          </div>
        </div>

        {/* BANCO DE SOLES Y VELOCIDAD */}
        <div className="story-top-hud__right">
          <div className="story-sun-counter" title="Soles disponibles para plantar">
            <span className="story-sun-counter__icon">☀️</span>
            <span className="story-sun-counter__val">{sunBank}</span>
          </div>

          <button
            type="button"
            className="story-hud-btn"
            onClick={() => setSpeedMul((prev) => (prev === 1 ? 2 : 1))}
            title="Alternar velocidad"
          >
            ⏩ {speedMul}x
          </button>
        </div>
      </div>

      {/* BARRA DE VIDA DEL JEFE REY GARRA (SI ESTÁ PRESENTE EN PANTALLA) */}
      {bossHpData && (
        <div className="story-boss-topbar">
          <div className="story-boss-topbar__info">
            <span className="story-boss-topbar__icon">👑</span>
            <span className="story-boss-topbar__name">{bossHpData.name}</span>
          </div>
          <div className="story-boss-topbar__track">
            <div
              className="story-boss-topbar__fill"
              style={{
                width: `${Math.max(0, (bossHpData.current / bossHpData.max) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* BANNER AVISO DE OLEADA */}
      {waveBanner && (
        <div className="story-wave-announcement-overlay">
          <div className="story-wave-announcement-card">{waveBanner}</div>
        </div>
      )}

      {/* ÁREA DE JUEGO (TABLERO 900x500 ESCALADO) */}
      <div className="story-stage-wrap" ref={wrapRef}>
        <div className="story-stage" ref={stageRef}>
          {/* CÉSPED Y LÍNEAS */}
          <div className="story-lawn">
            {Array.from({ length: ROWS }).map((_, r) =>
              Array.from({ length: COLS }).map((_, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`story-tile ${(r + c) % 2 ? 'alt' : ''}`}
                  onClick={() => handleTileClick(r, c)}
                />
              ))
            )}
          </div>

          {/* CASA DEL JUGADOR Y CORTACÉSPEDES */}
          <div className="story-house-barrier" />
          <div className="story-lawnmowers-layer">
            {lawnmowers.map((active, r) => (
              <div
                key={r}
                className={`story-lawnmower ${!active ? 'story-lawnmower--used' : ''}`}
                style={{ top: `${r * TILE_H + 30}px` }}
                title={active ? 'Cortacésped Listo' : 'Cortacésped Usado'}
              >
                🚜
              </div>
            ))}
          </div>

          {/* CAPA DE PLANTAS COLOCADAS */}
          <div className="story-plants-layer">
            {stateRef.current.plants.map((p) => {
              const cfg = PLANT_CONFIGS[p.plantId]
              const hpPct = Math.max(0, (p.hp / p.maxHp) * 100)
              return (
                <div
                  key={p.id}
                  className={`story-placed-plant ${p.flash > 0 ? 'flash' : ''}`}
                  style={{
                    left: `${p.x - 40}px`,
                    top: `${p.y - 75}px`,
                    zIndex: p.row * 10 + 2,
                    transform: p.shake > 0 ? `translateX(${Math.sin(p.shake * 90) * 4}px)` : 'none',
                  }}
                >
                  <div className="story-plant-hp">
                    <i style={{ width: `${hpPct}%` }} />
                  </div>
                  <img src={cfg?.sprite || cfg?.icon} alt={cfg?.name || p.plantId} />
                </div>
              )
            })}
          </div>

          {/* CAPA DE MAPACHES (RIGS DEL DOM) */}
          <div className="layer" ref={unitsRef} />

          {/* CAPA DE PROYECTILES Y EFECTOS */}
          <div className="layer" ref={fxlRef} />

          {/* CAPA DE SOLES INTERACTIVOS */}
          <div className="story-suns-layer" ref={sunLayerRef}>
            {stateRef.current.suns.map((s) => (
              <div
                key={s.id}
                className="story-sun-drop"
                style={{ left: `${s.x}px`, top: `${s.y}px` }}
                onClick={() => handleCollectSun(s.id)}
                title="¡Haz clic para recoger ☀️ 25!"
              >
                ☀️
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR DE CARTAS (SEMILLAS) Y PALA */}
      <div className="story-bottom-hand">
        <div className="story-seed-packets">
          {activeDeck.slice(0, 6).map((plantId) => {
            const inst = plantInstances.find((i) => i.plantId === plantId)
            const scaled = getScaledPlantConfig(
              plantId,
              inst?.statRolls || [],
              inst?.equippedItem,
              inst?.isGolden
            )
            const cfg = PLANT_CONFIGS[plantId] || scaled
            const isAffordable = sunBank >= scaled.cost
            const cdVal = cardCooldowns[plantId] || 0
            const isSelected = selectedCard === plantId

            return (
              <button
                key={plantId}
                type="button"
                className={`story-packet-card ${
                  isSelected ? 'story-packet-card--selected' : ''
                } ${!isAffordable || cdVal > 0 ? 'story-packet-card--disabled' : ''}`}
                onClick={() => {
                  if (cdVal > 0 || !isAffordable) return
                  soundManager.playSound('click', 0.4)
                  setIsShovelActive(false)
                  setSelectedCard(isSelected ? null : plantId)
                }}
                disabled={cdVal > 0 || !isAffordable}
                title={`${scaled.name} · Coste: ☀️ ${scaled.cost}`}
              >
                <img
                  src={scaled.packetActive || cfg?.icon || cfg?.sprite}
                  alt={scaled.name}
                />
                <span className="story-packet-cost">☀️{scaled.cost}</span>
                {cdVal > 0 && (
                  <div
                    className="story-packet-cd-overlay"
                    style={{ height: `${cdVal * 100}%` }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* HERRAMIENTA DE PALA */}
        <button
          type="button"
          className={`story-shovel-btn ${isShovelActive ? 'story-shovel-btn--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.3)
            setSelectedCard(null)
            setIsShovelActive((prev) => !prev)
          }}
          title={isShovelActive ? 'Cancelar pala' : 'Pala (Eliminar una planta)'}
        >
          <span className="story-shovel-icon">⛏️</span>
          <small>{isShovelActive ? 'CANCELAR' : 'PALA'}</small>
        </button>
      </div>

      {/* MODAL DE RESULTADO: VICTORIA O DERROTA */}
      {gameResult && (
        <div className="story-result-backdrop">
          <div className={`story-result-card story-result-card--${gameResult}`}>
            {gameResult === 'victory' ? (
              <>
                <div className="story-result-icon">🏆</div>
                <h2 className="story-result-title">¡NIVEL {levelConfig.level} SUPERADO!</h2>
                <p className="story-result-desc">
                  ¡Has repelido a la horda de mapaches y derrotado al Rey Garra en las 3 oleadas!
                </p>

                <div className="story-result-stars">⭐⭐⭐</div>

                <div className="story-result-rewards">
                  <div className="story-result-reward-item">
                    <span>🪙 Oro</span>
                    <strong>+{levelConfig.rewards.gold}</strong>
                  </div>
                  <div className="story-result-reward-item">
                    <span>💎 Gemas</span>
                    <strong>+{levelConfig.rewards.gems}</strong>
                  </div>
                  <div className="story-result-reward-item">
                    <span>🌱 PLANTS</span>
                    <strong>+{levelConfig.rewards.tokens}</strong>
                  </div>
                </div>

                <div className="story-result-actions">
                  {level < 20 && onNextLevel ? (
                    <button
                      type="button"
                      className="story-result-btn story-result-btn--next"
                      onClick={() => onNextLevel(level + 1)}
                    >
                      SIGUIENTE NIVEL ➡️
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="story-result-btn story-result-btn--menu"
                    onClick={onExit}
                  >
                    VOLVER AL MENÚ
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="story-result-icon">💀</div>
                <h2 className="story-result-title">¡DERROTA!</h2>
                <p className="story-result-desc">
                  Los mapaches penetraron tus defensas y saquearon el jardín. ¡Refuerza tu estrategia e inténtalo de nuevo!
                </p>

                <div className="story-result-actions">
                  <button
                    type="button"
                    className="story-result-btn story-result-btn--retry"
                    onClick={() => {
                      setGameResult(null)
                      window.location.reload()
                    }}
                  >
                    🔄 REINTENTAR NIVEL {levelConfig.level}
                  </button>
                  <button
                    type="button"
                    className="story-result-btn story-result-btn--menu"
                    onClick={onExit}
                  >
                    VOLVER AL MENÚ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
