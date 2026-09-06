// WeatherGPT Language Context
// Provides multilingual state, translation helper, and language selection across the app.

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { LANGUAGES, t as translate } from '../i18n/index.js'
import { useAuth } from './AuthContext.jsx'
import { updatePreferredLanguage } from '../services/chatService.js'

const LanguageContext = createContext(null)

const STORAGE_KEY = 'weathergpt_language'

export function LanguageProvider({ children }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'en'
  })

  // Sync with authenticated user's preferred language from DB on login/mount
  useEffect(() => {
    if (user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguageState(user.preferredLanguage)
      localStorage.setItem(STORAGE_KEY, user.preferredLanguage)
    }
  }, [user?.preferredLanguage])

  // Change language and persist to localStorage + backend if logged in
  const setLanguage = useCallback(
    async (code) => {
      if (!code) return
      setLanguageState(code)
      try {
        localStorage.setItem(STORAGE_KEY, code)
      } catch {
        // Ignore localStorage quota errors
      }

      if (user) {
        try {
          await updatePreferredLanguage(code)
        } catch (err) {
          console.warn('Could not persist language preference to backend:', err.message)
        }
      }
    },
    [user]
  )

  // Bound translate helper
  const t = useCallback(
    (key) => {
      return translate(key, language)
    },
    [language]
  )

  const currentLanguageObj = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]

  const value = {
    language,
    currentLanguage: currentLanguageObj,
    languages: LANGUAGES,
    setLanguage,
    t,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
