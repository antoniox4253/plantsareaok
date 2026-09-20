import React, { useState, useEffect } from 'react'
import { soundManager } from '../../utils/audioManager'
import {
  ClanManager,
  type ClanData,
  type ClanMember,
  type ClanDonationRequest,
  type ClanDepositLog,
  type KickValidationResult,
} from '../../utils/clanManager'
import type { PlantId, ClanFortressData, ClanFortressMatchOpponent } from '../../types/game'
import { PLANT_CONFIGS } from '../../utils/gameConstants'
import { SeasonManager } from '../../utils/seasonManager'
import { UserManager } from '../../utils/userManager'
import { supabaseService } from '../../services/supabaseService'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { clanChatService, type ClanChatMessage } from '../../services/clanChatService'
import FortressEditor from './FortressEditor'
import FortressDonateModal from './FortressDonateModal'
import GoldIcon from '../Common/GoldIcon'
import './Clan.css'

interface ClanProps {
  userElo: number
  userTokens: number
  userGold?: number
  hasVipPass?: boolean
  plantCopies: Record<PlantId, number>
  onDeductTokens: (amountUsd: number) => boolean
  onAddTokens: (amountUsd: number) => void
  onDeductGold?: (amount: number) => boolean
  onDonatePlant: (plantId: PlantId) => boolean
  onAddPacks: (packId: 'basic', qty: number) => void
  onBackToMenu: () => void
  onRefreshUserData?: () => Promise<void> | void
  onStartClanFortressRaid?: (opponent: ClanFortressMatchOpponent) => void
}

const BADGES = ['👑', '⚡', '🛡️', '🔥', '🌿', '❄️', '💚', '🥊', '🎯', '💀', '💎', '🌸', '🌭']

interface ClanModalDialog {
  title: string
  message: string
  icon: string
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
}

