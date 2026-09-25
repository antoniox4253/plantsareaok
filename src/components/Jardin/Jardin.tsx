import { useState, useEffect, useMemo } from 'react'
import type { PlantCardInstance, PlantId } from '../../types/game'
import {
  PLANT_CONFIGS,
  STAT_LABELS,
  getFusionGoldCost,
  getScaledPlantConfig,
  getEquippableItemDef,
  getEquippableItemsForPlant,
  isPlantMatchingTarget,
  type PlantStatKey,
} from '../../utils/gameConstants'
import background from '../../assets/images/background.webp'
import { soundManager } from '../../utils/audioManager'
import type { InventoryPack, PackId } from '../../utils/packDropManager'
import type { PlayerRewardPack } from '../../utils/freePackManager'
import { EMPTY_FARMING_INVENTORY, FARMING_ITEM_DEFINITIONS, type FarmingInventory } from '../../utils/pvpRewardManager'
import { supabaseService } from '../../services/supabaseService'
import { triggerArenaAdsSmartlink } from '../../utils/arenaAdsNetwork'
import TreeModal from './TreeModal'
import './Jardin.css'

const sunIcon = '/game-assets/greenfoot/sun1.webp'
const ALL_PLANTS = Object.keys(PLANT_CONFIGS) as PlantId[]

function groupRolls(rolls: PlantStatKey[]) {
  const map = new Map<PlantStatKey, number>()
  ;(rolls || []).filter(Boolean).forEach((r) => {
    map.set(r, (map.get(r) || 0) + 1)
  })
  return Array.from(map.entries()).map(([stat, count]) => {
    const meta = (stat && STAT_LABELS[stat]) || {
      label: String(stat || 'Mejora'),
      icon: '⚡',
      suffix: `+${count * 15}%`,
      color: '#fbbf24',
    }
    const totalPct = count * 15
    const suffix = meta.suffix || `+${count * 15}%`
    const icon = meta.icon || '⚡'
    const label =
      count > 1
        ? `${icon} +${totalPct}% ${suffix.replace('+15% ', '').replace('-15% ', '')} (x${count})`
        : `${icon} ${suffix}`
    return {
      stat,
      count,
      totalPct,
      label,
      color: meta.color || '#fbbf24',
      meta,
    }
  })
}

interface JardinProps {
  activeDeck: PlantId[]
  unlockedPlants: PlantId[]
  inventoryPacks: InventoryPack[]
  playerRewardPacks?: PlayerRewardPack[]
  userTokens: number
  userGold?: number
  farmingItems?: FarmingInventory
  plantCopies?: Partial<Record<PlantId, number>>
  plantLevels?: Partial<Record<PlantId, number>>
  plantStatRolls?: Partial<Record<PlantId, PlantStatKey[]>>
  plantInstances?: PlantCardInstance[]
  onUpdateDeck: (newDeck: PlantId[], instanceIds?: string[]) => void
  onBack: (instanceIds?: string[]) => void
  onPlay: (instanceIds?: string[]) => void | Promise<void>
  onOpenCollection: () => void
  onOpenShop: () => void
  onOpenPack: (instanceId: string) => void | Promise<void>
  isAdmin?: boolean
  onOpenAdmin?: () => void
  onOpenMultiplePacks?: (instanceIds: string[]) => void | Promise<void>
  onStartUnlockRewardPack?: (packId: string) => Promise<{ success: boolean; error?: string }>
  onInstantUnlockRewardPack?: (packId: string) => Promise<{ success: boolean; goldSpent?: number; error?: string }>
  onOpenRewardPack?: (packId: string) => void
  // Asíncrona: la fusión la resuelve fuse_plant en el servidor, que es quien
  // sortea la stat y descuenta las 5 copias.
  onFusePlant?: (plantId: PlantId, instanceId?: string) => Promise<{
    success: boolean
    newLevel?: number
    rolledStat?: PlantStatKey
    rolledStatLabel?: string
    error?: string
  }>
  onSproutPlant?: (plantId: PlantId, instanceId?: string) => Promise<{
    success: boolean
    instanceId?: string
    plantId?: string
    childNumber?: number
    copiesRemaining?: number
    waterSpent?: number
    fertilizerSpent?: number
    error?: string
  }>
  onEquipItem?: (instanceId: string, itemId: string) => Promise<{ success: boolean; error?: string }>
  onUnequipItem?: (instanceId: string) => Promise<{ success: boolean; error?: string }>
  onConvertPlantToCopy?: (instanceId: string) => Promise<{
    success: boolean
    plantId?: string
    newCopies?: number
    newGemsBalance?: number
    refundedItem?: string | null
    error?: string
  }>
  playerEnergy?: number
  maxPlayerEnergy?: number
  onUseEnergyPotion?: (itemId?: string) => Promise<{ success: boolean; energyAdded?: number; energyCurrent?: number; error?: string }>
  /** Recarga saldo e inventario del servidor tras un premio de la lotería. */
  onRewardsChanged?: () => Promise<void> | void
  equippedTreeSkin?: string | null
  onEquipMotherTreeSkin?: (skinId: string) => Promise<{ success: boolean; error?: string }>
  onUnequipMotherTreeSkin?: () => Promise<{ success: boolean; error?: string }>
}

const FUSION_COPIES_REQ = 5

export const PLANT_ELIGIBLE_STATS_LABELS: Record<string, string[]> = {
  sunflower: ['❤️ Salud +15%', '⏱️ Recarga -15%'],
  peashooter: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%'],
  wallnut: ['❤️ Salud +15%', '⏱️ Recarga -15%'],
  chomper: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%', '🏃 Vel. Movimiento +15%'],
  bonkchoy: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%', '🏃 Vel. Movimiento +15%'],
  garlic: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '🏃 Vel. Movimiento +15%'],
  melonpult: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%'],
  repeater: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%'],
  squash: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%'],
  twinsunflower: ['❤️ Salud +15%', '⏱️ Recarga -15%'],
  jalapeno: ['⚔️ Daño +150', '⏱️ Recarga -15%'],
  aloe: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%'],
  tallnut: ['❤️ Salud +15%', '⏱️ Recarga -15%'],
  iceberglettuce: ['❄️ Duración +2s', '⏱️ Recarga -15%'],
  threepeater: ['❤️ Salud +15%', '⏱️ Recarga -15%', '⚔️ Daño +15%', '⚡ Vel. Ataque +15%'],
}

