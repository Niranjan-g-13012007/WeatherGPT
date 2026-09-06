import { Droplets, CloudRain, Wind, Gauge, CheckCircle2 } from 'lucide-react'
import WeatherIcon from './WeatherIcon.jsx'
import RiskBadge from './RiskBadge.jsx'
import ForecastModelCard from './ForecastModelCard.jsx'
import { getWeatherCondition } from '../utils/weatherCode.js'
import { useAlerts } from '../context/AlertContext.jsx'
import './WeatherCard.css'

export default function WeatherCard({
  locationName,
  snapshot,
  risk,
  compact = false,
  model = 'ECMWF IFS',
  modelType = 'Numerical Weather Prediction',
  modelInfo = null,
  showModel = true,
}) {
  const { activeAlerts, setSelectedAlert } = useAlerts()

  if (!snapshot) return null
  const condition = getWeatherCondition(snapshot.weatherCode)
  const topAlert = activeAlerts && activeAlerts.length > 0 ? activeAlerts[0] : null

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

      {/* Extreme Weather Alerts Section */}
      <div className="weather-card-alert-section">
        <div className="weather-card-alert-header">
          <span className="weather-card-alert-title">WEATHER ALERT</span>
        </div>

        {topAlert ? (
          <div className={`weather-card-alert-box severity-${topAlert.severity.toLowerCase()}`}>
            <div className="weather-card-alert-status">
              <span className={`alert-dot dot-${topAlert.severity.toLowerCase()}`}></span>
              <strong>{topAlert.severity} RISK</strong>
            </div>
            <p className="weather-card-alert-text">{topAlert.message}</p>
            <button
              className="weather-card-alert-btn"
              onClick={() => setSelectedAlert(topAlert)}
            >
              View alert →
            </button>
          </div>
        ) : (
          <div className="weather-card-no-alert">
            <CheckCircle2 size={13} />
            <span>No significant weather alerts</span>
          </div>
        )}
      </div>

      {showModel && (
        <div className="weather-card-model-section">
          <ForecastModelCard
            model={model}
            modelType={modelType}
            modelInfo={modelInfo}
            compact={compact}
          />
        </div>
      )}
    </div>
  )
}
