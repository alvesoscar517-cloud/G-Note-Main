import { Firestore, FieldValue } from '@google-cloud/firestore'

// Auto-detects credentials on Cloud Run
export const db = new Firestore()

// Collections
export const collections = {
  users: 'users',
  refreshTokens: 'refreshTokens',
  aiUsage: 'aiUsage',           // Track AI usage history
  creditTransactions: 'creditTransactions'  // Credit purchase/usage history
}

export { FieldValue }
