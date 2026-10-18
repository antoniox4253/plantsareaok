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
}

export interface StreamingProduct {
  id: string
  name: string
  type: 'Streaming' | 'IA & Herramientas' | 'Anime & Cine' | 'Música'
  price: string
  originalPrice?: string
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
  { value: 'netflix', label: 'Netflix', image: '/images/helpers/netflix.webp', category: 'Streaming' },
  { value: 'disney', label: 'Disney+', image: '/images/helpers/disney.webp', category: 'Streaming' },
  { value: 'primevideo', label: 'Prime Video', image: '/images/helpers/primevideo.webp', category: 'Streaming' },
  { value: 'max', label: 'Max (HBO)', image: '/images/helpers/max.webp', category: 'Streaming' },
  { value: 'paramount', label: 'Paramount+', image: '/images/helpers/paramount.webp', category: 'Streaming' },
  { value: 'universal', label: 'Universal+', image: '/images/helpers/universal.webp', category: 'Streaming' },
  { value: 'spotify', label: 'Spotify', image: '/images/helpers/spotify.webp', category: 'Música' },
  { value: 'chatgpt', label: 'ChatGPT Plus', image: '/images/helpers/chatgpt.webp', category: 'IA & Herramientas' },
  { value: 'crunchyroll', label: 'Crunchyroll', image: '/images/helpers/crunchyroll.webp', category: 'Anime & Cine' },
  { value: 'vikirakuten', label: 'Viki Rakuten', image: '/images/helpers/vikirakuten.webp', category: 'Anime & Cine' },
  { value: 'appletv', label: 'Apple TV+', image: '/images/helpers/appletv.webp', category: 'Streaming' },
  { value: 'freepik', label: 'Freepik', image: '/images/helpers/freepik.webp', category: 'IA & Herramientas' },
  { value: 'perplexity', label: 'Perplexity Pro', image: '/images/helpers/perplexity.webp', category: 'IA & Herramientas' },
  { value: 'vix', label: 'ViX Premium', image: '/images/helpers/vix.webp', category: 'Streaming' },
]

export const STREAMING_SERVERS: StreamingServer[] = [
  { value: 'server1', label: 'Server 1 (Principal)', image: '/images/helpers/server.webp' },
  { value: 'server2', label: 'Server 2 (Alternativo)', image: '/images/helpers/server.webp' },
]

