import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { PlantId, ColosseumMatchConfig, EngineVersion } from '../../types/game'
import { parseEngineVersion } from '../../types/game'
import { TournamentManager, type ActiveTournamentSession } from '../../utils/tournamentManager'
import { tournamentService } from '../../services/tournamentService'
import { useGameEngine } from '../../hooks/useGameEngine'
import { useAuth } from '../../hooks/useAuth'
import { battleService } from '../../services/battleService'
import { supabaseService } from '../../services/supabaseService'
import {
  MatchActionOutbox,
  type MatchActionIntent,
} from '../../services/matchActionOutbox'
import {
  PLANT_CONFIGS,
  LANES_CONFIG,
  LANES_CONFIG_5,
  BASE_LEFT_END_X,
  FIELD_WIDTH_PCT,
  TOTAL_COLUMNS,
  P1_COLUMNS,
  INITIAL_BASE_HP,
  getScaledPlantConfig,
  isPlantMatchingTarget,
  type PlantStatKey,
} from '../../utils/gameConstants'
import type { ClanFortressMatchOpponent, ClanFortressRaidResult } from '../../types/game'
import { getArenaForElo, getEloDeltasForElo, getTrophyGateForElo } from '../../utils/arenaManager'
import arena1Bg from '../../assets/images/battlefield-bg.webp'
const sunIcon = '/game-assets/greenfoot/sun1.webp'
const peaImg = '/game-assets/images/Plants/PB00.webp'
const melonImg = '/game-assets/images/Plants/melon_pult.webp'
const needleImg = '/game-assets/greenfoot/needle1.png'
const kernelImg = '/game-assets/plants/projectile_kernel.webp'
const butterImg = '/game-assets/plants/projectile_butter.webp'
import PlantHand from './PlantHand'
import RelojDePartida from '../RelojDePartida/RelojDePartida'
import { SOL_SE_RECOGE_SOLO_MS } from '../../engine/balance'
import { MARGEN_DE_RED_TICS } from '../../engine/pvp'
import { TICK_MS } from '../../engine/time'
import { soundManager } from '../../utils/audioManager'
import { toggleFullscreen } from '../../utils/fullscreen'
import { resolverLiquidacionPartida } from '../../engine/asyncOpponent'
import { leerMazo, mejorasDeLaCartaEnSlot, type CartaDeMazo } from '../../engine/mazoDeLaSala'
import { StrategicPlaytestPostMatch } from '../StrategicPlaytest/StrategicPlaytestPostMatch'
import type { StrategicPlaytestConfig } from '../../engine/strategicPlaytest'
import { recordPlantPlacement } from '../../utils/plantUsageTracker'
import { trackGameOver, trackGameStart } from '../../utils/analytics'
import GoldIcon from '../Common/GoldIcon'
import type { ArenaAdsRun, ArenaAdsLoot } from '../../utils/arenaAdsManager'
import { ArenaAdsManager, getBotStatsForLevel } from '../../utils/arenaAdsManager'
import ArenaAdsInterstitialModal from '../ArenaAds/ArenaAdsInterstitialModal'
import { arenaAdsService } from '../../services/arenaAdsService'
import { setCombatAdsBlocked, resetPopunderQuota } from '../../utils/arenaAdsNetwork'
import './Battlefield.css'

/** Un segundo antes de que el sol se recoja solo: momento de avisar. */
const TICS_ANTES_DE_RECOGERSE_SOLO = Math.round((SOL_SE_RECOGE_SOLO_MS - 1000) / TICK_MS)

function getBattlefieldPlantLevel(plantId: string): number {
  try {
    const saved = localStorage.getItem('plant_arena_plant_levels')
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed[plantId] || 0
    }
  } catch {}
  return 0
}

function getLocalPlayerName(): string {
  try {
    const saved = localStorage.getItem('plant_arena_player_profile')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed?.name && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
        return parsed.name.trim()
      }
    }
  } catch {}
  return 'Tú'
}

interface BaseTowerProps {
  team: 'p1' | 'p2'
  hp: number
  maxHp: number
  sunBank?: number
  /** El nick del dueño de este árbol. Sin él se usa la etiqueta genérica. */
  nombre?: string | null
  level?: number
  skin?: string | null
  sideBadge?: React.ReactNode
}

const motherTreeImg = '/game-assets/greenfoot/mothertree_whitebg.webp'
const motherTreeSentinelImg = '/game-assets/greenfoot/mothertree_sentinel.webp'

