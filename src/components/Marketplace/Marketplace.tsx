import React, { useState, useEffect, useMemo } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  getPlantRarityAndMinPrice,
  FARMING_ITEM_MIN_PRICES,
  type PlantRarity,
} from '../../utils/marketplaceManager'
import {
  FARMING_ITEM_DEFINITIONS,
  type FarmingInventory,
  type FarmingItemId,
} from '../../utils/pvpRewardManager'
import {
  marketplaceService,
  type GlobalTransactionItem,
  type MyMarketplaceListingsResponse,
  type MyMarketplaceItem,
} from '../../services/marketplaceService'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import type { PlantId, PlantCardInstance } from '../../types/game'
import { PLANT_CONFIGS, STAT_LABELS, VIP_PASS_PRECIO_GEMAS, GOLDEN_PLANT_ASSETS, getScaledPlantConfig, type PlantStatKey } from '../../utils/gameConstants'
import { evaluateMarketplaceAccess, calculateMarketplaceSplit } from '../../utils/marketplaceAccess'
import monedaImg from '../../assets/ico/moneda.webp'
import GoldIcon from '../Common/GoldIcon'
import './Marketplace.css'

function formatTxTime(dateStr?: string): string {
  if (!dateStr) return 'Reciente'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  if (isNaN(diffMs)) return 'Reciente'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return 'Hace un momento'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`
  return new Date(dateStr).toLocaleDateString()
}


interface MarketplaceProps {
  /** Ya no se usa para cobrar: el saldo lo mueve el servidor. Se deja para
   *  poder avisar de saldo insuficiente antes de llamar. */
  userTokens: number
  userGold?: number
  userElo?: number
  hasVipPass: boolean
  farmingItems?: FarmingInventory
  plantCopies: Partial<Record<PlantId, number>>
  plantLevels: Partial<Record<PlantId, number>>
  plantStatRolls: Partial<Record<PlantId, PlantStatKey[]>>
  plantInstances?: PlantCardInstance[]
  unlockedPlants?: PlantId[]
  activeDeck?: PlantId[]
  activeDeckInstances?: string[]
  /**
   * Estos cinco movían el inventario y el saldo EN EL NAVEGADOR. Ya no se usan:
   * comprar, publicar y retirar los hace el servidor, que es el único que sabe
   * de quién es cada carta. Se mantienen en la interfaz del componente para no
   * tocar App.tsx, y el prefijo _ dice que están de más.
   */
  onDeductTokens?: (amountUsd: number) => boolean
  onDonatePlant?: (plantId: PlantId) => boolean
  onReceivePlant?: (plantId: PlantId, level?: number, statRolls?: PlantStatKey[]) => void
  onRemovePlantInstance?: (instanceId: string) => boolean
  onUpdateDeck?: (plantIds: PlantId[], instanceIds?: string[]) => void
  /** Para recargar el inventario y el saldo del servidor tras una operación. */
  onServerChange?: () => void
  onBuyVipPass: () => Promise<{ success: boolean; error?: string }>
  onBackToMenu: () => void
  initialTab?: 'browse' | 'sell' | 'rent' | 'my_sales' | 'transactions'
  initialCategory?: 'plants' | 'farming' | 'gold' | null
}

/**
 * Una oferta tal como la devuelve marketplace_board().
 */
interface OfertaDelMercado {
  id: string
  itemType?: 'plant' | 'farming' | 'gold'
  listingType?: 'sale' | 'rental'
  rentalDurationDays?: number
  itemId?: string
  quantity?: number
  plantId?: PlantId
  nivel: number
  statRolls: PlantStatKey[]
  germinationsCount?: number
  equippedItem?: string | null
  precio: number
  vendedor: string | null
  esMia: boolean
  desde: string
  isGolden?: boolean
}

function getSproutTooltip(count: number): string {
  if (count <= 0) return '🌱0: Sin germinaciones gastadas (puede dar 2 crías)'
  if (count === 1) return '🌱1: Ya gastó 1 germinación (le queda 1 cría disponible)'
  return '🌱2: Ya no puede germinar (límite de 2 alcanzado)'
}

function getFusionTooltip(level: number): string {
  if (level <= 0) return '⭐0: Fusión Nivel 0 (Sin fusiones)'
  return `⭐${level}: Fusión Nivel ${level}`
}

interface MarketModalDialog {
  title: string
  message: string
  icon: string
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
}

export type SellableMarketItem =
  | {
      kind: 'plant'
      id: string
      instanceId: string
      plantId: PlantId
      level: number
      statRolls: PlantStatKey[]
      isBase: boolean
      isUnlocked: boolean
      rarity: PlantRarity
      minPrice: number
      rarityColor: string
      inDeck: boolean
      name: string
      icon: string
      germinationsCount?: number
      isGolden?: boolean
    }
  | {
      kind: 'farming'
      id: string
      itemId: FarmingItemId
      name: string
      icon: string
      fallbackIcon: string
      minPrice: number
      availableQty: number
      description: string
      rarity: string
      rarityColor: string
    }

export default function Marketplace({
  userTokens,
  userGold = 0,
  userElo,
  hasVipPass,
  farmingItems,
  plantCopies: _plantCopies = {},
  plantLevels = {},
  plantStatRolls = {},
  plantInstances = [],
  unlockedPlants,
  activeDeck = [],
  activeDeckInstances = [],
  onDeductTokens,
  onDonatePlant: _onDonatePlant,
  onReceivePlant: _onReceivePlant,
  onRemovePlantInstance: _onRemovePlantInstance,
  onUpdateDeck: _onUpdateDeck,
  onServerChange,
  onBuyVipPass,
  onBackToMenu,
  initialTab = 'browse',
  initialCategory = null,
}: MarketplaceProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'sell' | 'rent' | 'my_sales' | 'transactions'>(initialTab)
  const [selectedCategory, setSelectedCategory] = useState<'plants' | 'farming' | 'gold' | null>(initialCategory)

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab)
    }
  }, [initialTab])

  useEffect(() => {
    if (initialCategory !== undefined) {
      setSelectedCategory(initialCategory)
    }
  }, [initialCategory])
  const [sellCategory, setSellCategory] = useState<'plants' | 'farming' | 'gold'>('plants')
  const [goldSellQty, setGoldSellQty] = useState<number>(1000)
  const [goldSellPriceGems, setGoldSellPriceGems] = useState<number>(10)
  const [isGoldModalOpen, setIsGoldModalOpen] = useState<boolean>(false)
  const [listings, setListings] = useState<OfertaDelMercado[]>([])
  const [transactions, setTransactions] = useState<GlobalTransactionItem[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txFilter, setTxFilter] = useState<'all' | 'marketplace' | 'shop' | 'reward' | 'tournament'>('all')
  const [mySalesData, setMySalesData] = useState<MyMarketplaceListingsResponse | null>(null)
  const [mySalesLoading, setMySalesLoading] = useState<boolean>(false)
  const [mySalesSubTab, setMySalesSubTab] = useState<'active' | 'my_rentals' | 'borrowed' | 'history'>('active')
  const [browseListingType, setBrowseListingType] = useState<'all' | 'sale' | 'rental'>('all')
  const [myRentalsSummary, setMyRentalsSummary] = useState<{ myOfferedRentals: any[]; myBorrowedRentals: any[] }>({
    myOfferedRentals: [],
    myBorrowedRentals: [],
  })
  const [rentPlantModal, setRentPlantModal] = useState<OfertaDelMercado | null>(null)
  const [rentAutoRenew, setRentAutoRenew] = useState<boolean>(false)
  const [selectedRentPlantInstanceId, setSelectedRentPlantInstanceId] = useState<string | null>(null)
  const [rentalListingPrice, setRentalListingPrice] = useState<number>(50)
  const [isSubmittingRental, setIsSubmittingRental] = useState<boolean>(false)

  // Filtros y búsqueda para la pestaña Comercio
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterOnlyMine, setFilterOnlyMine] = useState<boolean>(false)
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'level_desc' | 'sprouts_asc' | 'gold_rate'>('newest')
  const [rarityFilter, setRarityFilter] = useState<'all' | 'COMÚN' | 'RARA' | 'ÉPICA' | 'LEGENDARIA'>('all')

  /** La comisión la manda el servidor: así el número no vive duplicado aquí. */
  const [comisionPct, setComisionPct] = useState<number>(10)
  const [cargando, setCargando] = useState(true)
  const [activeDialog, setActiveDialog] = useState<MarketModalDialog | null>(null)


  const accessInfo = useMemo(() => {
    return evaluateMarketplaceAccess(hasVipPass, userElo)
  }, [hasVipPass, userElo])

  const canSell = accessInfo.canSell
  const copasActuales = accessInfo.copasActuales

  // Total de cartas de plantas disponibles no listadas que posee el jugador
  const availablePlantsCount = useMemo(() => {
    return (plantInstances || []).filter((i) => !i.isListed).length
  }, [plantInstances])

  // Lista unificada de cartas de plantas e ítems de farming vendibles
  const sellableItems = useMemo<SellableMarketItem[]>(() => {
    const items: SellableMarketItem[] = []
    const unlocked = unlockedPlants || (Object.keys(PLANT_CONFIGS) as PlantId[])

    // 1. Cartas de Plantas
    if (plantInstances && plantInstances.length > 0) {
      const deckPlantIdsSeen = new Set<string>()
      plantInstances.forEach((inst) => {
        if (!unlocked.includes(inst.plantId)) return
        if (inst.isListed) return // Ya está listada para venta en el mercado
        const rInfo = getPlantRarityAndMinPrice(inst.plantId)
        
        let inDeck = false
        if (activeDeckInstances && activeDeckInstances.length > 0) {
          inDeck = activeDeckInstances.includes(inst.instanceId)
        } else if (inst.isInDeck !== undefined) {
          inDeck = Boolean(inst.isInDeck)
        } else if (activeDeck && activeDeck.includes(inst.plantId) && !deckPlantIdsSeen.has(inst.plantId)) {
          inDeck = true
          deckPlantIdsSeen.add(inst.plantId)
        }

        const isGolden = Boolean(inst.isGolden)
        const pConfig = PLANT_CONFIGS[inst.plantId]
        const scaledConfig = getScaledPlantConfig(inst.plantId, inst.statRolls || [], inst.equippedItem, isGolden)
        items.push({
          kind: 'plant',
          id: inst.instanceId,
          instanceId: inst.instanceId,
          plantId: inst.plantId,
          level: inst.level || 0,
          statRolls: inst.statRolls || [],
          isBase: inst.isBase ?? false,
          isUnlocked: true,
          rarity: rInfo.rarity,
          minPrice: rInfo.minPrice,
          rarityColor: rInfo.color,
          inDeck,
          name: isGolden ? `✨ ${pConfig?.name || inst.plantId} (Dorada)` : (pConfig?.name || inst.plantId),
          icon: scaledConfig.packetActive || scaledConfig.icon || pConfig?.packetActive || pConfig?.icon || '',
          germinationsCount: inst.germinationsCount ?? 0,
          isGolden,
        })
      })
    } else {
      unlocked.forEach((pId) => {
        const rInfo = getPlantRarityAndMinPrice(pId)
        const pConfig = PLANT_CONFIGS[pId]
        items.push({
          kind: 'plant',
          id: `inst_base_${pId}`,
          instanceId: `inst_base_${pId}`,
          plantId: pId,
          level: plantLevels[pId] || 0,
          statRolls: plantStatRolls[pId] || [],
          isBase: true,
          isUnlocked: true,
          rarity: rInfo.rarity,
          minPrice: rInfo.minPrice,
          rarityColor: rInfo.color,
          inDeck: Boolean(activeDeck?.includes(pId)),
          name: pConfig?.name || pId,
          icon: pConfig?.packetActive || pConfig?.icon || '',
          germinationsCount: 0,
        })
      })
    }

    // 2. Ítems de Farming del jugador
    if (farmingItems) {
      const order: FarmingItemId[] = [
        'water',
        'fertilizer',
        'shovel_fragment',
        'pesticide',
        'scarecrow_fragment',
        'shovel',
        'scarecrow',
        'champion_belt',
        'witch_hat',
        'knight_helmet',
        'energy_potion_5',
        'sunflower_glasses',
        'cactus_armor',
        'superman_suit',
        'spiderman_suit',
        'batman_suit',
        'ironman_suit',
        'gold_24k',
        'samurai_armor',
        'commando_bandana',
      ]
      order.forEach((fId) => {
        const qty = Number(farmingItems[fId] || 0)
        if (qty > 0) {
          const def = FARMING_ITEM_DEFINITIONS[fId]
          const minP = FARMING_ITEM_MIN_PRICES[fId] || 10
          items.push({
            kind: 'farming',
            id: `farming_${fId}`,
            itemId: fId,
            name: def?.label || fId,
            icon: def?.icon || '',
            fallbackIcon: def?.fallback || '🌾',
            minPrice: minP,
            availableQty: qty,
            description: def?.description || 'Recurso oficial de cultivo.',
            rarity: 'FARMING',
            rarityColor: '#4ade80',
          })
        }
      })
    }

    return items
  }, [plantInstances, unlockedPlants, plantLevels, plantStatRolls, activeDeck, activeDeckInstances, farmingItems])

  const plantOffers = useMemo(() => {
    return listings.filter((item) => {
      if (item.itemType === 'gold' || item.itemId === 'gold') return false
      if (item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId])) return false
      return Boolean(item.plantId || item.itemType === 'plant' || (!item.itemType && !item.itemId))
    })
  }, [listings])

  const farmingOffers = useMemo(() => {
    return listings.filter((item) => {
      if (item.itemType === 'gold' || item.itemId === 'gold') return false
      return item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId])
    })
  }, [listings])

  const goldOffers = useMemo(() => {
    return listings.filter((item) => item.itemType === 'gold' || item.itemId === 'gold')
  }, [listings])

  const filteredPlantOffers = useMemo(() => {
    const list = plantOffers.filter((item) => {
      if (filterOnlyMine && !item.esMia) return false
      if (browseListingType === 'sale' && item.listingType === 'rental') return false
      if (browseListingType === 'rental' && item.listingType !== 'rental') return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const pDef = item.plantId ? PLANT_CONFIGS[item.plantId] : null
        const name = (pDef?.name || item.plantId || '').toLowerCase()
        if (!name.includes(query)) return false
      }
      if (rarityFilter !== 'all' && item.plantId) {
        const rInfo = getPlantRarityAndMinPrice(item.plantId)
        if (rInfo.rarity !== rarityFilter) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.precio - b.precio
      if (sortBy === 'price_desc') return b.precio - a.precio
      if (sortBy === 'level_desc') return b.nivel - a.nivel
      if (sortBy === 'sprouts_asc') return (a.germinationsCount ?? 0) - (b.germinationsCount ?? 0)
      return new Date(b.desde).getTime() - new Date(a.desde).getTime()
    })
  }, [plantOffers, filterOnlyMine, browseListingType, searchQuery, rarityFilter, sortBy])

  const filteredFarmingOffers = useMemo(() => {
    const list = farmingOffers.filter((item) => {
      if (filterOnlyMine && !item.esMia) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const fDef = item.itemId ? FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId] : null
        const name = (fDef?.label || item.itemId || '').toLowerCase()
        if (!name.includes(query)) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.precio - b.precio
      if (sortBy === 'price_desc') return b.precio - a.precio
      return new Date(b.desde).getTime() - new Date(a.desde).getTime()
    })
  }, [farmingOffers, filterOnlyMine, searchQuery, sortBy])

  const filteredGoldOffers = useMemo(() => {
    const list = goldOffers.filter((item) => {
      if (filterOnlyMine && !item.esMia) return false
      return true
    })

    return [...list].sort((a, b) => {
      const rateA = a.precio > 0 ? (a.quantity || 1) / a.precio : 0
      const rateB = b.precio > 0 ? (b.quantity || 1) / b.precio : 0
      if (sortBy === 'gold_rate') return rateB - rateA
      if (sortBy === 'price_asc') return a.precio - b.precio
      if (sortBy === 'price_desc') return b.precio - a.precio
      return new Date(b.desde).getTime() - new Date(a.desde).getTime()
    })
  }, [goldOffers, filterOnlyMine, sortBy])

  const sellablePlants = useMemo(() => sellableItems.filter((c) => c.kind === 'plant'), [sellableItems])
  const sellableFarming = useMemo(() => sellableItems.filter((c) => c.kind === 'farming'), [sellableItems])

  // Plantas elegibles exclusivamente para ALQUILER (sólo cartas que posee el jugador, no alquiladas de terceros, no en venta)
  const rentEligiblePlants = useMemo(() => {
    return sellablePlants.filter((item) => {
      const inst = plantInstances?.find((i) => i.instanceId === item.instanceId)
      if (inst) {
        if ((inst as any).is_rented || (inst as any).isRented || (inst as any).borrower_id || (inst as any).borrowerId) return false
        if ((inst as any).is_listed_for_rent || (inst as any).isListedForRent) return false
      }
      return true
    })
  }, [sellablePlants, plantInstances])

  const selectedRentPlant = useMemo(() => {
    return rentEligiblePlants.find((p) => p.instanceId === selectedRentPlantInstanceId) || rentEligiblePlants[0] || null
  }, [rentEligiblePlants, selectedRentPlantInstanceId])

  useEffect(() => {
    if (rentEligiblePlants.length > 0) {
      if (!selectedRentPlantInstanceId || !rentEligiblePlants.some((p) => p.instanceId === selectedRentPlantInstanceId)) {
        const firstAvailable = rentEligiblePlants.find((p) => !p.inDeck) || rentEligiblePlants[0]
        setSelectedRentPlantInstanceId(firstAvailable?.instanceId || null)
      }
    }
  }, [rentEligiblePlants, selectedRentPlantInstanceId])

  const formatRemainingTime = (secondsRemaining?: number, expiresAt?: string) => {
    let secs = secondsRemaining
    if (secs === undefined && expiresAt) {
      secs = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
    }
    if (secs === undefined || secs <= 0) return 'Expirado'
    const days = Math.floor(secs / 86400)
    const hours = Math.floor((secs % 86400) / 3600)
    const minutes = Math.floor((secs % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h restantes`
    if (hours > 0) return `${hours}h ${minutes}m restantes`
    return `${minutes}m restantes`
  }

  const displayedSellableItems = useMemo(() => {
    if (sellCategory === 'farming') return sellableFarming
    return sellablePlants
  }, [sellCategory, sellablePlants, sellableFarming])

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    return sellableItems[0]?.id || ''
  })

  const [sellQuantity, setSellQuantity] = useState<number>(1)

  useEffect(() => {
    if (sellCategory === 'plants' && sellablePlants.length > 0) {
      if (!sellablePlants.some((c) => c.id === selectedItemId)) {
        setSelectedItemId(sellablePlants[0].id)
      }
    } else if (sellCategory === 'farming' && sellableFarming.length > 0) {
      if (!sellableFarming.some((c) => c.id === selectedItemId)) {
        setSelectedItemId(sellableFarming[0].id)
      }
    } else if (sellableItems.length > 0 && (!selectedItemId || !sellableItems.some((c) => c.id === selectedItemId))) {
      setSelectedItemId(sellableItems[0].id)
    }
  }, [sellCategory, sellablePlants, sellableFarming, sellableItems, selectedItemId])

  useEffect(() => {
    setSellQuantity(1)
  }, [selectedItemId])

  const selectedItem = sellableItems.find((c) => c.id === selectedItemId) || sellableItems[0]

  const currentMinPrice = selectedItem ? selectedItem.minPrice : 100
  const [sellPriceGems, setSellPriceGems] = useState<number>(currentMinPrice)

  // Asegurar que el precio de venta sea al menos el mínimo permitido para este ítem
  useEffect(() => {
    if (selectedItem) {
      setSellPriceGems((prev) => Math.max(selectedItem.minPrice, prev))
    }
  }, [selectedItem?.id, selectedItem?.minPrice])

  const showModalAlert = (
    title: string,
    message: string,
    icon = 'ℹ️',
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    setActiveDialog({ title, message, icon, type, confirmText: 'ENTENDIDO' })
  }

  const showModalConfirm = (
    title: string,
    message: string,
    icon: string,
    onConfirm: () => void,
    confirmText = 'CONFIRMAR',
    cancelText = 'CANCELAR'
  ) => {
    setActiveDialog({
      title,
      message,
      icon,
      type: 'confirm',
      confirmText,
      cancelText,
      onConfirm,
    })
  }

  const refreshListings = async (categoryFilter?: 'plant' | 'farming' | 'gold' | null) => {
    const tablero = await marketplaceService.marketplaceBoard(80, categoryFilter)
    if (tablero) {
      setListings(tablero.ofertas)
      setComisionPct(Number(tablero.comisionPct ?? 10))
    }
    setCargando(false)
  }

  const refreshMyListings = async () => {
    setMySalesLoading(true)
    try {
      const data = await marketplaceService.getMyMarketplaceListings(50)
      if (data && data.success) {
        setMySalesData(data)
      }
    } catch (e) {
      console.warn('Error cargando mis publicaciones:', e)
    } finally {
      setMySalesLoading(false)
    }
  }

  const refreshTransactions = async () => {
    setTxLoading(true)
    try {
      const data = await marketplaceService.getGlobalTransactions(120)
      setTransactions(data || [])
    } catch (e) {
      console.warn('Error cargando transacciones globales:', e)
    } finally {
      setTxLoading(false)
    }
  }

  const refreshRentals = async () => {
    try {
      const data = await marketplaceService.getMyRentalsSummary()
      if (data && data.success) {
        setMyRentalsSummary({
          myOfferedRentals: data.myOfferedRentals || [],
          myBorrowedRentals: data.myBorrowedRentals || [],
        })
      }
    } catch (e) {
      console.warn('Error cargando alquileres:', e)
    }
  }

  useEffect(() => {
    void refreshListings(selectedCategory === 'plants' ? 'plant' : selectedCategory)
    void refreshTransactions()
    void refreshMyListings()
    void refreshRentals()
  }, [])

  useEffect(() => {
    if (activeTab === 'browse') {
      void refreshListings(selectedCategory === 'plants' ? 'plant' : selectedCategory)
    } else if (activeTab === 'my_sales' || activeTab === 'rent') {
      void refreshMyListings()
      void refreshRentals()
    } else if (activeTab === 'transactions') {
      void refreshTransactions()
    }
  }, [activeTab, selectedCategory])

  const safeTransactions = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.type !== 'withdrawal' &&
        !t.title?.toLowerCase().includes('retiro') &&
        !t.description?.toLowerCase().includes('retiro')
    )
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (txFilter === 'all') return safeTransactions
    if (txFilter === 'marketplace') return safeTransactions.filter((t) => t.type === 'marketplace_sale')
    if (txFilter === 'shop')
      return safeTransactions.filter(
        (t) =>
          t.type === 'shop_pack' ||
          t.type === 'shop_gold' ||
          t.type === 'shop_energy' ||
          t.type === 'shop_purchase' ||
          t.type === 'shop_pass' ||
          t.type === 'deposit' ||
          t.type.startsWith('shop') ||
          t.description?.toLowerCase().includes('tienda') ||
          t.description?.toLowerCase().includes('sobre') ||
          t.description?.toLowerCase().includes('oro') ||
          t.description?.toLowerCase().includes('energía') ||
          t.description?.toLowerCase().includes('energia') ||
          t.description?.toLowerCase().includes('pase vip')
      )
    if (txFilter === 'tournament')
      return safeTransactions.filter(
        (t) =>
          t.type === 'tournament_entry_fee' ||
          t.type === 'tournament_reentry' ||
          t.type === 'tournament_reward' ||
          t.type.startsWith('tournament') ||
          t.description?.toLowerCase().includes('torneo')
      )
    if (txFilter === 'reward')
      return safeTransactions.filter(
        (t) =>
          t.type === 'lottery_win' ||
          t.type === 'lottery_spin' ||
          t.type === 'reward_code' ||
          t.type === 'referral_reward'
      )
    return safeTransactions
  }, [safeTransactions, txFilter])

  const txStats = useMemo(() => {
    let totalP2pGems = 0
    let totalRewardGems = 0
    safeTransactions.forEach((t) => {
      if (t.type === 'marketplace_sale' && t.amountGems) {
        totalP2pGems += t.amountGems
      }
      if ((t.type === 'lottery_win' || t.type === 'tournament_reward' || t.type === 'referral_reward') && t.amountGems) {
        totalRewardGems += t.amountGems
      }
    })
    return {
      total: safeTransactions.length,
      p2pGems: totalP2pGems,
      rewardGems: totalRewardGems,
    }
  }, [safeTransactions])


  // Sin servidor no hay mercado. Antes había una versión en localStorage y eso
  // era peor que nada: cada jugador veía sus propias ofertas inventadas.
  const sinServidor = !isSupabaseConfigured()

  // Helper to format rolls in clean pills
  const formatStatRolls = (rolls: PlantStatKey[] = []) => {
    if (!rolls || rolls.length === 0) return null
    const counts: Partial<Record<PlantStatKey, number>> = {}
    rolls.forEach((stat) => {
      counts[stat] = (counts[stat] || 0) + 1
    })

    return Object.entries(counts).map(([key, count]) => {
      const statKey = key as PlantStatKey
      const totalPct = (count || 1) * 15
      const countTag = count && count > 1 ? ` (x${count})` : ''
      const statDef = STAT_LABELS[statKey]
      const label = statDef ? statDef.label : statKey
      const icon = statDef ? statDef.icon : '⚡'

      return (
        <span key={statKey} className="market-stat-pill">
          {icon} +{totalPct}% {label}{countTag}
        </span>
      )
    })
  }

  // COMPRAR UNA OFERTA
  //
  // El saldo lo mueve el servidor, no esta pantalla: cobra al comprador, paga al
  // vendedor su 90 %, reparte el trozo del ranking de referidos y apunta la venta
  // en el registro. Aquí sólo se pide y se recarga.
  const handleBuyListing = (item: OfertaDelMercado) => {
    if (item.esMia) {
      showModalAlert('OFERTA PROPIA', 'No puedes comprar tu propia oferta puesta en el mercado.', '⚠️', 'warning')
      return
    }
    // ¡Todos los jugadores pueden comprar! La prohibición de copas/pase es exclusivamente para vender.
    if (userTokens < item.precio) {
      showModalAlert(
        'GEMAS INSUFICIENTES',
        `Necesitas ${item.precio} 💎 y tienes ${userTokens}. Recarga en la Tienda.`,
        '⚠️',
        'warning'
      )
      return
    }

    const isGold = item.itemType === 'gold' || item.itemId === 'gold'
    const isFarming = !isGold && (item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]))
    const qty = Math.max(1, Number(item.quantity) || 1)
    const nombre = isGold
      ? 'Monedas de Oro'
      : isFarming
      ? (FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]?.label || item.itemId || 'Recurso')
      : (item.plantId && PLANT_CONFIGS[item.plantId as PlantId]?.name || item.plantId || 'Carta')
    const detalle = isGold
      ? `${qty.toLocaleString('en-US')} Monedas de Oro`
      : isFarming
      ? (qty > 1 ? `el lote completo de ${qty}x "${nombre}"` : `1x "${nombre}"`)
      : `"${nombre}" (⭐${item.nivel} · 🌱${item.germinationsCount ?? 0})`

    const split = calculateMarketplaceSplit(item.precio, comisionPct)

    showModalConfirm(
      isGold ? 'COMPRAR ORO P2P' : 'CONFIRMAR COMPRA',
      isGold
        ? `¿Deseas comprar ${detalle} por un total de ${item.precio} 💎?\n\n` +
          `• Se descontará el 100% (${item.precio} 💎) de tu saldo de gemas.\n` +
          `• El vendedor recibirá el 90% neto (${split.neto} 💎) y el juego retiene el ${split.comisionPct}% (${split.comision} 💎) de comisión.\n` +
          `• Recibirás las ${qty.toLocaleString('en-US')} Monedas de Oro inmediatamente en tu saldo.`
        : `¿Deseas comprar ${detalle} por un total de ${item.precio} 💎?\n\n` +
          `• Se descontará el 100% (${item.precio} 💎) de tu saldo de gemas.\n` +
          `• El vendedor recibirá el 90% neto (${split.neto} 💎) y el juego retiene el ${split.comisionPct}% (${split.comision} 💎) de comisión.\n` +
          (isFarming && qty > 1 ? `• Recibirás las ${qty} unidades juntas en tu inventario de cultivo.` : ''),
      isGold ? '💰' : '🛒',
      async () => {
        const r = await marketplaceService.buyMarketplaceCard(item.id)
        if (!r.success) {
          showModalAlert('NO SE PUDO COMPRAR', r.error || 'La oferta ya no está disponible.', '⚠️', 'error')
          await refreshListings()
          return
        }
        soundManager.playSound('victory', 1)

        // Refresco inmediato de saldo e inventario en UI y backend
        onDeductTokens?.(item.precio)
        window.dispatchEvent(new Event('refresh_user_balance'))
        window.dispatchEvent(new Event('refresh_user_inventory'))

        if (onServerChange) {
          try {
            await onServerChange()
          } catch (err) {
            console.warn('[Marketplace] Error refrescando estado tras compra:', err)
          }
        }

        showModalAlert(
          '¡COMPRA EXITOSA!',
          `Has adquirido ${detalle} por ${item.precio} 💎.\nSe descontaron ${item.precio} 💎 de tu saldo y ya está acreditado en tu ${isGold ? 'balance de Oro' : isFarming ? 'inventario de cultivo' : 'Jardín'}.`,
          '🎉',
          'success'
        )
        await refreshListings()
        void refreshTransactions()
      },
      `COMPRAR (${item.precio} 💎)`,
      'CANCELAR'
    )
  }

  // SELL / LIST A CARD OR FARMING ITEM ON MARKETPLACE
  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem) return

    if (!canSell) {
      showModalConfirm(
        'VENTAS BLOQUEADAS',
        `Todos los jugadores pueden comprar ofertas en el mercado libremente.\n\nPara poner en venta cartas o ítems de tu Jardín necesitas el Pase PvP o alcanzar 1,350 Copas en la Arena.\n\nTus copas actuales: ${copasActuales} / 1,350.\n\n¿Deseas activar tu Pase PvP (${VIP_PASS_PRECIO_GEMAS} 💎) ahora?`,
        '🔒',
        () => {
          handleDirectBuyVip()
        },
        `ACTIVAR PASE PVP (${VIP_PASS_PRECIO_GEMAS} 💎)`,
        'CANCELAR'
      )
      return
    }

    if (sellPriceGems < selectedItem.minPrice) {
      showModalAlert(
        'PRECIO INFERIOR AL MÍNIMO',
        `El precio mínimo de venta para "${selectedItem.name}" es de ${selectedItem.minPrice} 💎 gemas.`,
        '⚠️',
        'warning'
      )
      return
    }

    const split = calculateMarketplaceSplit(sellPriceGems, comisionPct)

    if (selectedItem.kind === 'farming') {
      const qtyToSell = Math.max(1, Math.min(selectedItem.availableQty, sellQuantity))
      showModalConfirm(
        'PUBLICAR LOTE EN EL MERCADO',
        `¿Confirmas poner en venta el lote de ${qtyToSell}x "${selectedItem.name}" por un precio total de ${sellPriceGems} 💎?\n\n` +
          `• La venta es por el lote completo: el comprador pagará ${sellPriceGems} 💎 por las ${qtyToSell} unidades.\n` +
          `• La comisión retenida por el juego es del ${split.comisionPct}% (${split.comision} 💎).\n` +
          `• Recibirás el 90% neto (${split.neto} 💎) cuando se concrete la venta.\n\n` +
          `⚠️ Los ${qtyToSell} recursos se descontarán de tu inventario mientras el lote esté publicado.`,
        '🏷️',
        async () => {
          const r = await marketplaceService.listMarketplaceItem('farming', selectedItem.itemId, sellPriceGems, qtyToSell)
          if (!r.success) {
            showModalAlert('NO SE PUDO PUBLICAR', r.error || 'Inténtalo de nuevo.', '⚠️', 'error')
            return
          }

          soundManager.playSound('plantation', 0.9)
          showModalAlert(
            '¡LOTE PUBLICADO EN EL MERCADO!',
            `Lote de ${qtyToSell}x "${selectedItem.name}" puesto en venta por ${sellPriceGems} 💎 en total.\nRecibirás el 90% neto (${split.neto} 💎) al concretarse la venta.`,
            '🏷️',
            'success'
          )
          setActiveTab('browse')
          await refreshListings()
          window.dispatchEvent(new Event('refresh_user_inventory'))
          onServerChange?.()
        },
        `SÍ, VENDER LOTE (${sellPriceGems} 💎)`,
        'CANCELAR'
      )
      return
    }

    // Carta de Planta
    let targetInstanceId = selectedItem.instanceId
    if (!/^[0-9a-f-]{36}$/i.test(targetInstanceId)) {
      // Intentar resolver UUID físico real si es un id virtual inst_base_<plantId>
      const realCandidate = (plantInstances || []).find(
        (i) => i.plantId === selectedItem.plantId && /^[0-9a-f-]{36}$/i.test(i.instanceId) && !i.isListed
      )
      if (realCandidate) {
        targetInstanceId = realCandidate.instanceId
      }
    }

    if (!/^[0-9a-f-]{36}$/i.test(targetInstanceId) && !targetInstanceId.startsWith('inst_base_')) {
      showModalAlert(
        'ESTA CARTA NO SE PUEDE VENDER',
        'Es una carta base del juego, no una instancia de tu inventario. Vende cartas obtenidas en sobres o cofres.',
        '⚠️',
        'warning'
      )
      return
    }

    // Comprobación Enfoque B: Si la planta está en el mazo activo, el sistema NO le permite venderla
    if (selectedItem.inDeck) {
      showModalAlert(
        'PLANTA EN MAZO DE BATALLA',
        'Esta planta está en tu mazo de batalla. Desequípala tú mismo en Mi Jardín antes de ponerla en venta.',
        '🛑',
        'warning'
      )
      return
    }

    // Comprobación de inventario mínimo: el jugador debe conservar al menos 3 plantas para poder jugar
    if (availablePlantsCount <= 3) {
      showModalAlert(
        'INVENTARIO MÍNIMO REQUERIDO',
        'No puedes vender esta planta. Necesitas conservar un mínimo de 3 plantas en tu inventario para poder armar un mazo y combatir en la Arena.',
        '🛑',
        'warning'
      )
      return
    }

    const sameSpeciesCount = (plantInstances || []).filter((i) => i.plantId === selectedItem.plantId && !i.isListed).length
    const isLastInstance = sameSpeciesCount <= 1

    const copyWarning = isLastInstance
      ? `🔥 ¡ADVERTENCIA CRÍTICA! Esta es tu ÚNICA carta de "${selectedItem.name}". Al ponerla en venta, se quemarán tus copias acumuladas de esta planta para mantener el juego justo y prevenir exploits.\n\n`
      : `ℹ️ Posees ${sameSpeciesCount} cartas de "${selectedItem.name}". Al vender esta, conservarás tus otras cartas y tus copias acumuladas se mantendrán intactas en tu cuenta.\n\n`

    showModalConfirm(
      '⚠️ ¿VENDER TU CARTA DE PLANTA?',
      `Vas a poner en venta tu carta jugable "${selectedItem.name}" (⭐${selectedItem.level} · 🌱${selectedItem.germinationsCount ?? 0}) por ${sellPriceGems} 💎.\n\n` +
        `❌ ¡ATENCIÓN! NO estás vendiendo copias sueltas. Venderás esta carta de tu Jardín.\n\n` +
        copyWarning +
        `• Al comprador se le descuenta el 100% (${sellPriceGems} 💎).\n` +
        `• La comisión retenida por el juego es del ${split.comisionPct}% (${split.comision} 💎).\n` +
        `• Recibirás el 90% neto (${split.neto} 💎) al concretarse la venta.\n\n` +
        `¿Estás seguro de que deseas ponerla en venta?`,
      '🏷️',
      async () => {
        const r = await marketplaceService.listMarketplaceItem('plant', targetInstanceId, sellPriceGems, 1)
        if (!r.success) {
          showModalAlert('NO SE PUDO PUBLICAR', r.error || 'Inténtalo de nuevo.', '⚠️', 'error')
          return
        }

        soundManager.playSound('plantation', 0.9)
        showModalAlert(
          '¡OFERTA PUBLICADA EN EL MERCADO!',
          `"${selectedItem.name}" (⭐${selectedItem.level} · 🌱${selectedItem.germinationsCount ?? 0}) está en venta por ${sellPriceGems} 💎.\nRecibirás el 90% neto (${split.neto} 💎) cuando se venda.`,
          '🏷️',
          'success'
        )
        setActiveTab('browse')
        await refreshListings()
        window.dispatchEvent(new Event('refresh_user_inventory'))
        onServerChange?.()
      },
      `SÍ, VENDER MI PLANTA (${sellPriceGems} 💎)`,
      'CANCELAR (CONSERVAR MI PLANTA)'
    )
  }

  // RETIRAR MI OFERTA
  const handleCancelListing = (item: OfertaDelMercado | MyMarketplaceItem) => {
    const isGold = item.itemType === 'gold' || item.itemId === 'gold'
    const isFarming = !isGold && (item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]))
    const qty = Math.max(1, Number(item.quantity) || 1)
    const nombre = isGold
      ? 'Monedas de Oro'
      : isFarming
      ? (FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]?.label || item.itemId || 'Recurso')
      : (item.plantId && PLANT_CONFIGS[item.plantId as PlantId]?.name || item.plantId || 'Carta')
    const detalle = isGold
      ? `${qty.toLocaleString('en-US')} Monedas de Oro`
      : isFarming && qty > 1
      ? `el lote de ${qty}x "${nombre}"`
      : `"${nombre}"`

    showModalConfirm(
      'RECUPERAR ÍTEM A TU INVENTARIO',
      `¿Deseas retirar ${detalle} del mercado y recuperar ${isGold ? 'el oro en tu cuenta' : isFarming ? 'los recursos en tu inventario' : 'la planta en tu Jardín'} de inmediato?`,
      '📦',
      async () => {
        const r = (item as any).listingType === 'rental'
          ? await marketplaceService.cancelPlantRentalListing(item.id)
          : await marketplaceService.cancelMarketplaceListing(item.id)
        if (!r.success) {
          showModalAlert('NO SE PUDO RETIRAR', r.error || 'Inténtalo de nuevo.', '⚠️', 'error')
          return
        }
        soundManager.playSound('plantation', 0.8)
        showModalAlert(
          '¡ÍTEM RECUPERADO CON ÉXITO!',
          `${detalle} ha vuelto de inmediato a tu ${isGold ? 'saldo de oro' : isFarming ? 'inventario de cultivo' : 'Jardín'}.`,
          '📦',
          'success'
        )
        await refreshListings(selectedCategory === 'plants' ? 'plant' : selectedCategory)
        await refreshMyListings()
        window.dispatchEvent(new Event('refresh_user_balance'))
        window.dispatchEvent(new Event('refresh_user_inventory'))
        onServerChange?.()
      },
      'SÍ, RECUPERAR AHORA',
      'MANTENER EN VENTA'
    )
  }

  const handleConfirmRentPlant = async (offer: OfertaDelMercado, autoRenew: boolean) => {
    if (userTokens < offer.precio) {
      soundManager.playSound('surrender', 0.6)
      showModalAlert(
        'GEMAS INSUFICIENTES',
        `Requieres ${offer.precio} Gemas 💎 para alquilar esta planta durante 7 días.\nTu saldo actual es de ${Math.floor(userTokens)} Gemas.`,
        '💎',
        'warning'
      )
      setRentPlantModal(null)
      return
    }

    try {
      const res = await marketplaceService.rentMarketplacePlant(offer.id, autoRenew)
      if (!res.success) {
        soundManager.playSound('surrender', 0.6)
        showModalAlert('ERROR EN ALQUILER', res.error || 'No se pudo completar el alquiler.', '⚠️', 'error')
      } else {
        soundManager.playSound('victory', 0.7)
        showModalAlert(
          '¡PLANTA ALQUILADA!',
          `Has alquilado la planta por 7 días por ${offer.precio} Gemas 💎.\n${autoRenew ? '✨ Renovación automática ACTIVADA al vencer los 7 días.' : '✨ Duración de 7 días sin renovación.'}\n\n¡Ya está disponible en tu Jardín para añadirla a tu mazo!`,
          '🎉',
          'success'
        )
        await refreshListings(selectedCategory === 'plants' ? 'plant' : selectedCategory)
        await refreshRentals()
        window.dispatchEvent(new Event('refresh_user_balance'))
        window.dispatchEvent(new Event('refresh_user_inventory'))
        onServerChange?.()
      }
    } catch (e: any) {
      soundManager.playSound('surrender', 0.6)
      showModalAlert('ERROR DE CONEXIÓN', e?.message || 'Error al conectar con el servidor', '⚠️', 'error')
    } finally {
      setRentPlantModal(null)
    }
  }

  const handleConfirmListPlantForRent = async (instanceId: string, priceGems: number) => {
    if (priceGems < 20) {
      showModalAlert('PRECIO INVÁLIDO', 'El precio mínimo de alquiler es de 20 Gemas por 7 días.', '⚠️', 'warning')
      return
    }

    setIsSubmittingRental(true)
    try {
      const res = await marketplaceService.listPlantForRent(instanceId, priceGems)
      if (!res.success) {
        soundManager.playSound('surrender', 0.6)
        showModalAlert('ERROR AL PUBLICAR', res.error || 'No se pudo publicar la oferta de alquiler.', '⚠️', 'error')
      } else {
        soundManager.playSound('upgrade', 0.7)
        showModalAlert(
          '¡PLANTA EN ALQUILER!',
          `Tu planta ha sido publicada en oferta de alquiler por ${priceGems} Gemas 💎 durante 7 días.\n\nEn cuanto otro jugador la alquile recibirás tus gemas netas (-10% comisión) al instante.`,
          '🤝',
          'success'
        )
        setSelectedRentPlantInstanceId(null)
        await refreshRentals()
        await refreshListings('plant')
        window.dispatchEvent(new Event('refresh_user_inventory'))
        onServerChange?.()
        setActiveTab('my_sales')
        setMySalesSubTab('my_rentals')
      }
    } catch (e: any) {
      soundManager.playSound('surrender', 0.6)
      showModalAlert('ERROR DE CONEXIÓN', e?.message || 'Error al conectar con el servidor', '⚠️', 'error')
    } finally {
      setIsSubmittingRental(false)
    }
  }

  const handleToggleAutoRenew = async (instanceId: string, currentAutoRenew: boolean) => {
    try {
      const res = await marketplaceService.toggleRentalAutoRenew(instanceId, !currentAutoRenew)
      if (!res.success) {
        showModalAlert('ERROR', res.error || 'No se pudo cambiar el estado de renovación.', '⚠️', 'error')
      } else {
        soundManager.playSound('click', 0.5)
        await refreshRentals()
      }
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Fallo de conexión', '⚠️', 'error')
    }
  }

  const handleCancelRentalOffer = (listingId: string) => {
    showModalConfirm(
      '¿RETIRAR OFERTA DE ALQUILER?',
      '¿Deseas retirar esta planta del catálogo de alquileres y recuperarla a tu Jardín?',
      '⚠️',
      async () => {
        const res = await marketplaceService.cancelPlantRentalListing(listingId)
        if (res.success) {
          soundManager.playSound('plantation', 0.6)
          await refreshRentals()
          await refreshListings('plant')
          window.dispatchEvent(new Event('refresh_user_inventory'))
          onServerChange?.()
        } else {
          showModalAlert('ERROR', res.error || 'No se pudo retirar la oferta', '⚠️', 'error')
        }
      },
      'SÍ, RETIRAR',
      'CANCELAR'
    )
  }

  const handleListRentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRentPlant) return

    if (!canSell) {
      showModalConfirm(
        'ALQUILER BLOQUEADO',
        `Para poner en alquiler cartas de tu Jardín necesitas el Pase PvP o alcanzar 1,350 Copas en la Arena.\n\nTus copas actuales: ${copasActuales} / 1,350.\n\n¿Deseas activar tu Pase PvP (${VIP_PASS_PRECIO_GEMAS} 💎) ahora?`,
        '🔒',
        () => {
          handleDirectBuyVip()
        },
        `ACTIVAR PASE PVP (${VIP_PASS_PRECIO_GEMAS} 💎)`,
        'CANCELAR'
      )
      return
    }

    if (rentalListingPrice < 20) {
      showModalAlert('PRECIO MÍNIMO', 'El precio mínimo de alquiler es de 20 Gemas por 7 días.', '⚠️', 'warning')
      return
    }

    if (selectedRentPlant.inDeck) {
      showModalAlert(
        'PLANTA EN MAZO DE BATALLA',
        'Esta planta está actualmente en tu mazo de combate. Para alquilarla a otro jugador, primero debes desequiparla de tu mazo en Mi Jardín.',
        '🛑',
        'warning'
      )
      return
    }

    if (availablePlantsCount <= 3) {
      showModalAlert(
        'INVENTARIO MÍNIMO REQUERIDO',
        'Necesitas conservar al menos 3 plantas en tu inventario para poder combatir en la Arena.',
        '🛑',
        'warning'
      )
      return
    }

    let targetInstanceId = selectedRentPlant.instanceId
    if (!/^[0-9a-f-]{36}$/i.test(targetInstanceId)) {
      const realCandidate = (plantInstances || []).find(
        (i) => i.plantId === selectedRentPlant.plantId && /^[0-9a-f-]{36}$/i.test(i.instanceId) && !i.isListed
      )
      if (realCandidate) {
        targetInstanceId = realCandidate.instanceId
      }
    }

    const split = calculateMarketplaceSplit(rentalListingPrice, comisionPct)

    showModalConfirm(
      '🤝 ¿PUBLICAR PLANTA EN ALQUILER?',
      `¿Deseas poner en alquiler tu carta "${selectedRentPlant.name}" (⭐${selectedRentPlant.level} · 🌱${selectedRentPlant.germinationsCount ?? 0}) por 7 días a un precio de ${rentalListingPrice} 💎?\n\n` +
        `• Inquilino pagará al instante: ${rentalListingPrice} 💎 por 7 días de alquiler.\n` +
        `• Comisión del mercado (${split.comisionPct}%): -${split.comision} 💎.\n` +
        `• Ganancia neta para ti (90%): +${split.neto} 💎 (se acreditan de inmediato a tu cuenta cuando la alquilen).\n\n` +
        `🔒 La carta sigue siendo 100% de tu propiedad. El inquilino no puede venderla ni fusionarla. Al expirar los 7 días, volverá automáticamente a tu Jardín si no tiene renovación automática activa con gemas.`,
      '🤝',
      () => {
        void handleConfirmListPlantForRent(targetInstanceId, rentalListingPrice)
      },
      `SÍ, PONER EN ALQUILER (${rentalListingPrice} 💎)`,
      'CANCELAR'
    )
  }

  const renderMyActiveSaleCard = (item: MyMarketplaceItem) => {
    const isGold = item.itemType === 'gold' || item.itemId === 'gold'
    const isFarming = !isGold && (item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]))
    const plantDef = !isGold && !isFarming && item.plantId ? PLANT_CONFIGS[item.plantId as PlantId] : undefined
    const farmingDef = isFarming && item.itemId ? FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId] : undefined

    const rInfo = !isGold && !isFarming && item.plantId
      ? getPlantRarityAndMinPrice(item.plantId as PlantId)
      : isFarming
      ? { rarity: 'FARMING', minPrice: 10, color: '#4ade80' }
      : { rarity: 'ORO P2P', minPrice: 1, color: '#facc15' }

    const isMineGolden = !isGold && !isFarming && Boolean((item as any).isGolden)
    const goldenAsset = isMineGolden && item.plantId ? GOLDEN_PLANT_ASSETS[item.plantId as PlantId] : null

    const itemName = isGold
      ? `${(item.quantity || 1).toLocaleString('en-US')} ORO`
      : isFarming
      ? (farmingDef?.label || item.itemId || 'Recurso')
      : isMineGolden
      ? `✨ ${plantDef?.name || item.plantId} (Dorada)`
      : (plantDef?.name || item.plantId || 'Carta de Planta')

    const itemIcon = isGold
      ? monedaImg
      : isFarming
      ? farmingDef?.icon
      : (goldenAsset?.sprite || plantDef?.packetActive || plantDef?.icon)

    const split = calculateMarketplaceSplit(item.precio, comisionPct)

    return (
      <div key={item.id} className={`market-my-card market-my-card--active ${isMineGolden ? 'market-item-card--golden' : ''}`}>
        <div className="market-item-card__header">
          {isGold ? (
            <span className="market-item-level-tag market-item-level-tag--gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <GoldIcon size={14} /> LOTE DE ORO
            </span>
          ) : isFarming ? (
            <span className="market-item-level-tag">
              🌾 LOTE x{item.quantity}
            </span>
          ) : (
            <div className="market-item-tags-row">
              {isMineGolden && (
                <span className="market-item-golden-badge" title="Carta Dorada (+10% Token PLANTS por partida)">
                  ✨ DORADA
                </span>
              )}
              <span className="market-item-level-tag" title={getFusionTooltip(item.nivel)}>
                ⭐{item.nivel}
              </span>
              <span
                className={`market-item-sprouts-tag market-item-sprouts-tag--${
                  (item.germinationsCount ?? 0) >= 2
                    ? 'max'
                    : (item.germinationsCount ?? 0) === 1
                    ? 'mid'
                    : 'fresh'
                }`}
                title={getSproutTooltip(item.germinationsCount ?? 0)}
              >
                🌱{item.germinationsCount ?? 0}
              </span>
            </div>
          )}

          <span className="market-item-rarity-badge" style={{ color: rInfo.color, borderColor: rInfo.color }}>
            {rInfo.rarity}
          </span>
          <span className="market-my-custody-tag">🛡️ EN CUSTODIA</span>
        </div>

        <div className="market-item-card__img-wrap">
          {itemIcon ? (
            <img src={itemIcon} alt={itemName} className="market-item-icon" />
          ) : (
            <span style={{ fontSize: '3rem' }}>{farmingDef?.fallback || '🌾'}</span>
          )}
        </div>

        <h4 className="market-item-name" style={{ color: isGold ? '#facc15' : '#ffffff' }}>
          {isFarming && (item.quantity || 1) > 1 ? `${item.quantity}x ${itemName}` : itemName}
        </h4>

        <div className="market-item-stats-box">
          {isGold ? (
            <span className="market-stat-pill market-stat-pill--gold">
              Tasa: ≈ {item.precio > 0 ? Math.round((item.quantity || 0) / item.precio).toLocaleString('en-US') : 0} Oro / 💎
            </span>
          ) : isFarming ? (
            <span className="market-stat-pill market-stat-pill--none">
              {farmingDef?.description || 'Recurso oficial de cultivo.'}
            </span>
          ) : item.statRolls && item.statRolls.length > 0 ? (
            formatStatRolls(item.statRolls)
          ) : (
            <span className="market-stat-pill market-stat-pill--none">Stats estándar de fábrica</span>
          )}
        </div>

        <div className="market-my-finance-box">
          <div className="market-my-finance-row">
            <span>Precio en venta:</span>
            <strong>{item.precio} 💎</strong>
          </div>
          <div className="market-my-finance-row">
            <span>Comisión ({split.comisionPct}%):</span>
            <span style={{ color: '#ef4444' }}>-{split.comision} 💎</span>
          </div>
          <div className="market-my-finance-row market-my-finance-row--net">
            <span>Cobrarás al venderse:</span>
            <strong style={{ color: '#4ade80' }}>+{split.neto} 💎 neto</strong>
          </div>
          <div className="market-my-finance-time">
            🕒 Publicado: {formatTxTime(item.desde)}
          </div>
        </div>

        <button
          type="button"
          className="market-recover-btn"
          onClick={() => handleCancelListing(item)}
          title="Recuperar de inmediato a tu inventario"
        >
          📦 RECUPERAR A MI INVENTARIO
        </button>
      </div>
    )
  }

  const renderMyClosedSaleCard = (item: MyMarketplaceItem) => {
    const isSold = item.status === 'sold'
    const isGold = item.itemType === 'gold' || item.itemId === 'gold'
    const isFarming = !isGold && (item.itemType === 'farming' || Boolean(item.itemId && FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId]))
    const plantDef = !isGold && !isFarming && item.plantId ? PLANT_CONFIGS[item.plantId as PlantId] : undefined
    const farmingDef = isFarming && item.itemId ? FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId] : undefined

    const itemName = isGold
      ? `${(item.quantity || 1).toLocaleString('en-US')} ORO`
      : isFarming
      ? (farmingDef?.label || item.itemId || 'Recurso')
      : (plantDef?.name || item.plantId || 'Carta de Planta')

    const itemIcon = isGold
      ? monedaImg
      : isFarming
      ? farmingDef?.icon
      : (plantDef?.packetActive || plantDef?.icon)

    return (
      <div key={item.id} className={`market-my-card ${isSold ? 'market-my-card--sold' : 'market-my-card--cancelled'}`}>
        <div className="market-item-card__header">
          <span className={`market-my-status-pill ${isSold ? 'market-my-status-pill--sold' : 'market-my-status-pill--cancelled'}`}>
            {isSold ? '✅ VENDIDO CON ÉXITO' : '⚪ RETIRADO (RECUPERADO)'}
          </span>
          <span className="market-tx-time">{formatTxTime(item.cerradaEn || item.desde)}</span>
        </div>

        <div className="market-my-closed-body">
          <div className="market-my-closed-img-wrap">
            {itemIcon ? (
              <img src={itemIcon} alt={itemName} className="market-my-closed-img" />
            ) : (
              <span style={{ fontSize: '2.5rem' }}>{farmingDef?.fallback || '🌾'}</span>
            )}
          </div>
          <div className="market-my-closed-info">
            <h4 className="market-my-closed-title">
              {isFarming && (item.quantity || 1) > 1 ? `${item.quantity}x ${itemName}` : itemName}
            </h4>
            {isSold ? (
              <>
                <div className="market-my-closed-buyer">
                  👤 Comprador: <strong>{item.comprador || 'Jugador'}</strong>
                </div>
                <div className="market-my-closed-net">
                  💰 Cobraste neto: <strong style={{ color: '#4ade80' }}>+{item.neto} 💎</strong> (Precio: {item.precio} 💎)
                </div>
              </>
            ) : (
              <div className="market-my-closed-cancelled-note">
                📦 Reincorporado con éxito a tu {isGold ? 'saldo de oro' : isFarming ? 'inventario de cultivo' : 'Jardín'}.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // PUBLICAR ORO EN EL MERCADO P2P
  const handleCreateGoldListing = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!canSell) {
      showModalConfirm(
        'VENTAS BLOQUEADAS',
        `Todos los jugadores pueden comprar en el mercado libremente.\n\nPara poner en venta oro o recursos necesitas el Pase PvP o alcanzar 1,350 Copas en la Arena.\n\nTus copas actuales: ${copasActuales} / 1,350.\n\n¿Deseas activar tu Pase PvP (${VIP_PASS_PRECIO_GEMAS} 💎) ahora?`,
        '🔒',
        () => {
          handleDirectBuyVip()
        },
        `ACTIVAR PASE PVP (${VIP_PASS_PRECIO_GEMAS} 💎)`,
        'CANCELAR'
      )
      return
    }

    const qty = Math.floor(goldSellQty)
    const price = Math.floor(goldSellPriceGems)

    if (qty < 100) {
      showModalAlert('CANTIDAD MÍNIMA', 'Debes vender al menos 100 Monedas de Oro.', '⚠️', 'warning')
      return
    }

    if (qty > userGold) {
      showModalAlert(
        'ORO INSUFICIENTE',
        `No posees suficiente oro. Tienes ${userGold.toLocaleString('en-US')} de Oro disponible en tu cuenta.`,
        '⚠️',
        'warning'
      )
      return
    }

    if (price < 1) {
      showModalAlert('PRECIO MÍNIMO', 'El precio total en gemas debe ser de al menos 1 💎.', '⚠️', 'warning')
      return
    }

    const split = calculateMarketplaceSplit(price, comisionPct)

    showModalConfirm(
      'PUBLICAR ORO EN EL MERCADO',
      `¿Confirmas poner en venta ${qty.toLocaleString('en-US')} Monedas de Oro por un precio total de ${price} 💎 gemas?\n\n` +
        `• El comprador pagará ${price} 💎 por el lote de ${qty.toLocaleString('en-US')} monedas de oro.\n` +
        `• Comisión del mercado: ${split.comisionPct}% (${split.comision} 💎).\n` +
        `• Recibirás el 90% neto: ${split.neto} 💎 cuando se compre tu oferta.\n\n` +
        `⚠️ Las ${qty.toLocaleString('en-US')} monedas de oro se descontarán de tu saldo de inmediato y quedarán en depósito seguro hasta que se vendan o retires la oferta.`,
      '💰',
      async () => {
        const r = await marketplaceService.listMarketplaceItem('gold', 'gold', price, qty)
        if (!r.success) {
          showModalAlert('NO SE PUDO PUBLICAR', r.error || 'Inténtalo de nuevo.', '⚠️', 'error')
          return
        }

        soundManager.playSound('plantation', 0.9)
        showModalAlert(
          '¡OFERTA DE ORO PUBLICADA!',
          `${qty.toLocaleString('en-US')} Monedas de Oro puestas en venta por ${price} 💎 en total.\nRecibirás ${split.neto} 💎 netos al concretarse la venta.`,
          '💰',
          'success'
        )
        setIsGoldModalOpen(false)
        setActiveTab('browse')
        setSelectedCategory('gold')
        await refreshListings()
        window.dispatchEvent(new Event('refresh_user_balance'))
        onServerChange?.()
      },
      `SÍ, VENDER ORO (${price} 💎)`,
      'CANCELAR'
    )
  }

  const handleDirectBuyVip = () => {
    showModalConfirm(
      'ACTIVAR PASE VIP',
      `¿Deseas pagar ${VIP_PASS_PRECIO_GEMAS} 💎 gemas para activar tu Pase VIP de Temporada?\nDesbloquearás el Mercado de Comercio y todas las recompensas exclusivas del Pase de Batalla.`,
      '👑',
      async () => {
        const { success, error } = await onBuyVipPass()
        if (success) {
          showModalAlert('¡PASE VIP ACTIVADO!', '¡Bienvenido a la Zona VIP!\nAhora tienes acceso total al Mercado para comprar y vender cartas libremente.', '🎉', 'success')
        } else {
          // Mensaje del servidor: distingue saldo insuficiente de "ya lo tienes".
          showModalAlert('NO SE PUDO ACTIVAR', error || 'El servidor rechazó la compra del pase VIP.', '⚠️', 'warning')
        }
      },
      `ACTIVAR (${VIP_PASS_PRECIO_GEMAS} 💎)`,
      'CANCELAR'
    )
  }

  const renderPlantOfferCard = (item: OfertaDelMercado) => {
    const isMine = item.esMia
    const isGolden = Boolean(item.isGolden)
    const plantDef = item.plantId ? PLANT_CONFIGS[item.plantId as PlantId] : undefined
    const goldenAsset = isGolden && item.plantId ? GOLDEN_PLANT_ASSETS[item.plantId as PlantId] : null
    const itemIcon = goldenAsset?.sprite || plantDef?.packetActive || plantDef?.icon
    const rInfo = item.plantId ? getPlantRarityAndMinPrice(item.plantId as PlantId) : { rarity: 'COMÚN' as PlantRarity, minPrice: 100, color: '#94a3b8' }
    const itemName = isGolden
      ? `✨ ${plantDef?.name || item.plantId} (Dorada)`
      : (plantDef?.name || item.plantId || 'Carta de Planta')

    return (
      <div key={item.id} className={`market-item-card ${isGolden ? 'market-item-card--golden' : ''}`}>
        {/* Card Header */}
        <div className="market-item-card__header">
          <div className="market-item-tags-row">
            {isGolden && (
              <span className="market-item-golden-badge" title="Carta Dorada (+10% Token PLANTS por partida)">
                ✨ DORADA
              </span>
            )}
            <span
              className="market-item-level-tag"
              title={getFusionTooltip(item.nivel)}
            >
              ⭐{item.nivel}
            </span>
            <span
              className={`market-item-sprouts-tag market-item-sprouts-tag--${
                (item.germinationsCount ?? 0) >= 2
                  ? 'max'
                  : (item.germinationsCount ?? 0) === 1
                  ? 'mid'
                  : 'fresh'
              }`}
              title={getSproutTooltip(item.germinationsCount ?? 0)}
            >
              🌱{item.germinationsCount ?? 0}
            </span>
          </div>
          {item.listingType === 'rental' ? (
            <span className="market-item-rental-badge">
              ⏳ ALQUILER (7D)
            </span>
          ) : (
            <span className="market-item-rarity-badge" style={{ color: rInfo.color, borderColor: rInfo.color }}>
              {rInfo.rarity}
            </span>
          )}
          <span className="market-item-seller">👤 {isMine ? 'TÚ' : item.vendedor ?? 'Jugador'}</span>
        </div>

        {/* Image and Name */}
        <div className="market-item-card__img-wrap">
          <img src={itemIcon} alt={itemName} className="market-item-icon" />
        </div>
        <h4 className="market-item-name">{itemName}</h4>

        {/* Stat Rolls Pills */}
        <div className="market-item-stats-box">
          {item.statRolls && item.statRolls.length > 0 ? (
            formatStatRolls(item.statRolls)
          ) : (
            <span className="market-stat-pill market-stat-pill--none">Stats estándar de fábrica</span>
          )}
        </div>

        {/* Price and Action Button */}
        <div className="market-item-card__footer">
          <div className="market-item-price-box">
            <span className="market-price-label">{item.listingType === 'rental' ? 'ALQUILER 7 DÍAS' : 'PRECIO'}</span>
            <span className="market-price-val">{item.precio} 💎</span>
          </div>

          {isMine ? (
            <button
              type="button"
              className="market-cancel-btn"
              onClick={() => handleCancelListing(item)}
            >
              RETIRAR
            </button>
          ) : item.listingType === 'rental' ? (
            <button
              type="button"
              className="market-buy-btn market-buy-btn--rent"
              onClick={() => {
                soundManager.playSound('click', 0.5)
                setRentPlantModal(item)
                setRentAutoRenew(false)
              }}
            >
              🤝 ALQUILAR
            </button>
          ) : (
            <button
              type="button"
              className="market-buy-btn"
              onClick={() => handleBuyListing(item)}
            >
              COMPRAR
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderFarmingOfferCard = (item: OfertaDelMercado) => {
    const isMine = item.esMia
    const farmingDef = item.itemId ? FARMING_ITEM_DEFINITIONS[item.itemId as FarmingItemId] : undefined
    const itemIcon = farmingDef?.icon
    const rInfo = { rarity: 'FARMING', minPrice: 10, color: '#4ade80' }
    const itemName = farmingDef?.label || item.itemId || 'Recurso'
    const itemQty = Math.max(1, Number(item.quantity) || 1)

    return (
      <div key={item.id} className="market-item-card">
        {/* Card Header */}
        <div className="market-item-card__header">
          <span className="market-item-level-tag">
            🌾 LOTE x{itemQty}
          </span>
          <span className="market-item-rarity-badge" style={{ color: rInfo.color, borderColor: rInfo.color }}>
            {rInfo.rarity}
          </span>
          <span className="market-item-seller">👤 {isMine ? 'TÚ' : item.vendedor ?? 'Jugador'}</span>
        </div>

        {/* Image and Name */}
        <div className="market-item-card__img-wrap">
          {itemIcon ? (
            <img
              src={itemIcon}
              alt={itemName}
              className="market-item-icon"
              onError={(e) => {
                const target = e.currentTarget
                target.style.display = 'none'
                if (target.parentElement) {
                  const span = document.createElement('span')
                  span.textContent = farmingDef?.fallback || '🌾'
                  span.style.fontSize = '3.5rem'
                  target.parentElement.appendChild(span)
                }
              }}
            />
          ) : (
            <span style={{ fontSize: '3.5rem' }}>{farmingDef?.fallback || '🌾'}</span>
          )}
        </div>
        <h4 className="market-item-name">
          {itemQty > 1 ? `${itemQty}x ${itemName}` : itemName}
        </h4>

        {/* Farming Description */}
        <div className="market-item-stats-box">
          <span className="market-stat-pill market-stat-pill--none">
            {farmingDef?.description || 'Recurso de cultivo.'}
          </span>
        </div>

        {/* Price and Action Button */}
        <div className="market-item-card__footer">
          <div className="market-item-price-box">
            <span className="market-price-label">{itemQty > 1 ? 'TOTAL LOTE' : 'PRECIO'}</span>
            <span className="market-price-val">{item.precio} 💎</span>
          </div>

          {isMine ? (
            <button
              type="button"
              className="market-cancel-btn"
              onClick={() => handleCancelListing(item)}
            >
              RETIRAR
            </button>
          ) : (
            <button
              type="button"
              className="market-buy-btn"
              onClick={() => handleBuyListing(item)}
            >
              COMPRAR
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderGoldOfferCard = (item: OfertaDelMercado) => {
    const isMine = item.esMia
    const goldQty = Math.max(1, Number(item.quantity) || 1)
    const ratePerGem = item.precio > 0 ? Math.round(goldQty / item.precio) : 0

    return (
      <div key={item.id} className="market-item-card market-item-card--gold">
        {/* Card Header */}
        <div className="market-item-card__header">
          <span className="market-item-level-tag market-item-level-tag--gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <GoldIcon size={14} /> LOTE DE ORO
          </span>
          <span className="market-item-rarity-badge market-item-rarity-badge--gold">
            ORO P2P
          </span>
          <span className="market-item-seller">👤 {isMine ? 'TÚ' : item.vendedor ?? 'Jugador'}</span>
        </div>

        {/* Image and Amount */}
        <div className="market-item-card__img-wrap market-item-card__img-wrap--gold">
          <img
            src={monedaImg}
            alt="Oro"
            className="market-gold-icon-img"
          />
        </div>

        <h4 className="market-item-name market-gold-item-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <GoldIcon size={20} /> {goldQty.toLocaleString('en-US')} ORO
        </h4>

        {/* Stat Rolls / Conversion Rate */}
        <div className="market-item-stats-box">
          <span className="market-stat-pill market-stat-pill--gold">
            Tasa: ≈ {ratePerGem.toLocaleString('en-US')} Oro por cada 1 💎
          </span>
        </div>

        {/* Price and Action Button */}
        <div className="market-item-card__footer">
          <div className="market-item-price-box">
            <span className="market-price-label">PRECIO TOTAL</span>
            <span className="market-price-val">{item.precio} 💎</span>
          </div>

          {isMine ? (
            <button
              type="button"
              className="market-cancel-btn"
              onClick={() => handleCancelListing(item)}
            >
              RETIRAR
            </button>
          ) : (
            <button
              type="button"
              className="market-buy-btn"
              onClick={() => handleBuyListing(item)}
            >
              COMPRAR
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="market-container">
      {/* ACCESS BANNER */}
      {canSell ? (
        <div className="market-vip-active-banner">
          {hasVipPass ? (
            <span className="market-vip-badge">👑 PASE PVP ACTIVO — COMPRA Y VENTA HABILITADAS</span>
          ) : (
            <span className="market-vip-badge">🏆 MAESTRÍA COMPETITIVA ({copasActuales} COPAS) — COMPRA Y VENTA HABILITADAS</span>
          )}
          <span>Compra y vende cartas con gemas. Al comprar se descuenta el 100%. Al vender recibes el 90% neto y el juego retiene el {comisionPct}% de comisión.</span>
        </div>
      ) : (
        <div className="market-vip-active-banner" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)', borderColor: '#10b981' }}>
          <span className="market-vip-badge" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>
            🛒 COMPRA LIBRE
          </span>
          <span style={{ fontSize: '11px', color: '#e2e8f0' }}>
            Todos los jugadores pueden comprar cartas e ítems en el mercado.
            {' '}🔒 <em>Para vender necesitas Pase PvP ({VIP_PASS_PRECIO_GEMAS} 💎) o 1,350 Copas ({copasActuales}/1,350).</em>
          </span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="market-nav-tabs">
        <button
          type="button"
          className="market-tab-back-btn"
          onClick={() => {
            soundManager.playSound('click', 0.5)
            onBackToMenu()
          }}
        >
          ⬅ MENÚ
        </button>
        <button
          type="button"
          className={`market-tab-btn market-tab-btn--my-sales ${activeTab === 'my_sales' ? 'market-tab-btn--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.5)
            setActiveTab('my_sales')
          }}
        >
          📦 ALQUILER Y VENTAS ({(mySalesData?.active?.length || 0) + (myRentalsSummary.myOfferedRentals.length || 0) + (myRentalsSummary.myBorrowedRentals.length || 0)})
        </button>
        <button
          type="button"
          className={`market-tab-btn ${activeTab === 'sell' ? 'market-tab-btn--active' : ''} ${!canSell ? 'market-tab-btn--locked' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.5)
            if (!canSell) {
              showModalConfirm(
                'VENTAS BLOQUEADAS',
                `Todos los jugadores pueden comprar en el mercado libremente.\n\nPara poner en venta cartas o recursos de tu Jardín necesitas el Pase PvP o alcanzar 1,350 Copas en la Arena.\n\nTus copas actuales: ${copasActuales} / 1,350.\n\n¿Deseas activar tu Pase PvP (${VIP_PASS_PRECIO_GEMAS} 💎) ahora?`,
                '🔒',
                () => {
                  handleDirectBuyVip()
                },
                `ACTIVAR PASE PVP (${VIP_PASS_PRECIO_GEMAS} 💎)`,
                'CANCELAR'
              )
              return
            }
            setActiveTab('sell')
          }}
          title={!canSell ? 'Requiere Pase PvP o 1,350 Copas para vender cartas' : 'Vender cartas de tu Jardín'}
        >
          {!canSell ? '🔒 VENDER (PASE PVP / 1,350 COPAS)' : '🏷️ VENDER'}
        </button>
        <button
          type="button"
          className={`market-tab-btn market-tab-btn--rent ${activeTab === 'rent' ? 'market-tab-btn--active' : ''} ${!canSell ? 'market-tab-btn--locked' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.5)
            if (!canSell) {
              showModalConfirm(
                'ALQUILER BLOQUEADO',
                `Para poner en alquiler cartas de tu Jardín necesitas el Pase PvP o alcanzar 1,350 Copas en la Arena.\n\nTus copas actuales: ${copasActuales} / 1,350.\n\n¿Deseas activar tu Pase PvP (${VIP_PASS_PRECIO_GEMAS} 💎) ahora?`,
                '🔒',
                () => {
                  handleDirectBuyVip()
                },
                `ACTIVAR PASE PVP (${VIP_PASS_PRECIO_GEMAS} 💎)`,
                'CANCELAR'
              )
              return
            }
            setActiveTab('rent')
          }}
          title={!canSell ? 'Requiere Pase PvP o 1,350 Copas para alquilar cartas' : 'Poner cartas de tu Jardín en alquiler para otros jugadores'}
        >
          {!canSell ? '🔒 ALQUILAR (PASE PVP / 1,350 COPAS)' : '🤝 ALQUILAR'}
        </button>
        <button
          type="button"
          className={`market-tab-btn ${activeTab === 'transactions' ? 'market-tab-btn--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.5)
            setActiveTab('transactions')
          }}
        >
          📜 TRANSACCIONES
        </button>
      </div>


      {/* TAB 1: BROWSE LISTINGS */}
      {activeTab === 'browse' && (
        <div className="market-browse-container">
          {sinServidor ? (
            <div className="market-empty-state">
              <span>
                🔌 El mercado necesita conexión con el servidor: es él quien mueve
                las gemas y las cartas. Vuelve a entrar cuando haya conexión.
              </span>
            </div>
          ) : cargando ? (
            <div className="market-empty-state"><span>Cargando ofertas…</span></div>
          ) : selectedCategory === null ? (
            /* SELECCIÓN PRINCIPAL DE LAS 3 CATEGORÍAS */
            <div className="market-categories-wrapper">
              <div className="market-categories-grid">
                {/* 1. PLANTAS */}
                <div
                  className="market-category-card market-category-card--plants"
                  onClick={() => {
                    soundManager.playSound('click', 0.5)
                    setSelectedCategory('plants')
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCategory('plants')
                  }}
                >
                  <div className="market-category-card__badge">
                    {plantOffers.length} {plantOffers.length === 1 ? 'oferta' : 'ofertas'}
                  </div>
                  <div className="market-category-card__icon-circle market-category-card__icon-circle--plants">
                    <span className="market-category-card__emoji">🌿</span>
                  </div>
                  <h4 className="market-category-card__title">Cartas de Plantas</h4>
                  <p className="market-category-card__desc">
                    Cartas jugables para combate con fusiones ⭐ y germinaciones 🌱 de otros entrenadores.
                  </p>
                  <div className="market-category-card__footer-action">
                    <span>EXPLORAR PLANTAS</span>
                    <span className="market-category-card__arrow">→</span>
                  </div>
                </div>

                {/* 2. RECURSOS */}
                <div
                  className="market-category-card market-category-card--farming"
                  onClick={() => {
                    soundManager.playSound('click', 0.5)
                    setSelectedCategory('farming')
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCategory('farming')
                  }}
                >
                  <div className="market-category-card__badge">
                    {farmingOffers.length} {farmingOffers.length === 1 ? 'oferta' : 'ofertas'}
                  </div>
                  <div className="market-category-card__icon-circle market-category-card__icon-circle--farming">
                    <span className="market-category-card__emoji">🌾</span>
                  </div>
                  <h4 className="market-category-card__title">Recursos de Cultivo</h4>
                  <p className="market-category-card__desc">
                    Lotes de agua 💧, fertilizantes 🌱 y fragmentos de herramientas para tu granja.
                  </p>
                  <div className="market-category-card__footer-action">
                    <span>EXPLORAR RECURSOS</span>
                    <span className="market-category-card__arrow">→</span>
                  </div>
                </div>

                {/* 3. ORO */}
                <div
                  className="market-category-card market-category-card--gold"
                  onClick={() => {
                    soundManager.playSound('click', 0.5)
                    setSelectedCategory('gold')
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedCategory('gold')
                  }}
                >
                  <div className="market-category-card__badge market-category-card__badge--gold">
                    {goldOffers.length} {goldOffers.length === 1 ? 'oferta' : 'ofertas'}
                  </div>
                  <div className="market-category-card__icon-circle market-category-card__icon-circle--gold">
                    <img src={monedaImg} alt="Oro" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                  </div>
                  <h4 className="market-category-card__title">
                    <GoldIcon size={18} /> Comercio de Oro
                  </h4>
                  <p className="market-category-card__desc">
                    Venta directa de Monedas de Oro por Gemas 💎. Vende tu oro o adquiere oro a precios competitivos.
                  </p>
                  <div className="market-category-card__footer-action">
                    <span>COMERCIAR ORO</span>
                    <span className="market-category-card__arrow">→</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* SUB-INTERFAZ DE CATEGORÍA SELECCIONADA */
            <div className="market-subcategory-container">
              <div className="market-subcategory-header">
                <button
                  type="button"
                  className="market-subcategory-back-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setSelectedCategory(null)
                  }}
                >
                  ← Volver a Categorías
                </button>

                <div className="market-subcategory-title-wrap">
                  <h3 className="market-subcategory-title">
                    {selectedCategory === 'plants' && `🌿 MERCADO DE PLANTAS (${plantOffers.length})`}
                    {selectedCategory === 'farming' && `🌾 RECURSOS DE CULTIVO (${farmingOffers.length})`}
                    {selectedCategory === 'gold' && (
                      <>
                        <GoldIcon size={20} /> COMERCIO DE ORO POR GEMAS ({goldOffers.length})
                      </>
                    )}
                  </h3>
                </div>

                <div className="market-subcategory-actions">
                  {selectedCategory === 'plants' && (
                    <>
                      <button
                        type="button"
                        className="market-sub-action-btn"
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setActiveTab('sell')
                          setSellCategory('plants')
                        }}
                      >
                        🏷️ Vender Planta
                      </button>
                      <button
                        type="button"
                        className="market-sub-action-btn market-sub-action-btn--rent"
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setActiveTab('rent')
                        }}
                      >
                        🤝 Alquilar Planta
                      </button>
                    </>
                  )}
                  {selectedCategory === 'farming' && (
                    <button
                      type="button"
                      className="market-sub-action-btn"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setActiveTab('sell')
                        setSellCategory('farming')
                      }}
                    >
                      ➕ Vender Recurso
                    </button>
                  )}
                  {selectedCategory === 'gold' && (
                    <button
                      type="button"
                      className="market-sub-action-btn market-sub-action-btn--gold"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setIsGoldModalOpen(true)
                      }}
                    >
                      <GoldIcon size={16} /> Vender mi Oro
                    </button>
                  )}
                </div>
              </div>

              {/* BARRA DE FILTROS Y BÚSQUEDA HORIZONTAL */}
              <div className="market-filter-toolbar">
                {/* 1. BUSCADOR POR TEXTO */}
                {selectedCategory !== 'gold' && (
                  <div className="market-search-box-wrap">
                    <span className="market-search-icon">🔍</span>
                    <input
                      type="text"
                      className="market-search-input"
                      placeholder={selectedCategory === 'plants' ? 'Buscar planta por nombre...' : 'Buscar recurso por nombre...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="market-search-clear-btn"
                        onClick={() => setSearchQuery('')}
                        title="Limpiar búsqueda"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* FILTRO TIPO DE OFERTA: COMPRA O ALQUILER (SOLO PARA PLANTAS) */}
                {selectedCategory === 'plants' && (
                  <div className="market-filter-listing-type-group">
                    <button
                      type="button"
                      className={`market-filter-pill-btn ${browseListingType === 'all' ? 'market-filter-pill-btn--active' : ''}`}
                      onClick={() => setBrowseListingType('all')}
                    >
                      🌿 Todas
                    </button>
                    <button
                      type="button"
                      className={`market-filter-pill-btn ${browseListingType === 'sale' ? 'market-filter-pill-btn--active' : ''}`}
                      onClick={() => setBrowseListingType('sale')}
                    >
                      🏷️ Compra
                    </button>
                    <button
                      type="button"
                      className={`market-filter-pill-btn ${browseListingType === 'rental' ? 'market-filter-pill-btn--active market-filter-pill-btn--rental' : ''}`}
                      onClick={() => setBrowseListingType('rental')}
                    >
                      🤝 Alquiler (7D)
                    </button>
                  </div>
                )}

                {/* 2. FILTRO SOLO MIS OFERTAS */}
                <button
                  type="button"
                  className={`market-filter-pill-btn ${filterOnlyMine ? 'market-filter-pill-btn--active' : ''}`}
                  onClick={() => setFilterOnlyMine(!filterOnlyMine)}
                  title="Mostrar únicamente las ofertas publicadas por ti"
                >
                  👤 Solo mis ofertas
                </button>

                {/* 3. FILTRO DE RAREZA (SOLO PARA PLANTAS) */}
                {selectedCategory === 'plants' && (
                  <div className="market-filter-select-wrap">
                    <span className="market-filter-select-label">Rareza:</span>
                    <select
                      className="market-filter-select"
                      value={rarityFilter}
                      onChange={(e) => setRarityFilter(e.target.value as any)}
                    >
                      <option value="all">Todas las rarezas</option>
                      <option value="COMÚN">Común</option>
                      <option value="RARA">Rara</option>
                      <option value="ÉPICA">Épica</option>
                      <option value="LEGENDARIA">Legendaria</option>
                    </select>
                  </div>
                )}

                {/* 4. ORDENAMIENTO */}
                <div className="market-filter-select-wrap">
                  <span className="market-filter-select-label">Ordenar:</span>
                  <select
                    className="market-filter-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                  >
                    <option value="newest">🕒 Más recientes</option>
                    <option value="price_asc">💎 Precio: Menor a Mayor</option>
                    <option value="price_desc">💎 Precio: Mayor a Menor</option>
                    {selectedCategory === 'plants' && (
                      <>
                        <option value="level_desc">⭐ Nivel de Fusión</option>
                        <option value="sprouts_asc">🌱 Germinaciones (Frescas)</option>
                      </>
                    )}
                    {selectedCategory === 'gold' && (
                      <option value="gold_rate">🪙 Mejor tasa (Oro / 💎)</option>
                    )}
                  </select>
                </div>

                {/* CONTADOR DE RESULTADOS */}
                <div className="market-filter-count-badge">
                  {selectedCategory === 'plants' && `${filteredPlantOffers.length} de ${plantOffers.length}`}
                  {selectedCategory === 'farming' && `${filteredFarmingOffers.length} de ${farmingOffers.length}`}
                  {selectedCategory === 'gold' && `${filteredGoldOffers.length} de ${goldOffers.length}`}
                </div>
              </div>

              {/* LISTA DE OFERTAS DE LA CATEGORÍA */}
              {selectedCategory === 'plants' && (
                plantOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span>🌿 No hay plantas en venta en este momento. ¡Sé el primero en publicar una carta!</span>
                  </div>
                ) : filteredPlantOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span>🔍 No se encontraron plantas con los filtros aplicados. Intenta cambiar la búsqueda o rareza.</span>
                  </div>
                ) : (
                  <div className="market-listings-grid">
                    {filteredPlantOffers.map(renderPlantOfferCard)}
                  </div>
                )
              )}

              {selectedCategory === 'farming' && (
                farmingOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span>🌾 No hay recursos de cultivo en venta en este momento. ¡Sé el primero en vender un lote!</span>
                  </div>
                ) : filteredFarmingOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span>🔍 No se encontraron recursos con los filtros aplicados.</span>
                  </div>
                ) : (
                  <div className="market-listings-grid">
                    {filteredFarmingOffers.map(renderFarmingOfferCard)}
                  </div>
                )
              )}

              {selectedCategory === 'gold' && (
                goldOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span><GoldIcon size={18} /> No hay ofertas de oro activas en este momento. ¡Sé el primero en vender tu oro por gemas!</span>
                  </div>
                ) : filteredGoldOffers.length === 0 ? (
                  <div className="market-empty-state">
                    <span>🔍 No se encontraron ofertas de oro con los filtros aplicados.</span>
                  </div>
                ) : (
                  <div className="market-listings-grid">
                    {filteredGoldOffers.map(renderGoldOfferCard)}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SELL MY PLANT, FARMING ITEM, OR GOLD */}
      {activeTab === 'sell' && canSell && (
        <div className="market-sell-pane">
          {/* SELECTOR DE CATEGORÍA PARA VENDER */}
          <div className="market-sell-category-selector">
            <button
              type="button"
              className={`market-sell-cat-btn ${sellCategory === 'plants' ? 'market-sell-cat-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSellCategory('plants')
              }}
            >
              🌿 Cartas de Plantas ({sellablePlants.length})
            </button>
            <button
              type="button"
              className={`market-sell-cat-btn ${sellCategory === 'farming' ? 'market-sell-cat-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSellCategory('farming')
              }}
            >
              🌾 Recursos de Cultivo ({sellableFarming.length})
            </button>
            <button
              type="button"
              className={`market-sell-cat-btn market-sell-cat-btn--gold ${sellCategory === 'gold' ? 'market-sell-cat-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setSellCategory('gold')
              }}
            >
              <GoldIcon size={16} /> Vender Oro ({userGold.toLocaleString('en-US')} disponible)
            </button>
          </div>

          {sellCategory === 'gold' ? (
            /* VENTA DE ORO DIRECTA */
            <div className="market-gold-sell-pane">
              <div className="market-gold-sell-card">
                <div className="market-gold-sell-header">
                  <div className="market-gold-sell-icon-wrap">
                    <img
                      src={monedaImg}
                      alt="Oro"
                      className="market-gold-icon-img-large"
                    />
                  </div>
                  <div>
                    <h3>COMERCIO P2P: VENDER ORO POR GEMAS</h3>
                    <p>Define la cantidad de Oro que deseas vender y el precio total en Gemas 💎 que deseas recibir.</p>
                    <div className="market-gold-balance-pill">
                      💰 Saldo disponible: <strong>{userGold.toLocaleString('en-US')} Oro</strong>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCreateGoldListing} className="market-gold-form">
                  <div className="market-gold-field-group">
                    <label>
                      1. Cantidad de Oro a Vender:
                      <span className="market-gold-min-tag">Mínimo: 100 Oro</span>
                    </label>
                    <div className="market-gold-input-row">
                      <span className="market-gold-input-prefix"><GoldIcon size={18} /></span>
                      <input
                        type="number"
                        step="100"
                        min={100}
                        max={userGold}
                        value={goldSellQty}
                        onChange={(e) => setGoldSellQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="market-gold-input"
                        required
                      />
                      <span className="market-gold-input-suffix">Oro</span>
                    </div>
                    <div className="market-price-shortcuts" style={{ marginTop: '8px' }}>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(500)}>500</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(1000)}>1,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(5000)}>5,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(10000)}>10,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(userGold)}>MÁX ({userGold.toLocaleString('en-US')})</button>
                    </div>
                  </div>

                  <div className="market-gold-field-group" style={{ marginTop: '14px' }}>
                    <label>
                      2. Precio Total en Gemas 💎:
                      <span className="market-gold-min-tag">Mínimo: 1 💎</span>
                    </label>
                    <div className="market-gold-input-row">
                      <span className="market-gold-input-prefix">💎</span>
                      <input
                        type="number"
                        step="1"
                        min={1}
                        max={99999}
                        value={goldSellPriceGems}
                        onChange={(e) => setGoldSellPriceGems(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="market-gold-input"
                        required
                      />
                      <span className="market-gold-input-suffix">Gemas</span>
                    </div>
                    <div className="market-price-shortcuts" style={{ marginTop: '8px' }}>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(5)}>5 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(10)}>10 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(25)}>25 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(50)}>50 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(100)}>100 💎</button>
                    </div>
                  </div>

                  <div className="market-gold-summary-card" style={{ marginTop: '16px' }}>
                    <div className="market-gold-summary-row">
                      <span>Tasa calculada:</span>
                      <strong>≈ {goldSellPriceGems > 0 ? Math.round(goldSellQty / goldSellPriceGems).toLocaleString('en-US') : 0} Oro por 1 💎</strong>
                    </div>
                    <div className="market-gold-summary-row">
                      <span>Comisión de Mercado ({comisionPct}%):</span>
                      <span style={{ color: '#ef4444' }}>-{calculateMarketplaceSplit(goldSellPriceGems, comisionPct).comision} 💎</span>
                    </div>
                    <div className="market-gold-summary-row market-gold-summary-row--total">
                      <span>Recibirás neto al venderse:</span>
                      <strong style={{ color: '#4ade80', fontSize: '15px' }}>{calculateMarketplaceSplit(goldSellPriceGems, comisionPct).neto} 💎</strong>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={goldSellQty < 100 || goldSellQty > userGold || goldSellPriceGems < 1}
                    className="market-publish-btn"
                    style={{ marginTop: '16px' }}
                  >
                    {goldSellQty > userGold ? (
                      '🛑 ORO INSUFICIENTE EN TU CUENTA'
                    ) : (
                      <>
                        <GoldIcon size={18} /> PUBLICAR {goldSellQty.toLocaleString('en-US')} ORO POR {goldSellPriceGems} 💎 (NETO {calculateMarketplaceSplit(goldSellPriceGems, comisionPct).neto} 💎)
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              {/* BANNER INFORMATIVO */}
              {sellCategory === 'plants' ? (
                <div className="market-sell-info-banner">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <strong style={{ color: '#fbbf24', fontSize: '11px', letterSpacing: '0.5px' }}>
                      INFORMACIÓN IMPORTANTE SOBRE LA VENTA DE PLANTAS
                    </strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.45', color: '#cbd5e1' }}>
                    <li>
                      <strong>Vendes tu planta jugable, NO copias:</strong> Las copias NO se venden en el mercado. Las copias solo se consiguen en sobres/recompensas y se usan exclusivamente para <strong>Fusión y mejoras (+15% stats)</strong>.
                    </li>
                    <li>
                      <strong>Se retira de tu Mazo y Jardín:</strong> Mientras tu planta esté publicada o si otro jugador la compra, no podrás usarla en batallas.
                    </li>
                    <li>
                      <strong>Mínimo 3 plantas requeridas:</strong> Debes conservar al menos 3 cartas de plantas en tu inventario para poder combatir en la Arena.
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="market-sell-info-banner" style={{ borderColor: '#38bdf8', background: 'rgba(14, 165, 233, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🌾</span>
                    <strong style={{ color: '#38bdf8', fontSize: '11px', letterSpacing: '0.5px' }}>
                      VENTA DE RECURSOS DE CULTIVO EN LOTES
                    </strong>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.45', color: '#cbd5e1' }}>
                    <li>
                      <strong>Venta por Lote Completo:</strong> El comprador pagará el precio fijado y recibirá todas las unidades del lote.
                    </li>
                    <li>
                      <strong>Depósito seguro:</strong> Los recursos se descuentan de tu inventario mientras estén en venta y se te devuelven si retiras la oferta.
                    </li>
                  </ul>
                </div>
              )}

              <div className="market-sell-form-grid">
                {/* Column 1: Select Item to Sell */}
                <div className="market-sell-column">
                  <label className="market-sell-label">
                    1. Elige la Carta o Ítem a Vender ({displayedSellableItems.length} disponibles)
                  </label>
                  <div className="market-garden-cards-list">
                    {displayedSellableItems.length === 0 ? (
                      <div className="market-empty-state">
                        <span>No tienes {sellCategory === 'plants' ? 'cartas de plantas' : 'recursos de cultivo'} disponibles para vender.</span>
                      </div>
                    ) : (
                      displayedSellableItems.map((item) => {
                    const isSelected = selectedItemId === item.id

                    if (item.kind === 'farming') {
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className={`market-garden-card-item ${isSelected ? 'market-garden-card-item--active' : ''}`}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setSelectedItemId(item.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              setSelectedItemId(item.id)
                            }
                          }}
                        >
                          <img
                            src={item.icon}
                            alt={item.name}
                            className="market-garden-card-item__img"
                            onError={(e) => {
                              const target = e.currentTarget
                              target.style.display = 'none'
                              if (target.parentElement) {
                                const span = document.createElement('span')
                                span.textContent = item.fallbackIcon
                                span.style.fontSize = '2.5rem'
                                target.parentElement.appendChild(span)
                              }
                            }}
                          />
                          <div className="market-garden-card-item__info">
                            <div className="market-garden-card-item__header">
                              <span className="market-item-level-tag">
                                🌾 DISP: {item.availableQty}
                              </span>
                              <span
                                className="market-rarity-pill"
                                style={{ color: item.rarityColor, borderColor: item.rarityColor }}
                              >
                                {item.rarity}
                              </span>
                            </div>
                            <strong className="market-garden-card-item__name">
                              {item.name}
                            </strong>
                            <div className="market-garden-card-item__stats">
                              <span className="market-stat-pill market-stat-pill--none">
                                {item.description}
                              </span>
                            </div>
                          </div>
                          <div className="market-garden-card-item__price-badge">
                            Mín: {item.minPrice} 💎
                          </div>
                        </div>
                      )
                    }

                    // Kind === 'plant'
                    const pConfig = PLANT_CONFIGS[item.plantId]
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        className={`market-garden-card-item ${isSelected ? 'market-garden-card-item--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setSelectedItemId(item.id)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedItemId(item.id)
                          }
                        }}
                      >
                        <img
                          src={pConfig?.packetActive || pConfig?.icon}
                          alt={pConfig?.name || item.plantId}
                          className="market-garden-card-item__img"
                        />
                        <div className="market-garden-card-item__info">
                          <div className="market-garden-card-item__header">
                            <div className="market-item-tags-row">
                              <span
                                className="market-item-level-tag"
                                title={getFusionTooltip(item.level)}
                              >
                                ⭐{item.level}
                              </span>
                              <span
                                className={`market-item-sprouts-tag market-item-sprouts-tag--${
                                  (item.germinationsCount ?? 0) >= 2
                                    ? 'max'
                                    : (item.germinationsCount ?? 0) === 1
                                    ? 'mid'
                                    : 'fresh'
                                }`}
                                title={getSproutTooltip(item.germinationsCount ?? 0)}
                              >
                                🌱{item.germinationsCount ?? 0}
                              </span>
                            </div>
                            <span
                              className="market-rarity-pill"
                              style={{ color: item.rarityColor, borderColor: item.rarityColor }}
                            >
                              {item.rarity}
                            </span>
                            {item.inDeck && (
                              <span className="market-deck-tag">⚔️ EN MAZO</span>
                            )}
                          </div>
                          <strong className="market-garden-card-item__name">
                            {pConfig?.name || item.plantId}
                          </strong>
                          <div className="market-garden-card-item__stats">
                            {item.statRolls && item.statRolls.length > 0 ? (
                              formatStatRolls(item.statRolls)
                            ) : (
                              <span className="market-stat-pill market-stat-pill--none">Stats estándar</span>
                            )}
                          </div>
                        </div>
                        <div className="market-garden-card-item__price-badge">
                          Mín: {item.minPrice} 💎
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Column 2: Configure Price & Publish */}
            <div className="market-sell-column market-sell-column--summary">
              <label className="market-sell-label">2. Fijar Precio y Confirmar Venta</label>

              {selectedItem && (
                <form className="market-sell-preview-card" onSubmit={handleCreateListing}>
                  <div className="market-sell-preview-header">
                    {selectedItem.kind === 'farming' ? (
                      <span className="market-item-level-tag">
                        🌾 DISP ({selectedItem.availableQty})
                      </span>
                    ) : (
                      <div className="market-item-tags-row">
                        <span
                          className="market-item-level-tag"
                          title={getFusionTooltip(selectedItem.level)}
                        >
                          ⭐{selectedItem.level}
                        </span>
                        <span
                          className={`market-item-sprouts-tag market-item-sprouts-tag--${
                            (selectedItem.germinationsCount ?? 0) >= 2
                              ? 'max'
                              : (selectedItem.germinationsCount ?? 0) === 1
                              ? 'mid'
                              : 'fresh'
                          }`}
                          title={getSproutTooltip(selectedItem.germinationsCount ?? 0)}
                        >
                          🌱{selectedItem.germinationsCount ?? 0}
                        </span>
                      </div>
                    )}
                    <span
                      className="market-rarity-pill"
                      style={{ color: selectedItem.rarityColor, borderColor: selectedItem.rarityColor }}
                    >
                      {selectedItem.rarity} (Mín {selectedItem.minPrice} 💎)
                    </span>
                  </div>

                  {selectedItem.kind === 'farming' ? (
                    <>
                      <img
                        src={selectedItem.icon}
                        alt={selectedItem.name}
                        className="market-preview-icon"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.style.display = 'none'
                          if (target.parentElement) {
                            const span = document.createElement('span')
                            span.textContent = selectedItem.fallbackIcon
                            span.style.fontSize = '4rem'
                            target.parentElement.appendChild(span)
                          }
                        }}
                      />
                      <h4>{selectedItem.name}</h4>
                      <div className="market-item-stats-box">
                        <span className="market-stat-pill market-stat-pill--none">
                          {selectedItem.description}
                        </span>
                      </div>

                      {/* Selector de cantidad para lote de farming */}
                      <div className="market-price-input-group" style={{ marginTop: '10px', marginBottom: '14px' }}>
                        <label>
                          Cantidad a Vender en el Lote —{' '}
                          <span style={{ color: '#4ade80' }}>Disponible: {selectedItem.availableQty}</span>
                        </label>
                        <div className="market-price-stepper-wrap">
                          <button
                            type="button"
                            className="market-stepper-btn"
                            disabled={sellQuantity <= 1}
                            onClick={() => setSellQuantity((q) => Math.max(1, q - 1))}
                            title="Restar 1"
                          >
                            -
                          </button>
                          <div className="market-price-input-wrap">
                            <span>🌾</span>
                            <input
                              type="number"
                              step="1"
                              min={1}
                              max={selectedItem.availableQty}
                              value={sellQuantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1
                                setSellQuantity(Math.max(1, Math.min(selectedItem.availableQty, val)))
                              }}
                              required
                            />
                            <span>unid.</span>
                          </div>
                          <button
                            type="button"
                            className="market-stepper-btn"
                            disabled={sellQuantity >= selectedItem.availableQty}
                            onClick={() => setSellQuantity((q) => Math.min(selectedItem.availableQty, q + 1))}
                            title="Sumar 1"
                          >
                            +
                          </button>
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
                          Elige la cantidad exacta a vender (máximo disponible: <strong style={{ color: '#4ade80' }}>{selectedItem.availableQty} unid.</strong>)
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={
                          PLANT_CONFIGS[selectedItem.plantId]?.packetActive ||
                          PLANT_CONFIGS[selectedItem.plantId]?.icon
                        }
                        alt=""
                        className="market-preview-icon"
                      />
                      <h4>{PLANT_CONFIGS[selectedItem.plantId]?.name}</h4>

                      <div className="market-plant-notice-box">
                        🌱 <strong>Venderás tu carta jugable</strong>, no copias. Las copias solo se usan para Fusión (+15% stats).
                      </div>

                      {selectedItem.inDeck && (
                        <div className="market-deck-warning market-deck-warning--danger">
                          🛑 Esta planta está en tu mazo de batalla. Desequípala tú mismo en Mi Jardín antes de ponerla en venta.
                        </div>
                      )}

                      {availablePlantsCount <= 3 && (
                        <div className="market-deck-warning market-deck-warning--danger">
                          🛑 No puedes vender esta planta: necesitas conservar al menos 3 plantas para poder combatir en la Arena.
                        </div>
                      )}

                      <div className="market-item-stats-box">
                        {selectedItem.statRolls && selectedItem.statRolls.length > 0 ? (
                          formatStatRolls(selectedItem.statRolls)
                        ) : (
                          <span className="market-stat-pill market-stat-pill--none">Stats estándar de fábrica</span>
                        )}
                      </div>
                    </>
                  )}

                  {/* Price Setting with Steppers */}
                  <div className="market-price-input-group">
                    <label>
                      {selectedItem.kind === 'farming'
                        ? `Precio Total del Lote (${sellQuantity}x ${selectedItem.name}) — `
                        : 'Precio de Venta (💎 gemas) — '}
                      <span style={{ color: '#fde047' }}>Mínimo: {selectedItem.minPrice} 💎</span>
                    </label>
                    <div className="market-price-stepper-wrap">
                      <button
                        type="button"
                        className="market-stepper-btn"
                        disabled={sellPriceGems <= selectedItem.minPrice}
                        onClick={() => setSellPriceGems((p) => Math.max(selectedItem.minPrice, p - 1))}
                        title="Bajar 1 gema"
                      >
                        -
                      </button>

                      <div className="market-price-input-wrap">
                        <span>💎</span>
                        <input
                          type="number"
                          step="1"
                          min={selectedItem.minPrice}
                          max="99999"
                          value={sellPriceGems}
                          onChange={(e) => setSellPriceGems(Math.max(0, Number(e.target.value)))}
                          required
                        />
                        <span>gemas</span>
                      </div>

                      <button
                        type="button"
                        className="market-stepper-btn"
                        onClick={() => setSellPriceGems((p) => p + 1)}
                        title="Subir 1 gema"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick Price Shortcuts */}
                    <div className="market-price-shortcuts">
                      <button
                        type="button"
                        className="market-shortcut-btn"
                        onClick={() => setSellPriceGems(selectedItem.minPrice)}
                      >
                        MÍN ({selectedItem.minPrice} 💎)
                      </button>
                      <button
                        type="button"
                        className="market-shortcut-btn"
                        onClick={() => setSellPriceGems((p) => p + 25)}
                      >
                        +25 💎
                      </button>
                      <button
                        type="button"
                        className="market-shortcut-btn"
                        onClick={() => setSellPriceGems((p) => p + 50)}
                      >
                        +50 💎
                      </button>
                      <button
                        type="button"
                        className="market-shortcut-btn"
                        onClick={() => setSellPriceGems((p) => p + 100)}
                      >
                        +100 💎
                      </button>
                    </div>

                    {selectedItem.kind === 'farming' && sellQuantity > 1 && (
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', textAlign: 'center' }}>
                        ≈ {(sellPriceGems / sellQuantity).toFixed(1)} 💎 por unidad
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !canSell ||
                      sellPriceGems < selectedItem.minPrice ||
                      (selectedItem.kind === 'plant' && (availablePlantsCount <= 3 || selectedItem.inDeck))
                    }
                    className={`market-publish-btn ${
                      !canSell ||
                      (selectedItem.kind === 'plant' && (availablePlantsCount <= 3 || selectedItem.inDeck))
                        ? 'market-publish-btn--locked'
                        : ''
                    }`}
                    title={
                      !canSell
                        ? 'Requiere Pase PvP o 1,350 Copas para vender en el mercado'
                        : selectedItem.kind === 'plant' && selectedItem.inDeck
                        ? 'Esta planta está en tu mazo de batalla. Desequípala tú mismo en Mi Jardín antes de ponerla en venta'
                        : selectedItem.kind === 'plant' && availablePlantsCount <= 3
                        ? 'Debes conservar al menos 3 plantas para poder jugar'
                        : undefined
                    }
                  >
                    {!canSell
                      ? '🔒 REQUIERE PASE PVP O 1,350 COPAS'
                      : selectedItem.kind === 'plant' && selectedItem.inDeck
                      ? '🛑 DESEQUÍPALA EN MI JARDÍN PARA VENDER'
                      : selectedItem.kind === 'plant' && availablePlantsCount <= 3
                      ? '🛑 MÍNIMO 3 PLANTAS REQUERIDAS PARA JUGAR'
                      : selectedItem.kind === 'farming' && sellQuantity > 1
                      ? `🏷️ PUBLICAR LOTE (${sellQuantity}x) POR ${sellPriceGems} 💎 · neto ${calculateMarketplaceSplit(sellPriceGems, comisionPct).neto} 💎`
                      : `🏷️ PUBLICAR POR ${sellPriceGems} 💎 · neto ${calculateMarketplaceSplit(sellPriceGems, comisionPct).neto} 💎`}
                  </button>

                  {!canSell && (
                    <button
                      type="button"
                      className="market-vip-unlock-cta"
                      onClick={handleDirectBuyVip}
                    >
                      👑 Activar Pase PvP ({VIP_PASS_PRECIO_GEMAS} 💎) o alcanza 1,350 Copas ({copasActuales}/1350)
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {/* TAB: ALQUILAR CARTA (P2P RENTAL) */}
      {activeTab === 'rent' && canSell && (
        <div className="market-sell-pane market-rent-pane">
          {/* Header explicativo */}
          <div className="market-rent-header-banner">
            <div className="market-rent-header-badge">🤝 SISTEMA DE ALQUILER P2P</div>
            <h3>Pon tus Cartas en Alquiler por 7 Días</h3>
            <p>
              Genera ingresos pasivos en Gemas 💎 prestando tus cartas a otros jugadores.
              Recibes el 90% neto de forma inmediata en cuanto otro jugador alquile tu carta.
              Tú conservas la propiedad en todo momento y no puede ser vendida ni transferida.
            </p>
          </div>

          {rentEligiblePlants.length === 0 ? (
            <div className="market-empty-state">
              <span>
                🌱 No tienes cartas de plantas disponibles para alquilar.
                Las cartas que estén en tu mazo de batalla o que ya hayas alquilado a otros no se pueden alquilar hasta que las desequipes.
              </span>
            </div>
          ) : (
            <div className="market-sell-columns-wrap">
              {/* Columna 1: Selección de Planta */}
              <div className="market-sell-column market-sell-column--inventory">
                <label className="market-sell-label">
                  1. Elige la Carta a Alquilar ({rentEligiblePlants.length} disponibles)
                </label>
                <div className="market-sell-items-grid">
                  {rentEligiblePlants.map((item) => {
                    const isSelected = selectedRentPlant?.instanceId === item.instanceId
                    const pConfig = PLANT_CONFIGS[item.plantId]
                    return (
                      <div
                        key={item.instanceId}
                        role="button"
                        tabIndex={0}
                        className={`market-garden-card-item ${isSelected ? 'market-garden-card-item--active' : ''} ${item.inDeck ? 'market-garden-card-item--in-deck' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setSelectedRentPlantInstanceId(item.instanceId)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelectedRentPlantInstanceId(item.instanceId)
                          }
                        }}
                      >
                        <img
                          src={pConfig?.packetActive || pConfig?.icon}
                          alt={pConfig?.name || item.plantId}
                          className="market-garden-card-item__img"
                        />
                        <div className="market-garden-card-item__info">
                          <div className="market-garden-card-item__header">
                            <div className="market-item-tags-row">
                              <span className="market-item-level-tag">⭐{item.level}</span>
                              <span className="market-item-sprouts-tag">🌱{item.germinationsCount ?? 0}</span>
                            </div>
                            <span
                              className="market-rarity-pill"
                              style={{ color: item.rarityColor, borderColor: item.rarityColor }}
                            >
                              {item.rarity}
                            </span>
                            {item.inDeck && <span className="market-deck-tag">⚔️ EN MAZO</span>}
                          </div>
                          <strong className="market-garden-card-item__name">
                            {pConfig?.name || item.plantId}
                          </strong>
                          <div className="market-garden-card-item__stats">
                            {item.statRolls && item.statRolls.length > 0 ? (
                              formatStatRolls(item.statRolls)
                            ) : (
                              <span className="market-stat-pill market-stat-pill--none">Stats estándar</span>
                            )}
                          </div>
                        </div>
                        <div className="market-garden-card-item__price-badge" style={{ color: '#38bdf8', borderColor: '#38bdf8' }}>
                          ⏳ 7 DÍAS
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Columna 2: Configurar Precio y Publicar */}
              <div className="market-sell-column market-sell-column--summary">
                <label className="market-sell-label">2. Fijar Precio y Confirmar Alquiler</label>
                {selectedRentPlant && (
                  <form className="market-sell-preview-card" onSubmit={handleListRentSubmit}>
                    <div className="market-sell-preview-header">
                      <div className="market-item-tags-row">
                        <span className="market-item-level-tag">⭐{selectedRentPlant.level}</span>
                        <span className="market-item-sprouts-tag">🌱{selectedRentPlant.germinationsCount ?? 0}</span>
                      </div>
                      <span className="market-item-rental-badge">⏳ 7 DÍAS DE DURACIÓN</span>
                    </div>

                    <img
                      src={
                        PLANT_CONFIGS[selectedRentPlant.plantId]?.packetActive ||
                        PLANT_CONFIGS[selectedRentPlant.plantId]?.icon
                      }
                      alt=""
                      className="market-preview-icon"
                    />
                    <h4>{PLANT_CONFIGS[selectedRentPlant.plantId]?.name}</h4>

                    <div className="market-plant-notice-box" style={{ borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(56, 189, 248, 0.08)' }}>
                      🤝 <strong>Alquilarás tu carta jugable por 7 días.</strong> El inquilino la podrá usar en sus batallas. Tú conservas la propiedad y no puede ser vendida ni transferida.
                    </div>

                    {selectedRentPlant.inDeck && (
                      <div className="market-deck-warning market-deck-warning--danger">
                        🛑 Esta planta está en tu mazo de batalla. Desequípala en Mi Jardín antes de ponerla en alquiler.
                      </div>
                    )}

                    {availablePlantsCount <= 3 && (
                      <div className="market-deck-warning market-deck-warning--danger">
                        🛑 No puedes alquilar esta planta: necesitas conservar al menos 3 plantas para poder combatir en la Arena.
                      </div>
                    )}

                    <div className="market-item-stats-box">
                      {selectedRentPlant.statRolls && selectedRentPlant.statRolls.length > 0 ? (
                        formatStatRolls(selectedRentPlant.statRolls)
                      ) : (
                        <span className="market-stat-pill market-stat-pill--none">Stats estándar de fábrica</span>
                      )}
                    </div>

                    {/* Selector de Precio en Gemas */}
                    <div className="market-price-input-group">
                      <label>
                        Precio de Alquiler (💎 Gemas por 7 días) —{' '}
                        <span style={{ color: '#38bdf8' }}>Mínimo: 20 💎</span>
                      </label>
                      <div className="market-price-stepper-wrap">
                        <button
                          type="button"
                          className="market-stepper-btn"
                          disabled={rentalListingPrice <= 20}
                          onClick={() => setRentalListingPrice((p) => Math.max(20, p - 5))}
                        >
                          -
                        </button>
                        <div className="market-price-input-wrap">
                          <span>💎</span>
                          <input
                            type="number"
                            step="5"
                            min={20}
                            max={99999}
                            value={rentalListingPrice}
                            onChange={(e) => setRentalListingPrice(Math.max(20, parseInt(e.target.value, 10) || 20))}
                            required
                          />
                          <span>Gemas / 7d</span>
                        </div>
                        <button
                          type="button"
                          className="market-stepper-btn"
                          onClick={() => setRentalListingPrice((p) => p + 5)}
                        >
                          +
                        </button>
                      </div>

                      <div className="market-price-shortcuts">
                        <button type="button" className="market-shortcut-btn" onClick={() => setRentalListingPrice(20)}>20 💎</button>
                        <button type="button" className="market-shortcut-btn" onClick={() => setRentalListingPrice(50)}>50 💎</button>
                        <button type="button" className="market-shortcut-btn" onClick={() => setRentalListingPrice(100)}>100 💎</button>
                        <button type="button" className="market-shortcut-btn" onClick={() => setRentalListingPrice(200)}>200 💎</button>
                      </div>
                    </div>

                    {/* Desglose de Comisión y Neto */}
                    <div className="market-gold-summary-card" style={{ margin: '10px 0' }}>
                      <div className="market-gold-summary-row">
                        <span>Inquilino pagará:</span>
                        <strong>{rentalListingPrice} 💎</strong>
                      </div>
                      <div className="market-gold-summary-row">
                        <span>Comisión del mercado ({comisionPct}%):</span>
                        <span style={{ color: '#ef4444' }}>-{calculateMarketplaceSplit(rentalListingPrice, comisionPct).comision} 💎</span>
                      </div>
                      <div className="market-gold-summary-row market-gold-summary-row--total">
                        <span>Recibirás neto de inmediato:</span>
                        <strong style={{ color: '#4ade80', fontSize: '14px' }}>+{calculateMarketplaceSplit(rentalListingPrice, comisionPct).neto} 💎</strong>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        !canSell ||
                        rentalListingPrice < 20 ||
                        selectedRentPlant.inDeck ||
                        availablePlantsCount <= 3 ||
                        isSubmittingRental
                      }
                      className={`market-publish-btn ${
                        !canSell || selectedRentPlant.inDeck || availablePlantsCount <= 3
                          ? 'market-publish-btn--locked'
                          : ''
                      }`}
                      style={{
                        background: canSell && !selectedRentPlant.inDeck && availablePlantsCount > 3
                          ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                          : undefined
                      }}
                    >
                      {isSubmittingRental
                        ? '⏳ PUBLICANDO...'
                        : selectedRentPlant.inDeck
                        ? '🛑 DESEQUÍPALA EN MI JARDÍN'
                        : availablePlantsCount <= 3
                        ? '🛑 MÍNIMO 3 PLANTAS REQUERIDAS'
                        : `🤝 PONER EN ALQUILER (${rentalListingPrice} 💎 / 7 DÍAS)`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SELL & RENT LOCKED BANNER: cuando el usuario está en la pestaña VENDER o ALQUILAR pero no tiene permisos */}
      {(activeTab === 'sell' || activeTab === 'rent') && !canSell && (
        <div className="market-vip-lock-banner" style={{ margin: '20px auto', maxWidth: '750px' }}>
          <div className="market-vip-lock-icon">🔒</div>
          <div className="market-vip-lock-info">
            <h3>{activeTab === 'rent' ? 'ALQUILER BLOQUEADO: ¡ALCANZA 1,350 COPAS O ACTIVA PASE PVP!' : 'VENTAS BLOQUEADAS: ¡ALCANZA 1,350 COPAS O ACTIVA PASE PVP!'}</h3>
            <p>
              Todos los jugadores pueden comprar y alquilar ofertas en el mercado libremente. Para <strong>{activeTab === 'rent' ? 'poner en alquiler cartas de tu Jardín' : 'poner en venta cartas o recursos de tu Jardín'}</strong> necesitas: <strong>alcanzar 1,350 Copas</strong> compitiendo gratis en la Arena, o <strong>activar el Pase PvP ({VIP_PASS_PRECIO_GEMAS} 💎)</strong> para desbloqueo inmediato.
            </p>
            <div className="market-copas-progress-wrap">
              <span className="market-copas-progress-text">
                🏆 Tu rango: <strong>{copasActuales}</strong> / 1,350 Copas
                {copasActuales < 1350 ? ` (faltan ${1350 - copasActuales} copas)` : ' (¡Meta alcanzada!)'}
              </span>
              <div className="market-copas-progress-bar">
                <div
                  className="market-copas-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(0, Math.round((copasActuales / 1350) * 100)))}%` }}
                />
              </div>
            </div>
          </div>
          <button className="market-vip-buy-btn" type="button" onClick={handleDirectBuyVip}>
            👑 ACTIVAR PASE PVP ({VIP_PASS_PRECIO_GEMAS} 💎)
          </button>
        </div>
      )}

      {/* TAB 4: ALQUILER Y VENTAS (MY LISTINGS, RENTALS & ESCROW) */}
      {activeTab === 'my_sales' && (
        <div className="market-my-sales-container">
          {/* Ribbon de Métricas Horizontales */}
          <div className="market-my-sales-ribbon">
            <div className="market-my-sales-stat-card market-my-sales-stat-card--active">
              <span className="market-my-sales-stat-icon">🛡️</span>
              <div className="market-my-sales-stat-info">
                <span className="market-my-sales-stat-label">EN VENTA</span>
                <span className="market-my-sales-stat-value">
                  {mySalesData?.stats.totalActive || 0} {mySalesData?.stats.totalActive === 1 ? 'oferta' : 'ofertas'}
                </span>
              </div>
            </div>
            <div className="market-my-sales-stat-card market-my-sales-stat-card--rent">
              <span className="market-my-sales-stat-icon">🤝</span>
              <div className="market-my-sales-stat-info">
                <span className="market-my-sales-stat-label">PUESTAS EN ALQUILER</span>
                <span className="market-my-sales-stat-value">
                  {myRentalsSummary.myOfferedRentals.length} {myRentalsSummary.myOfferedRentals.length === 1 ? 'carta' : 'cartas'}
                </span>
              </div>
            </div>
            <div className="market-my-sales-stat-card market-my-sales-stat-card--borrowed">
              <span className="market-my-sales-stat-icon">⏳</span>
              <div className="market-my-sales-stat-info">
                <span className="market-my-sales-stat-label">QUE HE ALQUILADO</span>
                <span className="market-my-sales-stat-value">
                  {myRentalsSummary.myBorrowedRentals.length} {myRentalsSummary.myBorrowedRentals.length === 1 ? 'carta' : 'cartas'}
                </span>
              </div>
            </div>
            <div className="market-my-sales-stat-card market-my-sales-stat-card--earned">
              <span className="market-my-sales-stat-icon">🏆</span>
              <div className="market-my-sales-stat-info">
                <span className="market-my-sales-stat-label">VENTAS CONCRETADAS</span>
                <span className="market-my-sales-stat-value">
                  {mySalesData?.stats.totalSold || 0} (+{(mySalesData?.stats.totalEarnedGems || 0).toLocaleString()} 💎)
                </span>
              </div>
            </div>
            <button
              type="button"
              className="market-tx-refresh-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                void refreshMyListings()
                void refreshRentals()
              }}
              disabled={mySalesLoading}
              title="Refrescar mis ventas y alquileres"
            >
              {mySalesLoading ? '⏳ ACTUALIZANDO...' : '🔄 ACTUALIZAR'}
            </button>
          </div>

          {/* Sub-Tabs: Activas vs Puestas en Alquiler vs Alquiladas vs Historial */}
          <div className="market-my-sales-subtabs">
            <button
              type="button"
              className={`market-my-sales-subtab-btn ${mySalesSubTab === 'active' ? 'market-my-sales-subtab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setMySalesSubTab('active')
              }}
            >
              🟡 EN VENTA ({mySalesData?.active?.length || 0})
            </button>
            <button
              type="button"
              className={`market-my-sales-subtab-btn ${mySalesSubTab === 'my_rentals' ? 'market-my-sales-subtab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setMySalesSubTab('my_rentals')
              }}
            >
              🤝 PUESTAS EN ALQUILER ({myRentalsSummary.myOfferedRentals.length})
            </button>
            <button
              type="button"
              className={`market-my-sales-subtab-btn ${mySalesSubTab === 'borrowed' ? 'market-my-sales-subtab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setMySalesSubTab('borrowed')
              }}
            >
              ⏳ QUE HE ALQUILADO ({myRentalsSummary.myBorrowedRentals.length})
            </button>
            <button
              type="button"
              className={`market-my-sales-subtab-btn ${mySalesSubTab === 'history' ? 'market-my-sales-subtab-btn--active' : ''}`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setMySalesSubTab('history')
              }}
            >
              🟢 HISTORIAL DE VENTAS ({mySalesData?.history?.length || 0})
            </button>
          </div>

          {/* Banner de Garantía y Custodia */}
          <div className="market-my-sales-custody-banner">
            <span className="market-custody-shield">🛡️</span>
            <div className="market-custody-text">
              <strong>Depósito de Custodia Oficial:</strong> Tus plantas, recursos de cultivo y oro están bajo custodia segura en la base de datos.
              {' '}<em>Nadie puede quitártelos y puedes recuperarlos de inmediato a tu inventario con el botón "RECUPERAR" mientras sigan activos.</em>
            </div>
          </div>

          {/* Contenido de la Sub-Tab */}
          {mySalesLoading && !mySalesData ? (
            <div className="market-empty-state">
              <span>⏳ Cargando tus publicaciones y alquileres…</span>
            </div>
          ) : mySalesSubTab === 'active' ? (
            mySalesData?.active && mySalesData.active.length > 0 ? (
              <div className="market-my-sales-grid">
                {mySalesData.active.map(renderMyActiveSaleCard)}
              </div>
            ) : (
              <div className="market-my-sales-empty">
                <span className="market-empty-icon">📦</span>
                <h4>No tienes ofertas activas de venta en este momento</h4>
                <p>
                  Todos tus recursos, cartas y oro se encuentran 100% seguros en tu cuenta.
                  Si deseas poner en venta una carta, recursos de cultivo o vender oro por gemas, hazlo desde la pestaña VENDER.
                </p>
                <button
                  type="button"
                  className="market-empty-action-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setActiveTab('sell')
                  }}
                >
                  ➕ PUBLICAR EN EL MERCADO
                </button>
              </div>
            )
          ) : mySalesSubTab === 'my_rentals' ? (
            myRentalsSummary.myOfferedRentals && myRentalsSummary.myOfferedRentals.length > 0 ? (
              <div className="market-my-sales-grid">
                {myRentalsSummary.myOfferedRentals.map((item: any) => {
                  const pDef = item.plantId ? PLANT_CONFIGS[item.plantId as PlantId] : undefined
                  const itemIcon = pDef?.packetActive || pDef?.icon
                  const itemName = pDef?.name || item.plantId || 'Carta de Planta'
                  const isRented = item.status === 'rented'
                  return (
                    <div key={item.instanceId || item.listingId} className={`market-my-card ${isRented ? 'market-my-card--rented-out' : 'market-my-card--active'}`}>
                      <div className="market-item-card__header">
                        <div className="market-item-tags-row">
                          <span className="market-item-level-tag">⭐{item.level || 1}</span>
                          <span className="market-item-rental-badge">⏳ 7 DÍAS</span>
                        </div>
                        <span className={`market-rental-status-badge ${isRented ? 'market-rental-status-badge--active' : 'market-rental-status-badge--listed'}`}>
                          {isRented ? '🟢 ALQUILADA' : '🟡 EN CATÁLOGO'}
                        </span>
                      </div>

                      <div className="market-item-card__img-wrap">
                        <img src={itemIcon} alt={itemName} className="market-item-icon" />
                      </div>
                      <h4 className="market-item-name">{itemName}</h4>

                      <div className="market-item-stats-box">
                        {item.statRolls && item.statRolls.length > 0 ? (
                          formatStatRolls(item.statRolls)
                        ) : (
                          <span className="market-stat-pill market-stat-pill--none">Stats estándar</span>
                        )}
                      </div>

                      <div className="market-rental-info-box">
                        <div className="market-rental-info-row">
                          <span>Precio fijado:</span>
                          <strong style={{ color: '#38bdf8' }}>{item.priceGems} 💎 / 7d</strong>
                        </div>
                        {isRented ? (
                          <>
                            <div className="market-rental-info-row">
                              <span>Inquilino:</span>
                              <strong>👤 {item.borrowerName || 'Jugador'}</strong>
                            </div>
                            <div className="market-rental-info-row">
                              <span>Tiempo restante:</span>
                              <strong style={{ color: '#fbbf24' }}>⏳ {formatRemainingTime(item.secondsRemaining, item.expiresAt)}</strong>
                            </div>
                            <div className="market-rental-auto-renew-tag">
                              {item.autoRenew ? '🔄 Renovación por inquilino: ACTIVA' : '⏸️ Renovación por inquilino: INACTIVA'}
                            </div>
                          </>
                        ) : (
                          <div className="market-rental-info-row" style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>
                            Esperando que otro jugador la alquile
                          </div>
                        )}
                      </div>

                      <div className="market-item-card__footer">
                        {!isRented && item.listingId ? (
                          <button
                            type="button"
                            className="market-cancel-btn"
                            onClick={() => handleCancelRentalOffer(item.listingId)}
                          >
                            RETIRAR DE ALQUILER
                          </button>
                        ) : (
                          <div className="market-rental-guarantee-tag">
                            🛡️ Vuelve automáticamente al expirar
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="market-my-sales-empty">
                <span className="market-empty-icon">🤝</span>
                <h4>No tienes cartas puestas en alquiler</h4>
                <p>
                  Pon tus cartas jugables en alquiler por 7 días a cambio de Gemas 💎.
                  Ganarás gemas de forma inmediata al alquilarse (-10% de comisión del mercado) y conservarás la propiedad de tu planta al 100%.
                </p>
                <button
                  type="button"
                  className="market-empty-action-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setActiveTab('rent')
                  }}
                >
                  ➕ PONER CARTA EN ALQUILER
                </button>
              </div>
            )
          ) : mySalesSubTab === 'borrowed' ? (
            myRentalsSummary.myBorrowedRentals && myRentalsSummary.myBorrowedRentals.length > 0 ? (
              <div className="market-my-sales-grid">
                {myRentalsSummary.myBorrowedRentals.map((item: any) => {
                  const pDef = item.plantId ? PLANT_CONFIGS[item.plantId as PlantId] : undefined
                  const itemIcon = pDef?.packetActive || pDef?.icon
                  const itemName = pDef?.name || item.plantId || 'Carta de Planta'
                  return (
                    <div key={item.instanceId} className="market-my-card market-my-card--borrowed">
                      <div className="market-item-card__header">
                        <div className="market-item-tags-row">
                          <span className="market-item-level-tag">⭐{item.level || 1}</span>
                          <span className="market-item-rental-badge">⏳ 7 DÍAS</span>
                        </div>
                        <span className="market-item-seller">👤 {item.ownerName || 'Propietario'}</span>
                      </div>

                      <div className="market-item-card__img-wrap">
                        <img src={itemIcon} alt={itemName} className="market-item-icon" />
                      </div>
                      <h4 className="market-item-name">{itemName}</h4>

                      <div className="market-item-stats-box">
                        {item.statRolls && item.statRolls.length > 0 ? (
                          formatStatRolls(item.statRolls)
                        ) : (
                          <span className="market-stat-pill market-stat-pill--none">Stats estándar</span>
                        )}
                      </div>

                      <div className="market-rental-info-box">
                        <div className="market-rental-info-row">
                          <span>Costo pagado:</span>
                          <strong>{item.priceGems || 0} 💎 / 7 días</strong>
                        </div>
                        <div className="market-rental-info-row">
                          <span>Tiempo restante:</span>
                          <strong style={{ color: '#fbbf24' }}>⏳ {formatRemainingTime(item.secondsRemaining, item.expiresAt)}</strong>
                        </div>
                        <div className="market-rental-info-row">
                          <span>Ubicación:</span>
                          <span style={{ color: item.isInDeck ? '#4ade80' : '#cbd5e1' }}>
                            {item.isInDeck ? '⚔️ En tu Mazo Activo' : '🌿 En tu Jardín'}
                          </span>
                        </div>
                      </div>

                      {/* Toggle de Auto-Renovación */}
                      <div className="market-renew-control-card">
                        <div className="market-renew-status-line">
                          <span>Renovación automática:</span>
                          <strong style={{ color: item.autoRenew ? '#4ade80' : '#94a3b8' }}>
                            {item.autoRenew ? '✅ ACTIVADA' : '❌ DESACTIVADA'}
                          </strong>
                        </div>
                        <p className="market-renew-desc-text">
                          {item.autoRenew
                            ? `Al expirar en ${formatRemainingTime(item.secondsRemaining, item.expiresAt)}, si tienes saldo se descontarán ${item.priceGems || 0} 💎 y se renovará 7 días más directo al dueño.`
                            : 'Al terminar los 7 días la carta volverá a su dueño sin cobro adicional.'}
                        </p>
                        <button
                          type="button"
                          className={`market-renew-toggle-btn ${item.autoRenew ? 'market-renew-toggle-btn--disable' : 'market-renew-toggle-btn--enable'}`}
                          onClick={() => void handleToggleAutoRenew(item.instanceId, Boolean(item.autoRenew))}
                        >
                          {item.autoRenew ? '⏸️ Desactivar Renovación' : `🔄 Activar Renovación (${item.priceGems || 0} 💎)`}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="market-my-sales-empty">
                <span className="market-empty-icon">🌱</span>
                <h4>No has alquilado cartas de otros jugadores</h4>
                <p>
                  Puedes alquilar cartas de alto nivel ⭐ y stats potenciados por 7 días en el catálogo de Plantas para competir con ventaja en la Arena.
                </p>
                <button
                  type="button"
                  className="market-empty-action-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setActiveTab('browse')
                    setSelectedCategory('plants')
                    setBrowseListingType('rental')
                  }}
                >
                  🔍 EXPLORAR CARTAS EN ALQUILER
                </button>
              </div>
            )
          ) : (
            mySalesData?.history && mySalesData.history.length > 0 ? (
              <div className="market-my-sales-grid">
                {mySalesData.history.map(renderMyClosedSaleCard)}
              </div>
            ) : (
              <div className="market-my-sales-empty">
                <span className="market-empty-icon">📜</span>
                <h4>Sin historial de ventas aún</h4>
                <p>Aquí quedará registrado cada ítem que vendas con el nombre del comprador y las gemas netas (+90%) acreditadas.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* TAB 3: GLOBAL TRANSACTIONS FEED */}
      {activeTab === 'transactions' && (
        <div className="market-tx-container">
          {/* Header Bar with Stats & Refresh */}
          <div className="market-tx-header-bar">
            <div className="market-tx-summary-chips">
              <div className="market-tx-stat-chip">
                <span className="market-tx-stat-chip__label">ACTIVIDAD TOTAL</span>
                <span className="market-tx-stat-chip__val">{txStats.total}</span>
              </div>
              <div className="market-tx-stat-chip market-tx-stat-chip--gold">
                <span className="market-tx-stat-chip__label">VOLUMEN P2P</span>
                <span className="market-tx-stat-chip__val">{txStats.p2pGems.toLocaleString()} 💎</span>
              </div>
              <div className="market-tx-stat-chip market-tx-stat-chip--emerald">
                <span className="market-tx-stat-chip__label">PREMIOS ENTREGADOS</span>
                <span className="market-tx-stat-chip__val">{txStats.rewardGems.toLocaleString()} 💎</span>
              </div>
            </div>

            <button
              type="button"
              className="market-tx-refresh-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                void refreshTransactions()
              }}
              disabled={txLoading}
              title="Refrescar transacciones en vivo"
            >
              {txLoading ? '⏳ ACTUALIZANDO...' : '🔄 ACTUALIZAR'}
            </button>
          </div>

          {/* Filter Pills */}
          <div className="market-tx-filter-bar">
            <button
              type="button"
              className={`market-tx-filter-chip ${txFilter === 'all' ? 'market-tx-filter-chip--active' : ''}`}
              onClick={() => setTxFilter('all')}
            >
              🌐 TODOS ({safeTransactions.length})
            </button>
            <button
              type="button"
              className={`market-tx-filter-chip ${txFilter === 'marketplace' ? 'market-tx-filter-chip--active' : ''}`}
              onClick={() => setTxFilter('marketplace')}
            >
              🛒 MERCADO P2P ({safeTransactions.filter((t) => t.type === 'marketplace_sale').length})
            </button>
            <button
              type="button"
              className={`market-tx-filter-chip ${txFilter === 'tournament' ? 'market-tx-filter-chip--active' : ''}`}
              onClick={() => setTxFilter('tournament')}
            >
              🏆 TORNEOS (
              {
                safeTransactions.filter(
                  (t) =>
                    t.type === 'tournament_entry_fee' ||
                    t.type === 'tournament_reentry' ||
                    t.type === 'tournament_reward' ||
                    t.type.startsWith('tournament') ||
                    t.description?.toLowerCase().includes('torneo')
                ).length
              }
              )
            </button>
            <button
              type="button"
              className={`market-tx-filter-chip ${txFilter === 'shop' ? 'market-tx-filter-chip--active' : ''}`}
              onClick={() => setTxFilter('shop')}
            >
              🎒 TIENDA & ORO (
              {
                safeTransactions.filter(
                  (t) =>
                    t.type === 'shop_pack' ||
                    t.type === 'shop_gold' ||
                    t.type === 'shop_energy' ||
                    t.type === 'shop_purchase' ||
                    t.type === 'shop_pass' ||
                    t.type === 'deposit' ||
                    t.type.startsWith('shop') ||
                    t.description?.toLowerCase().includes('tienda') ||
                    t.description?.toLowerCase().includes('sobre') ||
                    t.description?.toLowerCase().includes('oro') ||
                    t.description?.toLowerCase().includes('energía') ||
                    t.description?.toLowerCase().includes('energia') ||
                    t.description?.toLowerCase().includes('pase vip')
                ).length
              }
              )
            </button>
            <button
              type="button"
              className={`market-tx-filter-chip ${txFilter === 'reward' ? 'market-tx-filter-chip--active' : ''}`}
              onClick={() => setTxFilter('reward')}
            >
              🎁 PREMIOS & RULETA ({
                safeTransactions.filter(
                  (t) =>
                    t.type === 'lottery_win' ||
                    t.type === 'lottery_spin' ||
                    t.type === 'reward_code' ||
                    t.type === 'referral_reward'
                ).length
              })
            </button>
          </div>

          {/* Transactions Feed Scroll List */}
          <div className="market-tx-feed-list">
            {txLoading && transactions.length === 0 ? (
              <div className="market-empty-state">
                <span>⏳ Cargando registro de transacciones globales…</span>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="market-empty-state">
                <span>📜 No hay transacciones registradas en esta categoría aún.</span>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const plantDef = tx.itemId && PLANT_CONFIGS[tx.itemId as PlantId] ? PLANT_CONFIGS[tx.itemId as PlantId] : null
                const plantIcon = plantDef?.packetActive || plantDef?.icon
                const rInfo = tx.itemId && PLANT_CONFIGS[tx.itemId as PlantId] ? getPlantRarityAndMinPrice(tx.itemId as PlantId) : null

                const isTournamentFee =
                  tx.type === 'tournament_entry_fee' ||
                  tx.type === 'tournament_entry' ||
                  (tx.type !== 'tournament_reward' &&
                    tx.type !== 'tournament_reentry' &&
                    (tx.description?.toLowerCase().includes('entrada a torneo') ||
                      tx.description?.toLowerCase().includes('inscripción a torneo')))

                const isTournamentReentry =
                  tx.type === 'tournament_reentry' ||
                  tx.description?.toLowerCase().includes('reingreso a torneo') ||
                  tx.description?.toLowerCase().includes('reentrada a torneo')

                const isTournamentReward =
                  tx.type === 'tournament_reward' ||
                  tx.description?.toLowerCase().includes('premio torneo') ||
                  tx.description?.toLowerCase().includes('premio por puesto')

                const isDeposit =
                  tx.type === 'deposit' ||
                  tx.description?.toLowerCase().includes('recarga de gemas') ||
                  tx.description?.toLowerCase().includes('compra de gemas')

                const isPack =
                  tx.type === 'shop_pack' ||
                  (!isTournamentFee &&
                    !isTournamentReentry &&
                    !isTournamentReward &&
                    !isDeposit &&
                    tx.type !== 'shop_energy' &&
                    tx.type !== 'shop_pass' &&
                    (tx.description?.toLowerCase().includes('sobre') ||
                      tx.description?.toLowerCase().includes('semilla') ||
                      (tx.description?.toLowerCase().includes('pack') && !tx.description?.toLowerCase().includes('energ'))))

                const isEnergy =
                  tx.type === 'shop_energy' ||
                  tx.description?.toLowerCase().includes('energía') ||
                  tx.description?.toLowerCase().includes('energia')

                const isPass =
                  tx.type === 'shop_pass' ||
                  tx.description?.toLowerCase().includes('pase vip')

                const isGold =
                  tx.type === 'shop_gold' ||
                  (!isTournamentFee &&
                    !isTournamentReentry &&
                    !isTournamentReward &&
                    !isDeposit &&
                    !isPack &&
                    !isEnergy &&
                    !isPass &&
                    (tx.description?.toLowerCase().includes('oro') || tx.description?.toLowerCase().includes('gold')))

                const cleanDesc = (() => {
                  const desc = tx.description?.trim() || ''
                  const title = tx.title?.trim() || ''
                  if (desc) {
                    if (
                      title &&
                      title.toLowerCase().includes('oro') &&
                      (desc.toLowerCase().includes('sobre') || desc.toLowerCase().includes('semilla'))
                    ) {
                      return desc.charAt(0).toUpperCase() + desc.slice(1)
                    }
                    if (
                      title &&
                      !desc.toLowerCase().includes(title.toLowerCase()) &&
                      !title.toLowerCase().includes(desc.toLowerCase())
                    ) {
                      return `${title} — ${desc}`
                    }
                    return desc.charAt(0).toUpperCase() + desc.slice(1)
                  }
                  return title
                })()

                const cardClassModifier = isTournamentFee
                  ? 'tournament_entry_fee'
                  : isTournamentReentry
                  ? 'tournament_reentry'
                  : isTournamentReward
                  ? 'tournament_reward'
                  : isPack
                  ? 'shop_pack'
                  : isEnergy
                  ? 'shop_energy'
                  : isPass
                  ? 'shop_pass'
                  : isGold
                  ? 'shop_gold'
                  : isDeposit
                  ? 'deposit'
                  : tx.type

                return (
                  <div key={tx.id} className={`market-tx-card market-tx-card--${cardClassModifier}`}>
                    {/* Left: Type badge & timestamp */}
                    <div className="market-tx-card__left">
                      <span className={`market-tx-badge market-tx-badge--${cardClassModifier}`}>
                        {tx.type === 'marketplace_sale' && '🛒 MERCADO P2P'}
                        {isDeposit && '💎 RECARGA GEMAS'}
                        {isTournamentFee && '🏆 ENTRADA TORNEO'}
                        {isTournamentReentry && '🔄 REENTRADA TORNEO'}
                        {isTournamentReward && '🏆 PREMIO TORNEO'}
                        {isPack && '🎒 TIENDA · SOBRE'}
                        {isEnergy && '⚡ TIENDA · ENERGÍA'}
                        {isPass && '👑 TIENDA · PASE VIP'}
                        {isGold && '💰 TIENDA · ORO'}
                        {!isPack && !isEnergy && !isPass && !isGold && !isDeposit && !isTournamentFee && !isTournamentReentry && !isTournamentReward && tx.type.startsWith('shop') && '🛒 TIENDA'}
                        {tx.type === 'lottery_spin' && '🎡 GIRO DE RULETA'}
                        {tx.type === 'lottery_win' && (tx.amountGems && tx.amountGems >= 50 ? '🎰 JACKPOT RULETA' : '🎁 PREMIO DE RULETA')}
                        {tx.type === 'reward_code' && (tx.amountGold ? '💰 CÓDIGO ORO' : tx.amountGems ? '💎 CÓDIGO GEMAS' : '🎁 CÓDIGO ESPECIAL')}
                        {tx.type === 'referral_reward' && '👥 GANANCIAS REFERIDOS'}
                      </span>
                      <span className="market-tx-time">{formatTxTime(tx.createdAt)}</span>
                    </div>

                    {/* Center: Event Details */}
                    <div className="market-tx-card__center">
                      {tx.type === 'marketplace_sale' ? (
                        <div className="market-tx-details-p2p">
                          <div className="market-tx-users-flow">
                            <span className="market-tx-buyer-name">{tx.userName}</span>
                            <span className="market-tx-arrow">compró a</span>
                            <span className="market-tx-seller-name">{tx.targetUserName || 'Vendedor'}</span>
                          </div>
                          {plantDef && (
                            <div className="market-tx-plant-preview">
                              {plantIcon && <img src={plantIcon} alt={plantDef.name} className="market-tx-plant-icon" />}
                              <div className="market-tx-plant-text">
                                <span className="market-tx-plant-name">{plantDef.name}</span>
                                <span className="market-tx-plant-sub" style={{ color: rInfo?.color || '#94a3b8' }}>
                                  {rInfo?.rarity || tx.itemRarity || 'Planta'} · Lv. {tx.itemLevel || 0}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="market-tx-details-custom">
                          <div className="market-tx-users-flow">
                            <span className="market-tx-user-name">{tx.userName}</span>
                            <span className="market-tx-action-text">
                              {isTournamentFee
                                ? 'pagó entrada al Torneo Oficial'
                                : isTournamentReentry
                                ? 'pagó reentrada al Torneo Oficial'
                                : isTournamentReward
                                ? 'ganó premio en Torneo Oficial'
                                : isPack
                                ? 'compró sobre en Tienda'
                                : isEnergy
                                ? 'recargó energía en Tienda'
                                : isPass
                                ? 'activó Pase VIP en Tienda'
                                : isGold
                                ? 'compró oro en Tienda'
                                : isDeposit
                                ? 'recargó gemas oficiales'
                                : tx.type.startsWith('shop')
                                ? 'compró en Tienda'
                                : tx.type === 'lottery_spin'
                                ? 'giró la Ruleta de la Suerte'
                                : tx.type === 'lottery_win'
                                ? 'probó suerte en la Ruleta'
                                : tx.type === 'reward_code'
                                ? (tx.amountGold ? 'canjeó código de oro' : tx.amountGems ? 'canjeó código de gemas' : 'canjeó código promocional')
                                : tx.type === 'referral_reward'
                                ? 'cobró ganancias de referidos'
                                : 'recibió recompensa'}
                            </span>
                          </div>
                          <span className="market-tx-desc-text">{cleanDesc}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Amount in Gems or Gold */}
                    <div className="market-tx-card__right">
                      {isTournamentFee || isTournamentReentry ? (
                        <div className="market-tx-amount-box market-tx-amount-box--gems">
                          <span className="market-tx-amount-num" style={{ color: '#fb923c', fontWeight: 'bold' }}>
                            -{Math.abs(tx.amountGems || 0).toLocaleString()} 💎
                          </span>
                        </div>
                      ) : tx.type === 'lottery_spin' || tx.description?.toLowerCase().includes('giro en ruleta') || tx.description?.toLowerCase().includes('giro adicional') ? (
                        <div className="market-tx-amount-box market-tx-amount-box--gems">
                          <span className="market-tx-amount-num" style={{ color: '#f87171', fontWeight: 'bold' }}>
                            -{Math.abs(tx.amountGems || 10).toLocaleString()} 💎
                          </span>
                        </div>
                      ) : (isTournamentReward || tx.type === 'lottery_win' || tx.description?.toLowerCase().includes('premio de ruleta') || isDeposit) && tx.amountGems && tx.amountGems > 0 ? (
                        <div className="market-tx-amount-box market-tx-amount-box--gems">
                          <span className="market-tx-amount-num" style={{ color: '#4ade80', fontWeight: 'bold' }}>
                            +{tx.amountGems.toLocaleString()} 💎
                          </span>
                        </div>
                      ) : tx.amountGems && tx.amountGems > 0 ? (
                        <div className="market-tx-amount-box market-tx-amount-box--gems">
                          <span className="market-tx-amount-num" style={{ color: '#4ade80', fontWeight: 'bold' }}>
                            +{tx.amountGems.toLocaleString()} 💎
                          </span>
                        </div>
                      ) : tx.amountGold && tx.amountGold > 0 ? (
                        <div className="market-tx-amount-box">
                          <span
                            className="market-tx-amount-tag"
                            style={{
                              color: '#facc15',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              letterSpacing: '0.5px',
                            }}
                          >
                            +{tx.amountGold.toLocaleString()} 🪙
                          </span>
                        </div>
                      ) : (
                        <div className="market-tx-amount-box">
                          <span
                            className="market-tx-amount-tag"
                            style={{
                              color: tx.description?.includes('Agua') ? '#38bdf8' :
                                     tx.description?.includes('Oro') ? '#facc15' :
                                     tx.description?.includes('Fertilizante') ? '#4ade80' :
                                     tx.description?.includes('Pala') ? '#fb923c' :
                                     tx.description?.includes('Wall-nut') ? '#fbbf24' :
                                     tx.description?.includes('Sobre') ? '#c084fc' :
                                     tx.description?.includes('Sigue') ? '#94a3b8' : '#94a3b8',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              letterSpacing: '0.5px',
                            }}
                          >
                            {tx.description?.includes('Agua') ? '💧 2x AGUA' :
                             tx.description?.includes('Oro') ? '💰 ORO' :
                             tx.description?.includes('Fertilizante') ? '🌱 FERTILIZANTE' :
                             tx.description?.includes('Pala') ? '⛏️ PALA' :
                             tx.description?.includes('Wall-nut') ? '🥜 WALL-NUT' :
                             tx.description?.includes('Sobre') ? '👑 SOBRE' :
                             tx.description?.includes('Sigue') ? '🍀 SUERTE' : 'OFICIAL'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}


      {/* MODAL DE VENTA DIRECTA DE ORO (HORIZONTAL Y ADAPTABLE) */}
      {isGoldModalOpen && (
        <div className="clan-dialog-backdrop" onClick={() => setIsGoldModalOpen(false)}>
          <div className="market-gold-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* CABECERA HORIZONTAL COMPACTA */}
            <div className="market-gold-modal-header">
              <div className="market-gold-modal-title-box">
                <div className="market-gold-modal-icon-ring">
                  <img src={monedaImg} alt="Oro" />
                </div>
                <div>
                  <h3 className="market-gold-modal-title">VENDER ORO POR GEMAS</h3>
                  <p className="market-gold-modal-subtitle">
                    Pon en venta tus Monedas de Oro a cambio de Gemas 💎 en el mercado P2P
                  </p>
                </div>
              </div>

              <div className="market-gold-modal-header-right">
                <div className="market-gold-balance-pill">
                  💰 Saldo: <strong>{userGold.toLocaleString('en-US')} Oro</strong>
                </div>
                <button
                  type="button"
                  className="market-gold-modal-close-btn"
                  onClick={() => setIsGoldModalOpen(false)}
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* FORMULARIO EN 2 COLUMNAS HORIZONTALES */}
            <form onSubmit={handleCreateGoldListing} className="market-gold-modal-form">
              <div className="market-gold-modal-columns">
                {/* COLUMNA 1: CANTIDAD DE ORO */}
                <div className="market-gold-modal-col">
                  <div className="market-gold-field-group">
                    <label>
                      <span>Cantidad de Oro a Vender:</span>
                      <span className="market-gold-min-tag">Mín: 100</span>
                    </label>
                    <div className="market-gold-input-row">
                      <span className="market-gold-input-prefix"><GoldIcon size={18} /></span>
                      <input
                        type="number"
                        step="100"
                        min={100}
                        max={userGold}
                        value={goldSellQty}
                        onChange={(e) => setGoldSellQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="market-gold-input"
                        required
                      />
                      <span className="market-gold-input-suffix">Oro</span>
                    </div>
                    <div className="market-price-shortcuts" style={{ marginTop: '6px' }}>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(500)}>500</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(1000)}>1,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(5000)}>5,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(10000)}>10,000</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellQty(userGold)}>MÁX ({userGold.toLocaleString('en-US')})</button>
                    </div>
                  </div>
                </div>

                {/* COLUMNA 2: PRECIO EN GEMAS Y RESUMEN EN VIVO */}
                <div className="market-gold-modal-col">
                  <div className="market-gold-field-group">
                    <label>
                      <span>Precio Total en Gemas:</span>
                      <span className="market-gold-min-tag">Mín: 1 💎</span>
                    </label>
                    <div className="market-gold-input-row">
                      <span className="market-gold-input-prefix">💎</span>
                      <input
                        type="number"
                        step="1"
                        min={1}
                        max={99999}
                        value={goldSellPriceGems}
                        onChange={(e) => setGoldSellPriceGems(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="market-gold-input"
                        required
                      />
                      <span className="market-gold-input-suffix">Gemas</span>
                    </div>
                    <div className="market-price-shortcuts" style={{ marginTop: '6px' }}>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(5)}>5 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(10)}>10 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(25)}>25 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(50)}>50 💎</button>
                      <button type="button" className="market-shortcut-btn" onClick={() => setGoldSellPriceGems(100)}>100 💎</button>
                    </div>
                  </div>

                  {/* Resumen en vivo */}
                  <div className="market-gold-summary-card">
                    <div className="market-gold-summary-row">
                      <span>Tasa calculada:</span>
                      <strong>≈ {goldSellPriceGems > 0 ? Math.round(goldSellQty / goldSellPriceGems).toLocaleString('en-US') : 0} Oro / 💎</strong>
                    </div>
                    <div className="market-gold-summary-row">
                      <span>Comisión retenida ({comisionPct}%):</span>
                      <span style={{ color: '#ef4444' }}>-{calculateMarketplaceSplit(goldSellPriceGems, comisionPct).comision} 💎</span>
                    </div>
                    <div className="market-gold-summary-row market-gold-summary-row--total">
                      <span>Recibirás neto al venderse:</span>
                      <strong style={{ color: '#4ade80', fontSize: '14px' }}>{calculateMarketplaceSplit(goldSellPriceGems, comisionPct).neto} 💎</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCIONES */}
              <div className="market-gold-modal-actions">
                <button
                  type="button"
                  className="clan-dialog-btn clan-dialog-btn--cancel"
                  onClick={() => setIsGoldModalOpen(false)}
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={goldSellQty < 100 || goldSellQty > userGold || goldSellPriceGems < 1}
                  className="clan-dialog-btn clan-dialog-btn--confirm"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  {goldSellQty > userGold
                    ? 'ORO INSUFICIENTE'
                    : `PUBLICAR (${goldSellPriceGems} 💎)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALQUILER P2P DE PLANTA (CON OPCIÓN DE RENOVACIÓN AUTOMÁTICA) */}
      {rentPlantModal && (
        <div className="clan-dialog-backdrop" onClick={() => setRentPlantModal(null)}>
          <div className="market-gold-modal-card market-rent-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="market-gold-modal-header">
              <div className="market-gold-modal-title-box">
                <div className="market-gold-modal-icon-ring" style={{ borderColor: '#38bdf8' }}>
                  <span>🤝</span>
                </div>
                <div>
                  <h3 className="market-gold-modal-title">ALQUILAR CARTA POR 7 DÍAS</h3>
                  <p className="market-gold-modal-subtitle">
                    P2P Rental · Disfruta esta carta en tus batallas competitivas durante 7 días
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="market-gold-modal-close-btn"
                onClick={() => setRentPlantModal(null)}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="market-rent-modal-body">
              <div className="market-rent-plant-preview">
                <img
                  src={
                    PLANT_CONFIGS[rentPlantModal.plantId as PlantId]?.packetActive ||
                    PLANT_CONFIGS[rentPlantModal.plantId as PlantId]?.icon
                  }
                  alt={PLANT_CONFIGS[rentPlantModal.plantId as PlantId]?.name || rentPlantModal.plantId}
                  className="market-rent-plant-img"
                />
                <div className="market-rent-plant-info">
                  <div className="market-item-tags-row">
                    <span className="market-item-level-tag">⭐{rentPlantModal.nivel}</span>
                    <span className="market-item-sprouts-tag">🌱{rentPlantModal.germinationsCount ?? 0}</span>
                    <span className="market-item-rental-badge">⏳ 7 DÍAS</span>
                  </div>
                  <h4>{PLANT_CONFIGS[rentPlantModal.plantId as PlantId]?.name || rentPlantModal.plantId}</h4>
                  <div className="market-item-stats-box">
                    {rentPlantModal.statRolls && rentPlantModal.statRolls.length > 0 ? (
                      formatStatRolls(rentPlantModal.statRolls)
                    ) : (
                      <span className="market-stat-pill market-stat-pill--none">Stats estándar</span>
                    )}
                  </div>
                  <div className="market-rent-owner-tag">
                    👤 Propietario: <strong>{rentPlantModal.vendedor || 'Jugador'}</strong>
                  </div>
                </div>
              </div>

              <div className="market-gold-summary-card" style={{ marginTop: '14px' }}>
                <div className="market-gold-summary-row">
                  <span>Duración del Alquiler:</span>
                  <strong>7 Días de Combate</strong>
                </div>
                <div className="market-gold-summary-row">
                  <span>Costo Total:</span>
                  <strong style={{ color: '#38bdf8', fontSize: '15px' }}>{rentPlantModal.precio} 💎 Gemas</strong>
                </div>
                <div className="market-gold-summary-row">
                  <span>Tu saldo actual:</span>
                  <span style={{ color: userTokens >= rentPlantModal.precio ? '#4ade80' : '#ef4444' }}>
                    {Math.floor(userTokens)} 💎 {userTokens < rentPlantModal.precio && '(Insuficiente)'}
                  </span>
                </div>
              </div>

              {/* Checkbox de Auto-Renovación */}
              <div className="market-rent-autorenew-box">
                <label className="market-rent-autorenew-label">
                  <input
                    type="checkbox"
                    checked={rentAutoRenew}
                    onChange={(e) => setRentAutoRenew(e.target.checked)}
                    className="market-rent-checkbox"
                  />
                  <div className="market-rent-autorenew-text">
                    <strong>Habilitar Renovación Automática al vencer los 7 días</strong>
                    <span>
                      Si está activada, al cumplirse los 7 días se descontarán {rentPlantModal.precio} 💎 de tu cuenta y se renovará por 7 días más directamente al propietario. Si la desactivas o no tienes gemas suficientes, la carta regresará limpiamente a su dueño.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="market-gold-modal-actions">
              <button
                type="button"
                className="clan-dialog-btn clan-dialog-btn--cancel"
                onClick={() => setRentPlantModal(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={userTokens < rentPlantModal.precio}
                className="clan-dialog-btn clan-dialog-btn--confirm"
                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)' }}
                onClick={() => void handleConfirmRentPlant(rentPlantModal, rentAutoRenew)}
              >
                {userTokens < rentPlantModal.precio
                  ? 'GEMAS INSUFICIENTES'
                  : `ALQUILAR AHORA (${rentPlantModal.precio} 💎)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM IN-GAME POPUP DIALOG */}
      {activeDialog && (
        <div className="clan-dialog-backdrop" onClick={() => activeDialog.type !== 'confirm' && setActiveDialog(null)}>
          <div
            className={`clan-dialog-card clan-dialog-card--${activeDialog.type}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="clan-dialog-icon-ring">
              <span className="clan-dialog-icon">{activeDialog.icon}</span>
            </div>
            <h3 className="clan-dialog-title">{activeDialog.title}</h3>
            <p className="clan-dialog-msg">{activeDialog.message}</p>

            <div className="clan-dialog-actions">
              {activeDialog.type === 'confirm' && (
                <button
                  type="button"
                  className="clan-dialog-btn clan-dialog-btn--cancel"
                  onClick={() => setActiveDialog(null)}
                >
                  {activeDialog.cancelText || 'CANCELAR'}
                </button>
              )}
              <button
                type="button"
                className="clan-dialog-btn clan-dialog-btn--confirm"
                onClick={() => {
                  const confirmCb = activeDialog.onConfirm
                  setActiveDialog(null)
                  if (confirmCb) {
                    confirmCb()
                  }
                }}
              >
                {activeDialog.confirmText || 'ENTENDIDO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
