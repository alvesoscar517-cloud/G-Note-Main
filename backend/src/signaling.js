/**
 * WebRTC Signaling Server for y-webrtc
 * 
 * This is a simple signaling server that enables WebRTC peer discovery
 * for real-time collaboration using Yjs.
 * 
 * Based on: https://github.com/yjs/y-webrtc/blob/master/bin/server.js
 */

import { WebSocketServer } from 'ws'

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

// Map of topic -> Set of connections
const topics = new Map()

/**
 * Send a message to a WebSocket connection
 */
const send = (conn, message) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    conn.close()
  }
  try {
    conn.send(JSON.stringify(message))
  } catch (e) {
    conn.close()
  }
}

/**
 * Handle incoming WebSocket messages
 */
const onMessage = (conn, message) => {
  try {
    const data = typeof message === 'string' ? JSON.parse(message) : JSON.parse(message.toString())
    
    if (data && data.type) {
      switch (data.type) {
        case 'subscribe':
          // Subscribe to topics
          (data.topics || []).forEach(topicName => {
            let topic = topics.get(topicName)
            if (!topic) {
              topic = new Set()
              topics.set(topicName, topic)
            }
            topic.add(conn)
            conn.topics = conn.topics || new Set()
            conn.topics.add(topicName)
          })
          break
          
        case 'unsubscribe':
          // Unsubscribe from topics
          (data.topics || []).forEach(topicName => {
            const topic = topics.get(topicName)
            if (topic) {
              topic.delete(conn)
              if (topic.size === 0) {
                topics.delete(topicName)
              }
            }
            if (conn.topics) {
              conn.topics.delete(topicName)
            }
          })
          break
          
        case 'publish':
          // Publish message to topic subscribers
          if (data.topic) {
            const receivers = topics.get(data.topic)
            if (receivers) {
              receivers.forEach(receiver => {
                if (receiver !== conn) {
                  send(receiver, data)
                }
              })
            }
          }
          break
          
        case 'ping':
          send(conn, { type: 'pong' })
          break
      }
    }
  } catch (err) {
    console.error('Signaling message error:', err)
  }
}

/**
 * Handle WebSocket connection close
 */
const onClose = (conn) => {
  if (conn.topics) {
    conn.topics.forEach(topicName => {
      const topic = topics.get(topicName)
      if (topic) {
        topic.delete(conn)
        if (topic.size === 0) {
          topics.delete(topicName)
        }
      }
    })
  }
}

/**
 * Setup signaling WebSocket server
 * @param {import('http').Server} server - HTTP server to attach to
 * @param {string} path - WebSocket path (default: '/signaling')
 */
export function setupSignaling(server, path = '/signaling') {
  const wss = new WebSocketServer({ server, path })
  
  wss.on('connection', (conn, req) => {
    conn.isAlive = true
    conn.topics = new Set()
    
    conn.on('message', (message) => onMessage(conn, message))
    conn.on('close', () => onClose(conn))
    conn.on('error', () => onClose(conn))
    conn.on('pong', () => { conn.isAlive = true })
  })
  
  // Ping clients every 30 seconds to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach(conn => {
      if (conn.isAlive === false) {
        return conn.terminate()
      }
      conn.isAlive = false
      conn.ping()
    })
  }, 30000)
  
  wss.on('close', () => {
    clearInterval(pingInterval)
  })
  
  console.log(`WebRTC signaling server running on path: ${path}`)
  
  return wss
}
