import { useState, useRef, useEffect } from 'react'
import { MapPin, ChevronDown, Navigation, Search, Loader2, Globe } from 'lucide-react'
import { LOCATIONS } from '../data/locations.js'
import { searchLocations } from '../services/locationService.js'
import { useLocationWeather } from '../context/LocationContext.jsx'
import './LocationPicker.css'

export default function LocationPicker({ location: propLocation, onChange: propOnChange }) {
  const context = useLocationWeather()
  const location = propLocation || context.location
  const onChange = propOnChange || context.setLocation
  const { useMyLocation, isDetectingLocation } = context

  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const ref = useRef(null)
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Live worldwide location search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(searchQuery.trim(), 5)
        setSearchResults(results)
      } catch (err) {
        console.error('Search error:', err)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [searchQuery])

  async function handleUseMyLocation() {
    if (useMyLocation) {
      await useMyLocation()
      setOpen(false)
    }
  }

  const isGeo = location.source === 'geolocation'
  const coordText =
    location.latitude != null && location.longitude != null
      ? `${Math.abs(location.latitude).toFixed(2)}° ${location.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(
          location.longitude
        ).toFixed(2)}° ${location.longitude >= 0 ? 'E' : 'W'}`
      : null

  return (
    <div className="location-picker" ref={ref}>
      <button
        className={`location-picker-trigger ${isGeo ? 'is-geolocation' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={coordText ? `${location.name} (${coordText})` : location.name}
      >
        {isGeo ? (
          <Navigation size={13} strokeWidth={2.4} className="location-geo-icon" />
        ) : (
          <MapPin size={14} strokeWidth={2.2} />
        )}
        <span className="location-trigger-label">
          {location.name}
          {isGeo && <span className="location-trigger-badge">GPS</span>}
        </span>
        <ChevronDown size={14} strokeWidth={2.2} className={open ? 'rotated' : ''} />
      </button>

      {open && (
        <div className="location-picker-menu">
          {/* Use My Location action button */}
          <div className="location-picker-top-action">
            <button
              className="location-use-my-btn"
              onClick={handleUseMyLocation}
              disabled={isDetectingLocation}
            >
              {isDetectingLocation ? (
                <Loader2 size={14} className="location-spinner" />
              ) : (
                <Navigation size={14} strokeWidth={2.2} />
              )}
              <span>{isDetectingLocation ? 'Detecting your location...' : 'Use My Location'}</span>
            </button>
          </div>

          {/* Search bar for searching ANY city worldwide */}
          <div className="location-picker-search-bar">
            <Search size={14} strokeWidth={2.2} className="location-search-icon" />
            <input
              type="text"
              placeholder="Search any city or town..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {isSearching && <Loader2 size={13} className="location-spinner-subtle" />}
          </div>

          {/* Current Active Location Coordinates */}
          {coordText && (
            <div className="location-picker-coords">
              <span className="location-coords-text">
                📍 {isGeo ? 'Current Location' : 'Selected Location'}: {coordText}
              </span>
            </div>
          )}

          <div className="location-picker-list-container">
            {/* Search Results */}
            {searchQuery.trim().length >= 2 ? (
              <div className="location-picker-section">
                <div className="location-section-title">
                  <Globe size={12} /> Search Results
                </div>
                {searchResults.length === 0 && !isSearching ? (
                  <p className="location-empty-msg">No matching locations found.</p>
                ) : (
                  searchResults.map((loc, idx) => (
                    <button
                      key={`${loc.name}-${loc.latitude}-${idx}`}
                      className="location-picker-item"
                      onClick={() => {
                        onChange(loc)
                        setOpen(false)
                        setSearchQuery('')
                      }}
                    >
                      <div className="location-item-primary">
                        <strong>{loc.name}</strong>
                        <span>
                          {[loc.state, loc.country].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* Predefined / Popular Cities */
              <div className="location-picker-section">
                <div className="location-section-title">Popular Cities</div>
                {LOCATIONS.map((loc) => {
                  const isActive = loc.name.toLowerCase() === location.name.toLowerCase()
                  return (
                    <button
                      key={loc.name}
                      className={'location-picker-item' + (isActive ? ' active' : '')}
                      onClick={() => {
                        onChange({ ...loc, source: 'manual' })
                        setOpen(false)
                      }}
                    >
                      <div className="location-item-primary">
                        <strong>{loc.name}</strong>
                        <span>{loc.state}</span>
                      </div>
                      {isActive && <span className="location-active-check">Active</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

