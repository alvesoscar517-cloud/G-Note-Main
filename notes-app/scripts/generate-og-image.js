/**
 * Generate OG Image for G-Note
 * Creates a 1200x630 Open Graph image for social sharing
 * 
 * Run: node scripts/generate-og-image.js
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.join(__dirname, '../public')

// OG Image dimensions (recommended by Facebook/Twitter)
const OG_WIDTH = 1200
const OG_HEIGHT = 630

async function generateOGImage() {
  console.log('Generating OG image...')
  
  // Create a gradient background with app branding
  const svg = `
    <svg width="${OG_WIDTH}" height="${OG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fafafa;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e5e5e5;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="100%" height="100%" fill="url(#bg)"/>
      
      <!-- Decorative elements -->
      <circle cx="100" cy="100" r="200" fill="#3b82f6" opacity="0.1"/>
      <circle cx="1100" cy="530" r="250" fill="#8b5cf6" opacity="0.1"/>
      
      <!-- App icon placeholder (circle) -->
      <circle cx="600" cy="220" r="80" fill="url(#accent)"/>
      <text x="600" y="240" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle">G</text>
      
      <!-- App name -->
      <text x="600" y="360" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#171717" text-anchor="middle">G-Note</text>
      
      <!-- Tagline -->
      <text x="600" y="420" font-family="Arial, sans-serif" font-size="32" fill="#525252" text-anchor="middle">Free Note Taking App</text>
      
      <!-- Features -->
      <text x="600" y="480" font-family="Arial, sans-serif" font-size="24" fill="#737373" text-anchor="middle">Google Drive Sync • AI Assistance • Works Offline</text>
      
      <!-- CTA -->
      <rect x="450" y="520" width="300" height="50" rx="25" fill="url(#accent)"/>
      <text x="600" y="553" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">Start Free Today</text>
      
      <!-- Bottom accent line -->
      <rect x="0" y="620" width="1200" height="10" fill="url(#accent)"/>
    </svg>
  `
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUTPUT_DIR, 'og-image.png'))
  
  console.log('✓ Generated og-image.png (1200x630)')
  
  // Generate Twitter card image (same dimensions work for both)
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(OUTPUT_DIR, 'twitter-image.png'))
  
  console.log('✓ Generated twitter-image.png (1200x630)')
  
  console.log('\nOG images generated successfully!')
}

generateOGImage().catch(console.error)
