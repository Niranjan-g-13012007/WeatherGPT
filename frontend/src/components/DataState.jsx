import { motion } from 'framer-motion'
import { RefreshCw, CloudOff } from 'lucide-react'
import './DataState.css'

export function LoadingState({ label = 'Reading atmospheric conditions...' }) {
  return (
    <div className="data-state">
      <motion.div
        className="data-state-spinner"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
      />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ onRetry }) {
  return (
    <div className="data-state">
      <div className="data-state-icon">
        <CloudOff size={22} strokeWidth={1.8} />
      </div>
      <p>Weather data is temporarily unavailable.</p>
      <button className="wg-btn wg-btn-secondary" onClick={onRetry}>
        <RefreshCw size={15} /> Retry
      </button>
    </div>
  )
}
