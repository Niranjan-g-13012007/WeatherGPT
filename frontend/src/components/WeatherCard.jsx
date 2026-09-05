import { Droplets, CloudRain, Wind, Gauge } from 'lucide-react'
import WeatherIcon from './WeatherIcon.jsx'
import RiskBadge from './RiskBadge.jsx'
import { getWeatherCondition } from '../utils/weatherCode.js'
import './WeatherCard.css'

export default function WeatherCard({ locationName, snapshot, risk, compact = false }) {
  if (!snapshot) return null
  const condition = getWeatherCondition(snapshot.weatherCode)

  return (
    <div className={`weather-card ${compact ? 'compact' : ''}`}>
      <div className="weather-card-top">
        <div>
          <p className="weather-card-location">{locationName}</p>
          <h3 className="weather-card-temp">{Math.round(snapshot.temperature)}°C</h3>
          <p className="weather-card-condition">{condition.label}</p>
        </div>
        <div className="weather-card-icon">
          <WeatherIcon code={snapshot.weatherCode} size={compact ? 36 : 46} strokeWidth={1.6} />
        </div>
      </div>

      <div className="weather-card-grid">
        <div className="weather-card-metric">
          <Droplets size={15} strokeWidth={2} />
          <span>{Math.round(snapshot.humidity)}%</span>
          <label>Humidity</label>
        </div>
        <div className="weather-card-metric">
          <CloudRain size={15} strokeWidth={2} />
          <span>{Math.round(snapshot.precipitationProbability ?? 0)}%</span>
          <label>Rain chance</label>
        </div>
        <div className="weather-card-metric">
          <Wind size={15} strokeWidth={2} />
          <span>{Math.round(snapshot.windSpeed)} km/h</span>
          <label>Wind</label>
        </div>
        <div className="weather-card-metric">
          <Gauge size={15} strokeWidth={2} />
          <span>{Math.round(snapshot.pressure)} hPa</span>
          <label>Pressure</label>
        </div>
      </div>

      {risk && (
        <div className="weather-card-risk">
          <RiskBadge level={risk.level} compact />
        </div>
      )}
    </div>
  )
}
