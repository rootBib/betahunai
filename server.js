/**
 * Betahun AI Content Studio — Express Backend (Google Gemini)
 * Run: npm install && node server.js
 * 
 * Required: GEMINI_API_KEY in .env or environment variables
 * Get free API key: https://makersuite.google.com/app/apikey
 */

const express = require('express')
const cors = require('cors')
const { GoogleGenerativeAI } = require('@google/generative-ai')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

// API Key ማረጋገጫ
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment variables!')
  console.error('Get your free API key at: https://makersuite.google.com/app/apikey')
  console.error('Then add it to your .env file or Render environment variables.')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

app.use(cors())
app.use(express.json())
app.use(express.static('public')) // serve frontend from /public

// ─── Gemini Configuration ─────────────────────────────────────────
const MODEL_NAME = 'gemini-2.0-flash' // Fast & free tier available

const generationConfig = {
  temperature: 0.8,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 1024,
  responseMimeType: 'application/json', // Direct JSON response
}

// ─── Prompt Engineering ───────────────────────────────────────────
function buildSystemPrompt() {
  return `You are an expert Ethiopian social media content creator and copywriter.
You specialize in creating viral, high-converting scripts for Ethiopian businesses.

You deeply understand:
- Ethiopian consumer psychology: family pride, community trust, social proof, aspiration
- Amharic language nuances, idioms, proverbs, and persuasive speech patterns
- Ethiopian social media behavior on TikTok, Facebook, Instagram, and YouTube
- Local market dynamics across Addis Ababa, Hawassa, Dire Dawa, Mekelle, Bahir Dar
- High-converting sales psychology adapted for Ethiopian audiences
- Cultural context: coffee culture, Iqub (SACCO), market trading traditions, hospitality

Your scripts are authentic, locally resonant, and drive real action.

IMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no backticks, no explanation.

Format:
{
  "hook": "Opening 1-3 lines that grab attention instantly",
  "script": "Full body script text, ready to be read on camera",
  "cta": "Strong closing call-to-action line",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}`
}

function buildUserPrompt(data) {
  const { businessType, platform, goal, tone, language, length, description } = data

  const platformGuide = {
    TikTok:    'Fast-paced, punchy, uses trending formats, hooks in first 2 sec, max 60 words for short',
    Facebook:  'Storytelling-oriented, builds context, community feel, can be longer',
    Instagram: 'Visual-language, aspirational, lifestyle-focused, medium length',
    YouTube:   'Structured like a mini-show: hook, value, CTA. Can be detailed.',
  }[platform] || ''

  const goalGuide = {
    Sales:         'Every line moves toward the purchase. Create urgency and remove objections.',
    'Trust Building': 'Share social proof, origin story, or testimonial-style content.',
    Education:     'Teach one clear insight. Position the brand as the expert.',
    Promotion:     'Lead with the offer. Create FOMO. Make the deal undeniable.',
    Engagement:    'Ask questions, challenge assumptions, or spark debate.',
  }[goal] || ''

  return `Create a ${platform} script for this Ethiopian business:

Business Type: ${businessType}
Business Description: ${description}
Content Goal: ${goal}
Tone: ${tone}
Language: ${language}
Script Length: ${length}

Platform Context: ${platformGuide}
Goal Execution Guide: ${goalGuide}

Script Rules:
- Write in ${language} using natural, spoken language (not formal or stiff)
- Hook must stop the scroll in under 2 seconds
- Body flows naturally — sounds like a real person, not an ad
- CTA is direct and specific (what to do next, not "contact us")
- Hashtags: mix Amharic and English, Ethiopian-market relevant
- For Amharic: use authentic Ge'ez/Ethiopic script
- Length target: ${length}

CRITICAL: Return ONLY the JSON object. No backticks, no markdown, no explanation.`
}

// ─── Routes ───────────────────────────────────────────────────────

