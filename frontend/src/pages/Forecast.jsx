import { useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useLocationWeather } from '../context/LocationContext.jsx'
import ForecastCard from '../components/ForecastCard.jsx'
import LocationPicker from '../components/LocationPicker.jsx'
import WeatherCard from '../components/WeatherCard.jsx'
import { LoadingState, ErrorState } from '../components/DataState.jsx'
import { evaluateRisk } from '../utils/riskEngine.js'
import { getWeatherCondition } from '../utils/weatherCode.js'
import './Forecast.css'

function formatDayShort(dateStr, index) {
  if (index === 0) return 'Today'
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
}

export default function Forecast() {
  const { location, setLocation, snapshot, daily, status, retry } = useLocationWeather()
  const [activeDay, setActiveDay] = useState(0)
  const risk = snapshot ? evaluateRisk(snapshot) : null

  const chartData = daily.map((d, i) => ({
    day: formatDayShort(d.date, i),
    max: Math.round(d.tempMax),
    min: Math.round(d.tempMin),
  }))

  const selected = daily[activeDay]
  const selectedCondition = selected ? getWeatherCondition(selected.weatherCode) : null

  return (
    <main className="forecast-page">
      <div className="wg-container">
        <div className="forecast-head">
          <div>
            <h1>Forecast</h1>
            <p>A 7-day outlook, built from live Open-Meteo data.</p>
          </div>
          <LocationPicker location={location} onChange={setLocation} />
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && <ErrorState onRetry={retry} />}

        {status === 'success' && (
          <>
            <div className="forecast-top">
              <WeatherCard locationName={location.name} snapshot={snapshot} risk={risk} />

              {selected && (
                <motion.div
                  className="forecast-detail"
                  key={activeDay}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <p className="forecast-detail-day">{formatDayShort(selected.date, activeDay)}</p>
                  <h3>{selectedCondition.label}</h3>
                  <div className="forecast-detail-row">
                    <span>High</span>
                    <strong>{Math.round(selected.tempMax)}°C</strong>
                  </div>
                  <div className="forecast-detail-row">
                    <span>Low</span>
                    <strong>{Math.round(selected.tempMin)}°C</strong>
                  </div>
                  <div className="forecast-detail-row">
                    <span>Rain chance</span>
                    <strong>{Math.round(selected.precipitationProbability ?? 0)}%</strong>
                  </div>
                  <div className="forecast-detail-row">
                    <span>Wind (max)</span>
                    <strong>{Math.round(selected.windSpeedMax)} km/h</strong>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="forecast-strip">
              {daily.map((day, i) => (
                <ForecastCard
                  key={day.date}
                  day={day}
                  index={i}
                  active={i === activeDay}
                  onClick={() => setActiveDay(i)}
                />
              ))}
            </div>

            <div className="forecast-chart-card">
              <p className="forecast-chart-label">Temperature outlook (°C)</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid stroke="#EAF1F7" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#7C8AA0' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#7C8AA0' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #DCE7F0', fontSize: 13 }}
                  />
                  <Line type="monotone" dataKey="max" stroke="#04A6C4" strokeWidth={2.4} dot={{ r: 3 }} name="High" />
                  <Line type="monotone" dataKey="min" stroke="#B9CBDD" strokeWidth={2.4} dot={{ r: 3 }} name="Low" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