export default function Jardin({
  activeDeck,
  unlockedPlants,
  inventoryPacks,
  playerRewardPacks = [],
  userTokens,
  userGold = 0,
  farmingItems = EMPTY_FARMING_INVENTORY,
  plantCopies = {},
  plantLevels = {},
  plantStatRolls = {},
  plantInstances = [],
  onUpdateDeck,
  onBack,
  onPlay,
  onOpenCollection: _onOpenCollection,
  onOpenShop,
  onOpenPack,
  onOpenMultiplePacks,
  onStartUnlockRewardPack,
  onInstantUnlockRewardPack,
  onOpenRewardPack,
  onFusePlant,
  onSproutPlant,
  onEquipItem,
  onUnequipItem,
  onConvertPlantToCopy,
  isAdmin: _isAdmin,
  onOpenAdmin: _onOpenAdmin,
  onRewardsChanged,
  playerEnergy = 20,
  maxPlayerEnergy = 20,
  onUseEnergyPotion,
  equippedTreeSkin = null,
  onEquipMotherTreeSkin,
  onUnequipMotherTreeSkin,
}: JardinProps) {
  const [deck, setDeck] = useState<PlantId[]>(activeDeck)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted())
  const [showTreeModal, setShowTreeModal] = useState(false)
  const [rewardPackAccelerating, setRewardPackAccelerating] = useState<{
    packId: string
    goldCost: number
    isClanChampion?: boolean
  } | null>(null)
  const [isAcceleratingReward, setIsAcceleratingReward] = useState(false)
  const [rewardPackAlert, setRewardPackAlert] = useState<{ title: string; message: string; icon: string } | null>(null)
  const [upgradeModal, setUpgradeModal] = useState<{
    plantId: PlantId
    newLevel: number
    rolledStat: PlantStatKey
  } | null>(null)
  const [fuseCandidate, setFuseCandidate] = useState<{
    plantId: PlantId
    instanceId: string
    level: number
    name: string
    icon: string
    cost: number
  } | null>(null)
  const [isFusing, setIsFusing] = useState(false)
  const [fuseAlert, setFuseAlert] = useState<{ title: string; message: string; icon: string } | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleConfirmFuse = async () => {
    if (!fuseCandidate || !onFusePlant || isFusing) return
    setIsFusing(true)
    try {
      soundManager.playSound('plantation', 0.9)
      const candidate = fuseCandidate
      const res = await onFusePlant(candidate.plantId, candidate.instanceId)
      setFuseCandidate(null)
      if (
        res?.success === true &&
        typeof res.newLevel === 'number' &&
        Number.isInteger(res.newLevel) &&
        res.newLevel > 0 &&
        typeof res.rolledStat === 'string' &&
        res.rolledStat.length > 0
      ) {
        setUpgradeModal({
          plantId: candidate.plantId,
          newLevel: res.newLevel,
          rolledStat: res.rolledStat,
        })
      } else if (res && !res.success && res.error) {
        setFuseAlert({
          title: 'NO SE PUDO MEJORAR',
          message: res.error,
          icon: '⚠️',
        })
      }
    } catch (err: any) {
      setFuseCandidate(null)
      setFuseAlert({
        title: 'ERROR AL MEJORAR',
        message: err?.message || 'Error inesperado al mejorar la planta',
        icon: '⚠️',
      })
    } finally {
      setIsFusing(false)
    }
  }

  const [sproutCandidate, setSproutCandidate] = useState<{
    instanceId: string
    plantId: PlantId
    name: string
    icon: string
    waterCost: number
    fertCost: number
    childNumber: number
  } | null>(null)
  const [isSprouting, setIsSprouting] = useState(false)

  const handleConfirmSprout = async () => {
    if (!sproutCandidate || !onSproutPlant || isSprouting) return
    setIsSprouting(true)
    try {
      soundManager.playSound('plantation', 0.9)
      const candidate = sproutCandidate
      const res = await onSproutPlant(candidate.plantId, candidate.instanceId)
      setSproutCandidate(null)
      if (res?.success) {
        setFuseAlert({
          title: '¡NUEVA PLANTA GERMINADA!',
          message: `Has germinado con éxito la Cría #${candidate.childNumber} de ${candidate.name}. ¡Ya está disponible en tu Jardín como una carta independiente!`,
          icon: '🌱',
        })
      } else if (res && !res.success && res.error) {
        setFuseAlert({
          title: 'NO SE PUDO GERMINAR',
          message: res.error,
          icon: '⚠️',
        })
      }
    } catch (err: any) {
      setSproutCandidate(null)
      setFuseAlert({
        title: 'ERROR AL GERMINAR',
        message: err?.message || 'Error inesperado al germinar la planta',
        icon: '⚠️',
      })
    } finally {
      setIsSprouting(false)
    }
  }

  const [isEquippingItem, setIsEquippingItem] = useState(false)

  const handleEquipItem = async (instanceId: string, itemId: string) => {
    if (isEquippingItem || !onEquipItem) return
    setIsEquippingItem(true)
    const itemDef = getEquippableItemDef(itemId)
    const targetPlantId = itemDef?.targetPlantId || 'bonkchoy'
    try {
      soundManager.playSound('click', 0.5)
      let targetId = instanceId
      if (targetId.startsWith('inst_base_')) {
        const real = plantInstances.find((p) => isPlantMatchingTarget(targetPlantId, p.plantId) && !p.instanceId.startsWith('inst_base_'))
        if (real) targetId = real.instanceId
      }
      const res = await onEquipItem(targetId, itemId)
      if (res?.success) {
        soundManager.playSound('victory', 0.6)
        setFuseAlert({
          title: `¡${itemDef?.name?.toUpperCase() || 'ÍTEM'} EQUIPADO!`,
          message: `Has equipado ${itemDef?.name || 'el ítem'} a ${itemDef?.equippedPlantName || 'tu planta'}. ¡${itemDef?.statBonusText || 'Bonificaciones activadas'}!`,
          icon: itemDef?.emoji || '🥊',
        })
      } else if (res && !res.success && res.error) {
        setFuseAlert({
          title: 'NO SE PUDO EQUIPAR',
          message: res.error,
          icon: '⚠️',
        })
      }
    } catch (err: any) {
      setFuseAlert({
        title: 'ERROR AL EQUIPAR',
        message: err?.message || 'Error inesperado al equipar el ítem',
        icon: '⚠️',
      })
    } finally {
      setIsEquippingItem(false)
    }
  }

  const handleUnequipItem = async (instanceId: string) => {
    if (isEquippingItem || !onUnequipItem) return
    setIsEquippingItem(true)
    const currentInst = plantInstances.find((p) => p.instanceId === instanceId)
    const currentItemDef = getEquippableItemDef(currentInst?.equippedItem)
    const targetPlantId = currentItemDef?.targetPlantId || (instanceId.startsWith('inst_base_') ? (instanceId.replace('inst_base_', '') as PlantId) : 'bonkchoy')
    try {
      soundManager.playSound('click', 0.5)
      let targetId = instanceId
      if (targetId.startsWith('inst_base_')) {
        const real = plantInstances.find((p) => p.plantId === targetPlantId && !p.instanceId.startsWith('inst_base_'))
        if (real) targetId = real.instanceId
      }
      const res = await onUnequipItem(targetId)
      if (res?.success) {
        soundManager.playSound('plantation', 0.6)
        setFuseAlert({
          title: `${currentItemDef?.name?.toUpperCase() || 'ÍTEM'} DESEQUIPADO`,
          message: `Has desequipado ${currentItemDef?.name || 'el ítem'}. Ha vuelto a tu inventario de recursos de cultivo.`,
          icon: '📦',
        })
      } else if (res && !res.success && res.error) {
        setFuseAlert({
          title: 'NO SE PUDO DESEQUIPAR',
          message: res.error,
          icon: '⚠️',
        })
      }
    } catch (err: any) {
      setFuseAlert({
        title: 'ERROR AL DESEQUIPAR',
        message: err?.message || 'Error inesperado al desequipar el ítem',
        icon: '⚠️',
      })
    } finally {
      setIsEquippingItem(false)
    }
  }

  const [convertCandidate, setConvertCandidate] = useState<{
    instanceId: string
    plantId: PlantId
    name: string
    icon: string
    level: number
    equippedItem?: string | null
    inDeck: boolean
    speciesCount?: number
  } | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  const handleConfirmConvert = async () => {
    if (!convertCandidate || !onConvertPlantToCopy || isConverting) return
    setIsConverting(true)
    const candidate = convertCandidate
    try {
      soundManager.playSound('click', 0.5)
      const res = await onConvertPlantToCopy(candidate.instanceId)
      setConvertCandidate(null)
      if (res?.success) {
        soundManager.playSound('victory', 0.6)
        setDeckInstanceIds((prev) => prev.filter((id) => id !== candidate.instanceId))
        setFuseAlert({
          title: '¡PLANTA CONVERTIDA EN COPIA!',
          message: `Has convertido con éxito a ${candidate.name} en +1 copia para fusiones. Se descontaron 50 Gemas de tu saldo.${candidate.equippedItem ? ' El ítem equipado fue reintegrado a tus recursos.' : ''}`,
          icon: '♻️',
        })
      } else if (res && !res.success && res.error) {
        setFuseAlert({
          title: 'NO SE PUDO CONVERTIR',
          message: res.error,
          icon: '⚠️',
        })
      }
    } catch (err: any) {
      setConvertCandidate(null)
      setFuseAlert({
        title: 'ERROR AL CONVERTIR',
        message: err?.message || 'Error inesperado al convertir la planta en copia',
        icon: '⚠️',
      })
    } finally {
      setIsConverting(false)
    }
  }

  const [beltConfirmModal, setBeltConfirmModal] = useState<{
    action: 'equip' | 'unequip'
    instanceId: string
    plantName: string
    itemId?: string
    plantId?: PlantId
    itemName?: string
    itemEmoji?: string
    bonusText?: string
  } | null>(null)

  const [treeSkinModal, setTreeSkinModal] = useState<{
    action: 'equip' | 'unequip'
    skinId: string
  } | null>(null)
  const [isEquippingTreeSkin, setIsEquippingTreeSkin] = useState<boolean>(false)

  const handleTreeSkinCardClick = () => {
    soundManager.playSound('click', 0.5)
    if (equippedTreeSkin === 'mother_tree_skin') {
      setTreeSkinModal({ action: 'unequip', skinId: 'mother_tree_skin' })
    } else {
      const qty = Number(farmingItems?.mother_tree_skin || 0)
      if (qty <= 0) {
        setFuseAlert({
          title: 'SIN UNIDADES DISPONIBLES',
          message: 'No tienes unidades de Skin: Árbol Centinela en tus recursos de cultivo.',
          icon: '🌌',
        })
        return
      }
      setTreeSkinModal({ action: 'equip', skinId: 'mother_tree_skin' })
    }
  }

  const handleConfirmTreeSkinAction = async () => {
    if (!treeSkinModal || isEquippingTreeSkin) return
    const { action, skinId } = treeSkinModal
    setIsEquippingTreeSkin(true)
    try {
      if (action === 'equip') {
        const res = await onEquipMotherTreeSkin?.(skinId)
        if (res?.success) {
          soundManager.playSound('victory', 0.6)
          setFuseAlert({
            title: '¡SKIN CENTINELA EQUIPADA!',
            message: 'El aspecto del Árbol Centinela ha sido equipado en tu Árbol Madre. Ahora se verá en combate tanto para ti como para tu rival y lanzará 2 proyectiles cósmicos cada 10s.',
            icon: '🌌',
          })
          setTreeSkinModal(null)
          void onRewardsChanged?.()
        } else {
          setFuseAlert({
            title: 'ERROR AL EQUIPAR',
            message: res?.error || 'No se pudo equipar el aspecto del Árbol Madre.',
            icon: '⚠️',
          })
        }
      } else {
        const res = await onUnequipMotherTreeSkin?.()
        if (res?.success) {
          soundManager.playSound('click', 0.6)
          setFuseAlert({
            title: 'ASPECTO DESEQUIPADO',
            message: 'El aspecto ha sido desequipado y regresó a tus recursos de cultivo. Tu Árbol Madre volvió a su aspecto clásico.',
            icon: '🌳',
          })
          setTreeSkinModal(null)
          void onRewardsChanged?.()
        } else {
          setFuseAlert({
            title: 'ERROR AL DESEQUIPAR',
            message: res?.error || 'No se pudo desequipar el aspecto.',
            icon: '⚠️',
          })
        }
      }
    } catch (err: any) {
      setFuseAlert({
        title: 'ERROR',
        message: err?.message || 'Ocurrió un error al procesar el aspecto.',
        icon: '⚠️',
      })
    } finally {
      setIsEquippingTreeSkin(false)
    }
  }

  const [energyPotionModal, setEnergyPotionModal] = useState<{
    itemId: string
    currentEnergy: number
    maxEnergy: number
    willAdd: number
    resultingEnergy: number
  } | null>(null)
  const [isConsumingPotion, setIsConsumingPotion] = useState<boolean>(false)

  const handleEnergyPotionClick = (itemId: string = 'energy_potion_5') => {
    const qty = Number(farmingItems?.[itemId as keyof FarmingInventory] || 0)
    if (qty <= 0) {
      setFuseAlert({
        title: 'SIN POCIONES',
        message: 'No posees ninguna Poción de Energía en tu inventario.',
        icon: '⚡',
      })
      return
    }

    soundManager.playSound('click', 0.5)

    const cur = playerEnergy
    const max = maxPlayerEnergy

    if (cur >= max) {
      setFuseAlert({
        title: 'ENERGÍA AL MÁXIMO',
        message: `⚠️ Tu energía ya está al máximo (${cur}/${max}⚡).\nNo necesitas usar este objeto ahora.`,
        icon: '⚡',
      })
      return
    }

    const willAdd = Math.min(5, max - cur)
    const resulting = cur + willAdd

    setEnergyPotionModal({
      itemId,
      currentEnergy: cur,
      maxEnergy: max,
      willAdd,
      resultingEnergy: resulting,
    })
  }

  const handleConfirmUseEnergyPotion = async () => {
    if (!energyPotionModal || isConsumingPotion) return
    setIsConsumingPotion(true)
    const { itemId } = energyPotionModal

    try {
      if (onUseEnergyPotion) {
        const res = await onUseEnergyPotion(itemId)
        setEnergyPotionModal(null)
        if (res.success) {
          soundManager.playSound('plantation', 0.8)
          setFuseAlert({
            title: '¡ENERGÍA RECARGADA!',
            message: `⚡ ¡Has utilizado 1 Poción de Energía con éxito!\nSe añadieron +${res.energyAdded ?? 5}⚡ a tu cuenta (Total: ${res.energyCurrent ?? (playerEnergy + 5)}/${maxPlayerEnergy}⚡).`,
            icon: '⚡',
          })
        } else {
          setFuseAlert({
            title: 'ERROR AL CONSUMIR',
            message: res.error || 'No se pudo usar la Poción de Energía.',
            icon: '⚠️',
          })
        }
      }
    } finally {
      setIsConsumingPotion(false)
    }
  }

  const handleEquippableResourceClick = (itemId: string) => {
    const itemDef = getEquippableItemDef(itemId)
    if (!itemDef) return

    soundManager.playSound('click', 0.5)

    const targetPlantId = itemDef.targetPlantId
    const plantConfig = PLANT_CONFIGS[targetPlantId]
    const targetInstances = plantInstances.filter((p) => isPlantMatchingTarget(targetPlantId, p.plantId))
    const hasPlantUnlocked = unlockedPlants.some((pid) => isPlantMatchingTarget(targetPlantId, pid)) || targetInstances.length > 0

    if (!hasPlantUnlocked) {
      setFuseAlert({
        title: `SÓLO PARA ${plantConfig?.name?.toUpperCase() || 'ESTA PLANTA'}`,
        message: `${itemDef.name} es un ítem exclusivo para ${plantConfig?.name || 'su planta'}. Consigue o desbloquea a ${plantConfig?.name || 'la planta'} en tu Jardín para utilizar este ítem.`,
        icon: itemDef.emoji,
      })
      return
    }

    const equippedInstance = targetInstances.find((p) => p.equippedItem === itemId)
    if (equippedInstance) {
      setBeltConfirmModal({
        action: 'unequip',
        instanceId: equippedInstance.instanceId,
        plantName: plantConfig?.name || 'Planta',
        itemId,
        plantId: targetPlantId,
        itemName: itemDef.name,
        itemEmoji: itemDef.emoji,
        bonusText: itemDef.statBonusText,
      })
      return
    }

    const availableQty = Number(farmingItems?.[itemId as keyof FarmingInventory] || 0)
    if (availableQty <= 0) {
      setFuseAlert({
        title: 'SIN UNIDADES DISPONIBLES',
        message: `No tienes unidades de ${itemDef.name} en tus recursos de cultivo.`,
        icon: itemDef.emoji,
      })
      return
    }

    const targetInstId = targetInstances[0]?.instanceId || `inst_base_${targetPlantId}`
    setBeltConfirmModal({
      action: 'equip',
      instanceId: targetInstId,
      plantName: plantConfig?.name || 'Planta',
      itemId,
      plantId: targetPlantId,
      itemName: itemDef.name,
      itemEmoji: itemDef.emoji,
      bonusText: itemDef.statBonusText,
    })
  }

  const [openQuantities, setOpenQuantities] = useState<Record<string, number>>({})
  const [isOpeningPacks, setIsOpeningPacks] = useState<boolean>(false)
  const [isFarmingCollapsed, setIsFarmingCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('plant_arena_jardin_farming_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const handleToggleFarmingCollapse = () => {
    setIsFarmingCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('plant_arena_jardin_farming_collapsed', String(next))
      } catch {}
      return next
    })
  }

  const [isClaimingGardenAd, setIsClaimingGardenAd] = useState<boolean>(false)

  const handleClaimGardenAd = async (rewardType: 'water' | 'fertilizer') => {
    if (isClaimingGardenAd) return
    setIsClaimingGardenAd(true)
    try {
      // 1. Abrir anuncio directo (Smartlink) en nueva pestaña
      triggerArenaAdsSmartlink()

      // 2. Pequeño tiempo de cortesía para procesar la interacción con el sponsor
      await new Promise((resolve) => setTimeout(resolve, 2500))

      // 3. Reclamar en Supabase RPC
      const res = await supabaseService.claimGardenAdReward(rewardType)
      if (res.success) {
        soundManager.playSound('plantation', 0.8)
        if (onRewardsChanged) {
          await onRewardsChanged()
        }
        setFuseAlert({
          title: '¡SUMINISTROS RECIBIDOS!',
          message:
            rewardType === 'water'
              ? `💧 ¡Has recibido +${res.waterAdded ?? 2} Aguas para tus plantas!\n\nReclamos restantes hoy: ${res.remainingToday ?? 0}/${res.maxViews ?? 3}.`
              : `🧪 ¡Has recibido +${res.fertilizerAdded ?? 1} Fertilizante para tus plantas!\n\nReclamos restantes hoy: ${res.remainingToday ?? 0}/${res.maxViews ?? 3}.`,
          icon: rewardType === 'water' ? '💧' : '🧪',
        })
      } else {
        setFuseAlert({
          title: 'LÍMITE ALCANZADO',
          message: res.error || 'Has alcanzado el límite diario de suministros gratuitos. ¡Vuelve mañana!',
          icon: '⏳',
        })
      }
    } catch (err: any) {
      setFuseAlert({
        title: 'ERROR',
        message: err?.message || 'Error al conectar con el patrocinador.',
        icon: '⚠️',
      })
    } finally {
      setIsClaimingGardenAd(false)
    }
  }

  const groupedPacks = useMemo(() => {
    const map = new Map<PackId, InventoryPack[]>()
    inventoryPacks.forEach((p) => {
      if (!map.has(p.packId)) map.set(p.packId, [])
      map.get(p.packId)!.push(p)
    })
    return Array.from(map.entries()).map(([packId, instances]) => ({
      packId,
      first: instances[0],
      count: instances.length,
      instances,
    }))
  }, [inventoryPacks])

  const getQty = (packId: string, maxCount: number) => {
    const val = openQuantities[packId] ?? 1
    return Math.max(1, Math.min(maxCount, val))
  }

  const setQty = (packId: string, val: number, maxCount: number) => {
    const clamped = Math.max(1, Math.min(maxCount, val))
    setOpenQuantities((prev) => ({ ...prev, [packId]: clamped }))
  }

  useEffect(() => {
    soundManager.playBgm('menu')
    const unsubscribe = soundManager.subscribe((muted) => setIsMuted(muted))
    return () => unsubscribe()
  }, [])

  const isDeckValid = deck.length >= 3 && deck.length <= 6

  // Computes all cards to display: Base cards + separate purchased/upgraded instances
  const displayedCards = useMemo(() => {
    const cards: {
      instanceId: string
      plantId: PlantId
      level: number
      statRolls: PlantStatKey[]
      isBase: boolean
      isUnlocked: boolean
      germinationsCount: number
      equippedItem?: string | null
      isListed?: boolean
    }[] = []

    ALL_PLANTS.forEach((plantId) => {
      const hasInstance = plantInstances.some((i) => i.plantId === plantId)
      const isUnlocked = unlockedPlants.includes(plantId) || hasInstance
      if (!isUnlocked) {
        cards.push({
          instanceId: `locked_${plantId}`,
          plantId,
          level: 0,
          statRolls: [],
          isBase: true,
          isUnlocked: false,
          germinationsCount: 0,
          equippedItem: null,
          isListed: false,
        })
        return
      }

      const instances = plantInstances.filter((i) => i.plantId === plantId)
      if (instances.length > 0) {
        instances.forEach((inst) => {
          cards.push({
            instanceId: inst.instanceId,
            plantId: inst.plantId,
            level: inst.level,
            statRolls: inst.statRolls || [],
            isBase: inst.isBase ?? false,
            isUnlocked: true,
            germinationsCount: inst.germinationsCount ?? 0,
            equippedItem: inst.equippedItem || null,
            isListed: Boolean(inst.isListed),
          })
        })
      } else {
        // Fallback base card
        cards.push({
          instanceId: `inst_base_${plantId}`,
          plantId,
          level: plantLevels[plantId] || 0,
          statRolls: plantStatRolls[plantId] || [],
          isBase: true,
          isUnlocked: true,
          germinationsCount: 0,
          equippedItem: null,
          isListed: false,
        })
      }
    })

    return cards
  }, [unlockedPlants, plantInstances, plantLevels, plantStatRolls])

  // We track the array of instance IDs currently selected in the deck (up to 6)
  const [deckInstanceIds, setDeckInstanceIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('plant_arena_active_deck_instances')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => displayedCards.some((c) => c.instanceId === id && c.isUnlocked && !c.isListed))
          if (valid.length > 0) return valid
        }
      }
    } catch {}

    const result: string[] = []
    const used = new Set<string>()
    activeDeck.forEach((pId) => {
      const inst = displayedCards.find((c) => c.plantId === pId && !used.has(c.instanceId) && c.isUnlocked && !c.isListed)
      if (inst) {
        result.push(inst.instanceId)
        used.add(inst.instanceId)
      }
    })
    return result
  })

  // Synchronize with activeDeck changes and persist
  useEffect(() => {
    try {
      localStorage.setItem('plant_arena_active_deck_instances', JSON.stringify(deckInstanceIds))
    } catch {}
  }, [deckInstanceIds])

  // Si alguna carta en el mazo fue puesta en venta en el mercado, se retira de la selección activa
  useEffect(() => {
    const unlistedDeck = deckInstanceIds.filter((id) => {
      const card = displayedCards.find((c) => c.instanceId === id)
      return card && !card.isListed
    })
    if (unlistedDeck.length !== deckInstanceIds.length) {
      setDeckInstanceIds(unlistedDeck)
      const plantIds = unlistedDeck
        .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
        .filter(Boolean) as PlantId[]
      setDeck(plantIds)
      onUpdateDeck(plantIds, unlistedDeck)
    }
  }, [displayedCards, deckInstanceIds, onUpdateDeck])

  const handleRemoveSlotInstance = (slotIdx: number) => {
    soundManager.playSound('plantation', 0.4)
    const next = deckInstanceIds.filter((_, idx) => idx !== slotIdx)
    setDeckInstanceIds(next)
    const plantIds = next
      .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
      .filter(Boolean) as PlantId[]
    setDeck(plantIds)
    onUpdateDeck(plantIds, next)
    setSelectedSlotIndex(null)
  }

  const handleToggleCardInstance = (card: typeof displayedCards[0]) => {
    if (!card.isUnlocked) {
      soundManager.playSound('plantation', 0.2)
      return
    }

    if (card.isListed) {
      soundManager.playSound('plantation', 0.2)
      setFuseAlert({
        title: 'PLANTA EN VENTA EN EL MERCADO',
        message: `🏷️ ${card.plantId ? PLANT_CONFIGS[card.plantId]?.name : 'Esta planta'} se encuentra actualmente listada para la venta en el Comercio P2P.\n\nPara poder equiparla en tu mazo de batalla o mejorarla, puedes retirarla en cualquier momento desde:\nComercio > Mis Ventas > Recuperar.`,
        icon: '🏷️',
      })
      return
    }

    soundManager.playSound('plantation', 0.5)

    const inDeck = deckInstanceIds.includes(card.instanceId)

    if (inDeck) {
      const next = deckInstanceIds.filter((id) => id !== card.instanceId)
      setDeckInstanceIds(next)
      const plantIds = next
        .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
        .filter(Boolean) as PlantId[]
      setDeck(plantIds)
      onUpdateDeck(plantIds, next)
      setSelectedSlotIndex(null)
    } else {
      // Verificar si ya hay otra instancia de la misma especie en el mazo
      const existingSameSpeciesIndex = deckInstanceIds.findIndex((id) => {
        const c = displayedCards.find((cardItem) => cardItem.instanceId === id)
        return c?.plantId === card.plantId
      })

      if (selectedSlotIndex !== null) {
        let next = [...deckInstanceIds]
        // Si la misma especie ya estaba en otro slot distinto, removerla para que no haya duplicados
        if (existingSameSpeciesIndex !== -1 && existingSameSpeciesIndex !== selectedSlotIndex) {
          next = next.filter((_, idx) => idx !== existingSameSpeciesIndex)
        }
        if (selectedSlotIndex < next.length) {
          next[selectedSlotIndex] = card.instanceId
        } else if (next.length < 6) {
          next.push(card.instanceId)
        }
        setDeckInstanceIds(next)
        const plantIds = next
          .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
          .filter(Boolean) as PlantId[]
        setDeck(plantIds)
        onUpdateDeck(plantIds, next)
        setSelectedSlotIndex(null)
      } else if (existingSameSpeciesIndex !== -1) {
        // Si ya está esa especie en el mazo, reemplazarla en su slot por esta nueva instancia
        const next = [...deckInstanceIds]
        next[existingSameSpeciesIndex] = card.instanceId
        setDeckInstanceIds(next)
        const plantIds = next
          .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
          .filter(Boolean) as PlantId[]
        setDeck(plantIds)
        onUpdateDeck(plantIds, next)
        setSelectedSlotIndex(null)
      } else {
        if (deckInstanceIds.length < 6) {
          const next = [...deckInstanceIds, card.instanceId]
          setDeckInstanceIds(next)
          const plantIds = next
            .map((id) => displayedCards.find((c) => c.instanceId === id)?.plantId)
            .filter(Boolean) as PlantId[]
          setDeck(plantIds)
          onUpdateDeck(plantIds, next)
        }
      }
    }
  }

  const handlePlayClick = async () => {
    const currentPlantIds = deckInstanceIds
      .map(
        (id) =>
          displayedCards.find((c) => c.instanceId === id)?.plantId
      )
      .filter(Boolean) as PlantId[]

    if (currentPlantIds.length < 3 || currentPlantIds.length > 6) {
      return
    }

    onUpdateDeck(currentPlantIds, deckInstanceIds)

    try {
      localStorage.setItem(
        'plant_arena_active_deck',
        JSON.stringify(currentPlantIds)
      )

      localStorage.setItem(
        'plant_arena_active_deck_instances',
        JSON.stringify(deckInstanceIds)
      )
    } catch {}

    // IMPORTANTE:
    // manda las instancias exactas que el usuario está viendo,
    // no espera a que React actualice el estado del padre.
    await onPlay(deckInstanceIds)
  }

  const handleBack = () => {
    const currentPlantIds = deckInstanceIds
      .map(
        (id) =>
          displayedCards.find((c) => c.instanceId === id)?.plantId
      )
      .filter(Boolean) as PlantId[]

    if (currentPlantIds.length >= 3 && currentPlantIds.length <= 6) {
      onUpdateDeck(currentPlantIds, deckInstanceIds)
      try {
        localStorage.setItem(
          'plant_arena_active_deck',
          JSON.stringify(currentPlantIds)
        )
        localStorage.setItem(
          'plant_arena_active_deck_instances',
          JSON.stringify(deckInstanceIds)
        )
      } catch {}
    }
    onBack(deckInstanceIds)
  }

  return (
    <div
      className="jardin-screen"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="jardin-header">
        <button type="button" className="jardin-back-btn" onClick={handleBack}>
          ⬅ VOLVER AL MENÚ
        </button>
        <div className="jardin-header__center">
          <h1 className="jardin-title">🌱 JARDÍN</h1>
          <span className="jardin-subtitle">
            Personaliza tu equipo de batalla.
          </span>
        </div>
        <div className="jardin-header__right">
          <button type="button" className="jardin-btn-shop" onClick={onOpenShop}>
            🛒 TIENDA
          </button>
          <button
            type="button"
            className={`jardin-btn-sec ${equippedTreeSkin === 'mother_tree_skin' ? 'jardin-btn-sec--sentinel' : ''}`}
            style={
              equippedTreeSkin === 'mother_tree_skin'
                ? {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
                    borderColor: '#c084fc',
                    color: '#ffffff',
                    boxShadow: '0 0 10px rgba(192, 132, 252, 0.5)',
                  }
                : undefined
            }
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setShowTreeModal(true)
            }}
          >
            {equippedTreeSkin === 'mother_tree_skin' ? '🌌 ÁRBOL' : '🌳 ÁRBOL'}
          </button>
          <button
            type="button"
            className="jardin-mute-btn"
            onClick={() => soundManager.toggleMute()}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <div className="jardin-scroll-area">
        {(inventoryPacks.length > 0 || (playerRewardPacks && playerRewardPacks.length > 0)) && (
          <div className="jardin-packs-section">
            <div className="jardin-section-header">
              <h3 className="jardin-section-title">
                📦 SOBRES PENDIENTES POR ABRIR ({inventoryPacks.length + (playerRewardPacks?.length || 0)})
              </h3>
              <button type="button" className="jardin-buy-more-btn" onClick={onOpenShop}>
                + Conseguir más sobres en la Tienda
              </button>
            </div>

            <div className="jardin-packs-grid">
              {/* SOBRES DE RECOMPENSA (STREAMERS / CAMPEÓN DE CLANES) */}
              {playerRewardPacks && playerRewardPacks.map((pack) => {
                const isClanChampion = pack.source === 'clan_champion'
                const totalSec = isClanChampion ? 300 : (pack.durationHours || 4) * 3600
                const elapsedSec = pack.unlockStartedAt ? Math.max(0, (now - pack.unlockStartedAt) / 1000) : 0
                const remainingSec = Math.max(0, totalSec - elapsedSec)
                const hours = Math.floor(remainingSec / 3600)
                const mins = Math.floor((remainingSec % 3600) / 60)
                const secs = Math.floor(remainingSec % 60)
                const timerStr = isClanChampion
                  ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                  : `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
                const remainingHours = remainingSec / 3600
                const goldCost = isClanChampion
                  ? Math.max(5, Math.ceil(remainingSec / 60) * 10)
                  : Math.max(10, Math.ceil(remainingHours * 75))

                const isReady = pack.status === 'ready' || (isClanChampion && remainingSec <= 0)
                const isUnlocking = (pack.status === 'unlocking' || isClanChampion) && remainingSec > 0

                return (
                  <div
                    key={pack.id}
                    className={`jardin-pack-card ${
                      isClanChampion ? 'jardin-pack-card--clan-champion' : 'jardin-pack-card--pvp-reward'
                    } ${isReady ? 'jardin-pack-card--ready' : isUnlocking ? 'jardin-pack-card--unlocking' : ''}`}
                  >
                    <span
                      className={`jardin-pack-stack-badge ${
                        isClanChampion ? 'jardin-pack-stack-badge--champion' : 'jardin-pack-stack-badge--streamer'
                      }`}
                    >
                      {isClanChampion ? '👑 TOP 1 CLANES' : '🎁 STREAMER'}
                    </span>
                    <img
                      src={isClanChampion ? '/game-assets/greenfoot/seed_pack_clan_champion.webp' : '/game-assets/greenfoot/seed_pack_pvp.webp'}
                      alt={isClanChampion ? 'Sobre Campeón de Clanes' : 'Sobre PvP de Recompensa'}
                      className="jardin-pack-card__img"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = isClanChampion
                          ? '/game-assets/greenfoot/seed_pack_clan_champion.png'
                          : '/game-assets/greenfoot/seed_pack_pvp.png'
                      }}
                    />
                    <div className="jardin-pack-card__info">
                      <span className="jardin-pack-card__rarity">
                        {isClanChampion ? '🏆 Recompensa Diaria' : `⚔️ Arena ${pack.arenaLevel}`}
                      </span>
                      <h4 className="jardin-pack-card__name">
                        {isClanChampion ? 'Sobre Campeón de Clanes' : 'Sobre PvP Streamer'}
                      </h4>
                    </div>

                    <div className="jardin-pack-controls-wrap">
                      {!isClanChampion && pack.status === 'pending' && (
                        <button
                          type="button"
                          className="jardin-pack-card__unlock-btn"
                          onClick={async () => {
                            soundManager.playSound('click', 0.5)
                            if (onStartUnlockRewardPack) {
                              const res = await onStartUnlockRewardPack(pack.id)
                              if (!res.success && res.error) {
                                setRewardPackAlert({
                                  title: 'ERROR AL DESBLOQUEAR',
                                  message: res.error,
                                  icon: '⚠️',
                                })
                              }
                            }
                          }}
                        >
                          🔓 DESBLOQUEAR
                        </button>
                      )}

                      {isUnlocking && (
                        <div className="jardin-pack-unlocking-box">
                          <div className="jardin-pack-timer-display">
                            <span className="jardin-pack-timer-clock">⏱️ {timerStr}</span>
                            <span className="jardin-pack-timer-total">
                              {isClanChampion ? '⏳ 5 min' : `⏳ ${pack.durationHours}h`}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="jardin-pack-card__accelerate-btn"
                            onClick={() => {
                              soundManager.playSound('click', 0.5)
                              setRewardPackAccelerating({ packId: pack.id, goldCost, isClanChampion })
                            }}
                          >
                            ⚡ ACELERAR ({goldCost} 💰)
                          </button>
                        </div>
                      )}

                      {isReady && (
                        <button
                          type="button"
                          className="jardin-pack-card__open-btn jardin-pack-card__open-btn--ready"
                          onClick={() => {
                            soundManager.playSound('plantation', 0.8)
                            if (onOpenRewardPack) {
                              onOpenRewardPack(pack.id)
                            }
                          }}
                        >
                          {isClanChampion ? '✨ ABRIR PACK CAMPEÓN' : '✨ ABRIR SOBRE'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* SOBRES REGULARES */}
              {groupedPacks.map((group) => {
                const maxCount = group.count
                const currentQty = getQty(group.packId, maxCount)
                const rarityClass =
                  group.first.rarity === 'legendary'
                    ? 'jardin-pack-card--legendary'
                    : group.first.rarity === 'epic'
                    ? 'jardin-pack-card--epic'
                    : 'jardin-pack-card--common'

                return (
                  <div key={group.packId} className={`jardin-pack-card ${rarityClass}`}>
                    {group.count > 1 && (
                      <span className="jardin-pack-stack-badge">
                        x{group.count}
                      </span>
                    )}
                    <img
                      src={group.first?.icon || ''}
                      alt={group.first?.name || ''}
                      className="jardin-pack-card__img"
                    />
                    <div className="jardin-pack-card__info">
                      <span className="jardin-pack-card__rarity">
                        {group.first.rarity === 'common'
                          ? '🌱 Verde Mágico'
                          : group.first.rarity === 'epic'
                          ? '🔮 Místico Púrpura'
                          : '👑 Legendario Dorado'}
                      </span>
                      <h4 className="jardin-pack-card__name">{group.first.name}</h4>
                    </div>

                    <div className="jardin-pack-controls-wrap">
                      <div className="jardin-pack-qty-picker">
                        <button
                          type="button"
                          className="jardin-pack-qty-btn"
                          disabled={isOpeningPacks || currentQty <= 1}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setQty(group.packId, currentQty - 1, maxCount)
                          }}
                          title="Disminuir cantidad"
                        >
                          -
                        </button>
                        <span className="jardin-pack-qty-num">{currentQty}</span>
                        <button
                          type="button"
                          className="jardin-pack-qty-btn"
                          disabled={isOpeningPacks || currentQty >= maxCount}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setQty(group.packId, currentQty + 1, maxCount)
                          }}
                          title="Aumentar cantidad"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="jardin-pack-qty-max"
                          disabled={isOpeningPacks || currentQty >= maxCount}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setQty(group.packId, maxCount, maxCount)
                          }}
                          title="Seleccionar todos"
                        >
                          MÁX
                        </button>
                      </div>

                      <button
                        type="button"
                        className="jardin-pack-card__open-btn"
                        disabled={isOpeningPacks}
                        onClick={async () => {
                          if (isOpeningPacks) return
                          soundManager.playSound('plantation', 0.8)
                          setIsOpeningPacks(true)
                          try {
                            if (currentQty === 1) {
                              await onOpenPack(group.instances[0].instanceId)
                            } else if (onOpenMultiplePacks) {
                              const ids = group.instances.slice(0, currentQty).map((p) => p.instanceId)
                              await onOpenMultiplePacks(ids)
                            }
                          } finally {
                            setIsOpeningPacks(false)
                          }
                        }}
                      >
                        {isOpeningPacks
                          ? '⏳ ABRIENDO...'
                          : currentQty === 1
                          ? '✨ ABRIR SOBRE'
                          : currentQty === maxCount
                          ? `✨ ABRIR TODOS (${currentQty})`
                          : `✨ ABRIR (${currentQty})`}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="jardin-farming-resources">
          <div
            className="jardin-section-header jardin-section-header--farming"
            onClick={handleToggleFarmingCollapse}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            title={isFarmingCollapsed ? 'Clic para expandir recursos de farming' : 'Clic para minimizar recursos de farming'}
          >
            <div>
              <h3 className="jardin-section-title">
                🌾 RECURSOS DE FARMING {isFarmingCollapsed && <span className="jardin-farming-pill">MINIMIZADO</span>}
              </h3>
              <p className="jardin-farming-subtitle">
                Inventario autoritativo de Supabase · los recursos PvP aparecen aquí al abrir sobres.
              </p>
            </div>
            <button
              type="button"
              className="jardin-farming-toggle-btn"
              onClick={(e) => {
                e.stopPropagation()
                handleToggleFarmingCollapse()
              }}
              title={isFarmingCollapsed ? 'Expandir recursos de farming' : 'Minimizar recursos de farming'}
            >
              {isFarmingCollapsed ? '➕ MOSTRAR' : '➖ MINIMIZAR'}
            </button>
          </div>
          {!isFarmingCollapsed && (
            <>
              <div className="jardin-well-banner">
                <div className="jardin-well-info">
                  <div className="jardin-well-icon">💧</div>
                  <div className="jardin-well-text">
                    <div className="jardin-well-title">Surtidor Patrocinado del Jardín</div>
                    <div className="jardin-well-subtitle">
                      Obtén suministros de cultivo gratis apoyando el juego (Máximo 3 diarios).
                    </div>
                  </div>
                </div>
                <div className="jardin-well-actions">
                  <button
                    type="button"
                    className="jardin-well-btn jardin-well-btn--water"
                    disabled={isClaimingGardenAd}
                    onClick={() => handleClaimGardenAd('water')}
                    title="Reclamar +2 Aguas gratuitas apoyando a los patrocinadores"
                  >
                    {isClaimingGardenAd ? '⏳ Reclamando...' : '💧 +2 Agua'}
                  </button>
                  <button
                    type="button"
                    className="jardin-well-btn jardin-well-btn--fert"
                    disabled={isClaimingGardenAd}
                    onClick={() => handleClaimGardenAd('fertilizer')}
                    title="Reclamar +1 Fertilizante gratuito apoyando a los patrocinadores"
                  >
                    {isClaimingGardenAd ? '⏳ Reclamando...' : '🧪 +1 Abono'}
                  </button>
                </div>
              </div>

              <div className="jardin-farming-grid">
              {(Object.entries(FARMING_ITEM_DEFINITIONS) as Array<[keyof FarmingInventory, (typeof FARMING_ITEM_DEFINITIONS)[keyof typeof FARMING_ITEM_DEFINITIONS]]>).map(([itemId, def]) => {
                const qty = Number(farmingItems[itemId] || 0)
                const equippableDef = getEquippableItemDef(itemId)
                const isEquippedAnywhere = equippableDef
                  ? plantInstances.some((p) => isPlantMatchingTarget(equippableDef.targetPlantId, p.plantId) && p.equippedItem === itemId)
                  : false

                // Los ítems equipables sólo se muestran si se han obtenido (en inventario o equipados)
                if (equippableDef && qty <= 0 && !isEquippedAnywhere) {
                  return null
                }

                // La poción de energía sólo se muestra si el jugador tiene unidades
                const isEnergyPotion = itemId === 'energy_potion_5'
                if (isEnergyPotion && qty <= 0) {
                  return null
                }

                // La skin del Árbol Madre sólo se muestra si se tiene en inventario o está equipada
                const isTreeSkin = itemId === 'mother_tree_skin'
                const isTreeSkinEquipped = equippedTreeSkin === 'mother_tree_skin'
                if (isTreeSkin && qty <= 0 && !isTreeSkinEquipped) {
                  return null
                }

                const isInteractive = Boolean(equippableDef || isEnergyPotion || isTreeSkin)

                return (
                  <div
                    key={itemId}
                    className={`jardin-farming-card jardin-farming-card--${itemId} ${isInteractive ? 'jardin-farming-card--interactive' : ''}`}
                    onClick={() => {
                      if (equippableDef) handleEquippableResourceClick(itemId)
                      else if (isEnergyPotion) handleEnergyPotionClick(itemId)
                      else if (isTreeSkin) handleTreeSkinCardClick()
                    }}
                    role={isInteractive ? 'button' : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
                        if (equippableDef) handleEquippableResourceClick(itemId)
                        else if (isEnergyPotion) handleEnergyPotionClick(itemId)
                        else if (isTreeSkin) handleTreeSkinCardClick()
                      }
                    }}
                    title={
                      equippableDef
                        ? `${equippableDef.emoji} Toca para equipar o desequipar en ${PLANT_CONFIGS[equippableDef.targetPlantId]?.name || 'tu planta'}`
                        : isEnergyPotion
                        ? '⚡ Toca para usar y recargar +5 energías de Ranked'
                        : isTreeSkin
                        ? '🌌 Toca para equipar o desequipar el aspecto del Árbol Centinela'
                        : undefined
                    }
                  >
                    <div className="jardin-farming-card__art">
                      <img
                        src={def.icon}
                        alt={def.label}
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                      <span>{def.fallback}</span>
                    </div>
                    <strong>{def.label}</strong>
                    <span className="jardin-farming-card__qty">x{qty.toLocaleString()}</span>
                    <small>{def.description}</small>
                    {equippableDef && (
                      <span className="jardin-farming-belt-action-pill">
                        {isEquippedAnywhere ? `${equippableDef.emoji} EQUIPADO (TOCA)` : `${equippableDef.emoji} TOCAR PARA EQUIPAR`}
                      </span>
                    )}
                    {isEnergyPotion && (
                      <span className="jardin-farming-belt-action-pill" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', borderColor: '#38bdf8' }}>
                        ⚡ TOCAR PARA USAR
                      </span>
                    )}
                    {isTreeSkin && (
                      <span
                        className="jardin-farming-belt-action-pill"
                        style={{
                          background: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
                          borderColor: '#c084fc',
                          boxShadow: '0 0 8px rgba(192, 132, 252, 0.4)',
                        }}
                      >
                        {isTreeSkinEquipped ? '🌌 EQUIPADO (TOCA)' : '🌌 TOCAR PARA EQUIPAR'}
                      </span>
                    )}
                  </div>
                )
              })}
              <div className="jardin-farming-card jardin-farming-card--gold">
                <div className="jardin-farming-card__art">
                  <img
                    src="/game-assets/farming/gold_coin.webp"
                    alt="Oro"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  <span>💰</span>
                </div>
                <strong>Monedas de Oro</strong>
                <span className="jardin-farming-card__qty">x{userGold.toLocaleString()}</span>
                <small>Sirve para acelerar, fusionar y futuros crafts de farming.</small>
              </div>
            </div>
          </>
        )}
        </div>

        {/* ACTIVE BATTLE DECK (3 TO 6 SLOTS) */}
        <div className="jardin-deck-container">
          <div className="jardin-deck-header">
            <span className="jardin-deck-title">
              ⚔️ MAZO DE BATALLA DE MI JARDÍN ({deckInstanceIds.length}/6 PLANTAS)
            </span>
            <span
              className={`jardin-deck-status ${
                isDeckValid ? 'jardin-deck-status--ready' : ''
              }`}
            >
              {isDeckValid
                ? `✅ LISTO PARA COMBATE (${deckInstanceIds.length}/6 PLANTAS)`
                : `⚠️ MÍNIMO 3 PLANTAS REQUERIDAS (TIENES ${deckInstanceIds.length})`}
            </span>
          </div>

          <div className="jardin-slots-grid">
            {Array.from({ length: 6 }).map((_, slotIdx) => {
              const instanceId = deckInstanceIds[slotIdx]
              const card = displayedCards.find((c) => c.instanceId === instanceId)
              const config = card ? PLANT_CONFIGS[card.plantId] : null
              const isSelected = selectedSlotIndex === slotIdx
              const scaledSlotConfig = card ? getScaledPlantConfig(card.plantId, card.statRolls ?? [], card.equippedItem) : null
              const slotImgSrc = scaledSlotConfig?.icon || scaledSlotConfig?.sprite || config?.icon

              return (
                <button
                  key={slotIdx}
                  type="button"
                  className={`jardin-slot ${config ? 'jardin-slot--filled' : 'jardin-slot--empty'} ${
                    isSelected ? 'jardin-slot--active' : ''
                  }`}
                  onClick={() => {
                    soundManager.playSound('plantation', 0.4)
                    setSelectedSlotIndex(isSelected ? null : slotIdx)
                  }}
                >
                  <span className="jardin-slot__num">SLOT {slotIdx + 1}</span>

                  {config && card ? (
                    <div className="jardin-slot__content">
                      <span
                        className="jardin-slot__remove-btn"
                        title="Quitar esta planta del mazo"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveSlotInstance(slotIdx)
                        }}
                      >
                        ✖
                      </span>
                      <div className="jardin-slot__cost">
                        <img src={sunIcon} alt="Sol" className="jardin-slot__sun" />
                        <span>{config.cost}</span>
                      </div>
                      <img src={slotImgSrc} alt={config.name} className="jardin-slot__img" />
                      {(() => {
                        const instancesOfThis = plantInstances.filter((i) => i.plantId === card.plantId)
                        const idxInOwned = instancesOfThis.findIndex((i) => i.instanceId === card.instanceId)
                        const slotNumPrefix = instancesOfThis.length > 1 && idxInOwned !== -1 ? ` #${idxInOwned + 1}` : ''
                        return (
                          <span className="jardin-slot__name">
                            {config.name}{slotNumPrefix} {card.level > 0 ? `(L${card.level})` : ''} {(() => {
                              const itemDef = getEquippableItemDef(card.equippedItem)
                              return itemDef ? itemDef.emoji : ''
                            })()}
                          </span>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="jardin-slot__placeholder">
                      <span className="jardin-slot__plus">+</span>
                      <span className="jardin-slot__hint">ELIGE PLANTA</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="jardin-action-bar">
            <button
              type="button"
              className="jardin-play-btn"
              disabled={!isDeckValid}
              onClick={handlePlayClick}
            >
              🎮 IR A BATALLA CON ESTE EQUIPO ({deckInstanceIds.length} PLANTAS)
            </button>
          </div>
        </div>

        {/* INVENTORY CATALOG GRID (UNLOCKED VS LOCKED) */}
        <div className="jardin-inventory-container">
          <h2 className="jardin-inventory-title">
            🌱 PLANTAS DESBLOQUEADAS Y DISPONIBLES EN TU JARDÍN ({displayedCards.filter((c) => c.isUnlocked).length} ACTIVAS)
          </h2>
          <div className="jardin-inventory-grid">
            {displayedCards.map((card) => {
              const { instanceId, plantId, level, statRolls, isUnlocked, equippedItem } = card
              const config = PLANT_CONFIGS[plantId]
              const inDeck = deckInstanceIds.includes(instanceId)
              const copies = plantCopies[plantId] || 0
              const isLegendary = plantId === 'threepeater' || plantId === 'iceberglettuce'
              const isEpic = plantId === 'aloe' || plantId === 'tallnut'
              const maxLvl = isLegendary ? 3 : 5
              const groupedBuffs = groupRolls(statRolls)
              const isMaxLevel = level >= maxLvl
              const hasCopies = copies >= FUSION_COPIES_REQ
              const scaledCardConfig = getScaledPlantConfig(plantId, statRolls, equippedItem)
              const cardImgSrc = scaledCardConfig.icon || scaledCardConfig.sprite || config.icon

              const instancesOfThisPlant = plantInstances.filter((i) => i.plantId === plantId)
              const instanceIndex = instancesOfThisPlant.findIndex((i) => i.instanceId === instanceId)
              const instanceNum = instanceIndex !== -1 ? instanceIndex + 1 : 1
              const displayName = instancesOfThisPlant.length > 1 ? `${config.name} #${instanceNum}` : config.name

              const currentSprouts = card.germinationsCount ?? 0
              const canSproutThisCard = currentSprouts < 2
              const nextChildNum = currentSprouts + 1

              let sproutWaterCost = nextChildNum === 1 ? 10 : 12
              let sproutFertCost = nextChildNum === 1 ? 5 : 7
              if (isLegendary) {
                sproutWaterCost = nextChildNum === 1 ? 120 : 140
                sproutFertCost = nextChildNum === 1 ? 60 : 70
              } else if (isEpic) {
                sproutWaterCost = nextChildNum === 1 ? 50 : 60
                sproutFertCost = nextChildNum === 1 ? 30 : 35
              }

              return (
                <div
                  key={instanceId}
                  role="button"
                  tabIndex={0}
                  className={`jardin-card ${
                    !isUnlocked
                      ? 'jardin-card--locked'
                      : card.isListed
                      ? 'jardin-card--listed'
                      : inDeck
                      ? 'jardin-card--indeck'
                      : 'jardin-card--unlocked'
                  }`}
                  onClick={() => handleToggleCardInstance(card)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleToggleCardInstance(card)
                    }
                  }}
                >
                  {/* CIRCULAR LEVEL BADGE (ONLY NUMBER) */}
                  {isUnlocked && level > 0 && (
                    <div
                      className={`jardin-level-circle ${level === maxLvl ? 'jardin-level-circle--max' : ''}`}
                      title={`Nivel ${level}`}
                    >
                      {level}
                    </div>
                  )}

                  <div className="jardin-card__header">
                    <div className="jardin-card__cost">
                      <img src={sunIcon} alt="Sol" className="jardin-card__sun" />
                      <span>{config.cost}</span>
                    </div>
                    <div className="jardin-card__header-right">
                      {card.isListed && (
                        <span className="jardin-card-badge--market" title="En venta en Comercio P2P. Retírala desde Mis Ventas si deseas usarla.">
                          🏷️ EN VENTA
                        </span>
                      )}
                      {inDeck && !card.isListed && <span className="jardin-card__badge">EN MAZO ✓</span>}
                      {isUnlocked && !inDeck && !card.isListed && (
                        <span className="jardin-card__badge" style={{ color: '#60a5fa', borderColor: '#60a5fa' }}>
                          OBTENIDA ✓
                        </span>
                      )}
                      {!isUnlocked && <span className="jardin-card__badge-locked">🔒 BLOQUEADA</span>}
                      {isUnlocked && !card.isListed && (
                        <button
                          type="button"
                          className={`jardin-card__trash-btn ${instancesOfThisPlant.length < 2 ? 'jardin-card__trash-btn--disabled' : ''}`}
                          disabled={instancesOfThisPlant.length < 2}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (instancesOfThisPlant.length < 2) return
                            setConvertCandidate({
                              instanceId,
                              plantId,
                              name: displayName,
                              icon: cardImgSrc,
                              level,
                              equippedItem,
                              inDeck,
                              speciesCount: instancesOfThisPlant.length,
                            })
                          }}
                          title={
                            instancesOfThisPlant.length >= 2
                              ? 'Convertir esta planta en copia (50 💎)'
                              : 'No puedes usar el bote si solo tienes la carta base (debes tener al menos 2 cartas)'
                          }
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <img
                    src={cardImgSrc}
                    alt={config.name}
                    className={`jardin-card__img ${!isUnlocked ? 'jardin-card__img--locked' : ''}`}
                  />

                  <span className="jardin-card__name">{displayName}</span>
                  {(() => {
                    const itemDef = getEquippableItemDef(equippedItem)
                    if (!itemDef) return null
                    return (
                      <div className="jardin-equipped-belt-badge">
                        {itemDef.emoji} {itemDef.name.toUpperCase()} ({itemDef.statBonusText})
                      </div>
                    )
                  })()}
                  <span className="jardin-card__cat">
                    {!isUnlocked
                      ? '🔒 Bloqueada'
                      : config?.category === 'producer'
                      ? '☀️ Productora'
                      : config?.category === 'ranged'
                      ? '🏹 Atacante'
                      : config?.category === 'defensive'
                      ? '🛡️ Tanque'
                      : '🥊 Mele'}
                  </span>

                  {groupedBuffs.length > 0 && (
                    <div className="jardin-card-rolls-wrap">
                      {groupedBuffs.map((b, idx) => (
                        <span
                          key={idx}
                          className="jardin-stat-roll-badge"
                          style={{ color: b.color, borderColor: b.color }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {isUnlocked && (
                    <div className="jardin-card-copies-tag">
                      COPIAS: {copies}/{FUSION_COPIES_REQ} · 💰 {getFusionGoldCost(plantId, level).toLocaleString()} {isMaxLevel ? '(MÁX)' : ''}
                    </div>
                  )}

                  {/* BOTONES DE DECISIÓN: GERMINAR O FUSIONAR */}
                  {isUnlocked && !card.isListed && (
                    <div className="jardin-card-decision-row">
                      {canSproutThisCard && (
                        <button
                          type="button"
                          className={`jardin-sprout-btn ${hasCopies ? 'jardin-sprout-btn--pulse' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSproutCandidate({
                              instanceId,
                              plantId,
                              name: displayName,
                              icon: config.icon,
                              waterCost: sproutWaterCost,
                              fertCost: sproutFertCost,
                              childNumber: nextChildNum,
                            })
                          }}
                          title={hasCopies ? `Germinar Cría #${nextChildNum} de esta carta (${sproutWaterCost}💧, ${sproutFertCost}🧪, 5🧩)` : `Requiere 5 copias para germinar (${copies}/5)`}
                        >
                          🌱 GERMINAR
                        </button>
                      )}

                      {!isMaxLevel && (
                        <button
                          type="button"
                          className={`jardin-fuse-btn ${hasCopies ? 'jardin-fuse-btn--pulse' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const cost = getFusionGoldCost(plantId, level)
                            setFuseCandidate({
                              plantId,
                              instanceId,
                              level,
                              name: displayName,
                              icon: config.icon,
                              cost,
                            })
                          }}
                          title={hasCopies ? `Fusionar y mejorar a Nivel ${level + 1} (${getFusionGoldCost(plantId, level).toLocaleString()}💰 + 5🧩)` : `Requiere 5 copias para fusionar (${copies}/5)`}
                        >
                          🔥 FUSIONAR
                        </button>
                      )}
                    </div>
                  )}

                  {isUnlocked && card.isListed && (
                    <div className="jardin-card-market-notice">
                      <span className="jardin-card-market-notice__text">🏷️ En venta en Mercado P2P</span>
                      <span className="jardin-card-market-notice__sub">Recupérala en 'Mis Ventas' para usarla</span>
                    </div>
                  )}

                  {/* EQUIPAR / DESEQUIPAR ÍTEM EXCLUSIVO */}
                  {(() => {
                    if (!isUnlocked || card.isListed) return null

                    if (equippedItem) {
                      const equippedDef = getEquippableItemDef(equippedItem)
                      if (!equippedDef) return null
                      return (
                        <div className="jardin-card-item-row">
                          <button
                            type="button"
                            className="jardin-unequip-item-btn"
                            disabled={isEquippingItem}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleUnequipItem(instanceId)
                            }}
                            title={`Desequipar ${equippedDef.name} (volverá a tu inventario)`}
                          >
                            {equippedDef.emoji} DESEQUIPAR
                          </button>
                        </div>
                      )
                    }

                    const candidateDefs = getEquippableItemsForPlant(plantId)
                    const availableDefs = candidateDefs.filter(
                      (def) => Number(farmingItems?.[def.id as keyof FarmingInventory] || 0) > 0
                    )
                    if (availableDefs.length === 0) return null

                    return (
                      <div className="jardin-card-item-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {availableDefs.map((def) => {
                          const availableQty = Number(farmingItems?.[def.id as keyof FarmingInventory] || 0)
                          return (
                            <button
                              key={def.id}
                              type="button"
                              className="jardin-equip-item-btn"
                              disabled={isEquippingItem}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEquipItem(instanceId, def.id)
                              }}
                              title={`Equipar ${def.name} (${def.statBonusText}) (Disponibles: ${availableQty})`}
                            >
                              {def.emoji} EQUIPAR {availableDefs.length > 1 ? def.name : ''}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })()}

                  {isUnlocked && !canSproutThisCard && (
                    <div className="jardin-card-max-instances-tag">
                      🌱 GERMINADA (2/2)
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* CONFIRMACIÓN DE FUSIÓN / MEJORA */}
      {fuseCandidate && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isFusing) setFuseCandidate(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">✨ ⬆️ ✨</div>
            <h3 className="jardin-upgrade-modal-title">¿Deseas fusionar esta planta?</h3>

            <div className="jardin-fuse-confirm-plant">
              <img src={fuseCandidate.icon} alt={fuseCandidate.name} className="jardin-fuse-confirm-img" />
              <span className="jardin-fuse-confirm-name">{fuseCandidate.name}</span>
              <span className="jardin-fuse-confirm-level">
                Nivel {fuseCandidate.level} ➔ Nivel {fuseCandidate.level + 1}
              </span>
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 6px', lineHeight: 1.4, textAlign: 'center' }}>
              Subirá +1 Nivel y obtendrá una mejora permanente de <strong>+15%</strong> en una de las siguientes estadísticas posibles:
            </p>

            {PLANT_ELIGIBLE_STATS_LABELS[fuseCandidate.plantId] && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginBottom: '12px', maxWidth: '340px' }}>
                {PLANT_ELIGIBLE_STATS_LABELS[fuseCandidate.plantId].map((label, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      background: 'rgba(234, 179, 8, 0.12)',
                      color: '#facc15',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            <div className="jardin-fuse-confirm-reqs">
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">🧩</span>
                <span className="jardin-fuse-req-text">
                  5 copias (tienes {plantCopies[fuseCandidate.plantId] || 0}/5)
                </span>
              </div>
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">💰</span>
                <span
                  className="jardin-fuse-req-text"
                  style={{ color: (userGold ?? 0) >= fuseCandidate.cost ? '#fde047' : '#f87171' }}
                >
                  {fuseCandidate.cost.toLocaleString()} Oro (tienes {(userGold ?? 0).toLocaleString()}💰)
                </span>
              </div>
            </div>

            {((userGold ?? 0) < fuseCandidate.cost || (plantCopies[fuseCandidate.plantId] || 0) < 5) && (
              <div style={{ color: '#f87171', fontSize: '11px', fontWeight: 800, marginTop: '10px', textAlign: 'center' }}>
                {(plantCopies[fuseCandidate.plantId] || 0) < 5
                  ? `⚠️ Copias insuficientes: necesitas 5 copias de ${fuseCandidate.name} (tienes ${plantCopies[fuseCandidate.plantId] || 0}/5).`
                  : `⚠️ Oro insuficiente para fusionar (requiere ${fuseCandidate.cost.toLocaleString()} Oro).`}
              </div>
            )}

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isFusing}
                onClick={() => setFuseCandidate(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-confirm"
                disabled={isFusing || (userGold ?? 0) < fuseCandidate.cost || (plantCopies[fuseCandidate.plantId] || 0) < 5}
                onClick={handleConfirmFuse}
              >
                {isFusing ? 'FUSIONANDO...' : '🔥 FUSIONAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE GERMINACIÓN / NUEVA INSTANCIA */}
      {sproutCandidate && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isSprouting) setSproutCandidate(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">🌱 ✨ 🌿</div>
            <h3 className="jardin-upgrade-modal-title">¿Germinar cría de planta?</h3>

            <div className="jardin-fuse-confirm-plant">
              <img src={sproutCandidate.icon} alt={sproutCandidate.name} className="jardin-fuse-confirm-img" />
              <span className="jardin-fuse-confirm-name">{sproutCandidate.name}</span>
              <span className="jardin-fuse-confirm-level" style={{ color: '#38bdf8' }}>
                Germinar Cría #{sproutCandidate.childNumber} (de 2 posibles para esta carta)
              </span>
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 14px', lineHeight: 1.4, textAlign: 'center' }}>
              Esta carta generará su cría #{sproutCandidate.childNumber} (cada carta puede germinar un máximo de 2 crías). La nueva planta empezará en Nivel 0 con stats independientes. Podrás usarla en tu mazo (reemplazando la actual), mejorarla por separado o venderla en el Marketplace.
            </p>

            <div className="jardin-fuse-confirm-reqs">
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">🧩</span>
                <span className="jardin-fuse-req-text">
                  5 copias (tienes {plantCopies[sproutCandidate.plantId] || 0}/5)
                </span>
              </div>
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">💧</span>
                <span
                  className="jardin-fuse-req-text"
                  style={{ color: (farmingItems?.water ?? 0) >= sproutCandidate.waterCost ? '#38bdf8' : '#f87171' }}
                >
                  {sproutCandidate.waterCost} Aguas (tienes {farmingItems?.water ?? 0})
                </span>
              </div>
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">🧪</span>
                <span
                  className="jardin-fuse-req-text"
                  style={{ color: (farmingItems?.fertilizer ?? 0) >= sproutCandidate.fertCost ? '#a3e635' : '#f87171' }}
                >
                  {sproutCandidate.fertCost} Fertilizantes (tienes {farmingItems?.fertilizer ?? 0})
                </span>
              </div>
            </div>

            {((farmingItems?.water ?? 0) < sproutCandidate.waterCost ||
              (farmingItems?.fertilizer ?? 0) < sproutCandidate.fertCost ||
              (plantCopies[sproutCandidate.plantId] || 0) < 5) && (
              <div style={{ color: '#f87171', fontSize: '11px', fontWeight: 800, marginTop: '10px', textAlign: 'center' }}>
                {(plantCopies[sproutCandidate.plantId] || 0) < 5
                  ? `⚠️ Copias insuficientes: necesitas 5 copias de ${sproutCandidate.name} (tienes ${plantCopies[sproutCandidate.plantId] || 0}/5).`
                  : `⚠️ Recursos insuficientes: necesitas ${sproutCandidate.waterCost} Aguas y ${sproutCandidate.fertCost} Fertilizantes.`}
              </div>
            )}

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isSprouting}
                onClick={() => setSproutCandidate(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-confirm"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  borderColor: '#38bdf8',
                }}
                disabled={
                  isSprouting ||
                  (farmingItems?.water ?? 0) < sproutCandidate.waterCost ||
                  (farmingItems?.fertilizer ?? 0) < sproutCandidate.fertCost ||
                  (plantCopies[sproutCandidate.plantId] || 0) < 5
                }
                onClick={handleConfirmSprout}
              >
                {isSprouting ? 'GERMINANDO...' : '🌱 GERMINAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: CONVERTIR PLANTA EN COPIA */}
      {convertCandidate && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isConverting) setConvertCandidate(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">🗑️ ✨ 🧩</div>
            <h3 className="jardin-upgrade-modal-title">¿Convertir planta en copia?</h3>

            <div className="jardin-fuse-confirm-plant">
              <img src={convertCandidate.icon} alt={convertCandidate.name} className="jardin-fuse-confirm-img" />
              <span className="jardin-fuse-confirm-name">{convertCandidate.name}</span>
              <span className="jardin-fuse-confirm-level" style={{ color: '#ec4899' }}>
                Nivel {convertCandidate.level} ➔ +1 Copia 🧩
              </span>
            </div>

            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '8px 0 12px', lineHeight: 1.4, textAlign: 'center' }}>
              ¿Seguro desea convertir la planta en copia?<br />
              <span style={{ color: '#94a3b8', fontSize: '10px' }}>
                Esta carta se eliminará permanentemente de tu inventario y recibirás <strong>+1 copia</strong> para fusiones.
              </span>
            </p>

            {convertCandidate.equippedItem && (
              <div style={{
                background: 'rgba(234, 179, 8, 0.15)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '11px',
                color: '#fde047',
                marginBottom: '10px',
                textAlign: 'center',
              }}>
                🥊 El ítem equipado volverá automáticamente a tus recursos de cultivo.
              </div>
            )}

            <div className="jardin-fuse-confirm-reqs">
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">💎</span>
                <span
                  className="jardin-fuse-req-text"
                  style={{ color: (userTokens ?? 0) >= 50 ? '#67e8f9' : '#f87171' }}
                >
                  Costo: 50 Gemas (tienes {Math.floor(userTokens ?? 0)} 💎)
                </span>
              </div>
              <div className="jardin-fuse-req-item">
                <span className="jardin-fuse-req-icon">🧩</span>
                <span
                  className="jardin-fuse-req-text"
                  style={{ color: (plantCopies[convertCandidate.plantId] || 0) < 5 ? '#a3e635' : '#f87171' }}
                >
                  Copias: {plantCopies[convertCandidate.plantId] || 0}/5
                  {(plantCopies[convertCandidate.plantId] || 0) < 5 ? ' ➔ Recibirás +1' : ' (LÍMITE MÁXIMO)'}
                </span>
              </div>
            </div>

            {/* Mensajes de validación visual preventiva */}
            {((userTokens ?? 0) < 50 || (plantCopies[convertCandidate.plantId] || 0) >= 5 || (convertCandidate.speciesCount !== undefined && convertCandidate.speciesCount < 2)) && (
              <div style={{ color: '#f87171', fontSize: '11px', fontWeight: 800, marginTop: '10px', textAlign: 'center' }}>
                {convertCandidate.speciesCount !== undefined && convertCandidate.speciesCount < 2
                  ? `⚠️ No puedes usar el bote si solo tienes la carta base. Debes tener al menos 2 cartas de ${convertCandidate.name}.`
                  : (plantCopies[convertCandidate.plantId] || 0) >= 5
                  ? `⚠️ Límite alcanzado: Ya posees el máximo de 5 copias de ${convertCandidate.name}. No puedes convertir más.`
                  : `⚠️ Gemas insuficientes: Requieres 50 gemas (tienes ${Math.floor(userTokens ?? 0)} 💎).`}
              </div>
            )}

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isConverting}
                onClick={() => setConvertCandidate(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-confirm"
                style={{
                  background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  borderColor: '#fb7185',
                }}
                disabled={
                  isConverting ||
                  (userTokens ?? 0) < 50 ||
                  (plantCopies[convertCandidate.plantId] || 0) >= 5 ||
                  (convertCandidate.speciesCount !== undefined && convertCandidate.speciesCount < 2)
                }
                onClick={handleConfirmConvert}
              >
                {isConverting ? 'CONVIRTIENDO...' : '🗑️ CONVERTIR (50 💎)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE EQUIPAR / DESEQUIPAR ÍTEM EXCLUSIVO */}
      {beltConfirmModal && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isEquippingItem) setBeltConfirmModal(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">{beltConfirmModal.itemEmoji || '🥊'} ✨ {beltConfirmModal.itemEmoji || '🥊'}</div>
            <h3 className="jardin-upgrade-modal-title">
              {beltConfirmModal.action === 'equip'
                ? `¿Deseas equipar ${beltConfirmModal.itemName || 'el ítem'}?`
                : `¿Deseas desequipar ${beltConfirmModal.itemName || 'el ítem'}?`}
            </h3>

            {(() => {
              const modalPlantId = beltConfirmModal.plantId || 'bonkchoy'
              const modalItemId = beltConfirmModal.itemId || 'champion_belt'
              const previewCfg = getScaledPlantConfig(modalPlantId, 0, modalItemId)
              const previewImg = previewCfg.icon || previewCfg.sprite

              return (
                <div className="jardin-fuse-confirm-plant">
                  <img
                    src={previewImg}
                    alt={beltConfirmModal.plantName}
                    className="jardin-fuse-confirm-img"
                  />
                  <span className="jardin-fuse-confirm-name">{beltConfirmModal.plantName}</span>
                  <span className="jardin-fuse-confirm-level" style={{ color: '#4ade80' }}>
                    {beltConfirmModal.bonusText || '✨ Bonificaciones activas'}
                  </span>
                </div>
              )
            })()}

            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 14px', lineHeight: 1.4, textAlign: 'center' }}>
              {beltConfirmModal.action === 'equip'
                ? `${beltConfirmModal.itemName || 'Este ítem'} es exclusivo para ${beltConfirmModal.plantName}. Al equiparlo, aumentará sus estadísticas (${beltConfirmModal.bonusText || ''}) y actualizará su aspecto visual en el Jardín y en el campo de batalla.`
                : `Al desequipar ${beltConfirmModal.itemName || 'el ítem'}, ${beltConfirmModal.plantName} volverá a sus estadísticas normales y el ítem regresará a tus recursos de cultivo.`}
            </p>

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isEquippingItem}
                onClick={() => setBeltConfirmModal(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className={`jardin-upgrade-modal-btn ${
                  beltConfirmModal.action === 'equip'
                    ? 'jardin-belt-confirm-btn--equip'
                    : 'jardin-belt-confirm-btn--unequip'
                }`}
                disabled={isEquippingItem}
                onClick={async () => {
                  const act = beltConfirmModal.action
                  const instId = beltConfirmModal.instanceId
                  const itmId = beltConfirmModal.itemId || 'champion_belt'
                  setBeltConfirmModal(null)
                  if (act === 'equip') {
                    await handleEquipItem(instId, itmId)
                  } else {
                    await handleUnequipItem(instId)
                  }
                }}
              >
                {isEquippingItem
                  ? 'PROCESANDO...'
                  : beltConfirmModal.action === 'equip'
                  ? `${beltConfirmModal.itemEmoji || '🥊'} EQUIPAR`
                  : `${beltConfirmModal.itemEmoji || '🥊'} DESEQUIPAR`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Skin de Árbol Madre */}
      {treeSkinModal && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isEquippingTreeSkin) setTreeSkinModal(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">🌌 ✨ 🌌</div>
            <h3 className="jardin-upgrade-modal-title">
              {treeSkinModal.action === 'equip'
                ? '¿Deseas equipar el Árbol Centinela?'
                : '¿Deseas desequipar el Árbol Centinela?'}
            </h3>

            <div className="jardin-fuse-confirm-plant" style={{ minHeight: '130px' }}>
              <img
                src="/game-assets/greenfoot/mothertree_sentinel.webp"
                alt="Árbol Centinela"
                className="jardin-fuse-confirm-img"
                style={{
                  maxHeight: '110px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.6))',
                }}
              />
              <span className="jardin-fuse-confirm-name" style={{ color: '#c084fc', fontWeight: 900 }}>
                Skin: Árbol Centinela
              </span>
              <span className="jardin-fuse-confirm-level" style={{ color: '#38bdf8' }}>
                ⚔️ Ataque: 2 proyectiles (1º a los 25s, luego cada 15s - 20 daño c/u)
              </span>
            </div>

            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 14px', lineHeight: 1.4, textAlign: 'center' }}>
              {treeSkinModal.action === 'equip'
                ? 'Aspecto exclusivo para tu Árbol Madre. Al equiparlo, tu base adoptará el aspecto celestial del Centinela en combate, visible tanto para ti como para tu rival, y lanzará 2 proyectiles cósmicos aleatoriamente entre las líneas (primer disparo a los 25s, luego cada 15 segundos).'
                : 'Al desequipar, tu Árbol Madre volverá a su aspecto ancestral tradicional y el ítem regresará a tus recursos de cultivo.'}
            </p>

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isEquippingTreeSkin}
                onClick={() => setTreeSkinModal(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className={`jardin-upgrade-modal-btn ${
                  treeSkinModal.action === 'equip'
                    ? 'jardin-belt-confirm-btn--equip'
                    : 'jardin-belt-confirm-btn--unequip'
                }`}
                style={
                  treeSkinModal.action === 'equip'
                    ? {
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)',
                        borderColor: '#c084fc',
                        boxShadow: '0 0 12px rgba(192, 132, 252, 0.45)',
                      }
                    : undefined
                }
                disabled={isEquippingTreeSkin}
                onClick={handleConfirmTreeSkinAction}
              >
                {isEquippingTreeSkin
                  ? 'PROCESANDO...'
                  : treeSkinModal.action === 'equip'
                  ? '🌌 EQUIPAR'
                  : '🌌 DESEQUIPAR'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Uso de Poción de Energía */}
      {energyPotionModal && (
        <div
          className="jardin-upgrade-modal-overlay"
          onClick={() => {
            if (!isConsumingPotion) setEnergyPotionModal(null)
          }}
        >
          <div className="jardin-upgrade-modal-card jardin-fuse-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">⚡ ✨ ⚡</div>
            <h3 className="jardin-upgrade-modal-title">¿Consumir Poción de Energía?</h3>

            <div className="jardin-fuse-confirm-plant">
              <img
                src="/game-assets/farming/energy_potion.png"
                alt="Poción de Energía"
                className="jardin-fuse-confirm-img"
                style={{ width: '64px', height: '64px', objectFit: 'contain' }}
              />
              <span className="jardin-fuse-confirm-name">Poción de Energía (5⚡)</span>
              <span className="jardin-fuse-confirm-level" style={{ color: '#38bdf8' }}>
                +{energyPotionModal.willAdd} ⚡ al instante
              </span>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '10px 0 14px', lineHeight: 1.4, textAlign: 'center' }}>
              Tu energía actual es de <strong>{energyPotionModal.currentEnergy}/{energyPotionModal.maxEnergy}⚡</strong>.<br />
              Al usar esta poción pasarás a <strong style={{ color: '#38bdf8' }}>{energyPotionModal.resultingEnergy}/{energyPotionModal.maxEnergy}⚡</strong> (sin superar tu máximo diario).
            </p>

            <div className="jardin-fuse-confirm-actions">
              <button
                type="button"
                className="jardin-upgrade-modal-btn jardin-fuse-btn-cancel"
                disabled={isConsumingPotion}
                onClick={() => setEnergyPotionModal(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="jardin-upgrade-modal-btn"
                style={{
                  background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                  borderColor: '#38bdf8',
                  color: '#ffffff',
                }}
                disabled={isConsumingPotion}
                onClick={handleConfirmUseEnergyPotion}
              >
                {isConsumingPotion ? 'CONSUMIENDO...' : '⚡ USAR AHORA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE ERROR / AVISO */}
      {fuseAlert && (
        <div className="jardin-upgrade-modal-overlay" onClick={() => setFuseAlert(null)}>
          <div className="jardin-upgrade-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">{fuseAlert.icon}</div>
            <h3 className="jardin-upgrade-modal-title">{fuseAlert.title}</h3>
            <p className="jardin-upgrade-modal-desc">{fuseAlert.message}</p>
            <button
              type="button"
              className="jardin-upgrade-modal-btn"
              onClick={() => setFuseAlert(null)}
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}

      {/* UPGRADE CELEBRATION MODAL */}
      {upgradeModal && (
        <div className="jardin-upgrade-modal-overlay" onClick={() => setUpgradeModal(null)}>
          <div className="jardin-upgrade-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="jardin-upgrade-modal-sparkle">✨ 🎲 ✨</div>
            <h3 className="jardin-upgrade-modal-title">¡MEJORA EXITOSA!</h3>
            <span className="jardin-upgrade-modal-level">NIVEL {upgradeModal.newLevel}</span>

            {(() => {
              const plantConf = PLANT_CONFIGS[upgradeModal.plantId]
              const rolledMeta = (upgradeModal.rolledStat && STAT_LABELS[upgradeModal.rolledStat]) || {
                icon: '⚡',
                color: '#4ade80',
                suffix: '+15%',
                label: upgradeModal.rolledStat || 'Mejora',
              }
              return (
                <>
                  <img
                    src={plantConf?.icon}
                    alt={plantConf?.name || 'Planta'}
                    className="jardin-upgrade-modal-img"
                  />
                  <h4 className="jardin-upgrade-modal-name">{plantConf?.name || 'Planta'}</h4>

                  <div
                    className="jardin-upgrade-modal-rolled-box"
                    style={{ borderColor: rolledMeta.color }}
                  >
                    <span className="jardin-upgrade-modal-stat-icon">
                      {rolledMeta.icon}
                    </span>
                    <span
                      className="jardin-upgrade-modal-stat-val"
                      style={{ color: rolledMeta.color }}
                    >
                      {rolledMeta.suffix}
                    </span>
                    <span className="jardin-upgrade-modal-stat-name">
                      {rolledMeta.label}
                    </span>
                  </div>
                </>
              )
            })()}

            <p className="jardin-upgrade-modal-desc">
              ¡Esta planta acaba de obtener un <strong>+15% aleatorio</strong> en este atributo! Cada planta mejorará de forma única.
            </p>

            <button
              type="button"
              className="jardin-upgrade-modal-btn"
              onClick={() => setUpgradeModal(null)}
            >
              ¡ENTENDIDO! 🚀
            </button>
          </div>
        </div>
      )}


      {/* MOTHER TREE UPGRADE MODAL */}
      {showTreeModal && (
        <TreeModal
          isOpen={showTreeModal}
          onClose={() => setShowTreeModal(false)}
          userTokens={userTokens}
          userGold={userGold}
          farmingItems={farmingItems}
          onRewardsChanged={onRewardsChanged}
          equippedTreeSkin={equippedTreeSkin}
          onEquipMotherTreeSkin={onEquipMotherTreeSkin}
          onUnequipMotherTreeSkin={onUnequipMotherTreeSkin}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ACELERAR SOBRE PvP CON ORO */}
      {rewardPackAccelerating && (() => {
        const hasEnoughGold = (userGold ?? 0) >= rewardPackAccelerating.goldCost
        const missingGold = rewardPackAccelerating.goldCost - (userGold ?? 0)

        return (
          <div
            className="main-menu-dialog-backdrop"
            onClick={() => {
              if (!isAcceleratingReward) setRewardPackAccelerating(null)
            }}
          >
            <div className="main-menu-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="main-menu-dialog-header">
                <div className="main-menu-dialog-icon">⚡</div>
                <h3 className="main-menu-dialog-title">ACELERAR DESBLOQUEO</h3>
                <button
                  type="button"
                  className="main-menu-dialog-close"
                  onClick={() => {
                    if (!isAcceleratingReward) setRewardPackAccelerating(null)
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Vista previa del sobre */}
              <div className="game-dialog-pack-preview">
                <img
                  src={
                    rewardPackAccelerating.isClanChampion
                      ? '/game-assets/greenfoot/seed_pack_clan_champion.webp'
                      : '/game-assets/greenfoot/seed_pack_pvp.webp'
                  }
                  alt={rewardPackAccelerating.isClanChampion ? 'Sobre Campeón de Clanes' : 'Sobre PvP'}
                  className="game-dialog-pack-img"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).src = rewardPackAccelerating.isClanChampion
                      ? '/game-assets/greenfoot/seed_pack_clan_champion.png'
                      : '/game-assets/greenfoot/seed_pack_pvp.png'
                  }}
                />
                <div className="game-dialog-pack-meta">
                  <span className="game-dialog-pack-tag">
                    {rewardPackAccelerating.isClanChampion ? '👑 TOP 1 CLANES' : 'SOBRE PvP'}
                  </span>
                  <span className="game-dialog-pack-name">
                    {rewardPackAccelerating.isClanChampion ? 'Sobre Campeón de Clanes' : 'Sobre de Recompensas'}
                  </span>
                  <span className="game-dialog-pack-timer">⚡ Desbloqueo Inmediato</span>
                </div>
              </div>

              {/* Comparación de Oro */}
              <div className="game-dialog-gold-box">
                <div className="game-dialog-gold-row">
                  <span className="game-dialog-gold-label">Costo en Oro:</span>
                  <strong className="game-dialog-gold-val game-dialog-gold-val--cost">
                    {rewardPackAccelerating.goldCost} 💰
                  </strong>
                </div>
                <div className="game-dialog-gold-row">
                  <span className="game-dialog-gold-label">Tu saldo actual:</span>
                  <strong className="game-dialog-gold-val">{userGold ?? 0} 💰</strong>
                </div>
                {!hasEnoughGold && (
                  <div className="game-dialog-gold-warning">
                    ⚠️ Te faltan {missingGold} de Oro para desbloquear este sobre.
                  </div>
                )}
              </div>

              <div className="main-menu-dialog-actions">
                <button
                  type="button"
                  className="main-menu-dialog-btn main-menu-dialog-btn--cancel"
                  disabled={isAcceleratingReward}
                  onClick={() => setRewardPackAccelerating(null)}
                >
                  CANCELAR
                </button>
                <button
                  type="button"
                  className={`main-menu-dialog-btn main-menu-dialog-btn--confirm ${!hasEnoughGold ? 'main-menu-dialog-btn--disabled' : ''}`}
                  disabled={isAcceleratingReward || !hasEnoughGold}
                  onClick={async () => {
                    if (!hasEnoughGold) {
                      setRewardPackAlert({
                        title: 'ORO INSUFICIENTE',
                        message: `Necesitas ${rewardPackAccelerating.goldCost} de oro para acelerar este sobre.`,
                        icon: '💰',
                      })
                      setRewardPackAccelerating(null)
                      return
                    }
                    setIsAcceleratingReward(true)
                    try {
                      soundManager.playSound('plantation', 0.9)
                      if (onInstantUnlockRewardPack) {
                        const res = await onInstantUnlockRewardPack(rewardPackAccelerating.packId)
                        if (!res.success && res.error) {
                          setRewardPackAlert({
                            title: 'ERROR AL ACELERAR',
                            message: res.error,
                            icon: '⚠️',
                          })
                        }
                      }
                    } finally {
                      setIsAcceleratingReward(false)
                      setRewardPackAccelerating(null)
                    }
                  }}
                >
                  {isAcceleratingReward
                    ? 'ACELERANDO...'
                    : hasEnoughGold
                    ? `PAGAR ${rewardPackAccelerating.goldCost} 💰`
                    : 'ORO INSUFICIENTE'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL DE ALERTA DE SOBRES PvP */}
      {rewardPackAlert && (
        <div className="main-menu-dialog-backdrop" onClick={() => setRewardPackAlert(null)}>
          <div className="main-menu-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="main-menu-dialog-icon">{rewardPackAlert.icon}</div>
            <h3 className="main-menu-dialog-title">{rewardPackAlert.title}</h3>
            <p className="main-menu-dialog-msg">{rewardPackAlert.message}</p>
            <div className="main-menu-dialog-actions">
              <button
                type="button"
                className="main-menu-dialog-btn"
                onClick={() => setRewardPackAlert(null)}
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
