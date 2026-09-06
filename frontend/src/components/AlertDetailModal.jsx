import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldAlert, MapPin, Clock, Info } from 'lucide-react'
import { useAlerts } from '../context/AlertContext.jsx'
import './AlertDetailModal.css'

export default function AlertDetailModal() {
  const { selectedAlert, setSelectedAlert } = useAlerts()

  if (!selectedAlert) return null

  const {
    title,
    severity,
    location,
    message,
    expectedAt,
    recommendedAction,
    metrics,
    source,
  } = selectedAlert

  const badgeClass = `badge-${severity.toLowerCase()}`

  return (
    <AnimatePresence>
      <motion.div
        className="alert-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setSelectedAlert(null)}
      >
        <motion.div
          className="alert-modal"
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="alert-modal-header">
            <div>
              <div className="alert-modal-meta">
                <span className={`notif-card-badge ${badgeClass}`}>
                  <ShieldAlert size={14} />
                  {severity} RISK ALERT
                </span>

                <span className="notif-card-location">
                  <MapPin size={12} style={{ display: 'inline', marginRight: 3 }} />
                  {location}
                </span>
              </div>
              <h3>{title}</h3>
            </div>

            <button
              className="alert-modal-close"
              onClick={() => setSelectedAlert(null)}
              aria-label="Close details"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="alert-modal-body">
            <p className="alert-modal-summary">{message}</p>

            {/* Metrics Grid */}
            <div className="alert-metrics-grid">
              <div className="alert-metric-item">
                <span>Expected Window</span>
                <strong>{expectedAt}</strong>
              </div>

              {metrics?.precipitationProbability != null && (
                <div className="alert-metric-item">
                  <span>Rain Probability</span>
                  <strong>{metrics.precipitationProbability}%</strong>
                </div>
              )}

              {metrics?.precipitationSum != null && (
                <div className="alert-metric-item">
                  <span>Precipitation Sum</span>
                  <strong>{metrics.precipitationSum} mm</strong>
                </div>
              )}

              {metrics?.tempMax != null && (
                <div className="alert-metric-item">
                  <span>Forecast Max Temp</span>
                  <strong>{metrics.tempMax}°C</strong>
                </div>
              )}

              {metrics?.windSpeed != null && (
                <div className="alert-metric-item">
                  <span>Expected Wind Gusts</span>
                  <strong>{metrics.windSpeed} km/h</strong>
                </div>
              )}
            </div>

            {/* Precautions */}
            <div className="alert-precautions-card">
              <h5>Recommended Precautions</h5>
              <p>{recommendedAction}</p>
            </div>

            {/* Disclaimer */}
            <div className="alert-disclaimer-box">
              <Info size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: -2 }} />
              <strong>WeatherGPT Advisory Notice:</strong> This early warning is generated from
              algorithmic analysis of Open-Meteo NWP (ECMWF IFS) data. It is an automated risk
              indicator and not an official government warning. In serious emergencies, always follow
              instructions from official local authorities and the IMD.
            </div>
          </div>

          {/* Footer */}
          <div className="alert-modal-footer">
            <span className="alert-source-tag">Source: {source}</span>
            <button className="alert-gotit-btn" onClick={() => setSelectedAlert(null)}>
              Dismiss
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
