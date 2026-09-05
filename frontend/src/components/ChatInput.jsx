import { useEffect, useRef, useState } from 'react'
import { Mic, Send, Square } from 'lucide-react'
import './ChatInput.css'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceMessage, setVoiceMessage] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!SpeechRecognitionAPI) return
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setValue((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onerror = () => {
      setVoiceMessage('Could not hear that clearly. Please try typing instead.')
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
  }, [])

  function handleMicClick() {
    if (!SpeechRecognitionAPI) {
      setVoiceMessage('Voice input is not supported in this browser. Please type your question.')
      setTimeout(() => setVoiceMessage(''), 3000)
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    setVoiceMessage('')
    setListening(true)
    recognitionRef.current?.start()
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
  }

  return (
    <div className="chat-input-wrap">
      {listening && <div className="chat-input-status listening">Listening...</div>}
      {voiceMessage && <div className="chat-input-status warning">{voiceMessage}</div>}

      <form className="chat-input" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`chat-input-mic ${listening ? 'active' : ''}`}
          onClick={handleMicClick}
          aria-label="Toggle voice input"
        >
          {listening ? <Square size={16} strokeWidth={2.2} /> : <Mic size={17} strokeWidth={2.2} />}
        </button>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask WeatherGPT anything about the weather..."
          disabled={disabled}
        />

        <button type="submit" className="chat-input-send" disabled={disabled || !value.trim()}>
          <Send size={17} strokeWidth={2.2} />
        </button>
      </form>
    </div>
  )
}
