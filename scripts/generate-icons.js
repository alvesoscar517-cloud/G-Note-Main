import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

// SVG Logo đen (light theme)
const svgLogoLight = `<svg xmlns="http://www.w3.org/2000/svg" width="500" viewBox="76 54 222 267" height="500" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><clipPath id="aa2286bc85"><path d="M 88.753906 155 L 286 155 L 286 308.394531 L 88.753906 308.394531 Z M 88.753906 155 " clip-rule="nonzero"/></clipPath><clipPath id="f045d6b4f1"><path d="M 120 66.894531 L 284 66.894531 L 284 129 L 120 129 Z M 120 66.894531 " clip-rule="nonzero"/></clipPath></defs><g clip-path="url(#aa2286bc85)"><path fill="#000000" d="M 167.925781 308.125 C 124.226562 308.125 88.796875 272.695312 88.796875 228.992188 L 88.796875 165.96875 C 88.796875 160.113281 93.542969 155.371094 99.394531 155.371094 L 140.066406 155.371094 C 145.917969 155.371094 150.664062 160.113281 150.664062 165.96875 L 150.664062 230.015625 C 150.664062 238.988281 157.9375 246.261719 166.910156 246.261719 L 214.941406 246.261719 C 219.625 246.261719 223.417969 242.464844 223.417969 237.78125 L 223.417969 226.976562 C 223.417969 222.292969 219.625 218.5 214.941406 218.5 L 206.871094 218.5 C 203.695312 218.5 200.734375 216.910156 198.976562 214.265625 L 171.609375 173.101562 C 166.925781 166.058594 171.972656 156.640625 180.429688 156.640625 L 274.691406 156.636719 C 280.542969 156.636719 285.285156 161.378906 285.285156 167.234375 L 285.285156 297.527344 C 285.285156 303.378906 280.542969 308.125 274.691406 308.125 Z M 167.925781 308.125 " fill-opacity="1" fill-rule="nonzero"/></g><g clip-path="url(#f045d6b4f1)"><path fill="#fbb03b" d="M 149.433594 124.097656 L 122.054688 83.429688 C 117.3125 76.390625 122.359375 66.914062 130.84375 66.914062 L 245.671875 66.914062 C 249.214844 66.914062 252.527344 68.6875 254.492188 71.640625 L 281.5625 112.304688 C 286.25 119.347656 281.203125 128.773438 272.742188 128.773438 L 158.226562 128.773438 C 154.699219 128.773438 151.40625 127.019531 149.433594 124.097656 Z M 149.433594 124.097656 " fill-opacity="1" fill-rule="nonzero"/></g></svg>`;

// SVG Logo trắng (dark theme)
const svgLogoDark = `<svg xmlns="http://www.w3.org/2000/svg" width="500" viewBox="76 54 222 267" height="500" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><clipPath id="aa2286bc85"><path d="M 88.753906 155 L 286 155 L 286 308.394531 L 88.753906 308.394531 Z M 88.753906 155 " clip-rule="nonzero"/></clipPath><clipPath id="f045d6b4f1"><path d="M 120 66.894531 L 284 66.894531 L 284 129 L 120 129 Z M 120 66.894531 " clip-rule="nonzero"/></clipPath></defs><g clip-path="url(#aa2286bc85)"><path fill="#ffffff" d="M 167.925781 308.125 C 124.226562 308.125 88.796875 272.695312 88.796875 228.992188 L 88.796875 165.96875 C 88.796875 160.113281 93.542969 155.371094 99.394531 155.371094 L 140.066406 155.371094 C 145.917969 155.371094 150.664062 160.113281 150.664062 165.96875 L 150.664062 230.015625 C 150.664062 238.988281 157.9375 246.261719 166.910156 246.261719 L 214.941406 246.261719 C 219.625 246.261719 223.417969 242.464844 223.417969 237.78125 L 223.417969 226.976562 C 223.417969 222.292969 219.625 218.5 214.941406 218.5 L 206.871094 218.5 C 203.695312 218.5 200.734375 216.910156 198.976562 214.265625 L 171.609375 173.101562 C 166.925781 166.058594 171.972656 156.640625 180.429688 156.640625 L 274.691406 156.636719 C 280.542969 156.636719 285.285156 161.378906 285.285156 167.234375 L 285.285156 297.527344 C 285.285156 303.378906 280.542969 308.125 274.691406 308.125 Z M 167.925781 308.125 " fill-opacity="1" fill-rule="nonzero"/></g><g clip-path="url(#f045d6b4f1)"><path fill="#fbb03b" d="M 149.433594 124.097656 L 122.054688 83.429688 C 117.3125 76.390625 122.359375 66.914062 130.84375 66.914062 L 245.671875 66.914062 C 249.214844 66.914062 252.527344 68.6875 254.492188 71.640625 L 281.5625 112.304688 C 286.25 119.347656 281.203125 128.773438 272.742188 128.773438 L 158.226562 128.773438 C 154.699219 128.773438 151.40625 127.019531 149.433594 124.097656 Z M 149.433594 124.097656 " fill-opacity="1" fill-rule="nonzero"/></g></svg>`;

