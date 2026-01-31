import { Router } from 'express'
import { VertexAI } from '@google-cloud/vertexai'
import { calculateCredits, checkCredits, deductCredits, getUserCredits, CREDIT_PACKAGES } from '../services/credits.js'
import PromptBuilder from '../services/aiPrompts.js'

const router = Router()

// Initialize Vertex AI
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
const location = 'us-central1'

let jsonModel = null

function getJsonModel(config = {}) {
  // Config defaults
  const generationConfig = {
    maxOutputTokens: 8192,
    temperature: 0.5,
    ...config
  }

  if (projectId) {
    const vertexAI = new VertexAI({ project: projectId, location })
    return vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash', // Use standard flash model
      generationConfig
    })
  }
  return null
}

// Middleware to check credits before AI request
async function requireCredits(req, res, next) {
  const userId = req.headers['x-user-id']

  if (!userId) {
    return res.status(401).json({ error: 'User ID required', code: 'AUTH_REQUIRED' })
  }

  const { hasCredits, currentBalance } = await checkCredits(userId)

  if (!hasCredits) {
    return res.status(402).json({
      error: 'Insufficient AI credits',
      code: 'INSUFFICIENT_CREDITS',
      currentBalance,
      packages: CREDIT_PACKAGES
    })
  }

  req.userId = userId
  req.currentBalance = currentBalance
  next()
}

// GET /ai/credits - Get user's credit balance
router.get('/credits', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' })
    }

    const credits = await getUserCredits(userId)
    res.json({ credits, packages: CREDIT_PACKAGES })
  } catch (error) {
    console.error('Get credits error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /ai/checkout-url - Get checkout URL for specific package (on-demand)
router.get('/checkout-url', (req, res) => {
  try {
    const { packageId, userId } = req.query
    const storeId = process.env.LEMONSQUEEZY_STORE || ''

    if (!userId || !packageId) {
      return res.status(400).json({ error: 'userId and packageId required' })
    }

    if (!storeId) {
      console.error('LEMONSQUEEZY_STORE not configured')
      return res.status(500).json({ error: 'Lemon Squeezy not configured' })
    }

    const variantId = process.env[`LEMONSQUEEZY_VARIANT_${String(packageId).toUpperCase()}`] || ''

    if (!variantId) {
      console.error('Variant not found for package:', packageId)
      return res.status(400).json({ error: 'Invalid package' })
    }

    const checkoutUrl = `https://${storeId}.lemonsqueezy.com/checkout/buy/${variantId}?checkout[custom][user_id]=${encodeURIComponent(String(userId))}`

    res.json({ url: checkoutUrl })
  } catch (error) {
    console.error('Checkout URL error:', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /ai/packages - Get available credit packages info
router.get('/packages', (req, res) => {
  res.json({
    packages: CREDIT_PACKAGES.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      price: pkg.price,
      priceDisplay: pkg.priceDisplay,
      badge: pkg.badge
    }))
  })
})

import multer from 'multer'

// Configure multer for memory storage (files handled in memory before sending to Gemini)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
})

// ... (existing imports and setup)

/**
 * Helper to call Gemini with streaming response and handle credits
 */
async function streamGemini(req, res, promptOrParts, action) {
  // Get dynamic config based on the action (temperature, tokens)
  const config = PromptBuilder.getConfig(action)
  const model = getJsonModel(config)

  if (!model) {
    throw new Error('Vertex AI not configured. Set GOOGLE_CLOUD_PROJECT.')
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const result = await model.generateContentStream(promptOrParts)
    let fullText = ''

    for await (const item of result.stream) {
      if (item.candidates && item.candidates[0].content && item.candidates[0].content.parts) {
        const text = item.candidates[0].content.parts[0].text
        if (text) {
          fullText += text
          // Send chunk to client
          res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      }
    }

    // Calculate and deduct credits based on output
    const creditsToDeduct = calculateCredits(fullText)
    const deductResult = await deductCredits(req.userId, creditsToDeduct, action, fullText)

    if (!deductResult.success) {
      console.error('Credit deduction failed:', deductResult.error)
    }

    // Send final message with credit info
    res.write(`data: ${JSON.stringify({
      done: true,
      _credits: {
        used: deductResult.creditsUsed || creditsToDeduct,
        remaining: deductResult.newBalance
      }
    })}\n\n`)

    res.end()

  } catch (error) {
    console.error('Streaming error:', error)
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
    res.end()
  }
}

// ... (existing endpoints)

// POST /ai/tone
router.post('/tone', requireCredits, async (req, res) => {
  try {
    const { content, tone } = req.body
    if (!content || !tone) return res.status(400).json({ error: 'Missing content or tone' })
    const prompt = PromptBuilder.changeTone(content, tone)
    await streamGemini(req, res, prompt, 'tone')
  } catch (error) {
    console.error('Tone error:', error)
    if (!res.headersSent) res.status(500).json({ error: error.message })
  }
})

// POST /ai/analyze-image
router.post('/analyze-image', upload.single('image'), requireCredits, async (req, res) => {
  try {
    const { type } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({ error: 'Missing image file' })
    }

    // Convert buffer to base64
    const base64Image = file.buffer.toString('base64')
    const mimeType = file.mimetype

    // Construct prompt parts for Gemini (multimodal)
    const textPrompt = PromptBuilder.imageAnalysis(type || 'general')

    const parts = [
      { text: textPrompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Image
        }
      }
    ]

    await streamGemini(req, res, parts, 'ocr')

  } catch (error) {
    console.error('Analyze image error:', error)
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      if (!res.headersSent) return res.status(400).json({ error: `Upload error: ${error.message}` })
    }
    if (!res.headersSent) res.status(500).json({ error: error.message })
  }
})

export default router
