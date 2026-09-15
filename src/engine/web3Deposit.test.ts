import { describe, it, expect } from 'vitest'
import {
  usdtToWei,
  weiToUsdt,
  encodeErc20TransferData,
  ERC20_TRANSFER_SELECTOR,
  OFFICIAL_USDT_BEP20_CONTRACT,
  DEFAULT_TREASURY_WALLET,
  BSC_CHAIN_ID_HEX,
  BSC_CHAIN_ID_DEC,
} from '../services/web3DepositService'

describe('Web3DepositService - Codificación y Precisión BEP20', () => {
  it('Configuración oficial de BNB Smart Chain y contrato USDT', () => {
    expect(BSC_CHAIN_ID_HEX).toBe('0x38')
    expect(BSC_CHAIN_ID_DEC).toBe(56)
    expect(OFFICIAL_USDT_BEP20_CONTRACT.toLowerCase()).toBe(
      '0x55d398326f99059ff775485246999027b3197955'
    )
    expect(DEFAULT_TREASURY_WALLET.toLowerCase()).toBe(
      '0x721622d8cad39621c731ec286d1ea859365a51b8'
    )
  })

  it('Convierte 1.00 USDT a 10^18 wei con precisión exacta', () => {
    const wei = usdtToWei(1.0)
    expect(wei).toBe(1000000000000000000n)
    expect(weiToUsdt(wei)).toBe(1.0)
  })

  it('Convierte 0.5 USDT a 5 * 10^17 wei', () => {
    const wei = usdtToWei(0.5)
    expect(wei).toBe(500000000000000000n)
    expect(weiToUsdt(wei)).toBe(0.5)
  })

  it('Convierte montos con decimales complejos sin error de coma flotante', () => {
    const wei = usdtToWei('23.456789')
    expect(wei).toBe(23456789000000000000n)
    expect(weiToUsdt(wei)).toBe(23.456789)
  })

  it('Rechaza montos inválidos o negativos', () => {
    expect(() => usdtToWei(-5)).toThrow('Monto inválido para depósito')
    expect(() => usdtToWei('0')).toThrow('Monto inválido para depósito')
    expect(() => usdtToWei('abc')).toThrow('Monto inválido para depósito')
  })

  it('Codifica transfer(address,uint256) con selector y padding correcto a 32 bytes', () => {
    const treasury = '0x721622D8cad39621C731eC286D1EA859365A51b8'
    const amountWei = usdtToWei(10.0) // 10 USDT
    const callData = encodeErc20TransferData(treasury, amountWei)

    // Selector: 0xa9059cbb (10 caracteres con 0x)
    expect(callData.startsWith(ERC20_TRANSFER_SELECTOR)).toBe(true)

    // Longitud total: 10 (selector) + 64 (address) + 64 (uint256) = 138 caracteres
    expect(callData.length).toBe(138)

    // El parámetro de dirección debe contener la tesorería en minúsculas padded
    const addressParam = callData.slice(10, 74)
    expect(addressParam).toBe('000000000000000000000000721622d8cad39621c731ec286d1ea859365a51b8')

    // El parámetro de monto debe corresponder al valor hexadecimal de 10 * 10^18
    const amountParam = callData.slice(74, 138)
    const expectedHex = amountWei.toString(16).padStart(64, '0')
    expect(amountParam).toBe(expectedHex)
  })
})
