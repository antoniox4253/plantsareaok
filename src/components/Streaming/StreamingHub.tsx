import { useState, useEffect, useMemo, useRef } from 'react'
import {
  STREAMING_PLATFORMS,
  STREAMING_SERVERS,
  DEFAULT_STREAMING_PRODUCTS,
  type StreamingProduct,
  type StreamingQueryResult,
  type StreamingPlatform,
  type StreamingServer,
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
  } | null
  userEmail?: string | null
  isLoggedIn?: boolean
  onOpenAuth?: () => void
  onBack: () => void
  initialTab?: 'catalog' | 'bot'
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
  const [activeTab, setActiveTab] = useState<'catalog' | 'bot'>(initialTab)

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

  const serverDropdownRef = useRef<HTMLDivElement>(null)
  const platformDropdownRef = useRef<HTMLDivElement>(null)

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

  // Manejar clic en botón de Gemas
  const handleBuyWithGems = (product: StreamingProduct) => {
    soundManager.playSound('click', 0.5)
    const cost = product.gemCost || 300
    if (!isLoggedIn) {
      if (onOpenAuth) {
        onOpenAuth()
      } else {
        setToastNotification('⚠️ Conecta tu cuenta de Plants Arena para canjear membresías con Gemas.')
      }
      return
    }

    const currentGems = userProfile?.gems_balance ?? 0
    if (currentGems < cost) {
      setToastNotification(
        `💎 Saldo insuficiente: Tienes ${currentGems.toLocaleString()} Gemas y se requieren ${cost} Gemas. ¡Recarga en la Tienda Oficial!`
      )
      return
    }

    soundManager.playSound('victory', 0.6)
    setToastNotification(
      `🎉 ¡Solicitud recibida para ${product.name}! Tus datos de acceso serán sincronizados y habilitados para tu usuario.`
    )
    setModalProduct(null)
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
            <span className="streaming-hub__tab-badge">12+ SERVICIOS</span>
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
              {filteredProducts.map((item) => (
                <div key={item.id} className="streaming-card">
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
                        {item.badge && <span className="streaming-card__badge">{item.badge}</span>}
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
                        className="streaming-card__btn-buy"
                        onClick={() => {
                          soundManager.playSound('click', 0.5)
                          setModalProduct(item)
                        }}
                      >
                        Comprar
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
              ))}
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
        {/* MODAL DE COMPRA / DETALLES DE PLANES */}
        {/* ================================================================= */}
        {modalProduct && (
          <div className="streaming-modal-backdrop" onClick={() => setModalProduct(null)}>
            <div className="streaming-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="streaming-modal__close"
                onClick={() => setModalProduct(null)}
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

              <div className="streaming-modal__actions">
                <div className="streaming-modal__buy-options">
                  {/* Botón 1: Valor en Gemas */}
                  <button
                    type="button"
                    className="streaming-modal__gem-btn"
                    onClick={() => handleBuyWithGems(modalProduct)}
                  >
                    <div className="streaming-modal__gem-btn-inner">
                      <span className="streaming-modal__gem-icon">💎</span>
                      <span className="streaming-modal__gem-val">
                        {modalProduct.gemCost || 300} Gemas
                      </span>
                    </div>
                    <span className="streaming-modal__gem-sub">
                      {isLoggedIn && userProfile?.gems_balance !== undefined
                        ? `(Tienes ${userProfile.gems_balance.toLocaleString()} 💎)`
                        : 'Canje con Gemas'}
                    </span>
                  </button>

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
      </div>
    </div>
  )
}
