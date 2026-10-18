import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface EmoteItem {
  id: string
  label: string
  description: string
  imageSrc: string
  webpSrc: string
  priceGold: number
  priceGems: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  isDefault?: boolean
}

export const DEFAULT_UNLOCKED_EMOTES = ['hola', 'gg', 'jaja']

export const EMOTES_CATALOG: EmoteItem[] = [
  {
    id: 'hola',
    label: 'HOLA',
    description: '¡Saludo amistoso y alegre para iniciar la batalla!',
    imageSrc: '/game-assets/emotes/hola.png',
    webpSrc: '/game-assets/emotes/hola.webp',
    priceGold: 0,
    priceGems: 0,
    rarity: 'common',
    isDefault: true,
  },
  {
    id: 'gg',
    label: 'GG',
    description: '¡Buena partida y respeto mutuo entre combatientes!',
    imageSrc: '/game-assets/emotes/gg.png',
    webpSrc: '/game-assets/emotes/gg.webp',
    priceGold: 0,
    priceGems: 0,
    rarity: 'common',
    isDefault: true,
  },
  {
    id: 'jaja',
    label: 'JAJA',
    description: '¡Risas picantes y diversión pura sobre el césped!',
    imageSrc: '/game-assets/emotes/jaja.png',
    webpSrc: '/game-assets/emotes/jaja.webp',
    priceGold: 0,
    priceGems: 0,
    rarity: 'common',
    isDefault: true,
  },
  {
    id: 'grr',
    label: 'ENOJADO',
    description: '¡Furia picante! Un ají rojo que echa chispas por la derrota.',
    imageSrc: '/game-assets/emotes/grr.png',
    webpSrc: '/game-assets/emotes/grr.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'rare',
  },
  {
    id: 'piedad',
    label: 'PIEDAD',
    description: '¡Súplica cómica de cactus para que perdonen tu torre!',
    imageSrc: '/game-assets/emotes/piedad.png',
    webpSrc: '/game-assets/emotes/piedad.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'common',
  },
  {
    id: 'que_rico',
    label: 'QUÉ RICO',
    description: '¡Pulgar arriba y satisfacción absoluta de la Nuez!',
    imageSrc: '/game-assets/emotes/que_rico.png',
    webpSrc: '/game-assets/emotes/que_rico.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'common',
  },
  {
    id: 'unete_clan',
    label: 'ÚNETE A MI CLAN',
    description: '¡Llamado de hermandad! Invita a tus rivales a tu clan.',
    imageSrc: '/game-assets/emotes/unete_clan.png',
    webpSrc: '/game-assets/emotes/unete_clan.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'rare',
  },
  {
    id: 'papi_dagger',
    label: 'PAPI DAGGER',
    description: '¡Nivel legendario! Gafas oscuras y swagger de campeón absoluto.',
    imageSrc: '/game-assets/emotes/papi_dagger.png',
    webpSrc: '/game-assets/emotes/papi_dagger.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'legendary',
  },
  {
    id: 'wow',
    label: 'WOW',
    description: '¡Asombro total con reflejos de cristal ante una jugada maestra!',
    imageSrc: '/game-assets/emotes/wow.png',
    webpSrc: '/game-assets/emotes/wow.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'epic',
  },
  {
    id: 'triste',
    label: 'TRISTE',
    description: '¡Lágrimas dramáticas y pucheros tras una mala racha!',
    imageSrc: '/game-assets/emotes/triste.png',
    webpSrc: '/game-assets/emotes/triste.webp',
    priceGold: 1200,
    priceGems: 100,
    rarity: 'common',
  },
]

const STORAGE_KEY = 'plant_arena_unlocked_emotes'

/**
 * Obtiene la lista de IDs de emotes desbloqueados por el jugador.
 */
export function getUnlockedEmoteIds(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_UNLOCKED_EMOTES]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_UNLOCKED_EMOTES))
      return [...DEFAULT_UNLOCKED_EMOTES]
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // Garantizar que los default siempre estén
      const set = new Set([...DEFAULT_UNLOCKED_EMOTES, ...parsed])
      return Array.from(set)
    }
  } catch {
    // ignore parse error
  }
  return [...DEFAULT_UNLOCKED_EMOTES]
}

/**
 * Verifica si un emote específico está desbloqueado para el usuario.
 */
export function isEmoteUnlocked(emoteId: string): boolean {
  const unlocked = getUnlockedEmoteIds()
  return unlocked.includes(emoteId.toLowerCase().trim())
}

/**
 * Sincroniza emotes recibidos del perfil de Supabase con el almacenamiento local.
 */
