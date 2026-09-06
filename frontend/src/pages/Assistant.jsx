import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  CloudSun,
  MessageSquarePlus,
  PanelRightOpen,
  X,
  Sparkles,
  Navigation,
  AlertCircle,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useLocationWeather } from '../context/LocationContext.jsx'
import { LOCATIONS } from '../data/locations.js'
import { fetchWeather, buildCurrentSnapshot } from '../services/weatherService.js'
import { detectLocation, resolveTargetLocation, generateResponse } from '../utils/chatbot.js'
import { evaluateRisk } from '../utils/riskEngine.js'
import ChatMessage, { TypingIndicator } from '../components/ChatMessage.jsx'
import ChatInput from '../components/ChatInput.jsx'
import WeatherCard from '../components/WeatherCard.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import { LoadingState, ErrorState } from '../components/DataState.jsx'
import './Assistant.css'

const SUGGESTIONS = [
  'Will it rain today?',
  'Should I travel tomorrow?',
  'Will it rain tomorrow in Ooty and should I travel?',
  'Should I irrigate my crops tomorrow?',
  'Which weather model are you using?',
  "Give me today's weather summary.",
]


function makeConversation(locationName) {
  return {
    id: `conv-${Date.now()}`,
    title: `${locationName} · New chat`,
    messages: [],
  }
}

