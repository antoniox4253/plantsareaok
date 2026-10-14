import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOnlineUserIds,
  subscribeToOnlineUserIds,
  useOnlineUsers,
  useOnlineUserIds,
} from './useOnlineUsers'

describe('useOnlineUsers & Presence centralization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides synchronous access to known online user IDs', () => {
    const ids = getOnlineUserIds()
    expect(ids instanceof Set).toBe(true)
  })

  it('allows subscription to online user IDs and triggers callback immediately', () => {
    let received: Set<string> | undefined
    const unsubscribe = subscribeToOnlineUserIds((ids) => {
      received = ids
    })

    expect(received).toBeDefined()
    expect(received instanceof Set).toBe(true)

    unsubscribe()
  })

  it('exports hooks without throwing', () => {
    expect(typeof useOnlineUsers).toBe('function')
    expect(typeof useOnlineUserIds).toBe('function')
  })
})
