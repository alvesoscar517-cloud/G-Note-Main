import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// iOS Splash Screen sizes - All devices (Portrait & Landscape)
const splashScreens = [
  // iPad Pro 12.9" (2048x2732)
  { width: 2048, height: 2732 },
  { width: 2732, height: 2048 },
  // iPad Pro 11" (1668x2388)
  { width: 1668, height: 2388 },
  { width: 2388, height: 1668 },
  // iPad 10.2" (1620x2160)
  { width: 1620, height: 2160 },
  { width: 2160, height: 1620 },
  // iPad Air 10.9" (1640x2360)
  { width: 1640, height: 2360 },
  { width: 2360, height: 1640 },
  // iPad Mini (1536x2048)
  { width: 1536, height: 2048 },
  { width: 2048, height: 1536 },
  // iPhone 15 Pro Max / 14 Pro Max (1290x2796)
  { width: 1290, height: 2796 },
  { width: 2796, height: 1290 },
  // iPhone 15 Pro / 14 Pro (1179x2556)
  { width: 1179, height: 2556 },
  { width: 2556, height: 1179 },
  // iPhone 15 / 15 Plus / 14 / 14 Plus / 13 / 12 (1170x2532)
  { width: 1170, height: 2532 },
  { width: 2532, height: 1170 },
  // iPhone 15 Plus / 14 Plus (1284x2778)
  { width: 1284, height: 2778 },
  { width: 2778, height: 1284 },
  // iPhone X / XS / 11 Pro (1125x2436)
  { width: 1125, height: 2436 },
  { width: 2436, height: 1125 },
  // iPhone XS Max / 11 Pro Max (1242x2688)
  { width: 1242, height: 2688 },
  { width: 2688, height: 1242 },
  // iPhone XR / 11 (828x1792)
  { width: 828, height: 1792 },
  { width: 1792, height: 828 },
  // iPhone 8 Plus / 7 Plus / 6s Plus (1242x2208)
  { width: 1242, height: 2208 },
  { width: 2208, height: 1242 },
  // iPhone 8 / 7 / 6s / SE 2nd/3rd (750x1334)
  { width: 750, height: 1334 },
  { width: 1334, height: 750 },
  // iPhone SE 1st / 5s (640x1136)
  { width: 640, height: 1136 },
  { width: 1136, height: 640 },
];

// Theme configurations
const themes = [
  {
    name: 'light',
    suffix: '',
    background: { r: 250, g: 250, b: 250, alpha: 1 }, // #fafafa
    iconBg: 'rgba(23, 23, 23, 0.9)', // neutral-900
    iconSrc: 'g-note-dark.svg',
    textColor: '#171717'
  },
  {
    name: 'dark',
    suffix: '-dark',
    background: { r: 10, g: 10, b: 10, alpha: 1 }, // #0a0a0a
    iconBg: 'rgba(255, 255, 255, 0.9)', // white
    iconSrc: 'g-note.svg',
    textColor: '#ffffff'
  }
];

async function generateSplashScreen(splash, theme) {
  const isPortrait = splash.height > splash.width;
  const orientation = isPortrait ? 'portrait' : 'landscape';
  const fileName = `apple-splash-${splash.width}-${splash.height}${theme.suffix}.png`;
  const outputPath = join(publicDir, fileName);
  const sourceIcon = join(publicDir, theme.iconSrc);
  
  // Icon size: 18% of the smaller dimension
  const smallerDim = Math.min(splash.width, splash.height);
  const iconSize = Math.floor(smallerDim * 0.18);
  const iconX = Math.floor((splash.width - iconSize) / 2);
  const iconY = Math.floor((splash.height - iconSize) / 2) - Math.floor(smallerDim * 0.08);
  
  // Rounded rectangle background for icon
  const cornerRadius = Math.floor(iconSize * 0.22);
  const padding = Math.floor(iconSize * 0.18);
  const bgSize = iconSize + padding * 2;
  const bgX = iconX - padding;
  const bgY = iconY - padding;
  
  // Create icon
  const iconBuffer = await sharp(sourceIcon)
    .resize(iconSize, iconSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Create rounded rectangle SVG for icon background
  const roundedRectSvg = `
    <svg width="${bgSize}" height="${bgSize}">
      <rect 
        x="0" y="0" 
        width="${bgSize}" height="${bgSize}" 
        rx="${cornerRadius}" ry="${cornerRadius}"
        fill="${theme.iconBg}"
      />
    </svg>
  `;
  const roundedRectBuffer = await sharp(Buffer.from(roundedRectSvg))
    .png()
    .toBuffer();
  
  // Create "G-Note" text
  const fontSize = Math.floor(iconSize * 0.28);
  const textY = bgY + bgSize + Math.floor(iconSize * 0.25);
  const textSvg = `
    <svg width="${splash.width}" height="${fontSize * 2}">
      <text 
        x="${splash.width / 2}" 
        y="${fontSize}" 
        text-anchor="middle" 
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="${theme.textColor}"
      >G-Note</text>
    </svg>
  `;
  const textBuffer = await sharp(Buffer.from(textSvg))
    .png()
    .toBuffer();
  
  // Create splash screen
  await sharp({
    create: {
      width: splash.width,
      height: splash.height,
      channels: 4,
      background: theme.background
    }
  })
    .composite([
      { input: roundedRectBuffer, top: bgY, left: bgX },
      { input: iconBuffer, top: iconY, left: iconX },
      { input: textBuffer, top: textY, left: 0 }
    ])
    .png()
    .toFile(outputPath);
  
  return { fileName, orientation };
}

async function generateAllSplashScreens() {
  console.log('🎨 Generating iOS Splash Screens (Light & Dark modes)...\n');
  console.log('='.repeat(60) + '\n');
  
  const results = { light: [], dark: [] };
  let totalCount = 0;
  
  for (const theme of themes) {
    console.log(`\n📱 Generating ${theme.name.toUpperCase()} mode splash screens...\n`);
    
    for (const splash of splashScreens) {
      const { fileName, orientation } = await generateSplashScreen(splash, theme);
      results[theme.name].push({ fileName, width: splash.width, height: splash.height, orientation });
      totalCount++;
      console.log(`  ✓ ${fileName} (${splash.width}x${splash.height} ${orientation})`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Generated ${totalCount} splash screens successfully!`);
  console.log(`   • Light mode: ${results.light.length} images`);
  console.log(`   • Dark mode: ${results.dark.length} images`);
  
  // Generate HTML snippet for index.html
  console.log('\n📋 HTML snippet for index.html:\n');
  console.log('<!-- iOS Splash Screens - Light Mode -->');
  for (const s of results.light.filter(s => s.orientation === 'portrait').slice(0, 5)) {
    console.log(`<link rel="apple-touch-startup-image" href="/${s.fileName}" media="(device-width: ${Math.floor(s.width/2)}px) and (device-height: ${Math.floor(s.height/2)}px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: light)" />`);
  }
}

generateAllSplashScreens().catch(console.error);
