import { useState, useMemo, useEffect } from 'react'
import type { PlantId, ClanFortressPlant, ClanFortressAmbush } from '../../types/game'
import { PLANT_CONFIGS, LANES_CONFIG_5, FORTRESS_SUN_COSTS, TACTICAL_AMBUSH_PLANTS } from '../../utils/gameConstants'
import { supabaseService } from '../../services/supabaseService'
import { soundManager } from '../../utils/audioManager'
import arena1Bg from '../../assets/images/battlefield-bg.webp'
import './FortressEditor.css'

interface FortressEditorProps {
  clanId: string
  clanName: string
  treeLevel?: number
  initialLayout: ClanFortressPlant[]
  initialAmbushes?: ClanFortressAmbush[]
  initialUnlockedPlants?: PlantId[]
  defenseSunsBudget: number
  canEdit?: boolean
  plantCopies?: Record<string, number>
  // Girasoles Ancestrales props
  sunflowerData?: {
    sunflowerLastHarvestAt?: string
    sunflowerCycleSeconds?: number
    sunflowerTimeReducedSeconds?: number
    sunflowerCount?: number
    sunsPerSunflower?: number
    sunflowerTotalSuns?: number
    sunflowerSecondsRemaining?: number
    sunflowerCanHarvest?: boolean
  }
  userFarmingInv?: { water: number; fertilizer: number }
  onClose: () => void
  onOpenAltar?: () => void
  onSaved: (newLayout: ClanFortressPlant[], newAmbushes: ClanFortressAmbush[], sunsSpent: number) => void
  onArsenalUpdated?: (newUnlocked: PlantId[]) => void
  onSunsHarvested?: (sunsGained: number, newBudget: number) => void
  onAccelerated?: (resourceType: 'water' | 'fertilizer', amount: number, newRemainingSeconds: number) => void
}

const SELECTABLE_PLANTS: PlantId[] = [
  'sunflower',
  'peashooter',
  'repeater',
  'threepeater',
  'gatlingpea',
  'snowpea',
  'wallnut',
  'tallnut',
  'bonkchoy',
  'chomper',
  'guacodile',
  'explodeonut',
  'ghostpepper',
  'toadstool',
  'kernelpult',
  'melonpult',
  'torchwood',
  'iceberglettuce',
  'jalapeno',
  'pickledpepper',
  'twinsunflower',
  'marigold',
  'squash',
  'garlic',
  'aloe',
]

const DEFAULT_UNLOCKED: PlantId[] = ['sunflower', 'peashooter', 'wallnut']