export const DEFAULT_STREAMING_PRODUCTS: StreamingProduct[] = [
  {
    id: 'netflix',
    name: 'Netflix Premium 4K Ultra HD',
    type: 'Streaming',
    price: 'S/ 12.00',
    originalPrice: 'S/ 16.00',
    image: '/images/helpers/netflix.webp',
    badge: '4K Ultra HD · PIN Privado',
    plans: [
      { name: '1 Perfil Privado con PIN (1 Pantalla)', price: 'S/ 12.00 / mes' },
      { name: 'Cuenta Completa Hogar (4 Pantallas)', price: 'S/ 42.00 / mes' },
      { name: '3 Meses 1 Perfil Privado Promocional', price: 'S/ 32.00' },
    ],
    description: 'Películas, series, documentales y anime sin límites ni anuncios. Compatible con TV, consolas, móviles y PC con soporte para códigos Hogar.',
    botType: 'netflix',
  },
  {
    id: 'disney',
    name: 'Disney+ Premium',
    type: 'Streaming',
    price: 'S/ 10.00',
    originalPrice: 'S/ 14.00',
    image: '/images/helpers/disney.webp',
    badge: 'ESPN Deportes en Vivo',
    plans: [
      { name: '1 Perfil Privado con PIN', price: 'S/ 10.00 / mes' },
      { name: 'Cuenta Completa Familiar', price: 'S/ 28.00 / mes' },
      { name: 'Plan Anual 1 Perfil', price: 'S/ 95.00 / año' },
    ],
    description: 'Todo el contenido de Disney, Pixar, Marvel, Star Wars, National Geographic y todos los eventos deportivos en vivo de ESPN.',
    botType: 'disney',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    type: 'Streaming',
    price: 'S/ 8.00',
    originalPrice: 'S/ 12.00',
    image: '/images/helpers/max.webp',
    badge: 'HBO + Warner + DC',
    plans: [
      { name: '1 Pantalla Privada', price: 'S/ 8.00 / mes' },
      { name: 'Cuenta Completa Platino', price: 'S/ 24.00 / mes' },
    ],
    description: 'Disfruta de las series aclamadas de HBO, estrenos de Warner Bros., contenido de Discovery y universo DC en máxima calidad.',
    botType: 'max',
  },
  {
    id: 'primevideo',
    name: 'Prime Video',
    type: 'Streaming',
    price: 'S/ 8.00',
    originalPrice: 'S/ 11.00',
    image: '/images/helpers/primevideo.webp',
    badge: 'Originals 4K',
    plans: [
      { name: '1 Pantalla Privada con PIN', price: 'S/ 8.00 / mes' },
      { name: 'Cuenta Completa (3 Pantallas)', price: 'S/ 18.00 / mes' },
    ],
    description: 'Series Amazon Originals exclusivas, películas de estreno y compatibilidad multidispositivo con descargas offline.',
    botType: 'primevideo',
  },
  {
    id: 'crunchyroll',
    name: 'Crunchyroll Mega Fan',
    type: 'Anime & Cine',
    price: 'S/ 8.00',
    originalPrice: 'S/ 10.00',
    image: '/images/helpers/crunchyroll.webp',
    badge: 'Simulcast & Sin Anuncios',
    plans: [
      { name: '1 Perfil Mega Fan', price: 'S/ 8.00 / mes' },
      { name: 'Cuenta Mega Fan Completa', price: 'S/ 18.00 / mes' },
      { name: 'Mega Fan Anual', price: 'S/ 75.00 / año' },
    ],
    description: 'El mayor catálogo de anime del mundo. Simulcast con Japón 1 hora después del estreno, audio en español y descargas offline.',
    botType: 'crunchyroll',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    type: 'Streaming',
    price: 'S/ 7.00',
    originalPrice: 'S/ 9.00',
    image: '/images/helpers/paramount.webp',
    badge: 'Cine & Deportes',
    plans: [
      { name: '1 Perfil Privado', price: 'S/ 7.00 / mes' },
      { name: 'Cuenta Completa', price: 'S/ 16.00 / mes' },
    ],
    description: 'Cine de Hollywood, producciones exclusivas y partidos en vivo de la Premier League inglesa.',
    botType: 'paramount',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    type: 'IA & Herramientas',
    price: 'S/ 25.00',
    originalPrice: 'S/ 35.00',
    image: '/images/helpers/chatgpt.webp',
    badge: 'GPT-4o & DALL-E',
    plans: [
      { name: '1 Mes Compartido VIP', price: 'S/ 25.00' },
      { name: '1 Mes Privado Personal', price: 'S/ 75.00' },
    ],
    description: 'Acceso a los modelos más avanzados de inteligencia artificial, análisis de datos avanzado, navegación web y generación de imágenes.',
    botType: 'chatgpt',
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    type: 'Streaming',
    price: 'S/ 8.00',
    originalPrice: 'S/ 12.00',
    image: '/images/helpers/appletv.webp',
    badge: '4K Dolby Vision',
    plans: [
      { name: '1 Mes Cuenta Privada', price: 'S/ 8.00' },
      { name: '3 Meses Promocional', price: 'S/ 20.00' },
    ],
    description: 'Apple Originals aclamados por la crítica, series dramáticas ganadoras de premios Emmy y producciones cinematográficas exclusivas.',
    botType: 'appletv',
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    type: 'Música',
    price: 'S/ 9.00',
    originalPrice: 'S/ 13.00',
    image: '/images/helpers/spotify.webp',
    badge: 'Música Sin Anuncios',
    plans: [
      { name: '1 Mes Cuenta Individual', price: 'S/ 9.00' },
      { name: '3 Meses Renovación Segura', price: 'S/ 24.00' },
    ],
    description: 'Millones de canciones y podcasts sin interrupciones, audio de alta calidad y descargas directas para escuchar sin conexión.',
    botType: 'spotify',
  },
  {
    id: 'vikirakuten',
    name: 'Viki Rakuten Pass',
    type: 'Anime & Cine',
    price: 'S/ 9.00',
    originalPrice: 'S/ 12.00',
    image: '/images/helpers/vikirakuten.webp',
    badge: 'Doramas en HD',
    plans: [
      { name: '1 Mes Viki Pass Standard', price: 'S/ 9.00' },
    ],
    description: 'Los mejores doramas coreanos, dramas chinos, taiwaneses y anime asiático con subtítulos profesionales en español.',
    botType: 'vikirakuten',
  },
  {
    id: 'vix',
    name: 'ViX Premium',
    type: 'Streaming',
    price: 'S/ 8.00',
    originalPrice: 'S/ 11.00',
    image: '/images/helpers/vix.webp',
    badge: 'Telenovelas & Fútbol',
    plans: [
      { name: '1 Mes ViX Premium', price: 'S/ 8.00' },
      { name: 'Cuenta Completa 3 Meses', price: 'S/ 22.00' },
    ],
    description: 'El mayor servicio de streaming en español: deportes en vivo, Liga MX, telenovelas clásicas y estrenos exclusivos.',
    botType: 'vix',
  },
  {
    id: 'perplexity',
    name: 'Perplexity Pro',
    type: 'IA & Herramientas',
    price: 'S/ 20.00',
    originalPrice: 'S/ 30.00',
    image: '/images/helpers/perplexity.webp',
    badge: 'Claude 3.5 & GPT-4o',
    plans: [
      { name: '1 Mes Perplexity Pro', price: 'S/ 20.00' },
    ],
    description: 'Motor de búsqueda conversacional con IA con acceso ilimitado a Claude 3.5 Sonnet, GPT-4o y subida de archivos.',
    botType: 'perplexity',
  },
  {
    id: 'freepik',
    name: 'Freepik Premium',
    type: 'IA & Herramientas',
    price: 'S/ 18.00',
    originalPrice: 'S/ 26.00',
    image: '/images/helpers/freepik.webp',
    badge: 'Vectores & Fotos PSD',
    plans: [
      { name: '1 Mes Freepik Premium', price: 'S/ 18.00' },
    ],
    description: 'Descargas ilimitadas de vectores, fotos de stock, archivos PSD, plantillas e inteligencia artificial para diseño gráfico.',
    botType: 'freepik',
  },
]