// All icons - transparent background
const icons = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'pwa-64x64.png', size: 64 },
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'pwa-maskable-192x192.png', size: 192 },
  { name: 'pwa-maskable-512x512.png', size: 512 },
];

// Splash screens
const splashScreens = [
  { width: 1290, height: 2796, name: 'apple-splash-1290-2796' },
  { width: 1179, height: 2556, name: 'apple-splash-1179-2556' },
  { width: 1284, height: 2778, name: 'apple-splash-1284-2778' },
  { width: 1170, height: 2532, name: 'apple-splash-1170-2532' },
  { width: 1125, height: 2436, name: 'apple-splash-1125-2436' },
  { width: 1242, height: 2688, name: 'apple-splash-1242-2688' },
  { width: 828, height: 1792, name: 'apple-splash-828-1792' },
  { width: 1242, height: 2208, name: 'apple-splash-1242-2208' },
  { width: 750, height: 1334, name: 'apple-splash-750-1334' },
  { width: 640, height: 1136, name: 'apple-splash-640-1136' },
  { width: 2048, height: 2732, name: 'apple-splash-2048-2732' },
  { width: 1668, height: 2388, name: 'apple-splash-1668-2388' },
  { width: 1640, height: 2360, name: 'apple-splash-1640-2360' },
  { width: 1620, height: 2160, name: 'apple-splash-1620-2160' },
  { width: 1536, height: 2048, name: 'apple-splash-1536-2048' },
  { width: 2796, height: 1290, name: 'apple-splash-2796-1290' },
  { width: 2556, height: 1179, name: 'apple-splash-2556-1179' },
  { width: 2778, height: 1284, name: 'apple-splash-2778-1284' },
  { width: 2532, height: 1170, name: 'apple-splash-2532-1170' },
  { width: 2436, height: 1125, name: 'apple-splash-2436-1125' },
  { width: 2688, height: 1242, name: 'apple-splash-2688-1242' },
  { width: 1792, height: 828, name: 'apple-splash-1792-828' },
  { width: 2208, height: 1242, name: 'apple-splash-2208-1242' },
  { width: 1334, height: 750, name: 'apple-splash-1334-750' },
  { width: 1136, height: 640, name: 'apple-splash-1136-640' },
  { width: 2732, height: 2048, name: 'apple-splash-2732-2048' },
  { width: 2388, height: 1668, name: 'apple-splash-2388-1668' },
  { width: 2360, height: 1640, name: 'apple-splash-2360-1640' },
  { width: 2160, height: 1620, name: 'apple-splash-2160-1620' },
  { width: 2048, height: 1536, name: 'apple-splash-2048-1536' },
];

async function generateIcons() {
  console.log('📱 Generating Icons (transparent background)...\n');
  
  for (const icon of icons) {
    await sharp(Buffer.from(svgLogoLight), { density: 300 })
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(publicDir, icon.name));
    
    console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
  }
}

async function generateSplashScreens() {
  console.log('\n🖼️  Generating Splash Screens...\n');
  
  for (const splash of splashScreens) {
    const minDim = Math.min(splash.width, splash.height);
    const iconSize = Math.round(minDim * 0.25);
    
    // Light
    const lightLogo = await sharp(Buffer.from(svgLogoLight), { density: 300 })
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    
    await sharp({ create: { width: splash.width, height: splash.height, channels: 4, background: { r: 250, g: 250, b: 250, alpha: 1 } } })
      .composite([{ input: lightLogo, top: Math.round((splash.height - iconSize) / 2), left: Math.round((splash.width - iconSize) / 2) }])
      .png().toFile(join(publicDir, `${splash.name}.png`));
    
    // Dark
    const darkLogo = await sharp(Buffer.from(svgLogoDark), { density: 300 })
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    
    await sharp({ create: { width: splash.width, height: splash.height, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } })
      .composite([{ input: darkLogo, top: Math.round((splash.height - iconSize) / 2), left: Math.round((splash.width - iconSize) / 2) }])
      .png().toFile(join(publicDir, `${splash.name}-dark.png`));
    
    console.log(`  ✓ ${splash.name}`);
  }
}

function updateSVGFiles() {
  console.log('\n📝 Updating SVG files...\n');
  writeFileSync(join(publicDir, 'g-note.svg'), svgLogoLight);
  writeFileSync(join(publicDir, 'g-note-dark.svg'), svgLogoDark);
  console.log('  ✓ g-note.svg & g-note-dark.svg');
}

async function main() {
  console.log('🎨 G-Note Icon Generator\n');
  console.log('='.repeat(50) + '\n');
  
  updateSVGFiles();
  await generateIcons();
  await generateSplashScreens();
  
  console.log('\n' + '='.repeat(50));
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
