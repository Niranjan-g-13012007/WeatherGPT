// WeatherGPT End-to-End Chatbot Test Suite
// Runs automated checks against http://localhost:8000/api/chat

const BASE_URL = 'http://localhost:8000/api/chat'

const EXPECTED_IRRELEVANT_RESPONSE =
  'I can answer only on weather-related things. Please ask me something about weather, forecasts, climate, alerts, or related topics.'

async function postChat(message, location = { name: 'Chennai', latitude: 13.0827, longitude: 80.2707 }, history = []) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, location, conversationHistory: history }),
  })
  if (!res.ok) {
    throw new Error(`HTTP error ${res.status}: ${await res.text()}`)
  }
  return await res.json()
}

async function runTests() {
  console.log('=== STARTING WEATHERGPT CHATBOT TESTS ===\n')
  let passed = 0
  let failed = 0

  async function testCase(name, fn) {
    process.stdout.write(`TEST: ${name} ... `)
    try {
      await fn()
      console.log('PASSED')
      passed++
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
      failed++
    }
  }

  // 1. Irrelevant Queries Tests
  const irrelevantQueries = [
    'Write a Java program.',
    'Tell me a joke.',
    'Who is the president?',
    'What is 2+2?',
    'Give me a recipe for biryani.',
    "Tell me today's cricket score.",
  ]

  for (const query of irrelevantQueries) {
    await testCase(`Irrelevant query: "${query}"`, async () => {
      const data = await postChat(query)
      if (data.answer !== EXPECTED_IRRELEVANT_RESPONSE) {
        throw new Error(`Unexpected answer: "${data.answer}"`)
      }
      if (data.enhancedByGemini === true) {
        throw new Error('Gemini was called for an irrelevant query!')
      }
    })
  }

  // 2. Conceptual Weather Queries
  const conceptualQueries = [
    'What is humidity?',
    'What does humidity mean?',
    'What is an NWP model?',
    'How is weather forecast generated?',
  ]

  for (const query of conceptualQueries) {
    await testCase(`Conceptual query: "${query}"`, async () => {
      const data = await postChat(query)
      if (!data.answer || data.answer.length < 20) {
        throw new Error('Answer was empty or too short')
      }
      if (data.answer === EXPECTED_IRRELEVANT_RESPONSE) {
        throw new Error('Conceptual weather query was rejected as irrelevant!')
      }
    })
  }

  // 3. Real Weather / Forecast Queries
  const weatherQueries = [
    'What is the weather in Chennai?',
    'Will it rain tomorrow in Chennai?',
    "What's the temperature in Ooty?",
    'Should I travel to Coimbatore tomorrow?',
    'Do I need an umbrella?',
    'Which weather model are you using?',
    'Are there any weather alerts?',
    'Will it rain tomorrow in Ooty and should I travel?',
    'Will it rain tomorrow in Chennai, should I travel, and which NWP model is being used?',
  ]

  for (const query of weatherQueries) {
    await testCase(`Live weather query: "${query}"`, async () => {
      const data = await postChat(query)
      if (!data.answer || data.answer.length < 20) {
        throw new Error('Answer was empty or too short')
      }
      if (data.answer === EXPECTED_IRRELEVANT_RESPONSE) {
        throw new Error('Weather query was erroneously rejected!')
      }
      if (!data.source) {
        throw new Error('Missing data source attribute')
      }
    })
  }

  // 4. No Hallucination Tests
  await testCase('No Hallucination: 20 days forecast refusal', async () => {
    const data = await postChat('Will it rain 20 days from now?')
    if (!data.answer.toLowerCase().includes('not extend') && !data.answer.toLowerCase().includes('beyond') && !data.answer.toLowerCase().includes('7 days')) {
      throw new Error(`Expected forecast limit explanation, got: "${data.answer}"`)
    }
  })

  await testCase('No Hallucination: Unresolvable city error', async () => {
    const data = await postChat('What is the temperature in AtlantisCityXYZ12345?', { name: 'AtlantisCityXYZ12345' })
    if (!data.answer.toLowerCase().includes('unavailable') && !data.answer.toLowerCase().includes('could not')) {
      throw new Error(`Expected unavailable city notice, got: "${data.answer}"`)
    }
  })

  // 5. Conversational follow-up
  await testCase('Conversational follow-up: umbrella query in context', async () => {
    const history = [
      { role: 'user', content: 'Will it rain tomorrow in Chennai?' },
      { role: 'bot', content: 'Tomorrow in Chennai, rain probability is 70% with expected rainfall of 8.4 mm.' },
    ]
    const data = await postChat('Then should I carry an umbrella?', { name: 'Chennai' }, history)
    if (data.answer === EXPECTED_IRRELEVANT_RESPONSE) {
      throw new Error('Follow-up was erroneously rejected as irrelevant')
    }
    if (!data.answer || data.answer.length < 15) {
      throw new Error('Follow-up answer was empty')
    }
  })

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`)
  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
