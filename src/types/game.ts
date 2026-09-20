export type PlantId =
  | 'sunflower'
  | 'peashooter'
  | 'repeater'
  | 'wallnut'
  | 'melonpult'
  | 'chomper'
  | 'bonkchoy'
  | 'garlic'
  | 'squash'
  | 'twinsunflower'
  | 'threepeater'
  | 'tallnut'
  | 'jalapeno'
  | 'iceberglettuce'
  | 'aloe'
  | 'kernelpult'

export type PlantCategory = 'producer' | 'ranged' | 'defensive' | 'melee'

export interface PlantConfig {
  id: PlantId
  name: string
  cost: number
  cooldownMs: number
  maxHp: number
  category: PlantCategory
  icon: string
  packetActive: string
  packetDisabled: string
  sprite: string
  damage?: number
  attackSpeedMs?: number
  moveSpeed?: number // For walking melee plants (% field width per sec)
  description: string
}

/**
 * Las mejoras que un jugador ha tirado para una carta. Vive aquí y no en
 * gameConstants porque PlantEntity la necesita, y gameConstants ya importa de
 * este fichero: al revés habría un ciclo.
 */
export type PlantStatKey = 'hp' | 'damage' | 'attackSpeed' | 'moveSpeed' | 'cooldown' | 'duration'

export interface PlantEntity {
  id: string
  plantId: PlantId
  instanceId?: string
  level?: number
  /**
   * Las mejoras de esta planta, fijadas al plantarla.
   *
   * Antes el bucle las volvía a leer de localStorage en CADA tic y para CADA
   * planta. Eso las hacía depender del navegador y no de la partida: si el
   * jugador cambiaba de mazo a mitad de batalla, las plantas ya plantadas
   * cambiaban de estadísticas, y una repetición en servidor —que no tiene
   * localStorage— las habría calculado todas a cero.
   *
   * Al vivir en la entidad quedan congeladas desde que se planta, que es lo que
   * el jugador ve, y viajan con la partida cuando se serializa.
   */
  statRolls?: PlantStatKey[]
  damage?: number
  attackSpeedMs?: number
  moveSpeed?: number
  lane: number // 0, 1, 2
  col?: number // 0..3 for P1 static plants
  x: number // percentage across field (15% to 85%)
  hp: number
  maxHp: number
  lastActionTime: number
  isWalking: boolean
  state: 'idle' | 'walking' | 'attacking'
  isSmashing?: boolean
  smashStartTime?: number
  isArmed?: boolean
  armedAtTime?: number
  spriteOverride?: string
  frozenUntil?: number
  isHealingFx?: boolean
  equippedItem?: string | null
}

export type EnemyPlantType =
  | 'enemy_sunflower'
  | 'enemy_peashooter'
  | 'enemy_wallnut'
  | 'enemy_chomper'
  | 'enemy_melonpult'
  | 'enemy_kernelpult'

export interface EnemyPlantConfig {
  type: EnemyPlantType
  name: string
  cost: number
  maxHp: number
  speed: number // % per second moving left
  damage: number // damage per second to plants/base
  sprite: string
  rewardSun: number
  category: 'producer' | 'ranged' | 'defensive' | 'melee'
}

export interface EnemyPlantEntity {
  id: string
  /**
   * El tipo del catálogo enemigo, para las plantas que pone el bot.
   *
   * Sigue existiendo porque el bot planta esos 5 tipos con sus propias
   * estadísticas. Para las plantas de un RIVAL DE VERDAD se rellena además
   * plantId, y entonces manda ése.
   */
  type: EnemyPlantType
  /**
   * La carta que plantó el rival, cuando la partida es contra otro jugador.
   *
   * Existe porque el rival juega con las mismas 15 plantas que tú, no con los 5
   * tipos del bot. No hace falta arte nueva: las plantas «enemigas» ya usan los
   * MISMOS ficheros de sprite que las del jugador (transparentsunflower.png es
   * el girasol de los dos lados) y el CSS ya las espeja con scaleX(-1). Es la
   * misma planta al revés.
   *
   * Cuando está puesto, las estadísticas salen de getScaledPlantConfig con
   * statRolls, igual que las del jugador — el rival no puede mandar una carta
   * mejor de la que tiene porque el mazo lo lee el servidor.
   */
  plantId?: PlantId
  /** Nivel de la carta del rival, para pintar su insignia. */
  level?: number
  /** Mejoras de la carta del rival, fijadas al plantarla. */
  statRolls?: PlantStatKey[]
  /** Soles que da al morir. Del catálogo enemigo, o del coste de la carta. */
  rewardSun?: number
  lane: number
  col?: number // 4..7 for static P2 plants
  x: number // percentage across field
  hp: number
  maxHp: number
  speed: number
  damage: number
  isWalking: boolean
  state: 'idle' | 'walking' | 'attacking'
  lastAttackTime: number
  frozenUntil?: number
}

export interface ProjectileEntity {
  id: string
  type: 'pea' | 'melon' | 'needle' | 'kernel' | 'butter'
  targetTeam: 'p1' | 'p2'
  lane: number
  x: number // current % x position
  y: number // % y position of lane
  speed: number // % width per sec (positive moves right, negative moves left)
  damage: number
  isSplash?: boolean
  freezeDurationMs?: number
  originX?: number
  originLane?: number
  targetX?: number
  targetEntityId?: string
}

export interface SunEntity {
  id: string
  x: number // percentage
  y: number // percentage
  targetY: number // percentage to fall to
  value: number
  createdAt: number
}

export type GameStatus = 'ready' | 'playing' | 'victory' | 'defeat' | 'paused'

export interface BaseTowerState {
  hp: number
  maxHp: number
}

