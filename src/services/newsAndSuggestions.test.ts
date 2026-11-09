import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  newsAndSuggestionsService,
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUS_CONFIG,
} from './newsAndSuggestionsService'

let memoryStore: Record<string, string> = {}
const mockLocalStorage = {
  getItem: (key: string) => memoryStore[key] || null,
  setItem: (key: string, val: string) => {
    memoryStore[key] = String(val)
  },
  removeItem: (key: string) => {
    delete memoryStore[key]
  },
  clear: () => {
    memoryStore = {}
  },
}

vi.stubGlobal('localStorage', mockLocalStorage)
vi.stubGlobal('window', { localStorage: mockLocalStorage })

vi.mock('../lib/supabaseClient', () => {
  return {
    isSupabaseConfigured: () => false,
    supabase: null,
  }
})

describe('newsAndSuggestionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('obtiene las publicaciones predeterminadas del blog de actualizaciones', async () => {
    const posts = await newsAndSuggestionsService.getNewsPosts()
    expect(posts.length).toBeGreaterThanOrEqual(3)
    const update = posts.find((p) => p.version === 'v1.5.0')
    expect(update).toBeDefined()
    expect(update?.title).toContain('Sistema de Clanes')
  })

  it('filtra las noticias por categoría correctamente', async () => {
    const balancePosts = await newsAndSuggestionsService.getNewsPosts('balance')
    expect(balancePosts.every((p) => p.category === 'balance')).toBe(true)

    const allPosts = await newsAndSuggestionsService.getNewsPosts('todas')
    expect(allPosts.length).toBeGreaterThan(balancePosts.length)
  })

  it('valida longitud mínima al enviar sugerencias', async () => {
    const shortTitle = await newsAndSuggestionsService.submitSuggestion({
      title: 'Hi',
      category: 'plantas',
      content: 'Contenido suficientemente largo para la prueba',
    })
    expect(shortTitle.success).toBe(false)
    expect(shortTitle.error).toContain('al menos 3 caracteres')

    const shortContent = await newsAndSuggestionsService.submitSuggestion({
      title: 'Título válido',
      category: 'plantas',
      content: 'Corto',
    })
    expect(shortContent.success).toBe(false)
    expect(shortContent.error).toContain('al menos 10 caracteres')
  })

  it('permite enviar una sugerencia en modo local con nick del jugador', async () => {
    const res = await newsAndSuggestionsService.submitSuggestion({
      title: 'Planta Helada Nueva: Hielaguisantes Primordial',
      category: 'plantas',
      content: 'Propongo agregar una planta de hielo que ralentice a los zombis en un área de 3x3.',
      playerNick: 'GladiadorGélido',
    })

    expect(res.success).toBe(true)
    expect(res.suggestion).toBeDefined()
    expect(res.suggestion?.player_nick).toBe('GladiadorGélido')
    expect(res.suggestion?.status).toBe('recibida')
    expect(res.suggestion?.likes_count).toBe(0)

    // Verificar persistencia al listar sugerencias
    const suggestions = await newsAndSuggestionsService.getSuggestions()
    const found = suggestions.find((s) => s.player_nick === 'GladiadorGélido')
    expect(found).toBeDefined()
    expect(found?.title).toBe('Planta Helada Nueva: Hielaguisantes Primordial')
  })

  it('cuenta con categorías y estados oficiales definidos', () => {
    expect(SUGGESTION_CATEGORIES.length).toBeGreaterThanOrEqual(5)
    expect(SUGGESTION_STATUS_CONFIG.recibida.label).toBe('Recibida')
    expect(SUGGESTION_STATUS_CONFIG.implementada.label).toBe('¡Implementada!')
  })

  it('cuenta con los 7 bloques cronológicos segmentados de la última semana y la nota de AQP Game Fest', async () => {
    const { WEEKLY_UPDATES_BLOCKS } = await import('./newsAndSuggestionsService')
    expect(WEEKLY_UPDATES_BLOCKS.length).toBe(7)
    expect(WEEKLY_UPDATES_BLOCKS[0].dayNumber).toBe(1)
    expect(WEEKLY_UPDATES_BLOCKS[0].title).toContain('AQP Game Fest')

    const posts = await newsAndSuggestionsService.getNewsPosts()
    const aqp = posts.find((p) => p.title.includes('AQP Game Fest'))
    expect(aqp).toBeDefined()
    expect(aqp?.content).toContain('aqpgamesfest.com/juegos.html')
  })
})
