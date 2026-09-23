import { SupabaseService } from './supabaseService'
export type { GlobalTransactionItem, MyMarketplaceListingsResponse, MyMarketplaceItem, MyMarketplaceStats } from './supabaseService'

/** Fachada transicional para operaciones del marketplace. */
export const marketplaceService = SupabaseService