function BaseTower({ team, hp, maxHp, sunBank, nombre, level, skin, sideBadge }: BaseTowerProps) {
  const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
  const treeImgSrc = skin === 'mother_tree_skin' ? motherTreeSentinelImg : motherTreeImg

  return (
    <div className={`base base--${team}`}>
      {sideBadge && (
        <div className={`base__side-badge base__side-badge--${team}`}>
          {sideBadge}
        </div>
      )}
      <div className="base__top">
        <div className="base__hp">
          <div
            className="base__hp-fill"
            style={{
              width: `${hpPct}%`,
              backgroundColor: team === 'p1' ? '#52e061' : '#ff4d4d',
            }}
          />
        </div>
        <span className="base__label">
          {skin === 'mother_tree_skin' ? '🌌 ' : '🌳 '}
          {nombre ? nombre : team === 'p1' ? getLocalPlayerName() : 'Rival Bot'}
          {skin === 'mother_tree_skin' && (
            <span style={{ color: '#c084fc', fontWeight: 900, marginLeft: '4px' }}>[Centinela]</span>
          )}
          {level !== undefined && level > 0 && (
            <span style={{ color: '#facc15', fontWeight: 900, marginLeft: '4px' }}>[Nv.{level}]</span>
          )}{' '}
          <span style={{ color: '#ffffff', fontWeight: 800, marginLeft: '2px' }}>
            ({Math.round(hp)}/{maxHp})
          </span>
        </span>
        {team === 'p2' && sunBank !== undefined && (
          <div className="base__pc-sun">
            <img src={sunIcon} alt="Sol" className="base__pc-sun-icon" />
            <span>{sunBank}</span>
          </div>
        )}
      </div>
      <div className="base__tree-wrap" style={{ position: 'relative' }}>
        {skin === 'mother_tree_skin' ? (
          <div
            style={{
              position: 'absolute',
              inset: '0%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(168, 85, 247, 0.55) 0%, rgba(56, 189, 248, 0.35) 45%, transparent 75%)',
              filter: 'blur(8px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ) : level !== undefined && level > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: '-10%',
              borderRadius: '50%',
              background: team === 'p1'
                ? 'radial-gradient(circle, rgba(74, 222, 128, 0.45) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(239, 68, 68, 0.45) 0%, transparent 70%)',
              filter: 'blur(10px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        <img
          src={treeImgSrc}
          alt={team === 'p1' ? 'Árbol Madre P1' : 'Árbol Madre P2'}
          className={`base__mothertree-img ${team === 'p2' ? 'base__mothertree-img--p2' : ''} ${skin === 'mother_tree_skin' ? 'base__mothertree-img--skin' : ''}`}
          style={{ position: 'relative', zIndex: 1 }}
        />
      </div>
    </div>
  )
}

interface BattlefieldProps {
  onBackToMenu?: () => void
  onBackToCollection?: () => void
  onBattleComplete?: (isVictory: boolean) => any
  onSurrender?: () => any
  practicePlantId?: string | null
  activeDeck?: PlantId[]
  userElo?: number
  customBgImage?: string
  matchMode?: 'ranked' | 'colosseum' | 'tournament' | 'strategic_test' | 'friendly' | 'clan_fortress' | 'arena_ads'
  arenaAdsRun?: ArenaAdsRun | null
  onArenaAdsAdvance?: (run: ArenaAdsRun) => void
  onArenaAdsRetreat?: (loot: ArenaAdsLoot, multiplier?: number, newlyClaimedLevels?: number[]) => void
  onArenaAdsRevive?: (costGems?: number) => void
  friendlyBetGems?: number
  colosseumConfig?: ColosseumMatchConfig | null
  tournamentOpponent?: { name: string; tournamentId: string } | null
  tournamentDeck?: PlantId[] | null
  onColosseumComplete?: (won: boolean) => { payoutGems: number; newStreak: number; newMaxStreak: number; isNewRecord: boolean }
  strategicPlaytestConfig?: StrategicPlaytestConfig | null
  onPlayAgainPlaytest?: () => void
  clanFortressConfig?: { targetClan: ClanFortressMatchOpponent } | null
  onClanFortressComplete?: (result: ClanFortressRaidResult) => void
  /**
   * La sala de la partida, si es contra otro jugador de verdad.
   *
   * Con sala: el resultado lo liquida el servidor (report_match_result), que
   * exige que AMBOS reporten el mismo ganador. Sin sala la partida es contra el
   * bot local y no cuenta: ni ELO real ni reporte.
   */
  roomId?: string | null
  /**
   * La semilla del azar, que viene de game_rooms.seed.
   *
   * Es la MISMA para los dos jugadores: es lo que hace que ambos simulen
   * exactamente la misma partida (engine/simulate.ts). Sin ella se usa la de por
   * defecto, que sirve para jugar en solitario.
   */
  seed?: number
  /** El rival, para poder decirle al servidor quién ganó. */
  opponentId?: string | null
  /**
   * Los nicks de los dos, para ponerlos encima de cada árbol.
   *
   * Sin esto se lee "ÁRBOL MADRE (P1)" y "ÁRBOL MADRE (P2)", que no dice quién
   * es quién. Contra el bot no hay nombres y se cae a las etiquetas de siempre.
   */
  nombres?: { mio: string; rival: string } | null
  /**
   * Si soy el jugador 1 de la sala.
   *
   * Lo necesita la huella del tablero: cada jugador se ve a sí mismo a la
   * izquierda, así que las dos huellas sólo se pueden comparar si las dos están
   * normalizadas al punto de vista del jugador 1.
   */
  soyP1?: boolean
  /**
   * Los dos mazos de la sala, tal como los guardó el servidor al emparejar.
   *
   * Con el nivel y las mejoras de cada carta. Es de donde salen las estadísticas de
   * las plantas de LOS DOS lados, y por eso las dos pantallas simulan la misma
   * planta: antes cada uno aplicaba sus mejoras desde su propio navegador y el
   * rival ponía la carta básica, así que la misma planta tenía 345 de vida en un
   * lado y 300 en el otro desde el momento de plantarla. Ver
   * engine/mazoDeLaSala.ts.
   */
  mazosDeLaSala?: { mio: unknown; rival: unknown } | null
  isAsyncMatch?: boolean
  engineVersion?: EngineVersion | null
  onServerEloUpdated?: (newElo: number) => void
  treeLevels?: { mio: number; rival: number } | null
  treeSkins?: { mio: string | null; rival: string | null } | null
}

export default function Battlefield({
  onBackToMenu,
  onBackToCollection,
  onBattleComplete,
  onSurrender,
  onServerEloUpdated,
  practicePlantId,
  activeDeck,
  userElo = 1000,
  customBgImage,
  matchMode = 'ranked',
  friendlyBetGems,
  roomId = null,
  seed,
  opponentId = null,
  nombres = null,
  soyP1 = true,
  mazosDeLaSala = null,
  isAsyncMatch = false,
  engineVersion = null,
  colosseumConfig,
  tournamentOpponent,
  tournamentDeck,
  onColosseumComplete,
  strategicPlaytestConfig = null,
  onPlayAgainPlaytest,
  clanFortressConfig = null,
  onClanFortressComplete,
  arenaAdsRun = null,
  onArenaAdsAdvance,
  onArenaAdsRetreat,
  onArenaAdsRevive,
  treeLevels = null,
  treeSkins = null,
}: BattlefieldProps) {
  const {
    tick,
    desfaseDeTics,
    gameStatus,
    isPracticeMode,
    isMuted,
    toggleMute,
    p1BaseHp,
    p2BaseHp,
    sunBank,
    p2SunBank,
    plants,
    enemyPlants,
    projectiles,
    suns,
    selectedCard,
    selectedSlotIndex,
    setSelectedCard,
    cooldowns,
    slotCooldowns,
    waveBanner,
    stats,
    startGame,
    startPracticeGame,
    startStrategicPlaytestGame,
    currentPlaytestLog,
    surrenderGame,
    prepararRecogidaSol,
    confirmarRecogidaSol,
    collectSun,
    placePlant,
    digPlant,
    pendingOwnPlants = [],
    encolarAccionDelRival,
    descartarAccionPropia,
    confirmarAccionP1,
    incorporarIntencionesAsync,
    reconciliationState: _reconciliationState,
    terminarPorOrdenDelServidor,
    tomarHuellasPendientes,
    reconstrucciones,
    rankedAsyncInconsistency,
    sessionGeneration,
    updateInitialTreeBonusHp,
    setPreparationPhase,
  } = useGameEngine()

  const { user } = useAuth()
  const currentUserId = user?.id ?? null

  const [treeLevel, setTreeLevel] = useState<number>(() => {
    if (typeof treeLevels?.mio === 'number') {
      return treeLevels.mio
    }
    try {
      const raw = localStorage.getItem('plant_arena_mother_tree')
      if (raw) {
        const parsed = JSON.parse(raw)
        return typeof parsed?.treeLevel === 'number' ? parsed.treeLevel : 0
      }
    } catch (_) {}
    return 0
  })

  const [treeBonusHp, setTreeBonusHp] = useState<number>(() => {
    if (typeof treeLevels?.mio === 'number') {
      return treeLevels.mio * 50
    }
    try {
      const raw = localStorage.getItem('plant_arena_mother_tree')
      if (raw) {
        const parsed = JSON.parse(raw)
        return typeof parsed?.treeLevel === 'number' ? parsed.treeLevel * 50 : 0
      }
    } catch (_) {}
    return 0
  })
  const treeBonusHpRef = useRef<number>(treeBonusHp)
  treeBonusHpRef.current = treeBonusHp

  const rivalTreeLevel = treeLevels?.rival ?? 0
  const rivalTreeBonusHp = rivalTreeLevel * 50
  const rivalTreeBonusHpRef = useRef<number>(rivalTreeBonusHp)
  rivalTreeBonusHpRef.current = rivalTreeBonusHp

  const [treeSkin, setTreeSkin] = useState<string | null>(() => {
    if (typeof treeSkins?.mio !== 'undefined') return treeSkins.mio
    try {
      const raw = localStorage.getItem('plant_arena_mother_tree')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed?.equippedTreeSkin === 'string' && parsed.equippedTreeSkin) {
          return parsed.equippedTreeSkin
        }
      }
    } catch (_) {}
    return null
  })
  const treeSkinRef = useRef<string | null>(treeSkin)
  treeSkinRef.current = treeSkin

  const rivalTreeSkin = treeSkins?.rival ?? null
  const rivalTreeSkinRef = useRef<string | null>(rivalTreeSkin)
  rivalTreeSkinRef.current = rivalTreeSkin

  useEffect(() => {
    if (typeof treeLevels?.mio === 'number' || typeof treeLevels?.rival === 'number' || treeSkins) {
      const bonus = typeof treeLevels?.mio === 'number' ? treeLevels.mio * 50 : treeBonusHpRef.current
      const rivalBonus = typeof treeLevels?.rival === 'number' ? treeLevels.rival * 50 : 0
      const currentSkin = treeSkins?.mio !== undefined ? treeSkins.mio : treeSkinRef.current
      const currentRivalSkin = treeSkins?.rival !== undefined ? treeSkins.rival : null
      if (typeof treeLevels?.mio === 'number') {
        setTreeLevel(treeLevels.mio)
        setTreeBonusHp(bonus)
        treeBonusHpRef.current = bonus
      }
      if (treeSkins?.mio !== undefined) {
        setTreeSkin(treeSkins.mio)
        treeSkinRef.current = treeSkins.mio
      }
      rivalTreeBonusHpRef.current = rivalBonus
      rivalTreeSkinRef.current = currentRivalSkin
      updateInitialTreeBonusHp(bonus, rivalBonus, currentSkin, currentRivalSkin)
      return
    }
    void supabaseService.getMotherTreeState().then((res) => {
      if (res) {
        if (typeof res?.treeLevel === 'number') {
          const bonus = res.treeLevel * 50
          setTreeLevel(res.treeLevel)
          setTreeBonusHp(bonus)
          treeBonusHpRef.current = bonus
        }
        if (typeof res?.equippedTreeSkin !== 'undefined') {
          setTreeSkin(res.equippedTreeSkin)
          treeSkinRef.current = res.equippedTreeSkin
        }
        updateInitialTreeBonusHp(
          treeBonusHpRef.current,
          rivalTreeBonusHpRef.current,
          res.equippedTreeSkin ?? treeSkinRef.current,
          rivalTreeSkinRef.current
        )
      }
    })
  }, [treeLevels?.mio, treeLevels?.rival, treeSkins?.mio, treeSkins?.rival, updateInitialTreeBonusHp])

  const [showPvpDiag, setShowPvpDiag] = useState<boolean>(false)

  const sessionGenerationRef = useRef<number>(sessionGeneration ?? 0)
  sessionGenerationRef.current = sessionGeneration ?? 0
  const roomIdRef = useRef<string | null>(roomId ?? null)
  roomIdRef.current = roomId ?? null
  const gameStatusRef = useRef<string>(gameStatus)
  gameStatusRef.current = gameStatus

  /**
   * Lo que dijo el servidor al liquidar la partida real.
   *
   * Tres estados que importan y hay que enseñar tal cual:
   *   'esperando_al_rival'   → tu reporte está registrado, falta el del otro
   *   'resultado_en_disputa' → cada uno dijo algo distinto; no cobra nadie
   *   'liquidada'            → repartido, con su ELO y su pago
   */
  const [resultadoServidor, setResultadoServidor] = useState<{
    success?: boolean
    status?: string
    resultadoFinal?: 'victory' | 'defeat' | 'draw' | 'hold'
    eloBefore?: number
    opponentElo?: number
    eloDelta?: number
    eloAfter?: number
    eloGained?: number
    eloLost?: number
    payout?: number
    vipGoldBonus?: number
    error?: string
  } | null>(null)


  const esperandoConfirmacionServidor =
    Boolean(roomId) &&
    (
      resultadoServidor === null ||
      ['verificando', 'verificacion_pendiente'].includes(
        resultadoServidor.status ?? ''
      )
    )

  const resultadoEnRevision =
    !isAsyncMatch && resultadoServidor?.status === 'revision_servidor'

  const resultadoEmpatado =
    ['empate_verificado', 'resultado_en_disputa'].includes(
      resultadoServidor?.status ?? ''
    )

  const [battleSummaryResult, setBattleSummaryResult] = useState<{
    eloChange?: number
    newElo?: number
    packResult?: { awarded: boolean; durationHours?: 2 | 4 | 8 | 12; arenaLevel?: number; isSlotsFull?: boolean }
    vipGoldBonus?: number
    isSurrendered?: boolean
  } | null>(null)

  const [clockSyncStatus, setClockSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [clockSyncError, setClockSyncError] = useState<string | null>(null)
  const matchClockGenRef = useRef<number>(0)
  const startedGensRef = useRef<Set<number>>(new Set())
  const lastCellPlantTimeRef = useRef<Map<string, number>>(new Map())

  const syncAndStartMatchClock = useCallback((targetRoomId: string) => {
    matchClockGenRef.current += 1
    const attemptGen = matchClockGenRef.current
    setClockSyncStatus('syncing')
    setClockSyncError(null)

    battleService.startMatchClock(targetRoomId)
      .then((reloj) => {
        // Protección contra respuestas stale o doble inicio:
        if (matchClockGenRef.current !== attemptGen || startedGensRef.current.has(attemptGen)) {
          return
        }
        if (!reloj || typeof reloj.ancoraMs !== 'number' || !Number.isFinite(reloj.ancoraMs)) {
          throw new Error('Reloj autoritativo incompleto o inválido.')
        }

        const validEngine = parseEngineVersion(engineVersion)
        if (!validEngine) {
          setClockSyncStatus('error')
          setClockSyncError('No se pudo validar la versión de esta partida. Actualiza el juego e inténtalo nuevamente.')
          return
        }

        startedGensRef.current.add(attemptGen)
        setClockSyncStatus('synced')
        startGame(
          seed,
          true,
          reloj.ancoraMs,
          userElo,
          soyP1,
          mazosDeLaSala,
          isAsyncMatch,
          undefined,
          validEngine,
          treeBonusHpRef.current,
          rivalTreeBonusHpRef.current,
          treeSkinRef.current,
          rivalTreeSkinRef.current
        )
      })
      .catch((err: any) => {
        if (matchClockGenRef.current !== attemptGen) {
          return
        }
        setClockSyncStatus('error')
        setClockSyncError(err?.message || 'No se pudo sincronizar la partida con el servidor.')
      })
  }, [seed, soyP1, mazosDeLaSala, isAsyncMatch, engineVersion, userElo, startGame])

  const [colosseumResult, setColosseumResult] = useState<{
    payoutGems: number
    newStreak: number
    newMaxStreak: number
    isNewRecord: boolean
  } | null>(null)

  const [tournamentResult, setTournamentResult] = useState<ActiveTournamentSession | null>(null)

  /**
   * Segundos que faltan para el tic 1.
   *
   * El desfase es negativo mientras la partida no ha empezado: el reloj común
   * apunta a un instante futuro y los dos clientes lo esperan. Es la cuenta atrás
   * que sustituye al «uno entra dos segundos antes que el otro».
   */
  const segundosParaEmpezar =
    desfaseDeTics !== null && desfaseDeTics < 0
      ? Math.ceil((-desfaseDeTics * TICK_MS) / 1000)
      : 0

  const activeArena = useMemo(() => getArenaForElo(userElo), [userElo])
  const activeBgImage = customBgImage || (matchMode === 'clan_fortress' ? arena1Bg : activeArena.bgImage)
  const [clanRaidResult, setClanRaidResult] = useState<ClanFortressRaidResult | null>(null)
  const [clanRaidPhase, setClanRaidPhase] = useState<'prep' | 'battle'>('prep')
  const [clanRaidPrepTimer, setClanRaidPrepTimer] = useState<number>(120)
  const [currentFortressOpponent, setCurrentFortressOpponent] = useState<ClanFortressMatchOpponent | null>(
    () => clanFortressConfig?.targetClan || null
  )
  const [isRerollingTarget, setIsRerollingTarget] = useState<boolean>(false)
  const [rerollError, setRerollError] = useState<string | null>(null)
  const [raidPrepNotice, setRaidPrepNotice] = useState<string | null>(null)
  const hasClanFortressStartedRef = useRef<boolean>(false)

  const [showArenaAdsInterstitial, setShowArenaAdsInterstitial] = useState<boolean>(false)
  const [arenaAdsModalMode, setArenaAdsModalMode] = useState<'victory' | 'defeat'>('victory')
  const [isRevivingArenaAds, setIsRevivingArenaAds] = useState<boolean>(false)
  const [currentArenaAdsRun, setCurrentArenaAdsRun] = useState<ArenaAdsRun | null>(
    () => arenaAdsRun || ArenaAdsManager.getStoredRun()
  )

  useEffect(() => {
    if (arenaAdsRun) {
      setCurrentArenaAdsRun(arenaAdsRun)
    }
  }, [arenaAdsRun])

  // Los anuncios NUNCA deben activarse en combate: bloqueo estricto garantizado
  useEffect(() => {
    if (matchMode === 'arena_ads') {
      setCombatAdsBlocked(true)
      return () => {
        setCombatAdsBlocked(false)
      }
    }
  }, [matchMode])

  // En clan_fortress la arena siempre opera sobre 5 carriles (LANES_CONFIG_5),
  // bloqueando visualmente los carriles no disponibles según el nivel del Árbol Madre rival.
  const activeLanesConfig = useMemo(() => {
    if (matchMode === 'clan_fortress') return LANES_CONFIG_5
    return LANES_CONFIG
  }, [matchMode])

  const fortressTargetTreeLevel = useMemo(() => {
    if (currentFortressOpponent?.targetTreeLevel !== undefined) {
      return currentFortressOpponent.targetTreeLevel
    }
    if (clanFortressConfig?.targetClan?.targetTreeLevel !== undefined) {
      return clanFortressConfig.targetClan.targetTreeLevel
    }
    const lanes = currentFortressOpponent?.activeLanes || clanFortressConfig?.targetClan?.activeLanes
    if (lanes === 5) return 4
    if (lanes === 4) return 3
    return 1
  }, [currentFortressOpponent, clanFortressConfig])

  // Carriles permitidos según el nivel de Árbol Madre de la fortaleza:
  // Nivel 1 y 2: Carriles 1, 2 y 3 (0 y 4 bloqueados)
  // Nivel 3: Carriles 0, 1, 2 y 3 (4 bloqueado)
  // Nivel 4+: Carriles 0, 1, 2, 3, 4 (todos desbloqueados)
  const allowedFortressLanes = useMemo(() => {
    if (matchMode !== 'clan_fortress') return [0, 1, 2]
    if (fortressTargetTreeLevel >= 4) return [0, 1, 2, 3, 4]
    if (fortressTargetTreeLevel === 3) return [0, 1, 2, 3]
    return [1, 2, 3]
  }, [matchMode, fortressTargetTreeLevel])

  useEffect(() => {
    if (clanFortressConfig?.targetClan) {
      setCurrentFortressOpponent(clanFortressConfig.targetClan)
    }
  }, [clanFortressConfig?.targetClan])

  const prepTargetTimeRef = useRef<number | null>(null)

  const allCatalogCards = useMemo(() => Object.keys(PLANT_CONFIGS) as PlantId[], [])

  const mazoMioParsed = useMemo<CartaDeMazo[] | null>(() => {
    if (matchMode === 'arena_ads' && currentArenaAdsRun?.deck && currentArenaAdsRun.deck.length > 0) {
      return currentArenaAdsRun.deck
    }
    const fromRoom = leerMazo(mazosDeLaSala?.mio)
    if (fromRoom && fromRoom.length > 0) return fromRoom

    // En modos sin sala previa (como clan_fortress), construir el mazo con instancias reales del jugador
    let deckCards: PlantId[] = []
    if (matchMode === 'tournament' && tournamentDeck && tournamentDeck.length > 0) {
      deckCards = tournamentDeck
    } else if (activeDeck && activeDeck.length > 0) {
      deckCards = activeDeck
    } else {
      try {
        const rawDeck = localStorage.getItem('plant_arena_active_deck')
        if (rawDeck) {
          const parsed = JSON.parse(rawDeck)
          if (Array.isArray(parsed) && parsed.length > 0) {
            deckCards = parsed.filter((id) => id in PLANT_CONFIGS)
          }
        }
      } catch {}
    }

    if (deckCards.length === 0) {
      deckCards = allCatalogCards.slice(0, 6)
    }

    // Enriquecer con mejoras, niveles e ítems equipados por slot o instancia
    try {
      const sIds = localStorage.getItem('plant_arena_active_deck_instances')
      const sInst = localStorage.getItem('plant_arena_plant_instances')
      const pIds: string[] = sIds ? JSON.parse(sIds) : []
      const pInst: any[] = sInst ? JSON.parse(sInst) : []

      return deckCards.map((plantId, idx) => {
        let level = 0
        let statRolls: string[] = []
        let equippedItem: string | null = null

        // 1. Coincidencia por ID de instancia exacto en el slot
        if (pIds[idx]) {
          const f = pInst.find((i) => i.instanceId === pIds[idx] && isPlantMatchingTarget(i.plantId, plantId))
          if (f) {
            level = f.level ?? (f.statRolls?.length || 0)
            statRolls = f.statRolls || []
            equippedItem = f.equippedItem || null
          }
        }

        // 2. Coincidencia de respaldo por plantId
        if (statRolls.length === 0 && !equippedItem) {
          const copies = pInst.filter((i) => isPlantMatchingTarget(i.plantId, plantId))
          if (copies.length > 0) {
            copies.sort((a, b) => {
              if (Boolean(a.equippedItem) !== Boolean(b.equippedItem)) {
                return a.equippedItem ? -1 : 1
              }
              const rA = a.statRolls?.length || 0
              const rB = b.statRolls?.length || 0
              if (rA !== rB) return rB - rA
              return (b.level || 0) - (a.level || 0)
            })
            level = copies[0].level ?? (copies[0].statRolls?.length || 0)
            statRolls = copies[0].statRolls || []
            equippedItem = copies[0].equippedItem || null
          }
        }

        return {
          plantId,
          slot: idx,
          level,
          statRolls,
          equippedItem,
        }
      })
    } catch {
      return deckCards.map((plantId, idx) => ({
        plantId,
        slot: idx,
        level: 0,
        statRolls: [],
        equippedItem: null,
      }))
    }
  }, [mazosDeLaSala?.mio, matchMode, tournamentDeck, activeDeck, allCatalogCards, currentArenaAdsRun])

  const effectiveDeck = useMemo(() => {
    if (matchMode === 'tournament' && tournamentDeck && tournamentDeck.length > 0) {
      return tournamentDeck
    }
    if (mazoMioParsed && mazoMioParsed.length >= 3) {
      const roomDeck = mazoMioParsed
        .map((c) => c.plantId as PlantId)
        .filter((id) => id in PLANT_CONFIGS)
      if (roomDeck.length >= 3) {
        return roomDeck
      }
    }
    if (activeDeck && activeDeck.length > 0) {
      return activeDeck
    }
    return allCatalogCards.slice(0, 6)
  }, [matchMode, tournamentDeck, mazoMioParsed, activeDeck, allCatalogCards])

  const handleStartClanRaidBattle = useCallback(() => {
    soundManager.playSound('click', 0.8)
    prepTargetTimeRef.current = null
    setClanRaidPhase('battle')
    setPreparationPhase(false)
  }, [setPreparationPhase])

  const handleRerollClanRaidTarget = useCallback(async () => {
    if (isRerollingTarget || !currentFortressOpponent) return
    setIsRerollingTarget(true)
    setRerollError(null)
    soundManager.playSound('click', 0.4)

    try {
      const res = await supabaseService.rerollClanFortressMatch(currentFortressOpponent.targetClanId)
      if (!res.success || !res.data) {
        const rawErr = res.error || 'No se encontró otro rival disponible.'
        const friendlyMsg = rawErr.includes('ALL_FORTRESSES_UNDER_REPAIR') || rawErr.toLowerCase().includes('reparación')
          ? 'Todas las fortalezas están en reparación. Intente más tarde.'
          : rawErr
        setRerollError(friendlyMsg)
        setIsRerollingTarget(false)
        return
      }

      const newOpponent = res.data
      setCurrentFortressOpponent(newOpponent)
      prepTargetTimeRef.current = Date.now() + 120_000
      setClanRaidPrepTimer(120)
      setClanRaidPhase('prep')
      soundManager.playSound('plantation', 0.8)

      const fortressAttackSuns = newOpponent.initialAttackSuns || (500 + Math.max(0, treeLevel) * 150)

      startGame(
        Math.floor(Math.random() * 1000000),
        false,
        undefined,
        userElo,
        true,
        { mio: mazoMioParsed, rival: null },
        undefined,
        undefined,
        'auth-v2',
        treeBonusHpRef.current,
        0,
        treeSkinRef.current,
        null,
        5, // Option A: La arena de fortaleza siempre opera sobre 5 carriles
        newOpponent.layout,
        newOpponent.targetBaseHp,
        fortressAttackSuns,
        true, // isPreparationPhase
        newOpponent.ambushes,
        newOpponent.targetTreeLevel
      )
    } catch (err: any) {
      setRerollError(err?.message || 'Error al buscar otro rival')
    } finally {
      setIsRerollingTarget(false)
    }
  }, [currentFortressOpponent, isRerollingTarget, mazoMioParsed, setPreparationPhase, startGame, treeLevel, userElo])

  useEffect(() => {
    if (matchMode !== 'clan_fortress' || clanRaidPhase !== 'prep') return

    if (!prepTargetTimeRef.current) {
      prepTargetTimeRef.current = Date.now() + 120_000
    }

    const checkAndAdvanceTimer = () => {
      if (!prepTargetTimeRef.current) return
      const remainingMs = prepTargetTimeRef.current - Date.now()
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000))
      setClanRaidPrepTimer(remainingSecs)
      if (remainingSecs <= 0) {
        prepTargetTimeRef.current = null
        soundManager.playSound('click', 0.8)
        setClanRaidPhase('battle')
        setPreparationPhase(false)
      }
    }

    checkAndAdvanceTimer()
    const intervalId = setInterval(checkAndAdvanceTimer, 500)

    const handleVisibilityOrFocus = () => {
      checkAndAdvanceTimer()
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [matchMode, clanRaidPhase, setPreparationPhase])

  // ── EL REGISTRO DE ACCIONES ────────────────────────────────────────────────
  //
  // Con sala, cada plantación se manda al servidor con el TIC futuro en que debe
  // ocurrir, y se escuchan las del rival para aplicarlas en ese mismo tic. Es lo
  // que hace que las dos partidas sean la misma en lugar de dos partidas
  // paralelas contra la máquina.

  /** Número de orden de mis acciones en esta partida. Empieza en 1. */
  const ordenRef = useRef<number>(0)
  /** El id de la última acción vista, para no volver a aplicarla. */
  const ultimaAccionRef = useRef<number>(0)
  const ultimaSeqAsyncRef = useRef<number>(0)
  const aplicadasRef = useRef<Set<number>>(new Set())

  const MAX_IN_FLIGHT_ACTIONS = 3
  const inFlightCountRef = useRef(0)
  const [, setInFlightCount] = useState(0)
  const redBloqueadaRef = useRef(false)
  const [redBloqueada, setRedBloqueada] = useState(false)
  const collectingSunIdsRef = useRef<Set<string>>(new Set())
  const [collectingSunIds, setCollectingSunIds] = useState<Set<string>>(new Set())
  const outboxAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    outboxAbortRef.current = controller
    return () => {
      controller.abort()
      outboxAbortRef.current = null
    }
  }, [roomId])

  /** Helper único para TODAS las acciones PvP con outbox e idempotencia. */
  const enviarAccionAutoritativa = async (
    action: MatchActionIntent,
    callbacks: {
      onAck?: () => void
      onRejected?: (error: string) => void
    } = {}
  ) => {
    if (!roomId) return
    if (isAsyncMatch && rankedAsyncInconsistency) {
      // Partida en estado inconsistente terminal: no seguir enviando acciones
      return
    }

    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId

    // Control de capacidad concurrente sin congelar la interacción del usuario:
    // Permite que el jugador siga interactuando y colocando cartas/soles fluidamente
    // hasta un máximo razonable de acciones simultáneas en vuelo (3).
    const bloqueaRed = action.kind === 'plant' || action.kind === 'dig'
    if (bloqueaRed) {
      inFlightCountRef.current += 1
      setInFlightCount(inFlightCountRef.current)
      const saturado = inFlightCountRef.current >= MAX_IN_FLIGHT_ACTIONS
      redBloqueadaRef.current = saturado
      setRedBloqueada(saturado)
    }

    const result = await MatchActionOutbox.deliver(
      roomId,
      action,
      outboxAbortRef.current?.signal
    )

    if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) {
      return
    }

    if (result.status === 'ack') {
      callbacks.onAck?.()
    } else if (result.status === 'rejected') {
      callbacks.onRejected?.(result.error)
    }

    // cancelled ocurre al desmontar; no hay que tocar un motor que ya no existe.
    if (result.status !== 'cancelled' && bloqueaRed) {
      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1)
      setInFlightCount(inFlightCountRef.current)
      const saturado = inFlightCountRef.current >= MAX_IN_FLIGHT_ACTIONS
      redBloqueadaRef.current = saturado
      setRedBloqueada(saturado)
    }
  }

  /**
   * DIAGNÓSTICO DEL PVP
   */
  const [diag, setDiag] = useState<{
    enviadas: number
    recibidas: number
    ultimoEnvio: string
    canal: string
    enSala: number
    misEnSala: number
    huellas: number
  }>({ enviadas: 0, recibidas: 0, ultimoEnvio: '—', canal: 'conectando…', enSala: 0, misEnSala: 0, huellas: 0 })

  const registrarPlantacion = (
    carta: PlantId,
    lane: number,
    col: number,
    enTic: number,
    slot: number,
    seq?: number
  ) => {
    if (!roomId) return
    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId
    const seqAccion = typeof seq === 'number' && Number.isFinite(seq) ? seq : ++ordenRef.current
    void enviarAccionAutoritativa(
      {
        seq: seqAccion,
        tick: enTic,
        issuedTick: enTic - MARGEN_DE_RED_TICS,
        kind: 'plant',
        plantId: carta,
        lane,
        col,
        slot,
      },
      {
        onRejected: (error) => {
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          descartarAccionPropia(enTic, lane, col, seqAccion, capturedGeneration)
          setDiag((d) => ({
            ...d,
            ultimoEnvio: `✗ ${error}`,
          }))
        },
        onAck: () => {
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          confirmarAccionP1(seqAccion, capturedGeneration)
          setDiag((d) => ({
            ...d,
            enviadas: d.enviadas + 1,
            ultimoEnvio: `✓ ${carta} [slot ${slot}] @tic ${enTic}`,
          }))
        },
      }
    )
  }

  const registrarExcavacion = (lane: number, col: number, enTic: number, seq?: number) => {
    if (!roomId) return
    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId
    const seqAccion = typeof seq === 'number' && Number.isFinite(seq) ? seq : ++ordenRef.current
    void enviarAccionAutoritativa(
      {
        seq: seqAccion,
        tick: enTic,
        issuedTick: enTic - MARGEN_DE_RED_TICS,
        kind: 'dig',
        lane,
        col,
      },
      {
        onRejected: (error) => {
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          descartarAccionPropia(enTic, lane, col, seqAccion, capturedGeneration)
          setDiag((d) => ({
            ...d,
            ultimoEnvio: `✗ ${error}`,
          }))
        },
        onAck: () => {
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          confirmarAccionP1(seqAccion, capturedGeneration)
          setDiag((d) => ({
            ...d,
            enviadas: d.enviadas + 1,
            ultimoEnvio: `✓ pico @tic ${enTic}`,
          }))
        },
      }
    )
  }

  const recogerSolAutorizado = (sunId: string) => {
    // PvE/práctica: no hay árbitro remoto.
    if (!roomId) {
      collectSun(sunId)
      return
    }

    if (isAsyncMatch && rankedAsyncInconsistency) return

    // Si ya estamos recolectando este sol, ignorar clics repetidos sobre el mismo
    if (collectingSunIdsRef.current.has(sunId)) return

    // Sólo observa el tic y confirma que el sol existe. NO suma economía todavía.
    const issuedTick = prepararRecogidaSol(sunId)
    if (issuedTick === null) return

    // Feedback visual y auditivo inmediato (0ms de latencia)
    collectingSunIdsRef.current.add(sunId)
    setCollectingSunIds(new Set(collectingSunIdsRef.current))
    soundManager.playSound('points', 0.6)

    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId
    const seqAccion = ++ordenRef.current

    void enviarAccionAutoritativa(
      {
        seq: seqAccion,
        tick: issuedTick,
        issuedTick,
        kind: 'collect',
        targetId: sunId,
        lane: null,
        col: null,
        slot: null,
      },
      {
        onAck: () => {
          collectingSunIdsRef.current.delete(sunId)
          setCollectingSunIds(new Set(collectingSunIdsRef.current))
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          // Registra la acción autoritativa con el seq inmutable capturado al enviarla (silent: true para no duplicar sonido)
          confirmarRecogidaSol(sunId, issuedTick, seqAccion, capturedGeneration, true)
          setDiag((d) => ({
            ...d,
            enviadas: d.enviadas + 1,
            ultimoEnvio: `✓ sol @tic ${issuedTick}`,
          }))
        },
        onRejected: (error) => {
          collectingSunIdsRef.current.delete(sunId)
          setCollectingSunIds(new Set(collectingSunIdsRef.current))
          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
          // No hay rollback: todavía NO habíamos sumado este sol.
          setDiag((d) => ({
            ...d,
            ultimoEnvio: `✗ sol: ${error}`,
          }))
        },
      }
    )
  }

  useEffect(() => {
    if (!roomId || !currentUserId || isAsyncMatch) return

    /** Aplica una acción del rival; las propias ya están plantadas en local. */
    const aplicar = (a: {
      id: number
      user_id: string
      seq?: number
      tick: number
      issued_tick?: number | null
      kind: string
      plant_id: string | null
      lane: number | null
      col: number | null
      slot?: number | null
      target_id?: string | null
    }) => {
      if (a.user_id === currentUserId) return
      // Realtime puede entregar el mismo mensaje dos veces, y la recuperación por
      // match_actions_since puede solaparse con él. Sin esto, la planta del rival
      // aparecería duplicada.
      if (aplicadasRef.current.has(a.id)) return
      aplicadasRef.current.add(a.id)
      if (a.id > ultimaAccionRef.current) ultimaAccionRef.current = a.id

      // Los soles son economía local del rival; se guardan para el árbitro, pero no
      // modifican nuestra simulación remota.
      if (a.kind === 'collect') return

      // El pico del rival. Antes se descartaba aquí —sólo se miraba 'plant'— así
      // que su planta excavada seguía en pie en tu pantalla: dos partidas
      // distintas desde ese momento.
      if (a.kind === 'dig') {
        setDiag((d) => ({ ...d, recibidas: d.recibidas + 1 }))
        encolarAccionDelRival({
          // El identificador del servidor viaja al registro de jugadas: es lo que
          // ordena igual en las dos pantallas dos jugadas del mismo tic.
          id: a.id,
          tick: a.tick,
          kind: 'dig',
          lane: a.lane ?? 0,
          col: a.col ?? 0,
        })
        return
      }

      if (a.kind !== 'plant' || !a.plant_id || a.lane === null) return
      setDiag((d) => ({ ...d, recibidas: d.recibidas + 1 }))
      encolarAccionDelRival({
        id: a.id,
        tick: a.tick,
        kind: 'plant',
        plantId: a.plant_id as PlantId,
        lane: a.lane,
        col: a.col ?? undefined,
        slot: a.slot,
      })
    }

    const dejarDeEscuchar = battleService.subscribeToMatchActions(roomId, aplicar, (estado) => {
      setDiag((d) => ({ ...d, canal: estado }))
    })

    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId

    // Red de seguridad: al entrar se recoge lo que ya hubiera, y periódicamente se
    // comprueba si se perdió algún mensaje. Sin esto, una sola acción perdida
    // dejaría las dos partidas divergentes hasta el final.
    let recuperando = false
    let timerRecuperar: ReturnType<typeof setTimeout> | null = null

    const programarRecuperar = () => {
      if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
      timerRecuperar = setTimeout(async () => {
        if (!recuperando) {
          recuperando = true
          try {
            await recuperar()
          } finally {
            recuperando = false
            programarRecuperar()
          }
        }
      }, 3000)
    }

    const recuperar = async () => {
      if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
      // Consulta incremental eficiente: solicita únicamente acciones posteriores a la última conocida
      const desdeId = ultimaAccionRef.current
      const nuevas = await battleService.matchActionsSince(capturedRoomId, desdeId)
      if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
      if (nuevas.length > 0) {
        setDiag((d) => ({
          ...d,
          enSala: d.enSala + nuevas.length,
          misEnSala: d.misEnSala + nuevas.filter((a) => a.userId === currentUserId).length,
        }))
        const pendientes = nuevas.filter((a) => a.id > ultimaAccionRef.current)
        for (const a of pendientes) {
          aplicar({
            id: a.id,
            user_id: a.userId,
            seq: a.seq,
            tick: a.tick,
            issued_tick: a.issuedTick,
            kind: a.kind,
            plant_id: a.plantId,
            lane: a.lane,
            col: a.col,
            slot: a.slot,
            target_id: a.targetId,
          })
        }
      }
    }
    void recuperar()
    programarRecuperar()

    return () => {
      dejarDeEscuchar()
      if (timerRecuperar) clearTimeout(timerRecuperar)
    }
  }, [roomId, currentUserId, encolarAccionDelRival, isAsyncMatch, sessionGeneration])

  // ── FEED DE INTENCIONES ASÍNCRONAS (RIVAL SEMILLA RANKED) ──────────────────
  // En lugar de saturar PostgreSQL con peticiones en paralelo sobrecargadas,
  // se utiliza un ciclo adaptativo con protección in-flight que evita apilamiento.
  useEffect(() => {
    if (!roomId || !isAsyncMatch || gameStatus !== 'playing') return
    ultimaSeqAsyncRef.current = 0
    let cancelado = false
    let enVuelo = false
    let timerId: ReturnType<typeof setTimeout> | null = null
    const capturedRoomId = roomId

    const programarSiguiente = (delayMs: number) => {
      if (cancelado || gameStatusRef.current !== 'playing') return
      timerId = setTimeout(() => {
        void refrescarIntencionesAsync()
      }, delayMs)
    }

    const refrescarIntencionesAsync = async () => {
      if (cancelado || enVuelo || capturedRoomId !== roomIdRef.current || gameStatusRef.current !== 'playing') return
      const requestGeneration = sessionGenerationRef.current
      enVuelo = true
      let nextDelayMs = 450

      try {
        const res = await battleService.pollRankedAsyncIntents(
          capturedRoomId,
          ultimaSeqAsyncRef.current
        )
        if (
          cancelado ||
          requestGeneration !== sessionGenerationRef.current ||
          capturedRoomId !== roomIdRef.current ||
          gameStatusRef.current !== 'playing'
        ) return

        // Si la sala ya terminó o fue liquidada en el servidor, detenemos el ciclo de sondeo de inmediato
        if (res && (res.ended || res.error === 'MATCH_NOT_PLAYING')) {
          cancelado = true
          return
        }

        // A) Error de red / transporte / res inexistente / res.ok === false -> Reintentar en el siguiente ciclo sin marcar corrupción
        if (res && res.ok !== false) {
          // B) res.ok === true pero res.intents no es array o intenciones malformadas -> PROTOCOL_INCONSISTENCY / INVALID_ASYNC_PLAN
          const resultado = incorporarIntencionesAsync(res.intents, requestGeneration)
          if (resultado.ok && typeof resultado.maxAcceptedSeq === 'number') {
            ultimaSeqAsyncRef.current = Math.max(
              ultimaSeqAsyncRef.current,
              resultado.maxAcceptedSeq
            )
          }

          // Adaptación dinámica de sondeo según la holgura autorizada por el servidor
          if (typeof res.maxRevealedTick === 'number' && typeof res.serverTick === 'number') {
            const holgura = res.maxRevealedTick - res.serverTick
            if (holgura > 30) {
              nextDelayMs = 800
            } else if (holgura > 18) {
              nextDelayMs = 500
            }
          }
        } else {
          nextDelayMs = 600
        }
      } catch {
        nextDelayMs = 600
      } finally {
        enVuelo = false
        if (!cancelado && gameStatusRef.current === 'playing') {
          programarSiguiente(nextDelayMs)
        }
      }
    }

    void refrescarIntencionesAsync()

    return () => {
      cancelado = true
      if (timerId) clearTimeout(timerId)
    }
  }, [roomId, isAsyncMatch, sessionGeneration, incorporarIntencionesAsync])

  // ── EL FINAL LLEGA A LOS DOS LADOS ─────────────────────────────────────────
  //
  // Si el rival se rinde o pierde, el servidor liquida la sala. Sin esto tú te
  // quedabas jugando contra un campo vacío sin saber que ya habías ganado: el
  // resultado existía en la base y en su pantalla, pero no en la tuya.
  useEffect(() => {
    if (!roomId || !currentUserId || isAsyncMatch) return
    let cerrado = false
    let comprobando = false
    let timerComprobar: ReturnType<typeof setTimeout> | null = null
    const capturedGeneration = sessionGenerationRef.current
    const capturedRoomId = roomId

    const programarComprobar = () => {
      if (cerrado) return
      timerComprobar = setTimeout(async () => {
        if (!comprobando && !cerrado) {
          comprobando = true
          try {
            await comprobar()
          } finally {
            comprobando = false
            programarComprobar()
          }
        }
      }, 4000)
    }

    const comprobar = async () => {
      if (cerrado || capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) return
      const r = await battleService.roomResult(capturedRoomId)
      if (cerrado || capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current || !r || !r.ended) return
      cerrado = true

      setResultadoServidor({
        success: true,
        status: r.noWinner ? 'empate_verificado' : 'liquidada',
        payout: 0,
      })
      // Sin ganador (empate o abandono sin reportes) se muestra como derrota
      // pero sin premio: el aviso de arriba explica que no se repartió nada.
      terminarPorOrdenDelServidor(r.iWon ? 'victory' : 'defeat')
    }

    const dejarDeEscuchar = battleService.subscribeToRoomEnd(capturedRoomId, () => { void comprobar() })
    programarComprobar()

    return () => {
      cerrado = true
      if (timerComprobar) clearTimeout(timerComprobar)
      dejarDeEscuchar()
    }
  }, [roomId, currentUserId, terminarPorOrdenDelServidor, sessionGeneration, isAsyncMatch])

  // ── AVISO AL CERRAR EL NAVEGADOR ───────────────────────────────────────────
  //
  // Cerrar la pestaña a mitad de un duelo real cuenta como abandono: el rival
  // acaba ganando por el barrido del servidor. Conviene avisar antes.
  //
  // El navegador NO deja poner un texto propio (se ignora desde hace años por
  // abuso), así que enseña su mensaje genérico. Lo que importa es que pregunte.
  useEffect(() => {
    if (!roomId) return
    if (gameStatus !== 'playing') return

    const alCerrar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // returnValue sigue haciendo falta para navegadores antiguos.
      e.returnValue = 'Si sales ahora pierdes el duelo.'
      return e.returnValue
    }
    window.addEventListener('beforeunload', alCerrar)
    return () => window.removeEventListener('beforeunload', alCerrar)
  }, [roomId, gameStatus])

  const hasHandledEndRef = useRef<boolean>(false)

  useEffect(() => {
    if (hasHandledEndRef.current) return

    if (gameStatus === 'victory' || gameStatus === 'defeat') {
      hasHandledEndRef.current = true

      // Detener la música de batalla inmediatamente.
      soundManager.stopBgm()

      // Disparar Pageview Virtual en GA4 y actualizar URL a /play/game-over para redes de anuncios (Ads)
      trackGameOver({
        outcome: gameStatus === 'victory' ? 'victory' : 'defeat',
        matchMode,
        roomId,
      })

      // ── PARTIDA REAL: LO LIQUIDA EL SERVIDOR ───────────────────────────────
      //
      // Con sala, quien reparte ELO, cofres y gemas es report_match_result, y
      // exige que AMBOS jugadores reporten el mismo ganador. Si no coinciden, no
      // cobra nadie. El cliente no calcula nada: sólo dice lo que vio.
      //
      // Se reporta tanto al ganar como al perder — hace falta el reporte de los
      // dos para que se liquide, así que callarse al perder dejaría al rival sin
      // su premio.
      if (roomId && (opponentId || isAsyncMatch) && currentUserId) {
        const capturedGeneration = sessionGenerationRef.current
        const capturedRoomId = roomId
        const ganadorQueVioMiCliente: string | null =
          gameStatus === 'victory'
            ? currentUserId
            : gameStatus === 'defeat'
            ? (opponentId ?? null)
            : null

        setResultadoServidor({ success: true, status: 'verificando' })

        void (async () => {
          let reportRes:
            | {
                success: boolean
                status?: string
                payout?: number
                eloGained?: number
                eloLost?: number
                eloAfter?: number
                winner?: string
                elo?: any
                error?: string
              }
            | undefined

          reportRes = await battleService.reportMatchResult(capturedRoomId, ganadorQueVioMiCliente)

          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) {
            return
          }

          // Si el reporte ya liquidó directamente en la DB (éramos el segundo en reportar o la sala ya cerró):
          if (reportRes && (reportRes.status === 'liquidada' || reportRes.status === 'ya_liquidada')) {
            const yoGane = reportRes.winner ? reportRes.winner === currentUserId : gameStatus === 'victory'
            const rawElo = reportRes.elo
            const eloDelta = yoGane
              ? (typeof reportRes.eloGained === 'number' ? reportRes.eloGained : (rawElo ? (soyP1 ? rawElo.p1Delta : rawElo.p2Delta) : undefined))
              : (typeof reportRes.eloLost === 'number' ? -reportRes.eloLost : (rawElo ? (soyP1 ? rawElo.p1Delta : rawElo.p2Delta) : undefined))
            const eloAfter = typeof reportRes.eloAfter === 'number'
              ? reportRes.eloAfter
              : (rawElo ? (soyP1 ? rawElo.p1After : rawElo.p2After) : undefined)
            const eloGained = yoGane ? (eloDelta && eloDelta > 0 ? eloDelta : reportRes.eloGained) : undefined
            const eloLost = !yoGane ? (eloDelta && eloDelta < 0 ? Math.abs(eloDelta) : reportRes.eloLost) : undefined

            setResultadoServidor({
              success: true,
              status: 'liquidada',
              eloBefore: rawElo ? (soyP1 ? rawElo.p1Before : rawElo.p2Before) : undefined,
              opponentElo: rawElo ? (soyP1 ? rawElo.p2Before : rawElo.p1Before) : undefined,
              eloDelta,
              eloAfter,
              eloGained,
              eloLost,
              payout: reportRes.payout ?? 0,
              vipGoldBonus: (reportRes as any)?.vipGoldBonus,
            })

            if (typeof eloAfter === 'number' && onServerEloUpdated && matchMode !== 'tournament' && matchMode !== 'friendly') {
              onServerEloUpdated(eloAfter)
            }

            if (yoGane && onBattleComplete && matchMode !== 'tournament' && matchMode !== 'friendly') {
              try {
                const res = await onBattleComplete(true)
                if (res) {
                  setBattleSummaryResult((prev) => ({
                    ...prev,
                    packResult: res.packResult,
                    vipGoldBonus: prev?.vipGoldBonus ?? res.vipGoldBonus ?? (reportRes as any)?.vipGoldBonus,
                  }))
                }
              } catch (e) {
                console.warn('[Battlefield] Error obteniendo pack de victoria:', e)
              }
            }

            terminarPorOrdenDelServidor(yoGane ? 'victory' : 'defeat')
            return
          }

          const verificacion = await battleService.verifyMatch(capturedRoomId, ganadorQueVioMiCliente)

          if (capturedGeneration !== sessionGenerationRef.current || capturedRoomId !== roomIdRef.current) {
            return
          }

          const liq = resolverLiquidacionPartida({
            isAsyncMatch,
            soyP1,
            currentUserId,
            serverVerification: verificacion,
          })

          if (isAsyncMatch && liq.statusServidor === 'revision_servidor' && gameStatus === 'victory') {
            liq.statusServidor = 'liquidada'
            liq.resultadoFinal = 'victory'
            liq.mostrarResultado = true
          }

          const finalPayout =
            typeof liq.payout === 'number' && liq.payout > 0
              ? liq.payout
              : (liq.resultadoFinal === 'victory' && typeof reportRes?.payout === 'number' && reportRes.payout > 0)
                ? reportRes.payout
                : 0

          setResultadoServidor({
            success: liq.statusServidor === 'liquidada' || liq.statusServidor === 'empate_verificado' || liq.statusServidor === 'verificacion_pendiente',
            status: liq.statusServidor,
            resultadoFinal: liq.resultadoFinal,
            eloBefore: liq.eloBefore,
            opponentElo: liq.opponentElo,
            eloDelta: liq.eloDelta,
            eloAfter: liq.eloAfter,
            eloGained: liq.eloGained,
            eloLost: liq.eloLost,
            payout: finalPayout,
            vipGoldBonus: verificacion.settlement?.vipGoldBonus ?? (reportRes as any)?.vipGoldBonus,
            error: liq.error,
          })

          if (liq.statusServidor === 'liquidada' && typeof liq.eloAfter === 'number' && onServerEloUpdated && matchMode !== 'tournament' && matchMode !== 'friendly') {
            onServerEloUpdated(liq.eloAfter)
          }

          if (liq.statusServidor === 'liquidada' && liq.resultadoFinal === 'victory' && onBattleComplete && matchMode !== 'tournament' && matchMode !== 'friendly') {
            try {
              const res = await onBattleComplete(true)
              if (res) {
                setBattleSummaryResult((prev) => ({
                  ...prev,
                  packResult: res.packResult,
                  vipGoldBonus: prev?.vipGoldBonus ?? res.vipGoldBonus ?? verificacion.settlement?.vipGoldBonus ?? (reportRes as any)?.vipGoldBonus,
                }))
              }
            } catch (e) {
              console.warn('[Battlefield] Error obteniendo pack de victoria:', e)
            }
          }

          if (liq.mostrarResultado && (liq.resultadoFinal === 'victory' || liq.resultadoFinal === 'defeat')) {
            terminarPorOrdenDelServidor(liq.resultadoFinal)
          }
        })()
      }

      // Handle Colosseum match resolution
      if (!roomId && matchMode === 'colosseum' && onColosseumComplete) {
        const coloRes = onColosseumComplete(gameStatus === 'victory')
        setColosseumResult(coloRes)
      }

      // Handle Tournament match resolution
      if (matchMode === 'tournament') {
        const tourneyId = tournamentOpponent?.tournamentId || 'tourney_official_1'
        const oppName = tournamentOpponent?.name || 'Rival de Torneo'
        const isVictory = gameStatus === 'victory'

        if (!roomId) {
          // Partida sin sala (offline/fallback): liquidar mediante RPC submit_tournament_match_result
          void tournamentService.submitMatchResult(tourneyId, isVictory, oppName).then((res) => {
            if (res.success && res.wins !== undefined && res.losses !== undefined) {
              setTournamentResult((prev) => {
                const base = prev || TournamentManager.getSession(tourneyId) || {
                  tournamentId: tourneyId,
                  tournamentName: 'Torneo',
                  registered: true,
                  startTimeMs: 0,
                  endTimeMs: 0,
                  userWins: 0,
                  userLosses: 0,
                  maxLosses: 3,
                  isEliminated: false,
                  leaderboard: [],
                }
                return {
                  ...base,
                  userWins: res.wins ?? base.userWins,
                  userLosses: res.losses ?? base.userLosses,
                  isEliminated: Boolean(res.is_eliminated),
                }
              })
            }
          })

          const resolved = TournamentManager.resolveMatch(tourneyId, isVictory)
          if (resolved) {
            setTournamentResult(resolved)
          }
        } else {
          // Partida multijugador con sala: el servidor (_settle_room) ya liquidó e incrementó
          // victorias/derrotas de forma autoritativa. Obtenemos el registro actualizado sin doble conteo.
          void tournamentService.getTournamentDetails(tourneyId).then((details) => {
            if (details?.my_participation) {
              const p = details.my_participation
              setTournamentResult((prev) => {
                const base = prev || TournamentManager.getSession(tourneyId) || {
                  tournamentId: tourneyId,
                  tournamentName: details.tournament?.title || 'Torneo',
                  registered: true,
                  startTimeMs: 0,
                  endTimeMs: 0,
                  userWins: 0,
                  userLosses: 0,
                  maxLosses: 3,
                  isEliminated: false,
                  leaderboard: [],
                }
                return {
                  ...base,
                  userWins: p.wins ?? base.userWins,
                  userLosses: p.losses ?? base.userLosses,
                  isEliminated: Boolean(p.is_eliminated),
                }
              })
            }
          })
        }
      }

      if (matchMode === 'clan_fortress' && (currentFortressOpponent || clanFortressConfig?.targetClan)) {
        const target = currentFortressOpponent || clanFortressConfig!.targetClan
        const isVic = gameStatus === 'victory'
        const maxHp = target.targetMaxBaseHp || 1000
        const curHp = Math.max(0, p2BaseHp)
        const damageDealt = Math.max(0, maxHp - curHp)
        const damagePct = (damageDealt / maxHp) * 100

        let starsEarned = 0
        if (curHp <= 0 || isVic) {
          starsEarned = 3
        } else if (damagePct >= 50) {
          starsEarned = 2
        } else if (damagePct >= 20) {
          starsEarned = 1
        }

        void supabaseService.settleClanFortressRaid(target.targetClanId, damageDealt, starsEarned).then((res) => {
          if (res.success && res.data) {
            setClanRaidResult(res.data)
            if (onClanFortressComplete) {
              onClanFortressComplete(res.data)
            }
          }
        })
      }

      if (matchMode === 'arena_ads') {
        const run = currentArenaAdsRun || ArenaAdsManager.getStoredRun()
        if (gameStatus === 'victory') {
          if (run) {
            const updated = ArenaAdsManager.completeLevelVictory(run)
            setCurrentArenaAdsRun(updated)
            setArenaAdsModalMode('victory')
            setShowArenaAdsInterstitial(true)

            const runStarted = updated.startedAt || updated.createdAt
            const playtimeSeconds = runStarted
              ? Math.max(1, Math.round((Date.now() - runStarted) / 1000))
              : 60
            void arenaAdsService.recordRun({
              level: updated.level,
              playtimeSeconds,
              spentGems: updated.paymentType === 'gems',
              gemsSpent: (updated.paymentType === 'gems' ? 200 : 0) + ((updated.reviveCount || 0) * 150),
              revived: (updated.reviveCount || 0) > 0,
              reviveCount: updated.reviveCount || 0,
              totalRewards: {
                gold: (updated.accumulatedRewards.gold || 0) * (updated.multiplier || 1),
                gems: (updated.accumulatedRewards.gems || 0) * (updated.multiplier || 1),
                items: updated.accumulatedRewards.items || {},
              },
              status: 'active',
            }).catch((err) => console.warn('[Battlefield] Error al registrar run en victoria:', err))
          }
        } else if (gameStatus === 'defeat') {
          if (run) {
            run.status = 'game_over'
            ArenaAdsManager.saveRun(run)
            setCurrentArenaAdsRun(run)
            setArenaAdsModalMode('defeat')
            setShowArenaAdsInterstitial(true)

            const runStarted = run.startedAt || run.createdAt
            const playtimeSeconds = runStarted
              ? Math.max(1, Math.round((Date.now() - runStarted) / 1000))
              : 60
            void arenaAdsService.recordRun({
              level: run.level,
              playtimeSeconds,
              spentGems: run.paymentType === 'gems',
              gemsSpent: (run.paymentType === 'gems' ? 200 : 0) + ((run.reviveCount || 0) * 150),
              revived: (run.reviveCount || 0) > 0,
              reviveCount: run.reviveCount || 0,
              totalRewards: {
                gold: (run.accumulatedRewards.gold || 0) * (run.multiplier || 1),
                gems: (run.accumulatedRewards.gems || 0) * (run.multiplier || 1),
                items: run.accumulatedRewards.items || {},
              },
              status: 'completed',
            }).catch((err) => console.warn('[Battlefield] Error al registrar run en derrota:', err))
          }
        }
      }

      // Partida local sin roomId = entrenamiento / bot / PvE (el cliente calcula ELO local y sobre).
      // Partida con roomId = el servidor liquida autoritativamente arriba; no ejecutar aquí para no duplicar ni otorgar sobres en derrotas.
      if (!roomId) {
        if (gameStatus === 'victory') {
          if (onBattleComplete && matchMode !== 'strategic_test' && matchMode !== 'tournament' && matchMode !== 'friendly' && matchMode !== 'clan_fortress' && matchMode !== 'arena_ads') {
            void (async () => {
              const res = await onBattleComplete(true)
              if (res) {
                setBattleSummaryResult((prev) => ({
                  ...prev,
                  eloChange: prev?.eloChange ?? res.winElo,
                  newElo: prev?.newElo ?? res.newElo,
                  packResult: res.packResult,
                  vipGoldBonus: res.vipGoldBonus,
                }))
              }
            })()
          }
        } else if (gameStatus === 'defeat') {
          if (onBattleComplete && matchMode !== 'strategic_test' && matchMode !== 'tournament' && matchMode !== 'friendly' && matchMode !== 'clan_fortress' && matchMode !== 'arena_ads') {
            void (async () => {
              const res = await onBattleComplete(false)
              if (res) {
                setBattleSummaryResult((prev) => ({
                  ...prev,
                  eloChange: prev?.eloChange ?? -(res.loseElo || 8),
                  newElo: prev?.newElo ?? res.newElo,
                }))
              }
            })()
          }
        }
      }
    }
  }, [gameStatus, onBattleComplete, onServerEloUpdated, matchMode, onColosseumComplete, roomId, opponentId, currentUserId, tournamentOpponent?.tournamentId, terminarPorOrdenDelServidor, isAsyncMatch, soyP1, currentFortressOpponent])

  useEffect(() => {
    if (practicePlantId) {
      startPracticeGame(practicePlantId)
      if (practicePlantId in PLANT_CONFIGS) {
        setSelectedCard(practicePlantId as PlantId)
      }
    } else if (matchMode === 'strategic_test' && strategicPlaytestConfig) {
      startStrategicPlaytestGame(strategicPlaytestConfig, activeDeck)
    } else if (
      matchMode === 'clan_fortress' &&
      !hasClanFortressStartedRef.current &&
      (currentFortressOpponent || clanFortressConfig?.targetClan)
    ) {
      hasClanFortressStartedRef.current = true
      const opp = currentFortressOpponent || clanFortressConfig!.targetClan
      const fortressAttackSuns = opp.initialAttackSuns || (500 + Math.max(0, treeLevel) * 150)
      startGame(
        seed || Math.floor(Math.random() * 1000000),
        false,
        undefined,
        userElo,
        true,
        { mio: mazoMioParsed, rival: null },
        undefined,
        undefined,
        'auth-v2',
        treeBonusHpRef.current,
        0,
        treeSkinRef.current,
        null,
        5, // Option A: La arena de fortaleza siempre opera sobre 5 carriles
        opp.layout,
        opp.targetBaseHp,
        fortressAttackSuns,
        true, // isPreparationPhase = true
        opp.ambushes,
        opp.targetTreeLevel
      )
      prepTargetTimeRef.current = Date.now() + 120_000
      setClanRaidPhase('prep')
      setClanRaidPrepTimer(120)
    } else if (gameStatus === 'ready') {
      hasHandledEndRef.current = false

      if (roomId) {
        // Con sala real (Ranked PvP / Rival Semilla), la partida exige reloj autoritativo.
        // Fail-closed: si el reloj falla o no está disponible, no se arranca desalineada.
        syncAndStartMatchClock(roomId)
      } else {
        // Entrenamiento contra el bot local o Mazmorra Arena ADS
        if (matchMode === 'arena_ads' && currentArenaAdsRun) {
          const adsBotStats = getBotStatsForLevel(currentArenaAdsRun.level)
          const rivalBonusHp = Math.max(0, adsBotStats.botBaseHp - 1000)
          startGame(
            seed,
            false,
            undefined,
            adsBotStats.botElo,
            undefined,
            { mio: mazoMioParsed, rival: adsBotStats.botDeck },
            undefined,
            undefined,
            'auth-v2',
            treeBonusHpRef.current,
            rivalBonusHp,
            treeSkinRef.current,
            rivalTreeSkinRef.current
          )
        } else {
          startGame(
            seed,
            false,
            undefined,
            userElo,
            undefined,
            mazoMioParsed ? { mio: mazoMioParsed, rival: null } : undefined,
            undefined,
            undefined,
            undefined,
            treeBonusHpRef.current,
            rivalTreeBonusHpRef.current,
            treeSkinRef.current,
            rivalTreeSkinRef.current
          )
        }
      }
    }
  }, [practicePlantId, seed, roomId, startGame, startPracticeGame, startStrategicPlaytestGame, setSelectedCard, gameStatus, userElo, syncAndStartMatchClock, matchMode, strategicPlaytestConfig, activeDeck, mazoMioParsed, treeLevel, currentArenaAdsRun])

  /**
   * LA HUELLA DEL TABLERO
   *
   * Cada diez segundos, un resumen de la partida al servidor. El servidor compara
   * las dos huellas del mismo tic; si no coinciden, se sabe EN QUÉ TIC se
   * separaron las dos pantallas.
   *
   * Esto no decide quién gana: es un detector. Antes, cuando las dos pantallas se
   * separaban, lo único que llegaba era el «tu rival dijo otra cosa» al final —
   * cuando ya no se puede averiguar nada. Con esto queda el sitio exacto.
   *
   * Sólo en partidas con sala y PvP humano: contra bot o Rival Semilla no hay nada que comparar.
   */
  useEffect(() => {
    if (!roomId || isAsyncMatch) return
    const pendientes = tomarHuellasPendientes()
    if (pendientes.length === 0) return
    for (const h of pendientes) {
      void battleService.submitMatchCheckpoint(roomId, h.tick, h.huella)
    }
    setDiag((d) => ({ ...d, huellas: d.huellas + pendientes.length }))
  }, [tick, roomId, tomarHuellasPendientes, isAsyncMatch])

  const [showSurrenderModal, setShowSurrenderModal] = useState<boolean>(false)

  const handleSurrenderClick = () => {
    soundManager.playSound('click', 0.5)
    setShowSurrenderModal(true)
  }

  const handleConfirmSurrender = () => {
    soundManager.stopBgm()

    setShowSurrenderModal(false)
    hasHandledEndRef.current = true
    surrenderGame()

    if (matchMode === 'arena_ads') {
      ArenaAdsManager.clearRun()
      setCurrentArenaAdsRun(null)
      if (onBackToMenu) {
        onBackToMenu()
      }
      return
    }

    // En una partida real, rendirse lo registra el servidor: declara ganador al
    // rival y aplica el ELO. Antes esto no salía del navegador — el cliente
    // restaba 8 puntos en su propio estado, que no se guarda, así que al recargar
    // volvía el ELO de antes; y el rival se quedaba esperando un reporte que no
    // llegaba nunca.
    if (roomId) {
      void battleService.surrenderMatch(roomId).then((r: any) => {
        setResultadoServidor(r)
        if (r && typeof r.eloAfter === 'number' && onServerEloUpdated) {
          onServerEloUpdated(r.eloAfter)
        }
      })
      return
    }

    // Ranked sin sala es entrenamiento contra bot.
    // Rendirse aquí tampoco debe modificar ELO local.
    if (matchMode === 'ranked') {
      setBattleSummaryResult(null)
      return
    }

    if (onSurrender) {
      const res = onSurrender()
      if (res) {
        setBattleSummaryResult({
          eloChange: -(res.surrenderElo || 8),
          newElo: res.newElo,
          isSurrendered: true,
        })
      }
    }
  }

  const handlePlayAgain = async () => {
    soundManager.stopBgm()

    hasHandledEndRef.current = false
    setResultadoServidor(null)
    setBattleSummaryResult(null)
    setColosseumResult(null)
    setTournamentResult(null)
    setClanRaidResult(null)

    // ============================================================
    // MODO ASALTO A FORTALEZA DE CLAN (clan_fortress)
    // Busca automáticamente un nuevo objetivo y entra en fase de preparación (120s)
    // ============================================================
    if (matchMode === 'clan_fortress') {
      setIsRerollingTarget(true)
      setRerollError(null)
      soundManager.playSound('click', 0.4)

      try {
        const res = await supabaseService.searchClanFortressMatch()
        if (!res.success || !res.data) {
          const rawErr = res.error || 'No se encontró otra fortaleza disponible.'
          const friendlyMsg = rawErr.includes('ALL_FORTRESSES_UNDER_REPAIR') || rawErr.toLowerCase().includes('reparación')
            ? 'Todas las fortalezas están en reparación. Intente más tarde.'
            : rawErr
          alert(friendlyMsg)
          if (onBackToMenu) {
            soundManager.playBgm('menu')
            onBackToMenu()
          }
          return
        }

        const newOpponent = res.data
        setCurrentFortressOpponent(newOpponent)
        prepTargetTimeRef.current = Date.now() + 120_000
        setClanRaidPrepTimer(120)
        setClanRaidPhase('prep')
        setPreparationPhase(true)
        soundManager.playSound('plantation', 0.8)
        soundManager.playBgm('battle')

        const fortressAttackSuns = newOpponent.initialAttackSuns || (500 + Math.max(0, treeLevel) * 150)

        startGame(
          Math.floor(Math.random() * 1000000),
          false,
          undefined,
          userElo,
          true,
          { mio: mazoMioParsed, rival: null },
          undefined,
          undefined,
          'auth-v2',
          treeBonusHpRef.current,
          0,
          treeSkinRef.current,
          null,
          5, // Option A: La arena de fortaleza siempre opera sobre 5 carriles
          newOpponent.layout,
          newOpponent.targetBaseHp,
          fortressAttackSuns,
          true, // isPreparationPhase = true
          newOpponent.ambushes,
          newOpponent.targetTreeLevel
        )
      } catch (err: any) {
        alert(err?.message || 'Error al buscar otra fortaleza.')
        if (onBackToMenu) {
          soundManager.playBgm('menu')
          onBackToMenu()
        }
      } finally {
        setIsRerollingTarget(false)
      }
      return
    }

    if (matchMode === 'arena_ads') {
      soundManager.playBgm('menu')
      if (gameStatus === 'victory') {
        const run = currentArenaAdsRun || ArenaAdsManager.getStoredRun()
        if (run && onArenaAdsAdvance) {
          const nextRun = ArenaAdsManager.advanceToNextLevel(run)
          onArenaAdsAdvance(nextRun)
          return
        }
      }
      ArenaAdsManager.clearRun()
      setCurrentArenaAdsRun(null)
      if (onBackToMenu) {
        onBackToMenu()
      }
      return
    }

    // ============================================================
    // ONLINE
    //
    // Una game_room terminada JAMÁS puede reutilizarse.
    // Para jugar nuevamente necesitamos matchmaking y roomId NUEVO.
    // ============================================================
    if (roomId || matchMode === 'tournament') {
      if (roomId) {
        MatchActionOutbox.discardRoom(roomId)
      }

      soundManager.playBgm('menu')

      if (onBackToMenu) {
        onBackToMenu()
      }

      return
    }

    // Sólo entrenamiento/local puede reiniciar en el sitio.
    trackGameStart({ matchMode })
    startGame(
      Math.floor(Math.random() * 1000000),
      false,
      undefined,
      userElo,
      undefined,
      mazoMioParsed ? { mio: mazoMioParsed, rival: null } : undefined,
        undefined,
        undefined,
        undefined,
        treeBonusHpRef.current,
        rivalTreeBonusHpRef.current,
        treeSkinRef.current,
        rivalTreeSkinRef.current
      )
  }

  const isArenaAds = matchMode === 'arena_ads'

  const battlefieldNode = (
    <div
      className={`battlefield ${matchMode === 'clan_fortress' ? 'battlefield--clan-fortress' : ''} ${isArenaAds ? 'battlefield--arena-ads' : ''} ${selectedCard === 'shovel' ? 'battlefield--shovel-mode' : ''}`}
      style={{ backgroundImage: `url(${activeBgImage})` }}
      onPointerDown={(e) => {
        if (selectedCard && e.button === 0 && e.target === e.currentTarget) {
          setSelectedCard(null, null)
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (selectedCard) {
          setSelectedCard(null, null)
        }
      }}
    >
      {/* Practice / Sandbox Mode Bar */}
      {isPracticeMode && (
        <div className="practice-bar">
          <span className="practice-bar__title">🎯 ENTRENAMIENTO</span>
          <button
            type="button"
            className="practice-bar__btn"
            onClick={() => startPracticeGame(practicePlantId || undefined)}
          >
            🔄 REINICIAR BLANCOS (3 CARRILES)
          </button>
          <button
            type="button"
            className="practice-bar__btn"
            onClick={() => {
              soundManager.playBgm('menu')
              if (onBackToCollection) onBackToCollection()
              else if (onBackToMenu) onBackToMenu()
            }}
          >
            ⬅️ ALMANAQUE
          </button>
        </div>
      )}

      {/* Base Towers */}
      <BaseTower
        team="p1"
        hp={p1BaseHp}
        maxHp={INITIAL_BASE_HP + treeBonusHp}
        nombre={nombres?.mio || getLocalPlayerName()}
        level={treeLevel}
        skin={treeSkin}
      />
      {/* Los soles del rival sólo se enseñan contra el bot, que es cuando el
          número es de verdad: lo lleva esta misma simulación. En PvP los soles del
          otro son cosa de SU navegador y aquí no se conocen, así que el contador
          se quedaría clavado en 150 — un número inventado en pantalla. Mejor no
          mostrarlo que mostrar uno falso. */}
      <BaseTower
        team="p2"
        hp={p2BaseHp}
        maxHp={
          matchMode === 'clan_fortress'
            ? (currentFortressOpponent?.targetMaxBaseHp || currentFortressOpponent?.targetBaseHp || 1000)
            : INITIAL_BASE_HP + rivalTreeBonusHp
        }
        sunBank={roomId ? undefined : p2SunBank}
        nombre={
          matchMode === 'clan_fortress'
            ? (currentFortressOpponent?.targetClanName || 'Fortaleza Rival')
            : (nombres?.rival || tournamentOpponent?.name || (roomId ? 'Rival' : 'Bot Entrenador'))
        }
        level={matchMode === 'clan_fortress' ? fortressTargetTreeLevel : rivalTreeLevel}
        skin={rivalTreeSkin}
        sideBadge={
          matchMode === 'clan_fortress' ? (
            <div
              className="battlefield-colosseum-header-pill"
              style={{
                borderColor: '#eab308',
                boxShadow: '0 0 15px rgba(234, 179, 8, 0.4)',
                background: 'rgba(15, 23, 42, 0.92)',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="battlefield-colosseum-icon">{currentFortressOpponent?.targetBadge || '🏰'}</span>
              <span>{currentFortressOpponent?.targetClanTag || '#FORT'}</span>
              <span>•</span>
              <span style={{ color: '#facc15', fontWeight: 'bold' }}>☀️ {p2SunBank} Def</span>
              <span>•</span>
              <span style={{ color: '#38bdf8' }}>💎 {Math.min(60, currentFortressOpponent?.targetVaultGems ?? 60)} en juego</span>
            </div>
          ) : matchMode === 'tournament' ? (
            <div
              className="battlefield-colosseum-header-pill"
              style={{
                borderColor: '#a855f7',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)',
                background: 'rgba(15, 23, 42, 0.92)',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="battlefield-colosseum-icon">🎪</span>
              <span>TORNEO EN VIVO</span>
            </div>
          ) : matchMode === 'colosseum' ? (
            <div className="battlefield-colosseum-header-pill" style={{ whiteSpace: 'nowrap' }}>
              <span className="battlefield-colosseum-icon">🏛️</span>
              <span>COLISEO</span>
              <span>•</span>
              <span style={{ color: '#38bdf8' }}>Sala: {colosseumConfig?.betGems || 0.5} 💎</span>
              <span>•</span>
              <span style={{ color: '#fbbf24' }}>Pozo: {((colosseumConfig?.betGems || 0.5) * 2).toFixed(1)} 💎</span>
            </div>
          ) : matchMode === 'friendly' ? (
            <div
              className="battlefield-colosseum-header-pill"
              style={{
                borderColor: '#34d399',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="battlefield-colosseum-icon">🤝</span>
              <span>DUELO AMISTOSO</span>
              {friendlyBetGems !== undefined && friendlyBetGems > 0 ? (
                <>
                  <span>•</span>
                  <span style={{ color: '#38bdf8' }}>{friendlyBetGems} 💎</span>
                </>
              ) : null}
            </div>
          ) : undefined
        }
      />

      {/* PANEL DE PREPARACIÓN EN ASALTO A FORTALEZA (120S) */}
      {matchMode === 'clan_fortress' && clanRaidPhase === 'prep' && (
        <div className="clan-raid-prep-hud">
          {/* Fila Principal: Rival, Cronómetro y Botones de Acción */}
          <div className="clan-raid-prep-hud__main-row">
            <div className="clan-raid-prep-hud__target">
              <span className="clan-raid-prep-hud__badge">{currentFortressOpponent?.targetBadge || '🏰'}</span>
              <div className="clan-raid-prep-hud__title-group">
                <span className="clan-raid-prep-hud__name">{currentFortressOpponent?.targetClanName}</span>
                <span className="clan-raid-prep-hud__tag">{currentFortressOpponent?.targetClanTag}</span>
                {currentFortressOpponent?.isNpc && (
                  <span className="clan-raid-prep-hud__npc-tag">BOT</span>
                )}
              </div>
            </div>

            <div className="clan-raid-prep-hud__center">
              <div className="clan-raid-prep-timer-box">
                <span className="clan-raid-prep-timer-box__label">⏳ PREPARACIÓN</span>
                <strong className="clan-raid-prep-timer-box__val">
                  {Math.floor(clanRaidPrepTimer / 60).toString().padStart(2, '0')}:{(clanRaidPrepTimer % 60).toString().padStart(2, '0')}
                </strong>
              </div>
              {rerollError && (
                <span className="clan-raid-prep-hud__error">⚠️ {rerollError}</span>
              )}
            </div>

            <div className="clan-raid-prep-hud__actions">
              <button
                type="button"
                className="clan-raid-prep-btn clan-raid-prep-btn--reroll"
                onClick={handleRerollClanRaidTarget}
                disabled={isRerollingTarget}
                title="Buscar otro bot o clan rival pagando 500 de Oro"
              >
                {isRerollingTarget ? (
                  <>
                    <span className="clan-fortress-mini-spinner" /> BUSCANDO...
                  </>
                ) : (
                  '🔄 BUSCAR (500 🪙)'
                )}
              </button>

              <button
                type="button"
                className="clan-raid-prep-btn clan-raid-prep-btn--start"
                onClick={handleStartClanRaidBattle}
                title="Comenzar el asalto inmediatamente"
              >
                ⚔️ ¡ASALTO YA!
              </button>
            </div>
          </div>

          {/* Fila Táctica: Estadísticas, Soles y Reembolso de Pala */}
          <div className="clan-raid-prep-hud__meta-row">
            <span className="clan-raid-meta-pill">❤️ <strong>{currentFortressOpponent?.targetBaseHp} HP</strong></span>
            <span className="clan-raid-meta-pill">💎 <strong>{Math.min(30, currentFortressOpponent?.targetVaultGems ?? 30)} Gemas (3⭐)</strong></span>
            <span className="clan-raid-meta-pill">🌱 <strong>{currentFortressOpponent?.layout?.length || 0} Defensas</strong></span>
            <span className="clan-raid-meta-pill clan-raid-meta-pill--sun">☀️ <strong>{sunBank} Soles (Nv.{treeLevel} Árbol)</strong></span>
            <span className="clan-raid-meta-pill clan-raid-meta-pill--shovel" title="Desentierra con la pala para reembolsar el 100% de los soles gastados durante la fase de preparación">🧹 <strong>100% Reembolso Pala</strong></span>
          </div>

          {raidPrepNotice && (
            <div style={{ background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444', color: '#fca5a5', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', marginTop: '6px', animation: 'fortressFadeIn 0.2s ease-out' }}>
              {raidPrepNotice}
            </div>
          )}
        </div>
      )}

      {/* DIAGNÓSTICO DEL PVP
          Sólo en partidas con sala. Está en pantalla y no en la consola a
          propósito: con una captura de las dos ventanas se ve qué pasa, sin tener
          que buscar en la consola ni ejecutar consultas después de cada prueba.

          Qué mirar:
            · el TIC de los dos debe ir casi igual (±10). Si uno va muy por
              delante, el reloj común no se aplicó.
            · SALA debe ser LA MISMA en las dos ventanas. Si son distintas, no
              estáis en la misma partida.
            · «último envío» dice si el servidor aceptó la plantación, y si no,
              por qué exactamente. */}
      {/* Contra la máquina se dice: así nadie juega media hora creyendo que
          está subiendo de rango. En PvP no hace falta, ahí está el nick del rival. */}
      {!roomId && !isPracticeMode && matchMode !== 'clan_fortress' && (
        <div className="entrenamiento-aviso">🤖 Entrenamiento · sin puntos ni cofre</div>
      )}

      {roomId && (
        <button
          type="button"
          className="pvp-diag-toggle-btn"
          onClick={() => setShowPvpDiag((prev) => !prev)}
          title="Ver / Ocultar diagnóstico técnico"
        >
          {showPvpDiag ? '✕ Diag' : '📊'}
        </button>
      )}

      {roomId && showPvpDiag && (
        <div className="pvp-diag">
          <div className="pvp-diag__linea">
            <b>SALA</b> {roomId.slice(0, 8)} · <b>TIC</b> {tick}
            {desfaseDeTics !== null && <> · <b>desfase</b> {desfaseDeTics}</>}
          </div>
          <div className="pvp-diag__linea">
            <b>enviadas</b> {diag.enviadas} · <b>recibidas</b> {diag.recibidas}
          </div>
          {/* EL DATO DECISIVO: cuántas acciones dice el SERVIDOR que hay en esta
              sala, y cuántas son mías.
                · misEnSala 0     → no se está enviando nada
                · enSala = mías   → estáis en salas distintas
                · enSala > mías   → estáis juntos: el problema es la entrega */}
          <div className="pvp-diag__linea">
            <b>en la sala</b> {diag.enSala} ({diag.misEnSala} mías) · {diag.canal}
          </div>
          {/* «rehechas» son las veces que una jugada llegó tarde y hubo que
              volver a montar la partida con ella en su tic. No es un fallo: es el
              arreglo funcionando. Lo que dice es cuánto retraso está habiendo de
              verdad — si sube mucho, el margen de red se queda corto. */}
          <div className="pvp-diag__linea">
            <b>huellas</b> {diag.huellas} · <b>rehechas</b> {reconstrucciones}
          </div>
          <div className="pvp-diag__linea pvp-diag__linea--envio">{diag.ultimoEnvio}</div>
          {redBloqueada && (
            <div className="pvp-diag__linea">
              ⏳ Sincronizando acción con el servidor…
            </div>
          )}
        </div>
      )}

      {/* Start Overlay (Sólo PvE local / sin sala remota) */}
      {gameStatus === 'ready' && !practicePlantId && !roomId && (
        <div
          className="game-overlay"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="game-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="game-card__title">¡BATALLA PVE DE PLANTAS!</h2>
            <p className="game-card__text">
              Defiende tu base (P1) de las hordas de <strong>Plantas Enemigas</strong> de la PC (P2).
              <br />
              Recolecta soles haciendo click en ellos y despliega tu ejército de plantas.
            </p>
            <button
              className="game-button"
              type="button"
              onClick={() =>
                startGame(
                  seed || Math.floor(Math.random() * 1000000),
                  false,
                  undefined,
                  userElo,
                  undefined,
                  mazoMioParsed ? { mio: mazoMioParsed, rival: null } : undefined,
                  undefined,
                  undefined,
                  undefined,
                  treeBonusHpRef.current,
                  rivalTreeBonusHpRef.current,
                  treeSkinRef.current,
                  rivalTreeSkinRef.current
                )
              }
            >
              ¡EMPEZAR COMBATE!
            </button>
          </div>
        </div>
      )}

      {/* Espera de inicio de sala remota (Ranked / PvP / Rival Semilla) */}
      {gameStatus === 'ready' && !practicePlantId && Boolean(roomId) && (
        <div
          className="game-overlay"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="game-card" onClick={(e) => e.stopPropagation()}>
            {clockSyncStatus === 'error' ? (
              <>
                <h2 className="game-card__title">Error de Sincronización</h2>
                <p className="game-card__text" style={{ color: '#ff6b6b' }}>
                  {clockSyncError || 'No se pudo sincronizar la partida con el servidor.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                  <button
                    className="game-button"
                    type="button"
                    onClick={() => {
                      if (roomId) syncAndStartMatchClock(roomId)
                    }}
                  >
                    🔄 Reintentar
                  </button>
                  <button
                    className="game-button game-button--secondary"
                    type="button"
                    onClick={() => {
                      if (onBackToMenu) onBackToMenu()
                      else if (onBackToCollection) onBackToCollection()
                    }}
                  >
                    ⬅️ Salir
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="game-card__title">Preparando partida…</h2>
                <p className="game-card__text">
                  Sincronizando partida con el servidor autoritativo. La batalla comenzará en breve.
                </p>
                <div className="resultado-servidor__cargando" style={{ marginTop: '12px' }}>
                  <span className="resultado-servidor__spinner" aria-hidden="true" />
                  <span>Sincronizando…</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Grid Lanes */}
      {(() => {
        return null
      })()}
      <div className="lanes">
        {activeLanesConfig.map((lane) => {
          const isLaneLocked = matchMode === 'clan_fortress' && !allowedFortressLanes.includes(lane.id)
          const unlockLevelRequired = lane.id === 0 ? 3 : 4

          return (
            <div
              key={lane.id}
              className={`lane ${isLaneLocked ? 'lane--fortress-locked' : ''}`}
              style={{
                top: `${lane.topPct}%`,
                height: `${lane.heightPct}%`,
                left: `${BASE_LEFT_END_X}%`,
                width: `${FIELD_WIDTH_PCT}%`,
              }}
            >
              {isLaneLocked && (
                <div className="fortress-battle-lane-locked-overlay">
                  <span className="fortress-battle-locked-icon">🔒</span>
                  <span className="fortress-battle-locked-text">
                    LÍNEA {lane.id + 1} BLOQUEADA • DESBLOQUEA EN ÁRBOL MADRE NV. {unlockLevelRequired}
                  </span>
                </div>
              )}

              {Array.from({ length: TOTAL_COLUMNS }).map((_, col) => {
                const isP1Side = col < P1_COLUMNS
                const isCellSelected = Boolean(selectedCard && isP1Side && !isLaneLocked)
                const isPlantCard = selectedCard && selectedCard !== 'shovel'
                const selectedCardConfig = isPlantCard
                  ? (mazoMioParsed && mazoMioParsed.length > 0
                      ? (() => {
                          const m = mejorasDeLaCartaEnSlot(mazoMioParsed, selectedCard, selectedSlotIndex)
                          return getScaledPlantConfig(selectedCard, m.statRolls, m.equippedItem)
                        })()
                      : (() => {
                          let r: PlantStatKey[] = []
                          let eq: string | null = null
                          try {
                            const sIds = localStorage.getItem('plant_arena_active_deck_instances')
                            const sInst = localStorage.getItem('plant_arena_plant_instances')
                            const pIds: string[] = sIds ? JSON.parse(sIds) : []
                            const pInst: any[] = sInst ? JSON.parse(sInst) : []
                            if (selectedSlotIndex !== null && pIds[selectedSlotIndex]) {
                              const f = pInst.find((i) => i.instanceId === pIds[selectedSlotIndex] && isPlantMatchingTarget(i.plantId, selectedCard))
                              if (f) {
                                r = f.statRolls || []
                                eq = f.equippedItem || null
                              }
                            }
                            if (r.length === 0 && !eq) {
                              const copies = pInst.filter((i) => isPlantMatchingTarget(i.plantId, selectedCard))
                              if (copies.length > 0) {
                                copies.sort((a, b) => {
                                  if (Boolean(a.equippedItem) !== Boolean(b.equippedItem)) {
                                    return a.equippedItem ? -1 : 1
                                  }
                                  const rA = a.statRolls?.length || 0
                                  const rB = b.statRolls?.length || 0
                                  if (rA !== rB) return rB - rA
                                  return (b.level || 0) - (a.level || 0)
                                })
                                r = copies[0].statRolls || []
                                eq = copies[0].equippedItem || null
                              }
                            }
                          } catch {}
                          return getScaledPlantConfig(selectedCard, r, eq)
                        })())
                  : null
                const isWalkingPlantCard = Boolean(
                  selectedCardConfig &&
                  (selectedCardConfig.category === 'melee' ||
                    Boolean(selectedCardConfig.moveSpeed) ||
                    selectedCard === 'chomper')
                )

                // Detección estricta alineada al motor: sólo plantas estáticas bloquean el terreno
                const isCellOccupiedByPlant = plants.some((p) => p.lane === lane.id && p.col === col && !p.isWalking)
                const isCellPendingSprout = pendingOwnPlants.some((p) => p.lane === lane.id && p.col === col)
                const isCellOccupied = isCellOccupiedByPlant || isCellPendingSprout

                // Para la pala sólo son válidas plantas ya materializadas (no brotes en vuelo)
                // Para plantas caminantes/melee (Bonk Choy, Chomper), se pueden plantar en cualquier columna de nuestro lado
                // Para plantas estáticas (Girasol, Nuez, Lanzaguisantes), la casilla debe estar libre
                const isPlantDestination = isCellSelected && !isLaneLocked && (
                  selectedCard === 'shovel'
                    ? isCellOccupiedByPlant
                    : isWalkingPlantCard
                    ? true
                    : !isCellOccupied
                )
                const isPrepInstantRestricted = matchMode === 'clan_fortress' && clanRaidPhase === 'prep' && (selectedCard === 'jalapeno' || selectedCard === 'iceberglettuce')
                const previewPlantConfig = !isLaneLocked && isPlantCard && isPlantDestination && !isPrepInstantRestricted ? selectedCardConfig : null

                const handleCellAction = () => {
                  if (isLaneLocked || !isPlantDestination) return
                  if (roomId && inFlightCountRef.current >= MAX_IN_FLIGHT_ACTIONS) {
                    if (typeof navigator !== 'undefined' && navigator.vibrate) {
                      try { navigator.vibrate([20, 30]) } catch {}
                    }
                    return
                  }
                  if (isAsyncMatch && rankedAsyncInconsistency) return
                  if (selectedCard && isP1Side) {
                    if (selectedCard === 'shovel') {
                      // Igual que al plantar: sólo se registra si aquí de verdad
                      // se excavó algo. Registrar un pico que no quitó nada haría
                      // que el rival borrara una planta que en tu pantalla sigue.
                      const nextSeq = roomId ? ordenRef.current + 1 : undefined
                      const casilla = digPlant({ lane: lane.id, col }, nextSeq)
                      if (casilla) {
                        if (roomId && typeof nextSeq === 'number') ordenRef.current = nextSeq
                        setSelectedCard(null, null)
                        lastCellPlantTimeRef.current.delete(`${casilla.lane}-${casilla.col}`)
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                          try { navigator.vibrate(15) } catch {}
                        }
                        registrarExcavacion(casilla.lane, casilla.col, casilla.tick, nextSeq)
                      }
                    } else {
                      const carta = selectedCard
                      const cellKey = `${lane.id}-${col}`
                      if (!isWalkingPlantCard) {
                        const lastTime = lastCellPlantTimeRef.current.get(cellKey) || 0
                        if (Date.now() - lastTime < 750) {
                          return
                        }
                      }

                      let resolvedSlot = 0
                      if (mazoMioParsed && mazoMioParsed.length > 0) {
                        if (
                          selectedSlotIndex !== null &&
                          mazoMioParsed[selectedSlotIndex]?.plantId === carta &&
                          typeof mazoMioParsed[selectedSlotIndex]?.slot === 'number'
                        ) {
                          resolvedSlot = mazoMioParsed[selectedSlotIndex].slot!
                        } else {
                          const encontrada = mazoMioParsed.find((c) => c.plantId === carta)
                          if (encontrada && typeof encontrada.slot === 'number') {
                            resolvedSlot = encontrada.slot
                          } else {
                            const slot = selectedSlotIndex !== null
                              ? selectedSlotIndex
                              : (carta ? effectiveDeck.indexOf(carta) : 0)
                            resolvedSlot = slot >= 0 ? slot : 0
                          }
                        }
                      } else {
                        const slot = selectedSlotIndex !== null
                          ? selectedSlotIndex
                          : (carta ? effectiveDeck.indexOf(carta) : 0)
                        resolvedSlot = slot >= 0 ? slot : 0
                      }

                      if (matchMode === 'clan_fortress' && clanRaidPhase === 'prep') {
                        if (carta === 'jalapeno') {
                          setRaidPrepNotice('⚠️ Jalapeño es de acción inmediata: úsalo durante el combate activo para arrasar un carril.')
                          setTimeout(() => setRaidPrepNotice(null), 4000)
                          soundManager.playSound('click', 0.3)
                          setSelectedCard(null, null)
                          return
                        }
                        if (carta === 'iceberglettuce') {
                          setRaidPrepNotice('⚠️ Lechuga de Hielo es de acción inmediata: úsala durante el combate activo para congelar a los rivales.')
                          setTimeout(() => setRaidPrepNotice(null), 4000)
                          soundManager.playSound('click', 0.3)
                          setSelectedCard(null, null)
                          return
                        }
                      }

                      const nextSeq = roomId ? ordenRef.current + 1 : undefined
                      const enTic = placePlant(lane.id, col, carta, resolvedSlot, nextSeq)
                      if (enTic !== null) {
                        if (roomId && typeof nextSeq === 'number') ordenRef.current = nextSeq
                        setSelectedCard(null, null)
                        if (!isWalkingPlantCard) {
                          lastCellPlantTimeRef.current.set(cellKey, Date.now())
                        }
                        recordPlantPlacement(carta)
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                          try { navigator.vibrate(15) } catch {}
                        }
                        registrarPlantacion(carta, lane.id, col, enTic, resolvedSlot, nextSeq)
                      }
                    }
                  }
                }

                return (
                  <div
                    key={col}
                    className={`lane__cell ${
                      isP1Side ? 'lane__cell--p1' : 'lane__cell--p2'
                    } ${isPlantDestination ? 'lane__cell--selectable' : ''} ${
                      isLaneLocked ? 'lane__cell--fortress-locked' : ''
                    }`}
                    style={{
                      width: `${100 / TOTAL_COLUMNS}%`,
                      zIndex: isPlantDestination ? (selectedCard === 'shovel' ? 10 : 70) : (selectedCard ? 5 : 1),
                      pointerEvents: isLaneLocked ? 'none' : (selectedCard || isP1Side ? 'auto' : 'none'),
                    }}
                    onClick={() => {
                      if (isLaneLocked) return
                      if (isPlantDestination) {
                        handleCellAction()
                      } else if (selectedCard) {
                        if (!isP1Side) {
                          // Tocar el lado rival cancela la selección de forma natural
                          setSelectedCard(null, null)
                        } else if (isCellOccupied) {
                          // Feedback háptico ligero de rechazo en casilla ocupada para plantas estáticas
                          if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            try { navigator.vibrate([15, 20]) } catch {}
                          }
                        }
                      }
                    }}
                    title={
                      isLaneLocked
                        ? `🔒 Línea ${lane.id + 1} bloqueada • Requiere Árbol Madre Nivel ${unlockLevelRequired}`
                        : undefined
                    }
                  >
                    {previewPlantConfig && (
                      <img
                        className="lane__cell-ghost-preview"
                        src={previewPlantConfig.sprite || previewPlantConfig.icon}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Center Dividing Line */}
      <div className="front-line" />

      {/* Player 1 Plants */}
      {plants.map((plant) => {
        const config = getScaledPlantConfig(plant.plantId, plant.statRolls ?? [], plant.equippedItem)
        const safePlantLane = Math.min(Math.max(0, plant.lane), activeLanesConfig.length - 1)
        const laneConfig = activeLanesConfig[safePlantLane] || activeLanesConfig[0]
        const hpPct = (plant.hp / plant.maxHp) * 100
        const isShovelTarget = selectedCard === 'shovel' && !plant.isWalking
        const isFrozen = plant.frozenUntil ? tick < plant.frozenUntil : false

        return (
          <div
            key={plant.id}
            className={`entity plant-unit ${
              isShovelTarget ? 'plant-unit--shovel-target' : ''
            } ${
              plant.isWalking ? 'plant-unit--walking' : ''
            } ${
              isFrozen ? 'plant-unit--frozen' : ''
            } ${
              plant.plantId === 'garlic'
                ? plant.isSmashing
                  ? 'plant-unit--squash-smashing'
                  : 'plant-unit--squash-hopping'
                : ''
            } ${
              plant.plantId === 'squash'
                ? plant.isArmed
                  ? 'plant-unit--potato-armed'
                  : 'plant-unit--potato-unarmed'
                : ''
            } ${
              plant.plantId === 'bonkchoy' ? 'plant-unit--bonkchoy' : ''
            } ${
              plant.plantId === 'kernelpult' ? 'plant-unit--kernelpult' : ''
            } ${plant.state === 'attacking' ? 'plant-unit--attacking' : ''}`}
            style={{
              left: `${plant.x}%`,
              top: `${laneConfig.topPct + laneConfig.heightPct / 2}%`,
              pointerEvents: isShovelTarget ? 'auto' : 'none',
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (isShovelTarget) {
                if (roomId && inFlightCountRef.current >= MAX_IN_FLIGHT_ACTIONS) {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try { navigator.vibrate([20, 30]) } catch {}
                  }
                  return
                }
                if (isAsyncMatch && rankedAsyncInconsistency) return
                const seq = roomId ? ++ordenRef.current : undefined
                const casilla = digPlant(plant.id, seq)
                if (casilla) {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    try { navigator.vibrate(15) } catch {}
                  }
                  registrarExcavacion(casilla.lane, casilla.col, casilla.tick, seq)
                }
              }
            }}
          >
            {hpPct < 100 && (
              <div className="entity__hp">
                <div
                  className="entity__hp-fill"
                  style={{ width: `${hpPct}%` }}
                />
              </div>
            )}
            {plant.spriteOverride?.includes('jalapeno_flame_fx') ? (
              <div className="jalapeno-lane-flame">
                <img src="/game-assets/plants/jalapeno_flame_fx.webp" alt="Fuego" />
              </div>
            ) : (
              <>
                {(() => {
                  let plantLevel = typeof plant.level === 'number' && plant.level > 0
                    ? plant.level
                    : (plant.statRolls && plant.statRolls.length > 0 ? plant.statRolls.length : 0)

                  if (plantLevel === 0 && mazoMioParsed && mazoMioParsed.length > 0) {
                    const deckCard = mazoMioParsed.find((c) => c.plantId === plant.plantId)
                    if (deckCard) {
                      plantLevel = Math.max(
                        typeof deckCard.level === 'number' ? deckCard.level : 0,
                        deckCard.statRolls?.length || 0
                      )
                    }
                  }

                  if (plantLevel === 0) {
                    plantLevel = getBattlefieldPlantLevel(plant.plantId)
                  }
                  return (
                    <>
                      {/* Subtle Base Ground Aura for Leveled Plants */}
                      {plantLevel > 0 && (
                        <div
                          className={`plant-base-halo ${
                            plantLevel >= 3
                              ? 'plant-base-halo--gold'
                              : 'plant-base-halo--emerald'
                          }`}
                        />
                      )}
                      {/* Field Plant Level Badge */}
                      {plantLevel > 0 && (
                        <div
                          className={`plant-unit__level-badge ${
                            plantLevel >= 3 ? 'plant-unit__level-badge--gold' : ''
                          }`}
                          title={`Nivel ${plantLevel}`}
                        >
                          ⭐{plantLevel}
                        </div>
                      )}
                    </>
                  )
                })()}
                <img
                  className={`plant-unit__sprite ${
                    plant.plantId === 'melonpult' ? 'plant-unit__sprite--melon' : ''
                  } ${
                    plant.plantId === 'kernelpult' ? 'plant-unit__sprite--kernelpult' : ''
                  } ${plant.spriteOverride?.includes('burst') ? 'plant-unit__sprite--burst' : ''} ${
                    isFrozen ? 'plant-unit__sprite--frozen' : ''
                  }`}
                  src={plant.spriteOverride || config.sprite}
                  alt={config.name}
                />
              </>
            )}
            {plant.isHealingFx && (
              <div className="aloe-heal-cloud">
                <img src="/game-assets/plants/aloe_heal_fx.gif" alt="Cura" />
                <span className="heal-text">+60 HP</span>
              </div>
            )}
            {plant.plantId === 'garlic' && plant.isSmashing && (
              <div className="squash-smash-fx">💥 BAM!</div>
            )}
            {plant.plantId === 'squash' && !plant.isArmed && (
              <div className="potato-arming-badge">🌱 ARMÁNDOSE</div>
            )}
            {plant.plantId === 'squash' && plant.isArmed && (
              <div className="potato-armed-badge">🚨 ¡ARMADA!</div>
            )}
            {isFrozen && <div className="frozen-ice-badge">🧊 CONGELADO</div>}
            {plant.plantId === 'iceberglettuce' && plant.spriteOverride?.includes('burst') && (
              <div className="iceberg-burst-fx">⚡ ❄️ ¡RÁFAGA HELADA!</div>
            )}
          </div>
        )
      })}

      {/* Plantas Propias en fase de Brote / Siembra (Feedback visual instantáneo a 0ms) */}
      {pendingOwnPlants.map((pp, idx) => {
        const config = getScaledPlantConfig(pp.plantId, pp.statRolls ?? [], pp.equippedItem)
        const safePendingLane = Math.min(Math.max(0, pp.lane), activeLanesConfig.length - 1)
        const laneConfig = activeLanesConfig[safePendingLane] || activeLanesConfig[0]
        if (!laneConfig || !config) return null
        const colWidth = FIELD_WIDTH_PCT / TOTAL_COLUMNS
        const x = BASE_LEFT_END_X + pp.col * colWidth + colWidth / 2
        const y = laneConfig.topPct + laneConfig.heightPct / 2
        let sproutLevel = typeof pp.level === 'number' && pp.level > 0
          ? pp.level
          : (pp.statRolls && pp.statRolls.length > 0 ? pp.statRolls.length : 0)

        if (sproutLevel === 0 && mazoMioParsed && mazoMioParsed.length > 0) {
          const deckCard = mazoMioParsed.find((c) => c.plantId === pp.plantId)
          if (deckCard) {
            sproutLevel = Math.max(
              typeof deckCard.level === 'number' ? deckCard.level : 0,
              deckCard.statRolls?.length || 0
            )
          }
        }

        if (sproutLevel === 0) {
          sproutLevel = getBattlefieldPlantLevel(pp.plantId)
        }

        return (
          <div
            key={`pending-plant-${pp.lane}-${pp.col}-${idx}`}
            className="entity plant-unit plant-unit--sprouting"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              pointerEvents: 'none',
              zIndex: 65,
            }}
          >
            {sproutLevel > 0 && (
              <div
                className={`plant-unit__level-badge ${
                  sproutLevel >= 3 ? 'plant-unit__level-badge--gold' : ''
                }`}
              >
                ⭐{sproutLevel}
              </div>
            )}
            <img
              className="plant-unit__sprite"
              src={config.sprite || config.icon}
              alt={config.name}
            />
          </div>
        )
      })}

      {/* Player 2 PC Enemy Plants */}
      {enemyPlants.map((enemy) => {
        // Si la planta la puso un RIVAL de verdad, trae su plantId y se pinta con
        // el sprite de esa carta. No hace falta arte nueva: los dos lados ya usan
        // los mismos ficheros (transparentsunflower.png es el girasol de ambos) y
        // el CSS de enemy-unit ya los espeja. Es la misma planta al revés.
        //
        // Ya no hay catálogo enemigo: las plantas de los dos lados son la misma
        // cosa y salen del mismo sitio. El bot también planta cartas de verdad.
        const config = getScaledPlantConfig(enemy.plantId, enemy.statRolls ?? [], enemy.equippedItem)
        const safeEnemyLane = Math.min(Math.max(0, enemy.lane), activeLanesConfig.length - 1)
        const laneConfig = activeLanesConfig[safeEnemyLane] || activeLanesConfig[0]
        const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100)
        // frozenUntil es un TIC, no un instante de reloj. Comparado con Date.now()
        // esto era siempre falso y la congelación del hielo no se veía nunca.
        const isFrozen = enemy.frozenUntil ? tick < enemy.frozenUntil : false

        return (
          <div
            key={enemy.id}
            className={`entity enemy-unit ${
              enemy.plantId === 'kernelpult' ? 'enemy-unit--kernelpult' : ''
            } ${
              enemy.state === 'attacking' ? 'enemy-unit--attacking' : ''
            } ${isFrozen ? 'enemy-unit--frozen' : ''}`}
            style={{
              left: `${enemy.x}%`,
              top: `${laneConfig.topPct + laneConfig.heightPct / 2}%`,
            }}
          >
            {/* Enemy Level Badge */}
            {enemy.level !== undefined && enemy.level > 0 && (
              <div
                className={`plant-unit__level-badge ${
                  enemy.level >= 3 ? 'plant-unit__level-badge--gold' : ''
                }`}
                title={`Nivel ${enemy.level}`}
              >
                ⭐{enemy.level}
              </div>
            )}
            <div className="entity__hp">
              <div
                className="entity__hp-fill entity__hp-fill--enemy"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <img
              className={`enemy-unit__sprite ${
                enemy.plantId === 'melonpult' ? 'enemy-unit__sprite--melon' : ''
              } ${
                enemy.plantId === 'kernelpult' ? 'enemy-unit__sprite--kernelpult' : ''
              } ${enemy.spriteOverride?.includes('burst') ? 'plant-unit__sprite--burst' : ''} ${
                isFrozen ? 'enemy-unit__sprite--frozen' : ''
              }`}
              src={enemy.spriteOverride || config.sprite}
              alt={config.name}
            />
            {isFrozen && <div className="frozen-ice-badge">🧊 CONGELADO / 🧈</div>}
            {enemy.plantId === 'iceberglettuce' && enemy.spriteOverride?.includes('burst') && (
              <div className="iceberg-burst-fx">⚡ ❄️ ¡RÁFAGA HELADA!</div>
            )}
          </div>
        )
      })}

      {/* Flying Projectiles */}
      {projectiles.map((proj) => {
        const isCatapult = proj.type === 'kernel' || proj.type === 'butter' || proj.type === 'melon' || proj.id.startsWith('tree-')
        const isTreeShot = proj.id.startsWith('tree-')
        const safeProjLane = Math.min(Math.max(0, proj.lane), activeLanesConfig.length - 1)
        const targetLaneCfg = activeLanesConfig[safeProjLane] || activeLanesConfig[0]
        let currentY = targetLaneCfg.topPct + targetLaneCfg.heightPct / 2
        let scale = 1
        if (isCatapult) {
          const originX = proj.originX ?? (proj.targetTeam === 'p2' ? 15 : 85)
          const targetX = proj.targetX ?? (proj.targetTeam === 'p2' ? 85 : 15)
          const totalDist = Math.max(Math.abs(targetX - originX), 12)
          const traveled = Math.abs(proj.x - originX)
          const t = Math.min(Math.max(traveled / totalDist, 0), 1)

          // Parábola de elevación: máxima en t = 0.5 (4 * 0.5 * 0.5 = 1)
          const maxArc = isTreeShot ? 15 : (proj.type === 'butter' ? 18 : 14)
          const arcHeight = 4 * t * (1 - t) * maxArc

          const originLane = proj.originLane ?? proj.lane
          const safeOriginLane = Math.min(Math.max(0, originLane), activeLanesConfig.length - 1)
          const originLaneCfg = activeLanesConfig[safeOriginLane] || activeLanesConfig[0]
          const startY = isTreeShot ? 22 : (originLaneCfg.topPct + originLaneCfg.heightPct / 2)
          const endY = targetLaneCfg.topPct + targetLaneCfg.heightPct / 2

          currentY = startY + t * (endY - startY) - arcHeight
          scale = 1 + (isTreeShot ? 0.4 : 0.35) * Math.sin(t * Math.PI)
        }

        return (
          <img
            key={proj.id}
            className={`projectile ${
              proj.type === 'melon'
                ? 'projectile--melon'
                : proj.type === 'needle'
                ? 'projectile--needle'
                : proj.type === 'kernel'
                ? 'projectile--kernel'
                : proj.type === 'butter'
                ? 'projectile--butter'
                : 'projectile--pea'
            } ${proj.targetTeam === 'p1' ? 'projectile--left' : ''}`}
            src={
              proj.type === 'melon'
                ? melonImg
                : proj.type === 'needle'
                ? needleImg
                : proj.type === 'kernel'
                ? kernelImg
                : proj.type === 'butter'
                ? butterImg
                : peaImg
            }
            alt=""
            style={{
              left: `${proj.x}%`,
              top: `${currentY}%`,
              transform: `${proj.targetTeam === 'p1' ? 'scaleX(-1)' : ''} scale(${scale})`,
              zIndex: isCatapult ? 35 : 15,
              filter: proj.id.startsWith('tree-')
                ? 'drop-shadow(0 0 8px #c084fc) drop-shadow(0 0 14px #38bdf8) hue-rotate(240deg) saturate(2)'
                : undefined,
            }}
          />
        )
      })}

      {/* Collectible Suns (Plant-generated and Sky-fallen across both sides) */}
      {suns.map((sun) => {
        const isCollecting = collectingSunIds.has(sun.id)
        return (
          <button
            key={sun.id}
            type="button"
            // El último segundo antes de recogerse solo se avisa: si el sol
            // desapareciera sin más, parecería que se ha perdido — y lo que pasa es
            // justo lo contrario, que entra igual.
            className={`sun-item ${
              tick - sun.createdAt >= TICS_ANTES_DE_RECOGERSE_SOLO ? 'sun-item--se-va' : ''
            } ${isCollecting ? 'sun-item--collecting' : ''}`}
            style={{
              left: `${sun.x}%`,
              top: `${sun.y}%`,
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.stopPropagation()
              recogerSolAutorizado(sun.id)
            }}
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <img src={sunIcon} alt="Sol" className="sun-item__icon" />
          </button>
        )
      })}

      {/* El reloj de la partida y la cuenta atrás hasta la muerte súbita. Sin
          esto el plazo existía pero no se veía, y un plazo que no se ve no se
          puede jugar. */}
      {gameStatus === 'playing' && (
        <RelojDePartida
          tick={tick}
          practica={isPracticeMode}
          arrancaEn={segundosParaEmpezar}
        />
      )}

      {/* Wave Banner */}
      {waveBanner && matchMode !== 'clan_fortress' && (
        <div className="wave-banner">
          <span className="wave-banner__text">{waveBanner}</span>
        </div>
      )}

      {/* Victory / Defeat Modal */}
      {matchMode !== 'strategic_test' && (gameStatus === 'victory' || gameStatus === 'defeat') && (() => {
        const esDerrotaServidor = Boolean(
          resultadoServidor?.status === 'liquidada' && (
            resultadoServidor?.resultadoFinal === 'defeat' ||
            (typeof resultadoServidor.eloDelta === 'number' && resultadoServidor.eloDelta < 0) ||
            (typeof resultadoServidor.eloLost === 'number' && resultadoServidor.eloLost > 0)
          )
        )
        const esVictoriaServidor = Boolean(
          resultadoServidor?.status === 'liquidada' && (
            resultadoServidor?.resultadoFinal === 'victory' ||
            (typeof resultadoServidor.eloDelta === 'number' && resultadoServidor.eloDelta > 0) ||
            (typeof resultadoServidor.eloGained === 'number' && resultadoServidor.eloGained > 0)
          )
        )
        const esVictoriaFinal = roomId
          ? (esVictoriaServidor || (!esperandoConfirmacionServidor && !esDerrotaServidor && gameStatus === 'victory'))
          : (gameStatus === 'victory')

        return (
          <div
            className="game-overlay"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className={`game-card game-card--horizontal game-card--fullscreen ${
                esperandoConfirmacionServidor
                  ? 'game-card--loading'
                  : resultadoEmpatado
                  ? 'game-card--draw'
                  : resultadoEnRevision
                  ? 'game-card--draw'
                  : esDerrotaServidor
                  ? 'game-card--defeat'
                  : esVictoriaFinal
                  ? 'game-card--victory'
                  : 'game-card--defeat'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. HEADER CENTRADO: TÍTULO Y HERO BADGE DE COPAS / ESTADO */}
              <div className="game-card__header-zone">
                <h2 className="game-card__title">
                  {esperandoConfirmacionServidor
                    ? '⚔️ VALIDANDO COMBATE...'
                    : resultadoEnRevision
                    ? '🛡️ COMBATE EN ARBITRAJE'
                    : resultadoEmpatado
                    ? '🤝 ¡EMPATE TÁCTICO!'
                    : esDerrotaServidor
                    ? '💀 ¡DERROTA!'
                    : esVictoriaFinal
                    ? '🏆 ¡VICTORIA!'
                    : battleSummaryResult?.isSurrendered
                    ? '🏳️ ¡TE HAS RENDIDO!'
                    : '💀 ¡DERROTA!'}
                </h2>

                {/* Hero ELO / Estado Servidor Badge (Centrado) */}
                <div className="game-card__hero-banner">
                  {roomId && (
                    <div className="resultado-servidor">
                      {esperandoConfirmacionServidor && (
                        <div className="resultado-servidor__cargando">
                          <span
                            className="resultado-servidor__spinner"
                            aria-hidden="true"
                          />
                          <span>⚔️ Validando resultado del combate...</span>
                        </div>
                      )}

                      {resultadoServidor?.status === 'revision_servidor' && (
                        <div className="elo-result-badge elo-result-badge--draw" style={{ background: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308' }}>
                          <span>🛡️ COMBATE PROTEGIDO</span>
                          <span className="elo-result-badge__total" style={{ color: '#fef08a' }}>
                            Tus copas están a salvo (0 Copas modificadas)
                          </span>
                        </div>
                      )}

                      {resultadoEmpatado && (
                        <div className="elo-result-badge elo-result-badge--draw" style={{ background: 'rgba(148, 163, 184, 0.15)', borderColor: '#94a3b8' }}>
                          <span>🤝 ¡EMPATE TÁCTICO!</span>
                          <span className="elo-result-badge__total" style={{ color: '#cbd5e1' }}>
                            (0 Copas modificadas · Total: {userElo} 🏆)
                          </span>
                        </div>
                      )}

                      {!esperandoConfirmacionServidor && matchMode !== 'tournament' && matchMode !== 'friendly' && resultadoServidor?.status === 'liquidada' && (() => {
                        const fallbackDeltas = getEloDeltasForElo(userElo)
                        const fallbackDelta = gameStatus === 'victory' ? fallbackDeltas.winElo : -fallbackDeltas.loseElo
                        const fallbackTotal = Math.max(
                          getTrophyGateForElo(userElo),
                          userElo + fallbackDelta
                        )

                        const delta =
                          typeof resultadoServidor.eloDelta === 'number'
                            ? resultadoServidor.eloDelta
                            : typeof resultadoServidor.eloGained === 'number'
                            ? resultadoServidor.eloGained
                            : typeof resultadoServidor.eloLost === 'number' && resultadoServidor.eloLost > 0
                            ? -resultadoServidor.eloLost
                            : battleSummaryResult?.eloChange ?? fallbackDelta

                        const total =
                          typeof resultadoServidor.eloAfter === 'number'
                            ? resultadoServidor.eloAfter
                            : battleSummaryResult?.newElo ?? fallbackTotal

                        return (
                          <div className="game-card__elo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <div
                              className={`elo-result-badge ${
                                delta >= 0
                                  ? 'elo-result-badge--win'
                                  : 'elo-result-badge--loss'
                              }`}
                            >
                              <span>
                                {delta >= 0
                                  ? `🏆 +${delta} COPAS`
                                  : `🏆 ${delta} COPAS`}
                              </span>
                              <span className="elo-result-badge__total">
                                (Total: {total.toLocaleString('en-US')} 🏆)
                              </span>
                            </div>
                          </div>
                        )
                      })()}

                      {!esperandoConfirmacionServidor &&
                        resultadoServidor?.status !== 'revision_servidor' &&
                        resultadoServidor?.error && (
                          <p className="resultado-servidor__disputa">
                            🛡️ {resultadoServidor.error.includes('inconsistencia') || resultadoServidor.error.includes('missing')
                              ? 'El resultado tardó en sincronizarse con el rival. Tus copas han sido resguardadas de forma segura.'
                              : resultadoServidor.error}
                          </p>
                        )}
                    </div>
                  )}

                  {/* ELO BADGE (sólo para partidas sin sala / offline de Ranked) */}
                  {!roomId && matchMode !== 'tournament' && matchMode !== 'friendly' && matchMode !== 'clan_fortress' && battleSummaryResult?.eloChange !== undefined && (
                    <div
                      className={`elo-result-badge ${
                        battleSummaryResult.eloChange >= 0
                          ? 'elo-result-badge--win'
                          : 'elo-result-badge--loss'
                      }`}
                    >
                      <span>
                        {battleSummaryResult.eloChange >= 0
                          ? `🏆 +${battleSummaryResult.eloChange} COPAS`
                          : `🏆 ${battleSummaryResult.eloChange} COPAS`}
                      </span>
                      <span className="elo-result-badge__total">
                        (Total: {battleSummaryResult.newElo || userElo} 🏆)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. BODY GRID (2 COLUMNAS SIMÉTRICAS O PANEL DE ASALTO) */}
              <div className="game-card__body-grid">
                {/* SI ES ASALTO A LA FORTALEZA: PANEL DE ASALTO A LA FORTALEZA */}
                {matchMode === 'clan_fortress' ? (
                  <div className="game-card__panel game-card__panel--fortress">
                    <div className="game-card__panel-title">
                      <span>🏰</span> Resultado del Asalto
                    </div>
                    <div className="clan-raid-victory-box" style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, boxShadow: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <strong style={{ color: '#fef08a', fontSize: '0.9rem' }}>
                          🏰 {currentFortressOpponent?.targetClanName || clanFortressConfig?.targetClan?.targetClanName}
                        </strong>
                        <span style={{ fontSize: '1.2rem', letterSpacing: '2px' }}>
                          {clanRaidResult && clanRaidResult.starsEarned > 0 ? '⭐'.repeat(clanRaidResult.starsEarned) : '💀 DERROTA'}
                        </span>
                      </div>

                      {clanRaidResult ? (() => {
                        const stolenGems = Number(
                          clanRaidResult.stolenToClan ??
                          (clanRaidResult as any).stolenGems ??
                          clanRaidResult.stolenTotal ??
                          0
                        )
                        const damagePts = Number(
                          clanRaidResult.damageDealt ??
                          (clanRaidResult as any).effectiveDamage ??
                          (clanRaidResult as any).damage_dealt ??
                          0
                        )
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem' }}>
                            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>💎 Saqueo de Clan:</span>
                              <strong style={{ color: stolenGems > 0 ? '#facc15' : '#94a3b8', display: 'block', fontSize: '1.05rem', marginTop: '2px' }}>
                                {stolenGems > 0 ? `${Math.round(stolenGems)} gemas` : 'sigue intentando'}
                              </strong>
                            </div>
                            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '6px 8px', borderRadius: '8px', border: '1px solid rgba(74, 222, 128, 0.3)' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>💥 Daño al Bastión:</span>
                              <strong style={{ color: '#4ade80', display: 'block', fontSize: '1.05rem', marginTop: '2px' }}>
                                {damagePts} pts
                              </strong>
                            </div>
                            {clanRaidResult.goldBonus > 0 && (
                              <div style={{ gridColumn: 'span 2', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '4px 6px', borderRadius: '6px', textAlign: 'center', color: '#fef08a', fontWeight: 'bold', fontSize: '0.78rem' }}>
                                🪙 Bono Personal: +{clanRaidResult.goldBonus} Oro
                              </div>
                            )}
                            <div style={{ gridColumn: 'span 2', color: '#94a3b8', fontSize: '0.72rem', textAlign: 'center' }}>
                              🛡️ Escudo de protección activado por 4h.
                            </div>
                          </div>
                        )
                      })() : (
                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.82rem' }}>Liquidando botín de guerra con el tesoro...</p>
                      )}
                    </div>
                  </div>
                ) : matchMode === 'arena_ads' ? (
                  /* ARENA ADS MATCH REWARD CARD */
                  <div className="game-card__panel game-card__panel--arena-ads">
                    <div className="game-card__panel-title">
                      <span>🏰</span> Resultado Arena ADS
                    </div>
                    <div className="colosseum-battle-payout-box" style={{ borderColor: '#38bdf8', boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)', margin: 0 }}>
                      {gameStatus === 'victory' ? (
                        <>
                          <div className="colosseum-payout-header" style={{ color: '#38bdf8' }}>
                            <span>🎉 ¡NIVEL {currentArenaAdsRun?.level || 1} SUPERADO!</span>
                          </div>
                          <div className="colosseum-payout-gems" style={{ color: '#facc15' }}>
                            💰 BOTÍN ACUMULADO ACTUAL:
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '6px' }}>
                            <span style={{ color: '#fef08a', fontWeight: 800, fontSize: '0.85rem' }}>
                              🪙 {currentArenaAdsRun?.accumulatedRewards.gold || 0} Oro
                            </span>
                            <span style={{ color: '#bae6fd', fontWeight: 800, fontSize: '0.85rem' }}>
                              💎 {currentArenaAdsRun?.accumulatedRewards.gems || 0} Gemas
                            </span>
                            {currentArenaAdsRun && Object.entries(currentArenaAdsRun.accumulatedRewards.items).map(([id, qty]) => (
                              <span key={id} style={{ color: '#86efac', fontWeight: 800, fontSize: '0.85rem' }}>
                                🎒 +{qty} {id}
                              </span>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 0 0', textAlign: 'center' }}>
                            🛡️ Progreso guardado. Retírate ahora para cobrarlo o continúa arriesgando.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="colosseum-payout-header colosseum-payout-header--defeat">
                            <span>💀 DERROTA EN LA MAZMORRA</span>
                          </div>
                          <div className="colosseum-payout-loss">
                            Perdiste todo el botín acumulado en esta expedición.
                          </div>
                          <div className="colosseum-payout-streak" style={{ color: '#ef4444' }}>
                            ⚠️ Has caído en el Nivel {currentArenaAdsRun?.level || 1}.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : matchMode === 'colosseum' && colosseumResult ? (
                  /* COLOSSEUM MATCH REWARD CARD */
                  <div className="game-card__panel game-card__panel--colosseum">
                    <div className="game-card__panel-title">
                      <span>🏛️</span> Resultado del Coliseo
                    </div>
                    <div className="colosseum-battle-payout-box" style={{ margin: 0 }}>
                      {gameStatus === 'victory' ? (
                        <>
                          <div className="colosseum-payout-header">
                            <span>🏛️ ¡VICTORIA EN EL COLISEO!</span>
                          </div>
                          <div className="colosseum-payout-gems">
                            + {colosseumResult.payoutGems} GEMAS 💎
                          </div>
                          <div className="colosseum-payout-streak">
                            🔥 Racha Actual: <strong>{colosseumResult.newStreak} victorias</strong>
                          </div>
                          {colosseumResult.isNewRecord && (
                            <div className="colosseum-payout-record">
                              👑 ¡NUEVO RÉCORD! ({colosseumResult.newMaxStreak} Victorias)
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="colosseum-payout-header colosseum-payout-header--defeat">
                            <span>💀 DERROTA EN EL COLISEO</span>
                          </div>
                          <div className="colosseum-payout-loss">
                            {colosseumConfig?.usedTicket
                              ? '🎟️ 1 Ticket consumido'
                              : `💎 -${colosseumConfig?.betGems || 0.5} Gemas`}
                          </div>
                          <div className="colosseum-payout-streak" style={{ color: '#ef4444' }}>
                            🔥 Racha reiniciada a 0
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : matchMode === 'tournament' && tournamentResult ? (
                  /* TOURNAMENT ROUND REWARD CARD */
                  <div className="game-card__panel game-card__panel--tournament">
                    <div className="game-card__panel-title">
                      <span>🏆</span> Ronda del Torneo
                    </div>
                    <div
                      className="colosseum-battle-payout-box"
                      style={{ borderColor: '#a855f7', boxShadow: '0 0 20px rgba(168, 85, 247, 0.35)', margin: 0 }}
                    >
                      {gameStatus === 'victory' ? (
                        <>
                          <div className="colosseum-payout-header" style={{ color: '#d8b4fe' }}>
                            🏆 ¡VICTORIA EN EL TORNEO!
                          </div>
                          <div className="colosseum-payout-gems" style={{ color: '#4ade80' }}>
                            +1 VICTORIA (Total: 🔥 {tournamentResult.userWins})
                          </div>
                          <div className="colosseum-payout-streak">
                            📊 Posición: <strong>#{TournamentManager.getUserRank(tournamentResult)}</strong> | Vidas: {Array.from({ length: 3 }).map((_, i) => (
                              <span key={i}>{i < 3 - tournamentResult.userLosses ? '❤️' : '💔'}</span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="colosseum-payout-header colosseum-payout-header--defeat">
                            💔 DERROTA EN EL TORNEO
                          </div>
                          <div className="colosseum-payout-loss">
                            Perdiste 1 vida ({Math.max(0, 3 - tournamentResult.userLosses)}/3 restantes)
                          </div>
                          <div className="colosseum-payout-streak" style={{ color: tournamentResult.isEliminated ? '#ef4444' : '#fdba74' }}>
                            {tournamentResult.isEliminated
                              ? '💀 ¡ELIMINADO DEL TORNEO!'
                              : `⚠️ Te quedan ${3 - tournamentResult.userLosses} vida(s).`}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  /* REGULAR PVP / FRIENDLY: PANEL IZQUIERDO DE RECOMPENSA */
                  <div className="game-card__panel game-card__panel--rewards">
                    <div className="game-card__panel-title">
                      <span>🎁</span> Recompensa de Batalla
                    </div>
                    {esVictoriaFinal ? (
                      battleSummaryResult?.packResult?.awarded ? (
                        <div className="victory-pack-reward__box">
                          <div className="victory-pack-reward__card">
                            <img
                              src="/game-assets/greenfoot/seed_pack_pvp.webp"
                              alt="Sobre de Batalla PvP"
                              className="victory-pack-reward__img"
                            />
                            <div className="victory-pack-reward__info">
                              <span className="victory-pack-reward__name">
                                SOBRE DE BATALLA (1 CARTA)
                              </span>
                              <span className="victory-pack-reward__timer">
                                ⏳ Espera: <strong>{battleSummaryResult.packResult.durationHours} hora(s)</strong>
                              </span>
                              <span className="victory-pack-reward__loc">
                                📍 Guardado en tus Slots del Menú
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : battleSummaryResult?.packResult?.isSlotsFull ? (
                        <div className="victory-pack-reward__full">
                          ⚠️ <strong>SLOTS DE SOBRES LLENOS (4/4)</strong>
                          <br />
                          Abre un sobre en el Menú Principal para liberar espacio.
                        </div>
                      ) : (
                        <div className="defeat-summary-box">
                          <span className="defeat-summary-icon">✨</span>
                          <span className="defeat-summary-text">
                            ¡Gran victoria táctica! Sigue compitiendo para dominar la arena y ganar más copas.
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="defeat-summary-box">
                        <span className="defeat-summary-icon">{resultadoEmpatado ? '🤝' : '🛡️'}</span>
                        <span className="defeat-summary-text">
                          {resultadoEmpatado
                            ? '¡Combate muy reñido! Ambos jugadores defendieron con solidez.'
                            : '¡Buen intento! Revisa tu mazo y tus plantas en el Jardín para volver con más fuerza.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* COLUMNA DERECHA: ESTADÍSTICAS DEL COMBATE & BONUS VIP */}
                <div className="game-card__panel game-card__panel--stats">
                  <div className="game-card__panel-title">
                    <span>📊</span> Estadísticas de Combate
                  </div>

                  <div className="game-card__stats-grid">
                    <div className="game-card__stat-row">
                      <span className="game-card__stat-label">
                        <span>☀️</span> Soles Recolectados
                      </span>
                      <strong className="game-card__stat-value">{stats.sunsCollected}</strong>
                    </div>
                    <div className="game-card__stat-row">
                      <span className="game-card__stat-label">
                        <span>⚔️</span> Enemigos Derrotados
                      </span>
                      <strong className="game-card__stat-value">{stats.enemyPlantsDefeated}</strong>
                    </div>
                    <div className="game-card__stat-row">
                      <span className="game-card__stat-label">
                        <span>🌱</span> Plantas Sembradas
                      </span>
                      <strong className="game-card__stat-value">{stats.plantsPlaced}</strong>
                    </div>
                  </div>

                  {/* VIP VICTORY GOLD BONUS BADGE */}
                  {esVictoriaFinal && Boolean((resultadoServidor?.vipGoldBonus || battleSummaryResult?.vipGoldBonus) && ((resultadoServidor?.vipGoldBonus || battleSummaryResult?.vipGoldBonus) || 0) > 0) && (
                    <div className="victory-vip-gold-box">
                      <div className="victory-vip-gold-badge">
                        <span className="victory-vip-gold-badge__crown">👑</span>
                        <span className="victory-vip-gold-badge__title">BONUS VIP:</span>
                        <span className="victory-vip-gold-badge__val">
                          +{resultadoServidor?.vipGoldBonus || battleSummaryResult?.vipGoldBonus}
                        </span>
                        <GoldIcon size={16} />
                        <span className="victory-vip-gold-badge__lbl">Oro</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. FOOTER ACCIONES CENTRADAS */}
              <div className="game-card__footer-actions">
                <button
                  className="game-button"
                  type="button"
                  disabled={isRerollingTarget}
                  onClick={handlePlayAgain}
                >
                  {matchMode === 'tournament'
                    ? '🏆 VOLVER AL TORNEO'
                    : matchMode === 'arena_ads'
                    ? (gameStatus === 'victory' ? `⚔️ AVANZAR AL NIVEL ${(currentArenaAdsRun?.level || 1) + 1}` : '🔄 VOLVER AL LOBBY')
                    : isRerollingTarget
                    ? '🔍 BUSCANDO FORTALEZA...'
                    : '🎮 SEGUIR JUGANDO'}
                </button>
                {matchMode === 'arena_ads' && gameStatus === 'victory' && (
                  <button
                    className="game-button"
                    style={{
                      background: 'linear-gradient(180deg, #facc15 0%, #ca8a04 100%)',
                      color: '#422006',
                      fontWeight: 900,
                      border: '1px solid #fde047',
                    }}
                    type="button"
                    onClick={() => {
                      soundManager.playBgm('menu')
                      if (currentArenaAdsRun && onArenaAdsRetreat) {
                        onArenaAdsRetreat(
                          currentArenaAdsRun.accumulatedRewards,
                          currentArenaAdsRun.multiplier || 1,
                          currentArenaAdsRun.newlyClaimedLevels
                        )
                      } else if (onBackToMenu) {
                        onBackToMenu()
                      }
                    }}
                  >
                    💰 RETIRARSE ({currentArenaAdsRun?.accumulatedRewards.gold || 0} 🪙)
                  </button>
                )}
                {onBackToMenu && matchMode !== 'tournament' && (
                  <button
                    className="game-button game-button--secondary"
                    type="button"
                    disabled={isRerollingTarget}
                    onClick={() => {
                      soundManager.playBgm('menu')
                      if (matchMode === 'arena_ads' && gameStatus !== 'victory') {
                        ArenaAdsManager.clearRun()
                        setCurrentArenaAdsRun(null)
                      }
                      onBackToMenu()
                    }}
                  >
                    🏠 MENÚ PRINCIPAL
                  </button>
                )}
              </div>
            </div>
          </div>
      )})()}

      {/* ARENA ADS INTERSTITIAL POPUP (VICTORIA O REVIVIR TRAS DERROTA) */}
      {matchMode === 'arena_ads' && showArenaAdsInterstitial && currentArenaAdsRun && (
        <ArenaAdsInterstitialModal
          isOpen={showArenaAdsInterstitial}
          mode={arenaAdsModalMode}
          levelCleared={currentArenaAdsRun.level}
          accumulatedLoot={currentArenaAdsRun.accumulatedRewards}
          multiplier={currentArenaAdsRun.multiplier}
          isReviving={isRevivingArenaAds}
          onNextLevel={() => {
            setShowArenaAdsInterstitial(false)
            resetPopunderQuota()
            if (onArenaAdsAdvance) {
              const nextRun = ArenaAdsManager.advanceToNextLevel(currentArenaAdsRun)
              onArenaAdsAdvance(nextRun)
            }
          }}
          onCashout={() => {
            setShowArenaAdsInterstitial(false)
            if (arenaAdsModalMode === 'defeat') {
              ArenaAdsManager.clearRun()
              setCurrentArenaAdsRun(null)
              if (onBackToMenu) {
                onBackToMenu()
              }
            } else if (onArenaAdsRetreat) {
              onArenaAdsRetreat(
                currentArenaAdsRun.accumulatedRewards,
                currentArenaAdsRun.multiplier || 1,
                currentArenaAdsRun.newlyClaimedLevels
              )
            }
          }}
          onRevive={async () => {
            setIsRevivingArenaAds(true)
            try {
              const res = await arenaAdsService.reviveArenaAds()
              if (!res.success) {
                alert(res.error || 'No se pudo revivir. Verifica tu saldo de Gemas.')
                return
              }
              if (onArenaAdsRevive) {
                onArenaAdsRevive(res.cost || 150)
              }
              resetPopunderQuota()
              const revivedRun = ArenaAdsManager.reviveRun(currentArenaAdsRun)
              setCurrentArenaAdsRun(revivedRun)
              setShowArenaAdsInterstitial(false)
              if (onArenaAdsAdvance) {
                onArenaAdsAdvance(revivedRun)
              } else if (onBackToMenu) {
                onBackToMenu()
              }
            } finally {
              setIsRevivingArenaAds(false)
            }
          }}
        />
      )}

      {/* Strategic Playtest Post-Match Evaluation Modal */}
      {matchMode === 'strategic_test' && currentPlaytestLog && (
        <StrategicPlaytestPostMatch
          log={currentPlaytestLog}
          onPlayAgain={() => {
            if (onPlayAgainPlaytest) onPlayAgainPlaytest()
            else if (onBackToMenu) onBackToMenu()
          }}
          onBackToMenu={() => onBackToMenu && onBackToMenu()}
        />
      )}

      {/* Bottom Right Utility Controls & Surrender */}
      <div className="battlefield-bottom-actions">
        <div className="battlefield-utility-controls">
          <button
            type="button"
            className="fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            title="Pantalla Completa (Ocultar navegador)"
          >
            ⛶
          </button>
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={toggleMute}
            title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>

        {gameStatus === 'playing' && !isPracticeMode && (
          <button
            type="button"
            className="surrender-btn"
            onClick={handleSurrenderClick}
            title="Rendirse y perder ELO"
          >
            🏳️ RENDIRSE
          </button>
        )}
      </div>

      {/* Surrender Confirmation In-Game Modal */}
      {showSurrenderModal && (
        <div className="battle-surrender-modal-overlay">
          <div className="battle-surrender-modal">
            <div className="battle-surrender-modal__icon">🏳️</div>
            <h3 className="battle-surrender-modal__title">¿RENDIRTE DE LA BATALLA?</h3>
            <p className="battle-surrender-modal__desc">
              Si te rindes ahora, se declarará derrota inmediata y perderás copas de ELO en el ranking.
            </p>
            <div className="battle-surrender-modal__actions">
              <button
                type="button"
                className="battle-surrender-modal__btn battle-surrender-modal__btn--cancel"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setShowSurrenderModal(false)
                }}
              >
                ⚔️ SEGUIR LUCHANDO
              </button>
              <button
                type="button"
                className="battle-surrender-modal__btn battle-surrender-modal__btn--confirm"
                onClick={handleConfirmSurrender}
              >
                🏳️ SÍ, RENDIRME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plant Hand */}
      <PlantHand
        sunBank={sunBank}
        selectedCard={selectedCard}
        selectedSlotIndex={selectedSlotIndex}
        onSelectCard={setSelectedCard}
        cooldowns={cooldowns}
        currentTick={tick}
        slotCooldowns={slotCooldowns}
        activeDeck={effectiveDeck}
        deckCards={mazoMioParsed}
      />
    </div>
  )

  return battlefieldNode
}
