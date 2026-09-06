import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  Sparkles,
  Info,
  MapPin,
  ArrowRightLeft,
  CloudRain,
  Thermometer,
  Wind,
  Droplets,
} from 'lucide-react'
import { useLocationWeather } from '../context/LocationContext.jsx'
import { LOCATIONS } from '../data/locations.js'
import {
  fetchHistoricalWeather,
  aggregateYearlyData,
  aggregateMonthlyData,
  calculateLinearTrend,
  generateClimateNarrative,
} from '../services/historicalWeatherService.js'
import { LoadingState, ErrorState } from '../components/DataState.jsx'
import './Climate.css'

const METRIC_OPTIONS = [
  { key: 'avgTemp', label: 'Average Temperature', unit: '°C', icon: Thermometer },
  { key: 'avgMaxTemp', label: 'Maximum Temperature', unit: '°C', icon: Thermometer },
  { key: 'avgMinTemp', label: 'Minimum Temperature', unit: '°C', icon: Thermometer },
  { key: 'totalRainfall', label: 'Annual Rainfall', unit: 'mm', icon: CloudRain },
  { key: 'avgHumidity', label: 'Relative Humidity', unit: '%', icon: Droplets },
  { key: 'avgWindSpeed', label: 'Wind Speed', unit: 'km/h', icon: Wind },
]

const PERIOD_PRESETS = [
  { label: 'Last 5 Years', start: '2020-01-01', end: '2024-12-31', yearsLabel: '2020–2024' },
  { label: 'Last 10 Years', start: '2015-01-01', end: '2024-12-31', yearsLabel: '2015–2024' },
  { label: 'Last 20 Years', start: '2005-01-01', end: '2024-12-31', yearsLabel: '2005–2024' },
  { label: '2016 – 2025', start: '2016-01-01', end: '2025-12-31', yearsLabel: '2016–2025' },
]