export default function Clan({
  userElo,
  userTokens,
  userGold = 0,
  hasVipPass = false,
  plantCopies,
  onDeductTokens,
  onAddTokens,
  onDeductGold,
  onDonatePlant,
  onAddPacks: _onAddPacks,
  onBackToMenu,
  onRefreshUserData,
  onStartClanFortressRaid,
}: ClanProps) {
  const userGems = Math.floor(userTokens)
  const [userClan, setUserClan] = useState<ClanData | null>(() => {
    const c = ClanManager.getUserClan()
    return c && ClanManager.isValidUuid(c.id) ? c : null
  })
  const [allClans, setAllClans] = useState<ClanData[]>(() => ClanManager.getClans())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isRefreshingRef = React.useRef(false)
  const [activeTab, setActiveTab] = useState<'members' | 'wars' | 'donations' | 'rewards' | 'fortress'>('members')
  const [noClanTab, setNoClanTab] = useState<'browse' | 'create'>('browse')
  const [selectedBrowseClanId, setSelectedBrowseClanId] = useState<string>(() => allClans[0]?.id || '')

  // Fortress State
  const [fortressData, setFortressData] = useState<ClanFortressData | null>(null)
  const [isLoadingFortress, setIsLoadingFortress] = useState(false)
  const [showFortressEditor, setShowFortressEditor] = useState(false)
  const [showFortressDonateModal, setShowFortressDonateModal] = useState(false)
  const [isSearchingRaid, setIsSearchingRaid] = useState(false)
  // Fortress SubView State ('hub' | 'bastion' | 'tree' | 'defenses')
  const [fortressSubView, setFortressSubView] = useState<'hub' | 'bastion' | 'tree' | 'defenses'>('hub')

  // Mother Tree Contribution Modal State
  const [showMotherTreeModal, setShowMotherTreeModal] = useState(false)
  const [isSubmittingTree, setIsSubmittingTree] = useState(false)
  const [motherTreeWaterInput, setMotherTreeWaterInput] = useState<number>(0)
  const [motherTreeFertInput, setMotherTreeFertInput] = useState<number>(0)
  const [motherTreeGemsInput, setMotherTreeGemsInput] = useState<number>(0)
  const [userFarmingInv, setUserFarmingInv] = useState<{ water: number; fertilizer: number }>({ water: 0, fertilizer: 0 })

  // Member Role Assignment Modal State
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)
  const [selectedMemberForRole, setSelectedMemberForRole] = useState<ClanMember | null>(null)
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<'leader' | 'coleader' | 'elder' | 'member'>('member')

  // Mini Sub-tabs state
  const [donationSubTab, setDonationSubTab] = useState<'seeds' | 'deposits'>('seeds')
  const [vaultRankingFilter, setVaultRankingFilter] = useState<'gems' | 'gold'>('gems')

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showGoldDepositModal, setShowGoldDepositModal] = useState(false)
  const [showRequestSeedModal, setShowRequestSeedModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState<number>(100)
  const [goldDepositAmount, setGoldDepositAmount] = useState<number>(1000)
  const [activeDialog, setActiveDialog] = useState<ClanModalDialog | null>(null)

  // Kick Member Modal State
  const [selectedMemberToKick, setSelectedMemberToKick] = useState<ClanMember | null>(null)
  const [kickValidation, setKickValidation] = useState<KickValidationResult | null>(null)
  const [showKickModal, setShowKickModal] = useState(false)

  // Clan Settings State
  const [settingsTab, setSettingsTab] = useState<'general' | 'competitive' | 'rewards' | 'roles'>('general')
  const [memberRewardShares, setMemberRewardShares] = useState<Record<string, number>>({})
  const [clanPrivacy, setClanPrivacy] = useState<'public' | 'request' | 'closed'>('public')
  const [clanMinElo, setClanMinElo] = useState<number>(1000)
  const [clanWarPermission, setClanWarPermission] = useState<'leaders' | 'all'>('leaders')
  const [clanAutoAccept, setClanAutoAccept] = useState<boolean>(true)
  const [pendingRequests, setPendingRequests] = useState<any[]>([])

  // Direct Clan Invitation Modal State (Solo Líder)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteTargetUsername, setInviteTargetUsername] = useState('')
  const [isSendingInvite, setIsSendingInvite] = useState(false)

  // Creation form state
  const [newClanName, setNewClanName] = useState('')
  const [newClanTag, setNewClanTag] = useState('')
  const [newClanBadge, setNewClanBadge] = useState('👑')
  const [newClanDesc, setNewClanDesc] = useState('')

  // Selected plant for seed request
  const [selectedRequestPlant, setSelectedRequestPlant] = useState<PlantId>('peashooter')

  // Active donations & vault logs
  const [donationRequests, setDonationRequests] = useState<ClanDonationRequest[]>([])
  const [vaultDeposits, setVaultDeposits] = useState<ClanDepositLog[]>([])

  // Floating Clan Chat State & Realtime
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ClanChatMessage[]>(() => {
    const c = ClanManager.getUserClan()
    return c?.id ? clanChatService.getLocalMessages(c.id) : []
  })
  const chatEndRef = React.useRef<HTMLDivElement>(null)

  const playerName = UserManager.getProfile().name || 'Guerrero'
  const myMember = userClan?.members.find(
    (m) => m.name?.trim().toLowerCase() === playerName?.trim().toLowerCase()
  )
  const isLeader = Boolean(
    userClan &&
    (userClan.leader?.trim().toLowerCase() === playerName?.trim().toLowerCase() ||
     myMember?.role === 'Líder' ||
     (userClan.leaderId && myMember?.id && userClan.leaderId === myMember.id))
  )

  const myRole = isLeader ? 'Líder' : (myMember?.role || 'Miembro')
  const isOfficer = isLeader || myRole === 'Colíder' || myRole === 'Veterano'

  const fetchFortressData = React.useCallback(async (clanId?: string) => {
    const targetClanId = clanId || userClan?.id
    if (!targetClanId || !ClanManager.isValidUuid(targetClanId)) return
    setIsLoadingFortress(true)
    try {
      const res = await supabaseService.getClanFortress(targetClanId)
      if (res.success && res.data) {
        setFortressData(res.data)
      }
    } catch (e) {
      console.error('Error fetching clan fortress:', e)
    } finally {
      setIsLoadingFortress(false)
    }
  }, [userClan?.id])

  useEffect(() => {
    if (userClan?.id) {
      void fetchFortressData(userClan.id)
    }
  }, [activeTab, userClan?.id, fetchFortressData])

  const handleRepairBase = async () => {
    setActiveDialog({
      title: 'Reparar Bastión',
      message: '¿Deseas invertir 500 Gemas para restaurar la salud de la base del clan a 500 HP?',
      icon: '🔧',
      type: 'confirm',
      confirmText: 'REPARAR (500 💎)',
      cancelText: 'CANCELAR',
      onConfirm: async () => {
        const res = await supabaseService.repairClanBase()
        if (res.success) {
          soundManager.playSound('click', 0.6)
          await fetchFortressData()
          if (onRefreshUserData) await onRefreshUserData()
        } else {
          setActiveDialog({
            title: 'Error de Reparación',
            message: res.error || 'No tienes suficientes gemas o ocurrió un error.',
            icon: '⚠️',
            type: 'error',
          })
        }
      },
    })
  }

  const handleOpenMotherTreeModal = async () => {
    soundManager.playSound('click', 0.4)
    let w = 0
    let f = 0
    try {
      const raw = localStorage.getItem('plant_arena_farming_inventory')
      if (raw) {
        const parsed = JSON.parse(raw)
        w = Number(parsed.water || 0)
        f = Number(parsed.fertilizer || 0)
      }
      const remote = await supabaseService.myFarmingInventory()
      if (remote) {
        w = Number(remote.water || w)
        f = Number(remote.fertilizer || f)
      }
    } catch {}
    setUserFarmingInv({ water: w, fertilizer: f })
    const neededWater = Math.max(0, (fortressData?.nextTreeWaterReq || 150) - (fortressData?.motherTreeWater || 0))
    const neededFert = Math.max(0, (fortressData?.nextTreeFertReq || 100) - (fortressData?.motherTreeFertilizer || 0))
    const neededGems = Math.max(0, (fortressData?.nextTreeGemsReq || 600) - (fortressData?.motherTreeGems || 0))

    setMotherTreeWaterInput(Math.min(w, neededWater))
    setMotherTreeFertInput(Math.min(f, neededFert))
    setMotherTreeGemsInput(Math.min(userGems, neededGems))
    setShowMotherTreeModal(true)
  }

  const handleContributeMotherTree = async () => {
    if (motherTreeWaterInput <= 0 && motherTreeFertInput <= 0 && motherTreeGemsInput <= 0) {
      showModalAlert('SIN RECURSOS', 'Indica al menos una cantidad de Agua, Fertilizante o Gemas para aportar.', '⚠️', 'warning')
      return
    }
    setIsSubmittingTree(true)
    try {
      const res = await supabaseService.contributeClanMotherTree(motherTreeWaterInput, motherTreeFertInput, motherTreeGemsInput)
      if (!res.success) {
        showModalAlert('ERROR AL NUTRIR', res.error || 'No se pudo realizar el aporte.', '❌', 'error')
        return
      }
      soundManager.playSound('click', 0.6)
      if (res.leveledUp) {
        soundManager.playSound('click', 0.8)
        showModalAlert('¡ÁRBOL MADRE SUBIÓ DE NIVEL!', `¡El Árbol Madre del Clan ha alcanzado el NIVEL ${res.newTreeLevel}!\n\nSalud Máxima de la Base: ${res.newBaseHp} HP\nPresupuesto Máximo de Soles: ${res.maxBudget} ☀️`, '🌳', 'success')
      } else {
        showModalAlert('APORTE REGISTRADO', 'Los recursos han sido consagrados al Árbol Madre del Clan.', '🌱', 'success')
      }
      setShowMotherTreeModal(false)
      await fetchFortressData()
      if (onRefreshUserData) await onRefreshUserData()
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Error de conexión', '⚠️', 'error')
    } finally {
      setIsSubmittingTree(false)
    }
  }

  const handleOpenRoleModal = (member: ClanMember) => {
    soundManager.playSound('click', 0.4)
    setSelectedMemberForRole(member)
    const roleKey = member.role === 'Colíder' ? 'coleader' : member.role === 'Veterano' ? 'elder' : member.role === 'Líder' ? 'leader' : 'member'
    setSelectedRoleToAssign(roleKey)
    setShowRoleModal(true)
  }

  const handleConfirmChangeRole = async () => {
    if (!selectedMemberForRole || !selectedRoleToAssign) return
    soundManager.playSound('click', 0.5)
    setIsSubmittingRole(true)
    try {
      const res = await supabaseService.setClanMemberRole(selectedMemberForRole.id, selectedRoleToAssign)
      if (!res.success) {
        showModalAlert('ERROR AL ASIGNAR ROL', res.error || 'No se pudo cambiar el rol.', '❌', 'error')
        return
      }
      soundManager.playSound('click', 0.7)
      setShowRoleModal(false)
      const roleDisplayName = selectedRoleToAssign === 'coleader' ? 'Colíder' : selectedRoleToAssign === 'elder' ? 'Veterano' : selectedRoleToAssign === 'leader' ? 'Líder' : 'Miembro'
      showModalAlert('ROL ACTUALIZADO', `Se ha asignado el rango de ${roleDisplayName} a ${selectedMemberForRole.name}.`, '👑', 'success')
      setSelectedMemberForRole(null)
      await refreshClanData()
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Error de conexión', '⚠️', 'error')
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleSearchFortressRaid = async () => {
    if (!onStartClanFortressRaid) {
      setActiveDialog({
        title: 'Asalto a Fortaleza',
        message: 'Modo de combate no disponible actualmente.',
        icon: '⚔️',
        type: 'warning',
      })
      return
    }

    if (isOfficer) {
      const clanGold = userClan?.vaultGold ?? fortressData?.vaultGold ?? 0
      if (clanGold < 500) {
        setActiveDialog({
          title: 'Oro del Clan Insuficiente',
          message: 'Se requieren 500 monedas de Oro en el Tesoro del Clan para buscar un asalto como Oficial/Líder.',
          icon: '🪙',
          type: 'warning',
        })
        return
      }
    } else {
      if ((userGold || 0) < 250) {
        setActiveDialog({
          title: 'Oro Insuficiente',
          message: 'Se requieren 250 monedas de tu Oro personal para buscar un asalto.',
          icon: '🪙',
          type: 'warning',
        })
        return
      }
    }

    setIsSearchingRaid(true)
    soundManager.playSound('click', 0.5)

    try {
      const res = await supabaseService.searchClanFortressMatch()
      if (!res.success || !res.data) {
        setIsSearchingRaid(false)
        const errMsg = res.error || 'No se encontró ninguna fortaleza rival disponible.'
        if (errMsg.includes('DEFEAT_COOLDOWN_ACTIVE')) {
          setActiveDialog({
            title: 'Enfriamiento de 24 Horas Activo',
            message: 'Has sufrido una derrota recientemente. Debes esperar 24 horas antes de poder volver a asaltar otra fortaleza.',
            icon: '⏳',
            type: 'error',
          })
        } else {
          setActiveDialog({
            title: 'Búsqueda de Partida',
            message: errMsg,
            icon: '🛡️',
            type: 'warning',
          })
        }
        return
      }

      soundManager.playSound('click', 0.8)
      setIsSearchingRaid(false)
      onStartClanFortressRaid(res.data)
    } catch (e: any) {
      setIsSearchingRaid(false)
      setActiveDialog({
        title: 'Error de Búsqueda',
        message: e?.message || 'Error al conectar con el servidor de emparejamiento.',
        icon: '⚠️',
        type: 'error',
      })
    }
  }

  const [isClaimingFullBonus, setIsClaimingFullBonus] = useState(false)
  const [hasClaimedRemoteBonus, setHasClaimedRemoteBonus] = useState(false)

  // Sincronizar estado autoritativo del bono de clan desde el perfil del usuario
  useEffect(() => {
    let mounted = true
    const checkClaimStatus = async () => {
      if (!isSupabaseConfigured()) return
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: prof } = await supabase
          .from('profiles')
          .select('has_claimed_clan_full_bonus')
          .eq('id', user.id)
          .maybeSingle()

        if (mounted && (prof as any)?.has_claimed_clan_full_bonus) {
          setHasClaimedRemoteBonus(true)
        }
      } catch {}
    }
    void checkClaimStatus()
    return () => {
      mounted = false
    }
  }, [userClan?.id])

  React.useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatOpen])

  useEffect(() => {
    if (!userClan?.id) return
    let isMounted = true

    const local = clanChatService.getLocalMessages(userClan.id)
    if (local.length > 0) {
      setChatMessages(local)
    }

    clanChatService.fetchRecentMessages(userClan.id).then((history) => {
      if (isMounted && history.length > 0) {
        setChatMessages(history)
      }
    })

    const unsubscribe = clanChatService.subscribeToClanChat(userClan.id, (newMsg) => {
      if (!isMounted) return
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [userClan?.id])

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !userClan?.id) return
    const text = chatInput.trim()
    setChatInput('')
    soundManager.playSound('click', 0.5)

    const role = isLeader
      ? 'Líder'
      : userClan.members.find((m) => m.name === playerName)?.role || 'Miembro'

    const res = await clanChatService.sendMessage({
      clanId: userClan.id,
      sender: playerName,
      role,
      text,
      hasVip: hasVipPass,
    })

    if (res?.messageObj) {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === res.messageObj.id)) return prev
        return [...prev, res.messageObj]
      })
    }
  }

  const showModalAlert = (
    title: string,
    message: string,
    icon = 'ℹ️',
    type: 'info' | 'success' | 'warning' | 'error' = 'info'
  ) => {
    setActiveDialog({ title, message, icon, type, confirmText: 'ENTENDIDO' })
  }

  const showModalConfirm = (
    title: string,
    message: string,
    icon: string,
    onConfirm: () => void,
    confirmText = 'CONFIRMAR',
    cancelText = 'CANCELAR'
  ) => {
    setActiveDialog({
      title,
      message,
      icon,
      type: 'confirm',
      confirmText,
      cancelText,
      onConfirm,
    })
  }

  const renderCustomDialog = () => {
    if (!activeDialog) return null
    return (
      <div className="clan-dialog-backdrop" onClick={() => activeDialog.type !== 'confirm' && setActiveDialog(null)}>
        <div
          className={`clan-dialog-card clan-dialog-card--${activeDialog.type}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="clan-dialog-icon-ring">
            <span className="clan-dialog-icon">{activeDialog.icon}</span>
          </div>
          <h3 className="clan-dialog-title">{activeDialog.title}</h3>
          <p className="clan-dialog-msg">{activeDialog.message}</p>

          <div className="clan-dialog-actions">
            {activeDialog.type === 'confirm' && (
              <button
                type="button"
                className="clan-dialog-btn clan-dialog-btn--cancel"
                onClick={() => setActiveDialog(null)}
              >
                {activeDialog.cancelText || 'CANCELAR'}
              </button>
            )}
            <button
              type="button"
              className="clan-dialog-btn clan-dialog-btn--confirm"
              onClick={() => {
                const confirmCb = activeDialog.onConfirm
                setActiveDialog(null)
                if (confirmCb) {
                  confirmCb()
                }
              }}
            >
              {activeDialog.confirmText || 'ENTENDIDO'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const refreshClanData = async (isInitial = false, showSpinner = false) => {
    if (isRefreshingRef.current) return
    isRefreshingRef.current = true
    if (showSpinner) setIsRefreshing(true)

    // 1. Estado local inmediato para fluidez de UI solo en el montaje inicial
    if (isInitial) {
      const updated = ClanManager.getUserClan()
      if (updated && !ClanManager.isValidUuid(updated.id)) {
        ClanManager.setUserClanId(null)
        setUserClan(null)
      } else if (updated) {
        setUserClan(updated)
      }
      setAllClans(ClanManager.getClans())
      if (updated && ClanManager.isValidUuid(updated.id)) {
        setDonationRequests(ClanManager.getDonationRequests(updated.id))
        setVaultDeposits(ClanManager.getVaultDeposits(updated.id))
        if (updated.settings) {
          setClanPrivacy(updated.settings.privacy)
          setClanMinElo(updated.settings.minElo)
          setClanWarPermission(updated.settings.warPermission)
          setClanAutoAccept(updated.settings.autoAccept)
        }
        setPendingRequests(ClanManager.getJoinRequests(updated.id).filter((r) => r.status === 'pending'))
      }
    }

    // 2. Consulta autoritativa en Supabase (Backend)
    try {
      const [remoteList, myClanData] = await Promise.all([
        supabaseService.getClansList(),
        supabaseService.getMyClanDetails(),
      ])

      if (myClanData && myClanData.clan && ClanManager.isValidUuid(myClanData.clan.id)) {
        const clanObj: ClanData = {
          id: myClanData.clan.id,
          name: myClanData.clan.name,
          tag: myClanData.clan.tag,
          badge: myClanData.clan.badge || '👑',
          description: myClanData.clan.description || '',
          leader: myClanData.clan.leader || 'Líder',
          leaderId: myClanData.clan.leaderId,
          members: (myClanData.members || []).map((m: any) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            elo: m.elo,
            donatedCount: m.donatedCount || 0,
            joinedAt: typeof m.joinedAt === 'string' ? m.joinedAt.split('T')[0] : '',
            rewardPercentage: typeof m.rewardPercentage === 'number' ? m.rewardPercentage : undefined,
          })),
          vaultGems: Number(myClanData.clan.vaultGems || 0),
          vaultUsd: Number(myClanData.clan.vaultGems || 0),
          vaultGold: Number(myClanData.clan.vaultGold || 0),
          status: myClanData.clan.status || 'active',
          wins: Number(myClanData.clan.wins || 0),
          losses: Number(myClanData.clan.losses || 0),
          createdAt: typeof myClanData.clan.createdAt === 'string' ? myClanData.clan.createdAt.split('T')[0] : '',
          fullBonusClaimedMembers: [],
          seasonPayoutClaimedMembers: [],
          settings: myClanData.clan.settings,
          rewardShares: myClanData.clan.rewardShares,
          maxMembers: myClanData.clan.maxMembers || 15,
        }
        setUserClan(clanObj)
        ClanManager.setUserClanId(clanObj.id)

        // Mantener el caché local de clanes actualizado en ClanManager
        const localClans = ClanManager.getClans()
        const existingIdx = localClans.findIndex((c) => c.id === clanObj.id)
        if (existingIdx >= 0) {
          localClans[existingIdx] = clanObj
        } else {
          localClans.unshift(clanObj)
        }
        ClanManager.saveClans(localClans)

        if (myClanData.clan.settings) {
          setClanPrivacy(myClanData.clan.settings.privacy || 'public')
          setClanMinElo(typeof myClanData.clan.settings.minElo === 'number' ? myClanData.clan.settings.minElo : 0)
          setClanWarPermission(myClanData.clan.settings.warPermission || 'leaders')
          setClanAutoAccept(myClanData.clan.settings.autoAccept !== false)
        }

        if (myClanData.requests) {
          setPendingRequests(myClanData.requests)
        }

        if (myClanData.donations) {
          setDonationRequests(myClanData.donations.map((d: any) => ({
            id: d.id,
            requesterId: d.requesterId,
            requesterName: d.requesterName,
            plantId: d.plantId,
            plantName: PLANT_CONFIGS[d.plantId as PlantId]?.name || d.plantId,
            plantIcon: PLANT_CONFIGS[d.plantId as PlantId]?.packetActive || PLANT_CONFIGS[d.plantId as PlantId]?.icon || '',
            copiesRequested: d.copiesRequested || 1,
            copiesReceived: typeof d.copiesReceived === 'number' ? d.copiesReceived : (d.donors || []).length,
            donors: (d.donors || []).map((dn: any) => ({ donorId: dn.donorId, donorName: dn.donorName })),
            createdAt: new Date(d.createdAt).getTime(),
          })))
        }

        if (myClanData.deposits) {
          setVaultDeposits(
            myClanData.deposits
              .filter(
                (dep: any) =>
                  dep.reason !== 'fund' &&
                  dep.action !== 'CREATE' &&
                  dep.action !== 'VAULT_CORRECTION' &&
                  dep.depositorName?.toLowerCase() !== 'sistema' &&
                  dep.depositorName !== 'Fundador'
              )
              .map((dep: any) => ({
                id: dep.id,
                clanId: dep.clanId,
                depositorName: dep.depositorName,
                amountUsd: Number(dep.amountGems || dep.amountGold || 0),
                amountGems: Number(dep.amountGems || 0),
                amountGold: Number(dep.amountGold || 0),
                currency: dep.currency || (dep.action === 'DEPOSIT_GOLD' ? 'gold' : 'gems'),
                timestamp: new Date(dep.timestamp).getTime(),
                reason: dep.reason,
                action: dep.action,
              }))
          )
        }
      } else {
        // En Supabase el usuario no pertenece a ningún clan
        setUserClan(null)
        ClanManager.setUserClanId(null)
      }

      if (remoteList && Array.isArray(remoteList)) {
        const mappedList: ClanData[] = remoteList
          .filter((c: any) => ClanManager.isValidUuid(c?.id))
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            tag: c.tag,
            badge: c.badge || '👑',
            description: c.description || '',
            leader: c.leader || 'Líder',
            members: Array.isArray(c.members) && c.members.length > 0
              ? c.members.map((m: any, idx: number) => ({
                  id: m.id || `mem-${idx}`,
                  name: m.name || 'Guerrero',
                  role: m.role || (idx === 0 ? 'Líder' : 'Miembro'),
                  elo: Number(m.elo || 1000),
                  donatedCount: Number(m.donatedCount || 0),
                  joinedAt: typeof m.joinedAt === 'string' ? m.joinedAt.split('T')[0] : '',
                  rewardPercentage: typeof m.rewardPercentage === 'number' ? m.rewardPercentage : undefined,
                }))
              : Array(c.member_count || 1).fill({}).map((_, i) => ({
                  id: `mem-${i}`,
                  name: i === 0 ? c.leader : `Miembro ${i + 1}`,
                  role: i === 0 ? 'Líder' : 'Miembro',
                  elo: 1000,
                  donatedCount: 0,
                  joinedAt: '',
                })),
            vaultGems: Number(c.vaultGems || 0),
            vaultUsd: Number(c.vaultGems || 0),
            status: c.status || 'active',
            wins: Number(c.wins || 0),
            losses: Number(c.losses || 0),
            createdAt: typeof c.created_at === 'string' ? c.created_at.split('T')[0] : '',
            fullBonusClaimedMembers: [],
            seasonPayoutClaimedMembers: [],
            settings: c.settings,
          }))
        setAllClans(mappedList)
        ClanManager.saveClans(mappedList)
      }
    } catch (err) {
      console.warn('Error fetching remote clans:', err)
    } finally {
      isRefreshingRef.current = false
      if (showSpinner) {
        setTimeout(() => setIsRefreshing(false), 300)
      }
    }
  }

  // 1. Carga inicial y sondeo periódico continuo cada 3 segundos para reflejar nuevos ingresos inmediatamente
  useEffect(() => {
    void refreshClanData(true, false)

    const pollTimer = setInterval(() => {
      void refreshClanData(false, false)
    }, 3000)

    const onFocus = () => {
      void refreshClanData(false, false)
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(pollTimer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  // 2. Suscripción en tiempo real vía WebSocket con Supabase Realtime
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const channel = supabase
      .channel('clan-realtime-live-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clan_members' },
        () => {
          void refreshClanData(false, false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clan_join_requests' },
        () => {
          void refreshClanData(false, false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clans' },
        () => {
          void refreshClanData(false, false)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clan_deposits' },
        () => {
          void refreshClanData(false, false)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  // Open Settings Modal & Load Saved Settings (Exclusivo Líder)
  const handleOpenSettings = () => {
    if (!isLeader) {
      soundManager.playSound('surrender', 0.5)
      showModalAlert('ACCESO RESTRINGIDO', 'Solo el Líder del clan puede acceder a la configuración y ajuste de recompensas.', '🔒', 'warning')
      return
    }
    soundManager.playSound('click', 0.4)
    if (userClan?.settings) {
      setClanPrivacy(userClan.settings.privacy || 'public')
      setClanMinElo(typeof userClan.settings.minElo === 'number' ? userClan.settings.minElo : 0)
      setClanWarPermission(userClan.settings.warPermission || 'leaders')
      setClanAutoAccept(userClan.settings.autoAccept !== false)
    }

    // Inicializar mapa de porcentajes de miembros
    if (userClan?.members) {
      const shares: Record<string, number> = {}
      const hasAnyConfigured = userClan.members.some((m) => typeof m.rewardPercentage === 'number' && m.rewardPercentage > 0)
      if (hasAnyConfigured) {
        userClan.members.forEach((m) => {
          shares[m.id] = Number(m.rewardPercentage ?? 0)
        })
      } else {
        const count = Math.max(1, userClan.members.length)
        const baseShare = Math.floor(100 / count)
        const remainder = 100 - baseShare * count
        userClan.members.forEach((m, idx) => {
          shares[m.id] = idx === 0 ? baseShare + remainder : baseShare
        })
      }
      setMemberRewardShares(shares)
    }

    setSettingsTab('general')
    setShowSettingsModal(true)
  }

  // Save Settings (Con validación autoritativa y balanceo inteligente)
  const handleSaveClanSettings = async () => {
    if (!userClan) return
    if (!isLeader) {
      showModalAlert('ACCESO RESTRINGIDO', 'Solo el Líder del clan puede guardar ajustes.', '🔒', 'warning')
      return
    }

    // Validar suma total del 100% o auto-balancear equitativamente si no está en la pestaña rewards
    const currentShares = { ...memberRewardShares }
    const totalPct = Math.round(
      userClan.members.reduce((sum, m) => sum + (Number(currentShares[m.id]) || 0), 0)
    )

    if (totalPct !== 100) {
      if (settingsTab !== 'rewards' || userClan.members.length === 1) {
        const count = Math.max(1, userClan.members.length)
        const baseShare = Math.floor(100 / count)
        const remainder = 100 - baseShare * count
        userClan.members.forEach((m, idx) => {
          currentShares[m.id] = idx === 0 ? baseShare + remainder : baseShare
        })
        setMemberRewardShares(currentShares)
      } else {
        soundManager.playSound('surrender', 0.6)
        showModalAlert(
          'REPARTO INVÁLIDO (DEBE SUMAR 100%)',
          `La suma de los porcentajes asignados a los miembros debe ser exactamente 100%.\n\n` +
            `Actualmente suma: ${totalPct}% (${totalPct < 100 ? `Falta asignar ${100 - totalPct}%` : `Excede por ${totalPct - 100}%`}).\n\n` +
            'Ajusta las cuotas en la pestaña "REWARDS" o pulsa "⚖️ Repartir Equitativo" antes de guardar.',
          '⚠️',
          'warning'
        )
        return
      }
    }

    soundManager.playSound('plantation', 0.8)

    // 1. Guardar ajustes y cuotas localmente
    const newSettings = {
      privacy: clanPrivacy,
      minElo: clanMinElo,
      warPermission: clanWarPermission,
      autoAccept: clanAutoAccept,
    }
    ClanManager.updateClanSettings(userClan.id, newSettings)
    ClanManager.updateClanRewardShares(userClan.id, currentShares)

    setUserClan((prev) => prev ? {
      ...prev,
      settings: newSettings,
      rewardShares: currentShares,
    } : null)

    // 2. Persistir en Backend autoritativo en Supabase
    if (ClanManager.isValidUuid(userClan.id)) {
      // 2a. Guardar ajustes de admisión y competitivos
      const settingsRes = await supabaseService.updateClanSettings(userClan.id, newSettings)
      if (!settingsRes.success) {
        showModalAlert('ERROR EN AJUSTES', settingsRes.message || settingsRes.error || 'No se pudieron guardar los ajustes del clan en el servidor.', '❌', 'error')
        return
      }

      // 2b. Guardar distribución porcentual de ganancias
      const sharesPayload = userClan.members.map((m) => ({
        user_id: m.id,
        percentage: Number(currentShares[m.id]) || 0,
      }))
      const res = await supabaseService.updateClanRewardShares(userClan.id, sharesPayload)
      if (!res.success) {
        showModalAlert('ERROR EN RECOMPENSAS', res.message || res.error || 'No se pudieron guardar las cuotas en el servidor.', '❌', 'error')
        return
      }
    }

    await refreshClanData()
    setShowSettingsModal(false)
    showModalAlert(
      'AJUSTES ACTUALIZADOS',
      'Las reglas de admisión, privacidad, permisos competitivos y cuotas de recompensas se han guardado con éxito.',
      '⚙️',
      'success'
    )
  }

  // Open Kick Member Dialog
  const handleOpenKickDialog = (member: ClanMember) => {
    if (!userClan) return
    soundManager.playSound('click', 0.5)
    const result = ClanManager.validateKickMember(userClan, member)
    setSelectedMemberToKick(member)
    setKickValidation(result)
    setShowKickModal(true)
  }

  // Execute Kick Action
  const handleExecuteKick = async () => {
    if (!userClan || !selectedMemberToKick || !kickValidation?.canKick) return
    soundManager.playSound('surrender', 0.6)

    if (ClanManager.isValidUuid(userClan.id)) {
      const serverRes = await supabaseService.kickClanMember(userClan.id, selectedMemberToKick.id)
      if (!serverRes.success) {
        showModalAlert('ERROR AL EXPULSAR', serverRes.message || serverRes.error || 'No se pudo expulsar al miembro en el servidor.', '❌', 'error')
        return
      }
    }

    ClanManager.kickMember(userClan.id, selectedMemberToKick.id)
    await refreshClanData()
    setShowKickModal(false)
    showModalAlert(
      'MIEMBRO EXPULSADO',
      `El jugador "${selectedMemberToKick.name}" ha sido expulsado del clan.\nLa vacante ha quedado liberada.`,
      '👢',
      'success'
    )
    setSelectedMemberToKick(null)
    setKickValidation(null)
  }

  // SEND DIRECT INVITATION (Solo Líder)
  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userClan) return
    const target = inviteTargetUsername.trim()
    if (!target) {
      showModalAlert('CAMPO REQUERIDO', 'Ingresa el nombre de usuario del jugador a invitar.', '⚠️', 'warning')
      return
    }
    if (target.toLowerCase() === playerName.toLowerCase()) {
      showModalAlert('ERROR', 'No puedes invitarte a ti mismo.', '⚠️', 'warning')
      return
    }
    const maxMembers = fortressData?.maxMembers || 15
    if (userClan.members.length >= maxMembers) {
      showModalAlert('CLAN LLENO', `El clan ya alcanzó el cupo máximo de ${maxMembers} miembros.`, '⚠️', 'warning')
      return
    }

    setIsSendingInvite(true)
    try {
      if (ClanManager.isValidUuid(userClan.id)) {
        const res = await supabaseService.sendClanInvitation(userClan.id, target)
        if (!res.success) {
          showModalAlert('NO SE PUDO ENVIAR', res.message || res.error || 'Error al enviar invitación.', '❌', 'error')
          setIsSendingInvite(false)
          return
        }
      } else {
        const res = ClanManager.sendClanInvitation(userClan.id, target, playerName)
        if (!res.success) {
          showModalAlert('NO SE PUDO ENVIAR', res.error || 'Error al enviar invitación.', '❌', 'error')
          setIsSendingInvite(false)
          return
        }
      }

      soundManager.playSound('plantation', 0.8)
      showModalAlert(
        '¡INVITACIÓN ENVIADA!',
        `Se ha enviado la invitación directa a "${target}".\nAl jugador le aparecerá un pop-up en su Lobby para unirse por 200 Gemas 💎.`,
        '✉️',
        'success'
      )
      setInviteTargetUsername('')
      setShowInviteModal(false)
    } catch (err: any) {
      showModalAlert('ERROR', err?.message || 'Error de conexión al enviar invitación.', '❌', 'error')
    } finally {
      setIsSendingInvite(false)
    }
  }

  // CREATE CLAN (500 Gemas 💎)
  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClanName.trim() || !newClanTag.trim()) {
      showModalAlert('DATOS INCOMPLETOS', 'Ingresa un nombre y etiqueta válidos para el clan.', '⚠️', 'warning')
      return
    }
    if (userTokens < 500.0) {
      showModalAlert('SALDO INSUFICIENTE', 'Saldo insuficiente (500 Gemas 💎 requeridas). Recarga saldo en la Tienda.', '⚠️', 'warning')
      return
    }

    try {
      const res = await supabaseService.createClan(newClanName, newClanTag, newClanBadge, newClanDesc)
      if (!res.success) {
        if (res.error === 'INSUFFICIENT_GEMS') {
          showModalAlert('SALDO INSUFICIENTE', 'Saldo insuficiente (500 Gemas 💎 requeridas).', '⚠️', 'warning')
        } else if (res.error === 'ALREADY_IN_CLAN') {
          showModalAlert('YA TIENES UN CLAN', 'Ya perteneces a un clan. Debes abandonarlo antes de fundar uno nuevo.', '⚠️', 'warning')
        } else if (res.error === 'CLAN_NAME_OR_TAG_ALREADY_EXISTS') {
          showModalAlert('NOMBRE O TAG EN USO', 'Ya existe un clan activo con ese nombre o etiqueta (#tag). Elige otro.', '⚠️', 'warning')
        } else {
          showModalAlert('ERROR AL CREAR CLAN', res.error || 'No se pudo fundar el clan en el servidor.', '❌', 'error')
        }
        return
      }

      onDeductTokens(500.0)
      if (onRefreshUserData) void onRefreshUserData()

      soundManager.playSound('victory', 0.8)
      showModalAlert(
        '¡CLAN CREADO!',
        `¡El clan "${newClanName.trim().toUpperCase()}" ha sido fundado con éxito!\nSe descontaron 500 Gemas 💎 como tasa de registro.\nEl Tesoro del clan inicia en 0 Gemas 💎 y crecerá con las cuotas de ingreso (200 💎) de los miembros que se unan.`,
        '🎉',
        'success'
      )
      if (res.clan_id) {
        ClanManager.setUserClanId(res.clan_id)
      }
      await refreshClanData()
      setNoClanTab('browse')
    } catch (err: any) {
      showModalAlert('ERROR', err?.message || 'Error al conectar con el servidor.', '❌', 'error')
    }
  }

  // RESPOND JOIN REQUEST (Líder Acepta o Rechaza)
  const handleRespondRequest = async (requestId: string, accept: boolean, applicantName: string) => {
    if (!userClan || !isLeader) return
    soundManager.playSound('click', 0.4)
    try {
      if (!ClanManager.isValidUuid(userClan.id)) {
        const res = ClanManager.respondJoinRequest(userClan.id, requestId, accept)
        if (res.success) {
          showModalAlert(
            accept ? '¡JUGADOR ACEPTADO!' : 'SOLICITUD RECHAZADA',
            accept
              ? `"${applicantName}" se ha unido al clan. Se han transferido +200 Gemas 💎 al Tesoro.`
              : `Has rechazado la solicitud de "${applicantName}".`,
            accept ? '🎉' : 'ℹ️',
            accept ? 'success' : 'info'
          )
          await refreshClanData()
        } else {
          showModalAlert('ERROR', res.error || 'No se pudo procesar la solicitud.', '❌', 'error')
        }
        return
      }

      const res = await supabaseService.respondClanJoinRequest(requestId, accept)
      if (!res.success) {
        showModalAlert('ERROR', res.message || res.error || 'No se pudo procesar la solicitud en el servidor.', '❌', 'error')
        return
      }

      showModalAlert(
        accept ? '¡JUGADOR ACEPTADO!' : 'SOLICITUD RECHAZADA',
        accept
          ? `"${applicantName}" se ha unido al clan. Se han transferido +200 Gemas 💎 al Tesoro.`
          : `Has rechazado la solicitud de "${applicantName}".`,
        accept ? '🎉' : 'ℹ️',
        accept ? 'success' : 'info'
      )
      await refreshClanData()
    } catch (err: any) {
      showModalAlert('ERROR', err?.message || 'Error al procesar la solicitud.', '❌', 'error')
    }
  }

  // JOIN CLAN (200 Gemas 💎)
  const handleJoinClan = (clan: ClanData) => {
    if (!ClanManager.isValidUuid(clan.id)) {
      showModalAlert('CLAN NO VÁLIDO', 'Este clan no existe en el servidor.', '⚠️', 'warning')
      return
    }
    const clanMaxMembers = clan.maxMembers || 15
    if (clan.members.length >= clanMaxMembers) {
      showModalAlert('CLAN LLENO', `Este clan ya ha alcanzado el límite máximo de ${clanMaxMembers}/${clanMaxMembers} miembros.`, '⚠️', 'warning')
      return
    }
    if (clan.settings?.privacy === 'closed') {
      showModalAlert('CLAN CERRADO', 'Este clan tiene la admisión cerrada (solo accesible mediante invitación directa del Líder).', '🔒', 'warning')
      return
    }
    if (clan.settings?.minElo && userElo < clan.settings.minElo) {
      showModalAlert(
        'COPAS INSUFICIENTES',
        `Este clan requiere un mínimo de ${clan.settings.minElo} copas ELO. Tu puntaje actual es de ${userElo} copas.`,
        '🏆',
        'warning'
      )
      return
    }
    if (userTokens < 200.0) {
      showModalAlert(
        'SALDO INSUFICIENTE',
        `Saldo insuficiente (200 Gemas 💎 requeridas para ingresar al clan).\nTu saldo actual es de ${userGems} Gemas 💎.\nPor favor recarga saldo en la Tienda.`,
        '⚠️',
        'warning'
      )
      return
    }

    const isRequestMode = clan.settings?.privacy === 'request' && clan.settings?.autoAccept === false

    if (isRequestMode) {
      showModalConfirm(
        'SOLICITAR INGRESO AL CLAN',
        `¿Deseas enviar una solicitud de ingreso a "${clan.name}"?\n\nTu puntaje: ${userElo} Copas ELO (Mínimo requerido: ${clan.settings?.minElo || 0}).\nEl Líder del clan revisará tu solicitud. Al ser aceptado, se transferirán 200 Gemas 💎 al Tesoro.`,
        '📝',
        async () => {
          try {
            if (!ClanManager.isValidUuid(clan.id)) {
              const res = ClanManager.requestJoinClan(clan.id, playerName, userElo)
              if (res.success) {
                soundManager.playSound('plantation', 0.8)
                showModalAlert('SOLICITUD ENVIADA', `Tu solicitud de ingreso fue enviada al Líder de "${clan.name}".`, '📨', 'success')
                await refreshClanData()
              } else {
                showModalAlert('ERROR', res.error || 'No se pudo enviar la solicitud.', '⚠️', 'warning')
              }
              return
            }

            const res = await supabaseService.requestJoinClan(clan.id)
            if (!res.success) {
              if (res.error === 'REQUEST_ALREADY_PENDING') {
                showModalAlert('SOLICITUD EN CURSO', 'Ya tienes una solicitud de ingreso pendiente en este clan.', '⏳', 'warning')
              } else {
                showModalAlert('ERROR AL SOLICITAR', res.message || res.error || 'No se pudo registrar la solicitud.', '❌', 'error')
              }
              return
            }

            soundManager.playSound('plantation', 0.8)
            showModalAlert(
              '¡SOLICITUD ENVIADA!',
              `Tu solicitud de ingreso ha sido enviada al Líder de "${clan.name}".\nTe notificaremos cuando sea revisada.`,
              '📨',
              'success'
            )
            await refreshClanData()
          } catch (err: any) {
            showModalAlert('ERROR', err?.message || 'Error al comunicarse con el servidor.', '❌', 'error')
          }
        },
        'ENVIAR SOLICITUD',
        'CANCELAR'
      )
      return
    }

    showModalConfirm(
      'UNIRSE AL CLAN',
      `¿Deseas pagar 200 Gemas 💎 de entrada para unirte a "${clan.name}"?\n\nEl monto se descontará de tu saldo disponible (${userGems} Gemas 💎) y se inyectará directamente al Tesoro del Clan.`,
      '⚡',
      async () => {
        try {
          const res = await supabaseService.requestJoinClan(clan.id)
          if (!res.success) {
            if (res.error === 'INSUFFICIENT_GEMS') {
              showModalAlert('SALDO INSUFICIENTE', 'Saldo insuficiente (200 Gemas 💎 requeridas).', '⚠️', 'warning')
            } else if (res.error === 'ALREADY_IN_CLAN') {
              showModalAlert('YA TIENES UN CLAN', 'Ya perteneces a un clan.', '⚠️', 'warning')
            } else if (res.error === 'CLAN_FULL') {
              showModalAlert('CLAN LLENO', 'El clan ya alcanzó el máximo de 15 miembros.', '⚠️', 'warning')
            } else if (res.error === 'INSUFFICIENT_ELO') {
              showModalAlert('COPAS INSUFICIENTES', 'No cumples con las copas ELO mínimas requeridas por este clan.', '⚠️', 'warning')
            } else if (res.error === 'CLAN_CLOSED') {
              showModalAlert('CLAN CERRADO', 'Este clan está cerrado a nuevos ingresos.', '🔒', 'warning')
            } else {
              showModalAlert('ERROR AL UNIRSE', res.message || res.error || 'No se pudo unir al clan.', '❌', 'error')
            }
            return
          }

          if (res.joined === false) {
            // Clan en modo solicitud: no deducir gemas aún ni asumir membresía
            soundManager.playSound('plantation', 0.8)
            showModalAlert(
              '¡SOLICITUD ENVIADA!',
              `Tu solicitud de ingreso ha sido enviada al Líder de "${clan.name}".\nEl cobro de 200 Gemas 💎 se efectuará únicamente si el Líder aprueba tu solicitud.`,
              '📨',
              'success'
            )
            await refreshClanData()
            return
          }

          // Ingreso inmediato confirmado por el servidor
          onDeductTokens(200.0)
          if (onRefreshUserData) void onRefreshUserData()

          soundManager.playSound('plantation', 0.8)
          showModalAlert(
            '¡BIENVENIDO AL CLAN!',
            `Te has unido exitosamente a "${clan.name}".\nTu aporte de 200 Gemas 💎 fue sumado al Tesoro del Clan.`,
            '🎉',
            'success'
          )
          ClanManager.setUserClanId(res.clan_id || clan.id)
          await refreshClanData()
        } catch (err: any) {
          showModalAlert('ERROR', err?.message || 'Error al comunicarse con el servidor.', '❌', 'error')
        }
      },
      'UNIRSE (200 💎)',
      'CANCELAR'
    )
  }

  // LEAVE CLAN
  const handleLeaveClan = () => {
    if (!userClan) return
    showModalConfirm(
      'SALIR DEL CLAN',
      `¿Estás seguro de que deseas salir del clan "${userClan.name}"?\nPerderás acceso al Tesoro, donaciones y guerras.`,
      '🚪',
      async () => {
        try {
          // Si el ID del clan no es un UUID válido (clan fantasma local previo a la migración)
          if (!ClanManager.isValidUuid(userClan.id)) {
            setUserClan(null)
            ClanManager.leaveClan(userClan.id, playerName)
            ClanManager.setUserClanId(null)
            showModalAlert('HAS SALIDO DEL CLAN', `Has dejado el clan local "${userClan.name}".`, 'ℹ️', 'info')
            await refreshClanData()
            return
          }

          const res = await supabaseService.leaveClan(userClan.id)
          // Si se completó con éxito, o si el servidor indica que el clan no existe o no somos miembros
          if (
            res.success ||
            res.error?.includes('CLAN_NOT_FOUND') ||
            res.error?.includes('NOT_CLAN_MEMBER') ||
            res.error?.includes('uuid')
          ) {
            setUserClan(null)
            ClanManager.leaveClan(userClan.id, playerName)
            ClanManager.setUserClanId(null)
            showModalAlert('HAS SALIDO DEL CLAN', `Has dejado el clan "${userClan.name}".`, 'ℹ️', 'info')
            await refreshClanData()
          } else {
            showModalAlert('ERROR', res.error || 'No se pudo salir del clan.', '❌', 'error')
          }
        } catch (e: any) {
          // Si hubo error imprevisto, se limpia el estado local para no dejar bloqueado al usuario
          setUserClan(null)
          ClanManager.leaveClan(userClan.id, playerName)
          ClanManager.setUserClanId(null)
          showModalAlert('HAS SALIDO DEL CLAN', 'Se ha restablecido tu estado de clan.', 'ℹ️', 'info')
          await refreshClanData()
        }
      },
      'SÍ, SALIR',
      'PERMANECER'
    )
  }

  // DEPOSIT TO VAULT (Gemas 💎)
  const handleDeposit = async () => {
    if (!userClan) return
    if (depositAmount <= 0) return
    if (userTokens < depositAmount) {
      showModalAlert('GEMAS INSUFICIENTES', `Gemas insuficientes (${depositAmount} Gemas 💎 requeridas).`, '⚠️', 'warning')
      return
    }

    try {
      const res = await supabaseService.depositToClanVault(depositAmount)
      if (!res.success) {
        showModalAlert('ERROR DE DEPÓSITO', res.error || 'No se pudo completar el depósito en el servidor.', '❌', 'error')
        return
      }

      onDeductTokens(depositAmount)
      if (onRefreshUserData) void onRefreshUserData()

      soundManager.playSound('plantation', 0.9)
      const ticketsEarned = res.tickets_awarded ?? Math.floor(depositAmount / 100)
      const wasDefeated = userClan.status === 'defeated'
      const currentVaultVal = Number(userClan.vaultGems ?? userClan.vaultUsd ?? 0)
      const newVault = (res as any).vault_gems ?? (currentVaultVal + depositAmount)
      const isNowReactivated = wasDefeated && newVault > 0

      showModalAlert(
        isNowReactivated ? '¡CLAN REACTIVADO Y DEPÓSITO EXITOSO!' : '¡DEPÓSITO EXITOSO + BONOS!',
        `¡Has aportado ${depositAmount} Gemas 💎 al Tesoro del Clan!${
          isNowReactivated
            ? '\n\n⚡ ¡EL TESORO TIENE FONDOS NUEVAMENTE! El clan vuelve a estar ACTIVO y listo para participar en guerras y donaciones.'
            : ''
        }\n\n🎁 ¡Has recibido de regalo:\n• +${ticketsEarned} Ticket(s) de Coliseo 🎟️\n• +1 Tiro Gratis en la Ruleta de la Suerte 🎡!`,
        isNowReactivated ? '⚡' : '🎉',
        'success'
      )
      setShowDepositModal(false)
      await refreshClanData()
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Error de conexión en el depósito.', '❌', 'error')
    }
  }

  // DEPOSIT GOLD TO CLAN VAULT
  const handleDepositGold = async () => {
    if (!userClan) return
    if (goldDepositAmount <= 0) {
      showModalAlert(
        'CANTIDAD INVÁLIDA',
        'Por favor, ingresa una cantidad de oro mayor a 0 para donar al tesoro del clan.',
        '⚠️',
        'warning'
      )
      return
    }
    if ((userGold ?? 0) < goldDepositAmount) {
      showModalAlert(
        'SALDO INSUFICIENTE',
        `No tienes suficiente oro para donar ${goldDepositAmount.toLocaleString()} de Oro. Tu saldo actual es de ${(userGold ?? 0).toLocaleString()} Oro (te faltan ${(goldDepositAmount - (userGold ?? 0)).toLocaleString()} Oro).`,
        '💰',
        'warning'
      )
      return
    }

    try {
      const res = await supabaseService.depositGoldToClanVault(goldDepositAmount)
      if (!res.success) {
        showModalAlert('ERROR DE DONACIÓN', res.error || 'No se pudo completar la donación en el servidor.', '❌', 'error')
        return
      }

      if (onDeductGold) onDeductGold(goldDepositAmount)
      if (onRefreshUserData) void onRefreshUserData()

      soundManager.playSound('plantation', 0.9)
      showModalAlert(
        '¡DONACIÓN DE ORO EXITOSA!',
        `¡Has aportado ${goldDepositAmount.toLocaleString()} de Oro al Tesoro del Clan!\n\nEste oro queda registrado en la contabilidad del clan para financiar futuras acciones, mejoras defensivas y búsqueda de partidas.`,
        '💰',
        'success'
      )
      setShowGoldDepositModal(false)
      await refreshClanData()
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Error de conexión en la donación de oro.', '❌', 'error')
    }
  }

  // CREATE DONATION REQUEST (1 COPY / DAY)
  const handleCreateRequest = async () => {
    if (!userClan) return
    const currentVault = Number(userClan.vaultGems ?? userClan.vaultUsd ?? 0)
    if (userClan.status === 'defeated' && currentVault <= 0) {
      showModalAlert('CLAN EN DERROTA', 'El clan está en Estado de Derrota (Tesoro en 0 💎). Realiza un depósito al tesoro para reactivarlo.', '🛑', 'error')
      return
    }

    const plantInfo = PLANT_CONFIGS[selectedRequestPlant]
    try {
      const res = await supabaseService.requestClanPlantDonation(selectedRequestPlant)
      if (!res.success) {
        if (res.error === 'COOLDOWN_ACTIVE') {
          showModalAlert('LÍMITE DIARIO', 'Solo puedes realizar una solicitud de semilla cada 24 horas.', '⏳', 'warning')
          return
        }
        if (res.error === 'MAX_COPIES_REACHED') {
          showModalAlert(
            'LÍMITE DE COPIAS ALCANZADO',
            `Ya posees el tope máximo de 5 copias de ${plantInfo.name}. ¡Puedes germinarla en el jardín o solicitar otra planta!`,
            '🌱',
            'warning'
          )
          return
        }
        showModalAlert('ERROR', res.error || 'No se pudo crear la solicitud.', '❌', 'error')
        return
      }

      soundManager.playSound('click', 0.5)
      showModalAlert(
        '¡SOLICITUD PUBLICADA!',
        `Has solicitado 1 copia de ${plantInfo.name}.\n¡Tus compañeros de clan podrán ayudarte!`,
        '🌱',
        'success'
      )
      setShowRequestSeedModal(false)
      await refreshClanData()
    } catch (e: any) {
      showModalAlert('ERROR', e?.message || 'Error al procesar la solicitud.', '❌', 'error')
    }
  }

  // DONATE TO REQUEST (Deduct 1 copy from donor, add 1 to requester)
  const handleDonate = (req: ClanDonationRequest) => {
    if (!userClan) return
    const currentVault = Number(userClan.vaultGems ?? userClan.vaultUsd ?? 0)
    if (userClan.status === 'defeated' && currentVault <= 0) {
      showModalAlert('CLAN EN DERROTA', 'El clan está en Estado de Derrota (Tesoro en 0 💎). Realiza un depósito al tesoro para reactivarlo.', '🛑', 'error')
      return
    }
    if (req.requesterName === playerName) {
      showModalAlert('DONACIÓN NO VÁLIDA', 'No puedes donarte cartas a ti mismo.', '⚠️', 'warning')
      return
    }
    if (req.donors.some((d) => d.donorName === playerName)) {
      showModalAlert('YA DONASTE', 'Ya donaste a esta solicitud de semillas.', '⚠️', 'warning')
      return
    }
    if ((plantCopies[req.plantId] || 0) <= 0) {
      showModalAlert('SIN COPIAS', `No tienes copias disponibles de "${req.plantName}" para donar.`, '⚠️', 'warning')
      return
    }

    showModalConfirm(
      'DONAR SEMILLA',
      `¿Deseas donar 1 copia de ${req.plantName} a ${req.requesterName}?\nSe descontará 1 carta de tu inventario.`,
      '🎁',
      async () => {
        try {
          const res = await supabaseService.donateClanPlantCopy(req.id)
          if (!res.success) {
            if (res.error === 'REQUESTER_ALREADY_MAX_COPIES') {
              showModalAlert(
                'LÍMITE ALCANZADO',
                `${req.requesterName} ya alcanzó el tope máximo de 5 copias de ${req.plantName}. No puede recibir más copias por ahora.`,
                '⚠️',
                'warning'
              )
              return
            }
            if (res.error === 'NOT_ENOUGH_COPIES') {
              showModalAlert('SIN COPIAS', `No tienes suficientes copias de ${req.plantName} en tu inventario.`, '⚠️', 'warning')
              return
            }
            showModalAlert('ERROR AL DONAR', res.error || 'No se pudo completar la donación en el servidor.', '❌', 'error')
            return
          }

          onDonatePlant(req.plantId)
          if (onRefreshUserData) void onRefreshUserData()

          soundManager.playSound('plantation', 0.9)
          showModalAlert('¡DONACIÓN EXITOSA!', `¡Has donado 1 copia de ${req.plantName} a ${req.requesterName}!\n¡Gracias por apoyar a tu clan!`, '🎁', 'success')
          await refreshClanData()
        } catch (e: any) {
          showModalAlert('ERROR', e?.message || 'Error al donar copia.', '❌', 'error')
        }
      },
      'DONAR 1 COPIA',
      'CANCELAR'
    )
  }

  // EXECUTE CLAN WAR RAID (500 Gemas 💎) - Reservado para activación futura
  const _handleExecuteRaid = (defenderClan: ClanData) => {
    if (!userClan) return
    const currentVault = Number(userClan.vaultGems ?? userClan.vaultUsd ?? 0)
    if (userClan.status === 'defeated' && currentVault <= 0) {
      showModalAlert('CLAN EN DERROTA', 'Tu clan está en Estado de Derrota (Tesoro en 0 💎). Realiza un depósito al tesoro para reactivarlo.', '🛑', 'error')
      return
    }

    if (userClan.settings?.warPermission === 'leaders') {
      const myRole = userClan.members.find((m) => m.name === playerName)?.role || (userClan.leader === playerName ? 'Líder' : 'Miembro')
      if (myRole !== 'Líder' && myRole !== 'Colíder') {
        showModalAlert(
          'PERMISO DENEGADO',
          'Según los ajustes de tu clan, solo el Líder y Colíderes tienen autorización para iniciar asaltos de guerra.',
          '🛡️',
          'warning'
        )
        return
      }
    }

    showModalConfirm(
      'ASALTO DE GUERRA (500 Gemas 💎)',
      `¿Deseas asaltar a "${defenderClan.name}" por 500 Gemas 💎 del Tesoro?\n¡Si ganas, tu clan suma +500 Gemas 💎! Si pierdes, ellos se llevan 500 Gemas 💎.`,
      '⚔️',
      () => {
        const result = ClanManager.executeClanRaid(userClan.id, defenderClan.id)
        if (result.success) {
          soundManager.playSound('victory', 0.9)
          showModalAlert('¡VICTORIA GLORIOSA!', `¡Tu clan ha derrotado a "${defenderClan.name}" y ganado +${result.stolenAmount.toFixed(0)} Gemas 💎 para el Tesoro!`, '🏆', 'success')
        } else {
          soundManager.playSound('surrender', 0.8)
          showModalAlert('DERROTA EN ASALTO', `"${defenderClan.name}" repelió el desafío. Tu clan perdió -${result.stolenAmount.toFixed(0)} Gemas 💎 y recibe un Escudo de Protección de 4 Horas.`, '💀', 'error')
        }
        refreshClanData()
      },
      '¡AL ATAQUE!',
      'CANCELAR'
    )
  }
  void _handleExecuteRaid

  // CLAIM 15/15 FULL CLAN BONUS (2 GREEN PACKS CON CANDADOS ANTI-TRAMPAS)
  const handleClaimFullBonus = async () => {
    if (!userClan || isClaimingFullBonus) return
    if (userClan.members.length < 15) {
      showModalAlert('CLAN INCOMPLETO', `El clan aún tiene ${userClan.members.length}/15 miembros. Invita a más compañeros para llenarlo.`, '⚠️', 'warning')
      return
    }
    if (hasClaimedRemoteBonus || ClanManager.hasClaimedFullClanBonus(playerName)) {
      showModalAlert('YA RECLAMADO', 'Ya has reclamado tu Bono de Clan Lleno en esta cuenta. Solo se otorga 1 vez por jugador de forma definitiva.', '⚠️', 'warning')
      return
    }

    try {
      setIsClaimingFullBonus(true)
      const res = await supabaseService.claimClanFullBonus()
      setIsClaimingFullBonus(false)

      if (res.success) {
        setHasClaimedRemoteBonus(true)
        ClanManager.claimFullClanBonus(userClan.id, playerName)
        soundManager.playSound('victory', 1)
        showModalAlert('¡BONO RECLAMADO!', res.message || '¡Se han añadido 2 Sobres Pack Verde Básico a tu inventario!', '🎁', 'success')
        window.dispatchEvent(new Event('refresh_user_balance'))
        window.dispatchEvent(new Event('player_profile_updated'))
        if (onRefreshUserData) void onRefreshUserData()
        refreshClanData()
      } else {
        soundManager.playSound('error', 0.5)
        const errorTitle = res.error === 'ALREADY_CLAIMED' ? 'YA RECLAMADO' :
                           res.error === 'TENURE_REQUIRED' ? 'ANTIGÜEDAD REQUERIDA' :
                           res.error === 'CLAN_NOT_FULL' ? 'CLAN INCOMPLETO' : 'ERROR DE RECLAMO'
        showModalAlert(errorTitle, res.message || res.error || 'No se pudo reclamar el bono.', '⚠️', 'warning')
      }
    } catch (e: any) {
      setIsClaimingFullBonus(false)
      showModalAlert('ERROR', e?.message || 'Error de conexión con el servidor.', '❌', 'error')
    }
  }

  // CLAIM SEASON VAULT PAYOUT (SOLO GANANCIAS NETAS SOBRE LA RESERVA DE 2,800 💎)
  const handleClaimSeasonPayout = async () => {
    if (!userClan) return
    const seasonStatus = SeasonManager.getSeasonStatus()
    if (!seasonStatus.isEnded) {
      showModalAlert(
        'TEMPORADA EN CURSO',
        `El reparto y retiro de ganancias se habilitará al finalizar los 30 días de la temporada actual (${seasonStatus.formattedCountdown} restantes).`,
        '⏳',
        'warning'
      )
      return
    }

    const WAR_RESERVE = 2800.0
    const currentVault = Number(userClan.vaultGems ?? userClan.vaultUsd)
    const surplusEarnings = Math.max(0, currentVault - WAR_RESERVE)

    if (surplusEarnings <= 0) {
      showModalAlert(
        'SIN GANANCIAS EXCEDENTES',
        `El Tesoro actual (${currentVault.toFixed(0)} 💎) se encuentra dentro de la Reserva Operativa de Guerra (2,800 💎).\n\nEsta reserva base permanece siempre en el clan para defender la base y participar en futuras guerras. Solo las ganancias netas generadas por encima de los 2,800 💎 pueden ser retiradas.`,
        '🛡️',
        'warning'
      )
      return
    }
    if (userClan.seasonPayoutClaimedMembers.includes(playerName)) {
      showModalAlert('YA COBRADO', 'Ya cobraste tu parte de las ganancias de Temporada.', '⚠️', 'warning')
      return
    }

    try {
      const remoteRes = await supabaseService.claimSeasonClanEarnings()
      if (remoteRes.success && remoteRes.share && remoteRes.share > 0) {
        onAddTokens(remoteRes.share)
        soundManager.playSound('victory', 1)
        showModalAlert('¡GANANCIAS RETIRADAS!', `¡+${Math.floor(remoteRes.share)} Gemas 💎 de ganancias de temporada transferidas a tu saldo!`, '💎', 'success')
        await refreshClanData()
        return
      }
    } catch {
      // Fallback a ClanManager local
    }

    const share = ClanManager.claimSeasonVaultPayout(userClan.id, playerName)
    if (share > 0) {
      onAddTokens(share)
      soundManager.playSound('victory', 1)
      showModalAlert('¡GANANCIAS RETIRADAS!', `¡+${Math.floor(share)} Gemas 💎 transferidas exitosamente a tu saldo!`, '💎', 'success')
      await refreshClanData()
    } else {
      showModalAlert('RESERVA PROTEGIDA', 'No hay ganancias por encima de la reserva de guerra de 2,800 Gemas.', '🛡️', 'info')
    }
  }

  // NON-CLAN VIEW (BROWSE OR CREATE)
  if (!userClan) {
    return (
      <div className="clan-container">
        {/* Top Header */}
        <div className="clan-header">
          <button className="clan-back-btn" type="button" onClick={onBackToMenu}>
            ⬅ VOLVER AL MENÚ
          </button>
          <h2 className="clan-header__title">🏰 SISTEMA DE CLANES COMPETITIVOS</h2>
          <div className="clan-header__tokens">
            <span>💎 Saldo: {userGems} Gemas</span>
          </div>
        </div>

        {/* Banner Info */}
        <div className="clan-promo-banner">
          <div className="clan-promo-banner__badge">⚔️ ALTO RENDIMIENTO & SAQUEOS REALES</div>
          <h3 className="clan-promo-banner__title">Únete a un Clan (200 💎) o Funda el tuyo (500 💎)</h3>
          <p className="clan-promo-banner__desc">
            Funda tu clan (500 💎 de registro) o ingresa a uno existente por 200 💎 (100% va al Tesoro).
            Con 15 miembros se consolida la Reserva de Guerra de 2,800 💎 y al finalizar la temporada se reparten las ganancias netas de los asaltos.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="clan-nav-tabs">
          <button
            type="button"
            className={`clan-tab-btn ${noClanTab === 'browse' ? 'clan-tab-btn--active' : ''}`}
            onClick={() => setNoClanTab('browse')}
          >
            🔍 BUSCAR Y UNIRSE (200 💎)
          </button>
          <button
            type="button"
            className={`clan-tab-btn ${noClanTab === 'create' ? 'clan-tab-btn--active' : ''}`}
            onClick={() => setNoClanTab('create')}
          >
            ➕ FUNDAR NUEVO CLAN (500 💎)
          </button>
        </div>

        {/* BROWSE CLANS - DUAL PANEL SHOWCASE */}
        {noClanTab === 'browse' && (() => {
          const selectedClan = allClans.find((c) => c.id === selectedBrowseClanId) || allClans[0]
          const isSelectedFull = selectedClan ? selectedClan.members.length >= (selectedClan.maxMembers || 15) : false
          const isSelectedDefeated = selectedClan
            ? selectedClan.status === 'defeated' && (selectedClan.vaultGems ?? selectedClan.vaultUsd ?? 0) <= 0
            : false
          const avgElo = selectedClan
            ? Math.round(selectedClan.members.reduce((acc, m) => acc + m.elo, 0) / Math.max(1, selectedClan.members.length))
            : 0

          return (
            <div className="clan-browse-dual-pane">
              {/* Left Column: Clan List */}
              <div className="clan-browse-sidebar">
                <div className="clan-browse-sidebar__header">
                  <span>🏆 CLANES DESTACADOS</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <small>{allClans.length} Disponibles</small>
                    <button
                      type="button"
                      className={`clan-mini-refresh-btn ${isRefreshing ? 'clan-refresh-btn--spinning' : ''}`}
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        void refreshClanData(false, true)
                      }}
                      title="Actualizar clanes y miembros"
                    >
                      🔄
                    </button>
                  </div>
                </div>

                <div className="clan-browse-sidebar__list">
                  {allClans.map((clan, index) => {
                    const clanLimit = clan.maxMembers || 15
                    const isFull = clan.members.length >= clanLimit
                    const isSelected = selectedClan?.id === clan.id
                    const currentVault = clan.vaultGems ?? clan.vaultUsd
                    const isClanDefeated = clan.status === 'defeated' && Number(currentVault ?? 0) <= 0

                    return (
                      <button
                        key={clan.id}
                        type="button"
                        className={`clan-sidebar-item ${isSelected ? 'clan-sidebar-item--active' : ''} ${
                          isFull ? 'clan-sidebar-item--full' : ''
                        }`}
                        onClick={() => setSelectedBrowseClanId(clan.id)}
                      >
                        <div className="clan-sidebar-item__rank">#{index + 1}</div>
                        <div className="clan-sidebar-item__badge">{clan.badge}</div>
                        <div className="clan-sidebar-item__info">
                          <div className="clan-sidebar-item__title">
                            <strong>{clan.name}</strong>
                            <span className="clan-sidebar-item__tag">{clan.tag}</span>
                          </div>
                          <div className="clan-sidebar-item__meta">
                            <span>👥 {clan.members.length}/{clanLimit}</span>
                            <span className="clan-sidebar-item__vault">💎 {Number(currentVault).toFixed(0)}</span>
                          </div>
                        </div>
                        <div className="clan-sidebar-item__status">
                          {isClanDefeated ? (
                            <span className="clan-pill--defeated">DERROTA</span>
                          ) : isFull ? (
                            <span className="clan-pill--full">LLENO</span>
                          ) : clan.settings?.privacy === 'closed' ? (
                            <span className="clan-pill--closed">CERRADO</span>
                          ) : clan.settings?.privacy === 'request' ? (
                            <span className="clan-pill--request">SOLICITUD</span>
                          ) : (
                            <span className="clan-pill--open">ABIERTO</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Selected Clan Detail Showcase */}
              <div className="clan-browse-showcase">
                {selectedClan ? (
                  <div className="clan-showcase-content">
                    {/* Header Card */}
                    <div className="clan-showcase-header">
                      <div className="clan-showcase-badge-wrap">
                        <span className="clan-showcase-badge">{selectedClan.badge}</span>
                      </div>
                      <div className="clan-showcase-title-area">
                        <div className="clan-showcase-title-row">
                          <h3>{selectedClan.name}</h3>
                          <span className="clan-showcase-tag">{selectedClan.tag}</span>
                          {isSelectedDefeated ? (
                            <span className="clan-defeat-pill">🛑 EN DERROTA</span>
                          ) : isSelectedFull ? (
                            <span className="clan-pill--full">🔒 LLENO ({selectedClan.members.length}/{selectedClan.maxMembers || 15})</span>
                          ) : selectedClan.settings?.privacy === 'closed' ? (
                            <span className="clan-pill--closed">🔒 CERRADO</span>
                          ) : selectedClan.settings?.privacy === 'request' ? (
                            <span className="clan-pill--request">
                              🟡 CON SOLICITUD {selectedClan.settings?.autoAccept ? '(INMEDIATA)' : ''}
                            </span>
                          ) : (
                            <span className="clan-pill--open">🟢 ABIERTO (200 💎)</span>
                          )}
                          {Boolean(selectedClan.settings?.minElo && selectedClan.settings.minElo > 0) && (
                            <span className="clan-min-elo-pill">🏆 ELO {selectedClan.settings?.minElo}+</span>
                          )}
                        </div>
                        <p className="clan-showcase-desc">{selectedClan.description || 'Clan competitivo enfocado en guerras y donaciones de semillas.'}</p>
                        <span className="clan-showcase-leader">👑 Líder: <strong>{selectedClan.leader}</strong></span>
                      </div>
                    </div>

                    {/* 4 Stats Tiles */}
                    <div className="clan-showcase-metrics-grid">
                      <div className="clan-metric-card clan-metric-card--vault">
                        <span className="clan-metric-card__label">💎 TESORO ACUMULADO</span>
                        <span className="clan-metric-card__value">{Number(selectedClan.vaultGems ?? selectedClan.vaultUsd).toFixed(0)} Gemas</span>
                      </div>

                      <div className="clan-metric-card">
                        <span className="clan-metric-card__label">👥 MIEMBROS</span>
                        <span className="clan-metric-card__value">{selectedClan.members.length} / {selectedClan.maxMembers || 15}</span>
                        <small className="clan-metric-card__sub">
                          {(selectedClan.maxMembers || 15) - selectedClan.members.length > 0
                            ? `${(selectedClan.maxMembers || 15) - selectedClan.members.length} cupos libres`
                            : 'Cupo completo'}
                        </small>
                      </div>

                      <div className="clan-metric-card">
                        <span className="clan-metric-card__label">🏆 ELO PROMEDIO</span>
                        <span className="clan-metric-card__value">{avgElo} Copas</span>
                        <small className="clan-metric-card__sub">Nivel competitivo</small>
                      </div>

                      <div className="clan-metric-card">
                        <span className="clan-metric-card__label">⚔️ RÉCORD GUERRAS</span>
                        <span className="clan-metric-card__value">
                          {selectedClan.wins}V - {selectedClan.losses}D
                        </span>
                        <small className="clan-metric-card__sub">
                          {selectedClan.wins + selectedClan.losses > 0
                            ? `${Math.round(
                                (selectedClan.wins /
                                  Math.max(1, selectedClan.wins + selectedClan.losses)) *
                                  100
                              )}% Victorias`
                            : 'Sin guerras aún'}
                        </small>
                      </div>
                    </div>

                    {/* Members Preview */}
                    <div className="clan-showcase-members-box">
                      <div className="clan-showcase-members-title">
                        <span>👥 ROSTER DE JUGADORES ({selectedClan.members.length}/{selectedClan.maxMembers || 15})</span>
                        <small>Top miembros destacados</small>
                      </div>
                      <div className="clan-showcase-members-list">
                        {selectedClan.members.slice(0, 5).map((m, idx) => (
                          <div key={m.id} className="clan-showcase-member-row">
                            <span className="clan-member-row-rank">#{idx + 1}</span>
                            <span className="clan-member-row-name">{m.name}</span>
                            <span className={`clan-role-badge clan-role--${m.role.toLowerCase()}`}>{m.role}</span>
                            <span className="clan-member-row-elo">🏆 {m.elo}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Action Area */}
                    <div className="clan-showcase-action-bar">
                      {isSelectedDefeated ? (
                        <button type="button" disabled className="clan-showcase-btn clan-showcase-btn--defeated">
                          🛑 CLAN EN ESTADO DE DERROTA
                        </button>
                      ) : isSelectedFull ? (
                        <button type="button" disabled className="clan-showcase-btn clan-showcase-btn--full">
                          🔒 CLAN COMPLETO ({selectedClan.maxMembers || 15}/{selectedClan.maxMembers || 15} MIEMBROS)
                        </button>
                      ) : selectedClan.settings?.privacy === 'closed' ? (
                        <button type="button" disabled className="clan-showcase-btn clan-showcase-btn--closed">
                          🔒 CLAN CERRADO (SOLO INVITACIÓN)
                        </button>
                      ) : selectedClan.settings?.privacy === 'request' && !selectedClan.settings?.autoAccept ? (
                        <button
                          type="button"
                          className="clan-showcase-btn clan-showcase-btn--request"
                          onClick={() => handleJoinClan(selectedClan)}
                        >
                          📝 SOLICITAR INGRESO A {selectedClan.name.toUpperCase()} (200 💎)
                        </button>
                      ) : selectedClan.settings?.privacy === 'request' && selectedClan.settings?.autoAccept ? (
                        <button
                          type="button"
                          className="clan-showcase-btn clan-showcase-btn--join"
                          onClick={() => handleJoinClan(selectedClan)}
                        >
                          ⚡ UNIRSE A {selectedClan.name.toUpperCase()} (APROBACIÓN INMEDIATA - 200 💎)
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="clan-showcase-btn clan-showcase-btn--join"
                          onClick={() => handleJoinClan(selectedClan)}
                        >
                          ⚡ UNIRSE A {selectedClan.name.toUpperCase()} (200 💎)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="clan-showcase-empty">Selecciona un clan de la lista para ver su información.</div>
                )}
              </div>
            </div>
          )
        })()}

        {/* CREATE CLAN */}
        {noClanTab === 'create' && (
          <form className="clan-create-form" onSubmit={handleCreateClan}>
            <div className="clan-form-grid">
              <div className="clan-form-group">
                <label>Nombre del Clan (Máx 18 caracteres)</label>
                <input
                  type="text"
                  maxLength={18}
                  placeholder="Ej. DRAGON MASTERS"
                  value={newClanName}
                  onChange={(e) => setNewClanName(e.target.value)}
                  required
                />
              </div>

              <div className="clan-form-group">
                <label>Etiqueta / Tag (Ej. #DRG01)</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="#DRG01"
                  value={newClanTag}
                  onChange={(e) => setNewClanTag(e.target.value)}
                  required
                />
              </div>

              <div className="clan-form-group">
                <label>Insignia / Escudo</label>
                <div className="clan-badge-picker">
                  {BADGES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={`clan-badge-opt ${newClanBadge === b ? 'clan-badge-opt--active' : ''}`}
                      onClick={() => setNewClanBadge(b)}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="clan-form-group">
                <label>Descripción del Clan</label>
                <textarea
                  rows={2}
                  placeholder="Reglas, metas competitivas y mensaje de bienvenida..."
                  value={newClanDesc}
                  onChange={(e) => setNewClanDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="clan-create-summary">
              <div className="clan-create-summary__item">
                <span>Tasa de Registro (Impuesto):</span>
                <strong>500 Gemas 💎</strong>
              </div>
              <div className="clan-create-summary__item">
                <span>Tesoro Inicial del Clan:</span>
                <strong style={{ color: '#94a3b8' }}>0 Gemas 💎 (Inicia en cero)</strong>
              </div>
              <div className="clan-create-summary__item">
                <span>Tasa de Ingreso por Miembro:</span>
                <strong style={{ color: '#4ade80' }}>200 Gemas 💎 (100% al Tesoro)</strong>
              </div>
              <div className="clan-create-summary__item">
                <span>Reserva de Guerra (15 Miembros):</span>
                <strong style={{ color: '#38bdf8' }}>2,800 Gemas 💎</strong>
              </div>
            </div>

            <button type="submit" className="clan-submit-create-btn">
              👑 FUNDAR CLAN (500 💎 GEMAS)
            </button>
          </form>
        )}

        {/* CUSTOM IN-GAME POPUP DIALOG */}
        {renderCustomDialog()}
      </div>
    )
  }

  // ACTIVE CLAN VIEW
  const currentVaultGems = Number(userClan.vaultGems ?? userClan.vaultUsd ?? 0)
  const isDefeated = userClan.status === 'defeated' && currentVaultGems <= 0
  const isShielded = userClan.shieldUntil && userClan.shieldUntil > Date.now()
  const shieldHours = isShielded ? Math.ceil((userClan.shieldUntil! - Date.now()) / 3600000) : 0

  return (
    <div className="clan-container">
      {/* Clan Topbar */}
      <div className="clan-active-topbar">
        <div className="clan-topbar-left">
          <button className="clan-back-btn" type="button" onClick={onBackToMenu}>
            ⬅ MENÚ
          </button>
          <div className="clan-main-identity">
            <span className="clan-main-badge">{userClan.badge}</span>
            <div>
              <div className="clan-title-tag">
                <h3>{userClan.name}</h3>
                <span className="clan-tag-pill">{userClan.tag}</span>
                {isDefeated && <span className="clan-defeat-pill">🛑 ESTADO DE DERROTA</span>}
                {isShielded && !isDefeated && (
                  <span className="clan-shield-pill">🛡️ ESCUDO {shieldHours}H</span>
                )}
              </div>
              <span className="clan-leader-txt">Líder: {userClan.leader} | {userClan.members.length}/{fortressData?.maxMembers || 15} Miembros</span>
            </div>
          </div>
        </div>

        {/* Settings Gear Button (Solo visible para el Líder del Clan) */}
        {isLeader && (
          <button
            type="button"
            className="clan-settings-gear-btn"
            onClick={handleOpenSettings}
            title="Ajustes y Configuración del Clan (Solo Líder)"
          >
            ⚙️
          </button>
        )}

        {/* Vault & Actions */}
        <div className="clan-topbar-right">
          <div className={`clan-vault-display ${isDefeated ? 'clan-vault-display--defeated' : ''}`}>
            <span className="clan-vault-title">💎 TESORO DEL CLAN</span>
            <div className="clan-vault-amounts-row">
              <span className="clan-vault-amount">{currentVaultGems.toFixed(0)} 💎</span>
              <span className="clan-vault-amount clan-vault-amount--gold">
                {Number(userClan.vaultGold || 0).toLocaleString()} <GoldIcon size={14} />
              </span>
            </div>
          </div>

          <div className="clan-topbar-btns">
            <button
              type="button"
              className={isDefeated ? 'clan-repair-btn' : 'clan-deposit-btn'}
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setShowDepositModal(true)
              }}
              title="Aportar Gemas al Tesoro del Clan"
            >
              💎 DONAR GEMAS
            </button>

            <button
              type="button"
              className="clan-deposit-gold-btn"
              onClick={() => {
                soundManager.playSound('click', 0.4)
                setShowGoldDepositModal(true)
              }}
              title="Donar Oro al Tesoro del Clan"
            >
              💰 DONAR ORO
            </button>

            <button type="button" className="clan-leave-btn" onClick={handleLeaveClan}>
              SALIR
            </button>
          </div>
        </div>
      </div>

      {/* Defeat State Banner */}
      {isDefeated && (
        <div className="clan-defeat-banner">
          <span className="clan-defeat-banner-icon">🛑</span>
          <div className="clan-defeat-banner-content">
            <strong>CLAN EN ESTADO DE DERROTA (TESORO EN CERO 💎)</strong>
            <p>
              El fondo del tesoro ha llegado a 0 gemas tras una guerra. Para reactivar las funciones del clan y participar en guerras, cualquier miembro puede aportar gemas (incluso 50 💎) para devolver el clan inmediatamente al estado ACTIVO.
            </p>
          </div>
          <button
            type="button"
            className="clan-deposit-btn--defeat"
            onClick={() => {
              soundManager.playSound('click', 0.4)
              setShowDepositModal(true)
            }}
          >
            💎 DONAR AL TESORO
          </button>
        </div>
      )}

      {/* TABS NAVIGATION */}
      <div className="clan-nav-tabs">
        <button
          type="button"
          className={`clan-tab-btn ${activeTab === 'members' ? 'clan-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          👥 MIEMBROS ({userClan.members.length}/{fortressData?.maxMembers || 15})
        </button>
        <button
          type="button"
          className={`clan-tab-btn ${activeTab === 'wars' ? 'clan-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('wars')}
        >
          ⚔️ ASALTOS
        </button>
        <button
          type="button"
          className={`clan-tab-btn ${activeTab === 'donations' ? 'clan-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('donations')}
        >
          🔄 DONACIONES ({donationRequests.length})
        </button>
        <button
          type="button"
          className={`clan-tab-btn ${activeTab === 'rewards' ? 'clan-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          🎁 RECOMPENSAS
        </button>
        <button
          type="button"
          className={`clan-tab-btn ${activeTab === 'fortress' ? 'clan-tab-btn--active' : ''}`}
          onClick={() => {
            setActiveTab('fortress')
            setFortressSubView('hub')
          }}
        >
          🏰 FORTALEZA
        </button>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="clan-members-pane">
          {/* Solicitudes de ingreso pendientes (Solo Líder) */}
          {isLeader && pendingRequests.length > 0 && (
            <div className="clan-pending-requests-card">
              <div className="clan-pending-requests-card__header">
                <div className="clan-pending-requests-card__title">
                  <span className="clan-pending-requests-card__icon">📬</span>
                  <strong>SOLICITUDES DE INGRESO PENDIENTES ({pendingRequests.length})</strong>
                </div>
                <small>Jugadores esperando tu aprobación para ingresar al Clan</small>
              </div>
              <div className="clan-pending-requests-list">
                {pendingRequests.map((req) => (
                  <div key={req.id} className="clan-pending-request-row">
                    <div className="clan-pending-request-info">
                      <span className="clan-pending-request-avatar">🌱</span>
                      <div>
                        <strong className="clan-pending-request-name">{req.username}</strong>
                        <span className="clan-pending-request-meta">🏆 {req.elo} Copas ELO</span>
                      </div>
                    </div>
                    <div className="clan-pending-request-actions">
                      <button
                        type="button"
                        className="clan-req-action-btn clan-req-action-btn--accept"
                        onClick={() => handleRespondRequest(req.id, true, req.username)}
                        title="Aceptar e incorporar al clan (+200 💎 al Tesoro)"
                      >
                        ✓ ACEPTAR (+200 💎)
                      </button>
                      <button
                        type="button"
                        className="clan-req-action-btn clan-req-action-btn--reject"
                        onClick={() => handleRespondRequest(req.id, false, req.username)}
                        title="Rechazar solicitud"
                      >
                        ✕ RECHAZAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de herramientas para el Líder: Invitar Jugador */}
          {isLeader ? (
            <div className="clan-members-toolbar">
              <span className="clan-members-toolbar__hint">
                👥 Administra los miembros de tu clan o invita jugadores directamente por nombre de usuario.
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="clan-invite-open-btn"
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setShowInviteModal(true)
                  }}
                  disabled={userClan.members.length >= (fortressData?.maxMembers || 15)}
                  title={userClan.members.length >= (fortressData?.maxMembers || 15) ? `El clan ya alcanzó el cupo máximo de ${fortressData?.maxMembers || 15} miembros` : 'Invitar jugador'}
                >
                  ✉️ INVITAR JUGADOR AL CLAN
                </button>
              </div>
            </div>
          ) : (
            <div className="clan-members-toolbar">
              <span className="clan-members-toolbar__hint">
                👥 Miembros del clan ({userClan.members.length}/{fortressData?.maxMembers || 15}). Los nuevos ingresos se sincronizan en tiempo real.
              </span>
            </div>
          )}

          <div className="clan-members-table-wrap">
            <table className="clan-members-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>JUGADOR</th>
                  <th>ROL</th>
                  <th>COPAS ELO</th>
                  <th>DONACIONES</th>
                  <th>ASISTENCIA A GUERRA</th>
                  <th>ESTADO</th>
                  <th>GESTIÓN</th>
                </tr>
              </thead>
              <tbody>
                {userClan.members.map((member, idx) => {
                  const isMe = member.name === playerName
                  const isUserLeader = userClan.leader === playerName || userClan.members.find((m) => m.name === playerName)?.role === 'Líder'
                  const isUserColeader = userClan.members.find((m) => m.name === playerName)?.role === 'Colíder'
                  const canKickMembers = isUserLeader || isUserColeader
                  const validation = ClanManager.validateKickMember(userClan, member)
                  const roundsPart = member.roundsParticipated || 0
                  const missed = member.consecutiveRoundsMissed || 0
                  const wo = member.walkoverLosses || 0

                  return (
                    <tr key={member.id} className={isMe ? 'clan-row--me' : ''}>
                      <td>{idx + 1}</td>
                      <td className="clan-member-name-cell">
                        <strong className={isMe && hasVipPass ? 'vip-gold-text' : ''}>
                          {isMe && hasVipPass && '👑 '}
                          {member.name}
                        </strong>
                        {isMe && <span className="clan-me-tag">TÚ</span>}
                      </td>
                      <td>
                        <span className={`clan-role-badge clan-role--${member.role.toLowerCase()}`}>
                          {member.role}
                        </span>
                      </td>
                      <td>🏆 {member.elo}</td>
                      <td>🎁 {member.donatedCount} cartas</td>
                      <td>
                        {member.role === 'Líder' ? (
                          <span className="clan-war-badge clan-war-badge--leader" title="Líder Supremo del Clan">
                            👑 Líder
                          </span>
                        ) : validation.isProtected ? (
                          <span
                            className="clan-war-badge clan-war-badge--protected"
                            title={`Participó en ${roundsPart} rondas de guerra esta temporada. Blindado contra expulsión hasta fin de temporada.`}
                          >
                            🛡️ Blindado ({roundsPart} Rondas)
                          </span>
                        ) : validation.reasonCode === 'ELIGIBLE_INACTIVE' ? (
                          <span
                            className="clan-war-badge clan-war-badge--warning"
                            title={`No ha participado en ${missed} rondas consecutivas (2 semanas). Expulsión habilitada por inactividad.`}
                          >
                            ⚠️ Inactivo ({missed} Semanas)
                          </span>
                        ) : validation.reasonCode === 'ELIGIBLE_WALKOVER' ? (
                          <span
                            className="clan-war-badge clan-war-badge--danger"
                            title={`Registra ${wo} derrota(s) por W.O. por no presentarse. Expulsión habilitada por abandono.`}
                          >
                            🚨 {wo} Falta W.O.
                          </span>
                        ) : (
                          <span
                            className="clan-war-badge clan-war-badge--active"
                            title="Al día con la asistencia de guerra"
                          >
                            ✓ Activo ({roundsPart} Rondas)
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="clan-status-dot" /> En línea
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                          {!isMe && (isLeader || (myRole === 'Colíder' && member.role !== 'Líder' && member.role !== 'Colíder')) && (
                            <button
                              type="button"
                              className="clan-role-action-btn"
                              onClick={() => handleOpenRoleModal(member)}
                              title="Gestionar o cambiar rol en el clan"
                            >
                              👑 ROL
                            </button>
                          )}
                          {!isMe && member.role !== 'Líder' && canKickMembers ? (
                            <button
                              type="button"
                              className={`clan-kick-action-btn ${
                                validation.canKick
                                  ? 'clan-kick-action-btn--eligible'
                                  : 'clan-kick-action-btn--protected'
                              }`}
                              onClick={() => handleOpenKickDialog(member)}
                              title={
                                validation.canKick
                                  ? 'Expulsar por faltas comprobadas al reglamento'
                                  : 'Ver motivo de protección o faltas acumuladas'
                              }
                            >
                              {validation.canKick ? '👢 EXPULSAR' : '🛡️ DETALLES'}
                            </button>
                          ) : !(!isMe && (isLeader || (myRole === 'Colíder' && member.role !== 'Líder' && member.role !== 'Colíder'))) ? (
                            <span className="clan-member-na-dash">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ASALTOS (MUY PRONTO) */}
      {activeTab === 'wars' && (
        <div className="clan-coming-soon-pane">
          <div className="clan-coming-soon-card clan-coming-soon-card--raids">
            <div className="clan-coming-soon-left">
              <span className="clan-coming-soon-badge">⏳ MUY PRONTO</span>
              <div className="clan-coming-soon-icon">⚔️</div>
              <h3>MODO ASALTOS DE CLAN</h3>
              <p className="clan-coming-soon-desc">
                ¡El nuevo sistema competitivo de Asaltos de Clan está en desarrollo!
                Próximamente tu clan podrá coordinar ataques tácticos contra bases enemigas,
                saquear botines protegidos y defender el Tesoro del Clan con escudos y muros fortificados.
              </p>
            </div>
            <div className="clan-coming-soon-features">
              <div className="clan-cs-feat">
                <span className="clan-cs-feat-icon">🛡️</span>
                <div>
                  <strong>Defensas de Clan</strong>
                  <small>Construye muros defensivos y protege el botín de tu clan.</small>
                </div>
              </div>
              <div className="clan-cs-feat">
                <span className="clan-cs-feat-icon">💣</span>
                <div>
                  <strong>Saqueos de Tesoro</strong>
                  <small>Asalta clanes rivales para arrebatarles Oro y Gemas.</small>
                </div>
              </div>
              <div className="clan-cs-feat">
                <span className="clan-cs-feat-icon">🏆</span>
                <div>
                  <strong>Ranking de Conquistadores</strong>
                  <small>Compite por la cima y gana recompensas de temporada.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FORTALEZA DEL CLAN */}
      {activeTab === 'fortress' && (
        <div className="clan-fortress-pane">
          {isLoadingFortress && !fortressData ? (
            <div className="clan-fortress-loading">
              <div className="clan-fortress-spinner" />
              <p>Cargando datos de la fortaleza...</p>
            </div>
          ) : (
            <>
              {/* SUBVIEW 1: HUB PRINCIPAL DE 3 CARDS */}
              {fortressSubView === 'hub' && (
                <div className="clan-fortress-hub">
                  {/* Fortress Hub Header */}
                  <div className="clan-fortress-hub-header">
                    <div className="clan-fortress-hub-badge-wrap">
                      <span className="clan-fortress-hub-badge-icon">{userClan.badge || '🏰'}</span>
                      <div>
                        <h2 className="clan-fortress-hub-title">FORTALEZA DE {userClan.name.toUpperCase()}</h2>
                        <span className="clan-fortress-hub-subtitle">
                          [{userClan.tag}] • Centro Estratégico de Guerra y Defensa (Modo 5 Carriles)
                        </span>
                      </div>
                    </div>

                    {/* Escudo Status Badge */}
                    {(() => {
                      const isShieldActive = fortressData?.shieldUntil && new Date(fortressData.shieldUntil).getTime() > Date.now()
                      if (isShieldActive) {
                        const minsLeft = Math.ceil((new Date(fortressData!.shieldUntil!).getTime() - Date.now()) / 60000)
                        const hrs = Math.floor(minsLeft / 60)
                        const mins = minsLeft % 60
                        return (
                          <div className="clan-fortress-shield-badge clan-fortress-shield--active" title="Protección activa post-asalto">
                            🛡️ ESCUDO ACTIVO ({hrs}h {mins}m)
                          </div>
                        )
                      }
                      return (
                        <div className="clan-fortress-shield-badge clan-fortress-shield--vulnerable" title="La fortaleza puede recibir asaltos de otros clanes">
                          ⚔️ VULNERABLE A ASALTOS
                        </div>
                      )
                    })()}
                  </div>

                  {/* LAS 3 CARDS ESTRATÉGICAS */}
                  <div className="clan-fortress-cards-grid">
                    {/* CARD 1: BASTIÓN */}
                    <div
                      className="clan-fhub-card clan-fhub-card--bastion"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setFortressSubView('bastion')
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="clan-fhub-card__top">
                        <span className="clan-fhub-card__icon">🏰</span>
                        <div className="clan-fhub-card__header-text">
                          <h3 className="clan-fhub-card__title">BASTIÓN</h3>
                          <span className="clan-fhub-card__tag">Salud de Base & Asaltos</span>
                        </div>
                        <span className="clan-fhub-card__badge clan-fhub-card__badge--bastion">
                          {fortressData?.baseHp ?? 500} / {fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500} HP
                        </span>
                      </div>

                      <div className="clan-fhub-card__body">
                        <div className="clan-fhub-stat-row">
                          <span className="clan-fhub-stat-label">❤️ Salud del Bastión:</span>
                          <span className="clan-fhub-stat-val">
                            {fortressData?.baseHp ?? 500} / {fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500} HP
                          </span>
                        </div>
                        <div className="clan-fhub-bar-track">
                          <div
                            className="clan-fhub-bar-fill clan-fhub-bar-fill--hp"
                            style={{
                              width: `${Math.max(0, Math.min(100, (((fortressData?.baseHp ?? 500) / (fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500)) * 100)))}%`,
                            }}
                          />
                        </div>

                        <div className="clan-fhub-pill-row">
                          <span className="clan-fhub-pill">
                            💎 En Riesgo: <strong>{Math.min(60, Math.floor((fortressData?.vaultGems ?? userClan.vaultGems ?? 0) * 0.08))} 💎</strong>
                          </span>
                          <span className="clan-fhub-pill">
                            ⚔️ Asaltos: <strong>Disponibles</strong>
                          </span>
                        </div>

                        <p className="clan-fhub-card__desc">
                          Supervisa la salud de la base comunitaria, repara daños tras asedios, consulta el botín en riesgo y comanda asaltos ofensivos contra fortalezas enemigas.
                        </p>
                      </div>

                      <div className="clan-fhub-card__footer">
                        <button
                          type="button"
                          className="clan-fhub-card__btn clan-fhub-card__btn--bastion"
                          onClick={(e) => {
                            e.stopPropagation()
                            soundManager.playSound('click', 0.4)
                            setFortressSubView('bastion')
                          }}
                        >
                          🏰 ENTRAR AL BASTIÓN →
                        </button>
                      </div>
                    </div>

                    {/* CARD 2: ÁRBOL MADRE */}
                    <div
                      className="clan-fhub-card clan-fhub-card--tree"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setFortressSubView('tree')
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="clan-fhub-card__top">
                        <span className="clan-fhub-card__icon">🌳</span>
                        <div className="clan-fhub-card__header-text">
                          <h3 className="clan-fhub-card__title">ÁRBOL MADRE</h3>
                          <span className="clan-fhub-card__tag">Nutrición & Bonificaciones</span>
                        </div>
                        <span className="clan-fhub-card__badge clan-fhub-card__badge--tree">
                          Nivel {fortressData?.motherTreeLevel ?? 1} / 4
                        </span>
                      </div>

                      <div className="clan-fhub-card__body">
                        <div className="clan-fhub-nutrients-preview">
                          <div className="clan-fhub-nutrient-chip">
                            <span>💧 {fortressData?.motherTreeWater ?? 0}/{fortressData?.nextTreeWaterReq || 150}</span>
                          </div>
                          <div className="clan-fhub-nutrient-chip">
                            <span>🧪 {fortressData?.motherTreeFertilizer ?? 0}/{fortressData?.nextTreeFertReq || 100}</span>
                          </div>
                          <div className="clan-fhub-nutrient-chip">
                            <span>💎 {fortressData?.motherTreeGems ?? 0}/{fortressData?.nextTreeGemsReq || 600}</span>
                          </div>
                        </div>

                        <div className="clan-fhub-perks-preview">
                          <span className="clan-fhub-perk-item">☀️ +{fortressData?.dailyPassiveSuns || 0} Soles/Día</span>
                          <span className="clan-fhub-perk-item">🥊 +{fortressData?.pvpDamageBonusPct || 0}% Daño PvP</span>
                          <span className="clan-fhub-perk-item">👥 Cupo: {fortressData?.maxMembers || 15} Miembros</span>
                        </div>

                        <p className="clan-fhub-card__desc">
                          Consagra agua, fertilizante y gemas al Árbol Madre del Clan para expandir el cupo de miembros, obtener soles pasivos diarios y potenciar el daño en PvP.
                        </p>
                      </div>

                      <div className="clan-fhub-card__footer">
                        <button
                          type="button"
                          className="clan-fhub-card__btn clan-fhub-card__btn--tree"
                          onClick={(e) => {
                            e.stopPropagation()
                            soundManager.playSound('click', 0.4)
                            setFortressSubView('tree')
                          }}
                        >
                          🌳 VISITAR ÁRBOL MADRE →
                        </button>
                      </div>
                    </div>

                    {/* CARD 3: DEFENSAS */}
                    <div
                      className="clan-fhub-card clan-fhub-card--defenses"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setFortressSubView('defenses')
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="clan-fhub-card__top">
                        <span className="clan-fhub-card__icon">🛡️</span>
                        <div className="clan-fhub-card__header-text">
                          <h3 className="clan-fhub-card__title">DEFENSAS</h3>
                          <span className="clan-fhub-card__tag">Arena 1 • 5 Carriles</span>
                        </div>
                        <span className="clan-fhub-card__badge clan-fhub-card__badge--def">
                          {fortressData?.layout?.length ?? 0} Plantas Desplegadas
                        </span>
                      </div>

                      <div className="clan-fhub-card__body">
                        <div className="clan-fhub-stat-row">
                          <span className="clan-fhub-stat-label">☀️ Presupuesto Solar:</span>
                          <span className="clan-fhub-stat-val">
                            {fortressData?.sunsSpent ?? 0} / {fortressData?.defenseSunsBudget ?? 2500} ☀️
                          </span>
                        </div>
                        <div className="clan-fhub-bar-track">
                          <div
                            className="clan-fhub-bar-fill clan-fhub-bar-fill--suns"
                            style={{
                              width: `${Math.max(0, Math.min(100, (((fortressData?.sunsSpent ?? 0) / (fortressData?.defenseSunsBudget ?? 2500)) * 100)))}%`,
                            }}
                          />
                        </div>

                        <div className="clan-fhub-pill-row">
                          <span className="clan-fhub-pill">
                            🌱 Formación: <strong>{fortressData?.layout?.length ? `${fortressData.layout.length} Unidades` : '¡Sin Plantas!'}</strong>
                          </span>
                          <span className="clan-fhub-pill">
                            🏟️ Campo: <strong>Arena 1 (5 Carriles)</strong>
                          </span>
                        </div>

                        <p className="clan-fhub-card__desc">
                          Modo de preparación táctica en la Arena 1. Planta consumiendo soles, mueve y reubica plantas entre carriles y guarda tu formación de combate.
                        </p>
                      </div>

                      <div className="clan-fhub-card__footer">
                        <button
                          type="button"
                          className="clan-fhub-card__btn clan-fhub-card__btn--defenses"
                          onClick={(e) => {
                            e.stopPropagation()
                            soundManager.playSound('click', 0.4)
                            setFortressSubView('defenses')
                          }}
                        >
                          🛡️ PREPARAR DEFENSAS (ARENA 1) →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 2: BASTIÓN EN PANTALLA COMPLETA */}
              {fortressSubView === 'bastion' && (
                <div className="clan-fortress-fullscreen-overlay">
                  {/* Top Bar con Flechita de Regreso */}
                  <div className="clan-fortress-subview-topbar">
                    <button
                      type="button"
                      className="clan-fortress-back-btn"
                      onClick={() => {
                        soundManager.playSound('click', 0.3)
                        setFortressSubView('hub')
                      }}
                      title="Regresar a las 3 cards de Fortaleza"
                    >
                      ← VOLVER A FORTALEZA
                    </button>
                    <div className="clan-fortress-subview-header-title">
                      <h3>🏰 BASTIÓN Y CENTRO DE ASALTOS</h3>
                      <small>Salud comunitaria, domo de protección y ofensiva de guerra</small>
                    </div>
                  </div>

                  <div className="clan-fortress-fullscreen-content">
                    {/* Hero Card Bastión */}
                    <div className="clan-fortress-hero-card">
                      <div className="clan-fortress-hero-header">
                        <div className="clan-fortress-hero-badge">
                          <span className="clan-fortress-badge-icon">{userClan.badge || '🏰'}</span>
                          <div>
                            <h2 className="clan-fortress-title">FORTALEZA DE {userClan.name.toUpperCase()}</h2>
                            <span className="clan-fortress-tag">[{userClan.tag}] • Modo 5 Carriles</span>
                          </div>
                        </div>

                        {/* Escudo Status Badge */}
                        {(() => {
                          const isShieldActive = fortressData?.shieldUntil && new Date(fortressData.shieldUntil).getTime() > Date.now()
                          if (isShieldActive) {
                            const minsLeft = Math.ceil((new Date(fortressData!.shieldUntil!).getTime() - Date.now()) / 60000)
                            const hrs = Math.floor(minsLeft / 60)
                            const mins = minsLeft % 60
                            return (
                              <div className="clan-fortress-shield-badge clan-fortress-shield--active" title="Protección activa post-asalto">
                                🛡️ ESCUDO ACTIVO ({hrs}h {mins}m)
                              </div>
                            )
                          }
                          return (
                            <div className="clan-fortress-shield-badge clan-fortress-shield--vulnerable" title="La fortaleza puede recibir asaltos de otros clanes">
                              ⚔️ VULNERABLE A ASALTOS
                            </div>
                          )
                        })()}
                      </div>

                      {/* Grid de Estadísticas de la Fortaleza */}
                      <div className="clan-fortress-stats-grid">
                        {/* Salud de la Base */}
                        <div className="clan-fstat-card">
                          <div className="clan-fstat-header">
                            <span className="clan-fstat-label">❤️ SALUD DEL BASTIÓN</span>
                            <span className="clan-fstat-num">
                              {fortressData?.baseHp ?? 500} / {fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500} HP
                            </span>
                          </div>
                          <div className="clan-fstat-bar-track">
                            <div
                              className="clan-fstat-bar-fill clan-fstat-bar-fill--hp"
                              style={{
                                width: `${Math.max(0, Math.min(100, (((fortressData?.baseHp ?? 500) / (fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500)) * 100)))}%`,
                              }}
                            />
                          </div>
                          {(fortressData?.baseHp ?? 500) < (fortressData?.maxBaseHp ?? fortressData?.maxHp ?? 500) && (
                            <button
                              type="button"
                              className="clan-fstat-repair-btn"
                              onClick={handleRepairBase}
                            >
                              🔧 Reparar (500 💎)
                            </button>
                          )}
                        </div>

                        {/* Presupuesto Solar */}
                        <div className="clan-fstat-card">
                          <div className="clan-fstat-header">
                            <span className="clan-fstat-label">☀️ PRESUPUESTO DEFENSIVO</span>
                            <span className="clan-fstat-num">
                              {fortressData?.sunsSpent ?? 0} / {fortressData?.defenseSunsBudget ?? 2500} ☀️
                            </span>
                          </div>
                          <div className="clan-fstat-bar-track">
                            <div
                              className="clan-fstat-bar-fill clan-fstat-bar-fill--suns"
                              style={{
                                width: `${Math.max(0, Math.min(100, (((fortressData?.sunsSpent ?? 0) / (fortressData?.defenseSunsBudget ?? 2500)) * 100)))}%`,
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="clan-fstat-donate-btn"
                            onClick={() => setShowFortressDonateModal(true)}
                          >
                            ☀️ Altar Solar (+Aumentar)
                          </button>
                        </div>

                        {/* Gemas en Riesgo */}
                        <div className="clan-fstat-card">
                          <div className="clan-fstat-header">
                            <span className="clan-fstat-label">💎 BOTÍN EN RIESGO (MÁX 60 💎)</span>
                            <span className="clan-fstat-num clan-fstat-num--gems">
                              {Math.min(60, Math.floor((fortressData?.vaultGems ?? userClan.vaultGems ?? 0) * 0.08))} / {(fortressData?.vaultGems ?? userClan.vaultGems ?? 0).toLocaleString()} 💎
                            </span>
                          </div>
                          <p className="clan-fstat-desc">
                            Saqueo por asalto: hasta 30💎 por 2⭐ y 60💎 por 3⭐. 100% va al Tesoro del Clan atacante (0 a cuenta personal).
                          </p>
                        </div>
                      </div>

                      {/* Acciones Principales */}
                      <div className="clan-fortress-cta-box">
                        <div className="clan-fcta-group">
                          <button
                            type="button"
                            className={`clan-fortress-action-btn clan-fortress-action-btn--edit ${!isOfficer ? 'clan-fortress-action-btn--disabled' : ''}`}
                            onClick={() => {
                              if (!isOfficer) {
                                setActiveDialog({
                                  title: 'Rol Insuficiente',
                                  message: 'Solo el Líder, Colíderes o Veteranos del clan tienen autorización para reorganizar la defensa del bastión.',
                                  icon: '🔒',
                                  type: 'warning',
                                })
                                return
                              }
                              setFortressSubView('defenses')
                            }}
                          >
                            🛠️ REORGANIZAR DEFENSAS (ARENA 1)
                          </button>
                          <span className="clan-fcta-hint">
                            {isOfficer ? 'Modo de preparación en vivo sobre los 5 carriles' : 'Requiere rol de Veterano o superior'}
                          </span>
                        </div>

                        <div className="clan-fcta-group">
                          <button
                            type="button"
                            className="clan-fortress-action-btn clan-fortress-action-btn--raid"
                            disabled={isSearchingRaid}
                            onClick={handleSearchFortressRaid}
                          >
                            {isSearchingRaid ? (
                              <>
                                <span className="clan-fortress-mini-spinner" />
                                BUSCANDO FORTALEZA...
                              </>
                            ) : (
                              '⚔️ ASALTAR FORTALEZA RIVAL'
                            )}
                          </button>
                          <div className="clan-fcta-cost-badge">
                            {isOfficer ? (
                              <span>🪙 <strong>500 Oro del Clan</strong> • Sin enfriamiento</span>
                            ) : (
                              <span>🪙 <strong>250 Oro Personal</strong> • ⚠️ 24h si pierdes</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tarjeta de Información y Reglas de Guerra */}
                    <div className="clan-fortress-rules-card">
                      <div className="clan-frules-title">
                        <span>📜</span>
                        <h4>REGLAS DE GUERRA DE FORTALEZAS & BOTÍN</h4>
                      </div>
                      <div className="clan-frules-grid">
                        <div className="clan-frule-item">
                          <div className="clan-frule-icon">⚔️</div>
                          <div>
                            <strong>Perspectiva 5 Carriles</strong>
                            <p>Los asaltos se disputan en el mapa de Arena 1 con profundidad ampliada y 5 líneas de combate simultáneas.</p>
                          </div>
                        </div>
                        <div className="clan-frule-item">
                          <div className="clan-frule-icon">⭐</div>
                          <div>
                            <strong>Escala de Saqueo por Estrellas</strong>
                            <p>1★ (20% daño base): 25% del botín. 2★ (50% daño base): 60% del botín. 3★ (Base destruida): 100% del botín.</p>
                          </div>
                        </div>
                        <div className="clan-frule-item">
                          <div className="clan-frule-icon">💎</div>
                          <div>
                            <strong>100% al Tesoro del Clan</strong>
                            <p>Todo el botín saqueado va directamente al tesoro del clan atacante (0 a cuenta personal) para financiar mejoras comunitarias.</p>
                          </div>
                        </div>
                        <div className="clan-frule-item">
                          <div className="clan-frule-icon">🛡️</div>
                          <div>
                            <strong>Escudo Defensivo de 4 Horas</strong>
                            <p>Tras sufrir un asalto, la fortaleza queda bajo un domo protector inviolable para reorganizar y reparar defensas.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 3: ÁRBOL MADRE EN PANTALLA COMPLETA */}
              {fortressSubView === 'tree' && (
                <div className="clan-fortress-fullscreen-overlay">
                  {/* Top Bar con Flechita de Regreso */}
                  <div className="clan-fortress-subview-topbar">
                    <button
                      type="button"
                      className="clan-fortress-back-btn"
                      onClick={() => {
                        soundManager.playSound('click', 0.3)
                        setFortressSubView('hub')
                      }}
                      title="Regresar a las 3 cards de Fortaleza"
                    >
                      ← VOLVER A FORTALEZA
                    </button>
                    <div className="clan-fortress-subview-header-title">
                      <h3>🌳 ÁRBOL MADRE DEL CLAN</h3>
                      <small>Nutrición colectiva, evolución milenaria y bendiciones de guerra</small>
                    </div>
                  </div>

                  <div className="clan-fortress-fullscreen-content">
                    <div className="clan-fortress-tree-card">
                      <div className="clan-ftree-header">
                        <div className="clan-ftree-title">
                          <span className="clan-ftree-icon">🌳</span>
                          <div>
                            <h4>ÁRBOL MADRE DEL CLAN (NIVEL {fortressData?.motherTreeLevel ?? 1} DE 4)</h4>
                            <p>
                              Aumenta soles (+500☀️), vida (+200 HP), cupos del clan, soles de asalto y bonificaciones de combate.
                            </p>
                          </div>
                        </div>
                        <span className="clan-ftree-badge">
                          {(fortressData?.motherTreeLevel ?? 1) >= 4 ? '⭐ MÁXIMO NIVEL TITÁNICO' : `PRÓXIMO NIVEL: ${(fortressData?.motherTreeLevel ?? 1) + 1}`}
                        </span>
                      </div>

                      <div className="clan-ftree-stats">
                        <div className="clan-ftree-stat-item">
                          <span>☀️ Límite Solar Defensivo:</span>
                          <strong>{1000 + (((fortressData?.motherTreeLevel ?? 1) - 1) * 500)} Soles</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>❤️ Salud Máxima de la Base:</span>
                          <strong>{500 + (((fortressData?.motherTreeLevel ?? 1) - 1) * 200)} HP</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>👥 Capacidad Máxima del Clan:</span>
                          <strong>{fortressData?.maxMembers || 15} Miembros</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>⚔️ Soles Iniciales en Asalto:</span>
                          <strong>{fortressData?.initialAttackSuns || 100} Soles</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>🚩 Estandarte de Conquista:</span>
                          <strong>+{fortressData?.conquestDamageBonusPct || 0}% Daño Ranking</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>⛲ Manantial Solar Diario:</span>
                          <strong>+{fortressData?.dailyPassiveSuns || 0} Soles/Día</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>👑 Bono VIP Oro Victoria:</span>
                          <strong>+{fortressData?.vipGoldBonusPct || 0}% Oro</strong>
                        </div>
                        <div className="clan-ftree-stat-item">
                          <span>🥊 Bono Daño en PvP:</span>
                          <strong>+{fortressData?.pvpDamageBonusPct || 0}% Daño</strong>
                        </div>
                      </div>

                      {(fortressData?.motherTreeLevel ?? 1) < 4 ? (
                        <div className="clan-ftree-progress-box">
                          <div className="clan-ftree-progress-row">
                            <span>💧 Agua:</span>
                            <div className="clan-ftree-bar-track">
                              <div
                                className="clan-ftree-bar-fill clan-ftree-bar-fill--water"
                                style={{
                                  width: `${Math.min(100, (((fortressData?.motherTreeWater ?? 0) / (fortressData?.nextTreeWaterReq || 150)) * 100))}%`,
                                }}
                              />
                            </div>
                            <strong>{fortressData?.motherTreeWater ?? 0} / {fortressData?.nextTreeWaterReq || 150}</strong>
                          </div>
                          <div className="clan-ftree-progress-row">
                            <span>🧪 Fertilizante:</span>
                            <div className="clan-ftree-bar-track">
                              <div
                                className="clan-ftree-bar-fill clan-ftree-bar-fill--fert"
                                style={{
                                  width: `${Math.min(100, (((fortressData?.motherTreeFertilizer ?? 0) / (fortressData?.nextTreeFertReq || 100)) * 100))}%`,
                                }}
                              />
                            </div>
                            <strong>{fortressData?.motherTreeFertilizer ?? 0} / {fortressData?.nextTreeFertReq || 100}</strong>
                          </div>
                          <div className="clan-ftree-progress-row">
                            <span>💎 Gemas:</span>
                            <div className="clan-ftree-bar-track">
                              <div
                                className="clan-ftree-bar-fill clan-ftree-bar-fill--gems"
                                style={{
                                  width: `${Math.min(100, (((fortressData?.motherTreeGems ?? 0) / (fortressData?.nextTreeGemsReq || 600)) * 100))}%`,
                                }}
                              />
                            </div>
                            <strong>{fortressData?.motherTreeGems ?? 0} / {fortressData?.nextTreeGemsReq || 600}</strong>
                          </div>

                          <button
                            type="button"
                            className="clan-ftree-nutrir-btn"
                            onClick={handleOpenMotherTreeModal}
                          >
                            💧🧪💎 NUTRIR Y SUBIR DE NIVEL EL ÁRBOL MADRE
                          </button>
                        </div>
                      ) : (
                        <div className="clan-ftree-maxed-banner">
                          <span>👑 ¡El Árbol Madre ha alcanzado su cúspide milenaria de poder (Nivel 4 Titánico)!</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBVIEW 4: DEFENSAS EN ARENA 1 (FORTRESS EDITOR PANTALLA COMPLETA) */}
              {fortressSubView === 'defenses' && userClan && fortressData && (
                <FortressEditor
                  clanId={userClan.id}
                  clanName={userClan.name}
                  initialLayout={fortressData.layout || []}
                  defenseSunsBudget={fortressData.defenseSunsBudget || 2500}
                  canEdit={isOfficer}
                  onClose={() => setFortressSubView('hub')}
                  onSaved={(newLayout, sunsSpent) => {
                    setFortressData((prev) => (prev ? { ...prev, layout: newLayout, sunsSpent } : null))
                    setFortressSubView('hub')
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 3: SEED DONATIONS & VAULT DEPOSITS */}
      {activeTab === 'donations' && (() => {
        const hasActiveRequestToday = donationRequests.some(
          (r) => r.requesterName === playerName && Date.now() - r.createdAt < 86400000
        )
        // Only valid deposits from real players: exclude foundation fee (game tax) and sistema
        const validDeposits = vaultDeposits.filter(
          (d) =>
            d.reason !== 'fund' &&
            d.depositorName?.toLowerCase() !== 'sistema' &&
            d.depositorName !== 'Fundador'
        )
        // Aggregate top depositors (Gems and Gold)
        const depositorGems: Record<string, number> = {}
        const depositorGold: Record<string, number> = {}
        validDeposits.forEach((d) => {
          const isGold = d.currency === 'gold' || d.reason === 'deposit_gold' || (d.amountGold && d.amountGold > 0)
          if (isGold) {
            depositorGold[d.depositorName] = (depositorGold[d.depositorName] || 0) + (d.amountGold || d.amountUsd || 0)
          } else {
            depositorGems[d.depositorName] = (depositorGems[d.depositorName] || 0) + (d.amountGems || d.amountUsd || 0)
          }
        })
        const allDepositorNames = Array.from(new Set([...Object.keys(depositorGems), ...Object.keys(depositorGold)]))
        const topDepositors = allDepositorNames
          .map((name) => ({
            name,
            gems: depositorGems[name] || 0,
            gold: depositorGold[name] || 0,
          }))
          .filter((d) => (vaultRankingFilter === 'gold' ? d.gold > 0 : d.gems > 0))
          .sort((a, b) => (vaultRankingFilter === 'gold' ? b.gold - a.gold : b.gems - a.gems))
          .slice(0, 5)

        return (
          <div className="clan-donations-pane">
            {/* Header & Mini Tabs */}
            <div className="clan-mini-tabs">
              <button
                type="button"
                className={`clan-mini-tab-btn ${donationSubTab === 'seeds' ? 'clan-mini-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setDonationSubTab('seeds')
                }}
              >
                🌱 Peticiones ({donationRequests.length})
              </button>
              <button
                type="button"
                className={`clan-mini-tab-btn ${donationSubTab === 'deposits' ? 'clan-mini-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setDonationSubTab('deposits')
                }}
              >
                💎 Tesoro ({validDeposits.length})
              </button>
            </div>

            {/* SUBTAB 1: SEEDS */}
            {donationSubTab === 'seeds' && (
              <div className="clan-donation-subpane">
                <div className="clan-donations-header">
                  <div>
                    <h4>🔄 PETICIÓN & DONACIÓN DE SEMILLAS</h4>
                    <p>Pide 1 copia diaria de plantas comunes, raras o épicas. Cada petición puede recibir hasta 3 copias de tus compañeros.</p>
                  </div>
                  <button
                    type="button"
                    className={`clan-request-seed-btn ${hasActiveRequestToday ? 'clan-request-seed-btn--disabled' : ''}`}
                    disabled={isDefeated || hasActiveRequestToday}
                    onClick={() => {
                      if (hasActiveRequestToday) {
                        showModalAlert('SOLICITUD EN CURSO', 'Ya tienes una solicitud de semillas activa hoy. Podrás pedir otra en 24 horas.', '⏳', 'warning')
                        return
                      }
                      setShowRequestSeedModal(true)
                    }}
                  >
                    {hasActiveRequestToday ? '⏳ SOLICITUD EN CURSO (1/DÍA)' : '🌱 PEDIR SEMILLA (1 COPIA)'}
                  </button>
                </div>

                <div className="clan-donations-list">
                  {donationRequests.length === 0 ? (
                    <div className="clan-empty-donations">
                      <span>🌱 No hay solicitudes de semillas activas en este momento. ¡Sé el primero en pedir!</span>
                    </div>
                  ) : (
                    donationRequests.map((req) => {
                      const donorCount = Math.max(req.donors.length, req.copiesReceived || 0)
                      const isMax = donorCount >= 3
                      const hasDonated = req.donors.some((d) => d.donorName === playerName)
                      const isMe = req.requesterName === playerName
                      const plantConf = PLANT_CONFIGS[req.plantId]
                      const plantIconSrc = plantConf?.packetActive || plantConf?.icon || req.plantIcon

                      return (
                        <div key={req.id} className="clan-donation-card">
                          <img src={plantIconSrc} alt={req.plantName} className="clan-donation-img" />
                          <div className="clan-donation-info">
                            <div className="clan-donation-top">
                              <span className="clan-donation-requester">👤 {req.requesterName}</span>
                              <span className="clan-donation-plant">{req.plantName}</span>
                            </div>
                            <div className="clan-donation-bar-wrap">
                              <div
                                className="clan-donation-bar"
                                style={{ width: `${(donorCount / 3) * 100}%` }}
                              />
                            </div>
                            <span className="clan-donation-count">{donorCount}/3 Donaciones Recibidas</span>
                          </div>

                          <div className="clan-donation-actions">
                            {isMax ? (
                              <span className="clan-donation-status clan-donation-status--full">✅ COMPLETADO</span>
                            ) : isMe ? (
                              <span className="clan-donation-status">TU SOLICITUD</span>
                            ) : hasDonated ? (
                              <span className="clan-donation-status clan-donation-status--done">YA DONASTE</span>
                            ) : (
                              <button
                                type="button"
                                className="clan-donate-btn"
                                disabled={isDefeated || (plantCopies[req.plantId] || 0) <= 0}
                                onClick={() => handleDonate(req)}
                              >
                                🎁 DONAR 1 COPIA (Tienes {plantCopies[req.plantId] || 0})
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 2: DEPOSITS & VAULT CONTRIBUTIONS */}
            {donationSubTab === 'deposits' && (
              <div className="clan-donation-subpane">
                {/* Vault summary banner */}
                <div className="clan-deposits-summary-row">
                  <div
                    className={`clan-deposit-stat-card ${vaultRankingFilter === 'gems' ? 'clan-deposit-stat-card--active' : ''}`}
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      setVaultRankingFilter('gems')
                    }}
                    title="Haz clic para ver el ranking de mayores aportantes de Gemas"
                  >
                    <span className="clan-deposit-stat-icon">💎</span>
                    <div>
                      <span className="clan-deposit-stat-val">{Number(userClan.vaultGems ?? userClan.vaultUsd).toFixed(0)} Gemas</span>
                      <span className="clan-deposit-stat-lbl">
                        Tesoro en Gemas {vaultRankingFilter === 'gems' && <strong style={{ color: '#38bdf8' }}>• (Ranking Activo)</strong>}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`clan-deposit-stat-card ${vaultRankingFilter === 'gold' ? 'clan-deposit-stat-card--active-gold' : ''}`}
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      setVaultRankingFilter('gold')
                    }}
                    title="Haz clic para ver el ranking de mayores aportantes de Oro"
                  >
                    <span className="clan-deposit-stat-icon">
                      <GoldIcon size={24} />
                    </span>
                    <div>
                      <span className="clan-deposit-stat-val" style={{ color: '#fbbf24' }}>
                        {Number(userClan.vaultGold || 0).toLocaleString()} Oro
                      </span>
                      <span className="clan-deposit-stat-lbl">
                        Tesoro en Oro {vaultRankingFilter === 'gold' && <strong style={{ color: '#fbbf24' }}>• (Ranking Activo)</strong>}
                      </span>
                    </div>
                  </div>
                  <div className="clan-deposits-cta-group">
                    <button
                      type="button"
                      className="clan-open-deposit-cta"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setShowDepositModal(true)
                      }}
                    >
                      💎 APORTAR GEMAS
                    </button>
                    <button
                      type="button"
                      className="clan-open-deposit-cta clan-open-deposit-cta--gold"
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setShowGoldDepositModal(true)
                      }}
                    >
                      Donaciones 💰
                    </button>
                  </div>
                </div>

                {/* Dual pane: Top Contributors & Realtime Feed */}
                <div className="clan-deposits-dual-layout">
                  {/* Left: Top Donators Podium */}
                  <div className="clan-top-depositors-box">
                    <h5>
                      {vaultRankingFilter === 'gold' ? '🏆 MAYORES APORTANTES DE ORO 💰' : '🏆 MAYORES APORTANTES DE GEMAS 💎'}
                    </h5>
                    <div className="clan-top-depositors-list">
                      {topDepositors.length === 0 ? (
                        <div style={{ padding: '16px 8px', color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                          {vaultRankingFilter === 'gold'
                            ? '💰 Aún no hay aportes de Oro registrados. ¡Sé el primero en donar!'
                            : '💎 Aún no hay aportes de Gemas registrados.'}
                        </div>
                      ) : (
                        topDepositors.map((dep, index) => {
                          const rankMedal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`
                          const isMe = dep.name === playerName
                          return (
                            <div key={dep.name} className={`clan-depositor-rank-row ${isMe ? 'clan-depositor-rank-row--me' : ''}`}>
                              <span className="clan-dep-medal">{rankMedal}</span>
                              <span className="clan-dep-name">
                                {dep.name} {isMe && <small>(Tú)</small>}
                              </span>
                              <div className="clan-dep-amounts-wrap">
                                {vaultRankingFilter === 'gold' ? (
                                  <span className="clan-dep-amount clan-dep-amount--gold">
                                    {dep.gold.toLocaleString()} <GoldIcon size={14} />
                                  </span>
                                ) : (
                                  <span className="clan-dep-amount">{dep.gems.toFixed(0)} 💎</span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Right: Chronological Deposit Logs Feed */}
                  <div className="clan-deposits-feed-box">
                    <h5>📜 REGISTRO DE DEPÓSITOS & ACTIVIDAD</h5>
                    <div className="clan-deposits-feed-list">
                      {validDeposits.map((dep) => {
                        const isGold = dep.currency === 'gold' || dep.reason === 'deposit_gold' || (dep.amountGold && dep.amountGold > 0)
                        const reasonLabels: Record<string, string> = {
                          deposit: '💎 Aporte de Gemas',
                          deposit_gold: '💰 Aporte de Oro',
                          join: '⚡ Cuota de Ingreso',
                          repair: '⚡ Reactivación del Clan',
                        }
                        const isMe = dep.depositorName === playerName
                        const timeAgoHours = Math.max(0, Math.round((Date.now() - dep.timestamp) / 3600000))
                        const timeText = timeAgoHours < 1 ? 'Hace unos instantes' : timeAgoHours < 24 ? `Hace ${timeAgoHours}h` : `Hace ${Math.round(timeAgoHours / 24)}d`

                        return (
                          <div key={dep.id} className={`clan-deposit-feed-item ${isGold ? 'clan-deposit-feed-item--gold' : ''}`}>
                            <div className="clan-deposit-feed-icon">{isGold ? <GoldIcon size={18} /> : '💎'}</div>
                            <div className="clan-deposit-feed-info">
                              <div className="clan-deposit-feed-top">
                                <strong>{dep.depositorName} {isMe && '(Tú)'}</strong>
                                <span className={`clan-deposit-feed-tag ${isGold ? 'clan-deposit-feed-tag--gold' : ''}`}>
                                  {isGold ? '💰 Aporte de Oro' : reasonLabels[dep.reason] || 'Aporte'}
                                </span>
                              </div>
                              <span className="clan-deposit-feed-time">{timeText}</span>
                            </div>
                            <div className={`clan-deposit-feed-amount ${isGold ? 'clan-deposit-feed-amount--gold' : ''}`}>
                              {isGold ? (
                                <>+{(dep.amountGold || dep.amountUsd || 0).toLocaleString()} <GoldIcon size={14} /></>
                              ) : (
                                `+${(dep.amountGems || dep.amountUsd || 0).toFixed(0)} 💎`
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* TAB 4: REWARDS */}
      {activeTab === 'rewards' && (
        <div className="clan-rewards-pane">
          {/* Card 1: 15/15 Full Clan Bonus */}
          <div className="clan-reward-card">
            <div className="clan-reward-card__icon">🎁</div>
            <div className="clan-reward-card__content">
              <h4>BONO DE CLAN LLENO (15/15 MIEMBROS)</h4>
              <p>
                Al alcanzar los 15 miembros, cada jugador recibe <strong>2 Sobres Pack Verde Básico</strong>.
                Solo se puede reclamar 1 vez por jugador para evitar abusos al cambiarse de clan.
              </p>
              <div className="clan-reward-status-row">
                <span>Progreso: <strong>{userClan.members.length}/15 Miembros</strong></span>
                {(hasClaimedRemoteBonus || ClanManager.hasClaimedFullClanBonus(playerName)) && (
                  <span className="clan-claimed-badge">✓ YA RECLAMADO EN ESTA CUENTA</span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="clan-claim-reward-btn"
              disabled={userClan.members.length < 15 || hasClaimedRemoteBonus || ClanManager.hasClaimedFullClanBonus(playerName) || isClaimingFullBonus}
              onClick={handleClaimFullBonus}
            >
              {(hasClaimedRemoteBonus || ClanManager.hasClaimedFullClanBonus(playerName))
                ? '✅ YA COBRADO'
                : isClaimingFullBonus
                ? '⏳ RECLAMANDO...'
                : '✨ RECLAMAR 2 SOBRES'}
            </button>
          </div>

          {/* Card 2: Season Vault Payout */}
          {(() => {
            const seasonStatus = SeasonManager.getSeasonStatus()
            const isClaimed = userClan.seasonPayoutClaimedMembers.includes(playerName)
            const WAR_RESERVE = 2800.0
            const currentVault = Number(userClan.vaultGems ?? userClan.vaultUsd)
            const surplusEarnings = Math.max(0, currentVault - WAR_RESERVE)
            const memberCount = Math.max(1, userClan.members.length)
            const myMember = userClan.members.find((m) => m.name === playerName || m.id === playerName)
            const myPct = typeof myMember?.rewardPercentage === 'number'
              ? myMember.rewardPercentage
              : (memberCount > 0 ? Math.round(100 / memberCount) : 0)
            const shareEstimate = Math.floor(surplusEarnings * (myPct / 100))
            const canWithdraw = seasonStatus.isEnded && surplusEarnings > 0 && !isClaimed && myPct > 0

            return (
              <div className="clan-reward-card clan-reward-card--payout">
                <div className="clan-reward-card__icon">💎</div>
                <div className="clan-reward-card__content">
                  <h4>RETIRO DE GANANCIAS DE TEMPORADA (EXCEDENTE)</h4>
                  <p>
                    Al finalizar los 30 días de temporada, las <strong>ganancias netas generadas en guerras</strong> (todo excedente por encima de la <strong>Reserva Operativa de Guerra de 2,800 Gemas 💎</strong>) se dividen <strong>porcentualmente</strong> entre los miembros del clan según la participación asignada por el Líder en los Ajustes del Clan. La reserva base de 2,800 💎 permanece siempre resguardada para los eventos y asaltos de guerra.
                  </p>
                  <div className="clan-reward-status-row">
                    <span>
                      Tesoro Total: <strong>{currentVault.toFixed(0)} 💎</strong> | Reserva: <strong>2,800 💎</strong> | Ganancias: <strong style={{ color: '#4ade80' }}>+{surplusEarnings.toFixed(0)} 💎</strong>
                    </span>
                  </div>
                  <div className="clan-reward-status-row">
                    <span>
                      Tu cuota de ganancia ({myPct}%): <strong style={{ color: surplusEarnings > 0 && myPct > 0 ? '#4ade80' : '#94a3b8' }}>
                        {shareEstimate} Gemas 💎 {myPct === 0 ? '(0% asignado)' : ''}
                      </strong>
                    </span>
                    {!seasonStatus.isEnded && (
                      <span className="clan-season-time-tag">⏳ Cierra en: {seasonStatus.formattedCountdown}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={`clan-claim-reward-btn clan-claim-reward-btn--gold ${!canWithdraw ? 'clan-claim-reward-btn--disabled' : ''}`}
                  disabled={!canWithdraw}
                  onClick={handleClaimSeasonPayout}
                  title={!seasonStatus.isEnded ? `Disponible en ${seasonStatus.formattedCountdown}` : surplusEarnings <= 0 ? 'No hay ganancias sobre la reserva de 2,800 💎' : 'Retirar ganancias'}
                >
                  {isClaimed
                    ? '✅ YA RETIRADO'
                    : !seasonStatus.isEnded
                    ? `⏳ RETIRAR (${seasonStatus.formattedCountdown})`
                    : surplusEarnings <= 0
                    ? '🛡️ RESERVA PROTEGIDA'
                    : '💎 RETIRAR GANANCIAS'}
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {/* DEPOSIT MODAL */}
      {showDepositModal && (
        <div className="clan-modal-backdrop" onClick={() => setShowDepositModal(false)}>
          <div className="clan-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>💎 APORTAR GEMAS AL TESORO DEL CLAN</h3>
            <p>
              Aporta Gemas al Tesoro de tu Clan para blindar su economía.
              <br />
              <strong style={{ color: '#fbbf24' }}>
                🎁 ¡Por cada 100 Gemas aportadas recibes +1 Ticket de Coliseo 🎟️ y +1 Tiro Gratis en la Ruleta 🎡!
              </strong>
            </p>

            <div className="clan-deposit-opts">
              {[50, 100, 200, 500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`clan-deposit-opt ${depositAmount === amt ? 'clan-deposit-opt--active' : ''}`}
                  onClick={() => setDepositAmount(amt)}
                >
                  {amt} 💎 Gemas
                </button>
              ))}
            </div>

            <div className="clan-modal-actions">
              <button type="button" className="clan-cancel-btn" onClick={() => setShowDepositModal(false)}>
                CANCELAR
              </button>
              <button type="button" className="clan-confirm-btn" onClick={handleDeposit}>
                CONFIRMAR DEPÓSITO ({depositAmount} 💎)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOLD DEPOSIT MODAL */}
      {showGoldDepositModal && (
        <div className="clan-modal-backdrop" onClick={() => setShowGoldDepositModal(false)}>
          <div className="clan-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>💰 DONAR ORO AL TESORO DEL CLAN</h3>
            <p>
              Aporta Oro al Tesoro del Clan para futuras acciones colectivas: búsqueda de partidas,
              aceleración de reparaciones, activación de escudos y mejoras comunitarias.
              <br />
              <strong style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <GoldIcon size={16} /> Tu Saldo Disponible: {(userGold ?? 0).toLocaleString()} Oro
              </strong>
            </p>

            <div className="clan-deposit-opts clan-deposit-opts--gold">
              {[500, 1000, 2500, 5000, 10000, 25000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`clan-deposit-opt ${goldDepositAmount === amt ? 'clan-deposit-opt--active clan-deposit-opt--gold' : ''}`}
                  onClick={() => setGoldDepositAmount(amt)}
                >
                  {amt.toLocaleString()} <GoldIcon size={13} /> Oro
                </button>
              ))}
            </div>

            {/* Custom Gold Amount Input */}
            <div className="clan-custom-gold-input-wrap">
              <label className="clan-custom-gold-label">O ingresa la cantidad exacta a donar:</label>
              <div className="clan-custom-gold-field">
                <span className="clan-custom-gold-icon">
                  <GoldIcon size={18} />
                </span>
                <input
                  type="number"
                  min="1"
                  max={userGold ?? 0}
                  value={goldDepositAmount || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setGoldDepositAmount(isNaN(val) ? 0 : Math.max(0, val))
                  }}
                  className="clan-custom-gold-input"
                  placeholder="Ej. 100"
                />
                <button
                  type="button"
                  className="clan-custom-gold-max-btn"
                  onClick={() => setGoldDepositAmount(Math.max(0, userGold ?? 0))}
                  title="Donar todo el oro disponible"
                >
                  MÁX
                </button>
              </div>
            </div>

            <div className="clan-modal-actions">
              <button type="button" className="clan-cancel-btn" onClick={() => setShowGoldDepositModal(false)}>
                CANCELAR
              </button>
              <button
                type="button"
                className="clan-confirm-btn clan-confirm-btn--gold"
                onClick={handleDepositGold}
              >
                CONFIRMAR DONACIÓN ({goldDepositAmount.toLocaleString()} ORO)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEED REQUEST MODAL */}
      {showRequestSeedModal && (
        <div className="clan-modal-backdrop" onClick={() => setShowRequestSeedModal(false)}>
          <div className="clan-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>🌱 SELECCIONA LA PLANTA A SOLICITAR</h3>
            <p>Recibirás hasta 3 copias donadas por tus compañeros de clan.</p>

            <div className="clan-plant-picker-grid">
              {(Object.keys(PLANT_CONFIGS) as PlantId[])
                .filter((p) => p !== 'melonpult') // No legendarias
                .map((plantId) => {
                  const p = PLANT_CONFIGS[plantId]
                  const isSelected = selectedRequestPlant === plantId
                  const packetImg = p.packetActive || p.icon
                  const copies = plantCopies[plantId] || 0
                  const isMax = copies >= 5
                  return (
                    <button
                      key={plantId}
                      type="button"
                      className={`clan-plant-picker-card ${isSelected ? 'clan-plant-picker-card--active' : ''} ${isMax ? 'clan-plant-picker-card--max' : ''}`}
                      onClick={() => setSelectedRequestPlant(plantId)}
                    >
                      <img src={packetImg} alt={p.name} />
                      <span>{p.name}</span>
                      <small style={{ color: isMax ? '#f59e0b' : undefined, fontWeight: isMax ? 'bold' : 'normal' }}>
                        {copies}/5 copias {isMax ? '⭐ (MÁX)' : ''}
                      </small>
                    </button>
                  )
                })}
            </div>

            {(plantCopies[selectedRequestPlant] || 0) >= 5 && (
              <p style={{ color: '#f59e0b', fontSize: '0.82rem', marginTop: '8px', textAlign: 'center' }}>
                ⚠️ Ya posees el tope de 5 copias de esta planta. ¡Germínala en el jardín para liberar espacio o selecciona otra!
              </p>
            )}

            <div className="clan-modal-actions">
              <button type="button" className="clan-cancel-btn" onClick={() => setShowRequestSeedModal(false)}>
                CANCELAR
              </button>
              <button
                type="button"
                className="clan-confirm-btn"
                disabled={(plantCopies[selectedRequestPlant] || 0) >= 5}
                onClick={handleCreateRequest}
              >
                PUBLICAR SOLICITUD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REDESIGNED CLAN SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="clan-modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="clan-modal-box clan-settings-modal-box clan-settings-modal-box--wide" onClick={(e) => e.stopPropagation()}>
            <div className="clan-modal-header-row">
              <div className="clan-modal-header-title">
                <span className="clan-modal-header-icon">⚙️</span>
                <div>
                  <h3>AJUSTES DEL CLAN</h3>
                  <p>Reglas de admisión, competitividad y reparto de recompensas</p>
                </div>
              </div>
              <button
                type="button"
                className="clan-modal-close-btn"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setShowSettingsModal(false)
                }}
                title="Cerrar ajustes"
              >
                ✕
              </button>
            </div>

            {/* Horizontal Settings Tabs Nav */}
            <div className="clan-settings-tabs-nav">
              <button
                type="button"
                className={`clan-settings-tab-btn ${settingsTab === 'general' ? 'clan-settings-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSettingsTab('general')
                }}
              >
                <span>⚙️</span> Admisión
              </button>
              <button
                type="button"
                className={`clan-settings-tab-btn ${settingsTab === 'competitive' ? 'clan-settings-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSettingsTab('competitive')
                }}
              >
                <span>⚔️</span> Competitivo
              </button>
              <button
                type="button"
                className={`clan-settings-tab-btn ${settingsTab === 'rewards' ? 'clan-settings-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSettingsTab('rewards')
                }}
              >
                <span>🎁</span> Rewards (%)
              </button>
              <button
                type="button"
                className={`clan-settings-tab-btn ${settingsTab === 'roles' ? 'clan-settings-tab-btn--active' : ''}`}
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setSettingsTab('roles')
                }}
              >
                <span>👑</span> Jerarquía & Roles
              </button>
            </div>

            <div className="clan-settings-tab-content">
              {settingsTab === 'general' && (
                <div className="clan-settings-grid">
                  {/* Setting 1: Privacy Type */}
                  <div className="clan-setting-card">
                    <div className="clan-setting-card__header">
                      <span className="clan-setting-card__icon">🔒</span>
                      <div>
                        <span className="clan-setting-card__title">Privacidad y Admisión</span>
                        <span className="clan-setting-card__desc">Define cómo ingresan los nuevos miembros</span>
                      </div>
                    </div>
                    <div className="clan-setting-tiles-grid">
                      <button
                        type="button"
                        className={`clan-setting-tile ${clanPrivacy === 'public' ? 'clan-setting-tile--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setClanPrivacy('public')
                        }}
                      >
                        <div className="clan-setting-tile__indicator" />
                        <span className="clan-setting-tile__emoji">🟢</span>
                        <div className="clan-setting-tile__info">
                          <strong>ABIERTO</strong>
                          <small>Ingreso directo (200 Gemas 💎)</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`clan-setting-tile ${clanPrivacy === 'request' ? 'clan-setting-tile--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setClanPrivacy('request')
                        }}
                      >
                        <div className="clan-setting-tile__indicator" />
                        <span className="clan-setting-tile__emoji">🟡</span>
                        <div className="clan-setting-tile__info">
                          <strong>CON SOLICITUD</strong>
                          <small>Requiere aprobación de Líder</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`clan-setting-tile ${clanPrivacy === 'closed' ? 'clan-setting-tile--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setClanPrivacy('closed')
                        }}
                      >
                        <div className="clan-setting-tile__indicator" />
                        <span className="clan-setting-tile__emoji">🔒</span>
                        <div className="clan-setting-tile__info">
                          <strong>CERRADO</strong>
                          <small>Solo invitación privada</small>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Setting 4: Auto-Accept Toggle */}
                  <div className="clan-setting-card clan-setting-card--toggle">
                    <div className="clan-setting-card__header">
                      <span className="clan-setting-card__icon">⚡</span>
                      <div>
                        <span className="clan-setting-card__title">Aprobación Instantánea</span>
                        <span className="clan-setting-card__desc">Acepta automáticamente a jugadores que cumplan el ELO y aporten 200 Gemas 💎</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`clan-setting-switch ${clanAutoAccept ? 'clan-setting-switch--active' : ''}`}
                      onClick={() => {
                        soundManager.playSound('click', 0.4)
                        setClanAutoAccept((v) => !v)
                      }}
                    >
                      <span className="clan-setting-switch__thumb" />
                      <span className="clan-setting-switch__label">
                        {clanAutoAccept ? 'ACTIVADO' : 'DESACTIVADO'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === 'competitive' && (
                <div className="clan-settings-grid">
                  {/* Setting 2: Minimum ELO Cups */}
                  <div className="clan-setting-card">
                    <div className="clan-setting-card__header">
                      <span className="clan-setting-card__icon">🏆</span>
                      <div>
                        <span className="clan-setting-card__title">Requisito ELO Mínimo</span>
                        <span className="clan-setting-card__desc">Copas necesarias en la Arena para solicitar ingreso</span>
                      </div>
                    </div>
                    <div className="clan-setting-elo-grid">
                      {[0, 1000, 1500, 2000].map((elo) => (
                        <button
                          key={elo}
                          type="button"
                          className={`clan-setting-elo-btn ${clanMinElo === elo ? 'clan-setting-elo-btn--active' : ''}`}
                          onClick={() => {
                            soundManager.playSound('click', 0.4)
                            setClanMinElo(elo)
                          }}
                        >
                          <span className="clan-setting-elo-val">{elo === 0 ? '0' : elo.toLocaleString()}</span>
                          <span className="clan-setting-elo-tag">{elo === 0 ? 'Sin Límite' : '🏆 Copas'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Setting 3: War Permissions */}
                  <div className="clan-setting-card">
                    <div className="clan-setting-card__header">
                      <span className="clan-setting-card__icon">⚔️</span>
                      <div>
                        <span className="clan-setting-card__title">Permisos de Guerra de Clanes</span>
                        <span className="clan-setting-card__desc">Quién puede declarar asaltos y aceptar guerras</span>
                      </div>
                    </div>
                    <div className="clan-setting-tiles-grid clan-setting-tiles-grid--2col">
                      <button
                        type="button"
                        className={`clan-setting-tile ${clanWarPermission === 'leaders' ? 'clan-setting-tile--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setClanWarPermission('leaders')
                        }}
                      >
                        <div className="clan-setting-tile__indicator" />
                        <span className="clan-setting-tile__emoji">👑</span>
                        <div className="clan-setting-tile__info">
                          <strong>LÍDER Y COLÍDERES</strong>
                          <small>Control estratégico exclusivo</small>
                        </div>
                      </button>

                      <button
                        type="button"
                        className={`clan-setting-tile ${clanWarPermission === 'all' ? 'clan-setting-tile--active' : ''}`}
                        onClick={() => {
                          soundManager.playSound('click', 0.4)
                          setClanWarPermission('all')
                        }}
                      >
                        <div className="clan-setting-tile__indicator" />
                        <span className="clan-setting-tile__emoji">⚔️</span>
                        <div className="clan-setting-tile__info">
                          <strong>TODOS LOS MIEMBROS</strong>
                          <small>Cualquiera puede iniciar asaltos</small>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {settingsTab === 'rewards' && (
                <div className="clan-rewards-settings-container">
                  {/* Rewards Banner */}
                  <div className="clan-rewards-settings-banner">
                    <div className="clan-rewards-banner-icon">💎</div>
                    <div className="clan-rewards-banner-text">
                      <strong>REPARTO SOCIAL DE GANANCIAS DE TEMPORADA</strong>
                      <p>
                        Asigna el porcentaje (%) de retiro del excedente de la bóveda para cada miembro según su participación, actividad o inversión.
                        Si alguien no participó puedes ponerle <strong>0%</strong>, o asignar más a los que invirtieron.
                        <strong> La suma total debe ser estrictamente 100%.</strong>
                      </p>
                    </div>
                  </div>

                  {/* Summary & Quick Distribution Row */}
                  {(() => {
                    const totalPct = Math.round(
                      (userClan?.members || []).reduce(
                        (sum, m) => sum + (Number(memberRewardShares[m.id]) || 0),
                        0
                      )
                    )
                    const isExactly100 = totalPct === 100
                    const isUnder = totalPct < 100
                    const isOver = totalPct > 100

                    const handleEquitableSplit = () => {
                      if (!userClan?.members?.length) return
                      soundManager.playSound('click', 0.4)
                      const count = userClan.members.length
                      const baseShare = Math.floor(100 / count)
                      const remainder = 100 - baseShare * count
                      const newShares: Record<string, number> = {}
                      userClan.members.forEach((m, idx) => {
                        newShares[m.id] = idx === 0 ? baseShare + remainder : baseShare
                      })
                      setMemberRewardShares(newShares)
                    }

                    return (
                      <div className="clan-rewards-stats-bar">
                        <div className="clan-rewards-total-badge-group">
                          <span className="clan-rewards-total-label">Suma de Cuotas:</span>
                          <span
                            className={`clan-reward-total-pill ${
                              isExactly100
                                ? 'clan-reward-total-pill--valid'
                                : isUnder
                                ? 'clan-reward-total-pill--under'
                                : 'clan-reward-total-pill--over'
                            }`}
                          >
                            {isExactly100 && '✅ '}
                            {isUnder && '⚠️ '}
                            {isOver && '❌ '}
                            {totalPct}% / 100%
                            {isUnder && ` (Falta ${100 - totalPct}%)`}
                            {isOver && ` (Excede ${totalPct - 100}%)`}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="clan-rewards-equal-btn"
                          onClick={handleEquitableSplit}
                          title="Distribuir porcentajes equitativamente entre todos los miembros"
                        >
                          ⚖️ Repartir Equitativo
                        </button>
                      </div>
                    )
                  })()}

                  {/* Members Share List */}
                  <div className="clan-rewards-members-list">
                    {(userClan?.members || []).map((m) => {
                      const currentVal = Number(memberRewardShares[m.id]) || 0

                      const updateVal = (val: number) => {
                        const clamped = Math.max(0, Math.min(100, Math.round(val)))
                        setMemberRewardShares((prev) => ({
                          ...prev,
                          [m.id]: clamped,
                        }))
                      }

                      return (
                        <div key={m.id} className="clan-reward-member-row">
                          <div className="clan-reward-member-info">
                            <span className="clan-reward-member-avatar">
                              {m.role === 'Líder' ? '👑' : m.role === 'Colíder' ? '🛡️' : '⚔️'}
                            </span>
                            <div className="clan-reward-member-meta">
                              <span className="clan-reward-member-name">
                                {m.name} {m.name === playerName ? '(Tú)' : ''}
                              </span>
                              <span className="clan-reward-member-role-elo">
                                {m.role} • 🏆 {m.elo ?? 1000} Copas
                              </span>
                            </div>
                          </div>

                          <div className="clan-reward-member-controls">
                            <button
                              type="button"
                              className="clan-reward-step-btn"
                              onClick={() => {
                                soundManager.playSound('click', 0.2)
                                updateVal(currentVal - 5)
                              }}
                              disabled={currentVal <= 0}
                              title="Restar 5%"
                            >
                              -5%
                            </button>

                            <div className="clan-reward-input-wrap">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="clan-reward-number-input"
                                value={currentVal}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10)
                                  updateVal(isNaN(v) ? 0 : v)
                                }}
                              />
                              <span className="clan-reward-input-pct">%</span>
                            </div>

                            <button
                              type="button"
                              className="clan-reward-step-btn"
                              onClick={() => {
                                soundManager.playSound('click', 0.2)
                                updateVal(currentVal + 5)
                              }}
                              disabled={currentVal >= 100}
                              title="Sumar 5%"
                            >
                              +5%
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {settingsTab === 'roles' && (
                <div className="clan-settings-roles-pane">
                  {/* Panel de Asignación Directa de Roles */}
                  <div className="clan-settings-roles-management">
                    <div className="clan-settings-roles-management-header">
                      <span className="clan-settings-roles-management-icon">👑</span>
                      <div>
                        <span className="clan-settings-roles-management-title">GESTIÓN Y ASIGNACIÓN DE ROLES</span>
                        <span className="clan-settings-roles-management-desc">
                          {isLeader
                            ? 'Como Líder puedes nombrar Colíderes, ascender a Veteranos o transferir el liderazgo.'
                            : 'Solo el Líder y Colíderes autorizados pueden modificar los rangos.'}
                        </span>
                      </div>
                    </div>

                    <div className="clan-settings-roles-members-list">
                      {(userClan?.members || []).map((m) => {
                        const isMe = m.name?.trim().toLowerCase() === playerName?.trim().toLowerCase()
                        const canManageThis = isLeader && !isMe

                        return (
                          <div key={m.id} className="clan-settings-role-member-row">
                            <div className="clan-settings-role-member-meta">
                              <span className="clan-settings-role-member-icon">
                                {m.role === 'Líder' ? '👑' : m.role === 'Colíder' ? '⚔️' : m.role === 'Veterano' ? '🛡️' : '🌱'}
                              </span>
                              <div>
                                <span className="clan-settings-role-member-name">
                                  {m.name} {isMe ? '(Tú)' : ''}
                                </span>
                                <span className="clan-settings-role-member-status">
                                  🏆 {m.elo ?? 1000} Copas • {m.donatedCount ?? 0} donaciones
                                </span>
                              </div>
                            </div>

                            <div className="clan-settings-role-member-actions">
                              <span className={`clan-role-badge clan-role--${(m.role || 'miembro').toLowerCase()}`}>
                                {m.role}
                              </span>
                              {canManageThis && (
                                <button
                                  type="button"
                                  className="clan-settings-change-role-btn"
                                  onClick={() => handleOpenRoleModal(m)}
                                  title={`Modificar rango de ${m.name}`}
                                >
                                  👑 ASIGNAR ROL
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="clan-roles-guide-divider">
                    <span>📖 REGLAMENTO Y FACULTADES POR RANGO</span>
                  </div>
                  <div className="clan-roles-guide-list">
                    <div className="clan-role-guide-card">
                      <div className="clan-role-guide-header">
                        <h4>👑 LÍDER (LEADER)</h4>
                        <span className="clan-role-badge clan-role--líder">Líder</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#cbd5e1' }}>
                        Máxima autoridad. Administra miembros, asigna roles, cuotas de reparto y ajustes de admisión.
                      </p>
                      <div className="clan-role-guide-perks">
                        <span className="clan-role-perk-badge">🛠️ <strong>Edición Fortaleza:</strong> Total (5 carriles)</span>
                        <span className="clan-role-perk-badge">⚔️ <strong>Asaltos:</strong> 500 Oro del Clan</span>
                        <span className="clan-role-perk-badge">⏳ <strong>Cooldown Derrota:</strong> Ninguno</span>
                        <span className="clan-role-perk-badge">🌳 <strong>Árbol Madre:</strong> Gestión Total</span>
                      </div>
                    </div>

                    <div className="clan-role-guide-card">
                      <div className="clan-role-guide-header">
                        <h4>⚔️ COLÍDER (CO-LEADER)</h4>
                        <span className="clan-role-badge clan-role--colíder">Colíder</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#cbd5e1' }}>
                        Mano derecha de gobernanza. Asistente oficial en defensa, ascensos a veterano y solicitudes.
                      </p>
                      <div className="clan-role-guide-perks">
                        <span className="clan-role-perk-badge">🛠️ <strong>Edición Fortaleza:</strong> Sí</span>
                        <span className="clan-role-perk-badge">⚔️ <strong>Asaltos:</strong> 500 Oro del Clan</span>
                        <span className="clan-role-perk-badge">⏳ <strong>Cooldown Derrota:</strong> Ninguno</span>
                        <span className="clan-role-perk-badge">👑 <strong>Roles:</strong> Ascender a Veterano / Degradar</span>
                        <span className="clan-role-perk-badge">📬 <strong>Admisiones:</strong> Aceptar/Rechazar</span>
                      </div>
                    </div>

                    <div className="clan-role-guide-card">
                      <div className="clan-role-guide-header">
                        <h4>🛡️ VETERANO (ELDER)</h4>
                        <span className="clan-role-badge clan-role--veterano">Veterano</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#cbd5e1' }}>
                        Guerrero distinguido y leal. Rango de honor para combatientes activos en asaltos.
                      </p>
                      <div className="clan-role-guide-perks">
                        <span className="clan-role-perk-badge">🛠️ <strong>Edición Fortaleza:</strong> Sí</span>
                        <span className="clan-role-perk-badge">⚔️ <strong>Asaltos:</strong> 500 Oro del Clan</span>
                        <span className="clan-role-perk-badge">⏳ <strong>Cooldown Derrota:</strong> Inmune a bloqueo de 24h</span>
                      </div>
                    </div>

                    <div className="clan-role-guide-card">
                      <div className="clan-role-guide-header">
                        <h4>🌱 MIEMBRO (MEMBER)</h4>
                        <span className="clan-role-badge clan-role--miembro">Miembro</span>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: '11.5px', color: '#cbd5e1' }}>
                        Rango inicial. Contribuye donando al Altar Solar y nutriendo el Árbol Madre del Clan.
                      </p>
                      <div className="clan-role-guide-perks">
                        <span className="clan-role-perk-badge">🛠️ <strong>Edición Fortaleza:</strong> No</span>
                        <span className="clan-role-perk-badge">⚔️ <strong>Asaltos:</strong> 250 Oro Personal</span>
                        <span className="clan-role-perk-badge">⚠️ <strong>Cooldown Derrota:</strong> Bloqueo de 24h si pierde (0⭐)</span>
                        <span className="clan-role-perk-badge">☀️ <strong>Donaciones:</strong> Altar Solar & Árbol</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="clan-modal-actions">
              <button
                type="button"
                className="clan-cancel-btn"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setShowSettingsModal(false)
                }}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="clan-confirm-btn"
                onClick={handleSaveClanSettings}
              >
                💾 GUARDAR AJUSTES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MEMBER KICK VALIDATION & CONFIRMATION MODAL */}
      {showKickModal && selectedMemberToKick && kickValidation && (
        <div className="clan-modal-backdrop" onClick={() => setShowKickModal(false)}>
          <div className="clan-modal-box clan-kick-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="clan-modal-header-row">
              <div className="clan-modal-header-title">
                <span className="clan-modal-header-icon">
                  {kickValidation.canKick ? '⚠️' : '🛡️'}
                </span>
                <div>
                  <h3>
                    {kickValidation.canKick
                      ? 'EXPULSIÓN DE MIEMBRO'
                      : 'PROTECCIÓN DE JUGADOR'}
                  </h3>
                  <p>Reglamento competitivo de Guerra de Clanes</p>
                </div>
              </div>
              <button
                type="button"
                className="clan-modal-close-btn"
                onClick={() => {
                  soundManager.playSound('click', 0.4)
                  setShowKickModal(false)
                }}
              >
                ✕
              </button>
            </div>

            <div className="clan-kick-target-card">
              <div className="clan-kick-target-left">
                <span className="clan-kick-avatar-badge">👤</span>
                <div>
                  <h4>{selectedMemberToKick.name}</h4>
                  <span className={`clan-role-badge clan-role--${selectedMemberToKick.role.toLowerCase()}`}>
                    {selectedMemberToKick.role}
                  </span>
                </div>
              </div>
              <div className="clan-kick-target-elo">
                <span>COPAS ELO</span>
                <strong>🏆 {selectedMemberToKick.elo}</strong>
              </div>
            </div>

            {/* Attendance breakdown stats */}
            <div className="clan-kick-stats-grid">
              <div className="clan-kick-stat-item">
                <span className="clan-kick-stat-val" style={{ color: '#4ade80' }}>
                  {kickValidation.details.roundsParticipated}
                </span>
                <span className="clan-kick-stat-lbl">Rondas Jugadas</span>
                <small>(Temporada)</small>
              </div>
              <div className="clan-kick-stat-item">
                <span
                  className="clan-kick-stat-val"
                  style={{
                    color: kickValidation.details.consecutiveMissed >= 2 ? '#f87171' : '#fbbf24',
                  }}
                >
                  {kickValidation.details.consecutiveMissed} / 2
                </span>
                <span className="clan-kick-stat-lbl">Semanas Inactivo</span>
                <small>(Consecutivas)</small>
              </div>
              <div className="clan-kick-stat-item">
                <span
                  className="clan-kick-stat-val"
                  style={{
                    color: kickValidation.details.walkoverLosses >= 1 ? '#ef4444' : '#94a3b8',
                  }}
                >
                  {kickValidation.details.walkoverLosses}
                </span>
                <span className="clan-kick-stat-lbl">Faltas por W.O.</span>
                <small>(No presentado)</small>
              </div>
            </div>

            {/* Explanation box */}
            <div
              className={`clan-kick-notice-box ${
                kickValidation.canKick ? 'clan-kick-notice-box--eligible' : 'clan-kick-notice-box--protected'
              }`}
            >
              <div className="clan-kick-notice-icon">
                {kickValidation.isProtected
                  ? '🛡️'
                  : kickValidation.canKick
                  ? '⚠️'
                  : 'ℹ️'}
              </div>
              <div className="clan-kick-notice-text">
                <strong>
                  {kickValidation.isProtected
                    ? 'JUGADOR BLINDADO HASTA FIN DE TEMPORADA'
                    : kickValidation.canKick
                    ? 'MOTIVO VÁLIDO DE EXPULSIÓN DETECTADO'
                    : 'FALTAS INSUFICIENTES PARA EXPULSIÓN'}
                </strong>
                <p>{kickValidation.message}</p>
              </div>
            </div>

            <div className="clan-modal-actions">
              {kickValidation.canKick ? (
                <>
                  <button
                    type="button"
                    className="clan-cancel-btn"
                    onClick={() => {
                      soundManager.playSound('click', 0.4)
                      setShowKickModal(false)
                    }}
                  >
                    CANCELAR
                  </button>
                  <button
                    type="button"
                    className="clan-kick-confirm-btn"
                    onClick={handleExecuteKick}
                  >
                    👢 CONFIRMAR EXPULSIÓN
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="clan-confirm-btn"
                  style={{ width: '100%' }}
                  onClick={() => {
                    soundManager.playSound('click', 0.4)
                    setShowKickModal(false)
                  }}
                >
                  ENTENDIDO
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIRECT INVITATION MODAL (Solo Líder) */}
      {showInviteModal && userClan && (
        <div className="clan-modal-backdrop" onClick={() => setShowInviteModal(false)}>
          <div className="clan-modal-box clan-invite-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="clan-modal-header-row">
              <div className="clan-modal-header-title">
                <span className="clan-modal-header-icon">✉️</span>
                <div>
                  <h3>INVITAR JUGADOR AL CLAN</h3>
                  <p>Envía una invitación directa al Lobby de otro jugador</p>
                </div>
              </div>
              <button
                type="button"
                className="clan-modal-close-btn"
                onClick={() => setShowInviteModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendInvitation} className="clan-invite-form">
              <div className="clan-invite-notice">
                <p>
                  El jugador recibirá un <strong>pop-up interactivo en su Lobby</strong> para unirse a <strong>{userClan.name}</strong> por <strong>200 Gemas 💎</strong> (las cuales se sumarán al Tesoro de tu Clan).
                </p>
              </div>

              <div className="clan-invite-field">
                <label htmlFor="invite-target-input">Nombre exacto del jugador:</label>
                <input
                  id="invite-target-input"
                  type="text"
                  className="clan-invite-input"
                  placeholder="Ejemplo: AdrianIrod, JonSnow, Guerrero..."
                  value={inviteTargetUsername}
                  onChange={(e) => setInviteTargetUsername(e.target.value)}
                  maxLength={30}
                  autoFocus
                />
              </div>

              <div className="clan-modal-actions">
                <button
                  type="submit"
                  className="clan-confirm-btn clan-confirm-btn--invite"
                  disabled={isSendingInvite || !inviteTargetUsername.trim()}
                >
                  {isSendingInvite ? 'ENVIANDO...' : '✉️ ENVIAR INVITACIÓN'}
                </button>
                <button
                  type="button"
                  className="clan-cancel-btn"
                  onClick={() => setShowInviteModal(false)}
                >
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM IN-GAME POPUP DIALOG */}
      {renderCustomDialog()}

      {/* FLOATING MINIMIZABLE CLAN CHAT */}
      {userClan && (
        <div className={`clan-floating-chat ${isChatOpen ? 'clan-floating-chat--open' : ''}`}>
          {!isChatOpen ? (
            <button
              type="button"
              className="clan-chat-toggle-btn"
              onClick={() => setIsChatOpen(true)}
              title="Abrir Chat del Clan"
            >
              <span className="clan-chat-icon">💬</span>
              {chatMessages.length > 0 && (
                <span className="clan-chat-badge">{chatMessages.length}</span>
              )}
            </button>
          ) : (
            <div className="clan-chat-window">
              <div className="clan-chat-header" onClick={() => setIsChatOpen(false)}>
                <div className="clan-chat-header-info">
                  <span className="clan-chat-icon">💬</span>
                  <strong>CHAT: {userClan.name}</strong>
                </div>
                <button
                  type="button"
                  className="clan-chat-minimize-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsChatOpen(false)
                  }}
                  title="Minimizar"
                >
                  ▼
                </button>
              </div>

              <div className="clan-chat-body">
                {chatMessages.map((msg) => {
                  const isMe = msg.sender === playerName
                  return (
                    <div key={msg.id} className={`clan-chat-msg ${isMe ? 'clan-chat-msg--me' : ''}`}>
                      <div className="clan-chat-msg-top">
                        <span className={`clan-chat-sender ${isMe && hasVipPass ? 'vip-gold-text' : ''}`}>
                          {isMe && hasVipPass && '👑 '}
                          {msg.sender}
                        </span>
                        <span className={`clan-chat-role-tag clan-chat-role-tag--${msg.role.toLowerCase()}`}>
                          {msg.role}
                        </span>
                        <span className="clan-chat-time">{msg.time}</span>
                      </div>
                      <div className="clan-chat-text">{msg.text}</div>
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              <form className="clan-chat-footer" onSubmit={handleSendChatMessage}>
                <input
                  type="text"
                  placeholder="Escribe a tus compañeros..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={100}
                />
                <button type="submit" className="clan-chat-send-btn">
                  ➤
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Modales de Fortaleza */}
      {showFortressEditor && userClan && fortressData && (
        <FortressEditor
          clanId={userClan.id}
          clanName={userClan.name}
          initialLayout={fortressData.layout || []}
          defenseSunsBudget={fortressData.defenseSunsBudget || 2500}
          canEdit={isOfficer}
          onClose={() => setShowFortressEditor(false)}
          onSaved={(newLayout, sunsSpent) => {
            setFortressData((prev) => (prev ? { ...prev, layout: newLayout, sunsSpent } : null))
            setShowFortressEditor(false)
          }}
        />
      )}

      {showFortressDonateModal && userClan && (
        <FortressDonateModal
          isOpen={showFortressDonateModal}
          onClose={() => setShowFortressDonateModal(false)}
          onSuccess={(newBudget, _sunsGained) => {
            setFortressData((prev) => (prev ? { ...prev, defenseSunsBudget: newBudget } : null))
            if (onRefreshUserData) void onRefreshUserData()
          }}
          plantCopies={plantCopies}
          userGold={userGold}
          userGems={userGems}
          clanName={userClan.name}
          currentBudget={fortressData?.defenseSunsBudget || 1000}
          maxBudget={fortressData?.maxDefenseSunsBudget || (1000 + (((fortressData?.motherTreeLevel || 1) - 1) * 500))}
        />
      )}

      {/* MODAL NUTRIR ÁRBOL MADRE DEL CLAN */}
      {showMotherTreeModal && userClan && fortressData && (
        <div className="clan-modal-backdrop" onClick={() => !isSubmittingTree && setShowMotherTreeModal(false)}>
          <div className="clan-modal-box clan-tree-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="clan-modal-header-row">
              <div className="clan-modal-header-title">
                <span className="clan-modal-header-icon">🌳</span>
                <div>
                  <h3>NUTRIR EL ÁRBOL MADRE</h3>
                  <p>Aporta recursos para subirlo al Nivel {(fortressData.motherTreeLevel || 1) + 1}</p>
                </div>
              </div>
              <button
                type="button"
                className="clan-modal-close-btn"
                onClick={() => setShowMotherTreeModal(false)}
                disabled={isSubmittingTree}
              >
                ✕
              </button>
            </div>

            <div className="clan-tree-inputs-grid">
              {/* Agua */}
              <div className="clan-tree-input-card">
                <div className="clan-tree-input-info">
                  <label>💧 Agua de Cultivo</label>
                  <small>Tienes: {userFarmingInv.water} 💧 • Requerido: {fortressData.motherTreeWater || 0}/{fortressData.nextTreeWaterReq || 150}</small>
                </div>
                <div className="clan-tree-input-controls">
                  <input
                    type="number"
                    min={0}
                    max={userFarmingInv.water}
                    value={motherTreeWaterInput}
                    onChange={(e) => setMotherTreeWaterInput(Math.max(0, Math.min(userFarmingInv.water, parseInt(e.target.value) || 0)))}
                  />
                  <button
                    type="button"
                    className="clan-tree-max-btn"
                    onClick={() => {
                      const needed = Math.max(0, (fortressData.nextTreeWaterReq || 150) - (fortressData.motherTreeWater || 0))
                      setMotherTreeWaterInput(Math.min(userFarmingInv.water, needed))
                    }}
                  >
                    MÁX
                  </button>
                </div>
              </div>

              {/* Fertilizante */}
              <div className="clan-tree-input-card">
                <div className="clan-tree-input-info">
                  <label>🧪 Fertilizante</label>
                  <small>Tienes: {userFarmingInv.fertilizer} 🧪 • Requerido: {fortressData.motherTreeFertilizer || 0}/{fortressData.nextTreeFertReq || 100}</small>
                </div>
                <div className="clan-tree-input-controls">
                  <input
                    type="number"
                    min={0}
                    max={userFarmingInv.fertilizer}
                    value={motherTreeFertInput}
                    onChange={(e) => setMotherTreeFertInput(Math.max(0, Math.min(userFarmingInv.fertilizer, parseInt(e.target.value) || 0)))}
                  />
                  <button
                    type="button"
                    className="clan-tree-max-btn"
                    onClick={() => {
                      const needed = Math.max(0, (fortressData.nextTreeFertReq || 100) - (fortressData.motherTreeFertilizer || 0))
                      setMotherTreeFertInput(Math.min(userFarmingInv.fertilizer, needed))
                    }}
                  >
                    MÁX
                  </button>
                </div>
              </div>

              {/* Gemas */}
              <div className="clan-tree-input-card">
                <div className="clan-tree-input-info">
                  <label>💎 Gemas</label>
                  <small>Tienes: {userGems} 💎 • Requerido: {fortressData.motherTreeGems || 0}/{fortressData.nextTreeGemsReq || 600}</small>
                </div>
                <div className="clan-tree-input-controls">
                  <input
                    type="number"
                    min={0}
                    max={userGems}
                    value={motherTreeGemsInput}
                    onChange={(e) => setMotherTreeGemsInput(Math.max(0, Math.min(userGems, parseInt(e.target.value) || 0)))}
                  />
                  <button
                    type="button"
                    className="clan-tree-max-btn"
                    onClick={() => {
                      const needed = Math.max(0, (fortressData.nextTreeGemsReq || 600) - (fortressData.motherTreeGems || 0))
                      setMotherTreeGemsInput(Math.min(userGems, needed))
                    }}
                  >
                    MÁX
                  </button>
                </div>
              </div>
            </div>

            <div className="clan-modal-actions">
              <button
                type="button"
                className="clan-cancel-btn"
                onClick={() => setShowMotherTreeModal(false)}
                disabled={isSubmittingTree}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="clan-confirm-btn"
                onClick={handleContributeMotherTree}
                disabled={isSubmittingTree || (motherTreeWaterInput <= 0 && motherTreeFertInput <= 0 && motherTreeGemsInput <= 0)}
              >
                {isSubmittingTree ? 'NUTRINDO...' : '💧🧪💎 CONSAGRAR APORTE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR ROL A MIEMBRO */}
      {showRoleModal && selectedMemberForRole && (
        <div className="clan-modal-backdrop" onClick={() => !isSubmittingRole && setShowRoleModal(false)}>
          <div className="clan-modal-box clan-role-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="clan-modal-header-row">
              <div className="clan-modal-header-title">
                <span className="clan-modal-header-icon">👑</span>
                <div>
                  <h3>ASIGNAR ROL A {selectedMemberForRole.name.toUpperCase()}</h3>
                  <p>Rango actual: <strong>{selectedMemberForRole.role}</strong> • {selectedMemberForRole.elo} Copas</p>
                </div>
              </div>
              <button
                type="button"
                className="clan-modal-close-btn"
                onClick={() => setShowRoleModal(false)}
                disabled={isSubmittingRole}
              >
                ✕
              </button>
            </div>

            <div className="clan-role-select-grid">
              {/* Colíder (Solo Líder) */}
              {isLeader && (
                <div
                  className={`clan-role-card-opt ${selectedRoleToAssign === 'coleader' ? 'clan-role-card-opt--selected' : ''}`}
                  onClick={() => setSelectedRoleToAssign('coleader')}
                >
                  <h5>⚔️ Colíder</h5>
                  <p>Mano derecha. Edita fortaleza, asalta con oro del clan (sin cooldown), acepta ingresos y promueve veteranos.</p>
                </div>
              )}

              {/* Veterano (Líder y Colíder) */}
              <div
                className={`clan-role-card-opt ${selectedRoleToAssign === 'elder' ? 'clan-role-card-opt--selected' : ''}`}
                onClick={() => setSelectedRoleToAssign('elder')}
              >
                <h5>🛡️ Veterano</h5>
                <p>Guerrero de honor. Edita fortaleza y asalta con oro del clan sin bloqueo de 24h tras derrota.</p>
              </div>

              {/* Miembro (Líder y Colíder) */}
              <div
                className={`clan-role-card-opt ${selectedRoleToAssign === 'member' ? 'clan-role-card-opt--selected' : ''}`}
                onClick={() => setSelectedRoleToAssign('member')}
              >
                <h5>🌱 Miembro</h5>
                <p>Rango inicial. Asalta con oro propio (250🪙) y sufre bloqueo de 24h tras derrota. Puede donar al altar.</p>
              </div>
            </div>

            <div className="clan-modal-actions">
              <button
                type="button"
                className="clan-cancel-btn"
                onClick={() => setShowRoleModal(false)}
                disabled={isSubmittingRole}
              >
                CANCELAR
              </button>
              <button
                type="button"
                className="clan-confirm-btn"
                onClick={handleConfirmChangeRole}
                disabled={isSubmittingRole}
              >
                {isSubmittingRole ? 'GUARDANDO...' : '👑 CONFIRMAR NUEVO ROL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
