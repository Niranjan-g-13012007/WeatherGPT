import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_LOCATION } from '../data/locations.js'
import {
  fetchWeather,
  buildCurrentSnapshot,
  buildDailySummaries,
  getForecastModel,
} from '../services/weatherService.js'
import { getUserCoordinates, reverseGeocode } from '../services/locationService.js'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [location, setLocation] = useState({
    ...DEFAULT_LOCATION,
    source: 'manual',
  })
  const [weatherData, setWeatherData] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)
  const [locationNotice, setLocationNotice] = useState(null)
  const hasAutoLocatedRef = useRef(false)

  // Fetch Open-Meteo weather data using latitude and longitude
  const load = useCallback(async (loc) => {
    if (!loc || loc.latitude == null || loc.longitude == null) return
    setStatus('loading')
    try {
      const data = await fetchWeather(loc.latitude, loc.longitude)
      setWeatherData(data)
      setStatus('success')
    } catch (err) {
      console.error('Failed to fetch weather data:', err)
      setStatus('error')
    }
  }, [])

  // Action: Detect and set user's current geographic location
  const useMyLocation = useCallback(async () => {
    setIsDetectingLocation(true)
    setLocationNotice(null)
    try {
      const coords = await getUserCoordinates()
      const geoInfo = await reverseGeocode(coords.latitude, coords.longitude)

      const userLoc = {
        name: geoInfo.name,
        city: geoInfo.city || geoInfo.name,
        state: geoInfo.state || '',
        country: geoInfo.country || '',
        latitude: coords.latitude,
        longitude: coords.longitude,
        source: 'geolocation',
      }

      setLocation(userLoc)
      setIsDetectingLocation(false)
      return userLoc
    } catch (err) {
      console.warn('Geolocation failed or denied:', err)
      setIsDetectingLocation(false)
      setLocationNotice(
        err?.message || 'Location access is unavailable. Select a location manually to continue.'
      )
      return null
    }
  }, [])

  // Manual location setter
  const setManualLocation = useCallback((newLoc) => {
    setLocationNotice(null)
    setLocation({
      ...newLoc,
      source: newLoc.source || 'manual',
    })
  }, [])

  // Automatic user location on initial page load
  useEffect(() => {
    if (hasAutoLocatedRef.current) return
    hasAutoLocatedRef.current = true

    async function initLocation() {
      if (typeof window !== 'undefined' && navigator.geolocation) {
        setIsDetectingLocation(true)
        try {
          const coords = await getUserCoordinates({ timeout: 8000 })
          const geoInfo = await reverseGeocode(coords.latitude, coords.longitude)

          const userLoc = {
            name: geoInfo.name,
            city: geoInfo.city || geoInfo.name,
            state: geoInfo.state || '',
            country: geoInfo.country || '',
            latitude: coords.latitude,
            longitude: coords.longitude,
            source: 'geolocation',
          }

          setLocation(userLoc)
        } catch (err) {
          // Graceful fallback to default manual location
          console.warn('Initial geolocation not available, falling back to default:', err)
          setLocationNotice('Location access is unavailable. Select a location manually to continue.')
          setLocation({
            ...DEFAULT_LOCATION,
            source: 'manual',
          })
        } finally {
          setIsDetectingLocation(false)
        }
      } else {
        setLocationNotice('Location access is unavailable. Select a location manually to continue.')
      }
    }

    initLocation()
  }, [])

  // Fetch weather whenever active location changes
  useEffect(() => {
    if (location?.latitude != null && location?.longitude != null) {
      load(location)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const snapshot = useMemo(() => buildCurrentSnapshot(weatherData), [weatherData])
  const daily = useMemo(() => buildDailySummaries(weatherData), [weatherData])
  const modelInfo = useMemo(() => getForecastModel(weatherData), [weatherData])

  const value = useMemo(
    () => ({
      location,
      setLocation: setManualLocation,
      useMyLocation,
      isDetectingLocation,
      locationNotice,
      clearLocationNotice: () => setLocationNotice(null),
      weatherData,
      model: weatherData?.model,
      modelType: weatherData?.modelType,
      modelInfo,
      snapshot,
      daily,
      status,
      retry: () => load(location),
    }),
    [
      location,
      setManualLocation,
      useMyLocation,
      isDetectingLocation,
      locationNotice,
      weatherData,
      modelInfo,
      snapshot,
      daily,
      status,
      load,
    ]
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocationWeather() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationWeather must be used within LocationProvider')
  return ctx
}

