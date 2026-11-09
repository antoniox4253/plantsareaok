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

export interface WeeklyUpdateDayBlock {
  dayNumber: number
  dateLabel: string
  title: string
  tag: string
  tagColor: string
  icon: string
  summary: string
  highlights: string[]
}

export const WEEKLY_UPDATES_BLOCKS: WeeklyUpdateDayBlock[] = [
  {
    dayNumber: 1,
    dateLabel: '8 Nov (Hoy)',
    title: 'Blog de Novedades & AQP Game Fest 2026',
    tag: 'HOY · DESTACADO',
    tagColor: '#10b981',
    icon: '📰',
    summary: 'Lanzamiento del centro de devlog, buzón de sugerencias y vitrina en feria de Arequipa.',
    highlights: [
      'Nuevo Blog Oficial y notas técnicas de desarrollo sin publicidad invasiva.',
      'Buzón Comunitario de Sugerencias con Nick de Jugador verificado y votos.',
      'Presencia en AQP Game Fest 2026 destacada en aqpgamefest.com/juegos.html (Atoniox).',
    ],
  },
  {
    dayNumber: 2,
    dateLabel: '7 Nov',
    title: 'Sistema de Clanes y Chat en Vivo',
    tag: 'COMUNIDAD',
    tagColor: '#3b82f6',
    icon: '🏰',
    summary: 'Fundación de clanes, roles de liderazgo y mensajería en tiempo real.',
    highlights: [
      'Creación y personalización de clanes con insignias y Fortaleza de Clan.',
      'Chat de Clan instantáneo para coordinar tácticas entre compañeros.',
      'Nivelación y donación de fondos comunales para la bóveda del clan.',
    ],
  },
  {
    dayNumber: 3,
    dateLabel: '6 Nov',
    title: 'Donación de Cartas y Torneos',
    tag: 'COMPETITIVO',
    tagColor: '#8b5cf6',
    icon: '📦',
    summary: 'Petición comunitaria de cartas y lobby con brackets automáticos.',
    highlights: [
      'Donación diaria de copias de plantas entre aliados con oro y XP.',
      'Salas de torneo con brackets dinámicos y botes de gemas.',
      'Optimización del emparejamiento por latencia regional.',
    ],
  },
  {
    dayNumber: 4,
    dateLabel: '5 Nov',
    title: 'Cinturón de Campeón (Bonk Choy)',
    tag: 'EQUIPAMIENTO',
    tagColor: '#f59e0b',
    icon: '🥊',
    summary: 'Primer ítem equipable exclusivo con estadísticas y efectos dorados.',
    highlights: [
      'Exclusivo para Bonk Choy: +60 de daño por puñetazo y +350 puntos de salud.',
      'Efectos visuales dorados en combate y nuevo arte en el paquete de semillas.',
      'Obtención mediante recursos de cultivo en el Jardín.',
    ],
  },
  {
    dayNumber: 5,
    dateLabel: '4 Nov',
    title: 'Notas de Balance Táctico',
    tag: 'BALANCE',
    tagColor: '#eab308',
    icon: '⚖️',
    summary: 'Ajuste de tiempos de recarga, producción de soles y daño por segundo.',
    highlights: [
      'Girasol: producción de soles un 5% más rápida para aperturas ágiles.',
      'Repetidora: aumento de cadencia de tiro frente a zombis blindados.',
      'Jalapeño: precisión en detonación y carril libre garantizado.',
    ],
  },
  {
    dayNumber: 6,
    dateLabel: '3 Nov',
    title: 'Motor 60 FPS y Anti-Desync',
    tag: 'MOTOR DETERMINISTA',
    tagColor: '#06b6d4',
    icon: '⚡',
    summary: 'Simulación fluida y reconstrucción determinista de jugadas.',
    highlights: [
      'Línea temporal a 60 FPS con sincronización tic a tic entre rivales.',
      'Reconstrucción automática asíncrona ante microcortes de red.',
      'Reducción drástica del lag en partidas ranked clasificatorias.',
    ],
  },
  {
    dayNumber: 7,
    dateLabel: '2 Nov',
    title: 'Arbitraje Elo y Optimización',
    tag: 'SEGURIDAD & ELO',
    tagColor: '#10b981',
    icon: '🛡️',
    summary: 'Validación en 1,400 Copas, sistema de amigos y carga web ligera.',
    highlights: [
      'Arbitraje automático anti-autowin en el sistema de referidos.',
      'Recompensas permanentes de 100 de Oro y 5% de comisión en gemas.',
      'Carga ultrarrápida en navegadores móviles sin necesidad de instalación.',
    ],
  },
]