export default function FortressEditor({
  clanId: _clanId,
  clanName,
  treeLevel = 1,
  initialLayout,
  initialAmbushes = [],
  initialUnlockedPlants,
  defenseSunsBudget,
  canEdit = true,
  plantCopies,
  sunflowerData,
  userFarmingInv,
  onClose,
  onOpenAltar,
  onSaved,
  onArsenalUpdated,
  onSunsHarvested,
  onAccelerated,
}: FortressEditorProps) {
  // Determinación de carriles permitidos según el nivel del Árbol Madre
  // Nivel 1 y 2: Carriles centrales 1, 2 y 3 (3 líneas)
  // Nivel 3: Carriles 0, 1, 2 y 3 (4 líneas, carril 4 bloqueado)
  // Nivel 4: 5 carriles completos (0..4)
  const allowedLanes = useMemo(() => {
    if (treeLevel >= 4) return [0, 1, 2, 3, 4]
    if (treeLevel === 3) return [0, 1, 2, 3]
    return [1, 2, 3]
  }, [treeLevel])

  const [layout, setLayout] = useState<ClanFortressPlant[]>(() => {
    return (initialLayout || [])
      .map((p) => ({
        ...p,
        col: p.col >= 7 ? p.col - 7 : p.col,
      }))
      .filter((p) => allowedLanes.includes(p.lane))
  })
  const [ambushes, setAmbushes] = useState<ClanFortressAmbush[]>(() => {
    return (initialAmbushes || []).filter((a) => allowedLanes.includes(a.lane))
  })
  const [unlockedPlants, setUnlockedPlants] = useState<PlantId[]>(() => {
    if (initialUnlockedPlants && initialUnlockedPlants.length > 0) return initialUnlockedPlants
    return DEFAULT_UNLOCKED
  })

  const [selectedPlantId, setSelectedPlantId] = useState<PlantId>(() => {
    const list = (initialUnlockedPlants && initialUnlockedPlants.length > 0) ? initialUnlockedPlants : DEFAULT_UNLOCKED
    return list[0] || 'peashooter'
  })
  const [selectedTileToMove, setSelectedTileToMove] = useState<{ lane: number; col: number } | null>(null)
  const [isShovelActive, setIsShovelActive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Presupuesto reactivo en tiempo real
  const [sunsBudget, setSunsBudget] = useState<number>(defenseSunsBudget)

  // Estado reactivo de los Girasoles Ancestrales
  const [sunflowerRemainingSec, setSunflowerRemainingSec] = useState<number>(() => {
    return sunflowerData?.sunflowerSecondsRemaining ?? 0
  })
  const [canHarvest, setCanHarvest] = useState<boolean>(() => {
    return sunflowerData?.sunflowerCanHarvest ?? (sunflowerData?.sunflowerSecondsRemaining === 0)
  })
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false)
  const [isAccelerating, setIsAccelerating] = useState<boolean>(false)
  const [showSunflowerCareModal, setShowSunflowerCareModal] = useState<boolean>(false)
  const [activeFarmingInv, setActiveFarmingInv] = useState<{ water: number; fertilizer: number }>(() => {
    return userFarmingInv || { water: 0, fertilizer: 0 }
  })

  // Sincronizaciones con props
  useEffect(() => {
    setSunsBudget(defenseSunsBudget)
  }, [defenseSunsBudget])

  useEffect(() => {
    if (userFarmingInv) {
      setActiveFarmingInv(userFarmingInv)
    }
  }, [userFarmingInv])

  useEffect(() => {
    if (sunflowerData) {
      if (typeof sunflowerData.sunflowerSecondsRemaining === 'number') {
        setSunflowerRemainingSec(sunflowerData.sunflowerSecondsRemaining)
      }
      if (typeof sunflowerData.sunflowerCanHarvest === 'boolean') {
        setCanHarvest(sunflowerData.sunflowerCanHarvest)
      }
    }
  }, [sunflowerData])

  // Temporizador regresivo en segundos
  useEffect(() => {
    if (sunflowerRemainingSec <= 0) {
      setCanHarvest(true)
      return
    }
    const timer = setInterval(() => {
      setSunflowerRemainingSec((prev) => {
        if (prev <= 1) {
          setCanHarvest(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [sunflowerRemainingSec])

  const formatRemainingTime = (sec: number) => {
    if (sec <= 0) return '¡Listo!'
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    return `${m}m ${s}s`
  }

  // Carriles donde crecen Girasoles Ancestrales según nivel del Árbol Madre
  const ancestralLanes = useMemo(() => {
    if (treeLevel >= 4) return [0, 1, 3, 4]
    if (treeLevel >= 2) return [1, 2, 3]
    return [1, 3]
  }, [treeLevel])

  const sunflowerConfig = useMemo(() => {
    let count = 2
    let each = 50
    if (treeLevel >= 4) {
      count = 4
      each = 125
    } else if (treeLevel === 3) {
      count = 3
      each = 100
    } else if (treeLevel === 2) {
      count = 3
      each = 75
    }
    return {
      count: sunflowerData?.sunflowerCount ?? count,
      sunsPerSunflower: sunflowerData?.sunsPerSunflower ?? each,
      totalSuns: sunflowerData?.sunflowerTotalSuns ?? (count * each),
    }
  }, [treeLevel, sunflowerData])

  // Cosecha comunal de soles
  const handleHarvestSunflowers = async () => {
    if (isHarvesting || !canHarvest) return
    setIsHarvesting(true)
    soundManager.playSound('points', 0.8)
    try {
      const res = await supabaseService.harvestAncestralSunflowers()
      if (res.success && res.sunsGained) {
        soundManager.playSound('points', 0.9)
        const gained = res.sunsGained
        const updatedBudget = res.newBudget ?? (sunsBudget + gained)
        setSunsBudget(updatedBudget)
        setCanHarvest(false)
        setSunflowerRemainingSec(14400)
        setSaveStatus({
          type: 'success',
          message: `☀️ ¡Cosechados +${gained} Soles para la Fortaleza! (${res.sunflowerCount || sunflowerConfig.count} Girasoles × ${res.sunsPerSunflower || sunflowerConfig.sunsPerSunflower} ☀️).`,
        })
        setShowSunflowerCareModal(false)
        if (onSunsHarvested) onSunsHarvested(gained, updatedBudget)
      } else {
        setSaveStatus({
          type: 'error',
          message: res.error || 'No se pudieron cosechar los soles en este momento.',
        })
      }
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: e?.message || 'Error al cosechar soles ancestrales.',
      })
    } finally {
      setIsHarvesting(false)
    }
  }

  // Acelerar con agua o fertilizante
  const handleAccelerateSunflowers = async (type: 'water' | 'fertilizer', amount: number = 1) => {
    if (isAccelerating) return
    const userBalance = type === 'water' ? (activeFarmingInv.water || 0) : (activeFarmingInv.fertilizer || 0)
    if (userBalance < amount) {
      setSaveStatus({
        type: 'error',
        message: `No tienes suficiente ${type === 'water' ? 'Agua 💧' : 'Fertilizante 🌱'} en tu inventario.`,
      })
      return
    }

    setIsAccelerating(true)
    soundManager.playSound('plantation', 0.7)
    try {
      const res = await supabaseService.accelerateAncestralSunflowers(type, amount)
      if (res.success) {
        soundManager.playSound('plantation', 0.8)
        const newRem = res.newRemainingSeconds ?? Math.max(0, sunflowerRemainingSec - (type === 'water' ? 300 : 600) * amount)
        setSunflowerRemainingSec(newRem)
        if (newRem <= 0 || res.canHarvestNow) {
          setCanHarvest(true)
        }
        setActiveFarmingInv((prev) => ({
          ...prev,
          [type]: Math.max(0, (prev[type] || 0) - amount),
        }))
        setSaveStatus({
          type: 'success',
          message: `✨ ¡Girasoles acelerados! -${type === 'water' ? 5 * amount : 10 * amount} minutos al temporizador de cosecha.`,
        })
        if (onAccelerated) onAccelerated(type, amount, newRem)
      } else {
        setSaveStatus({
          type: 'error',
          message: res.error || 'No se pudo aplicar la aceleración en este momento.',
        })
      }
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: e?.message || 'Error al acelerar girasoles.',
      })
    } finally {
      setIsAccelerating(false)
    }
  }

  // Modal para programar emboscada táctica
  const [ambushModalPlant, setAmbushModalPlant] = useState<PlantId | null>(null)
  const [ambushLane, setAmbushLane] = useState<number>(allowedLanes[0] || 1)
  const [ambushTriggerSec, setAmbushTriggerSec] = useState<number>(45)

  // Estado para donar carta al arsenal
  const [isDonating, setIsDonating] = useState<string | null>(null)

  // Calcular soles gastados en tiempo real (plantas en césped + emboscadas programadas)
  const sunsSpent = useMemo(() => {
    const layoutSuns = layout.reduce((total, item) => total + (FORTRESS_SUN_COSTS[item.plantId] || 100), 0)
    const ambushSuns = ambushes.reduce((total, item) => total + (FORTRESS_SUN_COSTS[item.plantId] || 100), 0)
    return layoutSuns + ambushSuns
  }, [layout, ambushes])

  const sunsRemaining = sunsBudget - sunsSpent

  // Grid defensivo: 7 columnas (0 a 6) en la mitad izquierda
  const defenseCols = [0, 1, 2, 3, 4, 5, 6]

  // Clic en casillas del campo
  const handleTileClick = (lane: number, col: number) => {
    if (!allowedLanes.includes(lane)) {
      soundManager.playSound('click', 0.2)
      setSaveStatus({
        type: 'error',
        message: `🔒 Este carril está bloqueado. Requiere Árbol Madre Nivel ${lane === 0 ? 3 : 4}.`,
      })
      return
    }

    const existingIndex = layout.findIndex((p) => p.lane === lane && p.col === col)

    // 1. Modo pala
    if (isShovelActive) {
      if (existingIndex >= 0) {
        soundManager.playSound('click', 0.4)
        const removed = layout[existingIndex]
        const cost = FORTRESS_SUN_COSTS[removed.plantId] || 100
        setLayout((prev) => prev.filter((_, idx) => idx !== existingIndex))
        setSaveStatus({
          type: 'success',
          message: `Planta desenterrada (+${cost} ☀️ reembolsados).`,
        })
      }
      return
    }

    // 2. Traslado o Intercambio
    if (selectedTileToMove) {
      if (selectedTileToMove.lane === lane && selectedTileToMove.col === col) {
        setSelectedTileToMove(null)
        setSaveStatus(null)
        return
      }

      if (existingIndex >= 0) {
        soundManager.playSound('plantation', 0.7)
        setLayout((prev) => {
          return prev.map((item) => {
            if (item.lane === selectedTileToMove.lane && item.col === selectedTileToMove.col) {
              return { ...item, lane, col }
            }
            if (item.lane === lane && item.col === col) {
              return { ...item, lane: selectedTileToMove.lane, col: selectedTileToMove.col }
            }
            return item
          })
        })
        setSelectedTileToMove(null)
        setSaveStatus({
          type: 'success',
          message: `🔄 ¡Plantas intercambiadas de posición con éxito!`,
        })
        return
      }

      soundManager.playSound('plantation', 0.7)
      setLayout((prev) => {
        return prev.map((item) => {
          if (item.lane === selectedTileToMove.lane && item.col === selectedTileToMove.col) {
            return { ...item, lane, col }
          }
          return item
        })
      })
      setSelectedTileToMove(null)
      setSaveStatus({
        type: 'success',
        message: `✓ ¡Planta reubicada al Carril ${lane + 1}, Casilla ${col + 1}!`,
      })
      return
    }

    // 3. Selección para mover
    if (existingIndex >= 0) {
      soundManager.playSound('click', 0.4)
      setSelectedTileToMove({ lane, col })
      const plant = layout[existingIndex]
      const name = PLANT_CONFIGS[plant.plantId]?.name || plant.plantId
      setSaveStatus({
        type: 'success',
        message: `Moviendo "${name}" (Carril ${lane + 1}, C${col + 1}). Haz clic en otra casilla para reubicarla.`,
      })
      return
    }

    // 4. Plantar estática desde paleta
    if (TACTICAL_AMBUSH_PLANTS.includes(selectedPlantId)) {
      setAmbushModalPlant(selectedPlantId)
      setAmbushLane(lane)
      return
    }

    const cost = FORTRESS_SUN_COSTS[selectedPlantId] || 100
    if (sunsRemaining < cost) {
      soundManager.playSound('click', 0.2)
      setSaveStatus({
        type: 'error',
        message: `¡No tienes suficientes soles! Requiere ${cost} ☀️ y te quedan ${sunsRemaining} ☀️.`,
      })
      return
    }

    soundManager.playSound('plantation', 0.6)
    setLayout((prev) => [
      ...prev,
      {
        plantId: selectedPlantId,
        lane,
        col,
        level: 1,
      },
    ])
    setSaveStatus(null)
  }

  const handleClearAll = () => {
    if (layout.length === 0 && ambushes.length === 0) return
    soundManager.playSound('click', 0.4)
    setLayout([])
    setAmbushes([])
    setSelectedTileToMove(null)
    setSaveStatus(null)
  }

  // Programar emboscada
  const handleScheduleAmbush = () => {
    if (!ambushModalPlant) return
    const cost = FORTRESS_SUN_COSTS[ambushModalPlant] || 100
    if (sunsRemaining < cost) {
      setSaveStatus({
        type: 'error',
        message: `Presupuesto solar insuficiente para esta emboscada (requiere ${cost} ☀️).`,
      })
      setAmbushModalPlant(null)
      return
    }

    soundManager.playSound('plantation', 0.8)
    setAmbushes((prev) => [
      ...prev,
      {
        plantId: ambushModalPlant,
        lane: ambushLane,
        triggerSec: ambushTriggerSec,
        level: 1,
      },
    ])
    setAmbushModalPlant(null)
    setSaveStatus({
      type: 'success',
      message: `⚡ ¡Emboscada de ${PLANT_CONFIGS[ambushModalPlant]?.name} programada en Carril ${ambushLane + 1} a los ${Math.floor(ambushTriggerSec / 60)}m ${ambushTriggerSec % 60}s!`,
    })
  }

  const handleRemoveAmbush = (index: number) => {
    soundManager.playSound('click', 0.3)
    const removed = ambushes[index]
    const cost = FORTRESS_SUN_COSTS[removed.plantId] || 100
    setAmbushes((prev) => prev.filter((_, i) => i !== index))
    setSaveStatus({
      type: 'success',
      message: `Emboscada cancelada (+${cost} ☀️ reembolsados).`,
    })
  }

  // Donar carta al arsenal del clan
  const handleDonateToArsenal = async (plantId: PlantId) => {
    const userCopies = plantCopies ? (plantCopies[plantId] || 0) : 1
    if (plantCopies && userCopies <= 0) {
      soundManager.playSound('click', 0.2)
      setSaveStatus({
        type: 'error',
        message: `⚠️ No posees copias extra de ${PLANT_CONFIGS[plantId]?.name} para donar (tienes 0). Obtén copias en sobres para desbloquearla en el clan.`,
      })
      return
    }

    setIsDonating(plantId)
    setSaveStatus(null)
    try {
      const res = await supabaseService.donatePlantToClanArsenal(plantId)
      if (!res.success) {
        setSaveStatus({
          type: 'error',
          message: res.error || 'No tienes copias disponibles de esta planta en tu colección.',
        })
        return
      }

      soundManager.playSound('plantation', 0.9)
      const nextUnlocked = Array.from(new Set([...unlockedPlants, plantId]))
      setUnlockedPlants(nextUnlocked)
      setSelectedPlantId(plantId)
      onArsenalUpdated?.(nextUnlocked)
      setSaveStatus({
        type: 'success',
        message: `🎉 ¡Has donado 1 copia de ${PLANT_CONFIGS[plantId]?.name}! Ahora está desbloqueada permanentemente en el arsenal del clan.`,
      })
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: e?.message || 'Error al donar carta al clan.',
      })
    } finally {
      setIsDonating(null)
    }
  }

  // Guardar en backend (layout 0..6 + ambushes)
  const handleSave = async () => {
    if (!canEdit) {
      setSaveStatus({
        type: 'error',
        message: 'Solo el Líder, Colíderes y Veteranos tienen permiso para guardar cambios en la defensa.',
      })
      return
    }

    setIsSaving(true)
    setSaveStatus(null)
    try {
      const sanitizedLayout = layout
        .filter((p) => allowedLanes.includes(p.lane))
        .map((p) => ({
          ...p,
          col: p.col >= 7 ? p.col - 7 : p.col,
        }))
      const sanitizedAmbushes = ambushes.filter((a) => allowedLanes.includes(a.lane))

      const res = await supabaseService.saveClanFortress(sanitizedLayout, sanitizedAmbushes)
      if (!res.success) {
        setSaveStatus({
          type: 'error',
          message: res.error || 'Error al guardar la fortaleza',
        })
        setIsSaving(false)
        return
      }

      soundManager.playSound('plantation', 0.8)
      setSaveStatus({
        type: 'success',
        message: `¡Formación defensiva guardada con éxito! (${res.plantsCount || sanitizedLayout.length} plantas y ${res.ambushesCount || sanitizedAmbushes.length} emboscadas registradas en la base de datos).`,
      })
      onSaved(sanitizedLayout, sanitizedAmbushes, sunsSpent)
    } catch (e: any) {
      setSaveStatus({
        type: 'error',
        message: e?.message || 'Error en la conexión con el servidor',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fortress-editor-fullscreen">
      {/* ── HEADER TÁCTICO ─────────────────────────────────────────────────── */}
      <header className="fortress-editor-header">
        <div className="fortress-editor-header__left">
          <button
            type="button"
            className="fortress-editor-btn-back"
            onClick={onClose}
            title="Volver a la vista del Clan"
          >
            ← VOLVER
          </button>
          <div className="fortress-editor-title">
            <h2>DEFENSAS: {clanName.toUpperCase()}</h2>
            <small>
              Árbol Madre Nv. {treeLevel} • {allowedLanes.length} Líneas Activas
            </small>
          </div>
        </div>

        <div className="fortress-editor-header__center">
          <div className="fortress-sun-meter">
            <div className="fortress-sun-meter__info">
              <span>
                <span className="fortress-sun-icon">☀️</span> Soles:{' '}
                <strong>{sunsRemaining} ☀️</strong>
              </span>
              <small>
                {sunsSpent} / {sunsBudget} ☀️
              </small>
            </div>
            <div className="fortress-sun-meter__track">
              <div
                className="fortress-sun-meter__fill"
                style={{
                  width: `${Math.min(100, Math.max(0, (sunsSpent / sunsBudget) * 100))}%`,
                  background:
                    sunsRemaining < 100
                      ? 'linear-gradient(90deg, #ef4444, #f97316)'
                      : 'linear-gradient(90deg, #eab308, #22c55e)',
                }}
              />
            </div>
          </div>

          {/* Botón de acceso rápido a los Girasoles Ancestrales */}
          <button
            type="button"
            className={`fortress-editor-btn-sunflower ${canHarvest ? 'fortress-editor-btn-sunflower--ready' : ''}`}
            onClick={() => {
              if (canHarvest) {
                void handleHarvestSunflowers()
              } else {
                setShowSunflowerCareModal(true)
              }
            }}
            title={canHarvest ? `¡Cosechar +${sunflowerConfig.totalSuns} Soles!` : `Girasoles Ancestrales: Cosecha en ${formatRemainingTime(sunflowerRemainingSec)}`}
          >
            {canHarvest ? `☀️ ¡COSECHAR (+${sunflowerConfig.totalSuns})!` : `🌻 GIRASOLES (${formatRemainingTime(sunflowerRemainingSec)})`}
          </button>

          {onOpenAltar && (
            <button
              type="button"
              className="fortress-editor-btn-altar"
              onClick={onOpenAltar}
              title="Donar y ampliar presupuesto en el Altar Solar"
            >
              ☀️ ALTAR SOLAR
            </button>
          )}
        </div>

        <div className="fortress-editor-header__right">
          <button
            type="button"
            className={`fortress-editor-btn-shovel ${isShovelActive ? 'fortress-editor-btn-shovel--active' : ''}`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setIsShovelActive((prev) => !prev)
              setSelectedTileToMove(null)
            }}
            title="Activar pala para desenterrar plantas y recuperar soles"
          >
            🪓 {isShovelActive ? 'PALA ACTIVA' : 'DESENTERRAR'}
          </button>

          <button
            type="button"
            className="fortress-editor-btn-clear"
            onClick={handleClearAll}
            disabled={layout.length === 0 && ambushes.length === 0}
            title="Limpiar todas las plantas y emboscadas"
          >
            🗑️ LIMPIAR
          </button>

          <button
            type="button"
            className={`fortress-editor-btn-save ${!canEdit ? 'fortress-editor-btn-save--readonly' : ''}`}
            onClick={handleSave}
            disabled={isSaving}
            title={canEdit ? 'Guardar formación en la base de datos' : 'Solo oficiales (Líder, Colíder, Veterano) pueden guardar. Haz clic para más información.'}
          >
            {isSaving ? 'GUARDANDO...' : canEdit ? '💾 GUARDAR DEFENSA' : '🔒 SOLO OFICIALES'}
          </button>
        </div>
      </header>

      {/* Ribbon interactivo de estado */}
      {selectedTileToMove && (
        <div className="fortress-move-ribbon">
          <span className="fortress-move-ribbon__icon">🎯</span>
          <span className="fortress-move-ribbon__text">
            Moviendo planta de Carril {selectedTileToMove.lane + 1}, Casilla {selectedTileToMove.col + 1}. Haz clic en cualquier casilla defensiva para moverla o intercambiarla.
          </span>
          <button
            type="button"
            className="fortress-move-ribbon__shovel-btn"
            onClick={() => {
              handleTileClick(selectedTileToMove.lane, selectedTileToMove.col)
              setIsShovelActive(true)
            }}
          >
            🪓 Desenterrar
          </button>
          <button
            type="button"
            className="fortress-move-ribbon__cancel-btn"
            onClick={() => setSelectedTileToMove(null)}
          >
            ✖ Cancelar
          </button>
        </div>
      )}

      {/* Alertas dinámicas de guardado */}
      {saveStatus && (
        <div className={`fortress-editor-alert fortress-editor-alert--${saveStatus.type}`}>
          <span>{saveStatus.message}</span>
        </div>
      )}

      {!canEdit && !saveStatus && (
        <div className="fortress-editor-alert fortress-editor-alert--warning" style={{ background: '#78350f', border: '1px solid #f59e0b', color: '#fef3c7' }}>
          <span>👁️ MODO OBSERVADOR: Tu rango es Miembro. Solo el Líder, Colíderes y Veteranos tienen permiso para guardar cambios en la defensa.</span>
        </div>
      )}

      {/* ── CAMPO DE BATALLA (PERSPECTIVA DEFENSA IZQUIERDA C0..C6) ──────────── */}
      <div className="fortress-editor-field-container">
        <div
          className="fortress-editor-field"
          style={{ backgroundImage: `url(${arena1Bg})` }}
        >
          <div className="fortress-editor-depth-overlay" />

          {/* División visual del campo */}
          <div className="fortress-field-zone fortress-field-zone--ancestral">
            <span>🌻 RETAGUARDIA</span>
          </div>
          <div className="fortress-field-zone fortress-field-zone--defense">
            <span>🏰 TU BASTIÓN DEFENSIVO (C0 A C6)</span>
          </div>
          <div className="fortress-field-zone fortress-field-zone--attack">
            <span>⚔️ ZONA DE AVANCE ENEMIGO (C7 A C13)</span>
          </div>

          <div className="fortress-field-half-line" />

          {/* Renderizado de carriles */}
          {LANES_CONFIG_5.map((laneCfg) => {
            const isLaneLocked = !allowedLanes.includes(laneCfg.id)
            const isAncestralLane = ancestralLanes.includes(laneCfg.id)

            return (
              <div
                key={laneCfg.id}
                className={`fortress-editor-lane ${isLaneLocked ? 'fortress-editor-lane--locked' : ''}`}
                style={{
                  top: `${laneCfg.topPct}%`,
                  height: `${laneCfg.heightPct}%`,
                }}
              >
                {/* ── COLUMNA RETAGUARDIA SAGRADA (GIRASOLES ANCESTRALES) ── */}
                <div className="fortress-ancestral-dock">
                  {isAncestralLane ? (
                    <div
                      className={`fortress-ancestral-tile ${canHarvest ? 'fortress-ancestral-tile--ready' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (canHarvest) {
                          void handleHarvestSunflowers()
                        } else {
                          setShowSunflowerCareModal(true)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      title={
                        canHarvest
                          ? `☀️ ¡Cosecha Solar Lista! Toca para recolectar +${sunflowerConfig.sunsPerSunflower} ☀️`
                          : `🌻 Girasol Ancestral (Cosecha en ${formatRemainingTime(sunflowerRemainingSec)}). Toca para regar o abonar.`
                      }
                    >
                      <div className="fortress-ancestral-pedestal">
                        <div className="fortress-ancestral-rune-ring" />
                        <img
                          src="/game-assets/greenfoot/transparentsunflower.webp"
                          alt="Girasol Ancestral"
                          className="fortress-ancestral-sprite"
                        />
                      </div>

                      {canHarvest ? (
                        <div className="fortress-ancestral-sun-drop">
                          <span className="fortress-ancestral-sun-glow" />
                          <span className="fortress-ancestral-sun-icon">☀️</span>
                          <span className="fortress-ancestral-sun-val">+{sunflowerConfig.sunsPerSunflower}</span>
                        </div>
                      ) : (
                        <div className="fortress-ancestral-timer-pill">
                          <span>⏳ {formatRemainingTime(sunflowerRemainingSec)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="fortress-ancestral-tile fortress-ancestral-tile--dormant"
                      title={`🔒 Ranura Ancestral Durmiente. Desbloquea más girasoles al subir el Árbol Madre a Nivel ${laneCfg.id === 0 || laneCfg.id === 4 ? 4 : 2}.`}
                    >
                      <span className="fortress-ancestral-dormant-rune">ᛟ</span>
                    </div>
                  )}
                </div>

                <div className="fortress-lane-tag">
                  {isLaneLocked ? '🔒 BLOQUEADO' : `LÍNEA ${laneCfg.id + 1}`}
                </div>

                {isLaneLocked ? (
                  <div className="fortress-lane-locked-overlay">
                    <span className="fortress-locked-icon">🔒</span>
                    <span>
                      Línea {laneCfg.id + 1} Bloqueada • Desbloquea en Árbol Madre Nivel {laneCfg.id === 0 ? 3 : 4}
                    </span>
                  </div>
                ) : (
                  <div className="fortress-lane-tiles">
                    {defenseCols.map((col) => {
                      const placed = layout.find((p) => p.lane === laneCfg.id && p.col === col)
                      const placedCfg = placed ? PLANT_CONFIGS[placed.plantId] : null
                      const isBeingMoved = selectedTileToMove?.lane === laneCfg.id && selectedTileToMove?.col === col

                      return (
                        <div
                          key={col}
                          className={`fortress-defense-tile ${placed ? 'fortress-defense-tile--occupied' : ''} ${isBeingMoved ? 'fortress-defense-tile--moving' : ''} ${isShovelActive && placed ? 'fortress-defense-tile--shovel-target' : ''}`}
                          onClick={() => handleTileClick(laneCfg.id, col)}
                          title={
                            isShovelActive
                              ? placed
                                ? `Pala: Desenterrar ${placedCfg?.name} (+${FORTRESS_SUN_COSTS[placed.plantId] || 100} ☀️)`
                                : 'Casilla vacía'
                              : selectedTileToMove
                              ? placed
                                ? `Intercambiar con ${placedCfg?.name}`
                                : `Mover a esta casilla`
                              : placed
                              ? `Clic para mover ${placedCfg?.name}`
                              : `Plantar ${PLANT_CONFIGS[selectedPlantId]?.name} (-${FORTRESS_SUN_COSTS[selectedPlantId] || 100} ☀️)`
                          }
                        >
                          {placed && placedCfg && (
                            <div className={`fortress-placed-plant-wrapper ${isBeingMoved ? 'fortress-placed-plant-wrapper--moving' : ''}`}>
                              <img
                                src={placedCfg.sprite || placedCfg.icon}
                                alt={placedCfg.name}
                                className="fortress-placed-plant-sprite"
                              />
                              <span className="fortress-placed-cost-badge">
                                {FORTRESS_SUN_COSTS[placed.plantId] || 100}☀️
                              </span>
                              {isBeingMoved && (
                                <span className="fortress-placed-move-tag">MOVIENDO</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── SECCIÓN DE EMBOSCADAS TÁCTICAS ACTIVAS ────────────────────────────── */}
      {ambushes.length > 0 && (
        <div className="fortress-ambushes-bar">
          <div className="fortress-ambushes-bar__title">
            <span>⚡ EMBOSCADAS DEFENSIVAS PROGRAMADAS ({ambushes.length}):</span>
          </div>
          <div className="fortress-ambushes-list">
            {ambushes.map((amb, idx) => {
              const cfg = PLANT_CONFIGS[amb.plantId]
              const mins = Math.floor(amb.triggerSec / 60)
              const secs = amb.triggerSec % 60
              const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

              return (
                <div key={idx} className="fortress-ambush-chip">
                  <span className="fortress-ambush-chip__icon">⚡</span>
                  <span className="fortress-ambush-chip__name">{cfg?.name || amb.plantId}</span>
                  <span className="fortress-ambush-chip__lane">Línea {amb.lane + 1}</span>
                  <span className="fortress-ambush-chip__time">a los {timeStr}</span>
                  <button
                    type="button"
                    className="fortress-ambush-chip__del-btn"
                    onClick={() => handleRemoveAmbush(idx)}
                    title="Cancelar emboscada y reembolsar soles"
                  >
                    ✖
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODAL DE PROGRAMACIÓN DE EMBOSCADA TÁCTICA ───────────────────────── */}
      {ambushModalPlant && (
        <div className="fortress-ambush-modal-backdrop" onClick={() => setAmbushModalPlant(null)}>
          <div className="fortress-ambush-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fortress-ambush-modal__header">
              <h3>⚡ PROGRAMAR EMBOSCADA TÁCTICA</h3>
              <button
                type="button"
                className="fortress-ambush-modal__close-btn"
                onClick={() => setAmbushModalPlant(null)}
              >
                ✖
              </button>
            </div>

            <div className="fortress-ambush-modal__body">
              <div className="fortress-ambush-modal__plant-preview">
                <img
                  src={PLANT_CONFIGS[ambushModalPlant]?.icon}
                  alt={PLANT_CONFIGS[ambushModalPlant]?.name}
                />
                <div>
                  <h4>{PLANT_CONFIGS[ambushModalPlant]?.name}</h4>
                  <p>
                    {ambushModalPlant === 'jalapeno'
                      ? 'Arrasa con fuego toda la línea seleccionada en el segundo configurado.'
                      : ambushModalPlant === 'iceberglettuce'
                      ? 'Congela en seco al invasor rival que avance en ese instante.'
                      : ambushModalPlant === 'squash'
                      ? 'Potato Mine oculta: se arma bajo tierra y detona cuando el enemigo la pisa.'
                      : ambushModalPlant === 'garlic'
                      ? 'Squash aplastador: cae sobre el invasor rival y lo aplasta por completo.'
                      : ambushModalPlant === 'bonkchoy'
                      ? 'Bonk Choy emboscador: salta al carril lanzando puñetazos implacables.'
                      : 'Entra como trampa o refuerzo sorpresa en combate.'}
                  </p>
                  <span className="fortress-ambush-modal__cost">
                    Coste: <strong>{FORTRESS_SUN_COSTS[ambushModalPlant] || 100} ☀️</strong>
                  </span>
                </div>
              </div>

              <div className="fortress-ambush-modal__form">
                <div className="fortress-ambush-form-group">
                  <label>Línea / Carril de Activación:</label>
                  <div className="fortress-ambush-lanes-selector">
                    {allowedLanes.map((laneIdx) => (
                      <button
                        key={laneIdx}
                        type="button"
                        className={`fortress-ambush-lane-btn ${ambushLane === laneIdx ? 'is-selected' : ''}`}
                        onClick={() => setAmbushLane(laneIdx)}
                      >
                        Línea {laneIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fortress-ambush-form-group">
                  <label>Momento de Detonación en Batalla:</label>
                  <div className="fortress-ambush-time-selector">
                    {[15, 30, 45, 60, 75, 90, 105, 120, 150, 180].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        className={`fortress-ambush-time-btn ${ambushTriggerSec === sec ? 'is-selected' : ''}`}
                        onClick={() => setAmbushTriggerSec(sec)}
                      >
                        {Math.floor(sec / 60)}:{(sec % 60).toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="fortress-ambush-modal__footer">
              <button
                type="button"
                className="fortress-ambush-modal__btn-cancel"
                onClick={() => setAmbushModalPlant(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="fortress-ambush-modal__btn-confirm"
                onClick={handleScheduleAmbush}
              >
                ⚡ Guardar Emboscada ({FORTRESS_SUN_COSTS[ambushModalPlant] || 100} ☀️)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CUIDADO DE GIRASOLES ANCESTRALES (REGAR / FERTILIZAR) ─────── */}
      {showSunflowerCareModal && (
        <div className="fortress-ambush-modal-backdrop" onClick={() => setShowSunflowerCareModal(false)}>
          <div className="fortress-sunflower-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fortress-sf-modal-header">
              <div className="fortress-sf-header-title">
                <span className="fortress-sf-modal-icon">🌻</span>
                <div>
                  <h3>GIRASOLES ANCESTRALES DE LA BASE</h3>
                  <small>Santuario Solar Comunal • Nutre y acelera la cosecha</small>
                </div>
              </div>
              <button
                type="button"
                className="fortress-ambush-modal__close-btn"
                onClick={() => setShowSunflowerCareModal(false)}
              >
                ✖
              </button>
            </div>

            <div className="fortress-sf-modal-body">
              {/* Banner de Estado */}
              <div className={`fortress-sf-status-card ${canHarvest ? 'is-ready' : 'is-cooldown'}`}>
                <div className="fortress-sf-pedestal-preview">
                  <div className="fortress-ancestral-pedestal">
                    <div className="fortress-ancestral-rune-ring" />
                    <img
                      src="/game-assets/greenfoot/transparentsunflower.webp"
                      alt="Girasol Ancestral"
                      className="fortress-ancestral-sprite"
                    />
                  </div>
                  {canHarvest && (
                    <div className="fortress-sf-pulse-sun">☀️</div>
                  )}
                </div>

                <div className="fortress-sf-status-info">
                  <div className="fortress-sf-status-badge">
                    {canHarvest ? '✨ ¡COSECHA SOLAR LISTA!' : `⏳ RECARGANDO: ${formatRemainingTime(sunflowerRemainingSec)}`}
                  </div>
                  <p className="fortress-sf-status-desc">
                    {canHarvest
                      ? `Los ${sunflowerConfig.count} Girasoles Ancestrales florecieron con +${sunflowerConfig.totalSuns} ☀️ listos para tu Altar Defensivo.`
                      : `Generan ${sunflowerConfig.sunsPerSunflower} ☀️ cada uno (+${sunflowerConfig.totalSuns} ☀️ en total). Acelera el reloj regando o abonando.`}
                  </p>
                </div>
              </div>

              {/* Botón de Cosecha Directa si está listo */}
              {canHarvest ? (
                <button
                  type="button"
                  className="fortress-sf-claim-btn"
                  disabled={isHarvesting}
                  onClick={() => void handleHarvestSunflowers()}
                >
                  {isHarvesting ? '⏳ COSECHANDO SOLES...' : `☀️ ¡RECOLECTAR +${sunflowerConfig.totalSuns} SOLES!`}
                </button>
              ) : (
                /* Opciones de Aceleración con Agua y Fertilizante */
                <div className="fortress-sf-actions-grid">
                  {/* Opción 1: Regar */}
                  <div className="fortress-sf-action-card">
                    <div className="fortress-sf-action-top">
                      <span className="fortress-sf-action-icon">💧</span>
                      <div className="fortress-sf-action-text">
                        <strong>Regar con Agua</strong>
                        <small>-5 minutos al reloj</small>
                      </div>
                    </div>
                    <div className="fortress-sf-action-stock">
                      Tu Agua: <b>{activeFarmingInv.water} 💧</b>
                    </div>
                    <button
                      type="button"
                      className="fortress-sf-action-btn fortress-sf-action-btn--water"
                      disabled={isAccelerating || activeFarmingInv.water <= 0}
                      onClick={() => void handleAccelerateSunflowers('water', 1)}
                    >
                      {isAccelerating ? '...' : '💧 REGAR (-5m)'}
                    </button>
                  </div>

                  {/* Opción 2: Fertilizante */}
                  <div className="fortress-sf-action-card">
                    <div className="fortress-sf-action-top">
                      <span className="fortress-sf-action-icon">🌱</span>
                      <div className="fortress-sf-action-text">
                        <strong>Abonar Fertilizante</strong>
                        <small>-10 minutos al reloj</small>
                      </div>
                    </div>
                    <div className="fortress-sf-action-stock">
                      Tu Fertilizante: <b>{activeFarmingInv.fertilizer} 🌱</b>
                    </div>
                    <button
                      type="button"
                      className="fortress-sf-action-btn fortress-sf-action-btn--fertilizer"
                      disabled={isAccelerating || activeFarmingInv.fertilizer <= 0}
                      onClick={() => void handleAccelerateSunflowers('fertilizer', 1)}
                    >
                      {isAccelerating ? '...' : '🌱 ABONAR (-10m)'}
                    </button>
                  </div>
                </div>
              )}

              <div className="fortress-sf-modal-tip">
                <span>🌿</span>
                <small>
                  Cualquier miembro del clan puede cosechar o acelerar. Los soles cosechados se suman al presupuesto del clan para desplegar mejores defensas en Arena 1.
                </small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PALETA INFERIOR CON DESBLOQUEO POR DONACIÓN ───────────────────────── */}
      <footer className="fortress-editor-footer">
        <div className="fortress-selector-hint">
          <span>
            {isShovelActive
              ? '🪓 MODO PALA ACTIVO: Clic en cualquier planta para desenterrarla y recuperar soles.'
              : '🌱 ARSENAL DEL CLAN: Clic en plantas desbloqueadas para colocar o programar emboscadas. Clic en cartas con 🔒 para donar 1 copia:'}
          </span>
        </div>

        <div
          className="fortress-plant-palette"
          onWheel={(e) => {
            if (e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY
            }
          }}
        >
          {SELECTABLE_PLANTS.map((pid) => {
            const cfg = PLANT_CONFIGS[pid]
            const cost = FORTRESS_SUN_COSTS[pid] || 100
            const isUnlocked = unlockedPlants.includes(pid)
            const isAmbushType = TACTICAL_AMBUSH_PLANTS.includes(pid)
            const isSelected = selectedPlantId === pid && !selectedTileToMove && !isShovelActive
            const canAfford = sunsRemaining >= cost
            const copiesAvailable = plantCopies ? (plantCopies[pid] || 0) : 0

            return (
              <div
                key={pid}
                className={`fortress-palette-card ${isSelected ? 'fortress-palette-card--selected' : ''} ${!isUnlocked ? 'fortress-palette-card--locked' : ''} ${isUnlocked && !canAfford ? 'fortress-palette-card--disabled' : ''}`}
                onClick={() => {
                  if (!isUnlocked) {
                    if (plantCopies && copiesAvailable <= 0) {
                      soundManager.playSound('click', 0.2)
                      setSaveStatus({
                        type: 'error',
                        message: `⚠️ No posees copias extra de ${cfg.name} para donar (tienes 0). Abre sobres en el Menú para conseguir copias.`,
                      })
                      return
                    }
                    if (confirm(`¿Deseas donar 1 copia de ${cfg.name} de tu colección para desbloquearla permanentemente en el arsenal del clan? (Tienes ${copiesAvailable} copia${copiesAvailable === 1 ? '' : 's'})`)) {
                      void handleDonateToArsenal(pid)
                    }
                    return
                  }
                  soundManager.playSound('click', 0.2)
                  setSelectedPlantId(pid)
                  setSelectedTileToMove(null)
                  setIsShovelActive(false)

                  if (isAmbushType) {
                    setAmbushModalPlant(pid)
                    setAmbushLane(allowedLanes[0] || 1)
                  }
                }}
              >
                <div className="fortress-palette-img-wrap">
                  <img src={cfg.icon} alt={cfg.name} className="fortress-palette-img" />
                  {isAmbushType && (
                    <span className="fortress-palette-ambush-tag">⚡ TRAMPA</span>
                  )}
                  {isUnlocked && (
                    <span className="fortress-palette-cost">{cost}☀️</span>
                  )}
                  {!isUnlocked && (
                    <div className="fortress-palette-lock-overlay" title={`Bloqueada. ${copiesAvailable > 0 ? `Clic para donar 1 de tus ${copiesAvailable} copias` : 'No posees copias para donar'}`}>
                      <span>🔒</span>
                    </div>
                  )}
                </div>

                <span className="fortress-palette-name">
                  {!isUnlocked
                    ? isDonating === pid
                      ? 'DONANDO...'
                      : copiesAvailable > 0
                      ? `🎁 DONAR (${copiesAvailable})`
                      : '🔒 SIN COPIAS'
                    : cfg.name}
                </span>
              </div>
            )
          })}
        </div>
      </footer>
    </div>
  )
}
