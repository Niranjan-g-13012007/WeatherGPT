import { useState, useEffect } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check for error parameters redirected from OAuth or session
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const errParam = params.get('error')
    if (errParam === 'google_not_configured') {
      setError('Google Sign-In is not configured yet. Please configure credentials in backend/.env.')
    } else if (errParam === 'google_failed' || errParam === 'oauth_error') {
      setError('Google sign-in could not be completed. Please try again.')
    }
  }, [location.search])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Please enter both your email and password.')
      return
    }

    setIsSubmitting(true)
    try {
      await login({ email: form.email, password: form.password })
      const redirectPath = location.state?.from?.pathname || '/assistant'
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.message || 'Invalid email or password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleGoogleLogin() {
    setError('')
    loginWithGoogle()
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
                  autoComplete="email"
                  required
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
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="wg-btn wg-btn-primary auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Log in'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="auth-divider"><span>or</span></div>

          <button
            type="button"
            className="wg-btn wg-btn-secondary auth-google"
            onClick={handleGoogleLogin}
          >
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
