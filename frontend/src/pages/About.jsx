import { motion } from 'framer-motion'
import {
  MessageCircle,
  Brain,
  LineChart as LineChartIcon,
  CheckCircle2,
  CloudSun,
  Zap,
  Globe,
  ShieldCheck,
  BarChart3,
  MessageSquare,
  BellRing,
  Languages,
  Database,
  Server,
  Cpu,
} from 'lucide-react'
import './About.css'

const STEPS = [
  {
    number: '01',
    icon: MessageCircle,
    title: 'Ask',
    description:
      'Type any weather question in plain language — about rain, travel safety, crop irrigation, or storm risk for any location.',
  },
  {
    number: '02',
    icon: Brain,
    title: 'Understand',
    description:
      'AI parses your intent — extracting location, timeframe, and the decision context behind your question.',
  },
  {
    number: '03',
    icon: LineChartIcon,
    title: 'Analyze',
    description:
      'Live forecast data from Open-Meteo is fetched and processed through our risk engine, advisory algorithms, and climate analysis.',
  },
  {
    number: '04',
    icon: CheckCircle2,
    title: 'Respond',
    description:
      'You receive a clear, actionable answer — not raw data, but a recommendation you can act on immediately.',
  },
]

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Conversational AI',
    description: 'Ask weather questions in natural language and get human-like, context-aware responses.',
  },
  {
    icon: Globe,
    title: 'Any Location',
    description: 'Get forecasts for any city or coordinate — auto-detect your location or search globally.',
  },
  {
    icon: ShieldCheck,
    title: 'Risk Assessment',
    description: 'Built-in risk engine flags dangerous weather and provides severity-rated alerts.',
  },
  {
    icon: BarChart3,
    title: 'Climate Trends',
    description: 'Explore historical weather patterns and long-term climate trend analysis.',
  },
  {
    icon: BellRing,
    title: 'Smart Alerts',
    description: 'Real-time weather alerts for storms, extreme heat, heavy rain, and high winds.',
  },
  {
    icon: Languages,
    title: 'Multilingual',
    description: 'Supports Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, and more Indian languages.',
  },
]

const TECH_STACK = [
  { icon: CloudSun, label: 'React Frontend', sub: 'Modern chat UI' },
  { icon: Server, label: 'Node.js Backend', sub: 'Express API server' },
  { icon: Database, label: 'Open-Meteo', sub: 'Live weather data' },
  { icon: Cpu, label: 'AI Engine', sub: 'Intelligent responses' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: 'easeOut' },
  }),
}

export default function About() {
  return (
    <main className="about-page">
      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero-glow" />
        <div className="wg-container">
          <motion.div
            className="about-hero-content"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <span className="about-badge">
              <Zap size={13} /> About the Project
            </span>
            <h1>WeatherGPT</h1>
            <p className="about-hero-subtitle">
              An AI-powered weather intelligence platform that transforms complex meteorological data
              into clear, conversational answers. Built for real people making real decisions — from
              daily commutes to agricultural planning.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────── */}
      <section className="about-section">
        <div className="wg-container">
          <motion.div
            className="about-section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
          >
            <h2>How It Works</h2>
            <p>From question to actionable insight in seconds.</p>
          </motion.div>

          <div className="about-steps">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  className="about-step"
                  key={step.number}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-20px' }}
                  custom={i}
                  variants={fadeUp}
                >
                  <span className="about-step-number">{step.number}</span>
                  <div className="about-step-icon">
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  {i < STEPS.length - 1 && (
                    <div className="about-step-connector" />
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Key Features ─────────────────────────────────────── */}
      <section className="about-section about-features-section">
        <div className="wg-container">
          <motion.div
            className="about-section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
          >
            <h2>Key Features</h2>
            <p>Everything you need for weather intelligence.</p>
          </motion.div>

          <div className="about-features-grid">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  className="about-feature-card"
                  key={feature.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-20px' }}
                  custom={i}
                  variants={fadeUp}
                >
                  <div className="about-feature-icon">
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Tech Stack / Architecture ────────────────────────── */}
      <section className="about-section">
        <div className="wg-container">
          <motion.div
            className="about-section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
          >
            <h2>Architecture</h2>
            <p>Built with modern technologies for reliability and speed.</p>
          </motion.div>

          <motion.div
            className="about-arch"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-20px' }}
            variants={fadeUp}
          >
            <div className="about-arch-flow">
              {TECH_STACK.map((tech, i) => {
                const Icon = tech.icon
                return (
                  <div className="about-arch-item" key={tech.label}>
                    <div className="about-arch-icon">
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <span className="about-arch-label">{tech.label}</span>
                    <span className="about-arch-sub">{tech.sub}</span>
                    {i < TECH_STACK.length - 1 && (
                      <span className="about-arch-arrow">→</span>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  )
}
