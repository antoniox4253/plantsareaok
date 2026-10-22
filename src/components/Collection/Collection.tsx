import { useState, useEffect } from 'react'
import background from '../../assets/images/background.webp'
const sunIcon = '/game-assets/greenfoot/sun1.webp'
import { soundManager } from '../../utils/audioManager'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { SupabaseService } from '../../services/supabaseService'
import type { PlantId } from '../../types/game'
import './Collection.css'

export interface CollectionPlant {
  id: string
  name: string
  category: 'producer' | 'ranged' | 'defensive' | 'special' | 'melee'
  categoryLabel: string
  cost: number
  cooldownSec: number
  hp: number | string
  damage: number | string
  sprite: string
  cardImage: string
  description: string
  lore: string
}

export const PLANT_RARITIES: Record<string, { label: string; short: string; color: string; bg: string }> = {
  // Comunes (4) -> C
  sunflower: { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' },
  peashooter: { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' },
  wallnut: { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' },
  chomper: { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' },

  // Poco Comunes (5) -> PC
  garlic: { label: 'POCO COMÚN', short: 'PC', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)' },
  bonkchoy: { label: 'POCO COMÚN', short: 'PC', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)' },
  repeater: { label: 'POCO COMÚN', short: 'PC', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)' },
  melonpult: { label: 'POCO COMÚN', short: 'PC', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)' },
  squash: { label: 'POCO COMÚN', short: 'PC', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.2)' },

  // Raras (3) -> R
  twinsunflower: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  jalapeno: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  kernelpult: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },

  // Épicas
  aloe: { label: 'ÉPICA', short: 'E', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)' },
  tallnut: { label: 'ÉPICA', short: 'E', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)' },
  pickledpepper: { label: 'ÉPICA', short: 'E', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)' },
  ghostpepper: { label: 'ÉPICA', short: 'E', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.2)' },

  // Legendarias
  iceberglettuce: { label: 'LEGENDARIA', short: 'L', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)' },
  threepeater: { label: 'LEGENDARIA', short: 'L', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)' },
  gatlingpea: { label: 'LEGENDARIA', short: 'L', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)' },

  // Temporada 2 Adicionales
  marigold: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  guacodile: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  toadstool: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  explodeonut: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  snowpea: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
  torchwood: { label: 'RARA', short: 'R', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
}

const LORE_MAP: Record<string, string> = {
  sunflower: 'Sunflower es vital para mantener una sólida economía de soles. Le encanta sonreír y bailar con la brisa.',
  peashooter: '¿Qué se siente ser la primera línea de defensa? Peashooter lo sabe bien. Eficiente, directa y confiable.',
  repeater: 'Repeater es feroz. Dispara dos guisantes a la vez porque no le gusta dejar trabajo a medias.',
  wallnut: 'Wall-nut tiene una cáscara dura como el acero. Protege la retaguardia mientras tus atacantes hacen su trabajo.',
  melonpult: 'Melon-pult no duda en lanzar sandías pesadas por los aires. Aplasta e inflige daño a múltiples enemigos.',
  chomper: 'Cactus avanza continuamente hacia las líneas enemigas disparando espinas.',
  bonkchoy: 'Bonk Choy entrena a diario. Sus puños veloces no dejan títere con cabeza a corta distancia.',
  garlic: 'Squash está siempre listo. En cuanto ve un enemigo cerca: ¡BAM! Lo aplasta por completo.',
  squash: 'Potato Mine necesita tiempo para armarse bajo tierra. Una vez lista, explota al menor contacto con el enemigo.',
  twinsunflower: 'Dos cabezas producen mejor que una. Twin Sunflower ilumina el terreno con energía solar multiplicada.',
  threepeater: 'Threepeater vigila tres líneas a la vez brindando cobertura de fuego múltiple.',
  tallnut: 'Tall-nut es un muro gigante inamovible. Su gran altura imposibilita el avance enemigo y resiste el doble de daño.',
  jalapeno: 'Jalapeño es de 1 solo uso. Desata una bola de fuego ardiente que quema la fila entera limpiando el carril (1000 daño + 150 por nivel).',
  iceberglettuce: 'Iceberg Lettuce cuesta 0 Soles y es de 1 solo uso. Al colocarse en el campo, congela a todos los enemigos durante 7 segundos (+2s por cada nivel).',
  aloe: 'Aloe Curandera escanea el carril y cura con ondas de luz mística a las plantas heridas aliadas.',
  kernelpult: 'Lanzamaíz arroja granos de maíz ligeros a distancia (30 DMG) y, con un 25% de probabilidad, una barra de mantequilla pegajosa de doble impacto (60 DMG) que inmoviliza por completo al objetivo durante 3s (+0.6s por tirada de duración, hasta 6s máx).',
  explodeonut: 'Nuez Explosiva rueda decidida por el campo de batalla (150 soles). Al chocar con el enemigo, detona liberando una violenta explosión en área de 1000 de daño que arrasa la casilla de contacto y la casilla trasera.',
  gatlingpea: 'Guisantralladora no se anda con rodeos. Equipada con un cañón rotativo de 4 bocas, dispara ráfagas implacables de guisantes de alto impacto a una cadencia arrolladora.',
  ghostpepper: 'Chile Fantasma flota silenciosamente sobre las líneas enemigas, atormentando a todos los que osan cruzarse en su camino con daño espectral persistente antes de estallar.',
  guacodile: 'Guacodilo patrulla a gran velocidad. Mitad aguacate, mitad reptil feroz, se abalanza sobre las defensas contrarias desgarrando con poderosas dentelladas.',
  marigold: 'Margarita alegra la arena con su aura de prosperidad económica. Otorga monedas de 1 a 2 de Oro con imagen de moneda periódicamente cada 15 segundos durante el combate para enriquecer al jugador.',
  pickledpepper: 'Chile en Escabeche es una fuerza geológica de 1 solo uso. Al tocar tierra, desencadena una explosión vertical de 800 de daño que arrasa por completo la columna en todos los carriles.',
  snowpea: 'Hielaguisantes canaliza vientos árticos en cada disparo. Sus guisantes congelados entumecen a los enemigos, reduciendo drásticamente su velocidad de movimiento y ataque.',
  toadstool: 'Seta Sapo (150 soles, 500 HP) acecha pacientemente antes de desplegar su lengua voraz a distancia, devorando a los invasores y transformando su energía en +50 soles durante la digestión.',
  torchwood: 'Tronco de Fuego es el bastión del fuego. Colocado frente a tus lanzadores, convierte cada guisante que lo atraviesa en un ardiente proyectil ígneo con daño duplicado y salpicadura.',
}

export const CATALOG: CollectionPlant[] = (Object.keys(PLANT_CONFIGS) as PlantId[]).map((id) => {
  const c = PLANT_CONFIGS[id]
  const catLabel =
    c?.category === 'producer'
      ? 'Productora'
      : c?.category === 'ranged'
      ? 'Ataque a Distancia'
      : c?.category === 'defensive'
      ? 'Tanque Defensivo'
      : 'Mele / Cuerpo a Cuerpo'

  const isInstant = c?.id === 'jalapeno' || c?.id === 'iceberglettuce' || c?.id === 'squash'

  return {
    id: c?.id || id,
    name: c?.name || id,
    category: c?.category || 'melee',
    categoryLabel: catLabel,
    cost: c?.cost ?? 100,
    cooldownSec: (c?.cooldownMs ?? 5000) / 1000,
    hp: isInstant ? 'Un Solo Uso' : (c?.maxHp ?? 100),
    damage: c?.id === 'kernelpult' ? '30 / 60 🧈' : (c?.damage !== undefined ? c.damage : (c?.category === 'producer' ? '0 (Produce Soles)' : 'Especial')),
    sprite: c?.sprite || '',
    cardImage: c?.packetActive || c?.icon || '',
    description: c?.description || '',
    lore: (c?.id && LORE_MAP[c.id]) || `${c?.name || id} es una valiosa planta aliada lista para defender el jardín.`,
  }
})

export interface SystemDeckConfig {
  id: 'deck_1' | 'deck_2' | 'deck_3'
  title: string
  subtitle: string
  priceGems: number
  badge: string
  headerBg: string
  accentColor: string
  description: string
  plants: Array<{
    id: PlantId
    level: number
    statsCount: number
    roleNote?: string
  }>
}

export const SYSTEM_DECKS: SystemDeckConfig[] = [
  {
    id: 'deck_1',
    title: 'Deck 1: Agro / Ráfaga Solar',
    subtitle: 'Presión constante y ofensiva veloz desde el segundo cero',
    priceGems: 100,
    badge: '⚡ AGRO VELOZ (100 💎)',
    headerBg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.22), rgba(16, 185, 129, 0.12))',
    accentColor: '#4ade80',
    description: 'Excelente para subir copas rápido. Ofrece empuje de daño con Repetidora y Bonk Choy, soporte de bajo costo y remates explosivos con Jalapeño.',
    plants: [
      { id: 'repeater', level: 2, statsCount: 2, roleNote: 'Cadencia doble' },
      { id: 'bonkchoy', level: 2, statsCount: 2, roleNote: 'Mele veloz' },
      { id: 'squash', level: 1, statsCount: 1, roleNote: 'Impacto directo' },
      { id: 'sunflower', level: 2, statsCount: 2, roleNote: 'Economía solar' },
      { id: 'tallnut', level: 1, statsCount: 1, roleNote: 'Muro alto' },
      { id: 'jalapeno', level: 1, statsCount: 1, roleNote: 'Limpia carril' },
    ],
  },
  {
    id: 'deck_2',
    title: 'Deck 2: Control & Asedio Frío',
    subtitle: 'Ralentización masiva, muro de contención y desgaste táctico',
    priceGems: 220,
    badge: '❄️ CONTROL FRÍO (220 💎)',
    headerBg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.22), rgba(14, 165, 233, 0.12))',
    accentColor: '#38bdf8',
    description: 'Frena en seco las ofensivas enemigas con Hielaguisantes y Lechuga Helada mientras Chile Fantasma y Repetidora diezman las líneas rivales.',
    plants: [
      { id: 'sunflower', level: 3, statsCount: 3, roleNote: 'Sol acelerado' },
      { id: 'ghostpepper', level: 2, statsCount: 2, roleNote: 'Daño espectral' },
      { id: 'repeater', level: 2, statsCount: 2, roleNote: 'Ráfaga de apoyo' },
      { id: 'iceberglettuce', level: 1, statsCount: 1, roleNote: 'Congelación 0 soles' },
      { id: 'snowpea', level: 1, statsCount: 1, roleNote: 'Ralentización constante' },
      { id: 'wallnut', level: 2, statsCount: 2, roleNote: 'Barrera resistente' },
    ],
  },
  {
    id: 'deck_3',
    title: 'Deck 3: Élite Legendario',
    subtitle: 'Guisantralladora letal, control incendiario y prosperidad de oro',
    priceGems: 380,
    badge: '🔥 ÉLITE SUPREMA (380 💎)',
    headerBg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(217, 119, 6, 0.14))',
    accentColor: '#fbbf24',
    description: 'El mazo definitivo para ligas altas y arenas competitivas. Disparo implacable con Guisantralladora, producción máxima y monedas con Margarita.',
    plants: [
      { id: 'sunflower', level: 3, statsCount: 3, roleNote: 'Triple sol' },
      { id: 'jalapeno', level: 1, statsCount: 1, roleNote: 'Fuego total' },
      { id: 'iceberglettuce', level: 1, statsCount: 1, roleNote: 'Freno helado' },
      { id: 'gatlingpea', level: 1, statsCount: 1, roleNote: 'Cañón cuádruple' },
      { id: 'squash', level: 2, statsCount: 2, roleNote: 'Aplastamiento pesado' },
      { id: 'marigold', level: 2, statsCount: 2, roleNote: 'Generador de Oro' },
    ],
  },
]

