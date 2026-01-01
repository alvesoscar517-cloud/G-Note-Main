import express from 'express'
import nodemailer from 'nodemailer'
import { db, FieldValue } from '../config/firebase.js'

const router = express.Router()

const SHARED_NOTES_COLLECTION = 'shared_notes'
const USERS_COLLECTION = 'users'
const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB

// Email transporter (configured via environment variables)
let transporter = null
const getTransporter = () => {
  if (!transporter && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      }
    })
  }
  return transporter
}

// Check if user exists in the system
router.get('/check-user/:email', async (req, res) => {
  try {
    const { email } = req.params
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Check in Firestore users collection
    const snapshot = await db.collection(USERS_COLLECTION)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get()
    
    res.json({ exists: !snapshot.empty })
  } catch (error) {
    console.error('Error checking user:', error)
    res.status(500).json({ error: 'Failed to check user' })
  }
})

// Share note via email (using Firestore)
router.post('/email', async (req, res) => {
  try {
    const { note, recipientEmail, senderEmail, senderName } = req.body
    
    if (!note || !recipientEmail || !senderEmail) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate note size
    const noteJson = JSON.stringify(note)
    const noteSize = Buffer.byteLength(noteJson, 'utf8')
    
    if (noteSize > MAX_FILE_SIZE) {
      return res.status(413).json({ 
        error: 'FILE_TOO_LARGE',
        message: 'Note is too large to share (max 1MB)'
      })
    }

    // Check if recipient exists
    const recipientSnapshot = await db.collection(USERS_COLLECTION)
      .where('email', '==', recipientEmail.toLowerCase())
      .limit(1)
      .get()
    
    if (recipientSnapshot.empty) {
      return res.status(404).json({ 
        error: 'USER_NOT_FOUND',
        message: 'Recipient not found in the system'
      })
    }

    const recipientDoc = recipientSnapshot.docs[0]
    const recipientId = recipientDoc.id

    // Create shared note document
    const sharedNote = {
      ...note,
      isShared: true,
      sharedBy: senderEmail,
      sharedByName: senderName || senderEmail.split('@')[0],
      sharedAt: FieldValue.serverTimestamp(),
      recipientEmail: recipientEmail.toLowerCase(),
      recipientId: recipientId,
      status: 'pending' // pending, received, deleted
    }

    const docRef = await db.collection(SHARED_NOTES_COLLECTION).add(sharedNote)

    // Send email notification
    const emailTransporter = getTransporter()
    if (emailTransporter) {
      const appUrl = process.env.APP_URL || 'https://gnote.graphosai.com'
      const noteTitle = note.title || 'Untitled Note'
      
      try {
        await emailTransporter.sendMail({
          from: `"G-Note" <${process.env.EMAIL_USER}>`,
          to: recipientEmail,
          subject: `${senderName || senderEmail} shared a note with you`,
          text: `${senderName || senderEmail} shared "${noteTitle}" with you.\n\nOpen G-Note to view: ${appUrl}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 16px;">New shared note</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                <strong>${senderName || senderEmail}</strong> shared a note with you:
              </p>
              <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="color: #333; font-size: 18px; font-weight: 500; margin: 0;">${noteTitle}</p>
              </div>
              <a href="${appUrl}" style="display: inline-block; background: #4F46E5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
                Open G-Note
              </a>
              <p style="color: #999; font-size: 12px; margin-top: 24px;">
                This email was sent by G-Note. If you didn't expect this, you can ignore it.
              </p>
            </div>
          `
        })
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError)
        // Don't fail the request if email fails
      }
    }

    res.json({ 
      success: true, 
      shareId: docRef.id,
      message: 'Note shared successfully'
    })
  } catch (error) {
    console.error('Error sharing note:', error)
    res.status(500).json({ error: 'Failed to share note' })
  }
})

// Get shared notes for a user
router.get('/received/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    const snapshot = await db.collection(SHARED_NOTES_COLLECTION)
      .where('recipientId', '==', userId)
      .where('status', '==', 'pending')
      .orderBy('sharedAt', 'desc')
      .get()

    const notes = []
    snapshot.forEach(doc => {
      const data = doc.data()
      notes.push({
        shareId: doc.id,
        ...data,
        sharedAt: data.sharedAt?.toDate?.()?.getTime() || Date.now()
      })
    })

    res.json({ notes })
  } catch (error) {
    console.error('Error getting shared notes:', error)
    res.status(500).json({ error: 'Failed to get shared notes' })
  }
})

// Mark shared note as received (and delete from Firestore)
router.post('/received/:shareId/accept', async (req, res) => {
  try {
    const { shareId } = req.params
    
    if (!shareId) {
      return res.status(400).json({ error: 'Share ID is required' })
    }

    // Delete the shared note document
    await db.collection(SHARED_NOTES_COLLECTION).doc(shareId).delete()

    res.json({ success: true })
  } catch (error) {
    console.error('Error accepting shared note:', error)
    res.status(500).json({ error: 'Failed to accept shared note' })
  }
})

// Decline/delete shared note
router.delete('/received/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params
    
    if (!shareId) {
      return res.status(400).json({ error: 'Share ID is required' })
    }

    await db.collection(SHARED_NOTES_COLLECTION).doc(shareId).delete()

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting shared note:', error)
    res.status(500).json({ error: 'Failed to delete shared note' })
  }
})

export default router
