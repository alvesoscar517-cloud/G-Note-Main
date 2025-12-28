import { db, collections, FieldValue } from '../config/firebase.js'

/**
 * AI Credits System
 * 
 * Pricing Strategy (based on Gemini 2.5 Flash Lite):
 * - Google charges: ~$0.075/1M input tokens, ~$0.30/1M output tokens
 * - 1 token ≈ 4 characters (average)
 * - We charge based on OUTPUT only (simpler, user-friendly)
 * 
 * Credit Calculation:
 * - 1 credit = 100 output characters
 * - Minimum charge: 5 credits per request (covers overhead)
 * - This gives ~5x markup for profit margin + server costs
 * 
 * Example: 500 char response = 5 credits
 * Example: 1500 char response = 15 credits
 */

// Credits per 100 output characters
const CREDITS_PER_100_CHARS = 1
const MIN_CREDITS_PER_REQUEST = 5

/**
 * Calculate credits needed for AI response
 * @param {string} outputText - The AI response text
 * @returns {number} Credits to deduct
 */
export function calculateCredits(outputText) {
  if (!outputText) return 0
  
  const charCount = outputText.length
  const calculatedCredits = Math.ceil(charCount / 100) * CREDITS_PER_100_CHARS
  
  // Minimum charge to cover API overhead
  return Math.max(calculatedCredits, MIN_CREDITS_PER_REQUEST)
}

/**
 * Get user's current credit balance
 * @param {string} userId 
 * @returns {Promise<number>}
 */
export async function getUserCredits(userId) {
  const doc = await db.collection(collections.users).doc(userId).get()
  if (!doc.exists) return 0
  return doc.data().aiCredits || 0
}

/**
 * Check if user has enough credits
 * @param {string} userId 
 * @param {number} requiredCredits 
 * @returns {Promise<{hasCredits: boolean, currentBalance: number}>}
 */
export async function checkCredits(userId, requiredCredits = MIN_CREDITS_PER_REQUEST) {
  const currentBalance = await getUserCredits(userId)
  return {
    hasCredits: currentBalance >= requiredCredits,
    currentBalance
  }
}

/**
 * Deduct credits after successful AI response
 * @param {string} userId 
 * @param {number} credits 
 * @param {string} action - AI action type (summarize, translate, etc.)
 * @param {string} outputText - For logging purposes
 * @returns {Promise<{success: boolean, newBalance: number, creditsUsed: number}>}
 */
export async function deductCredits(userId, credits, action, outputText = '') {
  const userRef = db.collection(collections.users).doc(userId)
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)
      
      if (!userDoc.exists) {
        throw new Error('User not found')
      }
      
      const currentCredits = userDoc.data().aiCredits || 0
      
      if (currentCredits < credits) {
        throw new Error('Insufficient credits')
      }
      
      const newBalance = currentCredits - credits
      
      // Update user credits
      transaction.update(userRef, { 
        aiCredits: newBalance,
        lastAiUsage: Date.now()
      })
      
      // Log transaction
      const txRef = db.collection(collections.creditTransactions).doc()
      transaction.set(txRef, {
        userId,
        type: 'usage',
        action,
        credits: -credits,
        balanceAfter: newBalance,
        outputLength: outputText.length,
        timestamp: Date.now()
      })
      
      return { newBalance, creditsUsed: credits }
    })
    
    return { success: true, ...result }
  } catch (error) {
    console.error('Deduct credits error:', error)
    return { success: false, newBalance: 0, creditsUsed: 0, error: error.message }
  }
}

/**
 * Add credits to user account (after purchase)
 * @param {string} userId 
 * @param {number} credits 
 * @param {string} orderId - Lemon Squeezy order ID
 * @param {string} packageName - Package purchased
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export async function addCredits(userId, credits, orderId, packageName) {
  const userRef = db.collection(collections.users).doc(userId)
  
  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef)
      
      const currentCredits = userDoc.exists ? (userDoc.data().aiCredits || 0) : 0
      const newBalance = currentCredits + credits
      
      // Update or create user with credits
      if (userDoc.exists) {
        transaction.update(userRef, { 
          aiCredits: newBalance,
          lastCreditPurchase: Date.now()
        })
      } else {
        transaction.set(userRef, { 
          aiCredits: newBalance,
          lastCreditPurchase: Date.now()
        })
      }
      
      // Log transaction
      const txRef = db.collection(collections.creditTransactions).doc()
      transaction.set(txRef, {
        userId,
        type: 'purchase',
        orderId,
        packageName,
        credits: credits,
        balanceAfter: newBalance,
        timestamp: Date.now()
      })
      
      return { newBalance }
    })
    
    return { success: true, ...result }
  } catch (error) {
    console.error('Add credits error:', error)
    return { success: false, newBalance: 0, error: error.message }
  }
}

/**
 * Credit packages for Lemon Squeezy
 * Using single product with variants
 * 
 * Pricing designed for profitability:
 * - Starter: $2.99 for 500 credits (~100 AI requests)
 * - Popular: $7.99 for 1500 credits (~300 AI requests) - best value
 * - Pro: $14.99 for 3500 credits (~700 AI requests)
 * 
 * variantId will be set from LEMONSQUEEZY_VARIANT_* env vars
 */
export const CREDIT_PACKAGES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 500,
    price: 2.99,
    priceDisplay: '$2.99',
    description: '~100 AI requests',
    variantId: '' // Set from env: LEMONSQUEEZY_VARIANT_STARTER
  },
  {
    id: 'popular', 
    name: 'Popular',
    credits: 1500,
    price: 7.99,
    priceDisplay: '$7.99',
    description: '~300 AI requests',
    badge: 'Best Value',
    variantId: '' // Set from env: LEMONSQUEEZY_VARIANT_POPULAR
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 3500,
    price: 14.99,
    priceDisplay: '$14.99',
    description: '~700 AI requests',
    variantId: '' // Set from env: LEMONSQUEEZY_VARIANT_PRO
  }
]

/**
 * LemonSqueezy Variant IDs (hardcoded for reliability)
 */
const VARIANT_IDS = {
  STARTER: '1173426',
  POPULAR: '1173433',
  PRO: '1173435'
}

/**
 * Get credits amount by variant ID
 * @param {string} variantId - Lemon Squeezy variant ID
 * @returns {number|null} Credits amount or null if not found
 */
export function getCreditsByVariantId(variantId) {
  const variantMap = {
    [VARIANT_IDS.STARTER]: 500,
    [VARIANT_IDS.POPULAR]: 1500,
    [VARIANT_IDS.PRO]: 3500
  }
  return variantMap[variantId] || null
}

/**
 * Get package name by variant ID
 * @param {string} variantId 
 * @returns {string}
 */
export function getPackageNameByVariantId(variantId) {
  const variantMap = {
    [VARIANT_IDS.STARTER]: 'Starter',
    [VARIANT_IDS.POPULAR]: 'Popular',
    [VARIANT_IDS.PRO]: 'Pro'
  }
  return variantMap[variantId] || 'Unknown'
}