interface CollectionProps {
  onBack: () => void
  onPracticePlant?: (plantId: string) => void
  unlockedPlants?: PlantId[]
  plantCopies?: Record<PlantId, number>
  plantLevels?: Record<PlantId, number>
  userGems?: number
  onRefreshData?: () => void
}

export default function Collection({
  onBack,
  onPracticePlant,
  unlockedPlants,
  plantCopies,
  plantLevels,
  userGems = 0,
  onRefreshData,
}: CollectionProps) {
  const [selectedPlant, setSelectedPlant] = useState<CollectionPlant>(CATALOG[0])
  const [activeTab, setActiveTab] = useState<'all' | 'producer' | 'ranged' | 'defensive' | 'special' | 'melee' | 'rent_deck'>('all')
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.isMuted())
  const [activeRentals, setActiveRentals] = useState<Array<{ deckId: string; expiresAt: string; secondsRemaining: number }>>([])
  const [isRenting, setIsRenting] = useState<string | null>(null)
  const [rentModalDeck, setRentModalDeck] = useState<SystemDeckConfig | null>(null)
  const [alertMessage, setAlertMessage] = useState<{ title: string; message: string; icon: string; isSuccess?: boolean } | null>(null)

  useEffect(() => {
    soundManager.playBgm('menu')
    const unsubscribe = soundManager.subscribe((muted) => setIsMuted(muted))
    return () => unsubscribe()
  }, [])

  // Cargar alquileres de sistema activos
  useEffect(() => {
    let isMounted = true
    SupabaseService.getUserSystemDeckRentals().then((rentals) => {
      if (isMounted) setActiveRentals(rentals)
    })
    return () => { isMounted = false }
  }, [])

  const filteredCatalog = CATALOG.filter((p) => {
    if (activeTab === 'all') return true
    return p?.category === activeTab
  })

  const playPreviewSound = () => {
    soundManager.playSound('pea_shoot', 0.6)
    if (onPracticePlant) {
      onPracticePlant(selectedPlant.id)
    }
  }

  const handleConfirmRentDeck = async (deck: SystemDeckConfig) => {
    if (userGems < deck.priceGems) {
      soundManager.playSound('surrender', 0.6)
      setAlertMessage({
        title: 'GEMAS INSUFICIENTES',
        message: `Necesitas ${deck.priceGems} Gemas 💎 para alquilar este Deck durante 7 días.\nTu saldo actual es de ${Math.floor(userGems)} Gemas.\nPor favor recarga gemas en la Tienda.`,
        icon: '💎',
      })
      setRentModalDeck(null)
      return
    }

    setIsRenting(deck.id)
    try {
      const res = await SupabaseService.rentSystemDeck(deck.id)
      if (!res.success) {
        soundManager.playSound('surrender', 0.6)
        setAlertMessage({
          title: 'ERROR DE ALQUILER',
          message: res.error || 'No se pudo completar el alquiler.',
          icon: '⚠️',
        })
      } else {
        soundManager.playSound('victory', 0.7)
        setAlertMessage({
          title: '¡DECK ALQUILADO EXITOSAMENTE!',
          message: `Has alquilado el "${deck.title}" por 7 días.\n\n✨ Las 6 plantas han sido añadidas a tu colección con estadísticas aleatorias.\n¡Ya puedes usarlas en tu Mazo en el Jardín!`,
          icon: '🎉',
          isSuccess: true,
        })
        const updatedRentals = await SupabaseService.getUserSystemDeckRentals()
        setActiveRentals(updatedRentals)
        if (onRefreshData) onRefreshData()
      }
    } catch (e: any) {
      soundManager.playSound('surrender', 0.6)
      setAlertMessage({
        title: 'ERROR DE CONEXIÓN',
        message: e?.message || 'Error al conectar con el servidor.',
        icon: '⚠️',
      })
    } finally {
      setIsRenting(null)
      setRentModalDeck(null)
    }
  }

  const formatRentalTime = (seconds: number): string => {
    if (seconds <= 0) return 'Expirado'
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    if (days > 0) return `${days}d ${hours}h`
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }

  const selectedRarity = PLANT_RARITIES[selectedPlant.id] || { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' }

  return (
    <div className="collection-screen" style={{ backgroundImage: `url(${background})` }}>
      {/* Header Bar */}
      <div className="collection-header">
        <button className="collection-back-btn" type="button" onClick={onBack}>
          ⬅️ MENÚ
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 className="collection-title">📖 Colección de Plantas</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="collection-gems-pill" title="Tus Gemas disponibles">
            💎 {Math.floor(userGems).toLocaleString()}
          </div>
          <button
            className="collection-mute-btn"
            type="button"
            onClick={() => {
              soundManager.toggleMute()
              setIsMuted(soundManager.isMuted())
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="collection-tabs">
        <button
          type="button"
          className={`collection-tab ${activeTab === 'all' ? 'collection-tab--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setActiveTab('all')
          }}
        >
          🌟 TODAS ({CATALOG.length})
        </button>
        <button
          type="button"
          className={`collection-tab ${activeTab === 'producer' ? 'collection-tab--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setActiveTab('producer')
          }}
        >
          ☀️ PRODUCTORAS
        </button>
        <button
          type="button"
          className={`collection-tab ${activeTab === 'ranged' ? 'collection-tab--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setActiveTab('ranged')
          }}
        >
          🏹 ATACANTES
        </button>
        <button
          type="button"
          className={`collection-tab ${activeTab === 'defensive' ? 'collection-tab--active' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.4)
            setActiveTab('defensive')
          }}
        >
          🛡️ TANQUES
        </button>
        <button
          type="button"
          className={`collection-tab collection-tab--rent-deck ${activeTab === 'rent_deck' ? 'collection-tab--active-gold' : ''}`}
          onClick={() => {
            soundManager.playSound('click', 0.5)
            setActiveTab('rent_deck')
          }}
        >
          ⚡ ALQUILAR DECK
        </button>
      </div>

      {/* RENTAL DECKS VIEW */}
      {activeTab === 'rent_deck' ? (
        <div className="collection-rent-decks-container">
          <div className="collection-rent-decks-header-banner">
            <div>
              <h2 className="collection-rent-decks-title">⚡ ALQUILER DE DECKS COMPETITIVOS</h2>
              <p className="collection-rent-decks-subtitle">
                Alquila un mazo completo durante 7 días. Las cartas reciben estadísticas aleatorias calibradas en cada alquiler y se añaden directamente a tu colección para combinarlas con tus plantas.
              </p>
            </div>
            <div className="collection-rent-decks-guarantee">
              <span>🛡️ 7 Días de Uso Ilimitado</span>
              <span>🎲 Stats Aleatorios Únicos</span>
              <span>⚔️ Mezcla Libre en Mazo</span>
            </div>
          </div>

          <div className="collection-rent-decks-list">
            {SYSTEM_DECKS.map((deck) => {
              const activeRental = activeRentals.find((r) => r.deckId === deck.id)
              const isActive = Boolean(activeRental && activeRental.secondsRemaining > 0)

              return (
                <div
                  key={deck.id}
                  className={`collection-deck-horizontal-card ${isActive ? 'collection-deck-horizontal-card--active' : ''}`}
                  style={{ borderColor: deck.accentColor }}
                >
                  {/* Left Column / Header info */}
                  <div className="collection-deck-card__left" style={{ background: deck.headerBg }}>
                    <div className="collection-deck-card__badge-row">
                      <span className="collection-deck-card__badge" style={{ backgroundColor: deck.accentColor, color: '#0a100d' }}>
                        {deck.badge}
                      </span>
                      {isActive && (
                        <span className="collection-deck-card__active-timer">
                          ⏳ ACTIVO: {formatRentalTime(activeRental!.secondsRemaining)}
                        </span>
                      )}
                    </div>
                    <h3 className="collection-deck-card__title" style={{ color: deck.accentColor }}>{deck.title}</h3>
                    <p className="collection-deck-card__desc">{deck.description}</p>
                    <div className="collection-deck-card__price-box">
                      <span className="collection-deck-card__price-val">💎 {deck.priceGems} Gemas</span>
                      <span className="collection-deck-card__price-period">/ 7 Días</span>
                    </div>
                    <button
                      type="button"
                      className={`collection-deck-card__action-btn ${isActive ? 'collection-deck-card__action-btn--renew' : ''}`}
                      disabled={isRenting === deck.id}
                      onClick={() => {
                        soundManager.playSound('click', 0.5)
                        setRentModalDeck(deck)
                      }}
                    >
                      {isRenting === deck.id ? '⏳ Procesando...' : isActive ? '🔄 RENOVAR (7 DÍAS)' : `💎 ALQUILAR (${deck.priceGems} 💎)`}
                    </button>
                  </div>

                  {/* Right Column / The 6 Plants Grid */}
                  <div className="collection-deck-card__right">
                    <div className="collection-deck-card__plants-title">
                      PLANTAS INCLUIDAS (6 CARTAS CALIBRADAS)
                    </div>
                    <div className="collection-deck-card__plants-grid">
                      {deck.plants.map((dp) => {
                        const cfg = PLANT_CONFIGS[dp.id]
                        return (
                          <div key={dp.id} className="collection-deck-card__plant-slot">
                            <div className="collection-deck-card__plant-img-wrap">
                              <img
                                src={cfg?.packetActive || cfg?.icon || cfg?.sprite}
                                alt={cfg?.name || dp.id}
                                className="collection-deck-card__plant-img"
                              />
                              <span className="collection-deck-card__plant-lvl-tag">
                                ⭐ Lvl {dp.level}
                              </span>
                            </div>
                            <div className="collection-deck-card__plant-details">
                              <span className="collection-deck-card__plant-name">{cfg?.name || dp.id}</span>
                              <span className="collection-deck-card__plant-stats-note">
                                🎲 {dp.statsCount} {dp.statsCount === 1 ? 'Stat' : 'Stats'} al azar
                              </span>
                              {dp.roleNote && (
                                <span className="collection-deck-card__plant-role-note">
                                  {dp.roleNote}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Main Body Grid & Detail Inspector */
        <div className="collection-body">
        {/* Grid Catalog */}
        <div className="collection-grid">
          {filteredCatalog.map((plant) => {
            const isSelected = selectedPlant.id === plant.id
            const rarity = PLANT_RARITIES[plant.id] || { label: 'COMÚN', short: 'C', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.2)' }
            const isUnlocked = (plantCopies ? (plantCopies[plant.id as PlantId] ?? 0) > 0 : false) || (unlockedPlants ? unlockedPlants.includes(plant.id as PlantId) : false) || (plant.id === 'sunflower' || plant.id === 'peashooter' || plant.id === 'wallnut' || plant.id === 'chomper')

            return (
              <button
                key={plant.id}
                type="button"
                className={`collection-card ${isSelected ? 'collection-card--selected' : ''} ${!isUnlocked ? 'collection-card--locked' : ''}`}
                onClick={() => {
                  setSelectedPlant(plant)
                  soundManager.playSound('plantation', 0.4)
                }}
              >
                <div className="collection-card__header-row">
                  <div className="collection-card__cost">
                    <img src={sunIcon} alt="Sol" className="collection-card__cost-icon" />
                    <span>{plant.cost}</span>
                  </div>

                  <span
                    className="collection-card__rarity-tag"
                    style={{
                      color: rarity.color,
                      borderColor: rarity.color,
                      backgroundColor: rarity.bg,
                    }}
                  >
                    {rarity.short}
                  </span>
                </div>

                <img src={plant.cardImage} alt={plant.name} className="collection-card__img" />
                {!isUnlocked && (
                  <div className="collection-card__lock-badge">
                    <span>🔒</span> Bloqueada
                  </div>
                )}
                <span className="collection-card__name">{plant.name}</span>
              </button>
            )
          })}
        </div>

        {/* Plant Detail Inspector Side Panel */}
        <div className="collection-inspector">
          <div className="collection-inspector__preview">
            <img
              src={selectedPlant.sprite}
              alt={selectedPlant.name}
              className="collection-inspector__sprite"
            />
          </div>

          <div className="collection-inspector__info">
            <div className="collection-inspector__title-row">
              <h2 className="collection-inspector__name">{selectedPlant.name}</h2>
              <span
                className="collection-inspector__rarity-badge"
                style={{
                  color: selectedRarity.color,
                  borderColor: selectedRarity.color,
                  backgroundColor: selectedRarity.bg,
                }}
              >
                {selectedRarity.label}
              </span>
            </div>

            <span className="collection-inspector__badge">{selectedPlant.categoryLabel}</span>

            {(() => {
              const isSelectedUnlocked = (plantCopies ? (plantCopies[selectedPlant.id as PlantId] ?? 0) > 0 : false) || (unlockedPlants ? unlockedPlants.includes(selectedPlant.id as PlantId) : false) || (selectedPlant.id === 'sunflower' || selectedPlant.id === 'peashooter' || selectedPlant.id === 'wallnut' || selectedPlant.id === 'chomper')
              const copies = plantCopies ? (plantCopies[selectedPlant.id as PlantId] ?? 0) : 0
              const level = plantLevels ? (plantLevels[selectedPlant.id as PlantId] ?? 0) : 0

              if (!isSelectedUnlocked) {
                return (
                  <div className="collection-inspector__locked-notice">
                    <span>🔒</span>
                    <span>BLOQUEADA (0 Copias) · Desbloquéala en sobres de la arena o en la Tienda</span>
                  </div>
                )
              }
              return (
                <div style={{ color: '#86efac', fontSize: '13px', fontWeight: 800, margin: '6px 0' }}>
                  ✨ DESBLOQUEADA · Nivel {level} · {copies} {copies === 1 ? 'Copia' : 'Copias'}
                </div>
              )
            })()}

            {/* Stats Row */}
            <div className="collection-stats">
              <div className="collection-stat">
                <span className="collection-stat__label">COSTO DE SOL</span>
                <span className="collection-stat__val collection-stat__val--sun">
                  ☀️ {selectedPlant.cost}
                </span>
              </div>

              <div className="collection-stat">
                <span className="collection-stat__label">RECARGA</span>
                <span className="collection-stat__val">⏱️ {selectedPlant.cooldownSec}s</span>
              </div>

              <div className="collection-stat">
                <span className="collection-stat__label">SALUD (HP)</span>
                <span className="collection-stat__val collection-stat__val--hp">
                  ❤️ {selectedPlant.hp}
                </span>
              </div>

              <div className="collection-stat">
                <span className="collection-stat__label">DAÑO / EFECTO</span>
                <span className="collection-stat__val collection-stat__val--dmg">
                  ⚔️ {selectedPlant.damage}
                </span>
              </div>
            </div>

            {/* Description & Lore */}
            <div className="collection-inspector__text-box">
              <p className="collection-inspector__desc">{selectedPlant.description}</p>
              <blockquote className="collection-inspector__lore">
                "{selectedPlant.lore}"
              </blockquote>
            </div>

            {/* Sound & Practice Test Button */}
            <button
              type="button"
              className="collection-inspector__sound-btn"
              onClick={() => {
                playPreviewSound()
                if (onPracticePlant) {
                  onPracticePlant(selectedPlant.id)
                }
              }}
              title="Probar disparos y explosiones en el Campo de Batalla"
            >
              🎯 Probar en Batalla
            </button>
          </div>
        </div>
      </div>
      )}

      {/* CONFIRM RENT MODAL */}
      {rentModalDeck && (
        <div className="collection-modal-overlay">
          <div className="collection-modal-content">
            <div className="collection-modal-icon">💎</div>
            <h3 className="collection-modal-title">CONFIRMAR ALQUILER DE DECK</h3>
            <p className="collection-modal-desc">
              ¿Deseas alquilar <strong>{rentModalDeck.title}</strong> por <strong>{rentModalDeck.priceGems} Gemas 💎</strong> durante <strong>7 Días</strong>?
            </p>
            <div className="collection-modal-bullets">
              <div>✨ Se generarán 6 plantas con <strong>estadísticas aleatorias únicas</strong>.</div>
              <div>✨ Podrás equiparlas y combinarlas libremente con tus cartas en el Jardín.</div>
              <div>✨ Duración garantizada: 7 Días completos.</div>
            </div>
            <div className="collection-modal-actions">
              <button
                type="button"
                className="collection-modal-btn collection-modal-btn--cancel"
                onClick={() => setRentModalDeck(null)}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="collection-modal-btn collection-modal-btn--confirm"
                onClick={() => handleConfirmRentDeck(rentModalDeck)}
              >
                💎 CONFIRMAR ({rentModalDeck.priceGems} 💎)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT MESSAGE MODAL */}
      {alertMessage && (
        <div className="collection-modal-overlay">
          <div className="collection-modal-content">
            <div className="collection-modal-icon">{alertMessage.icon}</div>
            <h3 className="collection-modal-title">{alertMessage.title}</h3>
            <p className="collection-modal-desc" style={{ whiteSpace: 'pre-line' }}>
              {alertMessage.message}
            </p>
            <div className="collection-modal-actions">
              <button
                type="button"
                className={`collection-modal-btn ${alertMessage.isSuccess ? 'collection-modal-btn--confirm' : 'collection-modal-btn--cancel'}`}
                onClick={() => setAlertMessage(null)}
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
