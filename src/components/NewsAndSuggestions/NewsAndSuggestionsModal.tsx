import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
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

export interface NewsAndSuggestionsModalProps {
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

  // Mobile navigation sub-views
  const [mobileNewsTab, setMobileNewsTab] = useState<'list' | 'reader'>('list')
  const [mobileSuggTab, setMobileSuggTab] = useState<'feed' | 'form'>('feed')

  // News states
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([])
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string>('todas')
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true)
  const [selectedNewsId, setSelectedNewsId] = useState<string | null>(null)

  // Suggestion states (default to 'top' so users immediately see the Community Leaderboard)
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(true)
  const [suggestionFilter, setSuggestionFilter] = useState<'top' | 'all' | 'implemented' | 'mine'>('top')
  const [selectedSuggestionCat, setSelectedSuggestionCat] = useState<string>('todas')

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
    }
  }, [isOpen, initialTab])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundManager.playSound('click', 0.4)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Load News
  const loadNews = useCallback(async () => {
    setIsLoadingNews(true)
    try {
      const cat = selectedNewsCategory === 'semanal' ? 'todas' : selectedNewsCategory
      const posts = await newsAndSuggestionsService.getNewsPosts(cat)
      setNewsPosts(posts)
      if (posts.length > 0) {
        setSelectedNewsId((prev) => (prev && posts.some((p) => p.id === prev) ? prev : posts[0].id))
      }
    } catch (err) {
      console.warn('Error loading news posts:', err)
    } finally {
      setIsLoadingNews(false)
    }
  }, [selectedNewsCategory])

  // Active selected article for reader
  const activePost = useMemo(() => {
    if (!newsPosts.length) return null
    if (selectedNewsId) {
      const found = newsPosts.find((p) => p.id === selectedNewsId)
      if (found) return found
    }
    return newsPosts[0]
  }, [newsPosts, selectedNewsId])

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
    if (isOpen) {
      void loadNews()
      void loadSuggestions()
    }
  }, [isOpen, loadNews, loadSuggestions])

  // Handle Tab Switch
  const handleTabChange = (tab: 'news' | 'suggestions') => {
    soundManager.playSound('click', 0.5)
    setActiveTab(tab)
  }

  // Handle Select Post
  const handleSelectPost = (postId: string) => {
    soundManager.playSound('click', 0.4)
    setSelectedNewsId(postId)
    setMobileNewsTab('reader')
  }

  // Handle Select AQP Event Post
  const handleSelectAqpPost = () => {
    soundManager.playSound('click', 0.4)
    const aqpPost = newsPosts.find(
      (p) =>
        p.tag?.toLowerCase().includes('arequipa') ||
        p.category === 'evento' ||
        p.title?.toLowerCase().includes('aqp')
    )
    if (aqpPost) {
      setSelectedNewsId(aqpPost.id)
      setSelectedNewsCategory('evento')
    } else {
      setSelectedNewsCategory('evento')
    }
    setMobileNewsTab('reader')
  }

  // Handle Suggestion Like Toggle
  const handleToggleLike = async (suggestionId: string) => {
    soundManager.playSound('click', 0.4)
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
        setFormFeedback({
          type: 'success',
          message: '¡Propuesta enviada con éxito! Ya aparece en la lista de ideas comunitarias.',
        })
        setMobileSuggTab('feed')
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
      }
    } catch (err) {
      console.warn('Error publishing news:', err)
    } finally {
      setIsPublishingPost(false)
    }
  }

  // Filtered & Ranked Suggestions list
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
    } else {
      // 'all' -> sorted chronologically by newest
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    if (selectedSuggestionCat !== 'todas') {
      list = list.filter((s) => s.category === selectedSuggestionCat)
    }

    return list
  }, [suggestions, suggestionFilter, selectedSuggestionCat, currentUser])

  if (!isOpen) return null

  const modalContent = (
    <div
      className="news-page-container"
      role="dialog"
      aria-modal="true"
      aria-label="Blog Oficial y Buzón de Sugerencias"
    >
      {/* ── BARRA SUPERIOR RESPONSIVA Y SLIM ── */}
      <header className="news-page-header">
        <div className="news-page-header__left">
          <button
            type="button"
            className="news-page-back-btn"
            onClick={() => {
              soundManager.playSound('click', 0.5)
              onClose()
            }}
            title="Volver al Menú Principal"
          >
            ⬅ VOLVER AL MENÚ
          </button>

          <div className="news-page-title-wrap">
            <span className="news-page-title">🌿 DEVLOG &amp; BLOG</span>
            <span className="news-page-subtitle">Plants Arena Oficial</span>
          </div>
        </div>

        {/* Pestañas Segmentadas */}
        <nav className="news-page-tabs" aria-label="Secciones">
          <button
            type="button"
            className={`news-page-tab ${activeTab === 'news' ? 'news-page-tab--active' : ''}`}
            onClick={() => handleTabChange('news')}
          >
            📰 Blog &amp; Actualizaciones
          </button>
          <button
            type="button"
            className={`news-page-tab ${activeTab === 'suggestions' ? 'news-page-tab--active' : ''}`}
            onClick={() => handleTabChange('suggestions')}
          >
            💡 Buzón Comunitario
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

      {/* ── CUERPO PRINCIPAL (MASTER-DETAIL PANORÁMICO O VERTICAL EN MÓVIL) ── */}
      <main className="news-page-body">
        {/* ══════════════════════════════════════════════════════════════════════
           TAB 1: BLOG DE NOTICIAS & DEVLOG
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'news' && (
          <div className="news-panoramic-layout">
            {/* Sub-toggle móvil para alternar entre lista y lectura */}
            <div className="news-mobile-subnav">
              <button
                type="button"
                className={`news-mobile-subbtn ${mobileNewsTab === 'list' ? 'news-mobile-subbtn--active' : ''}`}
                onClick={() => setMobileNewsTab('list')}
              >
                📋 Lista de Notas ({newsPosts.length})
              </button>
              <button
                type="button"
                className={`news-mobile-subbtn ${mobileNewsTab === 'reader' ? 'news-mobile-subbtn--active' : ''}`}
                onClick={() => setMobileNewsTab('reader')}
              >
                📖 Leer Artículo
              </button>
            </div>

            {/* ── COLUMNA IZQUIERDA: CATEGORÍAS & LISTA DE NOTICIAS ── */}
            <aside className={`news-side-nav ${mobileNewsTab === 'reader' ? 'news-side-nav--mobile-hidden' : ''}`}>
              {/* Tarjeta Compacta AQP Game Fest 2026 */}
              <div className="news-side-spotlight" onClick={handleSelectAqpPost}>
                <div className="news-side-spotlight__top">
                  <span className="news-side-spotlight__badge">🏛️ FERIA AREQUIPA 2026</span>
                  <span className="news-side-spotlight__live">🔥 OFICIAL</span>
                </div>
                <div className="news-side-spotlight__title">
                  ¡Plants Arena en AQP Game Fest 2026!
                </div>
                <div className="news-side-spotlight__footer">
                  <span className="news-side-spotlight__sub">Ateneo Cultural</span>
                  <a
                    href="https://aqpgamefest.com/juegos.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-side-spotlight__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ver en web ➔
                  </a>
                </div>
              </div>

              {/* Chips de Categorías */}
              <div className="news-side-chips">
                {[
                  { id: 'todas', label: 'Todas' },
                  { id: 'semanal', label: '⏱️ 7 Días' },
                  { id: 'evento', label: '🎉 AQP 2026' },
                  { id: 'actualizacion', label: '🚀 Parches' },
                  { id: 'balance', label: '⚖️ Balance' },
                  { id: 'devlog', label: '🛠️ Devlog' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`news-side-chip ${selectedNewsCategory === cat.id ? 'news-side-chip--active' : ''}`}
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      setSelectedNewsCategory(cat.id)
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Botón Admin Publicar */}
              {isAdmin && (
                <button
                  type="button"
                  className="news-admin-compact-btn"
                  onClick={() => setShowAdminPostForm(!showAdminPostForm)}
                >
                  {showAdminPostForm ? '✕ Cancelar' : '✍️ Publicar Noticia'}
                </button>
              )}

              {/* Formulario Admin (Desplegable) */}
              {isAdmin && showAdminPostForm && (
                <form className="news-admin-compact-form" onSubmit={handlePublishNewsPost}>
                  <input
                    type="text"
                    placeholder="Título de la Noticia..."
                    value={adminPostTitle}
                    onChange={(e) => setAdminPostTitle(e.target.value)}
                    required
                    className="news-input news-input--dense"
                  />
                  <div className="news-admin-compact-row">
                    <input
                      type="text"
                      placeholder="Versión (ej. v1.5.1)"
                      value={adminPostVersion}
                      onChange={(e) => setAdminPostVersion(e.target.value)}
                      className="news-input news-input--dense news-input--short"
                    />
                    <select
                      value={adminPostCategory}
                      onChange={(e) => setAdminPostCategory(e.target.value)}
                      className="news-select news-select--dense"
                    >
                      <option value="actualizacion">🚀 Actualización</option>
                      <option value="balance">⚖️ Balance</option>
                      <option value="devlog">🛠️ Devlog</option>
                      <option value="evento">🎉 Evento</option>
                    </select>
                  </div>
                  <textarea
                    placeholder="Contenido en Markdown..."
                    value={adminPostContent}
                    onChange={(e) => setAdminPostContent(e.target.value)}
                    required
                    rows={3}
                    className="news-textarea news-textarea--dense"
                  />
                  <button
                    type="submit"
                    className="news-btn-primary news-btn-primary--compact"
                    disabled={isPublishingPost}
                  >
                    {isPublishingPost ? 'Guardando...' : 'Publicar'}
                  </button>
                </form>
              )}

              {/* Encabezado de la lista */}
              <div className="news-side-nav__header">
                <span>NOTAS PUBLICADAS ({newsPosts.length})</span>
                <span className="news-side-nav__hint">Toca para leer</span>
              </div>

              {/* Lista Scrollable de Artículos */}
              <div className="news-side-feed">
                {isLoadingNews ? (
                  <div className="news-loading-wrap news-loading-wrap--compact">
                    <div className="news-spinner" />
                    <span>Cargando notas...</span>
                  </div>
                ) : newsPosts.length === 0 ? (
                  <div className="news-empty-state news-empty-state--compact">
                    <span>📜 Sin notas</span>
                  </div>
                ) : (
                  newsPosts.map((post) => {
                    const isSelected = activePost?.id === post.id && selectedNewsCategory !== 'semanal'
                    const dateStr = new Date(post.published_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })

                    return (
                      <div
                        key={post.id}
                        className={`news-side-card ${isSelected ? 'news-side-card--active' : ''} ${
                          post.is_pinned ? 'news-side-card--pinned' : ''
                        }`}
                        onClick={() => handleSelectPost(post.id)}
                      >
                        <div className="news-side-card__top">
                          {post.is_pinned && (
                            <span className="news-badge news-badge--pinned">📌</span>
                          )}
                          {post.version && (
                            <span className="news-badge news-badge--version">{post.version}</span>
                          )}
                          <span className={`news-badge news-badge--cat-${post.category}`}>
                            {post.tag || post.category}
                          </span>
                          <span className="news-side-card__date">{dateStr}</span>
                        </div>

                        <h4 className="news-side-card__title">{post.title}</h4>
                        <p className="news-side-card__snippet">{post.summary}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </aside>

            {/* ── COLUMNA DERECHA: ESCENARIO PRINCIPAL (LECTOR COMPLETO O 7 DÍAS) ── */}
            <section className={`news-main-stage ${mobileNewsTab === 'list' ? 'news-main-stage--mobile-hidden' : ''}`} aria-label="Contenido Principal">
              {/* Barra móvil para volver a la lista */}
              <div className="news-reader-mobile-back">
                <button
                  type="button"
                  className="news-reader-mobile-back-btn"
                  onClick={() => setMobileNewsTab('list')}
                >
                  ⬅ Volver a la lista de notas
                </button>
              </div>

              {/* Opción A: Historial Cronológico de 7 Días */}
              {selectedNewsCategory === 'semanal' ? (
                <div className="news-weekly-pane">
                  <div className="news-weekly-pane__header">
                    <span className="news-weekly-pane__icon">📅</span>
                    <div>
                      <h3 className="news-weekly-pane__title">
                        Mejoras de los Últimos 7 Días (Bloque a Bloque)
                      </h3>
                      <p className="news-weekly-pane__desc">
                        Revisión cronológica de avances de motor determinista, clanes, balance y equipables.
                      </p>
                    </div>
                  </div>

                  <div className="news-weekly-cards-grid">
                    {WEEKLY_UPDATES_BLOCKS.map((block) => (
                      <div key={block.dayNumber} className="news-weekly-dense-card">
                        <div className="news-weekly-dense-card__top">
                          <span className="news-weekly-dense-card__badge">
                            Día {block.dayNumber} · {block.dateLabel}
                          </span>
                          <span
                            className="news-weekly-dense-card__tag"
                            style={{ borderColor: block.tagColor, color: block.tagColor }}
                          >
                            {block.tag}
                          </span>
                        </div>

                        <div className="news-weekly-dense-card__title-row">
                          <span>{block.icon}</span>
                          <h4>{block.title}</h4>
                        </div>

                        <p className="news-weekly-dense-card__sum">{block.summary}</p>

                        <ul className="news-weekly-dense-card__list">
                          {block.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : activePost ? (
                /* Opción B: Lector Completo del Artículo Seleccionado */
                <article className="news-reader-pane">
                  {/* Encabezado del Artículo */}
                  <header className="news-reader-pane__header">
                    <div className="news-reader-pane__meta">
                      {activePost.is_pinned && (
                        <span className="news-badge news-badge--pinned">📌 DESTACADA</span>
                      )}
                      {activePost.version && (
                        <span className="news-badge news-badge--version">{activePost.version}</span>
                      )}
                      <span className={`news-badge news-badge--cat-${activePost.category}`}>
                        {activePost.tag || activePost.category}
                      </span>
                      <span className="news-reader-pane__date">
                        📅{' '}
                        {new Date(activePost.published_at).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="news-reader-pane__author">
                        ✍️ {activePost.author || 'Equipo Plants Arena'}
                      </span>
                    </div>

                    <h2 className="news-reader-pane__title">{activePost.title}</h2>

                    <div className="news-reader-pane__lead">
                      <p>{activePost.summary}</p>
                    </div>
                  </header>

                  {/* Banner Especial de Arequipa Game Fest */}
                  {activePost.category === 'evento' && (
                    <div className="news-event-card-banner">
                      <div className="news-event-card-banner__info">
                        <h4>🏛️ Presencia Oficial en AQP Game Fest 2026</h4>
                        <p>Complejo Cultural Ateneo (Arequipa) · Vitrina de Videojuegos Independientes</p>
                      </div>
                      <a
                        href="https://aqpgamefest.com/juegos.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-btn-primary news-btn-primary--compact"
                      >
                        🌐 aqpgamefest.com/juegos.html ➔
                      </a>
                    </div>
                  )}

                  {/* Cuerpo Formateado en Markdown */}
                  <div className="news-reader-pane__body">
                    {activePost.content.split('\n').map((line, idx) => {
                      const trimmed = line.trim()
                      if (trimmed.startsWith('### ')) {
                        return (
                          <h3 key={idx} className="news-md-h3">
                            {trimmed.replace('### ', '')}
                          </h3>
                        )
                      }
                      if (trimmed.startsWith('## ')) {
                        return (
                          <h2 key={idx} className="news-md-h2">
                            {trimmed.replace('## ', '')}
                          </h2>
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

                  {/* Pie con Navegación entre Artículos */}
                  <footer className="news-reader-pane__footer">
                    {(() => {
                      const currentIndex = newsPosts.findIndex((p) => p.id === activePost.id)
                      const prevPost = currentIndex > 0 ? newsPosts[currentIndex - 1] : null
                      const nextPost =
                        currentIndex >= 0 && currentIndex < newsPosts.length - 1
                          ? newsPosts[currentIndex + 1]
                          : null

                      return (
                        <div className="news-reader-pane__nav-buttons">
                          {prevPost ? (
                            <button
                              type="button"
                              className="news-nav-btn news-nav-btn--prev"
                              onClick={() => handleSelectPost(prevPost.id)}
                            >
                              ⬅ Anterior: {prevPost.title.slice(0, 24)}...
                            </button>
                          ) : (
                            <div />
                          )}

                          {nextPost ? (
                            <button
                              type="button"
                              className="news-nav-btn news-nav-btn--next"
                              onClick={() => handleSelectPost(nextPost.id)}
                            >
                              Siguiente: {nextPost.title.slice(0, 24)}... ➔
                            </button>
                          ) : (
                            <div />
                          )}
                        </div>
                      )
                    })()}
                  </footer>
                </article>
              ) : (
                <div className="news-empty-state">
                  <span>Selecciona una nota para leer</span>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
           TAB 2: BUZÓN DE SUGERENCIAS DE JUGADORES (CON TOP LEADERBOARD COMPLETO)
           ══════════════════════════════════════════════════════════════════════ */}
        {activeTab === 'suggestions' && (
          <div className="news-panoramic-layout suggestions-layout">
            {/* Sub-toggle móvil para alternar entre ver Top propuestas y proponer idea */}
            <div className="news-mobile-subnav">
              <button
                type="button"
                className={`news-mobile-subbtn ${mobileSuggTab === 'feed' ? 'news-mobile-subbtn--active' : ''}`}
                onClick={() => setMobileSuggTab('feed')}
              >
                🏆 Top Propuestas ({filteredSuggestions.length})
              </button>
              <button
                type="button"
                className={`news-mobile-subbtn ${mobileSuggTab === 'form' ? 'news-mobile-subbtn--active' : ''}`}
                onClick={() => setMobileSuggTab('form')}
              >
                ✍️ Proponer Nueva Idea
              </button>
            </div>

            {/* ── COLUMNA IZQUIERDA: FORMULARIO DE PROPUESTA & LEYENDA ── */}
            <aside className={`news-side-nav suggestions-side-nav ${mobileSuggTab === 'feed' ? 'suggestions-side-nav--mobile-hidden' : ''}`}>
              <div className="suggestions-side-form-card">
                <div className="suggestions-side-form-card__header">
                  <h4>📬 Proponer Nueva Idea</h4>
                  <span className="suggestions-player-pill">
                    👤 {currentUser?.username || suggCustomNick || 'Jardinero'}
                  </span>
                </div>

                <form onSubmit={handleSubmitSuggestion} className="suggestions-compact-form">
                  {!currentUser?.username && (
                    <input
                      type="text"
                      placeholder="Tu Nick o Nombre de Jugador..."
                      value={suggCustomNick}
                      onChange={(e) => setSuggCustomNick(e.target.value)}
                      maxLength={24}
                      className="news-input news-input--dense"
                    />
                  )}

                  <input
                    type="text"
                    placeholder="Título breve de tu idea..."
                    value={suggTitle}
                    onChange={(e) => setSuggTitle(e.target.value)}
                    maxLength={100}
                    required
                    className="news-input news-input--dense"
                  />

                  <select
                    value={suggCategory}
                    onChange={(e) => setSuggCategory(e.target.value as SuggestionCategory)}
                    className="news-select news-select--dense"
                  >
                    {SUGGESTION_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>

                  <textarea
                    placeholder="¿Cómo funcionaría tu idea? Explica los detalles..."
                    value={suggContent}
                    onChange={(e) => setSuggContent(e.target.value)}
                    maxLength={1500}
                    required
                    rows={4}
                    className="news-textarea news-textarea--dense"
                  />

                  <div className="suggestions-compact-form__actions">
                    <span className="suggestion-char-count">{suggContent.length}/1500</span>
                    <button
                      type="submit"
                      className="news-btn-primary news-btn-primary--compact news-btn-primary--send"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Enviando...' : '🚀 Publicar'}
                    </button>
                  </div>

                  {formFeedback && (
                    <div className={`suggestion-alert suggestion-alert--${formFeedback.type}`}>
                      {formFeedback.type === 'success' ? '✅' : '⚠️'} {formFeedback.message}
                    </div>
                  )}
                </form>
              </div>

              {/* Leyenda de Estados */}
              <div className="suggestions-side-legend">
                <h5>🌱 Estados de las Ideas</h5>
                <div className="suggestions-legend-rows">
                  <div className="legend-row">
                    <span className="suggestion-status-badge suggestion-badge--received">
                      📥 Recibida
                    </span>
                    <span>Votación abierta</span>
                  </div>
                  <div className="legend-row">
                    <span className="suggestion-status-badge suggestion-badge--review">
                      👀 En Revisión
                    </span>
                    <span>Bajo estudio</span>
                  </div>
                  <div className="legend-row">
                    <span className="suggestion-status-badge suggestion-badge--dev">
                      🔨 En Desarrollo
                    </span>
                    <span>Programándose</span>
                  </div>
                  <div className="legend-row">
                    <span className="suggestion-status-badge suggestion-badge--done">
                      ⭐ ¡Implementada!
                    </span>
                    <span>Ya en el juego</span>
                  </div>
                </div>
              </div>
            </aside>

            {/* ── COLUMNA DERECHA: FEED DE PROPUESTAS CON PODIUM TOP ── */}
            <section className={`news-main-stage suggestions-main-stage ${mobileSuggTab === 'form' ? 'suggestions-main-stage--mobile-hidden' : ''}`} aria-label="Sugerencias">
              {/* Barra de Filtros Compacta */}
              <div className="suggestions-sub-filter-bar">
                <div className="suggestions-filter-tabs">
                  {[
                    { id: 'top', label: '🔥 Más Votadas (Top)' },
                    { id: 'all', label: '✨ Todas' },
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

                <div className="suggestions-filter-right-actions">
                  <select
                    value={selectedSuggestionCat}
                    onChange={(e) => setSelectedSuggestionCat(e.target.value)}
                    className="news-select news-select--dense news-select--compact"
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
                    className="suggestions-new-btn-quick"
                    onClick={() => setMobileSuggTab('form')}
                  >
                    ✍️ Proponer
                  </button>
                </div>
              </div>

              {/* Banner Informativo del Ranking Top */}
              <div className="suggestions-top-banner">
                <span className="suggestions-top-banner__icon">🏆</span>
                <div className="suggestions-top-banner__text">
                  <strong>RANKING DE PROPUESTAS DE LA COMUNIDAD ({filteredSuggestions.length} IDEAS)</strong>
                  <span>Las sugerencias más votadas por los jugadores son revisadas prioritariamente por el equipo de desarrollo.</span>
                </div>
              </div>

              {/* Cuadrícula de Sugerencias con Podium Top 1, 2, 3 */}
              <div className="suggestions-compact-grid">
                {isLoadingSuggestions ? (
                  <div className="news-loading-wrap">
                    <div className="news-spinner" />
                    <span>Cargando ranking de ideas de la comunidad...</span>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="news-empty-state">
                    <span className="news-empty-icon">💡</span>
                    <p>No hay sugerencias con este filtro. ¡Sé el primero en proponer una!</p>
                  </div>
                ) : (
                  filteredSuggestions.map((sugg, index) => {
                    const statusConf =
                      SUGGESTION_STATUS_CONFIG[sugg.status] || SUGGESTION_STATUS_CONFIG.recibida
                    const catConf = SUGGESTION_CATEGORIES.find((c) => c.id === sugg.category)
                    const dateStr = new Date(sugg.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })

                    const rankNumber = index + 1
                    const isTop1 = rankNumber === 1 && suggestionFilter === 'top'
                    const isTop2 = rankNumber === 2 && suggestionFilter === 'top'
                    const isTop3 = rankNumber === 3 && suggestionFilter === 'top'

                    return (
                      <div
                        key={sugg.id}
                        className={`suggestion-compact-card ${
                          sugg.status === 'implementada' ? 'suggestion-compact-card--implemented' : ''
                        } ${isTop1 ? 'suggestion-compact-card--top1' : ''} ${
                          isTop2 ? 'suggestion-compact-card--top2' : ''
                        } ${isTop3 ? 'suggestion-compact-card--top3' : ''}`}
                      >
                        {/* Cabecera de la tarjeta con Badge de Rank */}
                        <div className="suggestion-compact-card__header">
                          <div className="suggestion-compact-card__author-info">
                            {/* Medalla o número de Rank */}
                            <div className="suggestion-rank-indicator">
                              {isTop1 ? (
                                <span className="suggestion-medal suggestion-medal--gold" title="Puesto #1 en Votos">🥇 #1</span>
                              ) : isTop2 ? (
                                <span className="suggestion-medal suggestion-medal--silver" title="Puesto #2 en Votos">🥈 #2</span>
                              ) : isTop3 ? (
                                <span className="suggestion-medal suggestion-medal--bronze" title="Puesto #3 en Votos">🥉 #3</span>
                              ) : (
                                <span className="suggestion-rank-num">#{rankNumber}</span>
                              )}
                            </div>

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

                          <div className="suggestion-compact-card__actions-top">
                            <span className={`suggestion-status-badge ${statusConf.badgeClass}`}>
                              {statusConf.icon} {statusConf.label}
                            </span>
                            <button
                              type="button"
                              className={`suggestion-like-btn ${
                                sugg.has_liked ? 'suggestion-like-btn--active' : ''
                              }`}
                              onClick={() => handleToggleLike(sugg.id)}
                              title={sugg.has_liked ? 'Quitar voto' : 'Votar esta idea'}
                            >
                              <span className="suggestion-like-icon">👍</span>
                              <span className="suggestion-like-count">{sugg.likes_count}</span>
                            </button>
                          </div>
                        </div>

                        {/* Título & Texto */}
                        <h4 className="suggestion-compact-card__title">{sugg.title}</h4>
                        <p className="suggestion-compact-card__text">{sugg.content}</p>

                        {/* Respuesta Oficial del Desarrollador */}
                        {sugg.admin_response && (
                          <div className="suggestion-admin-reply">
                            <div className="suggestion-admin-reply__header">
                              <span className="suggestion-admin-reply__shield">🛡️</span>
                              <strong>Respuesta Oficial de Plants Arena:</strong>
                            </div>
                            <p className="suggestion-admin-reply__body">{sugg.admin_response}</p>
                          </div>
                        )}

                        {/* Mod Controls para Admins */}
                        {isAdmin && (
                          <div className="suggestion-admin-controls">
                            <span className="suggestion-admin-label">Mod:</span>
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
                              💬 {sugg.admin_response ? 'Editar' : 'Responder'}
                            </button>
                          </div>
                        )}

                        {isAdmin && editingResponseId === sugg.id && (
                          <div className="suggestion-admin-response-box">
                            <textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Respuesta oficial del equipo..."
                              rows={2}
                              className="news-textarea news-textarea--dense"
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
                                className="news-btn-primary news-btn-primary--compact"
                                onClick={() => handleSaveResponse(sugg.id)}
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}

export default NewsAndSuggestionsModal