app.post('/generate', async (req, res) => {
  const { businessType, platform, goal, tone, language, length, description } = req.body

  // Validate input
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ 
      success: false,
      error: 'Business description is required (min 10 characters).' 
    })
  }

  console.log('📝 Generating:', businessType, '-', platform)
  console.log('🎯 Goal:', goal, '| 🗣️ Language:', language, '| 🎭 Tone:', tone)
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: generationConfig,
    })

    // Chat with context
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: buildSystemPrompt() }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will generate content as specified and return only valid JSON.' }],
        },
      ],
    })

    const result = await chat.sendMessage(buildUserPrompt(req.body))
    const response = result.response
    const raw = response.text()
    
    console.log('✅ AI Response received')
    
    let parsed

    try {
      // Clean the response
      let clean = raw.trim()
      clean = clean.replace(/```json\s*/g, '')
      clean = clean.replace(/```\s*/g, '')
      clean = clean.replace(/^json\s*/i, '')
      clean = clean.trim()
      
      // Extract JSON object
      const startIndex = clean.indexOf('{')
      const endIndex = clean.lastIndexOf('}') + 1
      
      if (startIndex !== -1 && endIndex > startIndex) {
        clean = clean.substring(startIndex, endIndex)
      }
      
      parsed = JSON.parse(clean)
      
      // Validate required fields
      if (!parsed.hook || !parsed.script || !parsed.cta || !parsed.hashtags) {
        throw new Error('Missing required fields in AI response')
      }
      
      // Hashtags array check
      if (!Array.isArray(parsed.hashtags)) {
        parsed.hashtags = [parsed.hashtags]
      }
      
    } catch (parseError) {
      console.error('❌ JSON Parse Error:', parseError)
      console.error('📄 Raw:', raw.substring(0, 200))
      
      // Manual extraction fallback
      try {
        const hookMatch = raw.match(/"hook"\s*:\s*"([^"]+)"/)
        const scriptMatch = raw.match(/"script"\s*:\s*"([^"]+)"/)
        const ctaMatch = raw.match(/"cta"\s*:\s*"([^"]+)"/)
        const tagsMatch = raw.match(/"hashtags"\s*:\s*\[([^\]]+)\]/)
        
        parsed = {
          hook: hookMatch?.[1] || 'እንኳን ደህና መጡ!',
          script: scriptMatch?.[1] || description || 'Sample content',
          cta: ctaMatch?.[1] || 'አሁኑኑ ይደውሉ!',
          hashtags: tagsMatch?.[1]?.split(',').map(t => t.trim().replace(/"/g, '')) || 
                   ['ኢትዮጵያ', 'ንግድ', platform, businessType]
        }
      } catch {
        return res.status(500).json({ 
          success: false,
          error: 'AI returned invalid JSON format.',
          raw: raw.substring(0, 200) 
        })
      }
    }

    console.log('✅ Generation successful!')
    
    return res.json({
      success: true,
      data: parsed,
      meta: { platform, goal, tone, language, length, businessType }
    })

  } catch (err) {
    console.error('❌ Gemini API Error:', err.message)
    
    let errorMessage = 'AI generation failed.'
    
    if (err.message?.includes('API_KEY_INVALID')) {
      errorMessage = 'Invalid API key. Check your GEMINI_API_KEY.'
    } else if (err.message?.includes('RESOURCE_EXHAUSTED')) {
      errorMessage = 'API quota exceeded. Try again later.'
    } else if (err.message?.includes('SAFETY')) {
      errorMessage = 'Content blocked by safety filters.'
    } else if (err.status === 429) {
      errorMessage = 'Too many requests. Please wait a moment.'
    } else if (err.status === 503) {
      errorMessage = 'Gemini service temporarily unavailable.'
    }
    
    return res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: err.message 
    })
  }
})

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Betahun AI Content Studio',
    model: MODEL_NAME,
    provider: 'Google Gemini',
    timestamp: new Date().toISOString()
  })
})

// Test Gemini connection
app.get('/test-gemini', async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME })
    const result = await model.generateContent('Say "Gemini is working!" in English and Amharic.')
    const response = result.response
    res.json({ 
      success: true, 
      message: response.text(),
      model: MODEL_NAME
    })
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message 
    })
  }
})

app.listen(PORT, () => {
  console.log(`\n✦ Betahun AI Content Studio (Google Gemini)`)
  console.log(`   Server: http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
  console.log(`   Test:   http://localhost:${PORT}/test-gemini`)
  console.log(`   Model:  ${MODEL_NAME}\n`)
})
