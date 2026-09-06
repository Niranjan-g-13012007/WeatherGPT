import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocationWeather } from './LocationContext.jsx'
import { evaluateForecastAlerts, ALERT_SEVERITIES } from '../utils/alertEngine.js'

const AlertContext = createContext(null)

const READ_STORAGE_KEY = 'weathergpt_read_alerts_v1'
const DISMISSED_STORAGE_KEY = 'weathergpt_dismissed_alerts_v1'
const NOTIF_PREF_KEY = 'weathergpt_desktop_notifs_enabled'

export function AlertProvider({ children }) {
  const { weatherData, location, snapshot } = useLocationWeather()

  // Persistent read and dismissed alert IDs
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem(READ_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Drawer and detail modal state
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)

  // Browser notification permission state
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })

  // Desktop notifications user preference (enabled by default if granted)
  const [desktopNotifsEnabled, setDesktopNotifsEnabled] = useState(() => {
    try {
      return localStorage.getItem(NOTIF_PREF_KEY) === 'true'
    } catch {
      return false
    }
  })

  const alreadyNotifiedRef = useRef(new Set())

  // Save read & dismissed IDs
  useEffect(() => {
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(readIds))
    } catch (err) {
      console.warn('Failed to save read alert IDs:', err)
    }
  }, [readIds])

  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(dismissedIds))
    } catch (err) {
      console.warn('Failed to save dismissed alert IDs:', err)
    }
  }, [dismissedIds])

  // Save desktop notifications preference
  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_PREF_KEY, String(desktopNotifsEnabled))
    } catch (err) {
      console.warn('Failed to save desktop notification preference:', err)
    }
  }, [desktopNotifsEnabled])

  // Evaluate alerts from real weatherData
  const rawAlerts = useMemo(() => {
    if (!weatherData) return []
    return evaluateForecastAlerts(weatherData, location?.name || 'Your location')
  }, [weatherData, location?.name])

  // Decorate with read state and filter out completely expired/dismissed alerts
  const alerts = useMemo(() => {
    return rawAlerts.map((alert) => ({
      ...alert,
      isRead: readIds.includes(alert.id),
      isDismissed: dismissedIds.includes(alert.id),
    }))
  }, [rawAlerts, readIds, dismissedIds])

  // Active (non-dismissed) alerts
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !a.isDismissed && a.lifecycle !== 'Expired')
  }, [alerts])

  // Unread count
  const unreadCount = useMemo(() => {
    return activeAlerts.filter((a) => !a.isRead).length
  }, [activeAlerts])

  // In-app banner alert: highest severity among active non-dismissed HIGH or EXTREME alerts
  const activeBannerAlert = useMemo(() => {
    return (
      activeAlerts.find(
        (a) => a.severity === ALERT_SEVERITIES.EXTREME || a.severity === ALERT_SEVERITIES.HIGH
      ) || null
    )
  }, [activeAlerts])

  // Request browser notification permission
  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return 'unsupported'
    }

    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      if (permission === 'granted') {
        setDesktopNotifsEnabled(true)
      }
      return permission
    } catch (err) {
      console.warn('Error requesting notification permission:', err)
      return 'denied'
    }
  }, [])

  // Send desktop notification if enabled
  const sendBrowserNotification = useCallback(
    (alert) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        Notification.permission !== 'granted' ||
        !desktopNotifsEnabled
      ) {
        return
      }

      if (alreadyNotifiedRef.current.has(alert.id)) {
        return
      }

      try {
        const notif = new Notification(`WeatherGPT · ${alert.title}`, {
          body: `${alert.message}\nExpected: ${alert.expectedAt}`,
          icon: '/favicon.ico',
          tag: alert.id,
        })

        notif.onclick = () => {
          window.focus()
          setSelectedAlert(alert)
          setIsPanelOpen(true)
        }

        alreadyNotifiedRef.current.add(alert.id)
      } catch (err) {
        console.warn('Failed to dispatch browser notification:', err)
      }
    },
    [desktopNotifsEnabled]
  )

  // Trigger notifications for new HIGH/EXTREME alerts
  useEffect(() => {
    if (!desktopNotifsEnabled || notificationPermission !== 'granted') return

    activeAlerts.forEach((alert) => {
      if (
        (alert.severity === ALERT_SEVERITIES.EXTREME || alert.severity === ALERT_SEVERITIES.HIGH) &&
        !alreadyNotifiedRef.current.has(alert.id)
      ) {
        sendBrowserNotification(alert)
      }
    })
  }, [activeAlerts, desktopNotifsEnabled, notificationPermission, sendBrowserNotification])

  // Actions
  const markAsRead = useCallback((id) => {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const markAllAsRead = useCallback(() => {
    const allIds = rawAlerts.map((a) => a.id)
    setReadIds((prev) => Array.from(new Set([...prev, ...allIds])))
  }, [rawAlerts])

  const dismissAlert = useCallback((id) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const openPanel = useCallback(() => setIsPanelOpen(true), [])
  const closePanel = useCallback(() => setIsPanelOpen(false), [])

  const value = {
    alerts,
    activeAlerts,
    unreadCount,
    activeBannerAlert,
    isPanelOpen,
    openPanel,
    closePanel,
    selectedAlert,
    setSelectedAlert,
    markAsRead,
    markAllAsRead,
    dismissAlert,
    notificationPermission,
    desktopNotifsEnabled,
    setDesktopNotifsEnabled,
    requestBrowserNotificationPermission,
  }

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>
}

export function useAlerts() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider')
  }
  return context
}