export function syncUnlockedEmotesFromProfile(emotes: string[] | null | undefined): void {
  if (!emotes || !Array.isArray(emotes) || typeof window === 'undefined') return
  try {
    const current = getUnlockedEmoteIds()
    const merged = Array.from(new Set([...current, ...DEFAULT_UNLOCKED_EMOTES, ...emotes]))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent('plant_arena_emotes_updated', { detail: merged }))
  } catch {
    // ignore storage error
  }
}

/**
 * Desbloquea un emote en el almacenamiento local y notifica a los oyentes.
 */
export function unlockEmoteLocal(emoteId: string): string[] {
  const current = getUnlockedEmoteIds()
  if (!current.includes(emoteId)) {
    current.push(emoteId)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
        window.dispatchEvent(new CustomEvent('plant_arena_emotes_updated', { detail: current }))
      } catch {}
    }
  }
  return current
}

/**
 * Obtiene la definición completa de un emote por su ID.
 */
export function getEmoteById(emoteId: string): EmoteItem | undefined {
  return EMOTES_CATALOG.find((e) => e.id.toLowerCase() === emoteId.toLowerCase().trim())
}

/**
 * Ejecuta la compra de un emote eligiendo entre Oro o Gemas.
 * Conecta con la RPC en Supabase y actualiza balances y almacenamiento local.
 */
export async function purchaseEmote(
  emoteId: string,
  currency: 'gold' | 'gems' = 'gold',
  currentGold: number = 0,
  currentGems: number = 0
): Promise<{
  success: boolean
  error?: string
  newGold?: number
  newGems?: number
  unlockedEmotes?: string[]
}> {
  const emote = getEmoteById(emoteId)
  if (!emote) {
    return { success: false, error: 'Emote no encontrado en el catálogo' }
  }

  if (isEmoteUnlocked(emoteId)) {
    return {
      success: true,
      newGold: currentGold,
      newGems: currentGems,
      unlockedEmotes: getUnlockedEmoteIds(),
    }
  }

  if (currency === 'gold' && currentGold < emote.priceGold) {
    return {
      success: false,
      error: `Oro insuficiente. Necesitas ${emote.priceGold.toLocaleString()} Monedas de Oro para este emote.`,
    }
  }

  if (currency === 'gems' && currentGems < emote.priceGems) {
    return {
      success: false,
      error: `Gemas insuficientes. Necesitas ${emote.priceGems.toLocaleString()} 💎 Gemas para este emote.`,
    }
  }

  // Si Supabase está disponible, llamar a la RPC authoritative
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await (supabase.rpc as any)('purchase_emote', {
        p_emote_id: emoteId,
        p_currency: currency,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      const res = data as any
      if (res && res.success) {
        const nextUnlocked = Array.isArray(res.unlocked_emotes)
          ? res.unlocked_emotes
          : unlockEmoteLocal(emoteId)
        syncUnlockedEmotesFromProfile(nextUnlocked)

        const finalGold = typeof res.gold_balance === 'number'
          ? res.gold_balance
          : typeof res.gold_balance === 'string'
          ? parseInt(res.gold_balance, 10)
          : (currency === 'gold' ? currentGold - emote.priceGold : currentGold)

        const finalGems = typeof res.gems_balance === 'number'
          ? res.gems_balance
          : typeof res.gems_balance === 'string'
          ? parseFloat(res.gems_balance)
          : (currency === 'gems' ? currentGems - emote.priceGems : currentGems)

        return {
          success: true,
          newGold: finalGold,
          newGems: finalGems,
          unlockedEmotes: nextUnlocked,
        }
      } else {
        return { success: false, error: res?.error || 'No se pudo completar la compra' }
      }
    } catch (e: any) {
      console.warn('Fallo en RPC purchase_emote, aplicando fallback local:', e)
    }
  }

  // Fallback local cuando offline o anon
  const updatedUnlocked = unlockEmoteLocal(emoteId)
  const remainingGold = currency === 'gold' ? Math.max(0, currentGold - emote.priceGold) : currentGold
  const remainingGems = currency === 'gems' ? Math.max(0, currentGems - emote.priceGems) : currentGems
  return {
    success: true,
    newGold: remainingGold,
    newGems: remainingGems,
    unlockedEmotes: updatedUnlocked,
  }
}

/**
 * Helper de compatibilidad para compra con Oro.
 */
export async function purchaseEmoteWithGold(
  emoteId: string,
  currentGold: number
): Promise<{
  success: boolean
  error?: string
  newGold?: number
  unlockedEmotes?: string[]
}> {
  const res = await purchaseEmote(emoteId, 'gold', currentGold, 0)
  return {
    success: res.success,
    error: res.error,
    newGold: res.newGold,
    unlockedEmotes: res.unlockedEmotes,
  }
}
