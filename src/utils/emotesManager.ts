import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export interface EmoteItem {
  id: string
  label: string
  description: string
  imageSrc: string
  webpSrc: string
  priceGold: number
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
    rarity: 'common',
    isDefault: true,
  },
  {
    id: 'grr',
    label: 'ENOJADO',
    description: '¡Furia picante! Un ají rojo que echa chispas por la derrota.',
    imageSrc: '/game-assets/emotes/grr.png',
    webpSrc: '/game-assets/emotes/grr.webp',
    priceGold: 300,
    rarity: 'rare',
  },
  {
    id: 'piedad',
    label: 'PIEDAD',
    description: '¡Súplica cómica de cactus para que perdonen tu torre!',
    imageSrc: '/game-assets/emotes/piedad.png',
    webpSrc: '/game-assets/emotes/piedad.webp',
    priceGold: 250,
    rarity: 'common',
  },
  {
    id: 'que_rico',
    label: 'QUÉ RICO',
    description: '¡Pulgar arriba y satisfacción absoluta de la Nuez!',
    imageSrc: '/game-assets/emotes/que_rico.png',
    webpSrc: '/game-assets/emotes/que_rico.webp',
    priceGold: 250,
    rarity: 'common',
  },
  {
    id: 'unete_clan',
    label: 'ÚNETE A MI CLAN',
    description: '¡Llamado de hermandad! Invita a tus rivales a tu clan.',
    imageSrc: '/game-assets/emotes/unete_clan.png',
    webpSrc: '/game-assets/emotes/unete_clan.webp',
    priceGold: 350,
    rarity: 'rare',
  },
  {
    id: 'papi_dagger',
    label: 'PAPI DAGGER',
    description: '¡Nivel legendario! Gafas oscuras y swagger de campeón absoluto.',
    imageSrc: '/game-assets/emotes/papi_dagger.png',
    webpSrc: '/game-assets/emotes/papi_dagger.webp',
    priceGold: 500,
    rarity: 'legendary',
  },
  {
    id: 'wow',
    label: 'WOW',
    description: '¡Asombro total con reflejos de cristal ante una jugada maestra!',
    imageSrc: '/game-assets/emotes/wow.png',
    webpSrc: '/game-assets/emotes/wow.webp',
    priceGold: 400,
    rarity: 'epic',
  },
  {
    id: 'triste',
    label: 'TRISTE',
    description: '¡Lágrimas dramáticas y pucheros tras una mala racha!',
    imageSrc: '/game-assets/emotes/triste.png',
    webpSrc: '/game-assets/emotes/triste.webp',
    priceGold: 250,
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
 * Ejecuta la compra de un emote con Monedas de Oro.
 * Conecta con la RPC en Supabase y actualiza balances y almacenamiento local.
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
  const emote = getEmoteById(emoteId)
  if (!emote) {
    return { success: false, error: 'Emote no encontrado en el catálogo' }
  }

  if (isEmoteUnlocked(emoteId)) {
    return { success: true, newGold: currentGold, unlockedEmotes: getUnlockedEmoteIds() }
  }

  if (currentGold < emote.priceGold) {
    return {
      success: false,
      error: `Oro insuficiente. Necesitas ${emote.priceGold.toLocaleString()} Monedas de Oro para este emote.`,
    }
  }

  // Si Supabase está disponible, llamar a la RPC authoritative
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await (supabase.rpc as any)('purchase_emote', {
        p_emote_id: emoteId,
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
          : currentGold - emote.priceGold

        return {
          success: true,
          newGold: finalGold,
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
  const remainingGold = Math.max(0, currentGold - emote.priceGold)
  return {
    success: true,
    newGold: remainingGold,
    unlockedEmotes: updatedUnlocked,
  }
}
