import express from 'express'

const router = express.Router()

// Proxy endpoint to fetch public note from Google Drive (avoid CORS)
router.get('/public/:fileId', async (req, res) => {
  const { fileId } = req.params
  
  if (!fileId) {
    return res.status(400).json({ error: 'Missing fileId' })
  }

  try {
    // Use Google Drive API with API key
    const apiKey = process.env.GOOGLE_API_KEY
    
    if (!apiKey) {
      console.error('Missing GOOGLE_API_KEY')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
    
    const response = await fetch(driveUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Drive API error:', response.status, errorText)
      
      if (response.status === 404) {
        return res.status(404).json({ error: 'Note not found' })
      }
      if (response.status === 403) {
        return res.status(403).json({ error: 'Note is not public or access denied' })
      }
      
      return res.status(response.status).json({ error: 'Failed to fetch note' })
    }

    const noteData = await response.json()
    res.json(noteData)
    
  } catch (error) {
    console.error('Error fetching public note:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
