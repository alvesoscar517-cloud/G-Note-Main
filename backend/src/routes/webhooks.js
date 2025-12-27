import { Router } from 'express'
import crypto from 'crypto'
import { addCredits, getCreditsByVariantId, getPackageNameByVariantId } from '../services/credits.js'

const router = Router()

// Lemon Squeezy webhook secret
const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET

/**
 * Verify Lemon Squeezy webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('LEMONSQUEEZY_WEBHOOK_SECRET not set')
    return false
  }
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
  const digest = hmac.update(payload).digest('hex')
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(digest)
    )
  } catch {
    return false
  }
}

/**
 * POST /webhooks/lemonsqueezy
 * Handle Lemon Squeezy payment webhooks
 * 
 * Webhook payload structure for order_created:
 * {
 *   meta: { event_name: 'order_created', custom_data: { user_id: '...' } },
 *   data: {
 *     id: 'order_id',
 *     attributes: {
 *       first_order_item: {
 *         variant_id: 123456  // This tells us which package was purchased
 *       }
 *     }
 *   }
 * }
 */
router.post('/lemonsqueezy', async (req, res) => {
  try {
    const signature = req.headers['x-signature']
    const rawBody = req.rawBody // Use original raw body instead of JSON.stringify
    
    // Verify signature in production
    if (WEBHOOK_SECRET && !verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature')
      return res.status(401).json({ error: 'Invalid signature' })
    }
    
    const { meta, data } = req.body
    const eventName = meta?.event_name
    
    console.log('Lemon Squeezy webhook:', eventName)
    
    // Handle order completed event
    if (eventName === 'order_created') {
      const orderId = data?.id
      const customData = meta?.custom_data || {}
      const userId = customData.user_id
      
      // Get variant_id from order to determine which package
      const variantId = String(data?.attributes?.first_order_item?.variant_id || '')
      
      if (!userId) {
        console.error('Missing user_id in custom_data')
        return res.status(400).json({ error: 'Missing user_id' })
      }
      
      if (!variantId) {
        console.error('Missing variant_id in order')
        return res.status(400).json({ error: 'Missing variant_id' })
      }
      
      // Get credits amount based on variant
      const credits = getCreditsByVariantId(variantId)
      const packageName = getPackageNameByVariantId(variantId)
      
      if (!credits) {
        console.error('Unknown variant_id:', variantId)
        return res.status(400).json({ error: 'Unknown variant' })
      }
      
      // Add credits to user
      const result = await addCredits(userId, credits, orderId, packageName)
      
      if (result.success) {
        console.log(`Added ${credits} credits (${packageName}) to user ${userId}. New balance: ${result.newBalance}`)
      } else {
        console.error('Failed to add credits:', result.error)
        return res.status(500).json({ error: 'Failed to add credits' })
      }
    }
    
    res.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