export interface GameStats {
  sunsCollected: number
  enemyPlantsDefeated: number
  plantsPlaced: number
  score: number
}

export interface PlantCardInstance {
  instanceId: string
  plantId: PlantId
  level: number
  statRolls: import('../utils/gameConstants').PlantStatKey[]
  isBase?: boolean
  obtainedAt?: number
  germinationsCount?: number
  equippedItem?: string | null
}

export type ColosseumBetAmount = 50 | 100 | 200

export interface ColosseumMatchConfig {
  betGems: ColosseumBetAmount
  usedTicket: boolean
  payoutGems: number
  rakeGems: number
}

export interface ColosseumLeaderboardEntry {
  rank: number
  username: string
  avatarPlant: PlantId
  maxStreak: number
  prizeGems: number
  isUser?: boolean
}

export type { EngineVersion } from '../engine/simulate'
export { parseEngineVersion } from '../engine/simulate'

// ── SISTEMA DE TORNEOS AUTORITATIVO ───────────────────────────────────────────
export type TournamentStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'
export type TournamentEntryCurrency = 'free' | 'gold' | 'gems'
export type TournamentPrizeCurrency = 'gems' | 'gold' | 'item' | 'mixed'

export type TournamentPlantRule = 'all_unlocked' | 'owned_only'

export interface TournamentModel {
  id: string
  title: string
  description?: string
  creator_id?: string | null
  creator_name: string
  prize_pool_gems: number
  prize_distribution?: Record<string, number>
  status: TournamentStatus
  entry_fee_gems: number
  start_time: string
  end_time: string
  duration_minutes: number
  max_losses: number
  prizes_distributed: boolean
  participants_count?: number
  active_participants_count?: number
  entry_currency?: TournamentEntryCurrency
  entry_fee_amount?: number
  prize_currency?: TournamentPrizeCurrency
  prize_pool_amount?: number
  prize_item_id?: string | null
  prize_item_quantity?: number
  rewarded_places_count?: number
  is_test?: boolean
  plant_rule?: TournamentPlantRule
}

export interface TournamentLeaderboardItem {
  rank: number
  user_id: string
  username: string
  wins: number
  losses: number
  is_eliminated: boolean
  is_me: boolean
  prize_awarded_gems: number
  prize_awarded_gold?: number
  prize_awarded_item_id?: string | null
  prize_awarded_item_quantity?: number
}

export interface TournamentMyParticipation {
  registered: boolean
  deck?: PlantId[]
  wins?: number
  losses?: number
  is_eliminated?: boolean
  prize_awarded_gems?: number
  prize_awarded_gold?: number
  prize_awarded_item_id?: string | null
  prize_awarded_item_quantity?: number
}

export interface TournamentDetailsResponse {
  tournament: TournamentModel
  leaderboard: TournamentLeaderboardItem[]
  my_participation: TournamentMyParticipation
}

export interface CreateTournamentInput {
  title: string
  description?: string
  prize_pool_gems?: number
  entry_fee_gems?: number
  start_time?: string
  duration_minutes?: number
  prize_distribution?: Record<string, number>
  entry_currency?: TournamentEntryCurrency
  entry_fee_amount?: number
  prize_currency?: TournamentPrizeCurrency
  prize_pool_amount?: number
  prize_item_id?: string | null
  prize_item_quantity?: number
  rewarded_places_count?: number
  is_test?: boolean
  plant_rule?: TournamentPlantRule
}

// ── SISTEMA DE FORTALEZAS DE CLAN (5 CARRILES) ──────────────────────────────
export interface ClanFortressPlant {
  plantId: PlantId
  lane: number // 0..4 (5 carriles)
  col: number // 7..13 (lado defensivo del campo)
  level?: number
  statRolls?: PlantStatKey[]
  equippedItem?: string | null
}

export interface ClanFortressData {
  clanId: string
  clanName: string
  clanTag: string
  badge: string
  baseHp: number
  maxBaseHp: number
  maxHp?: number
  vaultGems: number
  vaultGold: number
  shieldUntil: string | null
  isShielded: boolean
  isNpc: boolean
  defenseSunsBudget: number
  maxDefenseSunsBudget?: number
  sunsSpent: number
  layout: ClanFortressPlant[]
  ambushes?: ClanFortressAmbush[]
  unlockedPlants?: PlantId[]
  motherTreeLevel?: number
  motherTreeWater?: number
  motherTreeFertilizer?: number
  motherTreeGems?: number
  nextTreeWaterReq?: number
  nextTreeFertReq?: number
  nextTreeGemsReq?: number
  maxMembers?: number
  initialAttackSuns?: number
  conquestDamageBonusPct?: number
  pvpDamageBonusPct?: number
  vipGoldBonusPct?: number
  dailyPassiveSuns?: number
  isMine: boolean
  canEdit: boolean
}

export interface ClanFortressAmbush {
  plantId: PlantId
  lane: number
  triggerSec: number
  col?: number
  level?: number
}

export interface ClanFortressMatchOpponent {
  targetClanId: string
  targetClanName: string
  targetClanTag: string
  targetBadge: string
  targetBaseHp: number
  targetMaxBaseHp: number
  targetVaultGems: number
  isNpc: boolean
  layout: ClanFortressPlant[]
  ambushes?: ClanFortressAmbush[]
  targetTreeLevel?: number
  activeLanes?: number
  paidWith: 'clan_gold' | 'personal_gold'
  costPaid: number
  initialAttackSuns?: number
}

export interface ClanFortressRaidResult {
  success: boolean
  starsEarned: number
  damageDealt: number
  stolenTotal: number
  stolenToUser: number
  stolenToClan: number
  goldBonus: number
  targetClanName: string
  shieldHoursGranted: number
  cooldownApplied: boolean
}

