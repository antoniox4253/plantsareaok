import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface NewsPost {
  id: string
  title: string
  summary: string
  content: string
  tag: string
  category: 'actualizacion' | 'balance' | 'parche' | 'devlog' | 'evento' | string
  version?: string | null
  author?: string | null
  image_url?: string | null
  is_pinned?: boolean
  published_at: string
  created_at?: string
}

export type SuggestionCategory = 'balance' | 'plantas' | 'mecanicas' | 'mejoras' | 'bugs' | 'otro'
export type SuggestionStatus = 'recibida' | 'en_revision' | 'en_desarrollo' | 'implementada' | 'archivada'

export interface PlayerSuggestion {
  id: string
  user_id?: string | null
  player_nick: string
  title: string
  category: SuggestionCategory
  content: string
  status: SuggestionStatus
  likes_count: number
  has_liked?: boolean
  admin_response?: string | null
  created_at: string
}

export const SUGGESTION_CATEGORIES: { id: SuggestionCategory; label: string; icon: string }[] = [
  { id: 'balance', label: 'Balance de Plantas', icon: '⚖️' },
  { id: 'plantas', label: 'Nuevas Plantas / Habilidades', icon: '🌱' },
  { id: 'mecanicas', label: 'Modos y Mecánicas', icon: '🎮' },
  { id: 'mejoras', label: 'Calidad de Vida / UI', icon: '🛠️' },
  { id: 'bugs', label: 'Reporte de Fallos', icon: '🐛' },
  { id: 'otro', label: 'Otras Ideas', icon: '💡' },
]

export const SUGGESTION_STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; badgeClass: string; icon: string }
> = {
  recibida: { label: 'Recibida', badgeClass: 'suggestion-badge--received', icon: '📥' },
  en_revision: { label: 'En Revisión', badgeClass: 'suggestion-badge--review', icon: '👀' },
  en_desarrollo: { label: 'En Desarrollo', badgeClass: 'suggestion-badge--dev', icon: '🔨' },
  implementada: { label: '¡Implementada!', badgeClass: 'suggestion-badge--done', icon: '⭐' },
  archivada: { label: 'Archivada', badgeClass: 'suggestion-badge--archived', icon: '📦' },
}

// Fallback predeterminado por si no hay conexión o se está en modo aislado
const DEFAULT_NEWS_POSTS: NewsPost[] = [
  {
    id: 'default-news-1',
    title: '¡Gran Actualización: Sistema de Clanes, Torneos y Guerra de Fortalezas!',
    summary:
      'Un nuevo nivel competitivo llega a Plants Arena. Crea tu propio clan, dona cartas a tus compañeros y compite por la gloria.',
    content: `### 🌟 Novedades Principales
- **Sistema de Clanes Oficial**: Ahora puedes crear o unirte a un clan, colaborar con otros jugadores y construir la Fortaleza del Clan.
- **Donación de Cartas**: Ayuda a subir de nivel las plantas de tus aliados donando copias diariamente y gana recompensas de oro y experiencia.
- **Torneos Programados**: Salas de torneo con brackets automáticos y botes acumulados de gemas.
- **Chat de Clan en Tiempo Real**: Coordina tus estrategias directamente con tus compañeros de equipo.`,
    tag: '🚀 Gran Actualización',
    category: 'actualizacion',
    version: 'v1.5.0',
    author: 'Equipo Plants Arena',
    is_pinned: true,
    published_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'default-news-2',
    title: 'Equipamiento Épico: Cinturón de Campeón Exclusivo para Bonk Choy',
    summary:
      'Llega el primer ítem equipable exclusivo. Potencia tus golpes, desata combos demoledores y luce un nuevo aspecto dorado en el campo.',
    content: `### 🥊 El Cinturón de Campeón ya está aquí
- **Exclusivo para Bonk Choy**: Forjado en las arenas de combate para llevar su potencial al límite.
- **Bonificaciones de Combate**: Aumento masivo de daño por golpe (+60 daño) y +350 puntos de salud extra.
- **Efectos Visuales**: Nueva animación y aspecto de puños dorados dentro del césped.
- **Cómo obtenerlo**: Disponible mediante los recursos de cultivo en el Jardín o en recompensas especiales.`,
    tag: '🥊 Equipamiento',
    category: 'actualizacion',
    version: 'v1.4.5',
    author: 'Equipo Plants Arena',
    is_pinned: false,
    published_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'default-news-3',
    title: 'Notas de Balance: Ajustes Tácticos y Optimización de Partidas',
    summary:
      'Revisamos el balance de daño, vida y costos de soles para garantizar batallas dinámicas, justas y estratégicas.',
    content: `### ⚖️ Cambios de Balance en Plantas
- **Girasol**: Producción de soles un 5% más rápida para incentivar aperturas tácticas activas.
- **Lanzaguisantes Repetidora**: Ligero incremento en la velocidad de proyectil frente a zombis blindados.
- **Jalapeño**: Ajuste en el radio de impacto de línea para asegurar eliminación limpia en momentos decisivos.
- **Nuez Muralla**: Regeneración de escudo un 10% más eficiente tras mejoras de fusión.`,
    tag: '⚖️ Balance',
    category: 'balance',
    version: 'v1.4.2',
    author: 'Equipo Plants Arena',
    is_pinned: false,
    published_at: new Date(Date.now() - 604800000).toISOString(),
  },
  {
    id: 'default-news-4',
    title: 'Devlog: Anti-Desincronización y Reconstrucción en Tiempo Real',
    summary:
      'Detallamos el trabajo técnico realizado para garantizar combates fluidos a 60 FPS y cero desincronizaciones en partidas ranked.',
    content: `### 🛠️ Mejoras Técnicas y de Rendimiento
- **Motor de Simulación a 60 FPS**: Se rediseñó la línea temporal determinista para sincronizar aliados y rivales tic por tic.
- **Reconstrucción Asíncrona Automática**: Si un jugador experimenta una breve pérdida de conexión, el juego reconstruye la línea temporal sin perder jugadas.
- **Arbitraje Anti-Autowin**: Nuevo sistema automático de detección para prevenir victorias amañadas en el sistema de copas y recompensas.`,
    tag: '🛠️ Devlog',
    category: 'devlog',
    version: 'v1.4.0',
    author: 'Equipo Plants Arena',
    is_pinned: false,
    published_at: new Date(Date.now() - 1036800000).toISOString(),
  },
]

