import { Router } from 'express'
import { VertexAI } from '@google-cloud/vertexai'
import { calculateCredits, checkCredits, deductCredits, getUserCredits, CREDIT_PACKAGES } from '../services/credits.js'

const router = Router()

// Initialize Vertex AI
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
const location = 'us-central1'

let jsonModel = null

function getJsonModel() {
  if (!jsonModel && projectId) {
    const vertexAI = new VertexAI({ project: projectId, location })
    jsonModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
        responseMimeType: 'application/json'
      }
    })
  }
  return jsonModel
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

// Helper to call Gemini with JSON response and handle credits
async function callGeminiWithCredits(req, _res, prompt, schema, action) {
  const model = getJsonModel()
  if (!model) {
    throw new Error('Vertex AI not configured. Set GOOGLE_CLOUD_PROJECT.')
  }
  
  const fullPrompt = `${prompt}

Return JSON in this format:
${JSON.stringify(schema, null, 2)}`
  
  const result = await model.generateContent(fullPrompt)
  const response = result.response
  const text = response.candidates[0].content.parts[0].text
  
  let parsedResult
  try {
    parsedResult = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      parsedResult = JSON.parse(match[0])
    } else {
      throw new Error('Invalid JSON response')
    }
  }
  
  // Calculate and deduct credits based on output
  const outputText = typeof parsedResult.result === 'string' 
    ? parsedResult.result 
    : JSON.stringify(parsedResult)
  
  const creditsToDeduct = calculateCredits(outputText)
  const deductResult = await deductCredits(req.userId, creditsToDeduct, action, outputText)
  
  if (!deductResult.success) {
    // If deduction fails, still return result but log error
    console.error('Credit deduction failed:', deductResult.error)
  }
  
  return {
    ...parsedResult,
    _credits: {
      used: deductResult.creditsUsed || creditsToDeduct,
      remaining: deductResult.newBalance
    }
  }
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
    
    // Build checkout URL - don't encode brackets as Lemon Squeezy needs original format
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

// POST /ai/summarize - Summarize note content
router.post('/summarize', requireCredits, async (req, res) => {
  try {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Missing content' })
    }

    const prompt = `Summarize the following content into concise key points. IMPORTANT: Respond in the SAME language as the input content. Use markdown format (headings, lists, bold, code blocks if needed).

Content:
${content}`

    const data = await callGeminiWithCredits(req, res, prompt, { result: "summary content here (markdown format)" }, 'summarize')
    res.json(data)
  } catch (error) {
    console.error('Summarize error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /ai/continue - Continue writing
router.post('/continue', requireCredits, async (req, res) => {
  try {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Missing content' })
    }

    const prompt = `Continue writing the following content naturally and coherently. IMPORTANT: Keep the same style and language as the input content. Only write the continuation, do not repeat existing content. Use markdown format if appropriate.

Content:
${content}`

    const data = await callGeminiWithCredits(req, res, prompt, { result: "continuation content (markdown format)" }, 'continue')
    res.json(data)
  } catch (error) {
    console.error('Continue error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /ai/improve - Improve writing
router.post('/improve', requireCredits, async (req, res) => {
  try {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Missing content' })
    }

    const prompt = `Improve the following text: fix spelling, grammar errors, make it clearer and more coherent. IMPORTANT: Keep the same meaning and language as the input content. Use markdown format (headings, lists, bold, inline code, code blocks for code).

Content:
${content}`

    const data = await callGeminiWithCredits(req, res, prompt, { result: "improved text (markdown format)" }, 'improve')
    res.json(data)
  } catch (error) {
    console.error('Improve error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /ai/translate - Translate content
router.post('/translate', requireCredits, async (req, res) => {
  try {
    const { content, targetLanguage } = req.body
    if (!content || !targetLanguage) {
      return res.status(400).json({ error: 'Missing content or targetLanguage' })
    }

    const prompt = `Translate the following content to ${targetLanguage}. Keep markdown format if present (headings, lists, code blocks, links).

Content:
${content}`

    const data = await callGeminiWithCredits(req, res, prompt, { result: "translation (keep markdown format)" }, 'translate')
    res.json(data)
  } catch (error) {
    console.error('Translate error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /ai/extract-tasks - Extract tasks from content
router.post('/extract-tasks', requireCredits, async (req, res) => {
  try {
    const { content } = req.body
    if (!content) {
      return res.status(400).json({ error: 'Missing content' })
    }

    const prompt = `Analyze the following content and create a list of tasks/to-dos. IMPORTANT: Respond in the SAME language as the input content.

Content:
${content}`

    const data = await callGeminiWithCredits(req, res, prompt, { tasks: ["task 1", "task 2"] }, 'extract-tasks')
    // Convert array to markdown task list
    const result = data.tasks.map(t => `- [ ] ${t}`).join('\n')
    res.json({ result, _credits: data._credits })
  } catch (error) {
    console.error('Extract tasks error:', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /ai/ask - Ask AI about note content
router.post('/ask', requireCredits, async (req, res) => {
  try {
    const { content, question } = req.body
    if (!content || !question) {
      return res.status(400).json({ error: 'Missing content or question' })
    }

    const prompt = `Based on the following note content, answer the question concisely and clearly. IMPORTANT: Respond in the SAME language as the question. Use markdown format if needed (lists, code blocks, bold).

Note content:
${content}

Question: ${question}`

    const data = await callGeminiWithCredits(req, res, prompt, { result: "answer (markdown format if needed)" }, 'ask')
    res.json(data)
  } catch (error) {
    console.error('Ask error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
