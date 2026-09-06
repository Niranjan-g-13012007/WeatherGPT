import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X, ChevronRight, Zap } from 'lucide-react'
import { useAlerts } from '../context/AlertContext.jsx'
import { ALERT_SEVERITIES } from '../utils/alertEngine.js'
import './InAppAlertBanner.css'

export default function InAppAlertBanner() {
  const { activeBannerAlert, setSelectedAlert, dismissAlert } = useAlerts()
  const [dismissedLocally, setDismissedLocally] = useState(false)

  if (!activeBannerAlert || dismissedLocally) return null

  const isExtreme = activeBannerAlert.severity === ALERT_SEVERITIES.EXTREME
  const severityClass = isExtreme ? 'severity-extreme' : 'severity-high'

  function handleView() {
    setSelectedAlert(activeBannerAlert)
  }

  function handleDismiss() {
    setDismissedLocally(true)
    dismissAlert(activeBannerAlert.id)
  }

  return (
    <AnimatePresence>
      <motion.div
        className={`in-app-alert-banner ${severityClass}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <div className="in-app-alert-content">
          <span className="in-app-alert-icon">
            {isExtreme ? <Zap size={16} /> : <AlertCircle size={16} />}
          </span>
          <div className="in-app-alert-text">
            <span className="in-app-alert-title">
              {isExtreme ? 'Extreme Weather Warning:' : 'High Risk Alert:'}
            </span>
            <span className="in-app-alert-msg">{activeBannerAlert.message}</span>
          </div>
        </div>

        <div className="in-app-alert-actions">
          <button className="in-app-alert-view-btn" onClick={handleView}>
            View details →
          </button>
          <button
            className="in-app-alert-close-btn"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
