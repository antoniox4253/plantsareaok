import { supabase } from '../lib/supabaseClient'

export interface SponsoredMissionSubmission {
  id: string
  proofImageUrl: string
  status: 'pending' | 'approved' | 'rejected'
  claimed: boolean
  adminNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
}

export interface SponsoredMission {
  id: string
  title: string
  sponsorUsername: string
  targetUrl: string
  rewardGems: number
  costGems: number
  maxParticipants: number
  approvedCount: number
  status: 'active' | 'completed' | 'cancelled'
  createdAt: string
  isMyMission: boolean
  mySubmission?: SponsoredMissionSubmission | null
}

export interface AdminMissionSubmission {
  id: string
  missionId: string
  missionTitle: string
  targetUrl: string
  sponsorUsername: string
  maxParticipants: number
  approvedCount: number
  userId: string
  username: string
  proofImageUrl: string
  status: 'pending' | 'approved' | 'rejected'
  rewardGems: number
  claimed: boolean
  adminNotes?: string | null
  createdAt: string
  reviewedAt?: string | null
}

export const sponsoredMissionService = {
  /**
   * Obtiene la lista de misiones patrocinadas activas, proyectando
   * el estado individual de entrega y reclamo del jugador autenticado.
   */
  async getActiveMissions(): Promise<SponsoredMission[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('get_active_sponsored_missions')
      if (error) {
        console.error('Error fetching active sponsored missions:', error)
        return []
      }
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Exception fetching active sponsored missions:', err)
      return []
    }
  },

  /**
   * Un jugador se patrocina por 250 Gemas creando una misión de 40 cupos.
   */
  async createMission(
    targetUrl: string,
    title?: string
  ): Promise<{ success: boolean; mission_id?: string; remaining_gems?: number; error?: string; message?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('create_sponsored_mission', {
        p_target_url: targetUrl,
        p_title: title || null,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return data as { success: boolean; mission_id?: string; remaining_gems?: number; error?: string; message?: string }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión al crear misión.' }
    }
  },

  /**
   * Sube la captura de comprobante directamente al bucket de Supabase Storage.
   */
  async uploadProofImage(file: File, userId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: 'La captura excede el tamaño máximo permitido de 5 MB.' }
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const cleanExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
      const mimeType = file.type || (cleanExt === 'jpg' || cleanExt === 'jpeg' ? 'image/jpeg' : cleanExt === 'webp' ? 'image/webp' : 'image/png')
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${cleanExt}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('mission-proofs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: mimeType,
        })

      if (uploadError) {
        return { success: false, error: uploadError.message }
      }

      const filePath = uploadData?.path || fileName
      const { data: publicData } = supabase.storage
        .from('mission-proofs')
        .getPublicUrl(filePath)

      return { success: true, url: publicData.publicUrl }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al subir la captura.' }
    }
  },

  /**
   * Entrega la URL de la captura para revisión del administrador.
   */
  async submitProof(
    missionId: string,
    proofImageUrl: string
  ): Promise<{ success: boolean; submission_id?: string; error?: string; message?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('submit_mission_proof', {
        p_mission_id: missionId,
        p_proof_image_url: proofImageUrl,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return data as { success: boolean; submission_id?: string; error?: string; message?: string }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión al enviar captura.' }
    }
  },

  /**
   * Reclama la recompensa de 5 Gemas cuando la entrega fue aprobada por el admin.
   */
  async claimReward(
    submissionId: string
  ): Promise<{ success: boolean; reward_gems?: number; error?: string; message?: string }> {
    try {
      const { data, error } = await (supabase.rpc as any)('claim_mission_reward', {
        p_submission_id: submissionId,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return data as { success: boolean; reward_gems?: number; error?: string; message?: string }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error de conexión al reclamar gemas.' }
    }
  },

  /**
   * PANEL ADMIN: Lista todas las capturas entregadas para validación.
   */
  async adminGetSubmissions(): Promise<AdminMissionSubmission[]> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_get_mission_submissions')
      if (error) {
        console.error('Error in adminGetMissionSubmissions:', error)
        return []
      }
      return Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Exception in adminGetMissionSubmissions:', err)
      return []
    }
  },

  /**
   * PANEL ADMIN: Aprueba (+5 Gemas) o rechaza una captura con nota opcional.
   */
  async adminReviewSubmission(
    submissionId: string,
    action: 'approve' | 'reject',
    notes?: string
  ): Promise<{ success: boolean; status?: string; message?: string; error?: string; approved_count?: number }> {
    try {
      const { data, error } = await (supabase.rpc as any)('admin_review_mission_submission', {
        p_submission_id: submissionId,
        p_action: action,
        p_notes: notes || null,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      return data as { success: boolean; status?: string; message?: string; error?: string; approved_count?: number }
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al procesar la revisión.' }
    }
  },
}
