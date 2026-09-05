import { motion } from 'framer-motion'
import { Droplets } from 'lucide-react'
import WeatherIcon from './WeatherIcon.jsx'
import { getWeatherCondition } from '../utils/weatherCode.js'
import './ForecastCard.css'

function formatDay(dateStr, index) {
  if (index === 0) return 'Today'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { weekday: 'short' })
}

export default function ForecastCard({ day, index, active, onClick }) {
  const condition = getWeatherCondition(day.weatherCode)

  return (
    <motion.button
      className={`forecast-card ${active ? 'active' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
    >
      <span className="forecast-card-day">{formatDay(day.date, index)}</span>
      <div className="forecast-card-icon">
        <WeatherIcon code={day.weatherCode} size={30} strokeWidth={1.7} />
      </div>
      <span className="forecast-card-condition">{condition.label}</span>
      <div className="forecast-card-temps">
        <span className="max">{Math.round(day.tempMax)}°</span>
        <span className="min">{Math.round(day.tempMin)}°</span>
      </div>
      <div className="forecast-card-rain">
        <Droplets size={12} strokeWidth={2.2} />
        {Math.round(day.precipitationProbability ?? 0)}%
      </div>
    </motion.button>
  )
}
