/**
 * Betahun AI Content Studio — Express Backend
 * Run: npm install && node server.js
 */

const express = require('express')
const cors = require('cors')
const Anthropic = require('@anthropic-ai/sdk')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 1000
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.use(cors())
app.use(express.json())
app.use(express.static('public')) // serve frontend from /public

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

ALWAYS respond with valid JSON only. No markdown, no preamble, no explanation.
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

Return only the JSON object.`
}

// ─── Routes ───────────────────────────────────────────────────────

app.post('/generate', async (req, res) => {
  const { businessType, platform, goal, tone, language, length, description } = req.body

  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: 'Business description is required (min 10 characters).' })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(req.body) }]
    })

    const raw = message.content[0].text
    let parsed

    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return res.status(500).json({ error: 'AI returned malformed JSON.', raw })
    }

    return res.json({
      success: true,
      data: parsed,
      meta: { platform, goal, tone, language, length, businessType }
    })

  } catch (err) {
    console.error('Anthropic API error:', err)
    return res.status(500).json({ error: 'AI generation failed.', details: err.message })
  }
})

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Betahun AI Content Studio' }))

app.listen(PORT, () => console.log(`\n✦ Betahun AI Content Studio\n   http://localhost:${PORT}\n`))
