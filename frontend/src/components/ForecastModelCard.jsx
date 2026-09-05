import { useState } from 'react'
import { Info, CheckCircle2, AlertCircle } from 'lucide-react'
import './ForecastModelCard.css'

export default function ForecastModelCard({
  model = 'ECMWF IFS',
  modelType = 'Numerical Weather Prediction',
  modelInfo = null,
  compact = false,
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  const isUnavailable =
    modelInfo?.isAvailable === false || (!model && !modelInfo?.model)

  const displayModel = modelInfo?.model || model || 'ECMWF IFS'
  const displayType =
    modelInfo?.modelType || modelType || 'Numerical Weather Prediction'
  const explanation =
    modelInfo?.explanation ||
    'NWP (Numerical Weather Prediction) models use mathematical and physical atmospheric models to simulate and forecast future weather conditions.'

  return (
    <div className={`forecast-model-card ${compact ? 'compact' : ''}`}>
      <div className="forecast-model-header">
        <span className="forecast-model-eyebrow">FORECAST MODEL</span>
        <div className="forecast-model-info-wrap">
          <button
            type="button"
            className="forecast-model-info-btn"
            aria-label="What is an NWP model?"
            aria-expanded={showTooltip}
            onClick={() => setShowTooltip((prev) => !prev)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
          >
            <Info size={13} strokeWidth={2.2} />
          </button>

          {showTooltip && (
            <div className="forecast-model-tooltip" role="tooltip">
              <p>{explanation}</p>
            </div>
          )}
        </div>
      </div>

      {isUnavailable ? (
        <div className="forecast-model-unavailable">
          <AlertCircle size={14} className="unavailable-icon" />
          <span>Forecast model information is currently unavailable.</span>
        </div>
      ) : (
        <div className="forecast-model-body">
          <div className="forecast-model-name-row">
            <h4 className="forecast-model-name">{displayModel}</h4>
            <span className="forecast-model-badge">
              <CheckCircle2 size={11} strokeWidth={2.4} /> Live NWP
            </span>
          </div>
          <p className="forecast-model-type">{displayType}</p>
        </div>
      )}
    </div>
  )
}
