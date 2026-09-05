import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOCATION } from '../data/locations.js'
import {
  fetchWeather,
  buildCurrentSnapshot,
  buildDailySummaries,
  getForecastModel,
} from '../services/weatherService.js'

const LocationContext = createContext(null)

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [weatherData, setWeatherData] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | success | error

  const load = useCallback(async (loc) => {
    setStatus('loading')
    try {
      const data = await fetchWeather(loc.latitude, loc.longitude)
      setWeatherData(data)
      setStatus('success')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load(location)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  const snapshot = useMemo(() => buildCurrentSnapshot(weatherData), [weatherData])
  const daily = useMemo(() => buildDailySummaries(weatherData), [weatherData])
  const modelInfo = useMemo(() => getForecastModel(weatherData), [weatherData])

  const value = useMemo(
    () => ({
      location,
      setLocation,
      weatherData,
      model: weatherData?.model,
      modelType: weatherData?.modelType,
      modelInfo,
      snapshot,
      daily,
      status,
      retry: () => load(location),
    }),
    [location, weatherData, modelInfo, snapshot, daily, status, load]
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocationWeather() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationWeather must be used within LocationProvider')
  return ctx
}
