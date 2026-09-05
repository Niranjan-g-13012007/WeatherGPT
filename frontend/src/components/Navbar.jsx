import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CloudSun } from 'lucide-react'
import './Navbar.css'

const LINKS = [
  { to: '/#features', label: 'Features' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/about', label: 'How It Works' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

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
          <button className="wg-btn wg-btn-ghost" onClick={() => navigate('/login')}>
            Log in
          </button>
          <button className="wg-btn wg-btn-primary" onClick={() => navigate('/assistant')}>
            Get started
          </button>
        </div>
      </div>
    </header>
  )
}
