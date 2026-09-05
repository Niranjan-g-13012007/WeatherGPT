import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Please enter both your email and password.')
      return
    }
    // Frontend-only prototype: no real authentication or backend call.
    localStorage.setItem('weathergpt_user', JSON.stringify({ email: form.email }))
    navigate('/assistant')
  }

  return (
    <main className="auth-page">
      <div className="wg-container auth-shell">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h1>Welcome back</h1>
          <p className="auth-sub">Log in to keep chatting with WeatherGPT.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>Email</span>
              <div className="auth-input">
                <Mail size={16} strokeWidth={2} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="auth-input">
                <Lock size={16} strokeWidth={2} />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="wg-btn wg-btn-primary auth-submit">
              Log in <ArrowRight size={16} />
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button type="button" className="wg-btn wg-btn-secondary auth-google">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.4 6 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.6 18.9 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.4 6 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.4 0 10.2-1.9 13.9-5.1l-6.4-5.4C29.5 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.5l6.4 5.4C41.5 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>

          <p className="auth-switch">
            New to WeatherGPT? <Link to="/signup">Create an account</Link>
          </p>
        </motion.div>
      </div>
    </main>
  )
}
