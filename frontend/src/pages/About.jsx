import { motion } from 'framer-motion'
import { MessageCircle, Brain, LineChart as LineChartIcon, CheckCircle2 } from 'lucide-react'
import './About.css'

const STEPS = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Ask',
    description: 'You ask a weather question in plain language — about rain, travel, temperature, or risk.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'Understand',
    description: 'WeatherGPT parses the intent behind your question — what timeframe, what condition, what decision it supports.',
  },
  {
    number: '03',
    icon: LineChartIcon,
    title: 'Analyze',
    description: 'Live data from Open-Meteo is read for your location and matched against the relevant hours or days.',
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Act',
    description: 'You get a clear, specific recommendation — not just raw numbers you have to interpret yourself.',
  },
]

export default function About() {
  return (
    <main className="about-page">
      <div className="wg-container">
        <motion.div
          className="about-intro"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1>How WeatherGPT works</h1>
          <p>
            This prototype turns a weather API into a conversation. Today, the response engine runs
            entirely in the browser — no backend, no LLM. It's built so the same interface can plug into
            a real model later without changing how it looks or feels.
          </p>
        </motion.div>

        <div className="about-steps">
          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                className="about-step"
                key={step.number}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <span className="about-step-number">{step.number}</span>
                <div className="about-step-icon">
                  <Icon size={18} strokeWidth={2} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </motion.div>
            )
          })}
        </div>

        <div className="about-roadmap">
          <h2>What's next</h2>
          <p>
            Future versions will route each question through a FastAPI backend that combines a
            trained ML weather model, an LLM for language understanding, and historical climate
            data — replacing today's frontend-only rule engine with genuine model-driven reasoning,
            while keeping this same chat experience.
          </p>
          <div className="about-roadmap-flow">
            <span>React UI</span>
            <span className="arrow">→</span>
            <span>FastAPI backend</span>
            <span className="arrow">→</span>
            <span>ML model + LLM</span>
            <span className="arrow">→</span>
            <span>WeatherGPT response</span>
          </div>
        </div>
      </div>
    </main>
  )
}
