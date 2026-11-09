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

  // News states
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([])
  const [selectedNewsCategory, setSelectedNewsCategory] = useState<string>('todas')
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(true)
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null)

  // Suggestion states
  const [suggestions, setSuggestions] = useState<PlayerSuggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState<boolean>(true)
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'top' | 'implemented' | 'mine'>('all')
  const [selectedSuggestionCat, setSelectedSuggestionCat] = useState<string>('todas')

  // Form states
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

  // Load News
  const loadNews = useCallback(async () => {
    setIsLoadingNews(true)
    try {
      const cat = selectedNewsCategory === 'semanal' ? 'todas' : selectedNewsCategory
      const posts = await newsAndSuggestionsService.getNewsPosts(cat)
      setNewsPosts(posts)
      if (posts.length > 0 && !expandedNewsId) {
        setExpandedNewsId(posts[0].id)
      }
    } catch (err) {
      console.warn('Error loading news posts:', err)
    } finally {
      setIsLoadingNews(false)
    }
  }, [selectedNewsCategory, expandedNewsId])

  useEffect(() => {
    if (isOpen && activeTab === 'news') {
      void loadNews()
    }
  }, [isOpen, activeTab, selectedNewsCategory, loadNews])

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
      if (res.success && res.likes_count !== undefined) {
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestionId
              ? { ...s, likes_count: res.likes_count!, has_liked: res.has_liked }
              : s
          )
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
          message: '¡Sugerencia enviada con éxito! Gracias por ayudarnos a mejorar Plants Arena.',
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
        setExpandedNewsId(res.post.id)
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
    <div className="news-modal-backdrop" onClick={onClose}>
      <div className="news-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="news-modal-header">
          <div className="news-modal-tabs">
            <button
              type="button"
              className={`news-modal-tab ${activeTab === 'news' ? 'news-modal-tab--active' : ''}`}
              onClick={() => handleTabChange('news')}
            >
              📰 Blog & Actualizaciones
            </button>
            <button
              type="button"
              className={`news-modal-tab ${activeTab === 'suggestions' ? 'news-modal-tab--active' : ''}`}
              onClick={() => handleTabChange('suggestions')}
            >
              💡 Buzón de Sugerencias
              <span className="news-tab-badge">{suggestions.length || '•'}</span>
            </button>
          </div>

          <button
            type="button"
            className="news-modal-close-btn"
            onClick={() => {
              soundManager.playSound('click', 0.5)
              onClose()
            }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* ── TAB 1: BLOG DE NOTICIAS & ACTUALIZACIONES ── */}
        {activeTab === 'news' && (
          <div className="news-tab-content">
            {/* Filter Bar */}
            <div className="news-filter-bar">
              <div className="news-categories-chips">
                {[
                  { id: 'todas', label: 'Todas' },
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

            {/* Admin Publication Form */}
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
                  placeholder="Contenido detallado (admite saltos de línea y viñetas)..."
                  value={adminPostContent}
                  onChange={(e) => setAdminPostContent(e.target.value)}
                  required
                  rows={5}
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

            {/* Banner Destacado: Presencia en AQP Game Fest 2026 */}
            <div
              className="news-marketing-banner"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                const aqpPost = newsPosts.find(
                  (p) => p.tag.includes('Arequipa') || p.category === 'evento'
                )
                if (aqpPost) {
                  setExpandedNewsId(aqpPost.id)
                  setSelectedNewsCategory('evento')
                } else {
                  setSelectedNewsCategory('evento')
                }
              }}
            >
              <div className="news-marketing-banner__left">
                <span className="news-marketing-banner__icon">🏛️</span>
                <div className="news-marketing-banner__info">
                  <div className="news-marketing-banner__badges">
                    <span className="news-marketing-banner__tag">FERIA DE VIDEOJUEGOS · AREQUIPA</span>
                    <span className="news-marketing-banner__live">🔥 PARTICIPACIÓN OFICIAL</span>
                  </div>
                  <h4 className="news-marketing-banner__title">
                    ¡Plants Arena Presente en el AQP Game Fest 2026!
                  </h4>
                  <p className="news-marketing-banner__desc">
                    Exhibición oficial en el Complejo Cultural Ateneo. Encuéntranos en la vitrina de juegos en <strong>aqpgamefest.com/juegos.html</strong>.
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

            {/* Bloques Segmentados Día a Día de los Últimos 7 Días */}
            {selectedNewsCategory === 'semanal' && (
              <div className="news-weekly-timeline">
                <div className="news-weekly-header">
                  <span className="news-weekly-icon">📅</span>
                  <div>
                    <h3 className="news-weekly-title">Mejoras de los Últimos 7 Días (Bloque a Bloque)</h3>
                    <p className="news-weekly-sub">
                      Lectura segmentada día a día para que revises fácilmente cada una de las mejoras y novedades recientes.
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

            {/* News Articles Feed */}
            <div className="news-articles-list">
              {isLoadingNews ? (
                <div className="news-loading-wrap">
                  <div className="news-spinner" />
                  <span>Cargando noticias y notas de parche...</span>
                </div>
              ) : newsPosts.length === 0 ? (
                <div className="news-empty-state">
                  <span className="news-empty-icon">📜</span>
                  <p>No hay publicaciones en esta categoría por ahora.</p>
                </div>
              ) : (
                newsPosts.map((post) => {
                  const isExpanded = expandedNewsId === post.id
                  const dateStr = new Date(post.published_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })

                  return (
                    <article
                      key={post.id}
                      className={`news-article-card ${post.is_pinned ? 'news-article-card--pinned' : ''}`}
                    >
                      <div
                        className="news-article-header"
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setExpandedNewsId(isExpanded ? null : post.id)
                        }}
                      >
                        <div className="news-article-badges">
                          {post.is_pinned && (
                            <span className="news-badge news-badge--pinned">📌 DESTACADA</span>
                          )}
                          {post.version && (
                            <span className="news-badge news-badge--version">{post.version}</span>
                          )}
                          <span className={`news-badge news-badge--cat-${post.category}`}>
                            {post.tag || post.category}
                          </span>
                          <span className="news-article-date">{dateStr}</span>
                        </div>

                        <h3 className="news-article-title">{post.title}</h3>
                        <p className="news-article-summary">{post.summary}</p>

                        <div className="news-article-expand-row">
                          <span className="news-expand-hint">
                            {isExpanded ? '▲ Ocultar detalles' : '▼ Leer nota completa'}
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="news-article-body">
                          <div className="news-markdown-content">
                            {post.content.split('\n').map((line, idx) => {
                              const trimmed = line.trim()
                              if (trimmed.startsWith('### ')) {
                                return (
                                  <h4 key={idx} className="news-md-h4">
                                    {trimmed.replace('### ', '')}
                                  </h4>
                                )
                              }
                              if (trimmed.startsWith('- ')) {
                                return (
                                  <li key={idx} className="news-md-li">
                                    {trimmed.replace('- ', '')}
                                  </li>
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

                          <div className="news-article-footer">
                            <span className="news-author">✍️ {post.author || 'Equipo Plants Arena'}</span>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: BUZÓN DE SUGERENCIAS DE JUGADORES ── */}
        {activeTab === 'suggestions' && (
          <div className="news-tab-content">
            {/* Suggestion Submission Box */}
            <div className="suggestion-submit-panel">
              <div className="suggestion-submit-header">
                <div>
                  <h3 className="suggestion-submit-title">📬 Envía tu Propuesta o Sugerencia</h3>
                  <p className="suggestion-submit-subtitle">
                    ¡Tu opinión construye Plants Arena! Deja tu idea y la comunidad y los desarrolladores la revisarán.
                  </p>
                </div>
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
                    placeholder="Título breve de tu idea (ej. Modo supervivencia cooperativo)..."
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
                  placeholder="Detalla tu sugerencia aquí... ¿Cómo funcionaría? ¿Qué plantas o modos involucra? Sé lo más específico posible."
                  value={suggContent}
                  onChange={(e) => setSuggContent(e.target.value)}
                  maxLength={1500}
                  required
                  rows={3}
                  className="news-textarea"
                />

                <div className="suggestion-form-footer">
                  <span className="suggestion-char-count">
                    {suggContent.length} / 1500 caracteres
                  </span>

                  <button
                    type="submit"
                    className="news-btn-primary news-btn-primary--send"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Enviando...' : '🚀 PUBLICAR SUGERENCIA'}
                  </button>
                </div>

                {formFeedback && (
                  <div className={`suggestion-alert suggestion-alert--${formFeedback.type}`}>
                    {formFeedback.type === 'success' ? '✅' : '⚠️'} {formFeedback.message}
                  </div>
                )}
              </form>
            </div>

            {/* Filter and Sorting Row */}
            <div className="suggestion-filter-row">
              <div className="suggestion-filter-tabs">
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
            </div>

            {/* Suggestions Feed */}
            <div className="suggestions-list">
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
                  const statusConf = SUGGESTION_STATUS_CONFIG[sugg.status] || SUGGESTION_STATUS_CONFIG.recibida
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
                      {/* Top Header */}
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
                            title="Votar por esta sugerencia"
                          >
                            <span className="suggestion-like-icon">👍</span>
                            <span className="suggestion-like-count">{sugg.likes_count}</span>
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <h4 className="suggestion-card-title">{sugg.title}</h4>
                      <p className="suggestion-card-text">{sugg.content}</p>

                      {/* Official Admin Response */}
                      {sugg.admin_response && (
                        <div className="suggestion-admin-reply">
                          <div className="suggestion-admin-reply__header">
                            <span className="suggestion-admin-reply__shield">🛡️</span>
                            <strong>Respuesta del Equipo de Desarrollo:</strong>
                          </div>
                          <p className="suggestion-admin-reply__body">{sugg.admin_response}</p>
                        </div>
                      )}

                      {/* Admin Controls */}
                      {isAdmin && (
                        <div className="suggestion-admin-controls">
                          <span className="suggestion-admin-label">⚙️ Mod:</span>
                          <div className="suggestion-admin-status-btns">
                            {(['recibida', 'en_revision', 'en_desarrollo', 'implementada', 'archivada'] as SuggestionStatus[]).map(
                              (st) => (
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
                              )
                            )}
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
    </div>
  )
}

export default NewsAndSuggestionsModal
