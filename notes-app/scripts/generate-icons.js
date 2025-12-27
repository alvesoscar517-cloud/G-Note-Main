import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const sourceImage = join(publicDir, 'g-note.svg');

// Standard icons with transparent background
const standardIcons = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'pwa-64x64.png', size: 64 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

// Maskable icons need safe zone padding (at least 10% on each side)
// Icon content should be within 80% of the total size (centered)
const maskableIcons = [
  { name: 'pwa-maskable-192x192.png', size: 192 },
  { name: 'pwa-maskable-512x512.png', size: 512 },
];

async function generateStandardIcons() {
  console.log('Generating standard icons (transparent background)...\n');
  
  for (const icon of standardIcons) {
    const outputPath = join(publicDir, icon.name);
    await sharp(sourceImage)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`✓ Created ${icon.name} (${icon.size}x${icon.size})`);
  }
}

async function generateMaskableIcons() {
  console.log('\nGenerating maskable icons (with safe zone padding)...\n');
  
  for (const icon of maskableIcons) {
    const outputPath = join(publicDir, icon.name);
    const iconSize = Math.floor(icon.size * 0.6); // Icon takes 60% of total size
    const padding = Math.floor((icon.size - iconSize) / 2);
    
    // Create icon with dark background (matching app theme)
    const iconBuffer = await sharp(sourceImage)
      .resize(iconSize, iconSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Create final maskable icon with background and centered icon
    await sharp({
      create: {
        width: icon.size,
        height: icon.size,
        channels: 4,
        background: { r: 23, g: 23, b: 23, alpha: 1 } // neutral-900 (#171717)
      }
    })
      .composite([{
        input: iconBuffer,
        top: padding,
        left: padding
      }])
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Created ${icon.name} (${icon.size}x${icon.size}, maskable with safe zone)`);
  }
}

async function generateIcons() {
  console.log('🎨 G-Note Icon Generator\n');
  console.log('='.repeat(50) + '\n');
  
  await generateStandardIcons();
  await generateMaskableIcons();
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ All icons generated successfully!');
  console.log('\nIcon types:');
  console.log('  • Standard icons: Transparent background, for browsers/desktop');
  console.log('  • Maskable icons: With safe zone padding, for Android adaptive icons');
  console.log('\nNote: Maskable icons have 20% padding on each side to ensure');
  console.log('the icon content is visible regardless of device mask shape.');
}

generateIcons().catch(console.error);
