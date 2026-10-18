import type { StreamingQueryPayload, StreamingQueryResult } from '../types/streaming'

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
}

export const streamingService = new StreamingService()
