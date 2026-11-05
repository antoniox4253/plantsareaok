import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Arena Ads Retirarse Confirmation Guard', () => {
  it('1. ArenaAdsModal.tsx incluye estado showCashoutConfirm y modal de confirmación', () => {
    const modalPath = path.resolve(__dirname, 'ArenaAdsModal.tsx')
    const modalCode = fs.readFileSync(modalPath, 'utf8')

    // Verificar estado showCashoutConfirm
    expect(modalCode).toContain('const [showCashoutConfirm, setShowCashoutConfirm] = useState<boolean>(false)')

    // Verificar que los botones de Retirarse activan la confirmación y no ejecutan retiro directo
    expect(modalCode).toContain('setShowCashoutConfirm(true)')
    expect(modalCode).not.toMatch(/className="[^"]*arena-ads-btn--cashout[^"]*"\s+onClick=\{handleCashout\}/)

    // Verificar textos del modal de confirmación
    expect(modalCode).toContain('¿SEGURO QUE DESEAS RETIRARTE?')
    expect(modalCode).toContain('SEGUIR JUGANDO')
    expect(modalCode).toContain('SÍ, RETIRARME')
    expect(modalCode).toContain('No podrás continuar esta expedición')
  })

  it('2. ArenaAdsModal.css define estilos para la confirmación de retiro', () => {
    const cssPath = path.resolve(__dirname, 'ArenaAdsModal.css')
    const cssCode = fs.readFileSync(cssPath, 'utf8')

    expect(cssCode).toContain('.arena-ads-confirm-overlay')
    expect(cssCode).toContain('.arena-ads-confirm-dialog')
    expect(cssCode).toContain('.arena-ads-confirm-warning')
    expect(cssCode).toContain('.arena-ads-confirm-actions')
  })

  it('3. Battlefield.tsx incluye confirmación de retiro en victoria de Arena Ads', () => {
    const bfPath = path.resolve(__dirname, '../Battlefield/Battlefield.tsx')
    const bfCode = fs.readFileSync(bfPath, 'utf8')

    expect(bfCode).toContain('const [showArenaAdsRetreatConfirm, setShowArenaAdsRetreatConfirm] = useState<boolean>(false)')
    expect(bfCode).toContain('setShowArenaAdsRetreatConfirm(true)')
    expect(bfCode).toContain('¿RETIRARTE Y COBRAR BOTÍN?')
    expect(bfCode).toContain('SEGUIR LUCHANDO')
    expect(bfCode).toContain('SÍ, RETIRARME')
  })
})
