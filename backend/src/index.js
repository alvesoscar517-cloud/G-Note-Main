import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import aiRoutes from './routes/ai.js'
import webhookRoutes from './routes/webhooks.js'
import driveRoutes from './routes/drive.js'
import shareRoutes from './routes/share.js'
import { getConfiguredPlatforms } from './config/google.js'
import { setupSignaling, getRoomInfo } from './signaling.js'

const app = express()
const PORT = process.env.PORT || 8080

// Create HTTP server for both Express and WebSocket
const server = createServer(app)

// Parse ALLOWED_ORIGINS - supports multiple origins separated by comma
// Example: ALLOWED_ORIGINS=http://localhost:5173,https://gnote.app,chrome-extension://xxx
const parseAllowedOrigins = () => {
  const originsEnv = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || ''
  
  if (!originsEnv) {
    // Default: allow all (for development)
    return true
  }
  
  // Split by comma and trim whitespace
  const origins = originsEnv.split(',').map(o => o.trim()).filter(Boolean)
  
  return (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true)
    }
    
    // Check if origin matches any allowed origin
    const isAllowed = origins.some(allowed => {
      // Exact match
      if (origin === allowed) return true
      
      // Wildcard support: chrome-extension://* matches any extension
      if (allowed.endsWith('*')) {
        const prefix = allowed.slice(0, -1)
        if (origin.startsWith(prefix)) return true
      }
      
      return false
    })
    
    if (isAllowed) {
      callback(null, true)
    } else {
      console.warn(`CORS blocked origin: ${origin}`)
      callback(new Error(`Origin ${origin} not allowed by CORS`))
    }
  }
}

// CORS configuration
app.use(cors({
  origin: parseAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id']
}))

// Webhook routes need raw body to verify signature
app.use('/webhooks', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString()
  }
}), webhookRoutes)

// Other routes use normal json parser
app.use(express.json())

// Routes
app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/ai', aiRoutes)
app.use('/drive', driveRoutes)
app.use('/share', shareRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    configuredPlatforms: getConfiguredPlatforms()
  })
})

// Room check API - verify if a collaboration room exists
app.get('/rooms/:roomId/check', (req, res) => {
  const { roomId } = req.params
  const roomInfo = getRoomInfo(roomId)
  res.json(roomInfo)
})

// Setup WebRTC signaling server for real-time collaboration
setupSignaling(server, '/signaling')

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Configured OAuth platforms: ${getConfiguredPlatforms().join(', ')}`)
  console.log(`WebRTC signaling available at ws://localhost:${PORT}/signaling`)
})
