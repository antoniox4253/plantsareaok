import { supabase } from '../lib/supabaseClient'

export interface AuctionBid {
  id: string
  userId: string
  username: string
  bidAmount: number
  createdAt: number
}

export interface ActiveAuctionData {
  id: string
  title: string
  plantId: string
  itemName: string
  description: string
  imageUrl: string
  startingBid: number
  currentBid: number
  minBidStep: number
  highestBidderId: string | null
  highestBidderName: string | null
  startTime: number
  endTime: number
  serverNow: number
  status: 'active' | 'completed' | 'cancelled'
  winnerId: string | null
  rewardClaimed: boolean
  totalBids: number
  bids: AuctionBid[]
}

export interface BidResult {
  success: boolean
  auctionId?: string
  bidAmount?: number
  highestBidderName?: string
  remainingGems?: number
  error?: string
}

export interface ClaimResult {
  success: boolean
  message?: string
  instanceId?: string
  itemName?: string
  error?: string
}

class AuctionService {
  /**
   * Obtiene los datos de la subasta activa y el top de ofertas.
   */
  async getActiveAuction(): Promise<ActiveAuctionData | null> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_active_auction')

      if (error) {
        console.error('[AuctionService] Error al obtener subasta activa:', error)
        return null
      }

      return data as ActiveAuctionData | null
    } catch (e) {
      console.error('[AuctionService] Excepción en getActiveAuction:', e)
      return null
    }
  }

  /**
   * Envía una puja atómica descontando gemas y reembolsando al postor anterior.
   */
  async placeBid(auctionId: string, bidAmount: number): Promise<BidResult> {
    try {
      const { data, error } = await (supabase.rpc as any)('place_auction_bid', {
        p_auction_id: auctionId,
        p_bid_amount: bidAmount,
      })

      if (error) {
        return { success: false, error: error.message || 'Error al procesar la puja' }
      }

      return data as BidResult
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error inesperado al ofertar' }
    }
  }

  /**
   * Reclama la carta de la subasta cuando expira el tiempo si el usuario fue el ganador.
   */
  async claimReward(auctionId: string): Promise<ClaimResult> {
    try {
      const { data, error } = await (supabase.rpc as any)('claim_auction_reward', {
        p_auction_id: auctionId,
      })

      if (error) {
        return { success: false, error: error.message || 'Error al reclamar la carta' }
      }

      return data as ClaimResult
    } catch (e: any) {
      return { success: false, error: e?.message || 'Error al reclamar la recompensa' }
    }
  }

  /**
   * Suscribe a cambios en tiempo real en la subasta y las pujas.
   */
  subscribeToAuctionChanges(onUpdate: () => void): () => void {
    try {
      const channel = supabase
        .channel('auction-live-updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'auctions' },
          () => onUpdate()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'auction_bids' },
          () => onUpdate()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    } catch (err) {
      console.warn('[AuctionService] No se pudo inicializar suscripción Realtime:', err)
      return () => {}
    }
  }
}

export const auctionService = new AuctionService()
