import type {
  StreamingQueryPayload,
  StreamingQueryResult,
  StreamingOrder,
  AdminStreamingOverview,
} from '../types/streaming'
import { supabase } from '../lib/supabaseClient'

class StreamingService {
  async consultarCodigo(payload: StreamingQueryPayload): Promise<StreamingQueryResult> {
    try {
      const response = await fetch('/api/consultar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get('content-type') || ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = { error: text }
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error || data?.message || 'Error al consultar el código con el proveedor.',
        }
      }

      return data as StreamingQueryResult
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Error de conexión con el servicio de verificación.',
      }
    }
  }

  async getStoreProducts(): Promise<{ success: boolean; categories?: any[] }> {
    try {
      const response = await fetch('/api/store/products')
      if (response.ok) {
        return await response.json()
      }
      return { success: false, categories: [] }
    } catch {
      return { success: false, categories: [] }
    }
  }

  /**
   * Obtiene el resumen de stock disponible agrupado por plataforma
   */
  async getStockSummary(): Promise<Record<string, number>> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_streaming_stock_summary')
      if (error) {
        console.error('Error al obtener stock de streaming:', error)
        return {}
      }
      return (data as any)?.stocks || {}
    } catch (err) {
      console.error('Fallo de red al obtener stock:', err)
      return {}
    }
  }

  /**
   * Realiza la compra de un perfil o suscripción con Gemas
   */
  async buyProduct(platform: string, region?: string): Promise<{
    success: boolean
    is_on_demand?: boolean
    order_id?: string
    account_region?: string
    email?: string
    password?: string
    profile_number?: number
    profile_pin?: string | null
    bot_code?: string
    message?: string
    new_gems_balance?: number
    error?: string
  }> {
    try {
      const { data, error } = await (supabase.rpc as any)('buy_streaming_product', {
        p_platform: platform.toLowerCase().trim(),
        p_region: region ? region.toLowerCase().trim() : null,
      })

      if (error) {
        let msg = error.message || 'Error al procesar la compra'
        if (msg.includes('REGION_REQUIRED')) {
          msg = 'Debes seleccionar si requieres cuenta para Perú o Extranjero.'
        } else if (msg.includes('SIN_STOCK')) {
          msg = 'Lo sentimos, este producto se encuentra temporalmente sin stock.'
        } else if (msg.includes('GEMS_INSUFFICIENT')) {
          msg = 'Saldo de gemas insuficiente para realizar este canje.'
        } else if (msg.includes('NO_AUTH')) {
          msg = 'Debes iniciar sesión para comprar este producto.'
        }
        return { success: false, error: msg }
      }

      return data as any
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Error inesperado al conectar con el servidor.',
      }
    }
  }

  /**
   * Obtiene la lista de suscripciones y credenciales compradas por el usuario actual
   */
  async getMyOrders(): Promise<StreamingOrder[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_my_streaming_orders')
      if (error) {
        console.error('Error al obtener mis órdenes:', error)
        return []
      }
      return (data as any)?.orders || []
    } catch (err) {
      console.error('Fallo al consultar órdenes de streaming:', err)
      return []
    }
  }

  /**
   * [ADMIN] Carga un lote de perfiles para una cuenta (Ej: Cuenta A con 3 perfiles)
   */
  async adminAddBatch(params: {
    platform: string
    accountIdentifier: string
    accountEmail: string
    accountPassword: string
    botCode: string
    profileCount: number
    pins?: string[]
  }): Promise<{ success: boolean; inserted_profiles?: number; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_add_streaming_batch', {
        p_platform: params.platform.toLowerCase().trim(),
        p_account_identifier: params.accountIdentifier.trim(),
        p_account_email: params.accountEmail.trim(),
        p_account_password: params.accountPassword.trim(),
        p_bot_code: params.botCode.trim(),
        p_profile_count: params.profileCount,
        p_pins: params.pins || null,
      })

      if (error) {
        return { success: false, error: error.message }
      }
      return data as any
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al agregar lote' }
    }
  }

  /**
   * [ADMIN] Obtiene visión general de inventario y pedidos pendientes de Netflix
   */
  async adminGetOverview(): Promise<{ success: boolean; data?: AdminStreamingOverview; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_get_streaming_overview')
      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true, data: data as unknown as AdminStreamingOverview }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al consultar inventario admin' }
    }
  }

  /**
   * [ADMIN] Asigna y entrega un pedido a pedido (Netflix)
   */
  async adminDeliverOrder(params: {
    orderId: string
    email: string
    password: string
    profileNumber: number
    profilePin?: string
    botCode?: string
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_deliver_streaming_order', {
        p_order_id: params.orderId,
        p_email: params.email.trim(),
        p_password: params.password.trim(),
        p_profile_number: params.profileNumber,
        p_profile_pin: params.profilePin ? params.profilePin.trim() : null,
        p_bot_code: params.botCode ? params.botCode.trim() : '',
      })

      if (error) {
        return { success: false, error: error.message }
      }
      return data as any
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al entregar pedido' }
    }
  }

  /**
   * [ADMIN] Elimina un perfil libre del inventario
   */
  async adminDeleteProfile(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_delete_streaming_profile', {
        p_id: id,
      })
      if (error) return { success: false, error: error.message }
      return data as any
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al eliminar perfil' }
    }
  }

  /**
   * [ADMIN] Actualiza las credenciales, perfil o vigencia de una orden ya vendida
   */
  async adminUpdateOrder(params: {
    orderId: string
    email: string
    password: string
    profileNumber?: number
    profilePin?: string
    botCode?: string
    daysRemaining?: number
    status?: string
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_update_streaming_order', {
        p_order_id: params.orderId,
        p_email: params.email.trim(),
        p_password: params.password.trim(),
        p_profile_number: params.profileNumber ?? 1,
        p_profile_pin: params.profilePin ? params.profilePin.trim() : null,
        p_bot_code: params.botCode ? params.botCode.trim() : '',
        p_days_remaining: params.daysRemaining ?? null,
        p_status: params.status ? params.status.trim() : null,
      })

      if (error) {
        return { success: false, error: error.message }
      }
      return data as any
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al actualizar orden' }
    }
  }
}

export const streamingService = new StreamingService()