export default function Assistant() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const {
    location,
    setLocation,
    weatherData,
    snapshot,
    model,
    modelType,
    modelInfo,
    status,
    retry,
    isDetectingLocation,
    locationNotice,
    clearLocationNotice,
  } = useLocationWeather()

  const [conversations, setConversations] = useState(() => [makeConversation(location.name)])
  const [activeId, setActiveId] = useState(() => conversations[0]?.id)
  const [isTyping, setIsTyping] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const scrollRef = useRef(null)
  const userScrolledUpRef = useRef(false)
  const isUserSendingRef = useRef(false)

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0]
  const risk = snapshot ? evaluateRisk(snapshot) : null

  function handleChatScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    userScrolledUpRef.current = distanceFromBottom > 80
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!userScrolledUpRef.current || isUserSendingRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      isUserSendingRef.current = false
    }
  }, [active?.messages, isTyping])

  function updateActive(updater) {
    setConversations((prev) => prev.map((c) => (c.id === activeId ? updater(c) : c)))
  }

  async function handleSend(text) {
    isUserSendingRef.current = true
    userScrolledUpRef.current = false
    updateActive((c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 40) : c.title,
      messages: [...c.messages, { role: 'user', content: text }],
    }))
    setIsTyping(true)

    const startTime = Date.now()
    const targetDelay = 550 + Math.random() * 300

    try {
      // 1. Detect location mentioned in user question (defaults to currently selected location)
      const targetLocation = await resolveTargetLocation(text, location, LOCATIONS)

      let activeLocationName = location.name
      let activeWeatherData = weatherData
      let activeSnapshot = snapshot

      // 2 & 3. If a different location is mentioned, fetch Open-Meteo weather data for it
      const isCustomLocation =
        targetLocation &&
        targetLocation.name &&
        targetLocation.name.toLowerCase() !== location.name.toLowerCase()

      if (
        isCustomLocation &&
        targetLocation.latitude != null &&
        targetLocation.longitude != null
      ) {
        activeLocationName = targetLocation.name
        activeWeatherData = await fetchWeather(
          targetLocation.latitude,
          targetLocation.longitude
        )
        activeSnapshot = buildCurrentSnapshot(activeWeatherData)
      }

      // 4. Generate answer using the appropriate location's weather data
      const reply = await generateResponse(
        text,
        activeWeatherData,
        activeLocationName,
        activeSnapshot,
        LOCATIONS
      )

      const elapsed = Date.now() - startTime
      const remainingDelay = Math.max(0, targetDelay - elapsed)

      setTimeout(() => {
        updateActive((c) => ({
          ...c,
          messages: [...c.messages, { role: 'bot', content: reply }],
        }))
        setIsTyping(false)
      }, remainingDelay)
    } catch (err) {
      console.error('Error generating response:', err)
      setTimeout(() => {
        updateActive((c) => ({
          ...c,
          messages: [
            ...c.messages,
            {
              role: 'bot',
              content:
                "I couldn't fetch live weather data for that location right now. Please check your connection and try again.",
            },
          ],
        }))
        setIsTyping(false)
      }, 300)
    }
  }

  function handleNewChat() {
    const conv = makeConversation(location.name)
    setConversations((prev) => [conv, ...prev])
    setActiveId(conv.id)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="assistant">
      <aside className="assistant-sidebar">
        <button className="assistant-back" onClick={() => navigate('/')}>
          <ArrowLeft size={15} strokeWidth={2.2} /> Home
        </button>

        <button className="assistant-new-chat" onClick={handleNewChat}>
          <MessageSquarePlus size={16} strokeWidth={2.1} /> New chat
        </button>

        <div className="assistant-history">
          <span className="assistant-history-label">Recent</span>
          {conversations.map((c) => (
            <button
              key={c.id}
              className={`assistant-history-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              {c.title || 'New chat'}
            </button>
          ))}
        </div>

        {user && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '14px',
              borderTop: '1px solid var(--color-line, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
              }}
              title={user.email}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--color-navy-faint, #94a3b8)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--color-navy, #0f172a)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.name}
              </span>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-navy-soft, #64748b)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
              }}
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      <main className="assistant-main">
        <header className="assistant-header">
          <div className="assistant-header-title">
            <div className="assistant-header-icon">
              <CloudSun size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h1>WeatherGPT</h1>
              <p>AI Weather Intelligence</p>
            </div>
          </div>

          <div className="assistant-header-actions">
            <LocationPicker location={location} onChange={setLocation} />
            <button className="assistant-context-toggle" onClick={() => setContextOpen(true)}>
              <PanelRightOpen size={18} strokeWidth={2} />
            </button>
          </div>
        </header>

        {isDetectingLocation && (
          <div className="assistant-location-banner info">
            <Navigation size={13} className="banner-spinner" />
            <span>Detecting your location...</span>
          </div>
        )}

        {locationNotice && (
          <div className="assistant-location-banner warning">
            <span>{locationNotice}</span>
            <button onClick={clearLocationNotice} className="assistant-banner-close">
              ✕
            </button>
          </div>
        )}

        <div className="assistant-chat" ref={scrollRef} onScroll={handleChatScroll}>
          {active.messages.length === 0 ? (
            <div className="assistant-empty">
              <div className="assistant-empty-icon">
                <Sparkles size={22} strokeWidth={1.8} />
              </div>
              <h2>How can I help you understand the weather?</h2>
              <p>Ask me about rain, temperature, travel, outdoor activities, weather risks and more.</p>

              <div className="assistant-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => handleSend(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="assistant-messages">
              <AnimatePresence initial={false}>
                {active.messages.map((m, i) => (
                  <ChatMessage key={i} role={m.role} content={m.content} />
                ))}
              </AnimatePresence>
              {isTyping && <TypingIndicator />}
            </div>
          )}
        </div>

        <div className="assistant-input-area">
          {status === 'error' && (
            <p className="assistant-inline-warning">
              Live weather data isn't loading right now — answers may be limited.{' '}
              <button onClick={retry}>Retry</button>
            </p>
          )}
          <ChatInput onSend={handleSend} disabled={isTyping} />
        </div>
      </main>

      <aside className="assistant-context">
        <p className="assistant-context-label">Current weather</p>
        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState onRetry={retry} />}
        {status === 'success' && (
          <WeatherCard
            locationName={location.name}
            snapshot={snapshot}
            risk={risk}
            model={model}
            modelType={modelType}
            modelInfo={modelInfo}
            showModel={false}
          />
        )}
        <p className="assistant-context-footnote">Live data from Open-Meteo</p>
      </aside>

      <AnimatePresence>
        {contextOpen && (
          <motion.div
            className="assistant-context-sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setContextOpen(false)}
          >
            <motion.div
              className="assistant-context-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="assistant-context-sheet-head">
                <p>Current weather</p>
                <button onClick={() => setContextOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              {status === 'loading' && <LoadingState />}
              {status === 'error' && <ErrorState onRetry={retry} />}
              {status === 'success' && (
                <WeatherCard
                  locationName={location.name}
                  snapshot={snapshot}
                  risk={risk}
                  model={model}
                  modelType={modelType}
                  modelInfo={modelInfo}
                  showModel={false}
                />
              )}
              <p className="assistant-context-footnote">Live data from Open-Meteo</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

