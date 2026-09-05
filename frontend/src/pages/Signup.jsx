import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Lock, ArrowRight } from 'lucide-react'
import './Auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.confirm) {
      setError('Please fill in every field.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    // Frontend-only prototype: no real authentication or backend call.
    localStorage.setItem('weathergpt_user', JSON.stringify({ name: form.name, email: form.email }))
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
          <h1>Create your account</h1>
          <p className="auth-sub">Set up WeatherGPT in a few seconds.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label>
              <span>Name</span>
              <div className="auth-input">
                <User size={16} strokeWidth={2} />
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
            </label>

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

            <label>
              <span>Confirm password</span>
              <div className="auth-input">
                <Lock size={16} strokeWidth={2} />
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="wg-btn wg-btn-primary auth-submit">
              Create account <ArrowRight size={16} />
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </motion.div>
      </div>
    </main>
  )
}
