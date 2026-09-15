/**
 * Servicio Web3 para Depósitos Nativos con MetaMask (BEP20 / BNB Smart Chain)
 * 
 * Permite a los usuarios conectar su wallet y transferir USDT directamente a la
 * tesorería oficial del juego con 1 solo clic, obteniendo el TxHash de forma inmediata
 * para verificación instantánea y acreditación sin fallos.
 */

export const BSC_CHAIN_ID_HEX = '0x38' // 56 en decimal
export const BSC_CHAIN_ID_DEC = 56

export const OFFICIAL_USDT_BEP20_CONTRACT = '0x55d398326f99059ff775485246999027b3197955'
export const DEFAULT_TREASURY_WALLET = '0x721622D8cad39621C731eC286D1EA859365A51b8'

// Selector ERC20/BEP20 transfer(address,uint256): keccak256("transfer(address,uint256)")[0..4]
export const ERC20_TRANSFER_SELECTOR = '0xa9059cbb'
// Selector ERC20/BEP20 balanceOf(address): keccak256("balanceOf(address)")[0..4]
export const ERC20_BALANCE_OF_SELECTOR = '0x70a08231'

export interface Web3DepositResult {
  success: boolean
  txHash?: string
  senderAddress?: string
  amountUsdt?: number
  error?: string
  userCancelled?: boolean
}

/**
 * Convierte un número o string decimal de USDT a unidades mínimas BigInt (18 decimales en BEP20)
 * sin perder precisión por números flotantes.
 */
export function usdtToWei(amountUsdt: number | string, decimals = 18): bigint {
  const str = String(amountUsdt).trim()
  if (!str || isNaN(Number(str)) || Number(str) <= 0) {
    throw new Error('Monto inválido para depósito')
  }

  const parts = str.split('.')
  const integerPart = parts[0] || '0'
  let fractionalPart = parts[1] || ''

  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.slice(0, decimals)
  } else {
    fractionalPart = fractionalPart.padEnd(decimals, '0')
  }

  const combined = integerPart + fractionalPart
  return BigInt(combined.replace(/^0+(?=\d)/, '') || '0')
}

/**
 * Convierte unidades mínimas (BigInt) a número decimal de USDT
 */
export function weiToUsdt(weiValue: bigint, decimals = 18): number {
  const divisor = BigInt(10 ** decimals)
  const integer = weiValue / divisor
  const remainder = weiValue % divisor
  const remainderStr = remainder.toString().padStart(decimals, '0')
  return parseFloat(`${integer}.${remainderStr}`)
}

/**
 * Codifica los parámetros para la llamada transfer(address to, uint256 value)
 */
export function encodeErc20TransferData(recipientAddress: string, amountWei: bigint): string {
  const cleanAddr = recipientAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  const cleanAmount = amountWei.toString(16).padStart(64, '0')
  return `${ERC20_TRANSFER_SELECTOR}${cleanAddr}${cleanAmount}`
}

