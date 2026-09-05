import { useState } from 'react'
import {
  Compass,
  Car,
  Sprout,
  ShieldCheck,
  AlertTriangle,
  CloudRain,
  Wind,
  Droplets,
  Calendar,
} from 'lucide-react'
import RiskBadge from './RiskBadge.jsx'
import { generateLocationAdvisory } from '../utils/advisoryEngine.js'
import './WeatherAdvisoryCard.css'

export default function WeatherAdvisoryCard({
  weatherData,
  snapshot,
  locationName = 'Current Location',
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState('general') // general | travel | agriculture
  const [period, setPeriod] = useState('tomorrow') // tomorrow | today

  const advisoryData = generateLocationAdvisory({
    weatherData,
    snapshot,
    locationName,
    period,
  })

  if (!advisoryData) return null

  const { metrics, risk, general, travel, agriculture } = advisoryData

  const activeAdvisory =
    activeTab === 'travel'
      ? travel
      : activeTab === 'agriculture'
      ? agriculture
      : general

  return (
    <div className={`weather-advisory-card ${compact ? 'compact' : ''}`}>
      <div className="advisory-card-header">
        <div className="advisory-header-title">
          <span className="advisory-badge-pulse">
            <Compass size={15} strokeWidth={2.2} />
          </span>
          <div>
            <h4 className="advisory-title">WEATHER ADVISORY</h4>
            <span className="advisory-subtitle">
              Grounded in ECMWF IFS forecasts for {locationName}
            </span>
          </div>
        </div>

        <div className="advisory-period-toggle">
          <button
            className={`advisory-period-btn ${period === 'today' ? 'active' : ''}`}
            onClick={() => setPeriod('today')}
          >
            Today
          </button>
          <button
            className={`advisory-period-btn ${period === 'tomorrow' ? 'active' : ''}`}
            onClick={() => setPeriod('tomorrow')}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Advisory Context Tabs */}
      <div className="advisory-tabs">
        <button
          className={`advisory-tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <ShieldCheck size={14} strokeWidth={2.2} />
          General
        </button>
        <button
          className={`advisory-tab ${activeTab === 'travel' ? 'active' : ''}`}
          onClick={() => setActiveTab('travel')}
        >
          <Car size={14} strokeWidth={2.2} />
          Travel
        </button>
        <button
          className={`advisory-tab ${activeTab === 'agriculture' ? 'active' : ''}`}
          onClick={() => setActiveTab('agriculture')}
        >
          <Sprout size={14} strokeWidth={2.2} />
          Agriculture
        </button>
      </div>

      {/* Active Advisory Body */}
      <div className="advisory-body">
        <div className="advisory-headline-row">
          <h3 className="advisory-headline">{activeAdvisory.headline}</h3>
        </div>

        <p className="advisory-summary">{activeAdvisory.summary}</p>

        {/* Metrics Strip */}
        <div className="advisory-metrics-strip">
          <div className="advisory-metric">
            <CloudRain size={14} strokeWidth={2} />
            <span className="advisory-metric-label">Rain chance</span>
            <strong className="advisory-metric-val">{metrics.precipProb}%</strong>
          </div>
          <div className="advisory-metric">
            <Droplets size={14} strokeWidth={2} />
            <span className="advisory-metric-label">Expected rain</span>
            <strong className="advisory-metric-val">{metrics.precipSum} mm</strong>
          </div>
          <div className="advisory-metric">
            <Wind size={14} strokeWidth={2} />
            <span className="advisory-metric-label">Max wind</span>
            <strong className="advisory-metric-val">{metrics.windSpeed} km/h</strong>
          </div>
        </div>

        {/* Recommendation Box */}
        <div className="advisory-recommendation-box">
          <span className="advisory-recommendation-tag">
            {activeTab === 'agriculture'
              ? 'Farming Guidance'
              : activeTab === 'travel'
              ? 'Travel Guidance'
              : 'Recommendation'}
          </span>
          <p className="advisory-recommendation-text">
            {activeAdvisory.recommendation}
          </p>
        </div>

        {/* Footer with Risk Level */}
        <div className="advisory-footer">
          <div className="advisory-risk-indicator">
            <span className="advisory-risk-label">Risk assessment:</span>
            <RiskBadge level={activeAdvisory.riskLevel || risk.level} compact />
          </div>
          <span className="advisory-live-pill">
            <span className="pulse-dot" /> Live Data
          </span>
        </div>
      </div>
    </div>
  )
}
