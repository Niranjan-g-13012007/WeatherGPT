import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { LOCATIONS } from '../data/locations.js'
import './LocationPicker.css'

export default function LocationPicker({ location, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="location-picker" ref={ref}>
      <button className="location-picker-trigger" onClick={() => setOpen((o) => !o)}>
        <MapPin size={14} strokeWidth={2.2} />
        {location.name}
        <ChevronDown size={14} strokeWidth={2.2} className={open ? 'rotated' : ''} />
      </button>

      {open && (
        <div className="location-picker-menu">
          {LOCATIONS.map((loc) => (
            <button
              key={loc.name}
              className={'location-picker-item' + (loc.name === location.name ? ' active' : '')}
              onClick={() => {
                onChange(loc)
                setOpen(false)
              }}
            >
              {loc.name}
              <span>{loc.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
