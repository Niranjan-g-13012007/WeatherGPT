import { motion } from 'framer-motion'
import { CloudSun, User } from 'lucide-react'
import './ChatMessage.css'

export default function ChatMessage({ role, content }) {
  const isUser = role === 'user'

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
      <div className="chat-message-bubble">{content}</div>
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