// Fallback predeterminado por si no hay conexión o se está en modo aislado
const DEFAULT_NEWS_POSTS: NewsPost[] = [
  {
    id: 'default-news-aqp',
    title: '¡Plants Arena Presente en el AQP Game Fest 2026! (Arequipa, Perú)',
    summary:
      'Plants Arena forma parte del festival de videojuegos y tecnología más importante de Arequipa. Conoce nuestra participación oficial en aqpgamefest.com/juegos.html.',
    content: `### 🎮 Participación Oficial en AQP Game Fest 2026
¡Estamos muy orgullosos de anunciar que **Plants Arena** está presente de manera oficial en el **AQP Game Fest 2026**, la gran fiesta del desarrollo de videojuegos, tecnología y creatividad digital celebrada en Arequipa, Perú!

### 🌐 Destacados en la Muestra de Juegos
Puedes encontrar a Plants Arena en la vitrina oficial de títulos del evento ingresando a:
👉 **[aqpgamefest.com/juegos.html](https://aqpgamefest.com/juegos.html)**

En la sección oficial de videojuegos se destaca:
- **Título**: Plant Arena (Desarrollado por Atoniox).
- **Género**: Estrategia táctica PvP en tiempo real (3 carriles).
- **Plataformas**: 100% jugable en navegador web, tanto en PC como en dispositivos móviles, sin descargas.

### 🏛️ Stand en Vivo en el Complejo Cultural Ateneo
Del **6 al 8 de noviembre**, los asistentes a la feria en las instalaciones del **Complejo Cultural Ateneo** pudieron:
- Probar en primicia el nuevo sistema de **Guerra de Clanes y Torneos**.
- Jugar partidas de exhibición y duelos cara a cara con Bonk Choy equipado con su nuevo **Cinturón de Campeón**.
- Conocer directamente al equipo desarrollador y compartir sugerencias para el futuro del juego.

### 🎁 Celebración para Toda la Comunidad
Para conmemorar este gran hito de marketing y crecimiento de la comunidad, estamos liberando nuevas actualizaciones semanales y el nuevo **Buzón de Sugerencias**, para que cada jugador pueda dejar su huella en el juego. ¡Gracias por hacer crecer a Plants Arena!`,
    tag: '🎉 Feria Arequipa',
    category: 'evento',
    version: 'Especial AQP 2026',
    author: 'Atoniox / Equipo Plants Arena',
    is_pinned: true,
    published_at: new Date().toISOString(),
  },
  {
    id: 'default-news-weekly-7d',
    title: 'Registro Semanal: Todas las Mejoras de los Últimos 7 Días (Día a Día)',
    summary:
      'Repasamos bloque a bloque cada una de las actualizaciones, balance, optimizaciones y nuevos sistemas implementados a lo largo de esta semana.',
    content: `### 📅 Bitácora de Desarrollo: Últimos 7 Días

#### 🟢 Día 1 · 8 de Noviembre (Hoy)
- **Nuevo Blog de Novedades & Notas de Parche**: Sección oficial para seguir el progreso del juego sin publicidad.
- **Buzón de Sugerencias Comunitario**: Envía propuestas con tu Nick verificado y vota las mejores ideas.
- **Presentación en AQP Game Fest 2026**: Destacados en la vitrina de juegos en [aqpgamefest.com/juegos.html](https://aqpgamefest.com/juegos.html).

#### 🟢 Día 2 · 7 de Noviembre
- **Sistema de Clanes Oficial**: Creación de clanes, roles de líderes y miembros, y fundación de la Fortaleza de Clan.
- **Chat de Clan en Tiempo Real**: Canales de mensajería instantánea para coordinar partidas entre compañeros.

#### 🟢 Día 3 · 6 de Noviembre
- **Donación de Cartas Comunitarias**: Petición diaria de copias de plantas con recompensas en Oro y Experiencia.
- **Lobby de Torneos Programados**: Salas con brackets automáticos y botes de gemas acumulados.

#### 🟢 Día 4 · 5 de Noviembre
- **Equipamiento Épico para Bonk Choy**: Cinturón de Campeón (+60 de daño por golpe, +350 puntos de vida extra).
- **Efectos Visuales Dorados**: Puñetazos dorados en combate y previsualización de skins en el paquete de semillas.

#### 🟢 Día 5 · 4 de Noviembre
- **Notas de Balance Táctico**:
  - *Girasol*: Producción de soles un 5% más rápida para aperturas estratégicas activas.
  - *Lanzaguisantes Repetidora*: Mayor cadencia de disparo contra zombis con armadura pesada.
  - *Jalapeño*: Optimización del tiempo de detonación en carril.
  - *Nuez Muralla*: Regeneración reforzada tras fusiones.

#### 🟢 Día 6 · 3 de Noviembre
- **Motor de Simulación a 60 FPS Determinista**: Sincronización perfecta tic por tic.
- **Reconstrucción Asíncrona Automática**: Cero pérdida de jugadas ante microcortes o latencia de red.

#### 🟢 Día 7 · 2 de Noviembre
- **Sistema de Arbitraje Anti-Autowin**: Detección criptográfica contra victorias amañadas en ligas clasificatorias.
- **Economía de Referidos Renovada**: Criterio de validación en 1,400 Copas Elo con 100 de oro y 5% de comisiones automáticas.`,
    tag: '⏱️ Últimos 7 Días',
    category: 'actualizacion',
    version: 'Semana 45',
    author: 'Equipo Plants Arena',
    is_pinned: true,
    published_at: new Date(Date.now() - 3600000).toISOString(),
  },
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
    title: 'Emotes animados y reacciones tácticas durante el combate PvP',
    category: 'mejoras',
    content:
      'Poder enviar caritas o reacciones rápidas de plantas (como un girasol sonriendo, una nuez llorando o un chile furioso) mientras jugamos contra rivales.',
    status: 'implementada',
    likes_count: 42,
    has_liked: false,
    admin_response: '¡Implementado! Ya puedes usar la rueda de emotes tácticos durante las partidas PvP.',
    created_at: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'default-sugg-2',
    player_nick: 'PlantaMaster99',
    title: 'Modo 2v2 Cooperativo en tiempo real entre amigos',
    category: 'mecanicas',
    content:
      'Sería increíble poder jugar con un compañero en el mismo jardín compartiendo soles o dividiendo las líneas para defendernos juntos de oleadas o contra otros dos rivales.',
    status: 'en_desarrollo',
    likes_count: 36,
    has_liked: false,
    admin_response:
      '¡Gran idea! Nuestro equipo ya está prototipando las dinámicas de salas compartidas y dobles carriles para próximas temporadas.',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'default-sugg-3',
    player_nick: 'BlesSD',
    title: 'Cofre semanal y recompensas acumulativas por actividad del Clan',
    category: 'mecanicas',
    content:
      'Propongo que los clanes tengan un cofre semanal que suba de nivel según la cantidad de copas, donaciones y batallas ganadas por todos los miembros del clan.',
    status: 'en_revision',
    likes_count: 29,
    has_liked: false,
    admin_response: 'Evaluando con el equipo de diseño para sincronizarlo con el Fondo de Recompensas de Torneos de Clan.',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'default-sugg-4',
    player_nick: 'GladiadorGélido',
    title: 'Nueva Planta: Hielaguisantes Primordial con disparo ralentizante en cono',
    category: 'plantas',
    content:
      'Una variante ancestral de guisante que ralentiza en área y congela brevemente al cuarto impacto consecutivo sobre el mismo zombi.',
    status: 'recibida',
    likes_count: 24,
    has_liked: false,
    admin_response: null,
    created_at: new Date(Date.now() - 140000000).toISOString(),
  },
  {
    id: 'default-sugg-5',
    player_nick: 'Daineris',
    title: 'Modo Espectador en directo para torneos de Clan y partidas de líderes',
    category: 'social',
    content:
      'Poder presenciar las finales de los torneos internos del clan en tiempo real como público, con chat de clan en vivo para animar a los combatientes.',
    status: 'en_revision',
    likes_count: 21,
    has_liked: false,
    admin_response: null,
    created_at: new Date(Date.now() - 110000000).toISOString(),
  },
  {
    id: 'default-sugg-6',
    player_nick: 'Sekiro',
    title: 'Skins cosméticas y auras luminosas para el Árbol del Clan según su nivel',
    category: 'mejoras',
    content:
      'Que el Árbol de la Sabiduría del Clan cambie visualmente según su nivel (follaje dorado, raíces ancestrales, luciérnagas míticas) para reflejar su poder.',
    status: 'recibida',
    likes_count: 18,
    has_liked: false,
    admin_response: null,
    created_at: new Date(Date.now() - 90000000).toISOString(),
  },
  {
    id: 'default-sugg-7',
    player_nick: 'JonSnow',
    title: 'Historial detallado con reproducción de partidas y huellas del tablero',
    category: 'mejoras',
    content:
      'Guardar las últimas 10 partidas con estadísticas detalladas de daño, soles recolectados y reproducción visual paso a paso para aprender de derrotas.',
    status: 'implementada',
    likes_count: 16,
    has_liked: false,
    admin_response: '¡Implementado! Ya puedes consultar tu historial completo desde Menú > Mis Partidas.',
    created_at: new Date(Date.now() - 75000000).toISOString(),
  },
  {
    id: 'default-sugg-8',
    player_nick: 'Luffy',
    title: 'Ítem equipable exclusivo para Repetidora: Cañón Doble Dorado',
    category: 'plantas',
    content:
      'Un ítem legendario que aumente la cadencia de la Repetidora y le otorgue un 15% de probabilidad de triple disparo crítico con efecto visual de pólvora dorada.',
    status: 'en_desarrollo',
    likes_count: 14,
    has_liked: false,
    admin_response: '¡En desarrollo! Siguiendo el éxito del Cinturón de Campeón de Bonk Choy, nuevos ítems equipables exclusivos llegarán esta temporada.',
    created_at: new Date(Date.now() - 60000000).toISOString(),
  },
  {
    id: 'default-sugg-9',
    player_nick: 'Zoro',
    title: 'Torneos Relámpago de fin de semana con reglas especiales y mazos sorpresa',
    category: 'mecanicas',
    content:
      'Mini-torneos de 30 minutos los sábados y domingos con modificadores locos (ej. costo de sol reducido al 50%, plantas gigantes, recarga ultra rápida).',
    status: 'recibida',
    likes_count: 11,
    has_liked: false,
    admin_response: null,
    created_at: new Date(Date.now() - 40000000).toISOString(),
  },
  {
    id: 'default-sugg-10',
    player_nick: 'Nami',
    title: 'Filtro rápido por rareza (Común, Rara, Épica, Legendaria) en el Jardín',
    category: 'mejoras',
    content:
      'Pestañas o botones de filtro en el inventario del Jardín para ver rápidamente solo plantas Legendarias o Épicas sin tener que buscarlas en toda la lista.',
    status: 'implementada',
    likes_count: 9,
    has_liked: false,
    admin_response: '¡Implementado! El catálogo del Jardín y Álbum ahora agrupan por rareza y ranuras activas.',
    created_at: new Date(Date.now() - 25000000).toISOString(),
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

const LIKED_SUGGESTIONS_KEY = 'plant_arena_liked_suggestions'

function getLocalLikedSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(LIKED_SUGGESTIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function toggleLocalLikedSuggestion(id: string): { hasLiked: boolean } {
  try {
    const list = getLocalLikedSuggestions()
    const idx = list.indexOf(id)
    let hasLiked = false
    if (idx >= 0) {
      list.splice(idx, 1)
      hasLiked = false
    } else {
      list.push(id)
      hasLiked = true
    }
    localStorage.setItem(LIKED_SUGGESTIONS_KEY, JSON.stringify(list))
    return { hasLiked }
  } catch {
    return { hasLiked: true }
  }
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
        const localLiked = getLocalLikedSuggestions()
        const combined = [...uncommitted, ...data].map((s: any) => ({
          ...s,
          has_liked: Boolean(s.has_liked) || localLiked.includes(s.id),
        }))
        // Complementar con ideas de catálogo para que el Top esté siempre nutrido y visible
        const existingTitles = new Set(combined.map((c: any) => (c.title || '').toLowerCase().trim()))
        for (const def of DEFAULT_SUGGESTIONS) {
          if (!existingTitles.has(def.title.toLowerCase().trim())) {
            combined.push({
              ...def,
              has_liked: localLiked.includes(def.id),
            })
          }
        }
        return combined as unknown as PlayerSuggestion[]
      }

      const defaultWithLikes = DEFAULT_SUGGESTIONS.map((s) => ({
        ...s,
        has_liked: getLocalLikedSuggestions().includes(s.id),
      }))
      return defaultWithLikes
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
      const local = toggleLocalLikedSuggestion(suggestionId)
      return { success: true, likes_count: local.hasLiked ? 1 : 0, has_liked: local.hasLiked }
    }

    try {
      const { data, error } = await (supabase as any).rpc('toggle_suggestion_like', {
        p_suggestion_id: suggestionId,
      })

      if (error) {
        // Fallback local ante error o usuario sin sesión
        const local = toggleLocalLikedSuggestion(suggestionId)
        return { success: true, has_liked: local.hasLiked }
      }

      const res = data as any
      if (res && res.success === false) {
        // Usuario visitante o no autenticado: registrar voto en almacenamiento local del navegador
        const local = toggleLocalLikedSuggestion(suggestionId)
        return { success: true, has_liked: local.hasLiked }
      }

      if (res && res.success) {
        toggleLocalLikedSuggestion(suggestionId)
        return res as { success: boolean; likes_count: number; has_liked: boolean }
      }

      const local = toggleLocalLikedSuggestion(suggestionId)
      return { success: true, has_liked: local.hasLiked }
    } catch (err: any) {
      const local = toggleLocalLikedSuggestion(suggestionId)
      return { success: true, has_liked: local.hasLiked }
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
