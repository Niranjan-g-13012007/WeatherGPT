// Test script to verify WeatherGPT chatbot fixes
const assert = require('assert')
const {
  cleanLocationToken,
  detectAllLocations,
  detectComparisonQuery,
  extractLocationFromQuery,
} = require('../utils/locationResolver')
const { isWeatherRelated } = require('../utils/domainGuard')
const {
  extractPeriodMetrics,
  analyzeHistoricalTrends,
  buildStructuredWeatherContext,
  buildComparativeWeatherContext,
  generateDeterministicComparisonFallback,
} = require('../services/weatherAnalysisService')
const { detectLanguage } = require('../utils/languageDetector')

async function runTests() {
  console.log('--- Running WeatherGPT Chat Fixes Verification ---\n')

  // 1. Multilingual location detection & suffix stripping
  console.log('[Test 1] Testing Multilingual Location Extraction...')
  const locChennaiTamil = extractLocationFromQuery('நாளைக்கு சென்னையில் மழை பெய்யுமா?')
  console.log(`  Query: "நாளைக்கு சென்னையில் மழை பெய்யுமா?" => Resolved Location: ${locChennaiTamil?.name}`)
  assert.strictEqual(locChennaiTamil?.name, 'Chennai', 'Should extract Chennai from சென்னையில்')

  const locPerunduraiTamil = extractLocationFromQuery('பெருந்துறையில் தற்போதைய வானிலை என்ன?')
  console.log(`  Query: "பெருந்துறையில் தற்போதைய வானிலை என்ன?" => Resolved Location: ${locPerunduraiTamil?.name}`)
  assert.strictEqual(locPerunduraiTamil?.name, 'Perundurai', 'Should extract Perundurai from பெருந்துறையில்')

  const locOotyTamil = extractLocationFromQuery('ஊட்டிக்கு செல்லலாமா?')
  console.log(`  Query: "ஊட்டிக்கு செல்லலாமா?" => Resolved Location: ${locOotyTamil?.name}`)
  assert.strictEqual(locOotyTamil?.name, 'Ooty', 'Should extract Ooty from ஊட்டிக்கு')

  const locHindiChennai = extractLocationFromQuery('चेन्नई में मौसम कैसा है?')
  console.log(`  Query: "चेन्नई में मौसम कैसा है?" => Resolved Location: ${locHindiChennai?.name}`)
  assert.strictEqual(locHindiChennai?.name, 'Chennai', 'Should extract Chennai from चेन्नई में')

  // History override test: even if history has Ooty, current message with Chennai should pick Chennai
  const historyWithOoty = [{ role: 'user', content: 'Is it safe to travel to Ooty tomorrow?' }]
  const locOverride = extractLocationFromQuery('நாளைக்கு சென்னையில் மழை பெய்யுமா?', { name: 'Ooty' }, historyWithOoty)
  console.log(`  Query with Ooty in history: "நாளைக்கு சென்னையில் மழை பெய்யுமா?" => Resolved: ${locOverride?.name}`)
  assert.strictEqual(locOverride?.name, 'Chennai', 'New query location MUST override past history location')
  console.log('✓ Test 1 Passed!\n')

  // 2. Place Comparison Detection
  console.log('[Test 2] Testing Two-Place Comparison Detection...')
  const comp1 = detectComparisonQuery('Compare Chennai and Ooty')
  console.log(`  "Compare Chennai and Ooty" => isComparison: ${comp1.isComparison}, loc1: ${comp1.loc1?.name}, loc2: ${comp1.loc2?.name}`)
  assert.strictEqual(comp1.isComparison, true)
  assert.strictEqual(comp1.loc1?.name, 'Chennai')
  assert.strictEqual(comp1.loc2?.name, 'Ooty')

  const compTamil = detectComparisonQuery('சென்னை மற்றும் ஊட்டி வானிலையை ஒப்பிடுக')
  console.log(`  "சென்னை மற்றும் ஊட்டி வானிலையை ஒப்பிடுக" => isComparison: ${compTamil.isComparison}, loc1: ${compTamil.loc1?.name}, loc2: ${compTamil.loc2?.name}`)
  assert.strictEqual(compTamil.isComparison, true)
  assert.strictEqual(compTamil.loc1?.name, 'Chennai')
  assert.strictEqual(compTamil.loc2?.name, 'Ooty')

  const compVs = detectComparisonQuery('Perundurai vs Coimbatore weather')
  console.log(`  "Perundurai vs Coimbatore weather" => isComparison: ${compVs.isComparison}, loc1: ${compVs.loc1?.name}, loc2: ${compVs.loc2?.name}`)
  assert.strictEqual(compVs.isComparison, true)
  assert.strictEqual(compVs.loc1?.name, 'Perundurai')
  assert.strictEqual(compVs.loc2?.name, 'Coimbatore')

  const compWhichBetter = detectComparisonQuery('Which is better tomorrow, Chennai or Ooty?')
  console.log(`  "Which is better tomorrow, Chennai or Ooty?" => isComparison: ${compWhichBetter.isComparison}, loc1: ${compWhichBetter.loc1?.name}, loc2: ${compWhichBetter.loc2?.name}`)
  assert.strictEqual(compWhichBetter.isComparison, true)
  console.log('✓ Test 2 Passed!\n')

  // 3. Domain Guard Check for Follow-up questions
  console.log('[Test 3] Testing Domain Guard for Follow-ups...')
  const isDayAfterRel = isWeatherRelated('What about the day after tomorrow?')
  console.log(`  "What about the day after tomorrow?" isWeatherRelated: ${isDayAfterRel}`)
  assert.strictEqual(isDayAfterRel, true, 'Should accept "What about the day after tomorrow?"')

  const isRainfallTrendRel = isWeatherRelated('How has rainfall changed in this location over the years?')
  console.log(`  "How has rainfall changed in this location over the years?" isWeatherRelated: ${isRainfallTrendRel}`)
  assert.strictEqual(isRainfallTrendRel, true, 'Should accept historical rainfall question')

  const isCompRel = isWeatherRelated('Compare Chennai and Ooty')
  console.log(`  "Compare Chennai and Ooty" isWeatherRelated: ${isCompRel}`)
  assert.strictEqual(isCompRel, true, 'Should accept comparison query')

  const isTamilRainRel = isWeatherRelated('நாளைக்கு சென்னையில் மழை பெய்யுமா?')
  console.log(`  "நாளைக்கு சென்னையில் மழை பெய்யுமா?" isWeatherRelated: ${isTamilRainRel}`)
  assert.strictEqual(isTamilRainRel, true, 'Should accept Tamil rainfall query')

  const isFollowupInContext = isWeatherRelated('What about Friday?', [
    { role: 'user', content: 'What is the temperature in Chennai?' },
    { role: 'assistant', content: 'Chennai is currently 32°C.' },
  ])
  console.log(`  "What about Friday?" in weather context isWeatherRelated: ${isFollowupInContext}`)
  assert.strictEqual(isFollowupInContext, true, 'Should accept conversational temporal follow-up')
  console.log('✓ Test 3 Passed!\n')

  // 4. Language Detection
  console.log('[Test 4] Testing Language Detection for Indian Scripts...')
  const langTa = await detectLanguage('நாளைக்கு சென்னையில் மழை பெய்யுமா?')
  console.log(`  Tamil detection: ${langTa}`)
  assert.strictEqual(langTa, 'ta')

  const langHi = await detectLanguage('चेन्नई में मौसम कैसा है?')
  console.log(`  Hindi detection: ${langHi}`)
  assert.strictEqual(langHi, 'hi')
  console.log('✓ Test 4 Passed!\n')

  // 5. Climate Analysis (Temperature + Precipitation Trends)
  console.log('[Test 5] Testing Historical Climate & Rainfall Trends...')
  // Mock 3 years of daily historical data
  const mockTimes = []
  const mockTempMeans = []
  const mockPrecipSums = []
  for (let year = 2021; year <= 2024; year++) {
    for (let day = 1; day <= 60; day++) {
      const dStr = day < 10 ? `0${day}` : `${day}`
      mockTimes.push(`${year}-01-${dStr}`)
      mockTempMeans.push(28 + (year - 2021) * 0.1) // warming trend
      mockPrecipSums.push(5 + (year - 2021) * 2) // increasing rainfall
    }
  }

  const histResult = analyzeHistoricalTrends({
    dataset: 'ECMWF ERA5 Reanalysis',
    daily: {
      time: mockTimes,
      temperature_2m_mean: mockTempMeans,
      precipitation_sum: mockPrecipSums,
    },
  })

  console.log('  Historical Analysis Output:', {
    period: histResult?.period,
    tempTrend: histResult?.trend,
    tempSlope: histResult?.slope,
    precipTrend: histResult?.precipTrend,
    precipSlope: histResult?.precipSlope,
    avgAnnualPrecip: histResult?.averageAnnualPrecipitation,
    wettestYear: histResult?.wettestYear,
    driestYear: histResult?.driestYear,
  })
  assert(histResult != null, 'Historical analysis should not be null')
  assert(histResult.precipTrend != null, 'Precipitation trend must be computed')
  assert(histResult.averageAnnualPrecipitation != null, 'Average annual precipitation must be computed')
  assert(histResult.wettestYear != null, 'Wettest year must be computed')
  console.log('✓ Test 5 Passed!\n')

  // 6. Comparative Context & Deterministic Fallback
  console.log('[Test 6] Testing Comparative Fallback Response...')
  const mockCompText = generateDeterministicComparisonFallback({
    loc1: { name: 'Chennai' },
    loc2: { name: 'Ooty' },
    snapshot1: { temperature: 32, weatherCode: 3, humidity: 65, windSpeed: 14 },
    snapshot2: { temperature: 18, weatherCode: 1, humidity: 70, windSpeed: 8 },
    metricsTomorrow1: { tempMax: 35, tempMin: 26, precipProb: 20, precipSum: 0.2, conditionLabel: 'Partly Cloudy' },
    metricsTomorrow2: { tempMax: 20, tempMin: 11, precipProb: 0, precipSum: 0, conditionLabel: 'Clear Sky' },
    risk1: { level: 'LOW' },
    risk2: { level: 'LOW' },
    advisories1: { travel: 'Favorable travel conditions.' },
    advisories2: { travel: 'Pleasant mountain driving conditions.' },
  })
  console.log('  Comparison Fallback Preview:\n' + mockCompText.split('\n').slice(0, 8).join('\n'))
  assert(mockCompText.includes('Chennai vs Ooty'), 'Comparison text must compare Chennai vs Ooty')
  assert(mockCompText.includes('32°C') && mockCompText.includes('18°C'), 'Comparison text must include temperatures')
  console.log('✓ Test 6 Passed!\n')

  // 7. End-to-End Chat Controller Test (Comparison & Tamil queries)
  console.log('[Test 7] Testing End-to-End Chat Controller Handler...')
  const { handleChat } = require('../controllers/chatController')

  function mockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code
        return this
      },
      json(data) {
        this.jsonData = data
        return this
      },
    }
  }

  // E2E Test A: Tamil query "நாளைக்கு சென்னையில் மழை பெய்யுமா?"
  const resTamil = mockRes()
  await handleChat(
    {
      body: {
        message: 'நாளைக்கு சென்னையில் மழை பெய்யுமா?',
        location: { name: 'Perundurai', latitude: 11.2764, longitude: 77.5838 },
        conversationHistory: [
          { role: 'user', content: 'Is it safe to travel to Ooty tomorrow?' },
          { role: 'assistant', content: 'Yes, conditions in Ooty are clear.' },
        ],
      },
    },
    resTamil
  )
  console.log('  Tamil query controller result:', {
    status: resTamil.statusCode,
    location: resTamil.jsonData?.location,
    language: resTamil.jsonData?.language,
    answerPreview: resTamil.jsonData?.answer?.slice(0, 100) + '...',
  })
  assert.strictEqual(resTamil.statusCode, 200)
  assert.strictEqual(resTamil.jsonData?.location, 'Chennai', 'Target location must be resolved to Chennai, not Ooty or Perundurai')
  assert.strictEqual(resTamil.jsonData?.language, 'ta', 'Language must be Tamil')

  // E2E Test B: Comparison query "Compare Chennai and Ooty"
  const resComp = mockRes()
  await handleChat(
    {
      body: {
        message: 'Compare Chennai and Ooty',
        location: { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 },
      },
    },
    resComp
  )
  console.log('  Comparison controller result:', {
    status: resComp.statusCode,
    location: resComp.jsonData?.location,
    isComparison: resComp.jsonData?.isComparison,
    answerPreview: resComp.jsonData?.answer?.slice(0, 100) + '...',
  })
  assert.strictEqual(resComp.statusCode, 200)
  assert.strictEqual(resComp.jsonData?.isComparison, true)
  assert(resComp.jsonData?.location?.includes('Chennai') && resComp.jsonData?.location?.includes('Ooty'))

  // E2E Test C: "What about the day after tomorrow?"
  const resDayAfter = mockRes()
  await handleChat(
    {
      body: {
        message: 'What about the day after tomorrow?',
        location: { name: 'Perundurai', latitude: 11.2764, longitude: 77.5838 },
        conversationHistory: [
          { role: 'user', content: 'What is the weather in Perundurai tomorrow?' },
          { role: 'assistant', content: 'Tomorrow in Perundurai will be warm.' },
        ],
      },
    },
    resDayAfter
  )
  console.log('  Day after tomorrow controller result:', {
    status: resDayAfter.statusCode,
    isIrrelevant: resDayAfter.jsonData?.isIrrelevant,
    location: resDayAfter.jsonData?.location,
    answerPreview: resDayAfter.jsonData?.answer?.slice(0, 100) + '...',
  })
  assert.strictEqual(resDayAfter.statusCode, 200)
  assert.notStrictEqual(resDayAfter.jsonData?.isIrrelevant, true, 'Should NOT be classified as irrelevant')
  console.log('✓ Test 7 Passed!\n')

  console.log('All 7 WeatherGPT Chat Verification Tests Passed Successfully!')
}

runTests().catch((err) => {
  console.error('Test Failed:', err)
  process.exit(1)
})
