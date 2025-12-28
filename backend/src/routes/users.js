import { Router } from 'express'
import { db, collections } from '../config/firebase.js'

const router = Router()

// GET /users/:id - Get user profile
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection(collections.users).doc(req.params.id).get()
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(doc.data())
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: error.message })
  }
})

// PATCH /users/:id - Update user profile
router.patch('/:id', async (req, res) => {
  try {
    const { name, avatar } = req.body
    const updates = {}
    
    if (name) updates.name = name
    if (avatar) updates.avatar = avatar
    updates.updatedAt = Date.now()

    await db.collection(collections.users).doc(req.params.id).update(updates)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