export default function Climate() {
  const { location: activeLoc } = useLocationWeather()

  // Selected primary location
  const [selectedLoc, setSelectedLoc] = useState(() => activeLoc || LOCATIONS[0])

  // Comparison secondary location (null by default)
  const [compareLoc, setCompareLoc] = useState(null)

  // Selected period preset
  const [periodPreset, setPeriodPreset] = useState(PERIOD_PRESETS[1]) // Last 10 Years default

  // Selected metric
  const [selectedMetric, setSelectedMetric] = useState('avgTemp')

  // Granularity: 'yearly' | 'monthly'
  const [granularity, setGranularity] = useState('yearly')

  // Fetch states
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [primaryDailyData, setPrimaryDailyData] = useState(null)
  const [compareDailyData, setCompareDailyData] = useState(null)

  // Update selected location if active location from context changes initially
  useEffect(() => {
    if (activeLoc?.latitude && activeLoc?.longitude) {
      setSelectedLoc(activeLoc)
    }
  }, [activeLoc])

  // Fetch primary historical data
  const loadData = useCallback(async () => {
    if (!selectedLoc?.latitude || !selectedLoc?.longitude) return
    setLoading(true)
    setError(null)

    try {
      const primaryRes = await fetchHistoricalWeather(
        selectedLoc.latitude,
        selectedLoc.longitude,
        periodPreset.start,
        periodPreset.end
      )
      setPrimaryDailyData(primaryRes.daily)

      // If comparing, fetch secondary location too
      if (compareLoc?.latitude && compareLoc?.longitude) {
        const compareRes = await fetchHistoricalWeather(
          compareLoc.latitude,
          compareLoc.longitude,
          periodPreset.start,
          periodPreset.end
        )
        setCompareDailyData(compareRes.daily)
      } else {
        setCompareDailyData(null)
      }
    } catch (err) {
      console.error('Failed to load historical weather:', err)
      setError(err.message || 'Historical weather data is currently unavailable.')
    } finally {
      setLoading(false)
    }
  }, [selectedLoc, compareLoc, periodPreset])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Aggregated yearly and monthly data
  const primaryYearly = useMemo(() => {
    if (!primaryDailyData) return []
    return aggregateYearlyData(primaryDailyData)
  }, [primaryDailyData])

  const primaryMonthly = useMemo(() => {
    if (!primaryDailyData) return []
    return aggregateMonthlyData(primaryDailyData)
  }, [primaryDailyData])

  const compareYearly = useMemo(() => {
    if (!compareDailyData) return []
    return aggregateYearlyData(compareDailyData)
  }, [compareDailyData])

  // Current metric config
  const metricConfig = useMemo(() => {
    return METRIC_OPTIONS.find((m) => m.key === selectedMetric) || METRIC_OPTIONS[0]
  }, [selectedMetric])

  // Trend calculations
  const primaryTrend = useMemo(() => {
    return calculateLinearTrend(primaryYearly, selectedMetric)
  }, [primaryYearly, selectedMetric])

  const compareTrend = useMemo(() => {
    if (!compareYearly.length) return null
    return calculateLinearTrend(compareYearly, selectedMetric)
  }, [compareYearly, selectedMetric])

  // Chart data formatting
  const chartData = useMemo(() => {
    if (granularity === 'monthly') {
      return primaryMonthly.map((m) => ({
        label: m.month,
        [selectedLoc.name]: m[selectedMetric === 'totalRainfall' ? 'avgRainfall' : selectedMetric] ?? m.avgTemp,
      }))
    }

    return primaryYearly.map((y) => {
      const point = {
        year: String(y.year),
        [selectedLoc.name]: y[selectedMetric],
      }
      if (compareLoc && compareYearly.length) {
        const matchComp = compareYearly.find((c) => c.year === y.year)
        if (matchComp) {
          point[compareLoc.name] = matchComp[selectedMetric]
        }
      }
      return point
    })
  }, [granularity, primaryMonthly, primaryYearly, compareYearly, selectedMetric, selectedLoc.name, compareLoc])

  // Narrative insight
  const narrative = useMemo(() => {
    return generateClimateNarrative(primaryYearly, primaryTrend, selectedMetric, selectedLoc.name)
  }, [primaryYearly, primaryTrend, selectedMetric, selectedLoc.name])

  // Comparative insight
  const comparativeInsight = useMemo(() => {
    if (!compareLoc || !compareTrend || !primaryTrend) return null

    const primaryAvg = primaryTrend.historicalAvg
    const compAvg = compareTrend.historicalAvg
    const diff = Number((primaryAvg - compAvg).toFixed(2))
    const absDiff = Math.abs(diff)
    const unit = metricConfig.unit

    if (absDiff < 0.2) {
      return `${selectedLoc.name} and ${compareLoc.name} recorded very similar historical averages (${primaryAvg}${unit} vs ${compAvg}${unit}) over this timeframe.`
    } else if (diff > 0) {
      return `${selectedLoc.name} historically averaged ${absDiff}${unit} higher in ${metricConfig.label.toLowerCase()} than ${compareLoc.name} (${primaryAvg}${unit} vs ${compAvg}${unit}) throughout ${periodPreset.yearsLabel}.`
    } else {
      return `${compareLoc.name} historically registered higher ${metricConfig.label.toLowerCase()} than ${selectedLoc.name} by ~${absDiff}${unit} (${compAvg}${unit} vs ${primaryAvg}${unit}).`
    }
  }, [compareLoc, compareTrend, primaryTrend, metricConfig, selectedLoc.name, periodPreset.yearsLabel])

  return (
    <main className="climate-page">
      <div className="wg-container">
        {/* Header */}
        <div className="climate-header">
          <h1>Climate & Historical Analysis</h1>
          <p>
            Explore historical weather patterns, compare past conditions, and understand long-term
            climate trends.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="climate-controls-bar">
          <div className="climate-controls-group">
            {/* Primary Location Selector */}
            <div className="climate-control-item">
              <label>Location</label>
              <select
                className="climate-select"
                value={selectedLoc.name}
                onChange={(e) => {
                  const found = LOCATIONS.find((l) => l.name === e.target.value)
                  if (found) setSelectedLoc(found)
                }}
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Period Selector */}
            <div className="climate-control-item">
              <label>Period</label>
              <select
                className="climate-select"
                value={periodPreset.label}
                onChange={(e) => {
                  const preset = PERIOD_PRESETS.find((p) => p.label === e.target.value)
                  if (preset) setPeriodPreset(preset)
                }}
              >
                {PERIOD_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label} ({p.yearsLabel})
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Selector */}
            <div className="climate-control-item">
              <label>Metric</label>
              <select
                className="climate-select"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Granularity Toggle */}
          <div className="climate-toggle-group">
            <button
              className={`climate-toggle-btn ${granularity === 'yearly' ? 'active' : ''}`}
              onClick={() => setGranularity('yearly')}
            >
              Yearly Trend
            </button>
            <button
              className={`climate-toggle-btn ${granularity === 'monthly' ? 'active' : ''}`}
              onClick={() => setGranularity('monthly')}
            >
              Monthly / Seasonal
            </button>
          </div>
        </div>

        {/* Loading / Error / Content */}
        {loading && <LoadingState message="Retrieving real historical climate reanalysis data..." />}
        {error && <ErrorState message={error} onRetry={loadData} />}

        {!loading && !error && (
          <>
            {/* Climate Summary Cards */}
            <div className="climate-summary-grid">
              {/* Historical Average */}
              <div className="climate-summary-card">
                <span className="climate-card-label">Historical Average</span>
                <span className="climate-card-value">
                  {primaryTrend.historicalAvg} {metricConfig.unit}
                </span>
                <span className="climate-card-sub">Baseline across {periodPreset.yearsLabel}</span>
              </div>

              {/* Recent Average */}
              <div className="climate-summary-card">
                <span className="climate-card-label">Recent Average</span>
                <span className="climate-card-value">
                  {primaryTrend.recentAvg} {metricConfig.unit}
                </span>
                <span className="climate-card-sub">Past 3 recorded years</span>
              </div>

              {/* Period Change */}
              <div className="climate-summary-card">
                <span className="climate-card-label">Period Difference</span>
                <span className="climate-card-value">
                  {primaryTrend.difference > 0 ? `+${primaryTrend.difference}` : primaryTrend.difference}{' '}
                  {metricConfig.unit}
                </span>
                <span className="climate-card-sub">
                  {primaryTrend.difference > 0
                    ? 'Above historical baseline'
                    : primaryTrend.difference < 0
                    ? 'Below historical baseline'
                    : 'Consistent with baseline'}
                </span>
              </div>

              {/* Climate Trend */}
              <div className="climate-summary-card">
                <span className="climate-card-label">Trend Direction</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span
                    className={`climate-trend-badge trend-${primaryTrend.direction.toLowerCase()}`}
                  >
                    {primaryTrend.directionIcon} {primaryTrend.direction}
                  </span>
                </div>
                <span className="climate-card-sub" style={{ marginTop: 6 }}>
                  Slope: {primaryTrend.slope > 0 ? `+${primaryTrend.slope}` : primaryTrend.slope}{' '}
                  {metricConfig.unit}/year
                </span>
              </div>
            </div>

            {/* Main Interactive Chart */}
            <div className="climate-chart-card">
              <div className="climate-chart-head">
                <div className="climate-chart-title">
                  <h3>
                    {metricConfig.label} — {selectedLoc.name}{' '}
                    {compareLoc ? `vs. ${compareLoc.name}` : ''}
                  </h3>
                  <p>
                    {granularity === 'yearly'
                      ? `Annual progression across ${periodPreset.yearsLabel}`
                      : 'Climatological monthly distribution (Jan–Dec)'}
                  </p>
                </div>
              </div>

              <div className="climate-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  {selectedMetric === 'totalRainfall' && granularity === 'yearly' ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tickLine={false} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        unit={` ${metricConfig.unit}`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div className="climate-tooltip">
                              <p className="climate-tooltip-title">Year: {label}</p>
                              {payload.map((entry) => (
                                <p key={entry.name} className="climate-tooltip-metric">
                                  {entry.name}: {entry.value} {metricConfig.unit}
                                </p>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend />
                      <Bar dataKey={selectedLoc.name} fill="#04A6C4" radius={[4, 4, 0, 0]} />
                      {compareLoc && (
                        <Bar dataKey={compareLoc.name} fill="#DE7A1F" radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  ) : (
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey={granularity === 'yearly' ? 'year' : 'label'}
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        unit={` ${metricConfig.unit}`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div className="climate-tooltip">
                              <p className="climate-tooltip-title">
                                {granularity === 'yearly' ? `Year ${label}` : label}
                              </p>
                              {payload.map((entry) => (
                                <p key={entry.name} className="climate-tooltip-metric">
                                  {entry.name}: {entry.value} {metricConfig.unit}
                                </p>
                              ))}
                            </div>
                          )
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey={selectedLoc.name}
                        stroke="#04A6C4"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#04A6C4' }}
                        activeDot={{ r: 6 }}
                      />
                      {compareLoc && (
                        <Line
                          type="monotone"
                          dataKey={compareLoc.name}
                          stroke="#DE7A1F"
                          strokeWidth={2.5}
                          strokeDasharray="4 4"
                          dot={{ r: 4, fill: '#DE7A1F' }}
                          activeDot={{ r: 6 }}
                        />
                      )}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Natural-Language Analytical Summary */}
            <div className="climate-narrative-card">
              <div className="climate-narrative-icon">
                <Sparkles size={18} />
              </div>
              <div className="climate-narrative-text">
                <h4>Climate Trend Analysis</h4>
                <p>{narrative}</p>
                {comparativeInsight && (
                  <p style={{ marginTop: 8, fontWeight: 600, color: 'var(--color-navy)' }}>
                    {comparativeInsight}
                  </p>
                )}
              </div>
            </div>

            {/* Location Comparison Section */}
            <div className="climate-compare-section">
              <div className="climate-compare-head">
                <div>
                  <h3>Location Climate Comparison</h3>
                  <p style={{ fontSize: '0.84rem', color: 'var(--color-navy-faint)', marginTop: 2 }}>
                    Compare historical trends side-by-side between two cities.
                  </p>
                </div>

                <div className="climate-compare-selector">
                  <ArrowRightLeft size={16} />
                  <span>Compare with:</span>
                  <select
                    className="climate-select"
                    value={compareLoc?.name || ''}
                    onChange={(e) => {
                      if (!e.target.value) {
                        setCompareLoc(null)
                      } else {
                        const found = LOCATIONS.find((l) => l.name === e.target.value)
                        if (found) setCompareLoc(found)
                      }
                    }}
                  >
                    <option value="">None (Single Location)</option>
                    {LOCATIONS.filter((l) => l.name !== selectedLoc.name).map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Comparison Data Table */}
              <div style={{ overflowX: 'auto' }}>
                <table className="climate-compare-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>
                        {selectedLoc.name} ({metricConfig.unit})
                      </th>
                      {compareLoc && (
                        <th>
                          {compareLoc.name} ({metricConfig.unit})
                        </th>
                      )}
                      {compareLoc && <th>Difference</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {primaryYearly.map((pYear) => {
                      const cYear = compareYearly.find((c) => c.year === pYear.year)
                      const valA = pYear[selectedMetric]
                      const valB = cYear ? cYear[selectedMetric] : null
                      const diff = valB != null ? Number((valA - valB).toFixed(2)) : null

                      return (
                        <tr key={pYear.year}>
                          <td>{pYear.year}</td>
                          <td>
                            {valA} {metricConfig.unit}
                          </td>
                          {compareLoc && (
                            <td>
                              {valB != null ? `${valB} ${metricConfig.unit}` : 'N/A'}
                            </td>
                          )}
                          {compareLoc && (
                            <td
                              style={{
                                color:
                                  diff > 0
                                    ? 'var(--color-risk-extreme)'
                                    : diff < 0
                                    ? 'var(--color-cyan-dark)'
                                    : 'inherit',
                              }}
                            >
                              {diff != null ? (diff > 0 ? `+${diff}` : diff) : '—'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Monthly / Seasonal Profile Grid */}
            {granularity === 'monthly' && (
              <div className="climate-chart-card">
                <h3>Seasonal & Monthly Climatology ({selectedLoc.name})</h3>
                <p style={{ fontSize: '0.84rem', color: 'var(--color-navy-faint)', marginTop: 2 }}>
                  Historical monthly averages calculated over the {periodPreset.yearsLabel} observation
                  period.
                </p>

                <div className="climate-monthly-grid">
                  {primaryMonthly.map((m) => (
                    <div key={m.month} className="climate-month-card">
                      <span className="climate-month-name">{m.month}</span>
                      <span className="climate-month-val">
                        {selectedMetric === 'totalRainfall'
                          ? `${m.avgRainfall} mm`
                          : selectedMetric === 'avgHumidity'
                          ? `${m.avgHumidity}%`
                          : selectedMetric === 'avgWindSpeed'
                          ? `${m.avgWindSpeed} km/h`
                          : `${m.avgTemp}°C`}
                      </span>
                      <span className="climate-month-desc">
                        {m.avgTemp >= 30
                          ? 'Hot & humid'
                          : m.avgTemp >= 24
                          ? 'Warm & mild'
                          : m.avgTemp >= 18
                          ? 'Comfortable'
                          : 'Cool / mountain'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Display Banner */}
            <div className="climate-source-banner">
              <div>
                <strong>Data Source:</strong> Open-Meteo Historical Archive (ECMWF ERA5 Reanalysis).
                Coverage: {periodPreset.yearsLabel}.
              </div>
              <div>
                <span>Independent from real-time NWP forecast cycles.</span>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
