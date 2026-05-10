/**
 * Betahun AI - Simple Gemini Backend
 */
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// API Key check
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('❌❌❌ GEMINI_API_KEY IS MISSING! ❌❌❌');
  console.error('Add it in Render Dashboard > Environment Variables');
} else {
  console.log('✅ GEMINI_API_KEY found (starts with):', GEMINI_KEY.substring(0, 8) + '...');
}

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple test route
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    gemini_key_exists: !!GEMINI_KEY,
    time: new Date().toISOString()
  });
});

// Generate route
app.post('/generate', async (req, res) => {
  console.log('📥 Received request');
  
  const { description, businessType, platform, goal, tone, language, length } = req.body;
  
  if (!description || description.length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Description too short' 
    });
  }

  try {
    console.log('🤖 Calling Gemini...');
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1000,
      }
    });

    const prompt = `Create a ${platform} social media script for an Ethiopian business.

Business: ${businessType}
Description: ${description}
Goal: ${goal}
Tone: ${tone}
Language: ${language}
Length: ${length}

You MUST respond with ONLY valid JSON (no markdown, no backticks):
{
  "hook": "attention-grabbing opening in ${language}",
  "script": "full script in ${language}",
  "cta": "call to action in ${language}",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    console.log('✅ Gemini response received');
    
    // Clean JSON
    let jsonStr = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    
    // Extract JSON
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}') + 1;
    if (start >= 0 && end > start) {
      jsonStr = jsonStr.substring(start, end);
    }
    
    const data = JSON.parse(jsonStr);
    
    // Validate
    if (!data.hook || !data.script || !data.cta) {
      throw new Error('Missing fields');
    }
    
    if (!Array.isArray(data.hashtags)) {
      data.hashtags = data.hashtags ? [data.hashtags] : [];
    }
    
    res.json({
      success: true,
      data: data,
      meta: { platform, goal, tone, language, length, businessType }
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Generation failed: ' + err.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Betahun AI Server running on port ${PORT}`);
  console.log(`📍 Test: http://localhost:${PORT}/test`);
  console.log(`📍 Generate: http://localhost:${PORT}/generate\n`);
});
