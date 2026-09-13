import React, { useState, useEffect, useRef } from 'react'
import {
  globalChatService,
  type GlobalChatMessage,
} from '../../services/globalChatService'
import { soundManager } from '../../utils/audioManager'
import chatIcon from '../../assets/ico/chat.webp'
import './GlobalChat.css'

interface GlobalChatProps {
  isOpen: boolean
  onClose: () => void
  currentUser: {
    name: string
    hasVipPass?: boolean
    avatarId?: string
    id?: string
  }
  onlineUsersCount?: number
  onNewUnreadMessage?: () => void
}

export default function GlobalChat({
  isOpen,
  onClose,
  currentUser,
  onlineUsersCount = 25,
  onNewUnreadMessage,
}: GlobalChatProps) {
  const [messages, setMessages] = useState<GlobalChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const isOpenRef = useRef(isOpen)

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  // Carga inicial del historial de mensajes
  useEffect(() => {
    let isMounted = true
    globalChatService.fetchRecentMessages(40).then((history) => {
      if (isMounted && history.length > 0) {
        setMessages(history)
      }
    })

    // Suscripción en tiempo real por WebSocket
    const unsubscribe = globalChatService.subscribeToGlobalChat((newMsg) => {
      if (!isMounted) return

      setMessages((prev) => {
        // Evitar duplicados por id
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev
        }
        return [...prev, newMsg]
      })

      // Notificar si está minimizado o cerrado
      if (!isOpenRef.current) {
        if (onNewUnreadMessage) {
          onNewUnreadMessage()
        }
      } else {
        soundManager.playSound('click', 0.25)
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [onNewUnreadMessage])

  // Auto-scroll al final al recibir o enviar mensajes si la ventana está abierta
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  // Temporizador visual para el cooldown anti-spam
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || isSending || cooldownSeconds > 0) return

    setIsSending(true)
    const result = await globalChatService.sendMessage({
      username: currentUser.name || 'Guerrero',
      message: text,
      hasVip: Boolean(currentUser.hasVipPass),
      avatarId: currentUser.avatarId || 'peashooter',
      userId: currentUser.id,
    })

    setIsSending(false)

    if (result.success) {
      setInputText('')
      setCooldownSeconds(2)
      soundManager.playSound('click', 0.4)
      if (result.messageObj) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === result.messageObj!.id)) return prev
          return [...prev, result.messageObj!]
        })
      }
    } else if (result.error) {
      // Cooldown o error
      setCooldownSeconds(2)
    }
  }

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return `${date.getHours().toString().padStart(2, '0')}:${date
        .getMinutes()
        .toString()
        .padStart(2, '0')}`
    } catch {
      return ''
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="global-chat-container">
      {/* CABECERA */}
      <div className="global-chat-header">
        <div className="global-chat-header-title">
          <img
            src={chatIcon}
            alt="Chat"
            className="global-chat-header-icon"
          />
          <span className="global-chat-header-text">CHAT GLOBAL</span>
        </div>

        <div className="global-chat-header-meta">
          <div className="global-chat-online-pill">
            <span className="global-chat-online-dot" />
            <span>{onlineUsersCount} online</span>
          </div>

          <button
            type="button"
            className="global-chat-minimize-btn"
            onClick={() => {
              soundManager.playSound('click', 0.4)
              onClose()
            }}
            title="Minimizar Chat Global"
          >
            ▼
          </button>
        </div>
      </div>

      {/* CUERPO DE MENSAJES */}
      <div className="global-chat-body">
        {messages.length === 0 ? (
          <div className="global-chat-empty-state">
            <span className="global-chat-empty-icon">💬</span>
            <p>¡Sé el primero en saludar a todos los jugadores en línea!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe =
              msg.username === currentUser.name ||
              (Boolean(currentUser.id) && msg.user_id === currentUser.id)

            return (
              <div
                key={msg.id}
                className={`global-chat-msg ${
                  isMe ? 'global-chat-msg--me' : ''
                }`}
              >
                <div className="global-chat-msg-header">
                  <div className="global-chat-sender-info">
                    {msg.has_vip && (
                      <span
                        className="global-chat-vip-crown"
                        title="Jugador con Pase VIP"
                      >
                        👑
                      </span>
                    )}
                    <span
                      className={`global-chat-sender ${
                        msg.has_vip ? 'global-chat-sender--vip' : ''
                      }`}
                    >
                      {msg.username}
                    </span>
                  </div>
                  <span className="global-chat-timestamp">
                    {formatMessageTime(msg.created_at)}
                  </span>
                </div>
                <div className="global-chat-text">{msg.message}</div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* PIE DE ENTRADA */}
      <form className="global-chat-footer" onSubmit={handleSendMessage}>
        <div className="global-chat-input-row">
          <input
            type="text"
            className="global-chat-input"
            placeholder={
              cooldownSeconds > 0
                ? `Espera ${cooldownSeconds}s...`
                : 'Escribe un mensaje al mundo...'
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={150}
            disabled={isSending || cooldownSeconds > 0}
          />
          <button
            type="submit"
            className="global-chat-send-btn"
            disabled={
              !inputText.trim() || isSending || cooldownSeconds > 0
            }
            title="Enviar mensaje"
          >
            ➤
          </button>
        </div>
        {cooldownSeconds > 0 && (
          <span className="global-chat-cooldown-note">
            Protección anti-spam activa ({cooldownSeconds}s)
          </span>
        )}
      </form>
    </div>
  )
}
