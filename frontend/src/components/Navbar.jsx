import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CloudSun, User, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

const LINKS = [
  { to: '/#features', label: 'Features' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/climate', label: 'Climate' },
  { to: '/about', label: 'How It Works' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="wg-nav">
      <div className="wg-container wg-nav-inner">
        <Link to="/" className="wg-nav-brand">
          <span className="wg-nav-brand-icon">
            <CloudSun size={20} strokeWidth={2.2} />
          </span>
          WeatherGPT
        </Link>

        <nav className="wg-nav-links">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className={
                'wg-nav-link' + (location.pathname === link.to ? ' active' : '')
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="wg-nav-actions">
          {isAuthenticated && user ? (
            <>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: 'var(--color-navy, #0f172a)',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'var(--color-offwhite, #f1f5f9)',
                  border: '1px solid var(--color-line, #e2e8f0)',
                }}
                title={user.email}
              >
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={14} />
                )}
                <span>{user.name.split(' ')[0]}</span>
              </div>
              <button
                className="wg-btn wg-btn-ghost"
                onClick={handleLogout}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Log out"
              >
                <LogOut size={14} />
                <span>Log out</span>
              </button>
              <button
                className="wg-btn wg-btn-primary"
                onClick={() => navigate('/assistant')}
              >
                Assistant
              </button>
            </>
          ) : (
            <>
              <button className="wg-btn wg-btn-ghost" onClick={() => navigate('/login')}>
                Log in
              </button>
              <button className="wg-btn wg-btn-primary" onClick={() => navigate('/assistant')}>
                Get started
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
