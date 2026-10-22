import { useState, useEffect, useMemo, useRef } from 'react'
import {
  STREAMING_PLATFORMS,
  STREAMING_SERVERS,
  DEFAULT_STREAMING_PRODUCTS,
  type StreamingProduct,
  type StreamingQueryResult,
  type StreamingPlatform,
  type StreamingServer,
  type StreamingOrder,
  type AdminStreamingOverview,
} from '../../types/streaming'
import { streamingService } from '../../services/streamingService'
import { getPlayerAvatarUrl } from '../../utils/userManager'
import { soundManager } from '../../utils/audioManager'
import './StreamingHub.css'

interface StreamingHubProps {
  userProfile?: {
    id?: string
    username?: string
    avatar_id?: string
    elo_rating?: number
    gems_balance?: number
    gold_balance?: number
    is_admin?: boolean
  } | null
  userEmail?: string | null
  isLoggedIn?: boolean
  onOpenAuth?: () => void
  onBack: () => void
  initialTab?: 'catalog' | 'bot' | 'my_accounts' | 'admin'
  initialPlatform?: string
}

export default function StreamingHub({
  userProfile,
  userEmail,
  isLoggedIn = false,
  onOpenAuth,
  onBack,
  initialTab = 'catalog',
  initialPlatform,
}: StreamingHubProps) {
  const [activeTab, setActiveTab] = useState<'catalog' | 'bot' | 'my_accounts' | 'admin'>(initialTab)

  // Sincronización de Correo con Sesión de Usuario
  const [useCustomEmail, setUseCustomEmail] = useState<boolean>(false)
  const [email, setEmail] = useState<string>(() => userEmail || '')
  const [botCode, setBotCode] = useState<string>('')
  const [selectedServer, setSelectedServer] = useState<StreamingServer>(STREAMING_SERVERS[0])
  const [selectedPlatform, setSelectedPlatform] = useState<StreamingPlatform>(() => {
    if (initialPlatform) {
      const found = STREAMING_PLATFORMS.find((p) => p.value.toLowerCase() === initialPlatform.toLowerCase())
      if (found) return found
    }
    return STREAMING_PLATFORMS[0]
  })

  // Dropdown states
  const [isServerDropdownOpen, setIsServerDropdownOpen] = useState(false)
  const [isPlatformDropdownOpen, setIsPlatformDropdownOpen] = useState(false)

  // Catálogo y filtros
  const [catalogSearch, setCatalogSearch] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [products] = useState<StreamingProduct[]>(DEFAULT_STREAMING_PRODUCTS)
  const [modalProduct, setModalProduct] = useState<StreamingProduct | null>(null)

  // Estado de consulta del Bot
  const [isQuerying, setIsQuerying] = useState<boolean>(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [queryResult, setQueryResult] = useState<StreamingQueryResult | null>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)
  const [toastNotification, setToastNotification] = useState<string | null>(null)

  // Estado de Stock en Vivo y Compras
  const [stockMap, setStockMap] = useState<Record<string, number>>({})
  const [myOrders, setMyOrders] = useState<StreamingOrder[]>([])
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false)
  const [selectedRegion, setSelectedRegion] = useState<'peru' | 'extranjero' | ''>('')
  const [purchaseSuccessData, setPurchaseSuccessData] = useState<{
    isOnDemand: boolean
    productName: string
    accountRegion?: string
    email?: string
    password?: string
    profileNumber?: number
    profilePin?: string | null
    botCode?: string
    message: string
  } | null>(null)

  // Estado del Panel de Administrador (para stock y entregas de Netflix)
  const [adminOverview, setAdminOverview] = useState<AdminStreamingOverview | null>(null)
  const [isAdminSubmitting, setIsAdminSubmitting] = useState<boolean>(false)
  const [adminPlatform, setAdminPlatform] = useState<string>('disney')
  const [adminAccountIdent, setAdminAccountIdent] = useState<string>('Cuenta A')
  const [adminEmail, setAdminEmail] = useState<string>('')
  const [adminPassword, setAdminPassword] = useState<string>('')
  const [adminBotCode, setAdminBotCode] = useState<string>('')
  const [adminProfilesCount, setAdminProfilesCount] = useState<number>(3)
  const [adminPin1, setAdminPin1] = useState<string>('')
  const [adminPin2, setAdminPin2] = useState<string>('')
  const [adminPin3, setAdminPin3] = useState<string>('')

  // Estado de entrega para orden pendiente en admin
  const [deliveringOrderId, setDeliveringOrderId] = useState<string | null>(null)
  const [delivEmail, setDelivEmail] = useState<string>('')
  const [delivPassword, setDelivPassword] = useState<string>('')
  const [delivProfile, setDelivProfile] = useState<number>(1)
  const [delivPin, setDelivPin] = useState<string>('')
  const [delivBotCode, setDelivBotCode] = useState<string>('')

  const serverDropdownRef = useRef<HTMLDivElement>(null)
  const platformDropdownRef = useRef<HTMLDivElement>(null)

  // Funciones de recarga
  const refreshStock = async () => {
    try {
      const summary = await streamingService.getStockSummary()
      setStockMap(summary)
    } catch {
      // Ignorar
    }
  }

  const refreshMyOrders = async () => {
    if (!isLoggedIn) return
    try {
      const orders = await streamingService.getMyOrders()
      setMyOrders(orders)
    } catch {
      // Ignorar
    }
  }

  const refreshAdminOverview = async () => {
    if (!userProfile?.is_admin) return
    try {
      const res = await streamingService.adminGetOverview()
      if (res.success && res.data) {
        setAdminOverview(res.data)
      }
    } catch {
      // Ignorar
    }
  }

  useEffect(() => {
    refreshStock()
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      refreshMyOrders()
    }
    if (userProfile?.is_admin) {
      refreshAdminOverview()
    }
  }, [isLoggedIn, userProfile?.is_admin])

  // Actualizar email cuando cambie la sesión si no se seleccionó custom email
  useEffect(() => {
    if (userEmail && !useCustomEmail) {
      setEmail(userEmail)
    }
  }, [userEmail, useCustomEmail])

  // Cerrar dropdowns al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (serverDropdownRef.current && !serverDropdownRef.current.contains(event.target as Node)) {
        setIsServerDropdownOpen(false)
      }
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(event.target as Node)) {
        setIsPlatformDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto dismiss toast notification
  useEffect(() => {
    if (!toastNotification) return
    const timer = setTimeout(() => {
      setToastNotification(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toastNotification])

  // Manejar clic en Yape ("Muy pronto" para todos los productos)
  const handleYapeClick = () => {
    soundManager.playSound('click', 0.5)
    setToastNotification('📱 Pagos con Yape: ¡Muy pronto disponible!')
  }

  // Manejar compra real con Gemas
  const handleBuyWithGems = async (product: StreamingProduct) => {
    soundManager.playSound('click', 0.5)
    if (!isLoggedIn) {
      setToastNotification('Debes iniciar sesión para canjear con Gemas.')
      onOpenAuth?.()
      return
    }

    const available = stockMap[product.id] ?? 0
    const isOnDemand = product.id === 'netflix' || product.id === 'gemini'
    if (!isOnDemand && available <= 0) {
      setToastNotification(`🔴 ${product.name} está temporalmente agotado.`)
      return
    }

    // Validación OBLIGATORIA de región para Netflix
    if (product.id === 'netflix' && (!selectedRegion || (selectedRegion !== 'peru' && selectedRegion !== 'extranjero'))) {
      setToastNotification('⚠️ Obligatorio: Selecciona si requieres cuenta para Perú o Extranjero.')
      soundManager.playSound('defeat', 0.4)
      return
    }

    const cost = product.gemCost || 300
    if ((userProfile?.gems_balance ?? 0) < cost) {
      setToastNotification(
        `💎 Saldo insuficiente: Tienes ${(userProfile?.gems_balance ?? 0).toLocaleString()} Gemas y se requieren ${cost.toLocaleString()} Gemas.`
      )
      return
    }

    setIsPurchasing(true)
    try {
      const res = await streamingService.buyProduct(product.id, product.id === 'netflix' ? selectedRegion : undefined)
      if (!res.success) {
        setToastNotification(`❌ ${res.error || 'Error al procesar el canje'}`)
        soundManager.playSound('defeat', 0.4)
      } else {
        soundManager.playSound('victory', 0.6)
        setModalProduct(null)
        setPurchaseSuccessData({
          isOnDemand: Boolean(res.is_on_demand),
          productName: product.name,
          accountRegion: res.account_region || (product.id === 'netflix' ? selectedRegion : undefined),
          email: res.email,
          password: res.password,
          profileNumber: res.profile_number,
          profilePin: res.profile_pin,
          botCode: res.bot_code,
          message: res.message || 'Canje completado con éxito.',
        })
        setSelectedRegion('')
        if (userProfile && res.new_gems_balance !== undefined) {
          userProfile.gems_balance = res.new_gems_balance
        }
        refreshStock()
        refreshMyOrders()
      }
    } catch (err: any) {
      setToastNotification(`❌ ${err?.message || 'Error de conexión'}`)
    } finally {
      setIsPurchasing(false)
    }
  }

  // Ir directamente al BOT con credenciales precargadas
  const handleDirectToBot = (accountEmail?: string | null, accountBotCode?: string | null, platformId?: string) => {
    if (accountEmail) {
      setEmail(accountEmail)
      setUseCustomEmail(true)
    }
    if (accountBotCode) {
      setBotCode(accountBotCode)
    }
    if (platformId) {
      const found = STREAMING_PLATFORMS.find((p) => p.value.toLowerCase() === platformId.toLowerCase())
      if (found) setSelectedPlatform(found)
    }
    setActiveTab('bot')
    setPurchaseSuccessData(null)
    soundManager.playSound('click', 0.5)
  }

  // Handlers para el Panel de Administrador
  const handleAdminAddBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail.trim() || !adminPassword.trim() || !adminBotCode.trim()) {
      setToastNotification('Por favor completa el email, contraseña y código BOT.')
      return
    }
    setIsAdminSubmitting(true)
    try {
      const pins = [adminPin1, adminPin2, adminPin3].filter((p) => p.trim())
      const res = await streamingService.adminAddBatch({
        platform: adminPlatform,
        accountIdentifier: adminAccountIdent,
        accountEmail: adminEmail,
        accountPassword: adminPassword,
        botCode: adminBotCode,
        profileCount: adminProfilesCount,
        pins: pins.length > 0 ? pins : undefined,
      })

      if (res.success) {
        soundManager.playSound('victory', 0.5)
        setToastNotification(`✅ ¡Lote creado! Se agregaron ${res.inserted_profiles} perfiles en stock.`)
        setAdminEmail('')
        setAdminPassword('')
        setAdminBotCode('')
        setAdminPin1('')
        setAdminPin2('')
        setAdminPin3('')
        refreshStock()
        refreshAdminOverview()
      } else {
        setToastNotification(`❌ ${res.error || 'Error al agregar lote'}`)
      }
    } finally {
      setIsAdminSubmitting(false)
    }
  }

  const handleAdminDeliverOrder = async (orderId: string) => {
    if (!delivEmail.trim() || !delivPassword.trim()) {
      setToastNotification('Por favor completa el email y contraseña.')
      return
    }
    const res = await streamingService.adminDeliverOrder({
      orderId,
      email: delivEmail,
      password: delivPassword,
      profileNumber: delivProfile,
      profilePin: delivPin || undefined,
      botCode: delivBotCode || undefined,
    })
    if (res.success) {
      soundManager.playSound('victory', 0.5)
      setToastNotification('✅ ¡Orden entregada al usuario!')
      setDeliveringOrderId(null)
      setDelivEmail('')
      setDelivPassword('')
      setDelivPin('')
      setDelivBotCode('')
      refreshAdminOverview()
    } else {
      setToastNotification(`❌ ${res.error || 'Error al entregar orden'}`)
    }
  }

  const handleAdminDeleteProfile = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este perfil libre del inventario?')) return
    const res = await streamingService.adminDeleteProfile(id)
    if (res.success) {
      setToastNotification('Perfil eliminado del stock.')
      refreshStock()
      refreshAdminOverview()
    }
  }
  const filteredProducts = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim()
    return products.filter((item) => {
      const matchCat =
        selectedCategory === 'all' || item.type.toLowerCase() === selectedCategory.toLowerCase()
      const matchQ =
        !q || item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      return matchCat && matchQ
    })
  }, [products, catalogSearch, selectedCategory])

  // Manejar envío de consulta BOT
  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setQueryError(null)
    setQueryResult(null)

    const cleanEmail = email.trim()
    const cleanBotCode = botCode.trim()

    if (!cleanEmail) {
      setQueryError('El correo electrónico es obligatorio para verificar el código.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      setQueryError('Por favor introduce un correo electrónico válido.')
      return
    }

    if (!cleanBotCode) {
      setQueryError('Por favor ingresa el código BOT o token de solicitud.')
      return
    }

    setIsQuerying(true)
    soundManager.playSound('click', 0.5)

    try {
      const result = await streamingService.consultarCodigo({
        email: cleanEmail,
        botCode: cleanBotCode,
        type: selectedPlatform.value,
        server: selectedServer.value,
      })

      if (!result.success) {
        setQueryError(result.error || 'No se encontró el código o el proveedor no respondió.')
      } else {
        setQueryResult(result)
        soundManager.playSound('victory', 0.5)
      }
    } catch (err: any) {
      setQueryError(err.message || 'Error de comunicación al consultar el código.')
    } finally {
      setIsQuerying(false)
    }
  }

  // Copiar código al portapapeles
  const handleCopyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setIsCopied(true)
      soundManager.playSound('click', 0.6)
      setTimeout(() => setIsCopied(false), 2500)
    } catch {
      // Fallback manual si clipboard API no está disponible
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
    }
  }

  // Abrir Bot directamente con una plataforma preseleccionada
  const handleGoToBotWithPlatform = (botType?: string) => {
    if (botType) {
      const found = STREAMING_PLATFORMS.find((p) => p.value.toLowerCase() === botType.toLowerCase())
      if (found) setSelectedPlatform(found)
    }
    setActiveTab('bot')
    setModalProduct(null)
    soundManager.playSound('click', 0.5)
  }

  return (
    <div className="streaming-hub">
      {/* Background Glows */}
      <div className="streaming-hub__bg-glows">
        <div className="streaming-hub__glow-1" />
        <div className="streaming-hub__glow-2" />
        <div className="streaming-hub__glow-3" />
      </div>

      <div className="streaming-hub__content-wrapper">
        {/* Toast Notification Banner */}
        {toastNotification && (
          <div className="streaming-toast animate-fade-in">
            <div className="streaming-toast__box">
              <span className="streaming-toast__text">{toastNotification}</span>
              <button
                type="button"
                className="streaming-toast__close"
                onClick={() => setToastNotification(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Navigation & User Session Header */}
        <header className="streaming-hub__header">
          {/* Brand */}
          <div className="streaming-hub__brand" onClick={() => setActiveTab('catalog')}>
            <img src="/images/logo.png" alt="Plants Arena Logo" className="streaming-hub__logo" />
            <div className="streaming-hub__title-wrap">
              <div className="streaming-hub__brand-title">
                <span>Plants Arena</span>
                <span className="streaming-hub__vip-badge">STREAMING VIP</span>
              </div>
              <span className="streaming-hub__brand-sub">Tienda Oficial &amp; BOT de Códigos</span>
            </div>
          </div>

          {/* User Session & Back Controls */}
          <div className="streaming-hub__user-session">
            {isLoggedIn && userProfile ? (
              <div
                className="streaming-hub__session-pill"
                title={`Sesión iniciada como ${userProfile.username || 'Usuario'}`}
              >
                <img
                  src={getPlayerAvatarUrl(userProfile.avatar_id)}
                  alt="Avatar"
                  className="streaming-hub__user-avatar"
                />
                <div className="streaming-hub__session-info">
                  <span className="streaming-hub__session-name">
                    <span>{userProfile.username || 'Guerrero'}</span>
                    <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>
                      ★ {userProfile.elo_rating || 1000}
                    </span>
                  </span>
                  <span className="streaming-hub__session-email">
                    {userEmail || 'Cuenta Conectada'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="streaming-hub__session-pill">
                <div className="streaming-hub__session-info">
                  <span className="streaming-hub__session-guest">Invitado</span>
                </div>
                {onOpenAuth && (
                  <button
                    type="button"
                    className="streaming-hub__auth-btn"
                    onClick={() => {
                      soundManager.playSound('click', 0.5)
                      onOpenAuth()
                    }}
                  >
                    Conectar Cuenta
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="streaming-hub__back-btn"
              onClick={() => {
                soundManager.playSound('click', 0.5)
                onBack()
              }}
            >
              <span>← Volver al Menú</span>
            </button>
          </div>
        </header>

        {/* View Switcher Tabs */}
        <div className="streaming-hub__tabs">
          <button
            type="button"
            className={`streaming-hub__tab-btn ${
              activeTab === 'catalog' ? 'streaming-hub__tab-btn--active' : ''
            }`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setActiveTab('catalog')
            }}
          >
            <span>🛒 Catálogo de Cuentas</span>
            <span className="streaming-hub__tab-badge">13 SERVICIOS</span>
          </button>

          <button
            type="button"
            className={`streaming-hub__tab-btn ${
              activeTab === 'bot' ? 'streaming-hub__tab-btn--active' : ''
            }`}
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setActiveTab('bot')
            }}
          >
            <span>🤖 BOT Verificador de Códigos</span>
            <span className="streaming-hub__tab-badge" style={{ background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd' }}>
              AUTOMÁTICO
            </span>
          </button>

          {isLoggedIn && (
            <button
              type="button"
              className={`streaming-hub__tab-btn ${
                activeTab === 'my_accounts' ? 'streaming-hub__tab-btn--active' : ''
              }`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('my_accounts')
                refreshMyOrders()
              }}
            >
              <span>📦 Mis Suscripciones</span>
              {myOrders.length > 0 && (
                <span className="streaming-hub__tab-badge" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7' }}>
                  {myOrders.length} ACTIVAS
                </span>
              )}
            </button>
          )}

          {isLoggedIn && userProfile?.is_admin && (
            <button
              type="button"
              className={`streaming-hub__tab-btn ${
                activeTab === 'admin' ? 'streaming-hub__tab-btn--active' : ''
              }`}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setActiveTab('admin')
                refreshAdminOverview()
              }}
            >
              <span>⚙️ Stock &amp; Admin</span>
              <span className="streaming-hub__tab-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}>
                ADMIN
              </span>
            </button>
          )}
        </div>

        {/* ================================================================= */}
        {/* TAB 1: CATÁLOGO DE CUENTAS STREAMING */}
        {/* ================================================================= */}
        {activeTab === 'catalog' && (
          <div className="streaming-catalog animate-fade-in">
            {/* Hero Section */}
            <div className="streaming-hero">
              <div className="streaming-hero__glow" />
              <div className="streaming-hero__badge">
                <span className="streaming-hero__pulse" />
                <span>Garantía Total y Entrega Inmediata 24/7</span>
              </div>
              <h1 className="streaming-hero__title">
                Membresías Premium &amp;{' '}
                <span className="streaming-hero__title-gradient">Códigos al Instante</span>
              </h1>
              <p className="streaming-hero__desc">
                Disfruta de Disney+, Prime Video, Max, Crunchyroll, ChatGPT Plus, Gemini Pro y más con
                perfiles privados o cuentas garantizadas en Gemas o soles. Si ya posees una cuenta con nosotros,
                utiliza el BOT para consultar tus códigos de acceso.
              </p>
              <div className="streaming-hero__actions">
                <button
                  type="button"
                  className="streaming-hero__btn-primary"
                  onClick={() => {
                    const el = document.getElementById('catalog-products-section')
                    el?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  Ver Catálogo de Precios
                </button>
                <button
                  type="button"
                  className="streaming-hero__btn-secondary"
                  onClick={() => {
                    soundManager.playSound('click', 0.5)
                    setActiveTab('bot')
                  }}
                >
                  <svg style={{ width: 18, height: 18, color: '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>Abrir BOT de Códigos</span>
                </button>
              </div>
            </div>

            {/* Catalog Filter Bar */}
            <div id="catalog-products-section" className="catalog-bar">
              {/* Category Pills */}
              <div className="catalog-bar__pills">
                <button
                  type="button"
                  className={`catalog-bar__pill ${selectedCategory === 'all' ? 'catalog-bar__pill--active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  Todos
                </button>
                <button
                  type="button"
                  className={`catalog-bar__pill ${selectedCategory === 'Streaming' ? 'catalog-bar__pill--active' : ''}`}
                  onClick={() => setSelectedCategory('Streaming')}
                >
                  Streaming
                </button>
                <button
                  type="button"
                  className={`catalog-bar__pill ${selectedCategory === 'IA & Herramientas' ? 'catalog-bar__pill--active' : ''}`}
                  onClick={() => setSelectedCategory('IA & Herramientas')}
                >
                  IA &amp; Herramientas
                </button>
                <button
                  type="button"
                  className={`catalog-bar__pill ${selectedCategory === 'Anime & Cine' ? 'catalog-bar__pill--active' : ''}`}
                  onClick={() => setSelectedCategory('Anime & Cine')}
                >
                  Anime &amp; Doramas
                </button>
                <button
                  type="button"
                  className={`catalog-bar__pill ${selectedCategory === 'Música' ? 'catalog-bar__pill--active' : ''}`}
                  onClick={() => setSelectedCategory('Música')}
                >
                  Música
                </button>
              </div>

              {/* Search */}
              <div className="catalog-bar__search">
                <svg className="catalog-bar__search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar cuenta o servicio..."
                  className="catalog-bar__input"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Products Grid */}
            <div className="streaming-grid">
              {filteredProducts.map((item) => {
                const isOnDemand = item.id === 'netflix' || item.id === 'gemini'
                const available = stockMap[item.id] ?? 0
                const isOutOfStock = !isOnDemand && available <= 0

                return (
                  <div
                    key={item.id}
                    className={`streaming-card ${isOutOfStock ? 'streaming-card--out-of-stock' : ''}`}
                  >
                    <div className="streaming-card__glow-bar" />
                    <div>
                      <div className="streaming-card__top">
                        <div className="streaming-card__icon-wrap">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="streaming-card__icon"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = '/images/helpers/disney.webp'
                            }}
                          />
                        </div>
                        <div className="streaming-card__badges">
                          {isOnDemand ? (
                            <span className="streaming-card__badge streaming-card__badge--ondemand">
                              ⏳ A Pedido · 30 min
                            </span>
                          ) : isOutOfStock ? (
                            <span className="streaming-card__badge streaming-card__badge--out">
                              🔴 AGOTADO
                            </span>
                          ) : available <= 2 ? (
                            <span className="streaming-card__badge streaming-card__badge--low">
                              🔥 ¡Últimos {available}!
                            </span>
                          ) : (
                            <span className="streaming-card__badge streaming-card__badge--instock">
                              🟢 {available} disponibles
                            </span>
                          )}

                          {item.originalPrice && (
                            <span className="streaming-card__original-price">{item.originalPrice}</span>
                          )}
                        </div>
                      </div>

                      <h3 className="streaming-card__title">{item.name}</h3>
                      <p className="streaming-card__desc">{item.description}</p>
                    </div>

                    <div className="streaming-card__bottom">
                      <div className="streaming-card__price-row">
                        <span className="streaming-card__price-label">Desde</span>
                        <span className="streaming-card__price-value">{item.price}</span>
                      </div>

                      <div className="streaming-card__btn-row">
                        <button
                          type="button"
                          className={`streaming-card__btn-buy ${
                            isOutOfStock ? 'streaming-card__btn-buy--disabled' : ''
                          }`}
                          disabled={isOutOfStock}
                          onClick={() => {
                            if (isOutOfStock) return
                            soundManager.playSound('click', 0.5)
                            setSelectedRegion('')
                            setModalProduct(item)
                          }}
                        >
                          {isOutOfStock ? 'Sin Stock' : isOnDemand ? 'Pedir 4K' : 'Comprar'}
                        </button>
                        <button
                          type="button"
                          className="streaming-card__btn-bot"
                          title={`Consultar código para ${item.name}`}
                          onClick={() => handleGoToBotWithPlatform(item.botType || item.id)}
                        >
                          <svg style={{ width: 14, height: 14, color: '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          <span>Bot</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: BOT VERIFICADOR DE CÓDIGOS */}
        {/* ================================================================= */}
        {activeTab === 'bot' && (
          <div className="streaming-bot animate-fade-in">
            <div className="streaming-bot__card">
              <div className="streaming-bot__header">
                <span className="streaming-bot__badge">
                  <span className="streaming-hero__pulse" />
                  <span>Sistema Automatizado de Códigos</span>
                </span>
                <h2 className="streaming-bot__title">Consulta de Códigos &amp; Enlaces</h2>
                <p className="streaming-bot__subtitle">
                  Elige tu plataforma e ingresa tus credenciales autorizadas para extraer tu código de
                  verificación o enlace de acceso en segundos.
                </p>
              </div>

              {/* Error Banner */}
              {queryError && (
                <div className="streaming-bot__error-banner animate-fade-in">
                  <svg style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{queryError}</span>
                  <button
                    type="button"
                    className="streaming-bot__error-close"
                    onClick={() => setQueryError(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Query Form */}
              <form className="bot-form" onSubmit={handleQuerySubmit}>
                {/* Row: Server and Platform */}
                <div className="bot-form__row">
                  {/* Server Dropdown */}
                  <div className="bot-form__group" ref={serverDropdownRef}>
                    <label className="bot-form__label">Servidor</label>
                    <div className="bot-dropdown">
                      <button
                        type="button"
                        className="bot-dropdown__trigger"
                        onClick={() => {
                          setIsServerDropdownOpen(!isServerDropdownOpen)
                          setIsPlatformDropdownOpen(false)
                        }}
                      >
                        <div className="bot-dropdown__selection">
                          <img
                            src={selectedServer.image}
                            alt={selectedServer.label}
                            className="bot-dropdown__icon"
                          />
                          <span>{selectedServer.label}</span>
                        </div>
                        <svg
                          className={`bot-dropdown__chevron ${
                            isServerDropdownOpen ? 'bot-dropdown__chevron--open' : ''
                          }`}
                          style={{ width: 16, height: 16 }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isServerDropdownOpen && (
                        <div className="bot-dropdown__menu animate-fade-in">
                          {STREAMING_SERVERS.map((srv) => (
                            <div
                              key={srv.value}
                              className={`bot-dropdown__item ${
                                selectedServer.value === srv.value ? 'bot-dropdown__item--selected' : ''
                              }`}
                              onClick={() => {
                                setSelectedServer(srv)
                                setIsServerDropdownOpen(false)
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <img src={srv.image} alt={srv.label} className="bot-dropdown__icon" />
                                <span>{srv.label}</span>
                              </div>
                              {selectedServer.value === srv.value && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Platform Dropdown */}
                  <div className="bot-form__group" ref={platformDropdownRef}>
                    <label className="bot-form__label">Plataforma / Servicio</label>
                    <div className="bot-dropdown">
                      <button
                        type="button"
                        className="bot-dropdown__trigger"
                        onClick={() => {
                          setIsPlatformDropdownOpen(!isPlatformDropdownOpen)
                          setIsServerDropdownOpen(false)
                        }}
                      >
                        <div className="bot-dropdown__selection">
                          <img
                            src={selectedPlatform.image}
                            alt={selectedPlatform.label}
                            className="bot-dropdown__icon"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = '/images/helpers/disney.webp'
                            }}
                          />
                          <span>{selectedPlatform.label}</span>
                        </div>
                        <svg
                          className={`bot-dropdown__chevron ${
                            isPlatformDropdownOpen ? 'bot-dropdown__chevron--open' : ''
                          }`}
                          style={{ width: 16, height: 16 }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isPlatformDropdownOpen && (
                        <div className="bot-dropdown__menu animate-fade-in">
                          {STREAMING_PLATFORMS.map((plat) => (
                            <div
                              key={plat.value}
                              className={`bot-dropdown__item ${
                                selectedPlatform.value === plat.value ? 'bot-dropdown__item--selected' : ''
                              }`}
                              onClick={() => {
                                setSelectedPlatform(plat)
                                setIsPlatformDropdownOpen(false)
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <img
                                  src={plat.image}
                                  alt={plat.label}
                                  className="bot-dropdown__icon"
                                  onError={(e) => {
                                    ;(e.target as HTMLImageElement).src = '/images/helpers/disney.webp'
                                  }}
                                />
                                <span>{plat.label}</span>
                              </div>
                              {selectedPlatform.value === plat.value && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email Input with User Session Link */}
                <div className="bot-form__group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="bot-form__label">
                      Correo Electrónico de la Cuenta <span className="bot-form__req">*</span>
                    </label>
                    {isLoggedIn && userEmail && (
                      <span className="bot-form__session-sync">
                        {useCustomEmail ? (
                          <button
                            type="button"
                            className="bot-form__session-toggle"
                            onClick={() => {
                              setUseCustomEmail(false)
                              setEmail(userEmail)
                            }}
                          >
                            Restablecer a mi correo de cuenta ({userEmail})
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="bot-form__session-toggle"
                            onClick={() => setUseCustomEmail(true)}
                          >
                            Usar otro correo
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  <div className="bot-form__input-wrap">
                    <svg className="bot-form__input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    <input
                      type="email"
                      required
                      placeholder="usuario@ejemplo.com"
                      className="bot-form__input"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (isLoggedIn && userEmail && e.target.value !== userEmail) {
                          setUseCustomEmail(true)
                        }
                      }}
                    />
                  </div>
                  {isLoggedIn && !useCustomEmail && userEmail && (
                    <span className="bot-form__hint" style={{ color: '#4ade80' }}>
                      ✓ Sincronizado automáticamente con tu cuenta de Plants Arena
                    </span>
                  )}
                </div>

                {/* BOT Code Input */}
                <div className="bot-form__group">
                  <label className="bot-form__label">
                    Código BOT / Token de Solicitud <span className="bot-form__req">*</span>
                  </label>
                  <div className="bot-form__input-wrap">
                    <svg className="bot-form__input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <input
                      type="text"
                      required
                      placeholder="Ej: COD-98765 o 123456"
                      className="bot-form__input bot-form__input--mono"
                      value={botCode}
                      onChange={(e) => setBotCode(e.target.value)}
                    />
                  </div>
                  <span className="bot-form__hint">
                    Código de autorización asignado para consultar los mensajes y códigos de tu cuenta.
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="bot-form__submit-btn"
                  disabled={isQuerying}
                >
                  {isQuerying ? (
                    <>
                      <svg className="bot-form__spinner" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Consultando al proveedor...</span>
                    </>
                  ) : (
                    <>
                      <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Consultar Código</span>
                    </>
                  )}
                </button>
              </form>

              {/* Dedicated Result Display Box */}
              {queryResult?.data && (
                <div className="bot-result">
                  <div className="bot-result__box">
                    <div className="bot-result__glow-line" />

                    <div className="bot-result__top">
                      <span className="bot-result__badge">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                        <span>Código Verificado</span>
                      </span>

                      <div className="bot-result__platform-pill">
                        <img
                          src={selectedPlatform.image}
                          alt={selectedPlatform.label}
                          className="bot-result__platform-icon"
                        />
                        <span>{selectedPlatform.label}</span>
                      </div>
                    </div>

                    <p className="bot-result__subject">{queryResult.data.subject}</p>

                    {/* Result is CODE */}
                    {queryResult.data.extracted.type === 'code' && (
                      <div className="bot-result__code-section">
                        <p className="bot-result__code-label">CÓDIGO OBTENIDO</p>
                        <span className="bot-result__code-value">
                          {queryResult.data.extracted.value}
                        </span>
                        <div>
                          <button
                            type="button"
                            className={`bot-result__copy-btn ${isCopied ? 'bot-result__copy-btn--copied' : ''}`}
                            onClick={() => handleCopyCode(queryResult.data!.extracted.value)}
                          >
                            {isCopied ? (
                              <>
                                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>¡Copiado con Éxito!</span>
                              </>
                            ) : (
                              <>
                                <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                </svg>
                                <span>Copiar al Portapapeles</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Result is LINK */}
                    {queryResult.data.extracted.type === 'link' && (
                      <div className="bot-result__link-section">
                        <p className="bot-result__code-label">ENLACE DE ACTIVACIÓN / VERIFICACIÓN</p>
                        <a
                          href={queryResult.data.extracted.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bot-result__link-btn"
                        >
                          <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span>Abrir Enlace de Verificación</span>
                        </a>
                        <p className="bot-result__link-url">{queryResult.data.extracted.value}</p>
                      </div>
                    )}

                    {/* Fallback HTML */}
                    {queryResult.data.extracted.type === 'html' && (
                      <div
                        style={{
                          background: 'rgba(15, 23, 42, 0.95)',
                          padding: 16,
                          borderRadius: 12,
                          marginBottom: 16,
                          overflowX: 'auto',
                          fontSize: '0.8rem',
                        }}
                        dangerouslySetInnerHTML={{ __html: queryResult.data.extracted.value }}
                      />
                    )}

                    <div className="bot-result__notice">
                      <svg style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2, color: '#f59e0b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>
                        El código o enlace obtenido es válido por un máximo de <strong>15 minutos</strong>. En
                        caso de expirar, solicita uno nuevo en tu pantalla o dispositivo.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: MIS SUSCRIPCIONES / CUENTAS */}
        {/* ================================================================= */}
        {activeTab === 'my_accounts' && (
          <div className="streaming-subs animate-fade-in">
            <div className="streaming-hero" style={{ padding: '24px 20px', marginBottom: 20 }}>
              <div className="streaming-hero__badge">
                <span className="streaming-hero__pulse" />
                <span>Tus Accesos y Credenciales Seguras</span>
              </div>
              <h2 className="streaming-hero__title" style={{ fontSize: '1.6rem' }}>
                Mis <span className="streaming-hero__title-gradient">Suscripciones VIP</span>
              </h2>
              <p className="streaming-hero__desc" style={{ maxWidth: 640 }}>
                Aquí encuentras los correos, contraseñas y perfiles asignados a tu cuenta. Puedes consultar tus
                códigos de inicio de sesión con 1 clic en el BOT.
              </p>
            </div>

            {myOrders.length === 0 ? (
              <div className="streaming-subs__empty">
                <div className="streaming-subs__empty-icon">📺</div>
                <h3 className="streaming-subs__empty-title">Aún no tienes suscripciones activas</h3>
                <p className="streaming-subs__empty-desc">
                  Adquiere perfiles de Netflix 4K, Disney+, Max, Prime Video o Crunchyroll con entrega garantizada
                  usando tus Gemas o soles.
                </p>
                <button
                  type="button"
                  className="streaming-hero__btn-primary"
                  onClick={() => setActiveTab('catalog')}
                >
                  Explorar Catálogo de Cuentas
                </button>
              </div>
            ) : (
              <div className="streaming-subs__grid">
                {myOrders.map((ord) => {
                  const plat = STREAMING_PLATFORMS.find((p) => p.value.toLowerCase() === ord.platform.toLowerCase())
                  const isPending = ord.order_status === 'pending'

                  return (
                    <div key={ord.id} className="streaming-sub-card">
                      <div className="streaming-sub-card__glow" />

                      <div className="streaming-sub-card__top">
                        <div className="streaming-sub-card__platform">
                          <img
                            src={plat?.image || '/images/helpers/disney.webp'}
                            alt={ord.product_name}
                            className="streaming-sub-card__icon"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).src = '/images/helpers/disney.webp'
                            }}
                          />
                          <div>
                            <h4 className="streaming-sub-card__name">{ord.product_name}</h4>
                            <span className="streaming-sub-card__profile-tag">
                              {ord.profile_number ? `Perfil Asignado: #${ord.profile_number}` : 'A Pedido'}
                              {ord.account_region && (
                                <span style={{ marginLeft: 6, fontWeight: 700, color: ord.account_region === 'peru' ? '#f87171' : '#38bdf8' }}>
                                  · {ord.account_region === 'peru' ? '🇵🇪 Perú' : '🌎 Extranjero'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`streaming-sub-card__badge ${
                            isPending ? 'streaming-sub-card__badge--pending' : 'streaming-sub-card__badge--active'
                          }`}
                        >
                          {isPending ? '⏳ En Preparación' : `🟢 Activa (${ord.days_remaining}d)`}
                        </span>
                      </div>

                      {isPending ? (
                        <div
                          style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: 10,
                            padding: 16,
                            textAlign: 'center',
                          }}
                        >
                          <p style={{ color: '#fde047', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>
                            ⏳ Preparando tu cuenta (~30 min)
                          </p>
                          <p style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                            El administrador está activando tu perfil 4K exclusivo. En cuanto esté listo, tus
                            credenciales aparecerán aquí automáticamente.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="streaming-sub-card__fields">
                            {/* Correo */}
                            <div className="streaming-sub-card__field">
                              <span className="streaming-sub-card__label">Correo:</span>
                              <div className="streaming-sub-card__val-wrap">
                                <span className="streaming-sub-card__val">{ord.email}</span>
                                <button
                                  type="button"
                                  className="streaming-sub-card__copy-btn"
                                  onClick={() => handleCopyCode(ord.email || '')}
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>

                            {/* Contraseña */}
                            <div className="streaming-sub-card__field">
                              <span className="streaming-sub-card__label">Clave:</span>
                              <div className="streaming-sub-card__val-wrap">
                                <span className="streaming-sub-card__val">{ord.password}</span>
                                <button
                                  type="button"
                                  className="streaming-sub-card__copy-btn"
                                  onClick={() => handleCopyCode(ord.password || '')}
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>

                            {/* Perfil & PIN */}
                            <div className="streaming-sub-card__field">
                              <span className="streaming-sub-card__label">Perfil Asignado:</span>
                              <span className="streaming-sub-card__val" style={{ color: '#38bdf8' }}>
                                Perfil {ord.profile_number || 1} {ord.profile_pin ? `(PIN: ${ord.profile_pin})` : ''}
                              </span>
                            </div>

                            {/* Token / Bot Code */}
                            {ord.bot_code && (
                              <div className="streaming-sub-card__field">
                                <span className="streaming-sub-card__label">Token BOT:</span>
                                <div className="streaming-sub-card__val-wrap">
                                  <span className="streaming-sub-card__val">{ord.bot_code}</span>
                                  <button
                                    type="button"
                                    className="streaming-sub-card__copy-btn"
                                    onClick={() => handleCopyCode(ord.bot_code || '')}
                                  >
                                    Copiar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            className="streaming-sub-card__bot-btn"
                            onClick={() => handleDirectToBot(ord.email, ord.bot_code, ord.platform)}
                          >
                            <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span>🤖 Consultar Código en BOT con 1 Clic</span>
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PANEL DE ADMINISTRADOR (STOCK & ENTREGAS) */}
        {/* ================================================================= */}
        {activeTab === 'admin' && userProfile?.is_admin && (
          <div className="streaming-admin animate-fade-in">
            {/* Header Admin */}
            <div className="streaming-hero" style={{ padding: '24px 20px', marginBottom: 20 }}>
              <div className="streaming-hero__badge" style={{ background: 'rgba(239, 68, 68, 0.2)', borderColor: '#ef4444' }}>
                <span className="streaming-hero__pulse" style={{ background: '#ef4444' }} />
                <span>Panel de Control Autorizado</span>
              </div>
              <h2 className="streaming-hero__title" style={{ fontSize: '1.6rem' }}>
                Gestión de <span className="streaming-hero__title-gradient">Stock &amp; Asignación</span>
              </h2>
              <p className="streaming-hero__desc" style={{ maxWidth: 640 }}>
                Carga lotes de cuentas (Cuenta A, B) con 3 perfiles cada una. El sistema balancea automáticamente
                la entrega (A1 → B1 → A2 → B2) y despacha pedidos pendientes de Netflix 4K.
              </p>
            </div>

            {/* Resumen de Stock en Vivo */}
            <div className="streaming-admin__box">
              <h3 className="streaming-admin__section-title">📊 Disponibilidad en Tiempo Real</h3>
              <div className="streaming-admin__stats-grid">
                {STREAMING_PLATFORMS.map((plat) => {
                  const count = stockMap[plat.value] || 0
                  const isOnDemand = plat.value === 'netflix' || plat.value === 'gemini'
                  return (
                    <div key={plat.value} className="streaming-admin__stat-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={plat.image} alt={plat.label} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        <span className="streaming-admin__stat-name">{plat.label}</span>
                      </div>
                      <span
                        className="streaming-admin__stat-val"
                        style={{ color: isOnDemand ? '#c084fc' : count > 0 ? '#4ade80' : '#f87171' }}
                      >
                        {isOnDemand ? 'A Pedido' : `${count} disp.`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sección 1: Cargar Nuevo Lote de Cuentas */}
            <div className="streaming-admin__box">
              <h3 className="streaming-admin__section-title">➕ Cargar Lote de Perfiles (Ej: Cuenta A con 3 Perfiles)</h3>
              <form onSubmit={handleAdminAddBatch}>
                <div className="streaming-admin__form-grid">
                  <div className="streaming-admin__form-field">
                    <label>Plataforma</label>
                    <select
                      value={adminPlatform}
                      onChange={(e) => setAdminPlatform(e.target.value)}
                    >
                      {STREAMING_PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="streaming-admin__form-field">
                    <label>Identificador de Cuenta</label>
                    <input
                      type="text"
                      placeholder="Ej: Cuenta A o Cuenta 1"
                      required
                      value={adminAccountIdent}
                      onChange={(e) => setAdminAccountIdent(e.target.value)}
                    />
                  </div>

                  <div className="streaming-admin__form-field">
                    <label>Correo Electrónico Maestro</label>
                    <input
                      type="email"
                      placeholder="cuenta@plataforma.com"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>

                  <div className="streaming-admin__form-field">
                    <label>Contraseña de Acceso</label>
                    <input
                      type="text"
                      placeholder="Contraseña segura"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>

                  <div className="streaming-admin__form-field">
                    <label>Código BOT / Token de Consulta</label>
                    <input
                      type="text"
                      placeholder="Ej: COD-MAX-01"
                      required
                      value={adminBotCode}
                      onChange={(e) => setAdminBotCode(e.target.value)}
                    />
                  </div>

                  <div className="streaming-admin__form-field">
                    <label>Cantidad de Perfiles</label>
                    <select
                      value={adminProfilesCount}
                      onChange={(e) => setAdminProfilesCount(Number(e.target.value))}
                    >
                      <option value={1}>1 Perfil</option>
                      <option value={2}>2 Perfiles</option>
                      <option value={3}>3 Perfiles (Recomendado)</option>
                      <option value={4}>4 Perfiles</option>
                      <option value={5}>5 Perfiles</option>
                    </select>
                  </div>
                </div>

                {/* PINs opcionales */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div className="streaming-admin__form-field" style={{ flex: 1 }}>
                    <label>PIN Perfil 1 (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 1234"
                      maxLength={6}
                      value={adminPin1}
                      onChange={(e) => setAdminPin1(e.target.value)}
                    />
                  </div>
                  <div className="streaming-admin__form-field" style={{ flex: 1 }}>
                    <label>PIN Perfil 2 (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 5678"
                      maxLength={6}
                      value={adminPin2}
                      onChange={(e) => setAdminPin2(e.target.value)}
                    />
                  </div>
                  <div className="streaming-admin__form-field" style={{ flex: 1 }}>
                    <label>PIN Perfil 3 (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: 9012"
                      maxLength={6}
                      value={adminPin3}
                      onChange={(e) => setAdminPin3(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="streaming-admin__submit-btn"
                  disabled={isAdminSubmitting}
                >
                  {isAdminSubmitting ? 'Guardando Lote...' : `🚀 Crear ${adminProfilesCount} Perfiles en Stock`}
                </button>
              </form>
            </div>

            {/* Sección 2: Pedidos Pendientes (Netflix 4K A Pedido) */}
            <div className="streaming-admin__box">
              <h3 className="streaming-admin__section-title">
                ⏳ Pedidos Pendientes de Entrega ({adminOverview?.pending_orders?.length || 0})
              </h3>
              {!adminOverview?.pending_orders || adminOverview.pending_orders.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                  No hay pedidos pendientes. Todas las solicitudes de Netflix 4K están al día.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {adminOverview.pending_orders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        background: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1rem' }}>
                            {ord.product_name}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            Pedido por @{ord.username || 'Usuario'}
                          </span>
                          {ord.account_region && (
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: 6,
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                background: ord.account_region === 'peru' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                                color: ord.account_region === 'peru' ? '#fca5a5' : '#7dd3fc',
                                border: ord.account_region === 'peru' ? '1px solid #ef4444' : '1px solid #38bdf8',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {ord.account_region === 'peru' ? '🇵🇪 CUENTA PERÚ' : '🌎 CUENTA EXTRANJERO'}
                            </span>
                          )}
                        </div>
                        <span style={{ color: '#fde047', fontWeight: 700, fontSize: '0.75rem' }}>
                          Hace {Math.max(1, Math.round((Date.now() - new Date(ord.created_at).getTime()) / 60000))} min
                        </span>
                      </div>

                      {deliveringOrderId === ord.id ? (
                        <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: 14, borderRadius: 10 }}>
                          <h4 style={{ color: '#38bdf8', fontSize: '0.85rem', marginBottom: 10 }}>
                            Asignar Credenciales para @{ord.username}:
                          </h4>
                          <div className="streaming-admin__form-grid" style={{ marginBottom: 12 }}>
                            <div className="streaming-admin__form-field">
                              <label>Correo Electrónico</label>
                              <input
                                type="email"
                                required
                                value={delivEmail}
                                onChange={(e) => setDelivEmail(e.target.value)}
                              />
                            </div>
                            <div className="streaming-admin__form-field">
                              <label>Contraseña</label>
                              <input
                                type="text"
                                required
                                value={delivPassword}
                                onChange={(e) => setDelivPassword(e.target.value)}
                              />
                            </div>
                            <div className="streaming-admin__form-field">
                              <label>Perfil #</label>
                              <input
                                type="number"
                                min={1}
                                max={5}
                                value={delivProfile}
                                onChange={(e) => setDelivProfile(Number(e.target.value))}
                              />
                            </div>
                            <div className="streaming-admin__form-field">
                              <label>PIN (Opcional)</label>
                              <input
                                type="text"
                                value={delivPin}
                                onChange={(e) => setDelivPin(e.target.value)}
                              />
                            </div>
                            <div className="streaming-admin__form-field">
                              <label>Código BOT</label>
                              <input
                                type="text"
                                value={delivBotCode}
                                onChange={(e) => setDelivBotCode(e.target.value)}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              type="button"
                              className="streaming-admin__submit-btn"
                              onClick={() => handleAdminDeliverOrder(ord.id)}
                            >
                              ✅ Confirmar y Entregar Cuenta
                            </button>
                            <button
                              type="button"
                              style={{
                                background: 'transparent',
                                border: '1px solid #64748b',
                                color: '#94a3b8',
                                borderRadius: 8,
                                padding: '8px 16px',
                                cursor: 'pointer',
                              }}
                              onClick={() => setDeliveringOrderId(null)}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="streaming-admin__submit-btn"
                          onClick={() => {
                            setDeliveringOrderId(ord.id)
                            setDelivEmail('')
                            setDelivPassword('')
                            setDelivProfile(1)
                            setDelivPin('')
                            setDelivBotCode('')
                          }}
                        >
                          📦 Asignar y Entregar Cuenta
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sección 3: Inventario en Vivo de Perfiles */}
            <div className="streaming-admin__box">
              <h3 className="streaming-admin__section-title">📋 Inventario Completo de Perfiles</h3>
              <div className="streaming-admin__table-wrap">
                <table className="streaming-admin__table">
                  <thead>
                    <tr>
                      <th>Plataforma</th>
                      <th>Cuenta</th>
                      <th>Perfil</th>
                      <th>Email</th>
                      <th>Clave</th>
                      <th>Bot Code</th>
                      <th>Estado</th>
                      <th>Asignado A</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!adminOverview?.inventory || adminOverview.inventory.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                          No hay perfiles cargados en el inventario. Usa el formulario de arriba para cargar tu primer lote.
                        </td>
                      </tr>
                    ) : (
                      adminOverview.inventory.map((inv) => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 700, textTransform: 'capitalize' }}>{inv.platform}</td>
                          <td>{inv.account_identifier}</td>
                          <td style={{ color: '#38bdf8' }}>Perfil {inv.profile_number}</td>
                          <td>{inv.account_email}</td>
                          <td style={{ fontFamily: 'monospace' }}>{inv.profile_pin ? `${inv.account_email} (PIN: ${inv.profile_pin})` : '••••••'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{inv.bot_code}</td>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: inv.status === 'available' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                color: inv.status === 'available' ? '#4ade80' : '#93c5fd',
                              }}
                            >
                              {inv.status === 'available' ? 'Disponible' : 'Vendido'}
                            </span>
                          </td>
                          <td>{inv.assigned_username ? `@${inv.assigned_username}` : '—'}</td>
                          <td>
                            {inv.status === 'available' && (
                              <button
                                type="button"
                                className="streaming-admin__del-btn"
                                onClick={() => handleAdminDeleteProfile(inv.id)}
                              >
                                Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL DE COMPRA / DETALLES DE PLANES */}
        {/* ================================================================= */}
        {modalProduct && (
          <div
            className="streaming-modal-backdrop"
            onClick={() => {
              setModalProduct(null)
              setSelectedRegion('')
            }}
          >
            <div className="streaming-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="streaming-modal__close"
                onClick={() => {
                  setModalProduct(null)
                  setSelectedRegion('')
                }}
              >
                ✕
              </button>

              <div className="streaming-modal__head">
                <img
                  src={modalProduct.image}
                  alt={modalProduct.name}
                  className="streaming-modal__icon"
                />
                <div>
                  <h3 className="streaming-modal__title">{modalProduct.name}</h3>
                  <span className="streaming-modal__category">{modalProduct.badge || modalProduct.type}</span>
                </div>
              </div>

              <p className="streaming-modal__desc">{modalProduct.description}</p>

              <div className="streaming-modal__plans">
                {modalProduct.plans.map((p, idx) => (
                  <div key={idx} className="streaming-modal__plan-row">
                    <span className="streaming-modal__plan-name">{p.name}</span>
                    <span className="streaming-modal__plan-price">{p.price}</span>
                  </div>
                ))}
              </div>

              {/* Selector obligatorio de Región solo para Netflix 4K */}
              {modalProduct.id === 'netflix' && (
                <div className="streaming-modal__region-selector">
                  <div className="streaming-modal__region-label">
                    <span>📍 ¿Para qué país requieres la cuenta?</span>
                    <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.75rem' }}>
                      * OBLIGATORIO
                    </span>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: '0 0 6px' }}>
                    Selecciona tu ubicación para entregarte un perfil compatible con tu red local sin bloqueos de hogar:
                  </p>
                  <div className="streaming-modal__region-options">
                    <button
                      type="button"
                      className={`streaming-modal__region-btn ${
                        selectedRegion === 'peru' ? 'streaming-modal__region-btn--selected' : ''
                      }`}
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setSelectedRegion('peru')
                      }}
                    >
                      <span className="streaming-modal__region-flag">🇵🇪</span>
                      <div className="streaming-modal__region-info">
                        <span className="streaming-modal__region-name">Perú</span>
                        <span className="streaming-modal__region-sub">Cuenta Peruana (IP Perú)</span>
                      </div>
                      {selectedRegion === 'peru' && (
                        <span className="streaming-modal__region-check">✓</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className={`streaming-modal__region-btn ${
                        selectedRegion === 'extranjero' ? 'streaming-modal__region-btn--selected' : ''
                      }`}
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setSelectedRegion('extranjero')
                      }}
                    >
                      <span className="streaming-modal__region-flag">🌎</span>
                      <div className="streaming-modal__region-info">
                        <span className="streaming-modal__region-name">Extranjero</span>
                        <span className="streaming-modal__region-sub">Resto del Mundo / Internacional</span>
                      </div>
                      {selectedRegion === 'extranjero' && (
                        <span className="streaming-modal__region-check">✓</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="streaming-modal__actions">
                <div className="streaming-modal__buy-options">
                  {/* Botón 1: Valor en Gemas */}
                  {(() => {
                    const isOnDemand = modalProduct.id === 'netflix' || modalProduct.id === 'gemini'
                    const available = stockMap[modalProduct.id] ?? 0
                    const isOutOfStock = !isOnDemand && available <= 0

                    return (
                      <button
                        type="button"
                        className={`streaming-modal__gem-btn ${
                          isOutOfStock ? 'streaming-modal__gem-btn--disabled' : 'streaming-modal__gem-btn--enabled'
                        }`}
                        disabled={isOutOfStock || isPurchasing}
                        onClick={() => handleBuyWithGems(modalProduct)}
                        title={isOutOfStock ? 'Agotado temporalmente' : 'Canjear con Gemas'}
                      >
                        <div className="streaming-modal__gem-btn-inner">
                          <span className="streaming-modal__gem-icon">💎</span>
                          <span className="streaming-modal__gem-val">
                            {isPurchasing
                              ? 'Procesando...'
                              : `${modalProduct.gemCost || 300} Gemas`}
                          </span>
                          <span
                            className="streaming-modal__gem-tag"
                            style={{
                              background: isOutOfStock ? '#ef4444' : isOnDemand ? '#a855f7' : '#10b981',
                            }}
                          >
                            {isOutOfStock ? 'SIN STOCK' : isOnDemand ? 'A PEDIDO (30 MIN)' : 'ENTREGA INMEDIATA'}
                          </span>
                        </div>
                        <span className="streaming-modal__gem-sub">
                          {isLoggedIn && userProfile?.gems_balance !== undefined
                            ? `(Tienes ${userProfile.gems_balance.toLocaleString()} 💎)`
                            : 'Canje con Gemas'}
                        </span>
                      </button>
                    )
                  })()}

                  {/* Botón 2: Yape */}
                  <button
                    type="button"
                    className="streaming-modal__yape-btn"
                    onClick={handleYapeClick}
                    title="Pagar con Yape (Muy pronto)"
                  >
                    <div className="streaming-modal__yape-content">
                      <img
                        src="/game-assets/shop/yape.png"
                        alt="Yape"
                        className="streaming-modal__yape-img"
                      />
                      <span className="streaming-modal__yape-tag">MUY PRONTO</span>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  className="streaming-modal__bot-btn"
                  onClick={() => handleGoToBotWithPlatform(modalProduct.botType || modalProduct.id)}
                >
                  <svg style={{ width: 16, height: 16, color: '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span>¿Ya compraste? Obtén tu código en el BOT</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODAL DE COMPRA EXITOSA / CREDENCIALES AL INSTANTE */}
        {/* ================================================================= */}
        {purchaseSuccessData && (
          <div className="streaming-modal-backdrop" onClick={() => setPurchaseSuccessData(null)}>
            <div className="streaming-success-modal" onClick={(e) => e.stopPropagation()}>
              <div className="streaming-success-modal__icon">
                {purchaseSuccessData.isOnDemand ? '⏳' : '🎉'}
              </div>
              <h3 className="streaming-success-modal__title">
                {purchaseSuccessData.isOnDemand ? '¡Pedido Registrado con Éxito!' : '¡Felicidades por tu Compra!'}
              </h3>
              <p className="streaming-success-modal__desc">
                {purchaseSuccessData.message}
              </p>

              {purchaseSuccessData.isOnDemand && purchaseSuccessData.accountRegion && (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>
                    {purchaseSuccessData.accountRegion === 'peru' ? '🇵🇪' : '🌎'}
                  </span>
                  <span style={{ color: '#e0f2fe', fontWeight: 700, fontSize: '0.88rem' }}>
                    Tipo de Cuenta: {purchaseSuccessData.accountRegion === 'peru' ? 'Perú (Cuenta Peruana)' : 'Extranjero (Internacional)'}
                  </span>
                </div>
              )}

              {!purchaseSuccessData.isOnDemand && purchaseSuccessData.email && (
                <div className="streaming-success-modal__creds">
                  <div className="streaming-success-modal__cred-row">
                    <span style={{ color: '#94a3b8' }}>Correo:</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>
                        {purchaseSuccessData.email}
                      </strong>
                      <button
                        type="button"
                        className="streaming-sub-card__copy-btn"
                        onClick={() => handleCopyCode(purchaseSuccessData.email!)}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="streaming-success-modal__cred-row">
                    <span style={{ color: '#94a3b8' }}>Contraseña:</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>
                        {purchaseSuccessData.password}
                      </strong>
                      <button
                        type="button"
                        className="streaming-sub-card__copy-btn"
                        onClick={() => handleCopyCode(purchaseSuccessData.password!)}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>

                  <div className="streaming-success-modal__cred-row">
                    <span style={{ color: '#94a3b8' }}>Perfil Asignado:</span>
                    <strong style={{ color: '#38bdf8' }}>
                      Perfil #{purchaseSuccessData.profileNumber || 1}
                      {purchaseSuccessData.profilePin ? ` (PIN: ${purchaseSuccessData.profilePin})` : ''}
                    </strong>
                  </div>

                  {purchaseSuccessData.botCode && (
                    <div className="streaming-success-modal__cred-row">
                      <span style={{ color: '#94a3b8' }}>Token BOT:</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <strong style={{ color: '#4ade80', fontFamily: 'monospace' }}>
                          {purchaseSuccessData.botCode}
                        </strong>
                        <button
                          type="button"
                          className="streaming-sub-card__copy-btn"
                          onClick={() => handleCopyCode(purchaseSuccessData.botCode!)}
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!purchaseSuccessData.isOnDemand && (
                  <button
                    type="button"
                    className="streaming-hero__btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() =>
                      handleDirectToBot(
                        purchaseSuccessData.email,
                        purchaseSuccessData.botCode,
                        modalProduct?.id
                      )
                    }
                  >
                    🤖 Ir al BOT para Extraer Códigos
                  </button>
                )}

                <button
                  type="button"
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    borderRadius: 10,
                    padding: '10px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setPurchaseSuccessData(null)
                    setActiveTab('my_accounts')
                  }}
                >
                  Ver en "Mis Suscripciones"
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

