import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  newsAndSuggestionsService,
  type NewsPost,
  type PlayerSuggestion,
  type SuggestionCategory,
  type SuggestionStatus,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUS_CONFIG,
  WEEKLY_UPDATES_BLOCKS,
} from '../../services/newsAndSuggestionsService'
import './NewsAndSuggestionsModal.css'

interface NewsAndSuggestionsModalProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'news' | 'suggestions'
  currentUser?: {
    id?: string
    username?: string
    avatar_id?: string
    has_vip_pass?: boolean
  } | null
  isAdmin?: boolean
}

export const NewsAndSuggestionsModal: React.FC<NewsAndSuggestionsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'news',
  currentUser,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<'news' | 'suggestions'>(initialTab)

  // Blog View State: 'feed' (Grid / Hero view) or 'article' (Full Reading Mode)
  const [blogView, setBlogView] = useState<'feed' | 'article'>('feed')

  // News states
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([])
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string>('todas')
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true)
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null)

  // Suggestion states
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(true)
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'top' | 'implemented' | 'mine'>('all')
  const [selectedSuggestionCat, setSelectedSuggestionCat] = useState<string>('todas')
  const [showSuggestionForm, setShowSuggestionForm] = useState<boolean>(false)
  const [showStatusLegend, setShowStatusLegend] = useState<boolean>(false)

  // Suggestion Form states
  const [suggTitle, setSuggTitle] = useState('')
  const [suggCategory, setSuggCategory] = useState<SuggestionCategory>('plantas')
  const [suggContent, setSuggContent] = useState('')
  const [suggCustomNick, setSuggCustomNick] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Admin New Post state
  const [showAdminPostForm, setShowAdminPostForm] = useState(false)
  const [adminPostTitle, setAdminPostTitle] = useState('')
  const [adminPostVersion, setAdminPostVersion] = useState('')
  const [adminPostCategory, setAdminPostCategory] = useState('actualizacion')
  const [adminPostSummary, setAdminPostSummary] = useState('')
  const [adminPostContent, setAdminPostContent] = useState('')
  const [adminPostIsPinned, setAdminPostIsPinned] = useState(false)
  const [isPublishingPost, setIsPublishingPost] = useState(false)

  // Admin response state on suggestions
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')

  // Sync initial tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setBlogView('feed')
    }
  }, [isOpen, initialTab])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (blogView === 'article') {
          soundManager.playSound('click', 0.4)
          setBlogView('feed')
        } else {
          soundManager.playSound('click', 0.4)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, blogView, onClose])

  // Load News
  const loadNews = useCallback(async () => {
    setIsLoadingNews(true)
    try {
      const cat = selectedNewsCategory === 'semanal' ? 'todas' : selectedNewsCategory
      const posts = await newsAndSuggestionsService.getNewsPosts(cat)
      setNewsPosts(posts)
      if (posts.length > 0 && !selectedNewsId) {
        setSelectedNewsId(posts[0].id)
      }
    } catch (err) {
      console.warn('Error loading news posts:', err)
    } finally {
      setIsLoadingNews(false)
    }
  }, [selectedNewsCategory, selectedNewsId])

  useEffect(() => {
    if (isOpen && activeTab === 'news') {
      void loadNews()
    }
  }, [isOpen, activeTab, selectedNewsCategory, loadNews])

  // Active selected article for reader
  const activePost = useMemo(() => {
    if (!newsPosts.length) return null
    if (selectedNewsId) {
      const found = newsPosts.find((p) => p.id === selectedNewsId)
      if (found) return found
    }
    return newsPosts[0]
  }, [newsPosts, selectedNewsId])

  // Hero article for the blog feed
  const heroPost = useMemo(() => {
    if (!newsPosts.length) return null
    const pinned = newsPosts.find((p) => p.is_pinned)
    return pinned || newsPosts[0]
  }, [newsPosts])

  // Other articles in the grid (excluding hero when viewing 'todas')
  const gridPosts = useMemo(() => {
    if (selectedNewsCategory !== 'todas') {
      return newsPosts
    }
    if (!heroPost) return newsPosts
    return newsPosts.filter((p) => p.id !== heroPost.id)
  }, [newsPosts, heroPost, selectedNewsCategory])

  // Load Suggestions
  const loadSuggestions = useCallback(async () => {
    setIsLoadingSuggestions(true)
    try {
      const list = await newsAndSuggestionsService.getSuggestions({
        category: selectedSuggestionCat !== 'todas' ? selectedSuggestionCat : undefined,
      })
      setSuggestions(list)
    } catch (err) {
      console.warn('Error loading suggestions:', err)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [selectedSuggestionCat])

  useEffect(() => {
    if (isOpen && activeTab === 'suggestions') {
      void loadSuggestions()
    }
  }, [isOpen, activeTab, selectedSuggestionCat, loadSuggestions])

  // Handle Tab Switch
  const handleTabChange = (tab: 'news' | 'suggestions') => {
    soundManager.playSound('click', 0.5)
    setActiveTab(tab)
    if (tab === 'news') {
      setBlogView('feed')
    }
  }

  // Open Article in Reader View
  const handleOpenArticle = (postId: string) => {
    soundManager.playSound('click', 0.4)
    setSelectedNewsId(postId)
    setBlogView('article')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Back to Blog Feed
  const handleBackToFeed = () => {
    soundManager.playSound('click', 0.4)
    setBlogView('feed')
  }

  // Handle Suggestion Like Toggle
  const handleToggleLike = async (suggestionId: string) => {
    soundManager.playSound('click', 0.4)
    // Optimistic update
    setSuggestions((prev) =>
      prev.map((s) => {
        if (s.id === suggestionId) {
          const wasLiked = Boolean(s.has_liked)
          return {
            ...s,
            has_liked: !wasLiked,
            likes_count: Math.max(0, s.likes_count + (wasLiked ? -1 : 1)),
          }
        }
        return s
      })
    )

    try {
      const res = await newsAndSuggestionsService.toggleSuggestionLike(suggestionId)
      if (res.success) {
        setSuggestions((prev) =>
          prev.map((s) => {
            if (s.id === suggestionId) {
              return {
                ...s,
                likes_count: res.likes_count !== undefined ? res.likes_count : s.likes_count,
                has_liked: res.has_liked !== undefined ? res.has_liked : s.has_liked,
              }
            }
            return s
          })
        )
      }
    } catch (err) {
      console.warn('Error toggling like:', err)
    }
  }

  // Submit Suggestion Form
  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setFormFeedback(null)
    const effectiveNick = currentUser?.username || suggCustomNick.trim() || 'Jardinero'

    if (!suggTitle.trim()) {
      setFormFeedback({ type: 'error', message: 'Por favor ingresa un título para tu idea.' })
      return
    }
    if (!suggContent.trim() || suggContent.trim().length < 10) {
      setFormFeedback({ type: 'error', message: 'Detalla tu sugerencia con al menos 10 caracteres.' })
      return
    }

    setIsSubmitting(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await newsAndSuggestionsService.submitSuggestion({
        title: suggTitle.trim(),
        category: suggCategory,
        content: suggContent.trim(),
        playerNick: effectiveNick,
      })

      if (res.success && res.suggestion) {
        soundManager.playSound('fanfare', 0.6)
        setSuggestions((prev) => [res.suggestion!, ...prev])
        setSuggTitle('')
        setSuggContent('')
        setShowSuggestionForm(false)
        setFormFeedback({
          type: 'success',
          message: '¡Sugerencia enviada con éxito! Ya aparece en el buzón para que la comunidad vote.',
        })
        setTimeout(() => setFormFeedback(null), 5000)
      } else {
        setFormFeedback({ type: 'error', message: res.error || 'Error al enviar sugerencia.' })
      }
    } catch (err: any) {
      setFormFeedback({ type: 'error', message: err?.message || 'Error de conexión al enviar.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Admin: Update status of a suggestion
  const handleAdminStatusChange = async (suggestionId: string, newStatus: SuggestionStatus) => {
    soundManager.playSound('click', 0.4)
    try {
      const res = await newsAndSuggestionsService.adminUpdateSuggestion(suggestionId, newStatus)
      if (res.success) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status: newStatus } : s))
        )
      }
    } catch (err) {
      console.warn('Error updating status:', err)
    }
  }

  // Admin: Save developer response
  const handleSaveResponse = async (suggestionId: string) => {
    soundManager.playSound('click', 0.4)
    try {
      const current = suggestions.find((s) => s.id === suggestionId)
      if (!current) return
      const res = await newsAndSuggestionsService.adminUpdateSuggestion(
        suggestionId,
        current.status,
        responseText.trim() || null
      )
      if (res.success) {
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId ? { ...s, admin_response: responseText.trim() || null } : s
          )
        )
        setEditingResponseId(null)
        setResponseText('')
      }
    } catch (err) {
      console.warn('Error saving response:', err)
    }
  }

  // Admin: Publish new Devlog / Patch Notes post
  const handlePublishNewsPost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isPublishingPost) return

    if (!adminPostTitle.trim() || !adminPostContent.trim()) {
      return
    }

    setIsPublishingPost(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await newsAndSuggestionsService.adminPublishNewsPost({
        title: adminPostTitle.trim(),
        version: adminPostVersion.trim() || undefined,
        category: adminPostCategory,
        summary: adminPostSummary.trim() || adminPostTitle.trim(),
        content: adminPostContent.trim(),
        is_pinned: adminPostIsPinned,
      })

      if (res.success && res.post) {
        setNewsPosts((prev) => [res.post!, ...prev])
        setShowAdminPostForm(false)
        setAdminPostTitle('')
        setAdminPostVersion('')
        setAdminPostSummary('')
        setAdminPostContent('')
        setAdminPostIsPinned(false)
        setSelectedNewsId(res.post.id)
        setBlogView('article')
      }
    } catch (err) {
      console.warn('Error publishing news:', err)
    } finally {
      setIsPublishingPost(false)
    }
  }

  // Filtered Suggestions list
  const filteredSuggestions = useMemo(() => {
    let list = [...suggestions]

    if (suggestionFilter === 'top') {
      list.sort((a, b) => b.likes_count - a.likes_count)
    } else if (suggestionFilter === 'implemented') {
      list = list.filter((s) => s.status === 'implementada')
    } else if (suggestionFilter === 'mine') {
      const myNick = currentUser?.username?.toLowerCase()
      const myId = currentUser?.id
      list = list.filter(
        (s) =>
          (myId && s.user_id === myId) ||
          (myNick && s.player_nick?.toLowerCase() === myNick)
      )
    }

    return list
  }, [suggestions, suggestionFilter, currentUser])

  if (!isOpen) return null

  return (
    <div
      className="news-page-container"
      role="dialog"
      aria-modal="true"
      aria-label="Blog Oficial y Buzón de Sugerencias"
    >
      {/* ── BARRA SUPERIOR PRINCIPAL (RESPONSIVE HEADER) ── */}
      <header className="news-page-header">
        <div className="news-page-header__left">
          <button
            type="button"
            className="news-page-back-btn"
            onClick={() => {
              soundManager.playSound('click', 0.5)
              if (activeTab === 'news' && blogView === 'article') {
                handleBackToFeed()
              } else {
                onClose()
              }
            }}
            title={
              activeTab === 'news' && blogView === 'article'
                ? 'Volver al listado de noticias'
                : 'Volver al Menú Principal'
            }
          >
            {activeTab === 'news' && blogView === 'article'
              ? '← VOLVER A NOTICIAS'
              : '⬅ MENÚ PRINCIPAL'}
          </button>

          <div className="news-page-title-wrap">
            <h1 className="news-page-title">🌿 PLANTS ARENA BLOG</h1>
            <span className="news-page-subtitle">Devlog, Notas de Parche y Buzón de Ideas</span>
          </div>
        </div>

        {/* Pestañas de Navegación Segmentadas */}
        <nav className="news-page-tabs" aria-label="Secciones del Blog">
          <button
            type="button"
            className={`news-page-tab ${activeTab === 'news' ? 'news-page-tab--active' : ''}`}
            onClick={() => handleTabChange('news')}
          >
            📰 Blog &amp; Noticias
          </button>
          <button
            type="button"
            className={`news-page-tab ${activeTab === 'suggestions' ? 'news-page-tab--active' : ''}`}
            onClick={() => handleTabChange('suggestions')}
          >
            💡 Buzón de Sugerencias
            <span className="news-tab-badge">{suggestions.length || '•'}</span>
          </button>
        </nav>

        {/* Botón de Cierre */}
        <div className="news-page-header__right">
          <button
            type="button"
            className="news-page-close-btn"
            onClick={() => {
              soundManager.playSound('click', 0.5)
              onClose()
            }}
            aria-label="Cerrar y volver al juego"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── CUERPO PRINCIPAL CON SCROLL NATURAL Y ANCHO CENTRADO ── */}
      <main className="news-page-body">
        <div className="news-page-inner">
          {/* ══════════════════════════════════════════════════════════════════════
             TAB 1: BLOG DE NOTICIAS & ACTUALIZACIONES
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'news' && (
            <>
              {/* ── VISTA 1: FEED DE ARTÍCULOS (PORTADA + GRID) ── */}
              {blogView === 'feed' && (
                <div className="news-blog-feed-view">
                  {/* Banner Destacado: Presencia en AQP Game Fest 2026 */}
                  <div
                    className="news-marketing-banner"
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      const aqpPost = newsPosts.find(
                        (p) =>
                          p.tag?.toLowerCase().includes('arequipa') ||
                          p.category === 'evento' ||
                          p.title?.toLowerCase().includes('aqp')
                      )
                      if (aqpPost) {
                        handleOpenArticle(aqpPost.id)
                      } else {
                        setSelectedNewsCategory('evento')
                      }
                    }}
                  >
                    <div className="news-marketing-banner__left">
                      <span className="news-marketing-banner__icon">🏛️</span>
                      <div className="news-marketing-banner__info">
                        <div className="news-marketing-banner__badges">
                          <span className="news-marketing-banner__tag">
                            FERIA DE VIDEOJUEGOS · AREQUIPA
                          </span>
                          <span className="news-marketing-banner__live">
                            🔥 PARTICIPACIÓN OFICIAL
                          </span>
                        </div>
                        <h3 className="news-marketing-banner__title">
                          ¡Plants Arena Presente en el AQP Game Fest 2026!
                        </h3>
                        <p className="news-marketing-banner__desc">
                          Exhibición oficial en el Complejo Cultural Ateneo. Encuéntranos en la vitrina de juegos en{' '}
                          <strong>aqpgamefest.com/juegos.html</strong>.
                        </p>
                      </div>
                    </div>
                    <a
                      href="https://aqpgamefest.com/juegos.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-marketing-banner__link-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      🌐 Ver en aqpgamefest.com ➔
                    </a>
                  </div>

                  {/* Barra de Filtros de Categorías */}
                  <div className="news-categories-bar">
                    <div className="news-categories-scroll">
                      {[
                        { id: 'todas', label: 'Todas las Notas' },
                        { id: 'semanal', label: '⏱️ Últimos 7 Días (Bloques)' },
                        { id: 'evento', label: '🎉 AQP Game Fest 2026' },
                        { id: 'actualizacion', label: '🚀 Actualizaciones' },
                        { id: 'balance', label: '⚖️ Balance' },
                        { id: 'devlog', label: '🛠️ Devlog Técnico' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`news-chip ${selectedNewsCategory === cat.id ? 'news-chip--active' : ''}`}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setSelectedNewsCategory(cat.id)
                          }}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        className="news-admin-post-btn"
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setShowAdminPostForm(!showAdminPostForm)
                        }}
                      >
                        {showAdminPostForm ? '✕ Cancelar' : '✍️ Publicar Noticia'}
                      </button>
                    )}
                  </div>

                  {/* Formulario Admin (Desplegable) */}
                  {isAdmin && showAdminPostForm && (
                    <form className="news-admin-form" onSubmit={handlePublishNewsPost}>
                      <h4 className="news-admin-form__title">🛡️ Publicar Actualización en el Blog</h4>
                      <div className="news-admin-form__row">
                        <input
                          type="text"
                          placeholder="Título de la Noticia / Parche"
                          value={adminPostTitle}
                          onChange={(e) => setAdminPostTitle(e.target.value)}
                          required
                          className="news-input"
                        />
                        <input
                          type="text"
                          placeholder="Versión (ej. v1.5.1)"
                          value={adminPostVersion}
                          onChange={(e) => setAdminPostVersion(e.target.value)}
                          className="news-input news-input--short"
                        />
                        <select
                          value={adminPostCategory}
                          onChange={(e) => setAdminPostCategory(e.target.value)}
                          className="news-select"
                        >
                          <option value="actualizacion">🚀 Actualización</option>
                          <option value="balance">⚖️ Balance</option>
                          <option value="devlog">🛠️ Devlog</option>
                          <option value="evento">🎉 Evento</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Resumen corto visible en la tarjeta..."
                        value={adminPostSummary}
                        onChange={(e) => setAdminPostSummary(e.target.value)}
                        className="news-input"
                      />
                      <textarea
                        placeholder="Contenido detallado (admite títulos con ###, viñetas con - y párrafos)..."
                        value={adminPostContent}
                        onChange={(e) => setAdminPostContent(e.target.value)}
                        required
                        rows={4}
                        className="news-textarea"
                      />
                      <div className="news-admin-form__actions">
                        <label className="news-checkbox-label">
                          <input
                            type="checkbox"
                            checked={adminPostIsPinned}
                            onChange={(e) => setAdminPostIsPinned(e.target.checked)}
                          />
                          Fijar arriba de la lista (Destacada)
                        </label>
                        <button
                          type="submit"
                          className="news-btn-primary"
                          disabled={isPublishingPost}
                        >
                          {isPublishingPost ? 'Guardando...' : '🚀 PUBLICAR NOTICIA'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── SECCIÓN A: HISTORIAL DE 7 DÍAS ── */}
                  {selectedNewsCategory === 'semanal' && (
                    <div className="news-weekly-view">
                      <div className="news-weekly-view__header">
                        <span className="news-weekly-icon">📅</span>
                        <div>
                          <h2 className="news-weekly-view__title">
                            Mejoras de los Últimos 7 Días (Bloque a Bloque)
                          </h2>
                          <p className="news-weekly-view__desc">
                            Revisa día a día cada avance técnico, balance competitivo y novedades incorporadas en Plants Arena.
                          </p>
                        </div>
                      </div>

                      <div className="news-weekly-grid">
                        {WEEKLY_UPDATES_BLOCKS.map((block) => (
                          <div key={block.dayNumber} className="news-weekly-card">
                            <div className="news-weekly-card__header">
                              <span className="news-weekly-card__day-badge">
                                Día {block.dayNumber} · {block.dateLabel}
                              </span>
                              <span
                                className="news-weekly-card__tag"
                                style={{ borderColor: block.tagColor, color: block.tagColor }}
                              >
                                {block.tag}
                              </span>
                            </div>

                            <div className="news-weekly-card__title-row">
                              <span className="news-weekly-card__icon">{block.icon}</span>
                              <h4 className="news-weekly-card__title">{block.title}</h4>
                            </div>

                            <p className="news-weekly-card__summary">{block.summary}</p>

                            <ul className="news-weekly-card__highlights">
                              {block.highlights.map((h, i) => (
                                <li key={i}>{h}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── SECCIÓN B: ARTÍCULOS REGULARES DEL BLOG ── */}
                  {selectedNewsCategory !== 'semanal' && (
                    <>
                      {isLoadingNews ? (
                        <div className="news-loading-wrap">
                          <div className="news-spinner" />
                          <span>Cargando publicaciones del blog...</span>
                        </div>
                      ) : newsPosts.length === 0 ? (
                        <div className="news-empty-state">
                          <span className="news-empty-icon">📜</span>
                          <p>No hay artículos en esta categoría por ahora.</p>
                        </div>
                      ) : (
                        <>
                          {/* 1. Tarjeta de Portada / Hero Post (Solo si vemos 'todas' y hay post destacado) */}
                          {selectedNewsCategory === 'todas' && heroPost && (
                            <article
                              className="news-hero-card"
                              onClick={() => handleOpenArticle(heroPost.id)}
                            >
                              <div className="news-hero-card__badge-row">
                                <span className="news-badge news-badge--pinned">
                                  📌 NOTICIA DESTACADA
                                </span>
                                {heroPost.version && (
                                  <span className="news-badge news-badge--version">
                                    {heroPost.version}
                                  </span>
                                )}
                                <span className={`news-badge news-badge--cat-${heroPost.category}`}>
                                  {heroPost.tag || heroPost.category}
                                </span>
                                <span className="news-hero-card__date">
                                  {new Date(heroPost.published_at).toLocaleDateString('es-ES', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>

                              <h2 className="news-hero-card__title">{heroPost.title}</h2>
                              <p className="news-hero-card__summary">{heroPost.summary}</p>

                              <div className="news-hero-card__footer">
                                <span className="news-hero-card__author">
                                  ✍️ {heroPost.author || 'Equipo Plants Arena'}
                                </span>
                                <button
                                  type="button"
                                  className="news-btn-primary news-hero-card__btn"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenArticle(heroPost.id)
                                  }}
                                >
                                  📖 LEER NOTICIA COMPLETA ➔
                                </button>
                              </div>
                            </article>
                          )}

                          {/* 2. Cuadrícula de Artículos del Blog (Cards Grid) */}
                          <div className="news-blog-grid">
                            {gridPosts.map((post) => {
                              const dateStr = new Date(post.published_at).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })

                              return (
                                <article
                                  key={post.id}
                                  className={`news-blog-card ${post.is_pinned ? 'news-blog-card--pinned' : ''}`}
                                  onClick={() => handleOpenArticle(post.id)}
                                >
                                  <div className="news-blog-card__badges">
                                    {post.version && (
                                      <span className="news-badge news-badge--version">
                                        {post.version}
                                      </span>
                                    )}
                                    <span className={`news-badge news-badge--cat-${post.category}`}>
                                      {post.tag || post.category}
                                    </span>
                                    <span className="news-blog-card__date">{dateStr}</span>
                                  </div>

                                  <h3 className="news-blog-card__title">{post.title}</h3>
                                  <p className="news-blog-card__snippet">{post.summary}</p>

                                  <div className="news-blog-card__footer">
                                    <span className="news-blog-card__author">
                                      {post.author || 'Plants Arena'}
                                    </span>
                                    <span className="news-blog-card__read-link">
                                      Leer nota ➔
                                    </span>
                                  </div>
                                </article>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── VISTA 2: LECTOR COMPLETO DEL ARTÍCULO (READING VIEW) ── */}
              {blogView === 'article' && activePost && (
                <article className="news-reader-article-view">
                  {/* Barra de Retorno Superior */}
                  <div className="news-reader-nav-top">
                    <button
                      type="button"
                      className="news-reader-back-link"
                      onClick={handleBackToFeed}
                    >
                      ← Volver a todas las noticias
                    </button>
                    <span className="news-reader-tag-label">
                      Categoría: <strong>{activePost.tag || activePost.category}</strong>
                    </span>
                  </div>

                  {/* Cabecera del Artículo */}
                  <header className="news-reader-header">
                    <div className="news-reader-header__badges">
                      {activePost.is_pinned && (
                        <span className="news-badge news-badge--pinned">📌 DESTACADA</span>
                      )}
                      {activePost.version && (
                        <span className="news-badge news-badge--version">{activePost.version}</span>
                      )}
                      <span className={`news-badge news-badge--cat-${activePost.category}`}>
                        {activePost.tag || activePost.category}
                      </span>
                      <span className="news-reader-header__date">
                        📅 Publicado el{' '}
                        {new Date(activePost.published_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="news-reader-header__author">
                        ✍️ {activePost.author || 'Equipo Plants Arena'}
                      </span>
                    </div>

                    <h1 className="news-reader-title">{activePost.title}</h1>

                    <div className="news-reader-lead">
                      <p>{activePost.summary}</p>
                    </div>
                  </header>

                  {/* Banner Especial para Eventos */}
                  {activePost.category === 'evento' && (
                    <div className="news-article-event-banner">
                      <div className="news-article-event-banner__content">
                        <h4>🏛️ Stand Oficial en Complejo Cultural Ateneo (Arequipa)</h4>
                        <p>
                          Visita nuestro espacio de juego, participa en partidas de exhibición y prueba las novedades en vivo.
                        </p>
                      </div>
                      <a
                        href="https://aqpgamefest.com/juegos.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-btn-primary news-btn-primary--link"
                      >
                        🌐 Ver en aqpgamefest.com ➔
                      </a>
                    </div>
                  )}

                  {/* Cuerpo Formateado del Artículo */}
                  <div className="news-reader-body">
                    <div className="news-markdown-content">
                      {activePost.content.split('\n').map((line, idx) => {
                        const trimmed = line.trim()
                        if (trimmed.startsWith('### ')) {
                          return (
                            <h3 key={idx} className="news-md-h3">
                              {trimmed.replace('### ', '')}
                            </h3>
                          )
                        }
                        if (trimmed.startsWith('- ')) {
                          return (
                            <li key={idx} className="news-md-li">
                              {trimmed.replace('- ', '')}
                            </li>
                          )
                        }
                        if (trimmed.startsWith('> ')) {
                          return (
                            <blockquote key={idx} className="news-md-quote">
                              {trimmed.replace('> ', '')}
                            </blockquote>
                          )
                        }
                        if (!trimmed) {
                          return <div key={idx} className="news-md-spacer" />
                        }
                        return (
                          <p key={idx} className="news-md-p">
                            {trimmed}
                          </p>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pie del Lector con Navegación entre Artículos */}
                  <footer className="news-reader-footer">
                    <div className="news-reader-prev-next">
                      {(() => {
                        const currentIndex = newsPosts.findIndex((p) => p.id === activePost.id)
                        const prevPost = currentIndex > 0 ? newsPosts[currentIndex - 1] : null
                        const nextPost =
                          currentIndex >= 0 && currentIndex < newsPosts.length - 1
                            ? newsPosts[currentIndex + 1]
                            : null

                        return (
                          <>
                            {prevPost ? (
                              <button
                                type="button"
                                className="news-nav-btn news-nav-btn--prev"
                                onClick={() => handleOpenArticle(prevPost.id)}
                              >
                                ⬅ Anterior: {prevPost.title.slice(0, 30)}...
                              </button>
                            ) : (
                              <div />
                            )}

                            {nextPost ? (
                              <button
                                type="button"
                                className="news-nav-btn news-nav-btn--next"
                                onClick={() => handleOpenArticle(nextPost.id)}
                              >
                                Siguiente: {nextPost.title.slice(0, 30)}... ➔
                              </button>
                            ) : (
                              <div />
                            )}
                          </>
                        )
                      })()}
                    </div>

                    <div className="news-reader-back-bottom">
                      <button
                        type="button"
                        className="news-btn-primary"
                        onClick={handleBackToFeed}
                      >
                        ⬅ VOLVER AL LISTADO DE NOTICIAS
                      </button>
                    </div>
                  </footer>
                </article>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
             TAB 2: BUZÓN DE SUGERENCIAS DE JUGADORES
             ══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'suggestions' && (
            <div className="suggestions-hub-view">
              {/* Encabezado Comunitario */}
              <div className="suggestions-hero">
                <div className="suggestions-hero__info">
                  <h2 className="suggestions-hero__title">💡 Buzón de Sugerencias de la Comunidad</h2>
                  <p className="suggestions-hero__desc">
                    ¡Tu opinión construye Plants Arena! Propón nuevas plantas, mecánicas o mejoras, vota las ideas de otros jardineros y revisa las respuestas oficiales del equipo desarrollador.
                  </p>
                </div>

                <div className="suggestions-hero__actions">
                  <button
                    type="button"
                    className="suggestions-new-btn"
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      setShowSuggestionForm(!showSuggestionForm)
                    }}
                  >
                    {showSuggestionForm ? '✕ Cerrar Formulario' : '✍️ + Proponer Nueva Idea'}
                  </button>
                </div>
              </div>

              {/* Formulario Desplegable para Enviar Sugerencia */}
              {showSuggestionForm && (
                <div className="suggestions-form-panel">
                  <div className="suggestions-form-panel__header">
                    <h3 className="suggestions-form-panel__title">
                      📬 Redactar tu Propuesta o Sugerencia
                    </h3>
                    <div className="suggestion-player-tag">
                      <span className="suggestion-player-icon">👤</span>
                      <span className="suggestion-player-nick">
                        {currentUser?.username ? (
                          <strong>{currentUser.username}</strong>
                        ) : (
                          'Jardinero Visitante'
                        )}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitSuggestion} className="suggestion-form">
                    {!currentUser?.username && (
                      <div className="suggestion-form-row">
                        <input
                          type="text"
                          placeholder="Tu Nick o Nombre de Jugador..."
                          value={suggCustomNick}
                          onChange={(e) => setSuggCustomNick(e.target.value)}
                          maxLength={24}
                          className="news-input"
                        />
                      </div>
                    )}

                    <div className="suggestion-form-row">
                      <input
                        type="text"
                        placeholder="Título de tu idea (ej. Planta: Hielaguisantes Primordial)..."
                        value={suggTitle}
                        onChange={(e) => setSuggTitle(e.target.value)}
                        maxLength={100}
                        required
                        className="news-input"
                      />
                      <select
                        value={suggCategory}
                        onChange={(e) => setSuggCategory(e.target.value as SuggestionCategory)}
                        className="news-select"
                      >
                        {SUGGESTION_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      placeholder="Detalla tu propuesta aquí... ¿Cómo funcionaría? ¿Qué plantas o mecánicas involucra? Sé lo más específico posible."
                      value={suggContent}
                      onChange={(e) => setSuggContent(e.target.value)}
                      maxLength={1500}
                      required
                      rows={4}
                      className="news-textarea"
                    />

                    <div className="suggestion-form-footer">
                      <span className="suggestion-char-count">
                        {suggContent.length} / 1500 caracteres
                      </span>

                      <div className="suggestions-form-panel__actions">
                        <button
                          type="button"
                          className="news-chip"
                          onClick={() => setShowSuggestionForm(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="news-btn-primary news-btn-primary--send"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Enviando...' : '🚀 PUBLICAR SUGERENCIA'}
                        </button>
                      </div>
                    </div>

                    {formFeedback && (
                      <div className={`suggestion-alert suggestion-alert--${formFeedback.type}`}>
                        {formFeedback.type === 'success' ? '✅' : '⚠️'} {formFeedback.message}
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Barra de Filtros y Controles del Buzón */}
              <div className="suggestions-filter-bar">
                <div className="suggestions-filter-tabs">
                  {[
                    { id: 'all', label: 'Todas las Ideas' },
                    { id: 'top', label: '🔥 Más Votadas' },
                    { id: 'implemented', label: '⭐ Implementadas' },
                    { id: 'mine', label: '👤 Mis Ideas' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`suggestion-filter-btn ${
                        suggestionFilter === item.id ? 'suggestion-filter-btn--active' : ''
                      }`}
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setSuggestionFilter(item.id as any)
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="suggestions-filter-bar__right">
                  <select
                    value={selectedSuggestionCat}
                    onChange={(e) => setSelectedSuggestionCat(e.target.value)}
                    className="news-select news-select--compact"
                  >
                    <option value="todas">Todas las categorías</option>
                    {SUGGESTION_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="suggestions-legend-toggle"
                    onClick={() => setShowStatusLegend(!showStatusLegend)}
                    title="Explicación de estados"
                  >
                    ℹ️ {showStatusLegend ? 'Ocultar Estados' : 'Ver Estados'}
                  </button>
                </div>
              </div>

              {/* Leyenda de Estados Plegable */}
              {showStatusLegend && (
                <div className="suggestions-legend-drawer">
                  <div className="suggestions-legend-grid">
                    <div className="suggestions-legend-item">
                      <span className="suggestion-status-badge suggestion-badge--received">
                        📥 Recibida
                      </span>
                      <p>Propuesta abierta a votación de la comunidad.</p>
                    </div>
                    <div className="suggestions-legend-item">
                      <span className="suggestion-status-badge suggestion-badge--review">
                        👀 En Revisión
                      </span>
                      <p>Bajo estudio por el equipo de diseño y balance.</p>
                    </div>
                    <div className="suggestions-legend-item">
                      <span className="suggestion-status-badge suggestion-badge--dev">
                        🔨 En Desarrollo
                      </span>
                      <p>Aprobada y programándose en el código del juego.</p>
                    </div>
                    <div className="suggestions-legend-item">
                      <span className="suggestion-status-badge suggestion-badge--done">
                        ⭐ ¡Implementada!
                      </span>
                      <p>¡Disponible oficialmente para todos los jugadores!</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feed Completo de Sugerencias de la Comunidad */}
              <div className="suggestions-cards-grid">
                {isLoadingSuggestions ? (
                  <div className="news-loading-wrap">
                    <div className="news-spinner" />
                    <span>Cargando sugerencias de la comunidad...</span>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="news-empty-state">
                    <span className="news-empty-icon">💡</span>
                    <p>Aún no hay sugerencias con este filtro. ¡Sé el primero en proponer una!</p>
                  </div>
                ) : (
                  filteredSuggestions.map((sugg) => {
                    const statusConf =
                      SUGGESTION_STATUS_CONFIG[sugg.status] || SUGGESTION_STATUS_CONFIG.recibida
                    const catConf = SUGGESTION_CATEGORIES.find((c) => c.id === sugg.category)
                    const dateStr = new Date(sugg.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })

                    return (
                      <div
                        key={sugg.id}
                        className={`suggestion-card ${
                          sugg.status === 'implementada' ? 'suggestion-card--implemented' : ''
                        }`}
                      >
                        {/* Cabecera de la Sugerencia */}
                        <div className="suggestion-card-header">
                          <div className="suggestion-user-info">
                            <div className="suggestion-avatar">
                              {sugg.player_nick.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="suggestion-nick-row">
                                <span className="suggestion-nick">{sugg.player_nick}</span>
                                <span className="suggestion-date">· {dateStr}</span>
                              </div>
                              <span className="suggestion-category-tag">
                                {catConf?.icon} {catConf?.label || sugg.category}
                              </span>
                            </div>
                          </div>

                          <div className="suggestion-header-right">
                            <span className={`suggestion-status-badge ${statusConf.badgeClass}`}>
                              {statusConf.icon} {statusConf.label}
                            </span>
                            <button
                              type="button"
                              className={`suggestion-like-btn ${
                                sugg.has_liked ? 'suggestion-like-btn--active' : ''
                              }`}
                              onClick={() => handleToggleLike(sugg.id)}
                              title={sugg.has_liked ? 'Quitar voto' : 'Votar por esta sugerencia'}
                            >
                              <span className="suggestion-like-icon">👍</span>
                              <span className="suggestion-like-count">{sugg.likes_count}</span>
                            </button>
                          </div>
                        </div>

                        {/* Título y Contenido */}
                        <h4 className="suggestion-card-title">{sugg.title}</h4>
                        <p className="suggestion-card-text">{sugg.content}</p>

                        {/* Respuesta Oficial del Desarrollador */}
                        {sugg.admin_response && (
                          <div className="suggestion-admin-reply">
                            <div className="suggestion-admin-reply__header">
                              <span className="suggestion-admin-reply__shield">🛡️</span>
                              <strong>Respuesta del Equipo de Desarrollo:</strong>
                            </div>
                            <p className="suggestion-admin-reply__body">{sugg.admin_response}</p>
                          </div>
                        )}

                        {/* Controles de Moderación para Admins */}
                        {isAdmin && (
                          <div className="suggestion-admin-controls">
                            <span className="suggestion-admin-label">⚙️ Mod:</span>
                            <div className="suggestion-admin-status-btns">
                              {(
                                [
                                  'recibida',
                                  'en_revision',
                                  'en_desarrollo',
                                  'implementada',
                                  'archivada',
                                ] as SuggestionStatus[]
                              ).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  className={`sugg-admin-btn ${
                                    sugg.status === st ? 'sugg-admin-btn--active' : ''
                                  }`}
                                  onClick={() => handleAdminStatusChange(sugg.id, st)}
                                >
                                  {SUGGESTION_STATUS_CONFIG[st].label}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="sugg-admin-reply-btn"
                              onClick={() => {
                                if (editingResponseId === sugg.id) {
                                  setEditingResponseId(null)
                                } else {
                                  setEditingResponseId(sugg.id)
                                  setResponseText(sugg.admin_response || '')
                                }
                              }}
                            >
                              💬 {sugg.admin_response ? 'Editar Respuesta' : 'Responder'}
                            </button>
                          </div>
                        )}

                        {isAdmin && editingResponseId === sugg.id && (
                          <div className="suggestion-admin-response-box">
                            <textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Escribe la respuesta oficial para este jugador..."
                              rows={2}
                              className="news-textarea"
                            />
                            <div className="suggestion-admin-response-actions">
                              <button
                                type="button"
                                className="news-chip"
                                onClick={() => setEditingResponseId(null)}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="news-btn-primary"
                                onClick={() => handleSaveResponse(sugg.id)}
                              >
                                Guardar Respuesta
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default NewsAndSuggestionsModal
