import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractResult } from '../../api/consultar.js'
import {
  STREAMING_PLATFORMS,
  STREAMING_SERVERS,
  DEFAULT_STREAMING_PRODUCTS,
} from '../types/streaming'
import { streamingService } from './streamingService'
import { getScreenFromPath, SCREEN_ROUTES } from '../utils/analytics'

describe('Streaming Integration & Code Verifier Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. Extracción de Códigos y Enlaces por Plataforma', () => {
    it('extrae código numérico de 6 dígitos de Netflix', () => {
      const netflixHtml = `
        <html><body>
          <table><tr><td style="font-size: 28px; letter-spacing: 2px;">849201</td></tr></table>
        </body></html>
      `
      const res = extractResult(netflixHtml, 'netflix')
      expect(res.type).toBe('code')
      expect(res.value).toBe('849201')
    })

    it('extrae código de Disney+', () => {
      const disneyHtml = `
        <div>
          <p style="font-size: 32px">Tu código de inicio de sesión es 592813</p>
        </div>
      `
      const res = extractResult(disneyHtml, 'disney')
      expect(res.type).toBe('code')
      expect(res.value).toBe('592813')
    })

    it('extrae código de Amazon Prime Video', () => {
      const primeHtml = `
        <div>
          <p>código de verificación es: 194820</p>
        </div>
      `
      const res = extractResult(primeHtml, 'primevideo')
      expect(res.type).toBe('code')
      expect(res.value).toBe('194820')
    })

    it('extrae código alfanumérico para Universal+', () => {
      const universalHtml = `
        <div><span>UNIV92</span></div>
      `
      const res = extractResult(universalHtml, 'universal')
      expect(res.type).toBe('code')
      expect(res.value).toBe('UNIV92')
    })

    it('extrae enlace de verificación para Crunchyroll', () => {
      const crunchyHtml = `
        <div>
          Restablecer contraseña:
          <a href="https://links.mail.crunchyroll.com/ls/click?upn=abc123token456">Restablecer</a>
        </div>
      `
      const res = extractResult(crunchyHtml, 'crunchyroll')
      expect(res.type).toBe('link')
      expect(res.value).toContain('crunchyroll.com')
    })

    it('extrae enlace para Max (HBO)', () => {
      const maxHtml = `
        <div>
          <a href="https://auth.max.com/reset-password?token=secretXYZ">Cambiar contraseña</a>
        </div>
      `
      const res = extractResult(maxHtml, 'max')
      expect(res.type).toBe('link')
      expect(res.value).toContain('reset-password')
    })

    it('aplica fallback a código de 6 dígitos genérico', () => {
      const genericHtml = `
        <p>Tu código de seguridad temporal es 736194.</p>
      `
      const res = extractResult(genericHtml, 'spotify')
      expect(res.type).toBe('code')
      expect(res.value).toBe('736194')
    })
  })

  describe('2. Catálogo y Parámetros del Sistema', () => {
    it('contiene las plataformas oficiales con imágenes locales', () => {
      expect(STREAMING_PLATFORMS.length).toBeGreaterThanOrEqual(10)
      const disney = STREAMING_PLATFORMS.find((p) => p.value === 'disney')
      expect(disney).toBeDefined()
      expect(disney?.image).toContain('/images/helpers/disney.webp')
      const gemini = STREAMING_PLATFORMS.find((p) => p.value === 'gemini')
      expect(gemini).toBeDefined()
      expect(gemini?.image).toContain('/images/helpers/gemini.webp')
    })

    it('contiene Servidor 1 y Servidor 2 configurados', () => {
      expect(STREAMING_SERVERS.length).toBe(2)
      expect(STREAMING_SERVERS[0].value).toBe('server1')
      expect(STREAMING_SERVERS[1].value).toBe('server2')
    })

    it('el catálogo de productos incluye precios, planes y descripciones', () => {
      expect(DEFAULT_STREAMING_PRODUCTS.length).toBeGreaterThanOrEqual(10)
      for (const prod of DEFAULT_STREAMING_PRODUCTS) {
        expect(prod.id).toBeDefined()
        expect(prod.name).toBeDefined()
        expect(prod.price).toMatch(/\d+\s*Gemas/)
        expect(prod.plans.length).toBeGreaterThanOrEqual(1)
        expect(prod.description.length).toBeGreaterThan(10)
      }
    })
  })

  describe('3. Enrutamiento y Navegación SPA', () => {
    it('reconoce la ruta /streaming y /code para abrir la pantalla', () => {
      expect(getScreenFromPath('/streaming', '')).toBe('streaming')
      expect(getScreenFromPath('/code', '')).toBe('streaming')
      expect(getScreenFromPath('/play/streaming', '')).toBe('streaming')
      expect(getScreenFromPath('/play/stream', '')).toBe('streaming')
      expect(getScreenFromPath('/stream', '')).toBe('streaming')
    })

    it('SCREEN_ROUTES contiene metadatos de la pantalla streaming', () => {
      expect(SCREEN_ROUTES.streaming).toBeDefined()
      expect(SCREEN_ROUTES.streaming.path).toBe('/play/streaming')
      expect(SCREEN_ROUTES.streaming.title).toContain('Streaming VIP')
    })
  })

  describe('4. Servicio streamingService', () => {
    it('maneja respuesta exitosa del backend', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: true,
          data: {
            extracted: { type: 'code', value: '492019' },
            subject: 'Código de Netflix',
            date: new Date().toISOString(),
            platform: 'netflix',
            server: 'server1',
            email: 'tester@test.com',
          },
        }),
      } as any)

      const res = await streamingService.consultarCodigo({
        email: 'tester@test.com',
        botCode: 'COD-12345',
        type: 'netflix',
        server: 'server1',
      })

      expect(res.success).toBe(true)
      expect(res.data?.extracted.value).toBe('492019')
    })

    it('maneja respuesta de error cuando el código no existe', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          success: false,
          error: 'El código BOT ingresado no existe.',
        }),
      } as any)

      const res = await streamingService.consultarCodigo({
        email: 'tester@test.com',
        botCode: 'COD-INVALIDO',
        type: 'netflix',
        server: 'server1',
      })

      expect(res.success).toBe(false)
      expect(res.error).toBe('El código BOT ingresado no existe.')
    })
  })
})
