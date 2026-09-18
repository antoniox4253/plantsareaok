import { useState, useEffect, useCallback, useMemo } from 'react'
import type { PlantId, TournamentModel, TournamentDetailsResponse, PlantCardInstance } from '../../types/game'
import { tournamentService } from '../../services/tournamentService'
import { soundManager } from '../../utils/audioManager'
import { getScaledPlantConfig } from '../../utils/gameConstants'
import { FARMING_ITEM_DEFINITIONS, type FarmingItemId } from '../../utils/pvpRewardManager'
import TournamentDeckBuilder from './TournamentDeckBuilder'
import './TournamentModal.css'

interface TournamentModalProps {
  isOpen: boolean
  onClose: () => void
  userTokens: number
  userGold?: number
  isAdmin?: boolean
  unlockedPlants?: PlantId[]
  plantInstances?: PlantCardInstance[]
  onDeductTokens: (amount: number) => boolean
  onDeductGold?: (amount: number) => boolean
  onStartTournamentMatch: (
    opponentName: string,
    tournamentId: string,
    tournamentDeck?: PlantId[]
  ) => void
}

const MONTHS_ES = [
  { value: 1, label: '01 - Enero' },
  { value: 2, label: '02 - Febrero' },
  { value: 3, label: '03 - Marzo' },
  { value: 4, label: '04 - Abril' },
  { value: 5, label: '05 - Mayo' },
  { value: 6, label: '06 - Junio' },
  { value: 7, label: '07 - Julio' },
  { value: 8, label: '08 - Agosto' },
  { value: 9, label: '09 - Septiembre' },
  { value: 10, label: '10 - Octubre' },
  { value: 11, label: '11 - Noviembre' },
  { value: 12, label: '12 - Diciembre' },
]

function formatUtcDateTime(isoOrMs: string | number): string {
  const d = new Date(isoOrMs)
  if (isNaN(d.getTime())) return ''
  const day = d.getUTCDate().toString().padStart(2, '0')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  const mon = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  const h = d.getUTCHours().toString().padStart(2, '0')
  const m = d.getUTCMinutes().toString().padStart(2, '0')
  return `${day} ${mon} ${year}, ${h}:${m} UTC`
}

