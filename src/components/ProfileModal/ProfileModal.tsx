import React, { useState, useRef, useEffect } from 'react'
import {
  UserManager,
  PRESET_AVATARS,
  compressImage,
  type PlayerProfile,
} from '../../utils/userManager'
import { soundManager } from '../../utils/audioManager'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import type { PlantId } from '../../types/game'
import { accountService } from '../../services/accountService'
import { Web3DepositService, DEFAULT_TREASURY_WALLET } from '../../services/web3DepositService'
import PanelDeReferidos from '../Referidos/PanelDeReferidos'
import './ProfileModal.css'

interface ProfileModalProps {
  isOpen: boolean
  userElo: number
  userTokens: number
  hasVipPass: boolean
  unlockedPlants?: PlantId[]
  initialTab?: ProfileTab
  onClose: () => void
  onOpenSwap?: () => void
}

export type ProfileTab = 'profile' | 'deposit' | 'withdraw' | 'referrals' | 'history'

export default function ProfileModal({
  isOpen,
  userElo,
  userTokens,
  hasVipPass,
  unlockedPlants,
  initialTab,
  onClose,
  onOpenSwap,
}: ProfileModalProps) {
  const [profile, setProfile] = useState<PlayerProfile>(() => UserManager.getProfile())
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab || 'profile')

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [isEditingNick, setIsEditingNick] = useState(false)
  const [nickInput, setNickInput] = useState(profile.name)
  const [isCompressing, setIsCompressing] = useState(false)
  const userIdentifier = profile.referralCode || profile.name || 'player'

  // ── ESTADO DE DEPÓSITO BEP20 ───────────────────────────────────────────────
  const [depositInfo, setDepositInfo] = useState<{
    registeredWallet?: { id: string; address: string; normalized: string; status: string; createdAt: string } | null
    treasuryWallet?: string
    tokenContract?: string
    network?: string
    rate?: string
    bonusPercent?: number
    bonusActive?: boolean
    bonusExpiresAt?: string | null
    returningBonus?: boolean
  }>({
    treasuryWallet: '0x721622D8cad39621C731eC286D1EA859365A51b8',
    tokenContract: '0x55d398326f99059fF775485246999027B3197955',
    network: 'BNB Smart Chain (BEP20)',
    rate: '1 USDT = 100 GEMAS',
    bonusPercent: 0,
    bonusActive: false,
  })
  const [personalWalletInput, setPersonalWalletInput] = useState('')
  const [isRegisteringWallet, setIsRegisteringWallet] = useState(false)
  const [isCheckingDeposits, setIsCheckingDeposits] = useState(false)
  const [copiedTreasury, setCopiedTreasury] = useState(false)
  const [isEditingRegisteredWallet, setIsEditingRegisteredWallet] = useState(false)
  const [manualTxHashInput, setManualTxHashInput] = useState('')
  const [showManualTxInput, setShowManualTxInput] = useState(false)

  // ── ESTADO METAMASK WEB3 (1 CLIC) ──────────────────────────────────────────
  const [metaMaskAmount, setMetaMaskAmount] = useState<number>(5)
  const [customMetaMaskInput, setCustomMetaMaskInput] = useState<string>('')
  const [metaMaskStep, setMetaMaskStep] = useState<
    'idle' | 'connecting' | 'confirming' | 'verifying' | 'success'
  >('idle')
  const [metaMaskAccount, setMetaMaskAccount] = useState<string | null>(null)
  const [metaMaskUsdtBalance, setMetaMaskUsdtBalance] = useState<number | null>(null)
  const [showManualTransferSection, setShowManualTransferSection] = useState<boolean>(false)
  const isMetaMaskAvailable = Web3DepositService.isMetaMaskAvailable()




  // ── ESTADO DE HISTORIAL FINANCIERO ─────────────────────────────────────────
  const [financialHistory, setFinancialHistory] = useState<{
    deposits: any[]
    withdrawals: any[]
  }>({ deposits: [], withdrawals: [] })
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // ── ESTADO DE CÓDIGOS DE RECOMPENSA STREAMER ──────────────────────────────
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [isClaimingCode, setIsClaimingCode] = useState(false)
  const [codeFeedback, setCodeFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Status feedback toast
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const showFeedback = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedbackMsg({ text, type })
    setTimeout(() => setFeedbackMsg(null), 4500)
  }

  // Ref para trackear depósitos ya conocidos y no repetir toast
  const knownDepositIdsRef = useRef<Set<string>>(new Set())

  // Cargar datos de depósito e historial al abrir o cambiar de pestaña
  useEffect(() => {
    if (!isOpen) return
    let active = true

    const loadData = async () => {
      if (!isSupabaseConfigured()) return



      // 2. Información de depósito
      const info = await accountService.getDepositInfo()
      if (active && info.success) {
        setDepositInfo({
          registeredWallet: info.registeredWallet,
          treasuryWallet: info.treasuryWallet,
          tokenContract: info.tokenContract,
          network: info.network,
          rate: info.rate,
          bonusPercent: info.bonusPercent,
          bonusActive: info.bonusActive,
          bonusExpiresAt: info.bonusExpiresAt,
        })
        if (info.registeredWallet?.address) {
          setPersonalWalletInput(info.registeredWallet.address)
        }
      }

      // 3. Historial financiero
      setIsLoadingHistory(true)
      const hist = await accountService.getFinancialHistory()
      if (active && hist.success) {
        setFinancialHistory({
          deposits: hist.deposits || [],
          withdrawals: hist.withdrawals || [],
        });
        (hist.deposits || []).forEach((d: any) => {
          if (d.status === 'credited') knownDepositIdsRef.current.add(d.id)
        })
      }
      if (active) setIsLoadingHistory(false)
    }

    void loadData()

    const handleRefresh = () => {
      if (active) void loadData()
    }
    window.addEventListener('refresh_user_balance', handleRefresh)
    window.addEventListener('player_profile_updated', handleRefresh)

    return () => {
      active = false
      window.removeEventListener('refresh_user_balance', handleRefresh)
      window.removeEventListener('player_profile_updated', handleRefresh)
    }
  }, [isOpen, activeTab, userTokens])

  // Handle Nick Change
  const handleSaveNick = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickInput.trim()) return
    const updated = UserManager.updateName(nickInput)
    setProfile(updated)
    setIsEditingNick(false)
    soundManager.playSound('click', 0.5)
    showFeedback('¡Nick actualizado correctamente!')

    if (isSupabaseConfigured()) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await (supabase.from('profiles') as any).update({ username: nickInput.trim() }).eq('id', session.user.id)
      }
    }
  }

  // Handle Preset Avatar Select
  const handleSelectPresetAvatar = async (iconUrl: string) => {
    const updated = UserManager.updateAvatar(iconUrl, false)
    setProfile(updated)
    soundManager.playSound('click', 0.5)
    showFeedback('¡Foto de perfil actualizada!')

    if (isSupabaseConfigured()) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const found = PRESET_AVATARS.find((a) => a.icon === iconUrl)
        if (found) {
          await (supabase.from('profiles') as any).update({ avatar_id: found.id }).eq('id', session.user.id)
        }
      }
    }
  }

  // Handle Custom File Upload with Compression
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsCompressing(true)
      const compressedDataUrl = await compressImage(file, 128, 0.75)
      const updated = UserManager.updateAvatar(compressedDataUrl, true)
      setProfile(updated)
      soundManager.playSound('victory', 0.8)
      showFeedback('¡Foto subida y optimizada con éxito!')
    } catch {
      showFeedback('Error al procesar la imagen.', 'error')
    } finally {
      setIsCompressing(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // ── CANJEAR CÓDIGO DE RECOMPENSA STREAMER ─────────────────────────────────
  const handleClaimRewardCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = promoCodeInput.trim().toUpperCase()
    if (!clean) return

    try {
      setIsClaimingCode(true)
      setCodeFeedback(null)
      const res = await accountService.claimRewardCode(clean)

      if (res.success) {
        soundManager.playSound('victory', 0.9)
        setPromoCodeInput('')
        let msg = res.message || '🎉 ¡Recompensa recibida con éxito!'
        if (res.rewardType === 'bundle') {
          msg = res.message || `🎉 ¡Has recibido +${res.goldAmount?.toLocaleString() || ''} de Oro y 1 Sobre!`
        } else if (res.rewardType === 'gold' && !res.message) {
          msg = `💰 ¡Has recibido +${res.goldAmount?.toLocaleString() || ''} de Oro!`
        } else if (res.rewardType === 'gems' && !res.message) {
          msg = `💎 ¡Has recibido +${res.gemsAmount?.toLocaleString() || ''} Gemas!`
        } else if (res.rewardType === 'plant' && !res.message) {
          msg = `🌿 ¡Carta ${res.plantId || ''} añadida a tu inventario!`
        } else if (res.rewardType === 'pvp_pack') {
          msg = res.message || '🎉 ¡Sobre PvP añadido al jardín!'
        }
        setCodeFeedback({ text: msg, type: 'success' })
        showFeedback(msg, 'success')
        window.dispatchEvent(new Event('refresh_reward_packs'))
        window.dispatchEvent(new Event('refresh_pack_slots'))
        window.dispatchEvent(new Event('refresh_user_balance'))
        window.dispatchEvent(new Event('refresh_user_inventory'))
        window.dispatchEvent(new Event('player_profile_updated'))
      } else {
        soundManager.playSound('error', 0.5)
        let msg = 'Código no encontrado.'
        if (res.errorCode === 'NOT_AUTHENTICATED') {
          msg = 'Debes iniciar sesión para canjear códigos.'
        } else if (res.errorCode === 'CODE_ALREADY_CLAIMED' || res.errorCode === 'CODE_LIMIT_REACHED') {
          msg = 'Este código ya fue utilizado.'
        } else if (res.errorCode === 'CODE_NOT_FOUND') {
          msg = 'Código no encontrado.'
        } else if (res.errorCode === 'CODE_EXPIRED' || res.errorCode === 'CODE_DISABLED') {
          msg = 'Este código ha expirado o está desactivado.'
        } else if (res.error) {
          if (res.error.includes('CODE_ALREADY_CLAIMED') || res.error.includes('CODE_LIMIT_REACHED') || res.error.includes('uq_reward_code_user_claim')) {
            msg = 'Este código ya fue utilizado.'
          } else if (res.error.includes('NOT_AUTHENTICATED') || res.error.includes('No autenticado')) {
            msg = 'Debes iniciar sesión para canjear códigos.'
          } else if (res.error.includes('CODE_NOT_FOUND')) {
            msg = 'Código no encontrado.'
          } else {
            msg = res.error
          }
        }
        setCodeFeedback({ text: msg, type: 'error' })
        showFeedback(msg, 'error')
      }
    } catch {
      soundManager.playSound('error', 0.5)
      setCodeFeedback({ text: 'Error al conectar con el servidor.', type: 'error' })
      showFeedback('Error al conectar con el servidor.', 'error')
    } finally {
      setIsClaimingCode(false)
    }
  }

  // ── REGISTRAR WALLET PERSONAL DE DEPÓSITO ──────────────────────────────────
  const handleRegisterPersonalWallet = async (e: React.FormEvent) => {
    e.preventDefault()
    const address = personalWalletInput.trim()
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      showFeedback('Dirección BEP20 inválida. Debe comenzar con 0x y tener 40 caracteres hexadecimales.', 'error')
      return
    }

    try {
      setIsRegisteringWallet(true)
      const res = await accountService.registerDepositWallet(address)
      if (res.success && res.wallet) {
        soundManager.playSound('victory', 0.7)
        setDepositInfo((prev) => ({
          ...prev,
          registeredWallet: res.wallet,
        }))
        setIsEditingRegisteredWallet(false)
        if (res.reconciled_deposits_count && res.reconciled_deposits_count > 0) {
          showFeedback(
            `🎉 ¡Wallet vinculada y ${res.reconciled_deposits_count} depósito(s) previo(s) conciliado(s)! (+${Number(res.reconciled_gems_total).toFixed(2)} 💎)`,
            'success'
          )
          window.dispatchEvent(new Event('refresh_user_balance'))
          window.dispatchEvent(new Event('player_profile_updated'))
        } else {
          showFeedback('¡Wallet personal vinculada con éxito para depósitos automáticos!', 'success')
        }
      } else {
        showFeedback(res.message || 'Error al vincular wallet.', 'error')
      }
    } catch (err: any) {
      showFeedback(err?.message || 'Fallo de conexión.', 'error')
    } finally {
      setIsRegisteringWallet(false)
    }
  }

  // ── COPIAR DIRECCIÓN OFICIAL DE TESORERÍA ─────────────────────────────────
  const handleCopyTreasury = () => {
    const addr = depositInfo.treasuryWallet || '0x721622D8cad39621C731eC286D1EA859365A51b8'
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addr)
      setCopiedTreasury(true)
      soundManager.playSound('click', 0.5)
      setTimeout(() => setCopiedTreasury(false), 3000)
    }
  }

  // ── COMPROBAR DEPÓSITOS EN BLOCKCHAIN (CON VERIFICACIÓN INSTANTÁNEA POR HASH) ─
  const handleCheckBlockchainDeposits = async (isAutoPoll = false, customTxHash?: string) => {
    try {
      if (!isAutoPoll) setIsCheckingDeposits(true)
      const cleanTx = customTxHash?.trim()

      // Si el usuario proporcionó un TxHash manual, verificar directamente con el backend y la blockchain
      if (cleanTx) {
        const verifyRes = await accountService.verifyAndCreditTxHash(
          cleanTx,
          depositInfo.registeredWallet?.address,
          userIdentifier
        )
        if (verifyRes.success) {
          soundManager.playSound('victory', 0.9)
          showFeedback(
            verifyRes.message || `🎉 ¡Depósito verificado! +${verifyRes.amountGems} Gemas acreditadas.`,
            'success'
          )
          window.dispatchEvent(new Event('refresh_user_balance'))
          window.dispatchEvent(new Event('player_profile_updated'))
          setManualTxHashInput('')
          setShowManualTxInput(false)

          const hist = await accountService.getFinancialHistory()
          if (hist.success) {
            setFinancialHistory({ deposits: hist.deposits, withdrawals: hist.withdrawals })
          }
          return
        } else {
          soundManager.playSound('error', 0.5)
          showFeedback(verifyRes.message || 'No se pudo verificar la transacción aún.', 'error')
          return
        }
      }

      const res = await accountService.triggerDepositCheck()

      // Consultar historial actualizado
      const hist = await accountService.getFinancialHistory()
      if (hist.success) {
        setFinancialHistory({ deposits: hist.deposits, withdrawals: hist.withdrawals })

        // Detectar si hay algún depósito recién acreditado
        const newlyCredited = (hist.deposits || []).filter(
          (d: any) => d.status === 'credited' && !knownDepositIdsRef.current.has(d.id)
        )

        if (newlyCredited.length > 0) {
          newlyCredited.forEach((d: any) => knownDepositIdsRef.current.add(d.id))
          const totalNewGems = newlyCredited.reduce((acc: number, d: any) => acc + Number(d.amount_gems), 0)

          soundManager.playSound('victory', 0.9)
          showFeedback(
            `🎉 ¡DEPÓSITO RECIBIDO! +${totalNewGems.toFixed(2)} Gemas 💎 acreditadas a tu saldo en tiempo real.`,
            'success'
          )

          window.dispatchEvent(new Event('refresh_user_balance'))
          window.dispatchEvent(new Event('player_profile_updated'))
        } else if (!isAutoPoll) {
          soundManager.playSound('click', 0.5)
          showFeedback('✓ Escaneo completado: Tu saldo está actualizado (No hay nuevos depósitos pendientes).', 'success')
        }
      } else if (!isAutoPoll) {
        showFeedback(res.error || 'No se detectaron transferencias pendientes.', 'warning')
      }
    } catch {
      if (!isAutoPoll) showFeedback('Error al consultar blockchain.', 'error')
    } finally {
      if (!isAutoPoll) setIsCheckingDeposits(false)
    }
  }

  // ── DEPÓSITO NATIVO CON METAMASK (1 CLIC) ──────────────────────────────────
  const handleMetaMaskDeposit = async () => {
    const finalAmount = customMetaMaskInput ? Number(customMetaMaskInput) : metaMaskAmount
    if (!finalAmount || isNaN(finalAmount) || finalAmount < 1) {
      showFeedback('El monto mínimo de depósito es 1 USDT.', 'warning')
      return
    }

    try {
      setMetaMaskStep('connecting')
      soundManager.playSound('click', 0.5)

      // 1. Conectar wallet
      const sender = await Web3DepositService.connectWallet()
      setMetaMaskAccount(sender)

      // Auto-vincular la wallet en el juego en segundo plano
      void accountService.registerDepositWallet(sender).then((res) => {
        if (res.success && res.wallet) {
          setDepositInfo((prev) => ({ ...prev, registeredWallet: res.wallet }))
        }
      })

      // 2. Asegurar red BNB Smart Chain (BEP20)
      await Web3DepositService.ensureBscNetwork()

      // 3. Consultar balance de USDT en MetaMask
      const bal = await Web3DepositService.getUsdtBalance(sender)
      setMetaMaskUsdtBalance(bal)
      if (bal > 0 && bal < finalAmount) {
        setMetaMaskStep('idle')
        showFeedback(`Saldo insuficiente de USDT en MetaMask (${bal.toFixed(2)} USDT disponibles).`, 'error')
        return
      }

      // 4. Solicitar transferencia nativa en MetaMask
      setMetaMaskStep('confirming')
      const targetTreasury = depositInfo.treasuryWallet || DEFAULT_TREASURY_WALLET
      const res = await Web3DepositService.depositUsdt(finalAmount, targetTreasury)

      if (!res.success) {
        setMetaMaskStep('idle')
        if (res.userCancelled) {
          showFeedback('Operación cancelada en MetaMask.', 'warning')
        } else {
          showFeedback(res.error || 'Error al enviar la transacción.', 'error')
        }
        return
      }

      const txHash = res.txHash!
      // Guardar hash en localStorage de inmediato para blindar contra caídas de red
      accountService.savePendingDepositTx(userIdentifier, txHash, finalAmount)

      // 5. Verificación inmediata (polling on-demand a blockchain)
      setMetaMaskStep('verifying')

      let verified = false
      for (let attempt = 1; attempt <= 4; attempt++) {
        const verifyRes = await accountService.verifyAndCreditTxHash(txHash, sender, userIdentifier)
        if (verifyRes.success) {
          verified = true
          setMetaMaskStep('success')
          soundManager.playSound('victory', 1.0)
          showFeedback(
            `🎉 ¡DEPÓSITO EXITOSO! +${verifyRes.amountGems || finalAmount * 100} Gemas 💎 acreditadas a tu cuenta.`,
            'success'
          )
          window.dispatchEvent(new Event('refresh_user_balance'))
          window.dispatchEvent(new Event('player_profile_updated'))

          const hist = await accountService.getFinancialHistory()
          if (hist.success) {
            setFinancialHistory({ deposits: hist.deposits, withdrawals: hist.withdrawals })
          }
          break
        }
        await new Promise((r) => setTimeout(r, 2500))
      }

      if (!verified) {
        setMetaMaskStep('idle')
        showFeedback(
          'La transferencia fue enviada a la blockchain. Se acreditará automáticamente en breves instantes.',
          'warning'
        )
      } else {
        setTimeout(() => setMetaMaskStep('idle'), 3500)
      }
    } catch (err: any) {
      setMetaMaskStep('idle')
      showFeedback(err?.message || 'Error al interactuar con MetaMask.', 'error')
    }
  }

  // ── RESCATAR DEPÓSITOS PENDIENTES DE LOCALSTORAGE AL ABRIR EL MODAL ────────
  useEffect(() => {
    if (!isOpen || !userIdentifier) return
    const pending = accountService.getPendingDepositTxs(userIdentifier)
    if (pending.length > 0) {
      pending.forEach((p) => {
        void accountService.verifyAndCreditTxHash(p.txHash, undefined, userIdentifier).then((res) => {
          if (res.success && res.status === 'credited') {
            soundManager.playSound('victory', 0.9)
            showFeedback(`🎉 ¡Depósito recuperado! +${res.amountGems} Gemas 💎 acreditadas.`, 'success')
            window.dispatchEvent(new Event('refresh_user_balance'))
            window.dispatchEvent(new Event('player_profile_updated'))
          }
        })
      })
    }
  }, [isOpen, userIdentifier])

  // ── LEER CUENTA ACTIVA DE METAMASK AL ENTRAR A LA PESTAÑA DE DEPÓSITO ──────
  useEffect(() => {
    if (!isOpen || activeTab !== 'deposit') return
    if (Web3DepositService.isMetaMaskAvailable()) {
      void Web3DepositService.getActiveAccount().then((acc) => {
        if (acc) {
          setMetaMaskAccount(acc)
          void Web3DepositService.getUsdtBalance(acc).then((b) => setMetaMaskUsdtBalance(b))
        }
      })
    }
  }, [isOpen, activeTab])

  // ── AUTO-POLLING EN TIEMPO REAL CUANDO ESTÁ EN LA PESTAÑA DE DEPÓSITO ───────
  useEffect(() => {
    if (!isOpen || activeTab !== 'deposit') return

    // Ejecutar de inmediato al abrir la pestaña
    void handleCheckBlockchainDeposits(true)

    // Polling automático cada 6 segundos mientras mantenga abierta la pestaña Depositar
    const interval = setInterval(() => {
      void handleCheckBlockchainDeposits(true)
    }, 6000)

    return () => clearInterval(interval)
  }, [isOpen, activeTab])


  if (!isOpen) return null

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* MODAL HEADER */}
        <div className="profile-modal-header">
          <div className="profile-header-user">
            <div className="profile-avatar-wrap">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="profile-avatar-img"
                onError={(e) => {
                  e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                }}
              />
              <button
                type="button"
                className="profile-avatar-edit-badge"
                title="Cambiar Foto de Perfil"
                onClick={() => fileInputRef.current?.click()}
              >
                📷
              </button>
            </div>

            <div className="profile-header-meta">
              {isEditingNick ? (
                <form onSubmit={handleSaveNick} className="profile-nick-form">
                  <input
                    type="text"
                    value={nickInput}
                    onChange={(e) => setNickInput(e.target.value)}
                    maxLength={16}
                    autoFocus
                  />
                  <button type="submit" className="profile-nick-save-btn">✓</button>
                  <button
                    type="button"
                    className="profile-nick-cancel-btn"
                    onClick={() => {
                      setNickInput(profile.name)
                      setIsEditingNick(false)
                    }}
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <div className="profile-nick-row">
                  <h3 className={`profile-nick-title ${hasVipPass ? 'profile-nick-title--vip-gold' : ''}`}>
                    {hasVipPass && <span className="nick-vip-crown">👑 </span>}
                    {profile.name}
                  </h3>
                  <button
                    type="button"
                    className="profile-nick-edit-btn"
                    onClick={() => setIsEditingNick(true)}
                    title="Editar Nick"
                  >
                    ✏️
                  </button>
                </div>
              )}

              <div className="profile-badges-row">
                <span className="profile-badge profile-badge--elo">🏆 {userElo} Copas</span>
                <span className="profile-badge profile-badge--gems">💎 {userTokens} Gemas</span>
                {hasVipPass ? (
                  <span className="profile-badge profile-badge--vip">👑 PASE VIP</span>
                ) : (
                  <span className="profile-badge profile-badge--free">🌱 JUGADOR</span>
                )}
              </div>
            </div>
          </div>

          <button type="button" className="profile-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* HIDDEN FILE INPUT FOR CUSTOM AVATAR */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* FEEDBACK TOAST */}
        {feedbackMsg && (
          <div className={`profile-toast profile-toast--${feedbackMsg.type}`}>
            {feedbackMsg.text}
          </div>
        )}

        {/* MODAL TABS */}
        <div className="profile-nav-tabs">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'profile' ? 'profile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 PERFIL
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'deposit' ? 'profile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('deposit')}
          >
            💰 DEPOSITAR
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'withdraw' ? 'profile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            💸 RETIRAR
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'referrals' ? 'profile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('referrals')}
          >
            👥 REFERIDOS
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'history' ? 'profile-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📊 HISTORIAL
          </button>
        </div>

        {/* TAB 1: PERFIL & STATS */}
        {activeTab === 'profile' && (
          <div className="profile-tab-body">
            <div className="profile-section-title">
              <span>⚔️ ESTADÍSTICAS COMPETITIVAS</span>
              <small>Rendimiento en la Arena, balance de saldo y progreso de la cuenta.</small>
            </div>

            <div className="profile-stats-grid">
              <div className="profile-stat-box">
                <span className="profile-stat-val">{userElo} 🏆</span>
                <span className="profile-stat-lbl">Copas ELO Actuales</span>
              </div>
              <div className="profile-stat-box">
                <span className="profile-stat-val" style={{ color: '#4ade80' }}>💎 {userTokens} Gemas</span>
                <span className="profile-stat-lbl">Saldo Disponible</span>
              </div>
              <div className="profile-stat-box">
                <span className="profile-stat-val">
                  {unlockedPlants ? unlockedPlants.length : 3} / {Object.keys(PLANT_CONFIGS).length}
                </span>
                <span className="profile-stat-lbl">Plantas Desbloqueadas</span>
              </div>
              <div className="profile-stat-box">
                <span className="profile-stat-val" style={{ color: '#38bdf8' }}>{profile.totalReferred} Amigos</span>
                <span className="profile-stat-lbl">Referidos Activos</span>
              </div>
            </div>

            {/* SECCIÓN: 🎁 CÓDIGOS DE RECOMPENSA */}
            <div className="profile-reward-code-card">
              <div className="profile-reward-code-header">
                <div className="profile-reward-code-title-row">
                  <span className="profile-reward-code-icon">🎁</span>
                  <span className="profile-reward-code-title">CÓDIGOS DE RECOMPENSA</span>
                </div>
                <span className="profile-reward-code-subtitle">
                  Canjea códigos promocionales de streamers para obtener sobres PvP en tu jardín.
                </span>
              </div>

              <form onSubmit={handleClaimRewardCode} className="profile-reward-code-form">
                <div className="profile-reward-code-input-group">
                  <input
                    type="text"
                    placeholder="Ingresar código"
                    value={promoCodeInput}
                    onChange={(e) => {
                      setPromoCodeInput(e.target.value.toUpperCase())
                      if (codeFeedback) setCodeFeedback(null)
                    }}
                    className="profile-reward-code-input"
                    maxLength={32}
                    disabled={isClaimingCode}
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <button
                    type="submit"
                    className="profile-reward-code-btn"
                    disabled={isClaimingCode || !promoCodeInput.trim()}
                  >
                    {isClaimingCode ? '⏳ RECLAMANDO...' : 'RECLAMAR'}
                  </button>
                </div>

                {codeFeedback && (
                  <div className={`profile-reward-code-feedback profile-reward-code-feedback--${codeFeedback.type}`}>
                    {codeFeedback.text}
                  </div>
                )}
              </form>
            </div>

            {/* Collapsible Avatar Picker Section */}
            <div className="profile-collapsible-card">
              <button
                type="button"
                className="profile-toggle-avatar-btn"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setShowAvatarPicker((prev) => !prev)
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px' }}>🖼️</span>
                  <span style={{ fontWeight: 900, fontSize: '11.5px', color: '#ffd23f' }}>
                    ELEGIR / CAMBIAR FOTO DE PERFIL
                  </span>
                </div>
                <span className="profile-toggle-badge">
                  {showAvatarPicker ? '▲ OCULTAR' : '▼ DESPLEGAR'}
                </span>
              </button>

              {showAvatarPicker && (
                <div className="profile-avatar-picker-content">
                  <div className="profile-upload-bar">
                    <button
                      type="button"
                      className="profile-upload-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isCompressing}
                    >
                      {isCompressing ? '⏳ Subiendo y optimizando...' : '📤 SUBIR MI FOTO PERSONALIZADA'}
                    </button>
                  </div>

                  <div className="profile-avatar-grid">
                    {PRESET_AVATARS.map((av) => {
                      const isSelected = profile.avatar === av.icon && !profile.isCustomAvatar
                      return (
                        <button
                          key={av.id}
                          type="button"
                          className={`profile-avatar-card ${isSelected ? 'profile-avatar-card--active' : ''}`}
                          onClick={() => handleSelectPresetAvatar(av.icon)}
                        >
                          <img
                            src={av.icon}
                            alt={av.name}
                            onError={(e) => {
                              e.currentTarget.src = '/game-assets/greenfoot/peashooterpacket1.webp'
                            }}
                          />
                          <span>{av.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEPOSITAR USDT BEP20 */}
        {activeTab === 'deposit' && (() => {
          const activeAmountUsdt = customMetaMaskInput ? (Number(customMetaMaskInput) || 0) : metaMaskAmount
          const previewBaseGems = Math.round(activeAmountUsdt * 100)
          const previewBonusPct = depositInfo.bonusActive ? Number(depositInfo.bonusPercent || 0) : 0
          const previewBonusGems = Math.round(previewBaseGems * (previewBonusPct / 100))
          const previewTotalGems = previewBaseGems + previewBonusGems
          const previewRetirableGems = Math.round(previewBaseGems * 0.5)
          const previewLockedGems = (previewBaseGems - previewRetirableGems) + previewBonusGems

          return (
            <div className="profile-tab-body">
              <div className="profile-section-title">
                <span>💰 DEPÓSITO DE USDT (BNB SMART CHAIN)</span>
                <small>Tasa oficial: <strong>1 USDT = 100 Gemas 💎</strong> (Red BSC BEP-20)</small>
              </div>

              {/* ── 1. BOTÓN NATIVO WEB3 CON METAMASK (1 CLIC) ──────────────── */}
              <div className="crypto-metamask-card">
                <div className="crypto-metamask-header">
                  <div className="crypto-metamask-title-wrap">
                    <span className="crypto-metamask-fox">🦊</span>
                    <span className="crypto-metamask-title">Depósito Rápido con MetaMask</span>
                  </div>
                  <span className="crypto-metamask-speed-badge">⚡ Acreditación Instantánea (3s)</span>
                </div>

                <p className="crypto-metamask-desc">
                  Selecciona el monto y paga directamente desde MetaMask en 1 clic. El sistema detecta la confirmación en la blockchain y acredita tus gemas al instante sin esperas.
                </p>

                {/* SELECTOR DE MONTOS RÁPIDOS */}
                <div className="crypto-amount-presets">
                  {[1, 5, 10, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`crypto-preset-btn ${
                        !customMetaMaskInput && metaMaskAmount === preset ? 'crypto-preset-btn--active' : ''
                      }`}
                      onClick={() => {
                        setMetaMaskAmount(preset)
                        setCustomMetaMaskInput('')
                        soundManager.playSound('click', 0.5)
                      }}
                    >
                      ${preset} USDT
                    </button>
                  ))}
                </div>

                {/* MONTO PERSONALIZADO */}
                <div className="crypto-custom-amount-wrap">
                  <span>Otro Monto:</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    placeholder="Monto en USDT..."
                    value={customMetaMaskInput}
                    onChange={(e) => setCustomMetaMaskInput(e.target.value)}
                    className="crypto-custom-amount-input"
                  />
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>USDT</span>
                </div>

                {/* PREVIEW DINÁMICO DE GEMAS */}
                <div className="crypto-calc-preview">
                  <div className="crypto-calc-main-row">
                    <span className="crypto-calc-usdt">
                      Recibes por ${activeAmountUsdt > 0 ? activeAmountUsdt : 0} USDT:
                    </span>
                    <span className="crypto-calc-gems">
                      +{previewTotalGems.toLocaleString()} Gemas 💎
                      {previewBonusGems > 0 && (
                        <small style={{ color: '#fef08a', fontSize: '10px', marginLeft: '4px' }}>
                          (+{previewBonusPct}% BONO 🔥)
                        </small>
                      )}
                    </span>
                  </div>
                  <div className="crypto-calc-sub-row">
                    <span>50% Retirable: {previewRetirableGems.toLocaleString()} 💎</span>
                    <span>50% Bloqueado/Juego: {previewLockedGems.toLocaleString()} 💎</span>
                  </div>
                </div>

                {/* BOTÓN PRINCIPAL DE PAGO METAMASK */}
                {isMetaMaskAvailable ? (
                  <button
                    type="button"
                    className="crypto-metamask-action-btn"
                    disabled={metaMaskStep !== 'idle' || activeAmountUsdt < 1}
                    onClick={handleMetaMaskDeposit}
                  >
                    {metaMaskStep === 'connecting' && '🦊 Conectando MetaMask...'}
                    {metaMaskStep === 'confirming' && '📝 Confirma en MetaMask...'}
                    {metaMaskStep === 'verifying' && '⏳ Verificando en Blockchain (3s)...'}
                    {metaMaskStep === 'success' && '✅ ¡DEPÓSITO ACREDITADO! 🎉'}
                    {metaMaskStep === 'idle' && (
                      <>
                        <span>⚡</span>
                        <span>Depositar {activeAmountUsdt > 0 ? `${activeAmountUsdt} USDT` : ''} con MetaMask</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div style={{
                    background: 'rgba(234, 88, 12, 0.15)',
                    border: '1px solid #f97316',
                    borderRadius: '8px',
                    padding: '10px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#fed7aa',
                  }}>
                    🦊 <strong>MetaMask no detectado en este navegador.</strong>
                    <br />
                    Si estás en celular, abre Plant Arena dentro del navegador de <strong>MetaMask App</strong> o utiliza la opción de transferencia manual abajo.
                  </div>
                )}

                {/* INFORMACIÓN DE LA WALLET CONECTADA */}
                {metaMaskAccount && (
                  <div className="crypto-wallet-status-footer">
                    <span>MetaMask Conectado: <code>{metaMaskAccount.slice(0, 6)}...{metaMaskAccount.slice(-4)}</code></span>
                    {metaMaskUsdtBalance !== null && (
                      <span>Saldo USDT: <strong>{metaMaskUsdtBalance.toFixed(2)} USDT</strong></span>
                    )}
                  </div>
                )}
              </div>

              {/* ── 2. DIVIDER PARA OPCIÓN MANUAL ───────────────────────────── */}
              <div className="crypto-fallback-divider">O bien transferencia manual</div>

              {/* TOGGLE PARA MOSTRAR TRANSFERENCIA MANUAL */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowManualTransferSection((prev) => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {showManualTransferSection ? '▲ Ocultar transferencia manual' : '▼ Ver dirección de depósito manual / Otras wallets'}
                </button>
              </div>

              {/* CONTENIDO MANUAL COLLAPSIBLE */}
              {showManualTransferSection && (
                <>
                  {/* PASO 1: VINCULAR WALLET PERSONAL */}
                  {(!depositInfo.registeredWallet || isEditingRegisteredWallet) ? (
                    <form onSubmit={handleRegisterPersonalWallet} className="crypto-wallet-register-box">
                      <div className="crypto-step-badge">1️⃣ PASO 1: REGISTRA TU WALLET PERSONAL (SELF-CUSTODY)</div>
                      <p className="crypto-step-desc">
                        Introduce la dirección pública de tu wallet personal
                        (<strong>MetaMask, Trust Wallet, Rabby, SafePal</strong>, etc.).
                      </p>
                      <div className="crypto-input-group">
                        <input
                          type="text"
                          placeholder="0x... (Tu dirección pública BEP20)"
                          value={personalWalletInput}
                          onChange={(e) => setPersonalWalletInput(e.target.value)}
                          className="crypto-wallet-input"
                          required
                        />
                        <button
                          type="submit"
                          className="crypto-register-btn"
                          disabled={isRegisteringWallet}
                        >
                          {isRegisteringWallet ? '⏳ Vinculando...' : '🔗 VINCULAR WALLET'}
                        </button>
                      </div>
                      {isEditingRegisteredWallet && (
                        <button
                          type="button"
                          className="crypto-cancel-link-btn"
                          onClick={() => setIsEditingRegisteredWallet(false)}
                        >
                          Cancelar y conservar wallet actual
                        </button>
                      )}
                    </form>
                  ) : (
                    <div className="crypto-registered-wallet-pill">
                      <div className="crypto-registered-info">
                        <span className="crypto-registered-tag">✅ WALLET PERSONAL VINCULADA:</span>
                        <code className="crypto-registered-addr">{depositInfo.registeredWallet.address}</code>
                      </div>
                      <button
                        type="button"
                        className="crypto-change-wallet-btn"
                        onClick={() => setIsEditingRegisteredWallet(true)}
                        title="Cambiar Wallet Personal"
                      >
                        ✏️ Cambiar
                      </button>
                    </div>
                  )}

                  {/* ADVERTENCIA SOBRE BINANCE Y EXCHANGES */}
                  <div className="crypto-exchange-warning-box">
                    <div className="crypto-warning-icon">⚠️</div>
                    <div className="crypto-warning-content">
                      <strong>TRANSFERENCIA MANUAL:</strong>
                      <p>
                        Si transfieres manualmente, envía únicamente desde tu wallet personal registrada.
                      </p>
                      <small>❌ NO envíes directamente desde Binance u otro exchange a la wallet de Plant Arena.</small>
                    </div>
                  </div>

                  {/* DIRECCIÓN OFICIAL DE TESORERÍA */}
                  <div className="crypto-treasury-card">
                    <div className="crypto-step-badge">2️⃣ ENVÍA USDT (BEP20) A ESTA DIRECCIÓN</div>

                    <div className="crypto-treasury-meta-row">
                      <span className="crypto-network-badge">🟡 RED: BNB Smart Chain (BEP20)</span>
                      <span className="crypto-token-badge">💵 TOKEN: USDT</span>
                      <span className="crypto-rate-badge">💎 1 USDT = 100 GEMAS</span>
                      {depositInfo.bonusActive && Number(depositInfo.bonusPercent ?? 0) > 0 && (
                        <span className="crypto-bonus-badge">
                          {depositInfo.returningBonus
                            ? '🎁 +30% BONO EXCLUSIVO POR REGRESAR'
                            : `🔥 +${depositInfo.bonusPercent}% BONO EXTRA`}
                        </span>
                      )}
                    </div>

                    <div className="crypto-treasury-address-box">
                      <span className="crypto-treasury-lbl">Dirección Oficial de Depósito de Plant Arena:</span>
                      <div className="crypto-address-copy-row">
                        <code className="crypto-address-text">{depositInfo.treasuryWallet}</code>
                        <button
                          type="button"
                          className="crypto-copy-btn"
                          onClick={handleCopyTreasury}
                        >
                          {copiedTreasury ? '✓ ¡COPIADO!' : '📋 COPIAR'}
                        </button>
                      </div>
                    </div>

                    <div className="crypto-detector-status-bar">
                      <span className="crypto-detector-pulse">🟢 Detección Blockchain Activa</span>
                      <button
                        type="button"
                        className="crypto-refresh-blockchain-btn"
                        onClick={() => handleCheckBlockchainDeposits(false)}
                        disabled={isCheckingDeposits}
                      >
                        {isCheckingDeposits ? '⏳ Escaneando...' : '🔄 Comprobar Blockchain Ahora'}
                      </button>
                    </div>

                    {/* Opción rápida de verificación directa por Hash de transacción */}
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      {!showManualTxInput ? (
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() => setShowManualTxInput(true)}
                        >
                          ¿Ya enviaste y tienes el Hash de la transacción? Verificar por Hash
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                          <input
                            type="text"
                            placeholder="0x... (Hash de la transacción de 66 caracteres)"
                            value={manualTxHashInput}
                            onChange={(e) => setManualTxHashInput(e.target.value)}
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '11px',
                            }}
                          />
                          <button
                            type="button"
                            disabled={isCheckingDeposits || !manualTxHashInput.trim()}
                            onClick={() => {
                              handleCheckBlockchainDeposits(false, manualTxHashInput.trim())
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#3b82f6',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#fff',
                              fontWeight: 'bold',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            {isCheckingDeposits ? '⏳' : 'Verificar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowManualTxInput(false)}
                            style={{
                              padding: '6px 8px',
                              background: 'rgba(255,255,255,0.1)',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ccc',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* TAB 3: RETIROS CENTRALIZADOS EN SWAP */}
        {activeTab === 'withdraw' && (
          <div className="profile-tab-body profile-tab-body--swap-redirect">
            <div className="profile-swap-redirect-card">
              <div className="profile-swap-redirect-card__badge">🔄 GESTIÓN UNIFICADA DE RETIROS</div>

              <div className="profile-swap-redirect-card__hero">
                <span className="profile-swap-redirect-card__icon">🏦</span>
                <h3 className="profile-swap-redirect-card__title">RETIROS CENTRALIZADOS EN SWAP</h3>
                <p className="profile-swap-redirect-card__desc">
                  Todas las conversiones y solicitudes de retiro a billeteras externas <strong>USDT BEP-20</strong> ahora se gestionan de forma unificada y segura directamente desde la pantalla de <strong>Swap de Token PLANTS</strong>.
                </p>
              </div>

              <div className="profile-swap-redirect-features">
                <div className="profile-swap-redirect-feat">
                  <span className="profile-swap-redirect-feat-icon">⚡</span>
                  <div className="profile-swap-redirect-feat-text">
                    <strong>Swap Inmediato a USDT</strong>
                    <span>Convierte tus tokens a saldo USDT disponible para retiro.</span>
                  </div>
                </div>

                <div className="profile-swap-redirect-feat">
                  <span className="profile-swap-redirect-feat-icon">⏱️</span>
                  <div className="profile-swap-redirect-feat-text">
                    <strong>Franjas de Liquidación</strong>
                    <span>Ventana de 24h para VIP y auditoría de 72h para Free.</span>
                  </div>
                </div>

                <div className="profile-swap-redirect-feat">
                  <span className="profile-swap-redirect-feat-icon">🛡️</span>
                  <div className="profile-swap-redirect-feat-text">
                    <strong>Seguridad & Auditoría</strong>
                    <span>Validación anti-bot y trazabilidad en vivo de cada solicitud.</span>
                  </div>
                </div>
              </div>

              <div className="profile-swap-redirect-action">
                <button
                  type="button"
                  className="profile-swap-redirect-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.5)
                    if (onOpenSwap) {
                      onOpenSwap()
                    } else {
                      onClose()
                    }
                  }}
                >
                  🚀 IR A PANTALLA DE SWAP Y RETIROS
                </button>
                <small className="profile-swap-redirect-sub">
                  Redirecciona automáticamente a la sección de Swap con seguimiento de retiros pendientes.
                </small>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REFERIDOS */}
        {activeTab === 'referrals' && (
          <div className="profile-tab-body">
            <PanelDeReferidos />
          </div>
        )}

        {/* TAB 5: HISTORIAL FINANCIERO */}
        {activeTab === 'history' && (
          <div className="profile-tab-body">
            <div className="profile-section-title">
              <span>📊 HISTORIAL FINANCIERO BLOCKCHAIN</span>
              <small>Registro de depósitos automáticos y retiros procesados en BNB Smart Chain.</small>
            </div>

            {isLoadingHistory ? (
              <div className="profile-loading-state">⏳ Cargando movimientos...</div>
            ) : (
              <div className="profile-tx-list">
                {financialHistory.deposits.length === 0 && financialHistory.withdrawals.length === 0 ? (
                  <div className="profile-empty-state">No hay movimientos financieros registrados.</div>
                ) : (
                  <>
                    {/* Retiros */}
                    {financialHistory.withdrawals.map((w: any) => (
                      <div key={w.id} className="profile-tx-row">
                        <div className="profile-tx-left">
                          <span className="profile-tx-icon">💸</span>
                          <div>
                            <span className="profile-tx-desc">
                              Retiro USDT ({w.amount_gems} 💎 ➔ {w.net_amount_usdt} USDT)
                            </span>
                            <span className="profile-tx-date">
                              Destino: {w.destination_wallet.slice(0, 8)}...{w.destination_wallet.slice(-6)}
                              {w.tx_hash && (
                                <> • <a href={`https://bscscan.com/tx/${w.tx_hash}`} target="_blank" rel="noreferrer" className="crypto-tx-link">
                                  TX: {w.tx_hash.slice(0, 8)}... ↗
                                </a></>
                              )}
                              • {new Date(w.created_at).toLocaleDateString()}
                              {w.status === 'failed' && w.failure_reason && (
                                <span style={{ color: '#f87171', display: 'block', fontSize: '10px' }}>
                                  Motivo: {w.failure_reason} (Saldo Reembolsado)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="profile-tx-right">
                          <span className="profile-tx-amount profile-tx-amount--neg">
                            -{w.amount_gems} 💎
                          </span>
                          <span className={`crypto-tx-badge crypto-tx-badge--${w.status}`}>
                            {w.status === 'requested' && '⏳ Solicitado'}
                            {w.status === 'pending_manual_review' && '🛡️ En Revisión'}
                            {w.status === 'processing' && '⚙️ Procesando'}
                            {w.status === 'broadcasted' && '📡 Transmitido'}
                            {w.status === 'completed' && '✓ Completado'}
                            {w.status === 'failed' && '❌ Fallido (Reembolsado)'}
                            {w.status === 'rejected' && '⛔ Rechazado'}
                            {w.status === 'cancelled' && '🚫 Cancelado'}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Depósitos */}
                    {financialHistory.deposits.map((d: any) => (
                      <div key={d.id} className="profile-tx-row">
                        <div className="profile-tx-left">
                          <span className="profile-tx-icon">💰</span>
                          <div>
                            <span className="profile-tx-desc">
                              Depósito USDT (+{d.amount_gems} 💎)
                            </span>
                            <span className="profile-tx-date">
                              TX: <a href={`https://bscscan.com/tx/${d.tx_hash}`} target="_blank" rel="noreferrer" className="crypto-tx-link">
                                {d.tx_hash.slice(0, 10)}... ↗
                              </a> • {new Date(d.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="profile-tx-right">
                          <span className="profile-tx-amount profile-tx-amount--pos">
                            +{d.amount_gems} 💎
                          </span>
                          <span className="crypto-tx-badge crypto-tx-badge--completed">
                            ✓ {d.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
