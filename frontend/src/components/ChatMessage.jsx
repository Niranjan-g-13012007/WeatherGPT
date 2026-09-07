import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CloudSun, User, Volume2, VolumeX } from 'lucide-react'
import { toggleSpeak, subscribeSpeechState, getActiveSpeakingId } from '../utils/speechUtils.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import './ChatMessage.css'

/**
 * Lightweight markdown → React parser.
 * Handles: **bold**, *italic*, bullet lists (lines starting with * or -),
 * headings (##), and line breaks. No npm dependency required.
 */
function parseMarkdown(text) {
  if (!text || typeof text !== 'string') return text

  // Split into lines for block-level processing
  const lines = text.split('\n')
  const elements = []
  let currentList = []
  let key = 0

  function flushList() {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} className="chat-md-list">
          {currentList.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ul>
      )
      currentList = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Empty line — flush list and add spacing
    if (trimmed === '') {
      flushList()
      continue
    }

    // Bullet list: lines starting with "* " or "- " (but NOT "**")
    const bulletMatch = trimmed.match(/^[\*\-]\s+(.+)/)
    if (bulletMatch && !trimmed.startsWith('**')) {
      currentList.push(bulletMatch[1])
      continue
    }

    // Heading: ## or ###
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={`h4-${key++}`} className="chat-md-h4">
          {parseInline(trimmed.slice(4))}
        </h4>
      )
      continue
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={`h3-${key++}`} className="chat-md-h3">
          {parseInline(trimmed.slice(3))}
        </h3>
      )
      continue
    }

    // Regular paragraph line
    flushList()
    elements.push(
      <p key={`p-${key++}`} className="chat-md-p">
        {parseInline(trimmed)}
      </p>
    )
  }

  flushList()
  return elements.length > 0 ? elements : text
}

/**
 * Parse inline markdown: **bold** and *italic*
 */
function parseInline(text) {
  if (!text) return text

  const parts = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Match **bold** first (greedy avoids conflict with single *)
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Match *italic* (single asterisk, not preceded/followed by another *)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)

    // Pick the earliest match
    let firstMatch = null
    let matchType = null

    if (boldMatch && (!italicMatch || boldMatch.index <= italicMatch.index)) {
      firstMatch = boldMatch
      matchType = 'bold'
    } else if (italicMatch) {
      firstMatch = italicMatch
      matchType = 'italic'
    }

    if (!firstMatch) {
      // No more matches — push remaining text
      parts.push(remaining)
      break
    }

    // Push text before the match
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index))
    }

    // Push the formatted element
    if (matchType === 'bold') {
      parts.push(
        <strong key={`b-${key++}`} className="chat-md-bold">
          {firstMatch[1]}
        </strong>
      )
    } else {
      parts.push(
        <em key={`i-${key++}`} className="chat-md-italic">
          {firstMatch[1]}
        </em>
      )
    }

    // Advance past the match
    remaining = remaining.slice(firstMatch.index + firstMatch[0].length)
  }

  return parts.length === 1 ? parts[0] : parts
}

export default function ChatMessage({ id, role, content }) {
  const isUser = role === 'user'
  const langContext = useLanguage()
  const language = langContext?.language || 'en'
  const messageId = id || `msg-${typeof content === 'string' ? content.slice(0, 40) : Math.random()}`

  const [isSpeaking, setIsSpeaking] = useState(() => getActiveSpeakingId() === messageId)

  useEffect(() => {
    return subscribeSpeechState((activeId) => {
      setIsSpeaking(activeId === messageId)
    })
  }, [messageId])

  const handleToggleSpeech = (e) => {
    e.stopPropagation()
    toggleSpeak(messageId, content, language)
  }

  return (
    <motion.div
      className={`chat-message ${isUser ? 'from-user' : 'from-bot'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {!isUser && (
        <div className="chat-message-avatar bot">
          <CloudSun size={15} strokeWidth={2.2} />
        </div>
      )}
      <div className="chat-message-bubble">
        {isUser ? (
          content
        ) : (
          <>
            <div className="chat-md-content">{parseMarkdown(content)}</div>
            <div className="chat-message-footer">
              <button
                type="button"
                className={`chat-speech-btn ${isSpeaking ? 'speaking' : ''}`}
                onClick={handleToggleSpeech}
                title={isSpeaking ? 'Stop reading' : 'Read response aloud'}
                aria-label={isSpeaking ? 'Stop reading' : 'Read response aloud'}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX size={13} strokeWidth={2.2} className="speech-icon" />
                    <span className="speech-wave-anim" aria-hidden="true">
                      <span className="wave-bar" />
                      <span className="wave-bar" />
                      <span className="wave-bar" />
                    </span>
                  </>
                ) : (
                  <Volume2 size={13} strokeWidth={2.2} className="speech-icon" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
      {isUser && (
        <div className="chat-message-avatar user">
          <User size={15} strokeWidth={2.2} />
        </div>
      )}
    </motion.div>
  )
}

export function TypingIndicator() {
  return (
    <div className="chat-message from-bot">
      <div className="chat-message-avatar bot">
        <CloudSun size={15} strokeWidth={2.2} />
      </div>
      <div className="chat-message-bubble typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}