export default function TournamentModal({
  isOpen,
  onClose,
  userTokens,
  userGold = 0,
  isAdmin = false,
  unlockedPlants = [],
  plantInstances = [],
  onDeductTokens,
  onDeductGold,
  onStartTournamentMatch,
}: TournamentModalProps) {
  const [tournaments, setTournaments] = useState<TournamentModel[]>([])
  const [selectedTourneyId, setSelectedTourneyId] = useState<string | null>(null)
  const [details, setDetails] = useState<TournamentDetailsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false)
  const [searchParticipant, setSearchParticipant] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'active' | 'ended'>('active')

  // Modals and steps inside Tournament
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [createStep, setCreateStep] = useState<'select_type' | 'form'>('select_type')
  const [createCategory, setCreateCategory] = useState<'free' | 'gold' | 'gems' | 'item'>('free')
  const [showDeckBuilder, setShowDeckBuilder] = useState<boolean>(false)

  // Create form states
  const [createTitle, setCreateTitle] = useState<string>('')
  const [createEntryFeeAmount, setCreateEntryFeeAmount] = useState<number>(500)
  const [createPrizeCurrency, setCreatePrizeCurrency] = useState<'gems' | 'gold' | 'item'>('gems')
  const [createPrizePoolAmount, setCreatePrizePoolAmount] = useState<number>(1000)
  const [createPrizeItemId, setCreatePrizeItemId] = useState<string>('champion_belt')
  const [createPrizeItemQuantity, setCreatePrizeItemQuantity] = useState<number>(1)
  const [createPlacesCount, setCreatePlacesCount] = useState<1 | 3 | 5 | 10>(3)
  const [createIsTest, setCreateIsTest] = useState<boolean>(false)
  const [createPlantRule, setCreatePlantRule] = useState<'all_unlocked' | 'owned_only'>('all_unlocked')
  const [createStartOffsetMin, setCreateStartOffsetMin] = useState<number>(5)
  const [createDurationMin, setCreateDurationMin] = useState<number>(120)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState<boolean>(false)
  const [isReentering, setIsReentering] = useState<boolean>(false)
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false)

  // Custom UTC Date States (Siempre del año actual)
  const [startMode, setStartMode] = useState<'quick' | 'custom_utc'>('quick')
  const currentYear = useMemo(() => new Date().getUTCFullYear(), [])
  const [customMonth, setCustomMonth] = useState<number>(() => new Date().getUTCMonth() + 1)
  const [customDay, setCustomDay] = useState<number>(() => new Date().getUTCDate())
  const [customHour, setCustomHour] = useState<number>(() => {
    const h = new Date().getUTCHours()
    const m = new Date().getUTCMinutes()
    return m >= 50 ? (h + 1) % 24 : h
  })
  const [customMinute, setCustomMinute] = useState<number>(() => {
    const m = new Date().getUTCMinutes() + 15
    return m % 60
  })

  // Días máximos según el mes seleccionado del año actual
  const maxDaysInSelectedMonth = useMemo(() => {
    if (customMonth === 2) {
      const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0)
      return isLeap ? 29 : 28
    }
    if ([4, 6, 9, 11].includes(customMonth)) return 30
    return 31
  }, [customMonth, currentYear])

  useEffect(() => {
    if (customDay > maxDaysInSelectedMonth) {
      setCustomDay(maxDaysInSelectedMonth)
    }
  }, [maxDaysInSelectedMonth, customDay])

  // Ticker for countdowns
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Timestamp meta para la fecha UTC personalizada
  const customUtcTargetMs = useMemo(() => {
    return Date.UTC(currentYear, customMonth - 1, customDay, customHour, customMinute, 0)
  }, [currentYear, customMonth, customDay, customHour, customMinute])

  const isCustomUtcInFuture = customUtcTargetMs > currentTime

  // Load tournaments list
  const loadTournaments = useCallback(async () => {
    setLoading(true)
    try {
      const list = await tournamentService.listTournaments()
      setTournaments(list)
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const tourneyParam = urlParams?.get('tourney')
      if (tourneyParam && list.some((t) => t.id === tourneyParam)) {
        setSelectedTourneyId(tourneyParam)
      } else if (list.length > 0 && !selectedTourneyId) {
        setSelectedTourneyId(list[0].id)
      }
    } catch (err) {
      console.warn('Error loading tournaments:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedTourneyId])

  // Load selected tournament details
  const loadDetails = useCallback(async (tourneyId: string) => {
    setLoadingDetails(true)
    try {
      const res = await tournamentService.getTournamentDetails(tourneyId)
      setDetails(res)
    } catch (err) {
      console.warn('Error loading tournament details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      void loadTournaments()
    }
  }, [isOpen, loadTournaments])

  useEffect(() => {
    if (selectedTourneyId) {
      setSearchParticipant('')
      setDetails(null)
      void loadDetails(selectedTourneyId)
    }
  }, [selectedTourneyId, loadDetails])

  // Active or ended filtered lists
  const filteredTournaments = useMemo(() => {
    if (activeTab === 'active') {
      return tournaments.filter((t) => t.status === 'live' || t.status === 'scheduled')
    }
    return tournaments.filter((t) => t.status === 'ended' || t.status === 'cancelled')
  }, [tournaments, activeTab])

  const displayedLeaderboard = useMemo(() => {
    if (!details?.leaderboard || details?.tournament?.id !== selectedTourneyId) return []
    const list = details.leaderboard
    if (!searchParticipant.trim()) return list
    const q = searchParticipant.toLowerCase().trim()
    return list.filter((p) =>
      p.username.toLowerCase().includes(q) || (p.is_me && (q === 'tu' || q === 'tú' || q === 'yo'))
    )
  }, [details, selectedTourneyId, searchParticipant])

  const selectedTourney = useMemo(() => {
    if (details?.tournament && details.tournament.id === selectedTourneyId) {
      return details.tournament
    }
    return tournaments.find((t) => t.id === selectedTourneyId) || null
  }, [details, tournaments, selectedTourneyId])

  const myPart = useMemo(() => {
    if (details?.tournament && details.tournament.id === selectedTourneyId) {
      return details.my_participation
    }
    return null
  }, [details, selectedTourneyId])

  if (!isOpen) return null

  // Time calculations for selected tournament
  const startMs = selectedTourney ? new Date(selectedTourney.start_time).getTime() : 0
  const endMs = selectedTourney ? new Date(selectedTourney.end_time).getTime() : 0

  const isLive = selectedTourney ? currentTime >= startMs && currentTime < endMs : false
  const isScheduled = selectedTourney ? currentTime < startMs : false
  const isEnded = selectedTourney ? currentTime >= endMs || selectedTourney.status === 'ended' : false

  // Tolerancia estricta de 15 minutos tras el inicio del torneo para inscripciones tardías
  const isStarted = isLive || (startMs > 0 && currentTime >= startMs)
  const lateRegDeadlineMs = startMs > 0 ? startMs + 15 * 60 * 1000 : 0
  const isLateRegistrationClosed = isStarted && lateRegDeadlineMs > 0 && currentTime > lateRegDeadlineMs
  const lateRegRemainingSec = isStarted && lateRegDeadlineMs > 0 && currentTime <= lateRegDeadlineMs
    ? Math.max(0, Math.floor((lateRegDeadlineMs - currentTime) / 1000))
    : 0

  const formatCountdown = (targetMs: number) => {
    const diffSecs = Math.max(0, Math.floor((targetMs - currentTime) / 1000))
    const days = Math.floor(diffSecs / 86400)
    const h = Math.floor((diffSecs % 86400) / 3600)
    const m = Math.floor((diffSecs % 3600) / 60)
    const s = diffSecs % 60
    if (days > 0) {
      return `${days}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`
    }
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Selector previo de modalidad de torneo
  const handleSelectCategory = (cat: 'free' | 'gold' | 'gems' | 'item') => {
    soundManager.playSound('click', 0.4)
    setCreateCategory(cat)
    setCreateError(null)

    if (cat === 'free') {
      setCreateTitle('Copa Relámpago Free')
      setCreatePrizeCurrency('gems')
      setCreatePrizePoolAmount(1000)
      setCreateEntryFeeAmount(0)
      setCreatePlacesCount(3)
    } else if (cat === 'gold') {
      setCreateTitle('Gran Torneo de Oro')
      setCreatePrizeCurrency('gold')
      setCreatePrizePoolAmount(5000)
      setCreateEntryFeeAmount(500)
      setCreatePlacesCount(3)
      setCreateIsTest(false)
    } else if (cat === 'gems') {
      setCreateTitle('Copa Máster de Gemas')
      setCreatePrizeCurrency('gems')
      setCreatePrizePoolAmount(1000)
      setCreateEntryFeeAmount(50)
      setCreatePlacesCount(3)
    } else if (cat === 'item') {
      setCreateTitle('Torneo de Gladiadores: Cinturón de Campeón')
      setCreatePrizeCurrency('item')
      setCreatePrizePoolAmount(500)
      setCreateEntryFeeAmount(100)
      setCreatePrizeItemId('champion_belt')
      setCreatePrizeItemQuantity(1)
      setCreatePlacesCount(1)
    }

    setCreatePlantRule('all_unlocked')
    setCreateStep('form')
  }

  // Registration handler (Free entry, Gold or Gems)
  const handleRegister = async () => {
    if (!selectedTourney) return
    if (isLateRegistrationClosed) {
      alert('El torneo ya comenzó y el plazo de tolerancia de 15 minutos para registros tardíos ha expirado. Ya no se permiten nuevas inscripciones en este torneo.')
      return
    }

    const entryCurr = selectedTourney.entry_currency || (selectedTourney.entry_fee_gems > 0 ? 'gems' : 'free')
    const fee = selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems ?? 0

    if (entryCurr === 'gold' && fee > 0) {
      if ((userGold || 0) < fee) {
        alert(`No tienes suficiente Oro (${fee.toLocaleString()} 🟡 requeridos) para inscribirte. Tu saldo actual es: ${(userGold || 0).toLocaleString()} 🟡.`)
        return
      }
    } else if (entryCurr === 'gems' && fee > 0) {
      if (userTokens < fee) {
        alert(`No tienes suficientes Gemas (${fee} 💎 requeridas) para inscribirte. Tu saldo actual es: ${userTokens.toFixed(2)} 💎.`)
        return
      }
    }

    soundManager.playSound('victory', 0.7)
    const res = await tournamentService.registerParticipant(selectedTourney.id)
    if (res.success) {
      if (entryCurr === 'gold' && fee > 0) {
        onDeductGold?.(fee)
      } else if (entryCurr === 'gems' && fee > 0) {
        onDeductTokens(fee)
      }
      await loadDetails(selectedTourney.id)
      await loadTournaments()
    } else {
      alert(res.error || 'No se pudo completar la inscripción.')
    }
  }

  // Reentry handler (200 gems for 2 lives)
  const handleReenter = async () => {
    if (!selectedTourney || !details?.my_participation?.registered) return
    const reentryCost = 200
    if (userTokens < reentryCost) {
      alert(`Necesitas ${reentryCost} 💎 para reentrar al torneo. Tu saldo actual es: ${userTokens.toFixed(2)} 💎.`)
      return
    }

    setIsReentering(true)
    try {
      soundManager.playSound('victory', 0.8)
      const res = await tournamentService.reenterTournament(selectedTourney.id)
      if (res.success) {
        onDeductTokens(reentryCost)
        await loadDetails(selectedTourney.id)
        await loadTournaments()
      } else {
        alert(res.error || 'No se pudo procesar la reentrada.')
      }
    } catch (err: any) {
      alert(err?.message || 'Error en reentrada')
    } finally {
      setIsReentering(false)
    }
  }

  // Finalize tournament handler (Distribute pool and items)
  const handleFinalizeTournament = async () => {
    if (!selectedTourney) return
    const pool = Number(selectedTourney.prize_pool_amount ?? selectedTourney.prize_pool_gems ?? 0)
    const currName = selectedTourney.prize_currency === 'gold' ? 'Oro' : 'Gemas'
    const currSym = selectedTourney.prize_currency === 'gold' ? '🟡' : '💎'
    const places = selectedTourney.rewarded_places_count || 3
    const itemMsg = selectedTourney.prize_item_id
      ? `\n🎁 Ítem para el Campeón: ${FARMING_ITEM_DEFINITIONS[selectedTourney.prize_item_id as keyof typeof FARMING_ITEM_DEFINITIONS]?.label || selectedTourney.prize_item_id}`
      : ''

    const confirmReparto = window.confirm(
      `¿Deseas liquidar y repartir los premios del torneo?\n\n` +
      `🏆 Pozo Oficial: ${pool.toLocaleString()} ${currName} ${currSym}\n` +
      `👥 Puestos premiados: Top ${places}${itemMsg}\n\n` +
      `Esta acción acreditará las recompensas inmediatamente a los ganadores.`
    )
    if (!confirmReparto) return

    setIsFinalizing(true)
    try {
      soundManager.playSound('victory', 0.9)
      const res = await tournamentService.finalizeTournament(selectedTourney.id)
      if (res.success) {
        alert('🎉 ¡Premios y recompensas liquidados y repartidos exitosamente a los ganadores del torneo!')
        await loadDetails(selectedTourney.id)
        await loadTournaments()
      } else {
        alert(res.error || 'No se pudieron repartir los premios del torneo.')
      }
    } catch (err: any) {
      alert(err?.message || 'Error al liquidar premios')
    } finally {
      setIsFinalizing(false)
    }
  }

  // Deck save handler (authoritative 5-plant tourney deck)
  const handleSaveDeck = async (newDeck: PlantId[]) => {
    if (!selectedTourney) return
    const res = await tournamentService.updateTournamentDeck(selectedTourney.id, newDeck)
    if (res.success) {
      setShowDeckBuilder(false)
      await loadDetails(selectedTourney.id)
    } else {
      alert(res.error || 'No se pudo guardar el mazo.')
    }
  }

  // Start matchmaking handler
  const handleStartMatchmaking = () => {
    if (!selectedTourney || !details?.my_participation?.registered) return
    const myPart = details.my_participation
    if (myPart.is_eliminated || (myPart.losses && myPart.losses >= 3)) {
      alert('Has quedado eliminado de este torneo tras alcanzar 3 derrotas.')
      return
    }
    if (!isLive) {
      alert('El torneo aún no ha comenzado o ya ha finalizado.')
      return
    }

    soundManager.playSound('click', 0.5)

    const myDeck: PlantId[] = myPart.deck && myPart.deck.length >= 5
      ? (myPart.deck as PlantId[])
      : ['sunflower', 'peashooter', 'wallnut', 'chomper', 'repeater']

    // Cerramos el modal de torneos y activamos la búsqueda autoritativa en tiempo real (0 bots)
    onClose()
    onStartTournamentMatch('', selectedTourney.id, myDeck)
  }

  // Create tournament submit
  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!createTitle.trim()) {
      setCreateError('Por favor escribe un título para el torneo.')
      return
    }

    setIsCreating(true)
    try {
      // Calculate start time
      let startTime: string
      if (startMode === 'custom_utc') {
        const targetMs = Date.UTC(currentYear, customMonth - 1, customDay, customHour, customMinute, 0)
        if (targetMs <= Date.now()) {
          setCreateError('La fecha y hora en UTC debe ser en el futuro (posterior al momento actual).')
          setIsCreating(false)
          return
        }
        startTime = new Date(targetMs).toISOString()
      } else {
        startTime = new Date(Date.now() + createStartOffsetMin * 60 * 1000).toISOString()
      }

      let entryCurr: 'free' | 'gold' | 'gems' = 'free'
      let entryFee = 0
      if (createCategory === 'gold') {
        entryCurr = 'gold'
        entryFee = createEntryFeeAmount
      } else if (createCategory === 'gems' || createCategory === 'item') {
        entryCurr = 'gems'
        entryFee = createEntryFeeAmount
      }

      let prizeCurr: 'gems' | 'gold' | 'item' = 'gems'
      if (createCategory === 'free') {
        prizeCurr = 'gems'
      } else if (createCategory === 'gold' || createCategory === 'gems') {
        prizeCurr = createPrizeCurrency
      } else if (createCategory === 'item') {
        prizeCurr = 'item'
      }

      let distribution: Record<string, number> = { top1: 50, top2: 30, top3: 20 }
      if (createPlacesCount === 1) {
        distribution = { top1: 100 }
      } else if (createPlacesCount === 5) {
        distribution = { top1: 40, top2: 25, top3: 15, top4: 10, top5: 10 }
      } else if (createPlacesCount === 10) {
        distribution = { top1: 30, top2: 20, top3: 15, top4: 10, top5: 7, top6: 5, top7: 5, top8: 3, top9: 3, top10: 2 }
      }

      const res = await tournamentService.createTournament({
        title: createTitle,
        prize_pool_gems: prizeCurr === 'gems' ? createPrizePoolAmount : 0,
        entry_fee_gems: entryCurr === 'gems' ? entryFee : 0,
        start_time: startTime,
        duration_minutes: createDurationMin,
        prize_distribution: distribution,
        entry_currency: entryCurr,
        entry_fee_amount: entryFee,
        prize_currency: prizeCurr,
        prize_pool_amount: createPrizePoolAmount,
        prize_item_id: createCategory === 'item' ? createPrizeItemId : undefined,
        prize_item_quantity: createCategory === 'item' ? createPrizeItemQuantity : 1,
        rewarded_places_count: createPlacesCount,
        is_test: createCategory === 'gold' ? false : createIsTest,
        plant_rule: createCategory === 'free' ? 'all_unlocked' : createPlantRule,
      })

      if (!res.success) {
        setCreateError(res.error || 'Error al crear torneo')
        return
      }

      soundManager.playSound('plantation', 0.8)
      setShowCreateModal(false)
      setCreateStep('select_type')
      setCreateTitle('')
      await loadTournaments()
      if (res.tournament_id) {
        setSelectedTourneyId(res.tournament_id)
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Error inesperado')
    } finally {
      setIsCreating(false)
    }
  }

  const myLosses = myPart?.losses ?? 0
  const isMyPartEliminated = myPart?.is_eliminated || myLosses >= 3
  const activeDeckList = myPart?.deck || ['sunflower', 'peashooter', 'wallnut', 'chomper', 'repeater']

  return (
    <div className="tourney-backdrop" onClick={onClose}>
      <div className="tourney-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="tourney-header">
          <div className="tourney-header__title-box">
            <span className="tourney-header__icon">🏆</span>
            <div className="tourney-header__title-text">
              <h2 className="tourney-header__title">Lobby de Torneos</h2>
              <p className="tourney-header__subtitle">
                Entrada gratuita • Todos contra todos • Todas las cartas desbloqueadas • Límite 3 derrotas
              </p>
            </div>
          </div>

          <div className="tourney-header__actions">
            <div className="tourney-header__balances">
              <div className="tourney-badge--gems">
                <span>💎</span>
                <span>{userTokens.toFixed(2)} Gemas</span>
              </div>
              <div className="tourney-badge--gold">
                <span>🟡</span>
                <span>{(userGold || 0).toLocaleString()} Oro</span>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="tourney-btn-create"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setCreateStep('select_type')
                  setShowCreateModal(true)
                }}
              >
                <span>➕</span>
                <span>Crear Torneo</span>
              </button>
            )}

            <button
              type="button"
              className="tourney-close-btn"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="tourney-tabs">
          <button
            type="button"
            className={`tourney-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.3)
              setActiveTab('active')
            }}
          >
            🔥 En Vivo / Próximos
          </button>
          <button
            type="button"
            className={`tourney-tab-btn ${activeTab === 'ended' ? 'active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.3)
              setActiveTab('ended')
            }}
          >
            🏁 Finalizados
          </button>
        </div>

        {/* MAIN LAYOUT */}
        <div className="tourney-layout">
          {/* TOURNAMENT LIST PANEL */}
          <div className="tourney-list-panel">
            {loading && tournaments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                Cargando torneos…
              </div>
            ) : filteredTournaments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8', fontSize: '0.9rem' }}>
                No hay torneos en esta sección.
                {isAdmin && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="tourney-btn-create"
                      style={{ margin: '0 auto', fontSize: '0.8rem' }}
                      onClick={() => {
                        setCreateStep('select_type')
                        setShowCreateModal(true)
                      }}
                    >
                      ➕ ¡Crea el primer torneo!
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredTournaments.map((t) => {
                const isSel = t.id === selectedTourneyId
                const tStart = new Date(t.start_time).getTime()
                const tEnd = new Date(t.end_time).getTime()
                const tLive = currentTime >= tStart && currentTime < tEnd
                const tSched = currentTime < tStart

                return (
                  <div
                    key={t.id}
                    className={`tourney-card-item ${isSel ? 'selected' : ''}`}
                    onClick={() => {
                      soundManager.playSound('click', 0.3)
                      setSelectedTourneyId(t.id)
                    }}
                  >
                    <div className="tourney-card-top">
                      <div className="tourney-card-tags">
                        <span
                          className={`tourney-status-badge ${
                            tLive ? 'live' : tSched ? 'scheduled' : 'ended'
                          }`}
                        >
                          {tLive ? '● EN VIVO' : tSched ? '⏳ PROGRAMADO' : '🏁 FINALIZADO'}
                        </span>
                        {t.is_test && (
                          <span className="tourney-test-badge">🧪 PRUEBA</span>
                        )}
                        <span className={`tourney-rule-badge ${t.plant_rule === 'owned_only' ? 'owned' : 'free'}`}>
                          {t.plant_rule === 'owned_only' ? '🌿 Propias' : '🌟 15 Libres'}
                        </span>
                      </div>
                      <div className="tourney-card-fee">
                        {t.entry_currency === 'gold' && (t.entry_fee_amount ?? 0) > 0 ? (
                          <span className="tourney-fee-badge--gold">🟡 {t.entry_fee_amount?.toLocaleString()} ORO</span>
                        ) : (t.entry_currency === 'gems' || t.entry_fee_gems > 0) && ((t.entry_fee_amount ?? t.entry_fee_gems) > 0) ? (
                          <span className="tourney-fee-badge">💎 {t.entry_fee_amount ?? t.entry_fee_gems} GEMAS</span>
                        ) : (
                          <span className="tourney-free-badge">🎉 GRATIS</span>
                        )}
                      </div>
                    </div>

                    <h4 className="tourney-card-title">{t.title}</h4>

                    <div className="tourney-card-meta">
                      {t.prize_item_id ? (
                        <span className="tourney-card-prize-item">
                          🎁 {FARMING_ITEM_DEFINITIONS[t.prize_item_id as keyof typeof FARMING_ITEM_DEFINITIONS]?.label || t.prize_item_id}
                          {Number(t.prize_pool_amount ?? t.prize_pool_gems ?? 0) > 0 && ` + ${Number(t.prize_pool_amount ?? t.prize_pool_gems).toLocaleString()} 💎`}
                        </span>
                      ) : t.prize_currency === 'gold' ? (
                        <span className="tourney-card-prize-gold">
                          🟡 Pozo: {Number(t.prize_pool_amount ?? 0).toLocaleString()} Oro
                        </span>
                      ) : (
                        <span className="tourney-card-prize-gems">
                          💎 Pozo: {Number(t.prize_pool_amount ?? t.prize_pool_gems ?? 0).toLocaleString()} Gemas
                        </span>
                      )}
                      <span className="tourney-card-participants">
                        👥 {t.participants_count || 1}
                      </span>
                    </div>

                    <div className="tourney-card-countdown">
                      {tLive ? (
                        <span className="tourney-countdown-live">🔥 Termina en: {formatCountdown(tEnd)}</span>
                      ) : tSched ? (
                        <div className="tourney-countdown-sched">
                          <span>⏳ Inicia en: {formatCountdown(tStart)}</span>
                          <span className="tourney-countdown-date">📅 {formatUtcDateTime(tStart)}</span>
                        </div>
                      ) : (
                        <span className="tourney-countdown-ended">🏁 Torneo concluido</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* TOURNAMENT DETAIL PANEL */}
          {selectedTourney ? (
            <div className="tourney-detail-panel">
              {/* BANNER WITH REALTIME CLOCK */}
              <div className="tourney-detail-banner">
                <div className="tourney-banner-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{selectedTourney.title}</h3>
                    {selectedTourney.is_test && (
                      <span className="tourney-test-badge">🧪 Torneo de Prueba Admin</span>
                    )}
                    {selectedTourney.plant_rule === 'owned_only' ? (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fde047' }}>
                        🌿 Solo Plantas Propias
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', color: '#bae6fd' }}>
                        🌟 15 Plantas Libres
                      </span>
                    )}
                    {selectedTourney.is_test && (
                      <button
                        type="button"
                        className="tourney-btn-deck"
                        style={{
                          background: 'rgba(6, 182, 212, 0.25)',
                          borderColor: '#06b6d4',
                          color: '#a5f3fc',
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}?tourney=${selectedTourney.id}`
                          navigator.clipboard.writeText(url)
                          alert(
                            `📋 ¡Enlace de prueba copiado al portapapeles!\n\n${url}\n\n` +
                            `Envíaselo a tus amigos para que entren desde este preview. Podrán ver el torneo e inscribirse para jugar contigo. En producción (main) nadie más lo verá.`
                          )
                        }}
                      >
                        🔗 Invitar Testers (Copiar Link)
                      </button>
                    )}
                  </div>
                  <p style={{ marginTop: 4 }}>
                    Organizado por <strong>{selectedTourney.creator_name}</strong> •{' '}
                    {selectedTourney.entry_currency === 'gold' && (selectedTourney.entry_fee_amount ?? 0) > 0
                      ? `Entrada: ${(selectedTourney.entry_fee_amount ?? 0).toLocaleString()} 🟡 Oro`
                      : (selectedTourney.entry_currency === 'gems' || selectedTourney.entry_fee_gems > 0) && ((selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems) > 0)
                      ? `Entrada: ${selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems} 💎 Gemas`
                      : 'Entrada 100% Gratuita'}
                  </p>
                  <p style={{ color: '#c084fc', fontSize: '0.85rem', marginTop: 4 }}>
                    {selectedTourney.prize_item_id ? (
                      <span>
                        🎁 Premio Principal: <strong>{FARMING_ITEM_DEFINITIONS[selectedTourney.prize_item_id as keyof typeof FARMING_ITEM_DEFINITIONS]?.label || selectedTourney.prize_item_id}</strong>
                        {Number(selectedTourney.prize_pool_amount ?? selectedTourney.prize_pool_gems ?? 0) > 0 &&
                          ` + ${Number(selectedTourney.prize_pool_amount ?? selectedTourney.prize_pool_gems).toLocaleString()} Gemas`}
                      </span>
                    ) : selectedTourney.prize_currency === 'gold' ? (
                      <span>
                        🟡 Pozo Oficial: <strong>{Number(selectedTourney.prize_pool_amount ?? 0).toLocaleString()} Oro</strong> (Top {selectedTourney.rewarded_places_count || 3})
                      </span>
                    ) : (
                      <span>
                        💎 Pozo de Premios: <strong>{Number(selectedTourney.prize_pool_amount ?? selectedTourney.prize_pool_gems ?? 0).toLocaleString()} Gemas</strong> (Top {selectedTourney.rewarded_places_count || 3})
                      </span>
                    )}
                  </p>
                </div>

                <div className="tourney-timer-big">
                  <div className="tourney-timer-big__label">
                    {isLive ? 'Tiempo Restante' : isScheduled ? 'Comienza En' : 'Estado'}
                  </div>
                  <div className="tourney-timer-big__time">
                    {isLive
                      ? formatCountdown(endMs)
                      : isScheduled
                      ? formatCountdown(startMs)
                      : 'FINALIZADO'}
                  </div>
                  {isScheduled && (
                    <div style={{ fontSize: '0.66rem', color: '#cbd5e1', marginTop: 2 }}>
                      📅 {formatUtcDateTime(startMs)}
                    </div>
                  )}
                </div>
              </div>

              {/* PLAYER CARD (STATUS, 3 LOSSES, DECK, SEARCH MATCH) */}
              <div className="tourney-player-card">
                <div className="tourney-player-header">
                  <h4>Tu Estado en el Torneo</h4>
                  {myPart?.registered ? (
                    <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: 700 }}>
                      ✓ Inscrito
                    </span>
                  ) : (
                    <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700 }}>
                      No inscrito
                    </span>
                  )}
                </div>

                {!myPart?.registered ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    {isLateRegistrationClosed ? (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          borderRadius: 12,
                          padding: '16px 20px',
                          maxWidth: 520,
                          margin: '0 auto',
                        }}
                      >
                        <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>🔒</div>
                        <h4 style={{ color: '#f87171', margin: '0 0 6px 0', fontSize: '1.02rem', fontWeight: 700 }}>
                          Inscripciones Cerradas
                        </h4>
                        <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: 0, lineHeight: 1.45 }}>
                          El torneo ya comenzó y venció el plazo de tolerancia de 15 minutos para registros tardíos. 
                          No se admiten nuevas inscripciones para evitar ventajas y uso de multicuentas en los últimos minutos.
                        </p>
                      </div>
                    ) : (
                      <>
                        {isStarted && lateRegRemainingSec > 0 && (
                          <div
                            style={{
                              background: 'rgba(234, 179, 8, 0.15)',
                              border: '1px solid rgba(234, 179, 8, 0.4)',
                              borderRadius: 8,
                              padding: '8px 14px',
                              marginBottom: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              color: '#fde047',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          >
                            <span>⏱️</span>
                            <span>
                              Plazo de tolerancia activo: te quedan {Math.floor(lateRegRemainingSec / 60)}m {(lateRegRemainingSec % 60).toString().padStart(2, '0')}s para inscribirte.
                            </span>
                          </div>
                        )}
                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginBottom: 12 }}>
                          {selectedTourney.entry_currency === 'gold' && (selectedTourney.entry_fee_amount ?? 0) > 0
                            ? `Costo de Inscripción: ${(selectedTourney.entry_fee_amount ?? 0).toLocaleString()} 🟡 Oro. Tu saldo actual: ${(userGold || 0).toLocaleString()} 🟡.`
                            : (selectedTourney.entry_currency === 'gems' || selectedTourney.entry_fee_gems > 0) && ((selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems) > 0)
                            ? `Costo de Inscripción: ${selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems} 💎 Gemas. Tu saldo: ${userTokens.toFixed(2)} 💎.`
                            : '¡La entrada es completamente gratis! Inscríbete para armar tu mazo con todas las cartas desbloqueadas y competir.'}
                        </p>
                        <button
                          type="button"
                          className="tourney-btn-create"
                          style={{ margin: '0 auto', padding: '10px 24px', fontSize: '0.95rem' }}
                          onClick={handleRegister}
                        >
                          {selectedTourney.entry_currency === 'gold' && (selectedTourney.entry_fee_amount ?? 0) > 0
                            ? `🎟️ Inscribirme con ${(selectedTourney.entry_fee_amount ?? 0).toLocaleString()} 🟡 Oro`
                            : (selectedTourney.entry_currency === 'gems' || selectedTourney.entry_fee_gems > 0) && ((selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems) > 0)
                            ? `🎟️ Inscribirme con ${selectedTourney.entry_fee_amount ?? selectedTourney.entry_fee_gems} 💎 Gemas`
                            : '📝 Inscribirme Gratis al Torneo'}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="tourney-stats-row">
                      {/* VICTORIAS */}
                      <div className="tourney-stat-box">
                        <div className="tourney-stat-box__label">Victorias</div>
                        <div className="tourney-stat-box__value" style={{ color: '#4ade80' }}>
                          {myPart.wins || 0} 🏆
                        </div>
                      </div>

                      {/* 3 VIDAS / DERROTAS */}
                      <div className="tourney-stat-box">
                        <div className="tourney-stat-box__label">
                          Vidas (Límite 3 Derrotas)
                        </div>
                        <div className="tourney-lives-indicator">
                          {[1, 2, 3].map((lifeNum) => {
                            const isLost = myLosses >= lifeNum
                            return (
                              <span
                                key={lifeNum}
                                className={`tourney-life-badge ${isLost ? 'lost' : 'active'}`}
                                title={isLost ? `Derrota #${lifeNum}` : 'Vida disponible'}
                              >
                                {isLost ? '❌' : '💚'}
                              </span>
                            )
                          })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>
                          {myLosses} / 3 derrotas
                        </div>
                      </div>

                      {/* MAZO MINI PREVIEW */}
                      <div className="tourney-deck-preview">
                        <div className="tourney-deck-preview__plants">
                          {activeDeckList.map((pid, idx) => {
                            const inst = plantInstances?.find((i) => i.plantId === pid && i.equippedItem) ||
                                         plantInstances?.find((i) => i.plantId === pid) ||
                                         null
                            const rolls = inst?.statRolls ?? []
                            const equippedItem = inst?.equippedItem ?? null
                            const cfg = getScaledPlantConfig(pid, rolls, equippedItem)
                            return (
                              <div key={idx} style={{ position: 'relative', display: 'inline-block' }}>
                                <img
                                  src={cfg?.icon || cfg?.sprite}
                                  alt={cfg?.name || pid}
                                  className="tourney-deck-mini-icon"
                                  title={`${cfg?.name}${equippedItem ? ' (🥊 Ítem Equipado)' : ''}`}
                                />
                                {equippedItem && (
                                  <span
                                    style={{
                                      position: 'absolute',
                                      bottom: -2,
                                      right: -2,
                                      fontSize: '0.65rem',
                                      background: 'rgba(0,0,0,0.85)',
                                      borderRadius: '50%',
                                      lineHeight: 1,
                                      padding: '1px',
                                      border: '1px solid #f59e0b',
                                    }}
                                    title="Ítem equipado"
                                  >
                                    🥊
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <button
                          type="button"
                          className="tourney-btn-deck"
                          onClick={() => setShowDeckBuilder(true)}
                        >
                          🃏 Mazo
                        </button>
                      </div>
                    </div>

                    {/* PLAY MATCH BUTTON OR ELIMINATED BANNER */}
                    <div className="tourney-play-box">
                      {isMyPartEliminated ? (
                        <div className="tourney-eliminated-box">
                          <div className="tourney-eliminated-banner">
                            🚫 Has quedado eliminado del torneo (3/3 derrotas acumuladas).
                          </div>
                          {isLive && (
                            <div className="tourney-reentry-box">
                              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '4px 0 10px' }}>
                                ¡El torneo sigue en vivo! Puedes hacer una <strong>Reentrada</strong> conservando todas tus victorias previas.
                              </p>
                              <button
                                type="button"
                                className="tourney-btn-reentry"
                                onClick={handleReenter}
                                disabled={isReentering}
                              >
                                {isReentering ? 'Procesando Reentrada…' : '🔄 Reentrar al Torneo (200 💎 — 2 Vidas)'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : isScheduled ? (
                        <button
                          type="button"
                          className="tourney-btn-battle"
                          disabled
                        >
                          ⏳ Esperando Hora de Inicio ({formatCountdown(startMs)})
                        </button>
                      ) : isEnded ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                          <button
                            type="button"
                            className="tourney-btn-battle"
                            disabled
                          >
                            🏁 Torneo Finalizado
                          </button>
                          {isAdmin && !selectedTourney.prizes_distributed && (
                            <button
                              type="button"
                              className="tourney-btn-reentry"
                              style={{
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                borderColor: '#fde047',
                                color: '#1a1000',
                                fontWeight: 900,
                                padding: '12px 16px',
                                fontSize: '0.92rem',
                                boxShadow: '0 0 20px rgba(245, 158, 11, 0.45)',
                              }}
                              onClick={handleFinalizeTournament}
                              disabled={isFinalizing}
                            >
                              {isFinalizing ? '⏳ Repartiendo Premios…' : '🏆 Liquidar y Repartir Premios'}
                            </button>
                          )}
                          {selectedTourney.prizes_distributed && (
                            <div style={{ textAlign: 'center', color: '#4ade80', fontSize: '0.85rem', fontWeight: 800, background: 'rgba(74, 222, 128, 0.12)', padding: '8px 12px', borderRadius: 8, border: '1px solid #22c55e' }}>
                              ✅ Premios del pozo liquidados y entregados a los ganadores.
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="tourney-btn-battle"
                          onClick={handleStartMatchmaking}
                        >
                          <span>⚔️</span>
                          <span>Buscar Rival de Torneo</span>
                        </button>
                      )}
                    </div>

                  </>
                )}
              </div>

              {/* LEADERBOARD (CLASIFICACIÓN COMPLETA Y PARTICIPANTES) */}
              <div className="tourney-lb-section">
                <div className="tourney-lb-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>
                      {isLive
                        ? 'Tabla de Clasificación en Vivo'
                        : isEnded
                        ? 'Tabla de Clasificación Final'
                        : 'Participantes Inscritos'}
                    </span>
                    <span
                      style={{
                        background: 'rgba(192, 132, 252, 0.18)',
                        border: '1px solid rgba(192, 132, 252, 0.45)',
                        color: '#e9d5ff',
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 800,
                      }}
                    >
                      👥 {details?.leaderboard ? `${details.leaderboard.length} participantes` : 'Cargando…'}
                    </span>
                  </div>
                  <span style={{ color: '#c084fc', fontSize: '0.76rem' }}>
                    Ordenado por Victorias DESC
                  </span>
                </div>

                {/* FILTRO DE BÚSQUEDA RÁPIDA DE PARTICIPANTE */}
                {details?.leaderboard && details.leaderboard.length > 5 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 2px' }}>
                    <input
                      type="text"
                      className="tourney-form-input"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.8rem',
                        background: 'rgba(15, 23, 42, 0.85)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        borderRadius: 8,
                        color: '#fff',
                        width: '100%',
                        maxWidth: 320,
                      }}
                      placeholder={`🔍 Buscar entre los ${details.leaderboard.length} participantes...`}
                      value={searchParticipant}
                      onChange={(e) => setSearchParticipant(e.target.value)}
                    />
                    {searchParticipant && (
                      <button
                        type="button"
                        onClick={() => setSearchParticipant('')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid #ef4444',
                          color: '#fca5a5',
                          borderRadius: 6,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                        }}
                      >
                        ✕ Limpiar
                      </button>
                    )}
                  </div>
                )}

                <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                  <table className="tourney-lb-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jugador</th>
                        <th>Victorias</th>
                        <th>Derrotas</th>
                        <th>Estado</th>
                        <th>Premio {isEnded ? 'Obtenido' : 'Estimado'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingDetails && !details ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                            ⏳ Cargando participantes inscritos…
                          </td>
                        </tr>
                      ) : displayedLeaderboard.length > 0 ? (
                        displayedLeaderboard.map((row) => {
                          let prizeText = '—'
                          const pool = Number(selectedTourney.prize_pool_amount ?? selectedTourney.prize_pool_gems ?? 0)
                          const prizeCurr = selectedTourney.prize_currency || 'gems'
                          const sym = prizeCurr === 'gold' ? '🟡' : '💎'
                          const places = selectedTourney.rewarded_places_count || 3

                          if (isEnded) {
                            const parts: string[] = []
                            if (row.prize_awarded_gold && row.prize_awarded_gold > 0) {
                              const goldVal = Number(row.prize_awarded_gold)
                              parts.push(`${goldVal % 1 === 0 ? goldVal.toLocaleString() : goldVal.toFixed(2)} 🟡`)
                            }
                            if (row.prize_awarded_gems && row.prize_awarded_gems > 0) {
                              const gemsVal = Number(row.prize_awarded_gems)
                              parts.push(`${gemsVal % 1 === 0 ? gemsVal.toLocaleString() : gemsVal.toFixed(2)} 💎`)
                            }
                            if (row.prize_awarded_item_id) {
                              const itemDef = FARMING_ITEM_DEFINITIONS[row.prize_awarded_item_id as FarmingItemId]
                              parts.push(`${row.prize_awarded_item_quantity || 1}x ${itemDef?.label || row.prize_awarded_item_id} ${itemDef?.fallback || '🎁'}`)
                            }
                            if (parts.length > 0) {
                              prizeText = parts.join(' + ')
                            }
                          } else if (pool > 0 || selectedTourney.prize_item_id) {
                            if (row.wins > 0 || isEnded) {
                              let poolPart = ''
                              let pct = 0
                              if (places === 1 && row.rank === 1) pct = 1.0
                              else if (places === 3) {
                                if (row.rank === 1) pct = 0.5
                                else if (row.rank === 2) pct = 0.3
                                else if (row.rank === 3) pct = 0.2
                              } else if (places === 5) {
                                if (row.rank === 1) pct = 0.4
                                else if (row.rank === 2) pct = 0.25
                                else if (row.rank === 3) pct = 0.15
                                else if (row.rank === 4 || row.rank === 5) pct = 0.1
                              } else if (places === 10) {
                                if (row.rank === 1) pct = 0.3
                                else if (row.rank === 2) pct = 0.2
                                else if (row.rank === 3) pct = 0.15
                                else if (row.rank === 4) pct = 0.1
                                else if (row.rank === 5) pct = 0.07
                                else if (row.rank === 6 || row.rank === 7) pct = 0.05
                                else if (row.rank >= 8 && row.rank <= 10) pct = 0.03
                              }

                              if (pct > 0 && pool > 0) {
                                const val = pool * pct
                                const formattedVal = val % 1 === 0 ? val.toLocaleString() : Number(val.toFixed(2)).toLocaleString()
                                poolPart = `${formattedVal} ${sym}`
                              }

                              let itemPart = ''
                              if (row.rank === 1 && selectedTourney.prize_item_id) {
                                const itemDef = FARMING_ITEM_DEFINITIONS[selectedTourney.prize_item_id as FarmingItemId]
                                itemPart = `${selectedTourney.prize_item_quantity || 1}x ${itemDef?.label || selectedTourney.prize_item_id} ${itemDef?.fallback || '🎁'}`
                              }

                              if (poolPart && itemPart) prizeText = `${itemPart} + ${poolPart}`
                              else if (itemPart) prizeText = itemPart
                              else if (poolPart) prizeText = poolPart
                            }
                          }

                          return (
                            <tr key={row.user_id} className={row.is_me ? 'is-me' : ''}>
                              <td>
                                {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `${row.rank}º`}
                              </td>
                              <td>
                                {row.username} {row.is_me ? '⭐ (TÚ)' : ''}
                              </td>
                              <td style={{ color: '#4ade80', fontWeight: 800 }}>
                                {row.wins}
                              </td>
                              <td style={{ color: row.losses >= 3 ? '#ef4444' : '#f59e0b' }}>
                                {row.losses} / 3
                              </td>
                              <td>
                                {row.is_eliminated ? (
                                  <span style={{ color: '#f87171', fontSize: '0.75rem' }}>Eliminado</span>
                                ) : (
                                  <span style={{ color: '#4ade80', fontSize: '0.75rem' }}>Activo</span>
                                )}
                              </td>
                              <td style={{ color: '#fbbf24', fontWeight: 700 }}>
                                {prizeText}
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 16 }}>
                            {searchParticipant
                              ? `No se encontró ningún participante con "${searchParticipant}".`
                              : 'Aún no hay participantes inscritos en este torneo.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="tourney-detail-empty">
              <div className="tourney-detail-empty__icon">🏆</div>
              <h3 className="tourney-detail-empty__title">Panel de Información</h3>
              <p className="tourney-detail-empty__desc">
                Selecciona un torneo de la lista para ver los premios, consultar la clasificación en tiempo real y entrar a la batalla.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  className="tourney-btn-create"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setCreateStep('select_type')
                    setShowCreateModal(true)
                  }}
                >
                  <span>➕</span>
                  <span>Crear Nuevo Torneo</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* MODAL CREAR TORNEO */}
        {showCreateModal && (
          <div className="tourney-create-modal" onClick={() => setShowCreateModal(false)}>
            <div
              className="tourney-create-card"
              style={createStep === 'select_type' ? { maxWidth: 780 } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#f3e8ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🏆 Crear Nuevo Torneo
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#cbd5e1' }}>
                    {createStep === 'select_type'
                      ? 'Selecciona la modalidad y economía para tu torneo competitivo.'
                      : 'Configura las reglas, pozo de recompensas y horario de inicio.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="tourney-close-btn"
                  onClick={() => setShowCreateModal(false)}
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: 8, color: '#fca5a5', fontSize: '0.82rem', marginBottom: 12 }}>
                  {createError}
                </div>
              )}

              {createStep === 'select_type' ? (
                <div className="tourney-type-grid">
                  {/* Tipo 1: Free */}
                  <div
                    className="tourney-type-card tourney-type-card--free"
                    onClick={() => handleSelectCategory('free')}
                  >
                    <div className="tourney-type-card__header">
                      <span className="tourney-type-card__icon">🎁</span>
                      <span className="tourney-type-card__tag">Comunidad • 100% Free</span>
                    </div>
                    <h4 className="tourney-type-card__title">Torneo Free</h4>
                    <p className="tourney-type-card__desc">
                      Entrada libre sin costo para todos los gladiadores. Pozo oficial de gemas patrocinado por la administración con reparto al Top 3.
                    </p>
                    <div className="tourney-type-card__action">
                      Configurar Torneo Free <span>➔</span>
                    </div>
                  </div>

                  {/* Tipo 2: Oro */}
                  <div
                    className="tourney-type-card tourney-type-card--gold"
                    onClick={() => handleSelectCategory('gold')}
                  >
                    <div className="tourney-type-card__header">
                      <span className="tourney-type-card__icon">🟡</span>
                      <span className="tourney-type-card__tag">Economía • Entrada Oro</span>
                    </div>
                    <h4 className="tourney-type-card__title">Torneo con Oro</h4>
                    <p className="tourney-type-card__desc">
                      Inscripción cobrada en Oro. Recompensa en Oro o Gemas con pozo fijo garantizado por administración y puestos configurables (Top 1, 3, 5, 10).
                    </p>
                    <div className="tourney-type-card__action">
                      Configurar Torneo con Oro <span>➔</span>
                    </div>
                  </div>

                  {/* Tipo 3: Gemas */}
                  <div
                    className="tourney-type-card tourney-type-card--gems"
                    onClick={() => handleSelectCategory('gems')}
                  >
                    <div className="tourney-type-card__header">
                      <span className="tourney-type-card__icon">💎</span>
                      <span className="tourney-type-card__tag">Competitivo • Entrada Gemas</span>
                    </div>
                    <h4 className="tourney-type-card__title">Torneo con Gemas</h4>
                    <p className="tourney-type-card__desc">
                      Torneo élite con tarifa de inscripción en Gemas. Pozo fijo garantizado por administración. Recompensa en Gemas u Oro a elección.
                    </p>
                    <div className="tourney-type-card__action">
                      Configurar Torneo con Gemas <span>➔</span>
                    </div>
                  </div>

                  {/* Tipo 4: Ítem Exclusivo */}
                  <div
                    className="tourney-type-card tourney-type-card--item"
                    onClick={() => handleSelectCategory('item')}
                  >
                    <div className="tourney-type-card__header">
                      <span className="tourney-type-card__icon">🥊</span>
                      <span className="tourney-type-card__tag">Artefactos • Recompensa Ítem</span>
                    </div>
                    <h4 className="tourney-type-card__title">Torneo Gemas + Ítem</h4>
                    <p className="tourney-type-card__desc">
                      Entrada en Gemas. El Campeón indiscutido (Top 1) gana un artefacto exclusivo (Cinturón de Campeón 🥊, pociones, etc.) más pozo en gemas.
                    </p>
                    <div className="tourney-type-card__action">
                      Configurar Torneo con Ítem <span>➔</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* FORMULARIO DINÁMICO SEGÚN TIPO */
                <form onSubmit={handleConfirmCreate} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  <div className="tourney-form-subnav">
                    <button
                      type="button"
                      className="tourney-back-btn"
                      onClick={() => setCreateStep('select_type')}
                    >
                      ← Elegir otro tipo
                    </button>
                    <span className="tourney-category-pill" style={{
                      background:
                        createCategory === 'free' ? 'rgba(74, 222, 128, 0.15)' :
                        createCategory === 'gold' ? 'rgba(245, 158, 11, 0.15)' :
                        createCategory === 'gems' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color:
                        createCategory === 'free' ? '#86efac' :
                        createCategory === 'gold' ? '#fde047' :
                        createCategory === 'gems' ? '#d8b4fe' : '#fca5a5',
                      border: `1px solid ${
                        createCategory === 'free' ? '#22c55e' :
                        createCategory === 'gold' ? '#eab308' :
                        createCategory === 'gems' ? '#a855f7' : '#ef4444'
                      }`
                    }}>
                      {createCategory === 'free' && '🎁 Modalidad: Torneo Free'}
                      {createCategory === 'gold' && '🟡 Modalidad: Torneo con Oro'}
                      {createCategory === 'gems' && '💎 Modalidad: Torneo con Gemas'}
                      {createCategory === 'item' && '🥊 Modalidad: Gemas + Ítem de Campeón'}
                    </span>
                  </div>

                  {/* Título */}
                  <div className="tourney-form-group">
                    <label>Título del Torneo</label>
                    <input
                      type="text"
                      className="tourney-form-input"
                      placeholder="Ej: Copa Relámpago de la Comunidad"
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      required
                    />
                  </div>

                  {/* Costo de Entrada */}
                  {createCategory === 'free' ? (
                    <div style={{ background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: 10, borderRadius: 8, fontSize: '0.8rem', color: '#86efac' }}>
                      🎉 <strong>Entrada Gratuita (Free)</strong>: Cualquier gladiador podrá inscribirse sin pagar costo de entrada.
                    </div>
                  ) : createCategory === 'gold' ? (
                    <div className="tourney-form-group">
                      <label>Costo de Entrada por Jugador (🟡 Oro)</label>
                      <input
                        type="number"
                        className="tourney-form-input"
                        min="1"
                        step="1"
                        value={createEntryFeeAmount}
                        onChange={(e) => setCreateEntryFeeAmount(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        onWheel={(e) => e.currentTarget.blur()}
                        required
                      />
                      <span style={{ fontSize: '0.74rem', color: '#fde047' }}>
                        Tarifa cobrada al saldo de Oro del jugador (ingreso para la casa). El pozo de premios permanece fijo.
                      </span>
                    </div>
                  ) : (
                    <div className="tourney-form-group">
                      <label>Costo de Entrada por Jugador (💎 Gemas)</label>
                      <input
                        type="number"
                        className="tourney-form-input"
                        min="1"
                        step="1"
                        value={createEntryFeeAmount}
                        onChange={(e) => setCreateEntryFeeAmount(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                        onWheel={(e) => e.currentTarget.blur()}
                        required
                      />
                      <span style={{ fontSize: '0.74rem', color: '#c084fc' }}>
                        Tarifa cobrada al saldo de Gemas del jugador (ingreso para la casa). El pozo de premios permanece fijo.
                      </span>
                    </div>
                  )}

                  {/* Moneda de Recompensa (Para Gold y Gems) */}
                  {(createCategory === 'gold' || createCategory === 'gems') && (
                    <div className="tourney-form-group">
                      <label>Moneda del Pozo de Premios</label>
                      <div className="tourney-currency-toggle">
                        <button
                          type="button"
                          className={`tourney-quick-btn ${createPrizeCurrency === 'gems' ? 'active' : ''}`}
                          style={{ flex: 1, padding: '8px 10px', fontSize: '0.82rem' }}
                          onClick={() => setCreatePrizeCurrency('gems')}
                        >
                          💎 Recompensar en Gemas
                        </button>
                        <button
                          type="button"
                          className={`tourney-quick-btn ${createPrizeCurrency === 'gold' ? 'active' : ''}`}
                          style={{ flex: 1, padding: '8px 10px', fontSize: '0.82rem' }}
                          onClick={() => setCreatePrizeCurrency('gold')}
                        >
                          🟡 Recompensar en Oro
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pozo Inicial */}
                  <div className="tourney-form-group">
                    <label>
                      {createCategory === 'item'
                        ? 'Pozo Adicional de Gemas (Opcional)'
                        : `Pozo Fijo de ${createPrizeCurrency === 'gold' ? 'Oro' : 'Gemas'} a Repartir`}
                    </label>
                    <input
                      type="number"
                      className="tourney-form-input"
                      min="0"
                      step="1"
                      value={createPrizePoolAmount}
                      onChange={(e) => setCreatePrizePoolAmount(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                    <span style={{ fontSize: '0.74rem', color: createPrizeCurrency === 'gold' ? '#fde047' : '#c084fc' }}>
                      {createCategory === 'item'
                        ? '💎 Pozo en gemas adicional que se repartirá entre los mejores clasificados además del ítem.'
                        : `Pozo oficial garantizado fijado por administración. No varía con las inscripciones.`}
                    </span>
                  </div>

                  {/* Selector de Ítem para la modalidad Item */}
                  {createCategory === 'item' && (
                    <div className="tourney-form-group">
                      <label>🎁 Ítem Exclusivo para el Campeón (Top 1)</label>
                      <div className="tourney-item-selector-grid">
                        {(
                          [
                            'champion_belt',
                            'energy_potion_5',
                            'shovel',
                            'scarecrow',
                            'pesticide',
                            'water',
                            'fertilizer',
                          ] as FarmingItemId[]
                        ).map((itemId) => {
                          const itemDef = FARMING_ITEM_DEFINITIONS[itemId]
                          const isSelected = createPrizeItemId === itemId
                          return (
                            <button
                              key={itemId}
                              type="button"
                              className={`tourney-item-option-btn ${isSelected ? 'active' : ''}`}
                              onClick={() => setCreatePrizeItemId(itemId)}
                            >
                              <img
                                src={itemDef?.icon || '/game-assets/farming/champion_belt.png'}
                                alt={itemDef?.label || itemId}
                                onError={(e) => {
                                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                                }}
                              />
                              <span>{itemDef?.label || itemId}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Cantidad a otorgar:</span>
                        <input
                          type="number"
                          className="tourney-form-input"
                          style={{ width: 80, padding: '4px 8px' }}
                          min="1"
                          max="100"
                          value={createPrizeItemQuantity}
                          onChange={(e) => setCreatePrizeItemQuantity(Math.max(1, Number(e.target.value)))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </div>
                    </div>
                  )}

                  {/* Cantidad de Puestos Premiados */}
                  <div className="tourney-form-group">
                    <label>Puestos Premiados en el Pozo</label>
                    <div className="tourney-quick-times">
                      {([1, 3, 5, 10] as const).map((places) => (
                        <button
                          key={places}
                          type="button"
                          className={`tourney-quick-btn ${createPlacesCount === places ? 'active' : ''}`}
                          onClick={() => setCreatePlacesCount(places)}
                        >
                          {places === 1 ? '👑 Top 1 (100%)' :
                           places === 3 ? '🏆 Top 3 (50/30/20%)' :
                           places === 5 ? '🎖️ Top 5' : '🎖️ Top 10'}
                        </button>
                      ))}
                    </div>

                    {createPrizePoolAmount > 0 && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '10px 12px',
                          background: 'rgba(168, 85, 247, 0.1)',
                          border: '1px dashed rgba(168, 85, 247, 0.4)',
                          borderRadius: 8,
                          fontSize: '0.76rem',
                          color: '#e9d5ff',
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: 6, color: '#f3e8ff' }}>
                          📊 Reparto exacto del pozo ({createPrizePoolAmount.toLocaleString()} {createPrizeCurrency === 'gold' ? '🟡 Oro' : '💎 Gemas'}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px' }}>
                          {(() => {
                            let pcts: { rank: number; pct: number }[] = []
                            if (createPlacesCount === 1) pcts = [{ rank: 1, pct: 100 }]
                            else if (createPlacesCount === 3) pcts = [{ rank: 1, pct: 50 }, { rank: 2, pct: 30 }, { rank: 3, pct: 20 }]
                            else if (createPlacesCount === 5) pcts = [{ rank: 1, pct: 40 }, { rank: 2, pct: 25 }, { rank: 3, pct: 15 }, { rank: 4, pct: 10 }, { rank: 5, pct: 10 }]
                            else if (createPlacesCount === 10) pcts = [
                              { rank: 1, pct: 30 }, { rank: 2, pct: 20 }, { rank: 3, pct: 15 }, { rank: 4, pct: 10 },
                              { rank: 5, pct: 7 }, { rank: 6, pct: 5 }, { rank: 7, pct: 5 }, { rank: 8, pct: 3 }, { rank: 9, pct: 3 }, { rank: 10, pct: 2 }
                            ]
                            const sym = createPrizeCurrency === 'gold' ? '🟡' : '💎'
                            return pcts.map(({ rank, pct }) => {
                              const amount = Math.round((createPrizePoolAmount * pct) / 100)
                              return (
                                <span
                                  key={rank}
                                  style={{
                                    background: 'rgba(0,0,0,0.35)',
                                    padding: '3px 8px',
                                    borderRadius: 5,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                  }}
                                >
                                  <strong>Top {rank}</strong> ({pct}%): <strong>{amount.toLocaleString()} {sym}</strong>
                                </span>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hora de Inicio */}
                  <div className="tourney-form-group">
                    <label>Hora de Inicio Programada (Cuenta Regresiva)</label>
                    <div className="tourney-quick-times">
                      {[
                        { label: 'En 1 min', min: 1 },
                        { label: 'En 5 min', min: 5 },
                        { label: 'En 15 min', min: 15 },
                        { label: 'En 30 min', min: 30 },
                        { label: 'En 1 hora', min: 60 },
                      ].map((opt) => (
                        <button
                          key={opt.min}
                          type="button"
                          className={`tourney-quick-btn ${startMode === 'quick' && createStartOffsetMin === opt.min ? 'active' : ''}`}
                          onClick={() => {
                            setStartMode('quick')
                            setCreateStartOffsetMin(opt.min)
                            const target = new Date(Date.now() + opt.min * 60 * 1000)
                            setCustomMonth(target.getUTCMonth() + 1)
                            setCustomDay(target.getUTCDate())
                            setCustomHour(target.getUTCHours())
                            setCustomMinute(target.getUTCMinutes())
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}

                      <button
                        type="button"
                        className={`tourney-quick-btn ${startMode === 'custom_utc' ? 'active' : ''}`}
                        style={
                          startMode === 'custom_utc'
                            ? { background: 'linear-gradient(135deg, #a855f7, #7e22ce)', borderColor: '#c084fc', color: '#fff' }
                            : undefined
                        }
                        onClick={() => setStartMode('custom_utc')}
                      >
                        📅 Fecha y Hora UTC
                      </button>
                    </div>

                    {startMode === 'custom_utc' ? (
                      <div className="tourney-utc-container">
                        <div className="tourney-utc-picker">
                          <div className="tourney-utc-picker__item" style={{ width: 84 }}>
                            <label>Año (Fijo)</label>
                            <div className="tourney-utc-year-pill">{currentYear}</div>
                          </div>

                          <div className="tourney-utc-picker__item" style={{ flex: 1.5, minWidth: 120 }}>
                            <label>Mes</label>
                            <select
                              className="tourney-utc-select"
                              value={customMonth}
                              onChange={(e) => setCustomMonth(Number(e.target.value))}
                            >
                              {MONTHS_ES.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="tourney-utc-picker__item" style={{ width: 68 }}>
                            <label>Día</label>
                            <select
                              className="tourney-utc-select"
                              value={customDay}
                              onChange={(e) => setCustomDay(Number(e.target.value))}
                            >
                              {Array.from({ length: maxDaysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                                <option key={d} value={d}>
                                  {d.toString().padStart(2, '0')}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="tourney-utc-picker__item" style={{ width: 75 }}>
                            <label>Hora UTC</label>
                            <select
                              className="tourney-utc-select"
                              value={customHour}
                              onChange={(e) => setCustomHour(Number(e.target.value))}
                            >
                              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                                <option key={h} value={h}>
                                  {h.toString().padStart(2, '0')}:00
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="tourney-utc-picker__item" style={{ width: 75 }}>
                            <label>Min UTC</label>
                            <select
                              className="tourney-utc-select"
                              value={customMinute}
                              onChange={(e) => setCustomMinute(Number(e.target.value))}
                            >
                              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                                <option key={m} value={m}>
                                  :{m.toString().padStart(2, '0')}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="tourney-utc-preview">
                          <div className="tourney-utc-preview__date">
                            🌐 Inicio: <strong>{customDay.toString().padStart(2, '0')}/{customMonth.toString().padStart(2, '0')}/{currentYear} {customHour.toString().padStart(2, '0')}:{customMinute.toString().padStart(2, '0')} UTC</strong>
                          </div>
                          <div className={`tourney-utc-preview__countdown ${isCustomUtcInFuture ? 'is-valid' : 'is-invalid'}`}>
                            {isCustomUtcInFuture
                              ? `⏳ Cuenta regresiva: ${formatCountdown(customUtcTargetMs)}`
                              : '⚠️ La fecha debe ser posterior al momento actual.'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: 4 }}>
                        🌐 Inicio UTC calculado: <strong>{formatUtcDateTime(Date.now() + createStartOffsetMin * 60 * 1000)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Duración */}
                  <div className="tourney-form-group">
                    <label>Duración del Torneo</label>
                    <div className="tourney-quick-times">
                      {[
                        { label: '45 min', min: 45 },
                        { label: '1 hora (60 min)', min: 60 },
                        { label: '🔥 2 Horas (120 min)', min: 120 },
                        { label: '3 Horas (180 min)', min: 180 },
                      ].map((opt) => (
                        <button
                          key={opt.min}
                          type="button"
                          className={`tourney-quick-btn ${createDurationMin === opt.min ? 'active' : ''}`}
                          onClick={() => setCreateDurationMin(opt.min)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Regla de Plantas (Para Torneos con Oro, Gemas o Ítems) */}
                  {createCategory !== 'free' && (
                    <div className="tourney-form-group">
                      <label>🌱 Regla de Plantas Permitidas</label>
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                          type="button"
                          className={`tourney-quick-btn ${createPlantRule === 'all_unlocked' ? 'active' : ''}`}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            fontSize: '0.82rem',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                          onClick={() => setCreatePlantRule('all_unlocked')}
                        >
                          <span style={{ fontWeight: 800, color: createPlantRule === 'all_unlocked' ? '#fff' : '#e2e8f0' }}>
                            🌟 16 Desbloqueadas (Híbrido)
                          </span>
                          <span style={{ fontSize: '0.71rem', opacity: 0.85 }}>
                            16 cartas libres. Quien tenga plantas fusionadas o ítems los usará con sus mejoras; quien no, jugará la base.
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`tourney-quick-btn ${createPlantRule === 'owned_only' ? 'active' : ''}`}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            fontSize: '0.82rem',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                          }}
                          onClick={() => setCreatePlantRule('owned_only')}
                        >
                          <span style={{ fontWeight: 800, color: createPlantRule === 'owned_only' ? '#fff' : '#e2e8f0' }}>
                            🌿 Solo Plantas Propias
                          </span>
                          <span style={{ fontSize: '0.71rem', opacity: 0.85 }}>
                            Cada jugador solo usa las plantas que ha desbloqueado en su colección.
                          </span>
                        </button>
                      </div>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: createPlantRule === 'owned_only' ? '#fde047' : '#86efac',
                          marginTop: 3,
                          display: 'block',
                        }}
                      >
                        {createPlantRule === 'owned_only'
                          ? '🔒 El backend validará que ningún participante guarde o juegue con plantas que no posea en su colección.'
                          : '🌟 Todos los gladiadores tendrán acceso a las 16 plantas del catálogo y se activarán automáticamente las fusiones e ítems de las cartas que posean.'}
                      </span>
                    </div>
                  )}

                  {/* Modo de Prueba para Admin (Producción) - Excluido en Torneo con Oro */}
                  {createCategory !== 'gold' && (
                    <div style={{
                      background: createIsTest ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      border: createIsTest ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.12)',
                      padding: '10px 14px',
                      borderRadius: 10,
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }} onClick={() => setCreateIsTest(!createIsTest)}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={createIsTest}
                          onChange={(e) => setCreateIsTest(e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: '#06b6d4', cursor: 'pointer' }}
                        />
                        <div>
                          <div style={{ fontSize: '0.86rem', fontWeight: 800, color: createIsTest ? '#67e8f9' : '#f1f5f9' }}>
                            🧪 Torneo de Prueba Admin (Solo visible para ti en producción)
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 2 }}>
                            {createIsTest
                              ? '✓ Activado: Los jugadores comunes NO verán este torneo en su lista. Solo tú podrás ingresar, simular victorias/derrotas y liquidar premios desde el panel Sandbox.'
                              : 'Desactivado: Será un torneo público oficial visible para todos los jugadores.'}
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: 10, borderRadius: 8, fontSize: '0.78rem', color: '#d8b4fe' }}>
                    ℹ️ Reglas: {createCategory === 'free' || createPlantRule === 'all_unlocked' ? '🌟 15 plantas 100% desbloqueadas para todos' : '🌿 Solo plantas propias (colección de cada jugador)'}, eliminación a las 3 derrotas y reentrada disponible por 200 💎 (2 vidas).
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                    <button
                      type="button"
                      className="tourney-btn-secondary"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="tourney-btn-create"
                      disabled={isCreating}
                    >
                      {isCreating
                        ? 'Creando…'
                        : createCategory !== 'gold' && createIsTest
                        ? '🧪 Publicar Torneo de Prueba'
                        : '✓ Publicar Torneo Oficial'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* DECK BUILDER MODAL */}
        <TournamentDeckBuilder
          isOpen={showDeckBuilder}
          currentDeck={activeDeckList}
          onSaveDeck={handleSaveDeck}
          onClose={() => setShowDeckBuilder(false)}
          plantRule={selectedTourney?.plant_rule || 'all_unlocked'}
          unlockedPlants={unlockedPlants}
          plantInstances={plantInstances}
        />
      </div>
    </div>
  )
}
