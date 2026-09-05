import { ShieldCheck, ShieldAlert, ShieldX, TriangleAlert } from 'lucide-react'
import './RiskBadge.css'

const CONFIG = {
  LOW: { icon: ShieldCheck, className: 'risk-low', label: 'Low risk' },
  MODERATE: { icon: ShieldAlert, className: 'risk-moderate', label: 'Moderate risk' },
  HIGH: { icon: TriangleAlert, className: 'risk-high', label: 'High risk' },
  EXTREME: { icon: ShieldX, className: 'risk-extreme', label: 'Extreme risk' },
}

export default function RiskBadge({ level = 'LOW', compact = false }) {
  const config = CONFIG[level] ?? CONFIG.LOW
  const Icon = config.icon

  return (
    <span className={`risk-badge ${config.className} ${compact ? 'compact' : ''}`}>
      <Icon size={14} strokeWidth={2.4} />
      {config.label}
    </span>
  )
}
