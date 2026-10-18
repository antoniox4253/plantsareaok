export interface StreamingPlatform {
  value: string
  label: string
  image: string
  category?: 'Streaming' | 'IA & Herramientas' | 'Anime & Cine' | 'Música'
  hint?: string
}

export interface StreamingServer {
  value: string
  label: string
  image: string
}

export interface StreamingPlan {
  name: string
  price: string
  gemCost?: number
}

export interface StreamingProduct {
  id: string
  name: string
  type: 'Streaming' | 'IA & Herramientas' | 'Anime & Cine' | 'Música'
  price: string
  originalPrice?: string
  gemCost?: number
  image: string
  badge?: string
  plans: StreamingPlan[]
  description: string
  botType?: string
}

export interface StreamingQueryPayload {
  email: string
  botCode: string
  type: string
  server: string
}

export interface StreamingExtractedResult {
  type: 'code' | 'link' | 'html'
  value: string
}

export interface StreamingQueryResult {
  success: boolean
  error?: string
  data?: {
    extracted: StreamingExtractedResult
    subject: string
    date: string
    platform: string
    server: string
    email: string
    raw?: unknown
  }
}

export const STREAMING_PLATFORMS: StreamingPlatform[] = [
  { value: 'disney', label: 'Disney+', image: '/images/helpers/disney.webp', category: 'Streaming' },
  { value: 'max', label: 'Max (HBO)', image: '/images/helpers/max.webp', category: 'Streaming' },
  { value: 'primevideo', label: 'Prime Video', image: '/images/helpers/primevideo.webp', category: 'Streaming' },
  { value: 'crunchyroll', label: 'Crunchyroll', image: '/images/helpers/crunchyroll.webp', category: 'Anime & Cine' },
  { value: 'paramount', label: 'Paramount+', image: '/images/helpers/paramount.webp', category: 'Streaming' },
  { value: 'universal', label: 'Universal+', image: '/images/helpers/universal.webp', category: 'Streaming' },
  { value: 'spotify', label: 'Spotify', image: '/images/helpers/spotify.webp', category: 'Música' },
  { value: 'chatgpt', label: 'ChatGPT Plus', image: '/images/helpers/chatgpt.webp', category: 'IA & Herramientas' },
  { value: 'gemini', label: 'Gemini Pro', image: '/images/helpers/gemini.webp', category: 'IA & Herramientas' },
  { value: 'appletv', label: 'Apple TV+', image: '/images/helpers/appletv.webp', category: 'Streaming' },
  { value: 'vikirakuten', label: 'Viki Rakuten', image: '/images/helpers/vikirakuten.webp', category: 'Anime & Cine' },
  { value: 'vix', label: 'ViX Premium', image: '/images/helpers/vix.webp', category: 'Streaming' },
]

export const STREAMING_SERVERS: StreamingServer[] = [
  { value: 'server1', label: 'Server 1 (Principal)', image: '/images/helpers/server.webp' },
  { value: 'server2', label: 'Server 2 (Alternativo)', image: '/images/helpers/server.webp' },
]

export const DEFAULT_STREAMING_PRODUCTS: StreamingProduct[] = [
  {
    id: 'disney',
    name: 'Disney+ Premium',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/disney.webp',
    badge: '1 Perfil · ESPN Deportes',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Todo el contenido de Disney, Pixar, Marvel, Star Wars, National Geographic y todos los eventos deportivos en vivo de ESPN.',
    botType: 'disney',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/max.webp',
    badge: '1 Perfil · HBO + Warner',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Disfruta de las series aclamadas de HBO, estrenos de Warner Bros., contenido de Discovery y universo DC en máxima calidad.',
    botType: 'max',
  },
  {
    id: 'primevideo',
    name: 'Prime Video',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/primevideo.webp',
    badge: '1 Perfil · Originals 4K',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Series Amazon Originals exclusivas, películas de estreno y compatibilidad multidispositivo con descargas offline.',
    botType: 'primevideo',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll Mega Fan',
    type: 'Anime & Cine',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/crunchyroll.webp',
    badge: '1 Perfil · Simulcast Japón',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'El mayor catálogo de anime del mundo. Simulcast con Japón 1 hora después del estreno, audio en español y descargas offline.',
    botType: 'crunchyroll',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/paramount.webp',
    badge: '1 Perfil · Cine & Deportes',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Cine de Hollywood, producciones exclusivas y partidos en vivo de la Premier League inglesa.',
    botType: 'paramount',
  },
  {
    id: 'universal',
    name: 'Universal+',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/universal.webp',
    badge: '1 Perfil · Canales Exclusivos',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Canales premium de Universal, series exclusivas, comedias, dramas y cine internacional sin cortes.',
    botType: 'universal',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    type: 'IA & Herramientas',
    price: '600 Gemas o S/ 20.00',
    originalPrice: '900 Gemas',
    gemCost: 600,
    image: '/images/helpers/chatgpt.webp',
    badge: 'Cuenta Compartida · GPT-4o',
    plans: [
      { name: '1 Dispositivo (Cuenta Compartida)', price: '600 Gemas o S/ 20.00', gemCost: 600 },
    ],
    description: 'Cuenta compartida con acceso a ChatGPT Plus, modelos GPT-4o, generación con DALL-E, análisis de datos y proyectos.',
    botType: 'chatgpt',
  },
  {
    id: 'gemini',
    name: 'Gemini Pro (Google AI)',
    type: 'IA & Herramientas',
    price: '1500 Gemas o S/ 50.00',
    originalPrice: '2000 Gemas',
    gemCost: 1500,
    image: '/images/helpers/gemini.webp',
    badge: '6 Meses · 2TB + IA',
    plans: [
      { name: '6 Meses Personal (1 Dispositivo)', price: '1500 Gemas o S/ 50.00 (6 Meses)', gemCost: 1500 },
    ],
    description: 'Convierte tu correo en pro, más espacio, IA y todo el catálogo de Google.',
    botType: 'gemini',
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/appletv.webp',
    badge: '1 Perfil · 4K Dolby Vision',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Apple Originals aclamados por la crítica, series dramáticas ganadoras de premios Emmy y producciones cinematográficas exclusivas.',
    botType: 'appletv',
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    type: 'Música',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/spotify.webp',
    badge: '1 Perfil · Música Sin Anuncios',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Millones de canciones y podcasts sin interrupciones, audio de alta calidad y descargas directas para escuchar sin conexión.',
    botType: 'spotify',
  },
  {
    id: 'vikirakuten',
    name: 'Viki Rakuten Pass',
    type: 'Anime & Cine',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/vikirakuten.webp',
    badge: '1 Perfil · Doramas en HD',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'Los mejores doramas coreanos, dramas chinos, taiwaneses y anime asiático con subtítulos profesionales en español.',
    botType: 'vikirakuten',
  },
  {
    id: 'vix',
    name: 'ViX Premium',
    type: 'Streaming',
    price: '300 Gemas o S/ 10.00',
    originalPrice: '450 Gemas',
    gemCost: 300,
    image: '/images/helpers/vix.webp',
    badge: '1 Perfil · Telenovelas & Fútbol',
    plans: [
      { name: '1 Perfil (1 Dispositivo)', price: '300 Gemas o S/ 10.00', gemCost: 300 },
    ],
    description: 'El mayor servicio de streaming en español: deportes en vivo, Liga MX, telenovelas clásicas y estrenos exclusivos.',
    botType: 'vix',
  },
]
