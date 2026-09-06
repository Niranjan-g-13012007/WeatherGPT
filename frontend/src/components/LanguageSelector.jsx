import { useState, useRef, useEffect } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext.jsx'
import './LanguageSelector.css'

export default function LanguageSelector() {
  const { language, setLanguage, languages, currentLanguage } = useLanguage()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click or escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleSelect(code) {
    setLanguage(code)
    setOpen(false)
  }

  return (
    <div className="language-selector" ref={dropdownRef}>
      <button
        type="button"
        className={`language-selector-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Select Language"
      >
        <Globe size={15} className="language-globe-icon" />
        <span className="language-current-label">
          {currentLanguage.native}
        </span>
        <ChevronDown size={14} className={`language-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="language-selector-menu" role="listbox">
          <div className="language-menu-header">
            <span>Select Language / மொழி</span>
          </div>
          <div className="language-list">
            {languages.map((lang) => {
              const isSelected = lang.code === language
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`language-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(lang.code)}
                >
                  <div className="language-item-text">
                    <span className="language-native-name">{lang.native}</span>
                    <span className="language-english-name">{lang.name}</span>
                  </div>
                  {isSelected && <Check size={14} className="language-check-icon" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
