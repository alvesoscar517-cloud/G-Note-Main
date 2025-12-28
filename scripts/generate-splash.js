import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const sourceImage = join(publicDir, 'g-note.svg'); // Black logo

/**
 * Apple Human Interface Guidelines - App Icon Specifications:
 * - Corner radius: 22.37% of icon size (iOS standard)
 * - Icon content: 68% of background size (16% padding each side)
 */
const CORNER_RADIUS_RATIO = 0.2237;
const ICON_CONTENT_RATIO = 0.68;

// iOS Splash Screen sizes - All devices (Portrait & Landscape)
const splashScreens = [
  // iPad Pro 12.9"
  { width: 2048, height: 2732 },
  { width: 2732, height: 2048 },
  // iPad Pro 11"
  { width: 1668, height: 2388 },
  { width: 2388, height: 1668 },
  // iPad 10.2"
  { width: 1620, height: 2160 },
  { width: 2160, height: 1620 },
  // iPad Air 10.9"
  { width: 1640, height: 2360 },
  { width: 2360, height: 1640 },
  // iPad Mini
  { width: 1536, height: 2048 },
  { width: 2048, height: 1536 },
  // iPhone 15 Pro Max / 14 Pro Max
  { width: 1290, height: 2796 },
  { width: 2796, height: 1290 },
  // iPhone 15 Pro / 14 Pro
  { width: 1179, height: 2556 },
  { width: 2556, height: 1179 },
  // iPhone 15 / 14 / 13 / 12
  { width: 1170, height: 2532 },
  { width: 2532, height: 1170 },
  // iPhone 15 Plus / 14 Plus
  { width: 1284, height: 2778 },
  { width: 2778, height: 1284 },
  // iPhone X / XS / 11 Pro
  { width: 1125, height: 2436 },
  { width: 2436, height: 1125 },
  // iPhone XS Max / 11 Pro Max
  { width: 1242, height: 2688 },
  { width: 2688, height: 1242 },
  // iPhone XR / 11
  { width: 828, height: 1792 },
  { width: 1792, height: 828 },
  // iPhone 8 Plus / 7 Plus
  { width: 1242, height: 2208 },
  { width: 2208, height: 1242 },
  // iPhone 8 / 7 / SE
  { width: 750, height: 1334 },
  { width: 1334, height: 750 },
  // iPhone SE 1st / 5s
  { width: 640, height: 1136 },
  { width: 1136, height: 640 },
];

// Theme configurations - both use white icon background with black logo
const themes = [
  {
    name: 'light',
    suffix: '',
    background: { r: 250, g: 250, b: 250, alpha: 1 }, // #fafafa
  },
  {
    name: 'dark',
    suffix: '-dark',
    background: { r: 10, g: 10, b: 10, alpha: 1 }, // #0a0a0a
  }
];

// Create rounded rectangle SVG
function createRoundedRectSvg(size, radius) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>
  `);
}

async function generateSplashScreen(splash, theme) {
  const isPortrait = splash.height > splash.width;
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const fileName = `apple-splash-${splash.width}-${splash.height}${theme.suffix}.png`;
  const outputPath = join(publicDir, fileName);
  
  // Icon background size: 18% of smaller dimension
  const smallerDim = Math.min(splash.width, splash.height);
  const bgSize = Math.round(smallerDim * 0.18);
  const cornerRadius = Math.round(bgSize * CORNER_RADIUS_RATIO);
  
  // Icon content size (inside the white background)
  const iconSize = Math.round(bgSize * ICON_CONTENT_RATIO);
  const iconPadding = Math.round((bgSize - iconSize) / 2);
  
  // Center position
  const bgX = Math.round((splash.width - bgSize) / 2);
  const bgY = Math.round((splash.height - bgSize) / 2);
  
  // Create rounded white background
  const bgBuffer = await sharp(createRoundedRectSvg(bgSize, cornerRadius))
    .png()
    .toBuffer();
  
  // Render logo from SVG
  const iconBuffer = await sharp(sourceImage, { density: 300 })
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Composite icon onto white background
  const iconWithBgBuffer = await sharp(bgBuffer)
    .composite([{
      input: iconBuffer,
      top: iconPadding,
      left: iconPadding
    }])
    .png()
    .toBuffer();
  
  // Create final splash screen
  await sharp({
    create: {
      width: splash.width,
      height: splash.height,
      channels: 4,
      background: theme.background
    }
  })
    .composite([{
      input: iconWithBgBuffer,
      top: bgY,
      left: bgX
    }])
    .png({ quality: 100 })
    .toFile(outputPath);
  
  return { fileName, orientation };
}

async function main() {
  console.log('🎨 G-Note Splash Screen Generator\n');
  console.log('='.repeat(60) + '\n');
  console.log(`Icon specifications:`);
  console.log(`  • Corner radius: ${(CORNER_RADIUS_RATIO * 100).toFixed(2)}%`);
  console.log(`  • Icon content: ${(ICON_CONTENT_RATIO * 100).toFixed(0)}% of background`);
  console.log(`  • Background: White with black logo (both themes)\n`);
  
  let totalCount = 0;
  
  for (const theme of themes) {
    console.log(`📱 Generating ${theme.name.toUpperCase()} mode...\n`);
    
    for (const splash of splashScreens) {
      const { fileName, orientation } = await generateSplashScreen(splash, theme);
      totalCount++;
      console.log(`  ✓ ${fileName} (${orientation})`);
    }
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log(`\n✅ Generated ${totalCount} splash screens successfully!`);
}

main().catch(console.error);
