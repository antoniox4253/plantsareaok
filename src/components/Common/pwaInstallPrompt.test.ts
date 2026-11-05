import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('PWA Implementation & Mobile Install Guide', () => {
  const rootDir = process.cwd()

  it('verifies public/manifest.webmanifest exists and has valid configuration', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.webmanifest')
    expect(fs.existsSync(manifestPath)).toBe(true)

    const raw = fs.readFileSync(manifestPath, 'utf8')
    const manifest = JSON.parse(raw)

    expect(manifest.name).toBe('Plant Arena - Batallas y Estrategia')
    expect(manifest.short_name).toBe('Plant Arena')
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('landscape')
    expect(manifest.icons).toBeInstanceOf(Array)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)

    // Verify icons on disk
    for (const icon of manifest.icons) {
      const iconPath = path.join(rootDir, 'public', icon.src.replace(/^\//, ''))
      expect(fs.existsSync(iconPath)).toBe(true)
    }
  })

  it('verifies public/sw.js exists and safely routes network traffic', () => {
    const swPath = path.join(rootDir, 'public', 'sw.js')
    expect(fs.existsSync(swPath)).toBe(true)

    const swContent = fs.readFileSync(swPath, 'utf8')
    // Must bypass Supabase and external ad networks
    expect(swContent).toContain('supabase.co')
    expect(swContent).toContain('monetag')
    expect(swContent).toContain('self.skipWaiting')
  })

  it('verifies index.html links the manifest and apple-touch-icon', () => {
    const htmlPath = path.join(rootDir, 'index.html')
    const htmlContent = fs.readFileSync(htmlPath, 'utf8')

    expect(htmlContent).toContain('rel="manifest"')
    expect(htmlContent).toContain('/manifest.webmanifest')
    expect(htmlContent).toContain('rel="apple-touch-icon"')
    expect(htmlContent).toContain('/icons/apple-touch-icon.png')
  })

  it('verifies main.tsx registers the service worker', () => {
    const mainPath = path.join(rootDir, 'src', 'main.tsx')
    const mainContent = fs.readFileSync(mainPath, 'utf8')

    expect(mainContent).toContain('serviceWorker')
    expect(mainContent).toContain('/sw.js')
  })

  it('verifies App.tsx includes the PwaInstallPrompt component', () => {
    const appPath = path.join(rootDir, 'src', 'App.tsx')
    const appContent = fs.readFileSync(appPath, 'utf8')

    expect(appContent).toContain('PwaInstallPrompt')
    expect(appContent).toContain('<PwaInstallPrompt')
  })

  it('verifies MainMenu.tsx includes option to open PWA install guide', () => {
    const mmPath = path.join(rootDir, 'src', 'components', 'MainMenu', 'MainMenu.tsx')
    const mmContent = fs.readFileSync(mmPath, 'utf8')

    expect(mmContent).toContain('open_pwa_install_guide')
    expect(mmContent).toContain('Instalar App en Celular')
  })

  it('verifies PwaInstallPrompt component handles iOS, Android, and standalone detection', () => {
    const promptPath = path.join(rootDir, 'src', 'components', 'Common', 'PwaInstallPrompt.tsx')
    const promptContent = fs.readFileSync(promptPath, 'utf8')

    expect(promptContent).toContain('beforeinstallprompt')
    expect(promptContent).toContain('display-mode: standalone')
    expect(promptContent).toContain('open_pwa_install_guide')
    expect(promptContent).toContain('Compartir')
    expect(promptContent).toContain('Añadir a la pantalla de inicio')
    expect(promptContent).toContain('Instalar aplicación')
  })
})
