import { motion } from 'framer-motion'
import { Droplets, Wind, CloudSun } from 'lucide-react'
import './AtmosphereVisual.css'

export default function AtmosphereVisual({ snapshot, locationName = 'Chennai' }) {
  const temp = snapshot ? Math.round(snapshot.temperature) : 30
  const humidity = snapshot ? Math.round(snapshot.humidity) : 72
  const wind = snapshot ? Math.round(snapshot.windSpeed) : 14

  return (
    <div className="atmos">
      <motion.div
        className="atmos-ring ring-outer"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 60, ease: 'linear' }}
      />
      <motion.div
        className="atmos-ring ring-inner"
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 40, ease: 'linear' }}
      />

      <div className="atmos-core">
        <span className="atmos-core-label">{locationName}</span>
        <span className="atmos-core-temp">{temp}°</span>
        <span className="atmos-core-sub">Live conditions</span>
      </div>

      <motion.div
        className="atmos-chip chip-1"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: [0, -6, 0] }}
        transition={{ opacity: { duration: 0.5, delay: 0.3 }, y: { repeat: Infinity, duration: 4, ease: 'easeInOut' } }}
      >
        <Droplets size={14} strokeWidth={2.2} />
        {humidity}% humidity
      </motion.div>

      <motion.div
        className="atmos-chip chip-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{ opacity: { duration: 0.5, delay: 0.5 }, y: { repeat: Infinity, duration: 5, ease: 'easeInOut' } }}
      >
        <Wind size={14} strokeWidth={2.2} />
        {wind} km/h wind
      </motion.div>

      <motion.div
        className="atmos-chip chip-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: [0, -8, 0] }}
        transition={{ opacity: { duration: 0.5, delay: 0.7 }, y: { repeat: Infinity, duration: 4.6, ease: 'easeInOut' } }}
      >
        <CloudSun size={14} strokeWidth={2.2} />
        Partly cloudy
      </motion.div>

      <span className="atmos-dot dot-1" />
      <span className="atmos-dot dot-2" />
    </div>
  )
}
