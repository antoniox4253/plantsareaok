import { supabase } from '../lib/supabaseClient'

export interface DailyMission {
  slot: number
  id: string
  title: string
  description: string
  target: number
  progress: number
  points: number
  rewardGems: number
  rewardGold: number
  claimed: boolean
  type: 'win_pvp' | 'play_pvp' | 'win_with_plant'
  plantId?: string
}

export interface LoginStreakState {
  currentStreak: number
  lastClaimedDate: string | null
  canClaimToday: boolean
  claimedDays: number[]
}

export interface TikTokSubmissionState {
  id: string
  videoUrl: string
  status: 'pending' | 'approved' | 'rejected'
  rewardGems: number
  adminNotes: string | null
  createdAt: string
}

export interface MissionsDashboardData {
  success: boolean
  todayDate: string
  missions: DailyMission[]
  weeklyPoints: number
  claimedChests: ('bronze' | 'silver' | 'gold')[]
  loginStreak: LoginStreakState
  tiktok: {
    hasSubmission: boolean
    submission: TikTokSubmissionState | null
    approvedCount: number
    maxApprovedCount: number
    remainingQuota: number
    contestDeadline: string
  }
  goldRush: {
    isSaturday: boolean
    isVip: boolean
  }
  error?: string
}

export interface AdminTikTokSubmissionRow {
  id: string
  user_id: string
  username?: string
  video_url: string
  status: 'pending' | 'approved' | 'rejected'
  reward_gems: number
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export async function getMissionsDashboard(): Promise<MissionsDashboardData> {
  const { data, error } = await (supabase as any).rpc('get_missions_dashboard')
  if (error) {
    console.error('Error fetching missions dashboard:', error)
    return {
      success: false,
      todayDate: new Date().toISOString().split('T')[0],
      missions: [],
      weeklyPoints: 0,
      claimedChests: [],
      loginStreak: { currentStreak: 0, lastClaimedDate: null, canClaimToday: false, claimedDays: [] },
      tiktok: { hasSubmission: false, submission: null, approvedCount: 0, maxApprovedCount: 50, remainingQuota: 50, contestDeadline: '2026-09-26T23:00:00Z' },
      goldRush: { isSaturday: false, isVip: false },
      error: error.message
    }
  }
  return data as MissionsDashboardData
}

export async function claimDailyLoginStreak(): Promise<{ success: boolean; day?: number; error?: string }> {
  const { data, error } = await (supabase as any).rpc('claim_daily_login_streak')
  if (error) {
    return { success: false, error: error.message }
  }
  return data
}

export async function claimDailyMission(slotIndex: number): Promise<{ success: boolean; pointsGained?: number; error?: string }> {
  const { data, error } = await (supabase as any).rpc('claim_daily_mission', { p_slot_index: slotIndex })
  if (error) {
    return { success: false, error: error.message }
  }
  return data
}

export async function rerollDailyMission(slotIndex: number): Promise<{ success: boolean; newMission?: DailyMission; error?: string }> {
  const { data, error } = await (supabase as any).rpc('reroll_daily_mission', { p_slot_index: slotIndex })
  if (error) {
    return { success: false, error: error.message }
  }
  return data
}

export async function claimWeeklyChest(tier: 'bronze' | 'silver' | 'gold'): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await (supabase as any).rpc('claim_weekly_chest', { p_tier: tier })
  if (error) {
    return { success: false, error: error.message }
  }
  return data
}

export async function submitTikTokVideo(videoUrl: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const { data, error } = await (supabase as any).rpc('submit_tiktok_video', { p_video_url: videoUrl })
  if (error) {
    return { success: false, error: error.message }
  }
  return data
}

export async function adminGetTikTokSubmissions(): Promise<{ success: boolean; submissions: AdminTikTokSubmissionRow[]; error?: string }> {
  const { data, error } = await (supabase as any)
    .from('social_video_submissions')
    .select(`
      id,
      user_id,
      video_url,
      status,
      reward_gems,
      admin_notes,
      created_at,
      reviewed_at,
      profiles:user_id (username)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, submissions: [], error: error.message }
  }

  const formatted: AdminTikTokSubmissionRow[] = (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    username: row.profiles?.username || 'Anónimo',
    video_url: row.video_url,
    status: row.status,
    reward_gems: row.reward_gems,
    admin_notes: row.admin_notes,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at
  }))

  return { success: true, submissions: formatted }
}

export async function adminReviewTikTokSubmission(
  submissionId: string,
  action: 'approve' | 'reject',
  notes?: string
): Promise<{ success: boolean; action?: string; rewardGems?: number; error?: string }> {
  const { data, error } = await (supabase as any).rpc('admin_review_tiktok_submission', {
    p_submission_id: submissionId,
    p_action: action,
    p_notes: notes || null
  })

  if (error) {
    return { success: false, error: error.message }
  }
  return data
}