const DEFAULT_SUGGESTIONS: PlayerSuggestion[] = [
  {
    id: 'default-sugg-1',
    player_nick: 'SunflowerQueen',
    title: 'Emotes animados para reaccionar durante la partida',
    category: 'mejoras',
    content:
      'Me gustaría poder enviar caritas o reacciones rápidas de plantas (como un girasol sonriendo o una nuez llorando) mientras jugamos contra otros.',
    status: 'implementada',
    likes_count: 28,
    has_liked: false,
    admin_response: '¡Implementado! Ya puedes usar la rueda de emotes tácticos durante las partidas PvP.',
    created_at: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'default-sugg-2',
    player_nick: 'PlantaMaster99',
    title: 'Agregar modo 2v2 cooperativo entre amigos',
    category: 'mecanicas',
    content:
      'Sería increíble poder jugar con un amigo en el mismo jardín compartiendo soles o dividiendo las líneas para defendernos juntos de oleadas zombi o contra otros dos jugadores.',
    status: 'en_desarrollo',
    likes_count: 14,
    has_liked: false,
    admin_response:
      '¡Gran idea! Nuestro equipo ya está prototipando las dinámicas de salas compartidas para futuras temporadas.',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'default-sugg-3',
    player_nick: 'BlesSD',
    title: 'Recompensas semanales por actividad de clan',
    category: 'mecanicas',
    content:
      'Propongo que los clanes tengan un cofre semanal que se llene según la cantidad de copas y donaciones de todos los miembros del clan.',
    status: 'en_revision',
    likes_count: 9,
    has_liked: false,
    admin_response: null,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
]

const LOCAL_STORAGE_SUGGESTIONS_KEY = 'pa_player_suggestions_local_v1'

const getLocalSuggestions = (): PlayerSuggestion[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_SUGGESTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveLocalSuggestions = (list: PlayerSuggestion[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_STORAGE_SUGGESTIONS_KEY, JSON.stringify(list))
  } catch {}
}

export const newsAndSuggestionsService = {
  /**
   * Obtiene la lista de noticias y devlogs oficiales.
   */
  async getNewsPosts(category?: string): Promise<NewsPost[]> {
    if (!isSupabaseConfigured() || !supabase) {
      return this.filterDefaultNews(category)
    }

    try {
      const { data, error } = await (supabase as any).rpc('get_game_news_posts', {
        p_category: category && category !== 'todas' ? category : null,
        p_limit: 30,
      })

      if (error) {
        console.warn('Fallback a consulta directa de noticias:', error.message)
        let query = (supabase as any)
          .from('game_news_posts')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('published_at', { ascending: false })
          .limit(30)

        if (category && category !== 'todas') {
          query = query.eq('category', category)
        }

        const fallback = await query
        if (fallback.error || !fallback.data || fallback.data.length === 0) {
          return this.filterDefaultNews(category)
        }
        return fallback.data as NewsPost[]
      }

      if (Array.isArray(data) && data.length > 0) {
        return data as unknown as NewsPost[]
      }

      return this.filterDefaultNews(category)
    } catch (err) {
      console.warn('Error fetching news posts, usando fallback:', err)
      return this.filterDefaultNews(category)
    }
  },

  filterDefaultNews(category?: string): NewsPost[] {
    if (!category || category === 'todas') {
      return DEFAULT_NEWS_POSTS
    }
    return DEFAULT_NEWS_POSTS.filter((p) => p.category === category)
  },

  /**
   * Obtiene las sugerencias comunitarias con sus estados y nicks de jugadores.
   */
  async getSuggestions(options?: {
    category?: string
    status?: string
    userId?: string
  }): Promise<PlayerSuggestion[]> {
    const categoryFilter = options?.category && options.category !== 'todas' ? options.category : null
    const statusFilter = options?.status && options.status !== 'todas' ? options.status : null

    if (!isSupabaseConfigured() || !supabase) {
      const local = getLocalSuggestions()
      let combined = [...local, ...DEFAULT_SUGGESTIONS]
      if (categoryFilter) {
        combined = combined.filter((s) => s.category === categoryFilter)
      }
      if (statusFilter) {
        combined = combined.filter((s) => s.status === statusFilter)
      }
      return combined
    }

    try {
      const { data, error } = await (supabase as any).rpc('get_game_suggestions', {
        p_category: categoryFilter,
        p_status: statusFilter,
        p_user_id: options?.userId || null,
        p_limit: 50,
      })

      if (error) {
        console.warn('Fallback de sugerencias por error RPC:', error.message)
        const local = getLocalSuggestions()
        return [...local, ...DEFAULT_SUGGESTIONS]
      }

      if (Array.isArray(data)) {
        // Combinar sugerencias locales provisionales si las hay
        const local = getLocalSuggestions()
        const uncommitted = local.filter((l) => !data.some((d: any) => d.id === l.id))
        return [...uncommitted, ...data] as unknown as PlayerSuggestion[]
      }

      return DEFAULT_SUGGESTIONS
    } catch (err) {
      console.warn('Error fetching suggestions:', err)
      return DEFAULT_SUGGESTIONS
    }
  },

  /**
   * Publica una nueva sugerencia en el buzón.
   */
  async submitSuggestion(params: {
    title: string
    category: SuggestionCategory
    content: string
    playerNick?: string
  }): Promise<{ success: boolean; suggestion?: PlayerSuggestion; error?: string }> {
    const { title, category, content, playerNick } = params

    if (!title || title.trim().length < 3) {
      return { success: false, error: 'El título debe tener al menos 3 caracteres.' }
    }
    if (!content || content.trim().length < 10) {
      return { success: false, error: 'La sugerencia debe tener al menos 10 caracteres.' }
    }

    if (!isSupabaseConfigured() || !supabase) {
      const newSugg: PlayerSuggestion = {
        id: `local-sugg-${Date.now()}`,
        player_nick: playerNick || 'Jardinero',
        title: title.trim(),
        category,
        content: content.trim(),
        status: 'recibida',
        likes_count: 0,
        has_liked: false,
        created_at: new Date().toISOString(),
      }
      const existing = getLocalSuggestions()
      saveLocalSuggestions([newSugg, ...existing])
      return { success: true, suggestion: newSugg }
    }

    try {
      const { data, error } = await (supabase as any).rpc('submit_game_suggestion', {
        p_title: title.trim(),
        p_category: category,
        p_content: content.trim(),
        p_player_nick: playerNick || null,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      const res = data as any
      if (res && res.success) {
        return { success: true, suggestion: res.suggestion }
      }
      return { success: false, error: res?.error || 'No se pudo enviar la sugerencia.' }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión.' }
    }
  },

  /**
   * Vota / da like a una sugerencia.
   */
  async toggleSuggestionLike(
    suggestionId: string
  ): Promise<{ success: boolean; likes_count?: number; has_liked?: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true, likes_count: 1, has_liked: true }
    }

    try {
      const { data, error } = await (supabase as any).rpc('toggle_suggestion_like', {
        p_suggestion_id: suggestionId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; likes_count: number; has_liked: boolean }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al votar.' }
    }
  },

  /**
   * Acción de moderación/administrador: actualizar estado y respuesta de sugerencia.
   */
  async adminUpdateSuggestion(
    suggestionId: string,
    status: SuggestionStatus,
    adminResponse?: string | null
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Sin conexión a base de datos.' }
    }

    try {
      const { error } = await (supabase as any).rpc('admin_update_suggestion', {
        p_suggestion_id: suggestionId,
        p_status: status,
        p_admin_response: adminResponse || null,
      })

      if (error) return { success: false, error: error.message }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al actualizar.' }
    }
  },

  /**
   * Acción de administrador: publicar una nueva nota de actualización en el blog.
   */
  async adminPublishNewsPost(params: {
    title: string
    summary: string
    content: string
    tag?: string
    category?: string
    version?: string
    is_pinned?: boolean
  }): Promise<{ success: boolean; post?: NewsPost; error?: string }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Sin conexión a base de datos.' }
    }

    try {
      const { data, error } = await (supabase as any).rpc('admin_publish_news_post', {
        p_title: params.title,
        p_summary: params.summary,
        p_content: params.content,
        p_tag: params.tag || 'Actualización',
        p_category: params.category || 'actualizacion',
        p_version: params.version || null,
        p_is_pinned: params.is_pinned ?? false,
      })

      if (error) return { success: false, error: error.message }
      const res = data as any
      if (res?.success) return { success: true, post: res.post }
      return { success: false, error: res?.error || 'Error al publicar noticia.' }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al publicar noticia.' }
    }
  },
}
