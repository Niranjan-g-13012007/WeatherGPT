import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MessageCircleMore, Radar, BellRing, UserRoundCog, ArrowRight } from 'lucide-react'
import AtmosphereVisual from '../components/AtmosphereVisual.jsx'
import { useLocationWeather } from '../context/LocationContext.jsx'
import './Home.css'

const FEATURES = [
  {
    icon: MessageCircleMore,
    title: 'Conversational Weather',
    description: 'Ask in plain language and get a direct answer, not a wall of numbers to interpret yourself.',
  },
  {
    icon: Radar,
    title: 'Real-Time Forecast',
    description: 'Every response is grounded in live Open-Meteo data for your chosen city, updated on demand.',
  },
  {
    icon: BellRing,
    title: 'Weather Alerts',
    description: 'A built-in risk read flags rain, wind, and storm conditions worth planning around.',
  },
  {
    icon: UserRoundCog,
    title: 'Personalized Advisory',
    description: 'Guidance adjusts to what you asked — travel, outdoor plans, or just today at a glance.',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const { location, snapshot } = useLocationWeather()

  return (
    <main className="home">
      <section className="hero">
        <div className="wg-container hero-inner">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <h1 className="hero-title">
              Weather intelligence,
              <br />
              built for real life.
            </h1>
            <p className="hero-subtitle">
              Ask the weather anything. Get clear forecasts, risk insights and personalized weather
              guidance powered by real-time weather data.
            </p>
            <div className="hero-actions">
              <button className="wg-btn wg-btn-primary" onClick={() => navigate('/assistant')}>
                Try WeatherGPT <ArrowRight size={16} />
              </button>
              <button className="wg-btn wg-btn-secondary" onClick={() => navigate('/forecast')}>
                Explore forecast
              </button>
            </div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
          >
            <AtmosphereVisual snapshot={snapshot} locationName={location.name} />
          </motion.div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="wg-container">
          <div className="features-grid">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <Icon size={19} strokeWidth={2} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