export class Web3DepositService {
  /**
   * Determina si MetaMask o un proveedor compatible EIP-1193 está inyectado en el navegador
   */
  static isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean((window as any).ethereum)
  }

  /**
   * Obtiene el proveedor Ethereum del navegador
   */
  private static getEthereum(): any {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('MetaMask no está instalado o no se detectó ningún proveedor Web3.')
    }
    return (window as any).ethereum
  }

  /**
   * Solicita conexión a MetaMask y devuelve la dirección activa normalizada
   */
  static async connectWallet(): Promise<string> {
    const ethereum = this.getEthereum()
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) {
      throw new Error('No se seleccionó ninguna cuenta en MetaMask.')
    }
    return accounts[0].toLowerCase()
  }

  /**
   * Obtiene la cuenta actualmente conectada sin abrir el prompt si ya fue autorizada
   */
  static async getActiveAccount(): Promise<string | null> {
    if (!this.isMetaMaskAvailable()) return null
    try {
      const ethereum = this.getEthereum()
      const accounts = await ethereum.request({ method: 'eth_accounts' })
      return accounts && accounts.length > 0 ? accounts[0].toLowerCase() : null
    } catch {
      return null
    }
  }

  /**
   * Asegura que MetaMask esté conectado a BNB Smart Chain Mainnet (Chain ID 56 / 0x38).
   * Si está en otra red, solicita el cambio o la adición de la red automáticamente.
   */
  static async ensureBscNetwork(): Promise<void> {
    const ethereum = this.getEthereum()
    const currentChainId = await ethereum.request({ method: 'eth_chainId' })

    if (currentChainId === BSC_CHAIN_ID_HEX || parseInt(currentChainId, 16) === BSC_CHAIN_ID_DEC) {
      return
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID_HEX }],
      })
    } catch (switchError: any) {
      // Código 4902: La red BNB Smart Chain aún no está agregada en MetaMask
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BSC_CHAIN_ID_HEX,
              chainName: 'BNB Smart Chain Mainnet',
              nativeCurrency: {
                name: 'BNB',
                symbol: 'BNB',
                decimals: 18,
              },
              rpcUrls: [
                'https://bsc-dataseed.binance.org/',
                'https://bsc-dataseed1.defibit.io/',
                'https://bsc-dataseed1.ninicoin.io/',
              ],
              blockExplorerUrls: ['https://bscscan.com/'],
            },
          ],
        })
      } else {
        throw switchError
      }
    }
  }

  /**
   * Consulta el balance de USDT BEP20 de una dirección en BNB Smart Chain
   */
  static async getUsdtBalance(
    userAddress: string,
    tokenContract = OFFICIAL_USDT_BEP20_CONTRACT
  ): Promise<number> {
    try {
      const ethereum = this.getEthereum()
      const cleanUser = userAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0')
      const data = `${ERC20_BALANCE_OF_SELECTOR}${cleanUser}`

      const hexBalance = await ethereum.request({
        method: 'eth_call',
        params: [
          {
            to: tokenContract,
            data,
          },
          'latest',
        ],
      })

      if (!hexBalance || hexBalance === '0x') return 0
      const wei = BigInt(hexBalance)
      return weiToUsdt(wei)
    } catch (e) {
      console.warn('[Web3DepositService] No se pudo leer balance USDT:', e)
      return 0
    }
  }

  /**
   * Ejecuta la transferencia de USDT BEP20 desde MetaMask hacia la tesorería oficial del juego.
   * Devuelve el txHash inmediatamente tras la firma del usuario.
   */
  static async depositUsdt(
    amountUsdt: number,
    treasuryAddress = DEFAULT_TREASURY_WALLET,
    tokenContract = OFFICIAL_USDT_BEP20_CONTRACT
  ): Promise<Web3DepositResult> {
    if (!this.isMetaMaskAvailable()) {
      return {
        success: false,
        error: 'MetaMask no está instalado. Instala la extensión o abre el juego desde MetaMask App.',
      }
    }

    if (amountUsdt <= 0) {
      return {
        success: false,
        error: 'El monto mínimo de depósito es 1 USDT.',
      }
    }

    try {
      // 1. Conectar wallet
      const senderAddress = await this.connectWallet()

      // 2. Asegurar que esté en BNB Smart Chain
      await this.ensureBscNetwork()

      // 3. Validar balance USDT
      const balance = await this.getUsdtBalance(senderAddress, tokenContract)
      if (balance > 0 && balance < amountUsdt) {
        return {
          success: false,
          senderAddress,
          amountUsdt,
          error: `Saldo insuficiente de USDT en tu MetaMask (Tienes ${balance.toFixed(2)} USDT, intentas depositar ${amountUsdt} USDT).`,
        }
      }

      // 4. Codificar datos de transferencia
      const amountWei = usdtToWei(amountUsdt)
      const callData = encodeErc20TransferData(treasuryAddress, amountWei)

      const ethereum = this.getEthereum()

      // 5. Enviar transacción al contrato USDT BEP20
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: senderAddress,
            to: tokenContract,
            data: callData,
          },
        ],
      })

      if (!txHash || typeof txHash !== 'string') {
        return {
          success: false,
          senderAddress,
          error: 'No se recibió el Hash de la transacción.',
        }
      }

      return {
        success: true,
        txHash: txHash.toLowerCase(),
        senderAddress,
        amountUsdt,
      }
    } catch (err: any) {
      // Manejar rechazo explícito del usuario en MetaMask (código 4001)
      if (err.code === 4001 || err?.message?.includes('user rejected') || err?.message?.includes('User denied')) {
        return {
          success: false,
          userCancelled: true,
          error: 'Transacción cancelada en MetaMask.',
        }
      }

      return {
        success: false,
        error: err?.message || 'Error al procesar el depósito en MetaMask.',
      }
    }
  }
}
