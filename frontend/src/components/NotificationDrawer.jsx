import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  X,
  CheckCheck,
  Clock,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Flame,
  CloudRain,
  Wind,
  Zap,
} from 'lucide-react'
import { useAlerts } from '../context/AlertContext.jsx'
import { ALERT_SEVERITIES, ALERT_TYPES } from '../utils/alertEngine.js'
import './NotificationDrawer.css'

function getAlertIcon(type) {
  switch (type) {
    case ALERT_TYPES.HEAVY_RAIN:
      return <CloudRain size={14} />
    case ALERT_TYPES.EXTREME_HEAT:
      return <Flame size={14} />
    case ALERT_TYPES.STRONG_WIND:
      return <Wind size={14} />
    case ALERT_TYPES.THUNDERSTORM:
      return <Zap size={14} />
    default:
      return <AlertTriangle size={14} />
  }
}

export default function NotificationDrawer() {
  const {
    isPanelOpen,
    closePanel,
    activeAlerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissAlert,
    setSelectedAlert,
    notificationPermission,
    desktopNotifsEnabled,
    requestBrowserNotificationPermission,
  } = useAlerts()

  const [activeTab, setActiveTab] = useState('all') // 'all' | 'unread'

  if (!isPanelOpen) return null

  const displayedAlerts =
    activeTab === 'unread' ? activeAlerts.filter((a) => !a.isRead) : activeAlerts

  function handleSelectAlert(alert) {
    markAsRead(alert.id)
    setSelectedAlert(alert)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="notif-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closePanel}
      >
        <motion.div
          className="notif-drawer"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="notif-drawer-header">
            <div className="notif-drawer-title">
              <Bell size={18} className="text-cyan" />
              <h2>Weather Alerts</h2>
              {unreadCount > 0 && <span className="notif-badge-pill">{unreadCount} new</span>}
            </div>

            <div className="notif-drawer-actions">
              {unreadCount > 0 && (
                <button
                  className="notif-mark-read-btn"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} style={{ display: 'inline', marginRight: 4 }} />
                  Mark all read
                </button>
              )}
              <button className="notif-close-btn" onClick={closePanel} aria-label="Close panel">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Browser Desktop Notifications Prompt */}
          {notificationPermission !== 'granted' && (
            <div className="notif-browser-opt-in">
              <span>Receive severe weather desktop alerts?</span>
              <button onClick={requestBrowserNotificationPermission}>Enable</button>
            </div>
          )}

          {/* Tabs */}
          <div className="notif-tabs">
            <button
              className={`notif-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Alerts
              <span className="notif-tab-count">{activeAlerts.length}</span>
            </button>
            <button
              className={`notif-tab ${activeTab === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveTab('unread')}
            >
              Unread
              <span className="notif-tab-count">{unreadCount}</span>
            </button>
          </div>

          {/* Alerts List */}
          <div className="notif-list">
            {displayedAlerts.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-icon">
                  <ShieldCheck size={24} />
                </div>
                <p>No active alerts</p>
                <span>
                  {activeTab === 'unread'
                    ? 'All weather alerts have been marked as read.'
                    : 'Weather conditions are currently settled with no extreme risks detected.'}
                </span>
              </div>
            ) : (
              displayedAlerts.map((alert) => {
                const severityClass = `severity-${alert.severity.toLowerCase()}`
                const badgeClass = `badge-${alert.severity.toLowerCase()}`

                return (
                  <div
                    key={alert.id}
                    className={`notif-card ${severityClass} ${!alert.isRead ? 'unread' : ''}`}
                  >
                    <div className="notif-card-header">
                      <span className={`notif-card-badge ${badgeClass}`}>
                        {getAlertIcon(alert.type)}
                        {alert.severity} RISK
                      </span>

                      <span className="notif-card-location">
                        <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />
                        {alert.location}
                      </span>
                    </div>

                    <h4>{alert.title}</h4>
                    <p className="notif-card-msg">{alert.message}</p>

                    <div className="notif-card-timing">
                      <Clock size={12} />
                      <span>{alert.expectedAt}</span>
                    </div>

                    <div className="notif-card-footer">
                      <button
                        className="notif-view-btn"
                        onClick={() => handleSelectAlert(alert)}
                      >
                        View details <ChevronRight size={13} />
                      </button>

                      <button
                        className="notif-dismiss-btn"
                        onClick={() => dismissAlert(alert.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footnote */}
          <div className="notif-drawer-footnote">
            Forecast analysis based on Open-Meteo & ECMWF IFS NWP model. For official emergency
            directives, always monitor IMD and state disaster management updates.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
