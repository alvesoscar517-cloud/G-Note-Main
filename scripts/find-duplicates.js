#!/usr/bin/env node

/**
 * Duplicate File Finder
 * 
 * This script compares files between src/ and notes-app-chrome-extension/src/
 * to identify duplicates for the codebase unification project.
 * 
 * Categories:
 * - TRULY_SHARED: Files that are identical and should be shared
 * - PLATFORM_SPECIFIC: Files that exist in both but serve different purposes
 * - NEEDS_MODIFICATION: Files that are similar but need changes to be shared
 * - EXTENSION_ONLY: Files that only exist in the extension
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const webAppSrc = path.join(rootDir, 'src');
const extensionSrc = path.join(rootDir, 'notes-app-chrome-extension', 'src');

// Files to exclude from comparison
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.test\.(ts|tsx|js|jsx)$/,
  /__tests__/,
  /\.md$/,
  /vite-env\.d\.ts$/,
];

// Known platform-specific files
const PLATFORM_SPECIFIC = [
  'App.tsx',
  'main.tsx',
  'contentScript.ts',
  'background.js',
  'lib/chromeAuth.ts',
  'lib/splashScreen.ts',
  'components/notes/WebContentDialog.tsx',
  'stores/webContentStore.ts',
  'hooks/useWebContent.ts',
  'components/legal/PrivacyPolicy.tsx',
  'components/legal/TermsOfService.tsx',
  'components/layout/InstallPrompt.tsx',
  'components/FreeNoteSEOHead.tsx',
  'components/SEOHead.tsx',
  'lib/freeNoteSeo.ts',
  'lib/seo.ts',
];

/**
 * Get MD5 hash of file content
 */
function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Get all files recursively from a directory
 */
function getAllFiles(dir, baseDir = dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    // Skip excluded patterns
    if (EXCLUDE_PATTERNS.some(pattern => pattern.test(relativePath))) {
      continue;
    }

    if (entry.isDirectory()) {
      getAllFiles(fullPath, baseDir, files);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

/**
 * Check if file is platform-specific
 */
function isPlatformSpecific(relativePath) {
  return PLATFORM_SPECIFIC.some(pattern => 
    relativePath.includes(pattern) || relativePath.endsWith(pattern)
  );
}

/**
 * Calculate similarity between two files
 */
function calculateSimilarity(file1, file2) {
  try {
    const content1 = fs.readFileSync(file1, 'utf8');
    const content2 = fs.readFileSync(file2, 'utf8');

    // Simple line-based similarity
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const maxLines = Math.max(lines1.length, lines2.length);
    let matchingLines = 0;

    for (let i = 0; i < Math.min(lines1.length, lines2.length); i++) {
      if (lines1[i].trim() === lines2[i].trim()) {
        matchingLines++;
      }
    }

    return (matchingLines / maxLines) * 100;
  } catch (error) {
    return 0;
  }
}

/**
 * Main analysis function
 */
function analyzeDuplicates() {
  console.log('🔍 Analyzing duplicate files between Web App and Chrome Extension...\n');

  const webAppFiles = getAllFiles(webAppSrc, webAppSrc);
  const extensionFiles = getAllFiles(extensionSrc, extensionSrc);

  const results = {
    trulyShared: [],
    platformSpecific: [],
    needsModification: [],
    extensionOnly: [],
    webOnly: [],
  };

  // Create a set of extension files for quick lookup
  const extensionFileSet = new Set(extensionFiles);

  // Analyze each web app file
  for (const webFile of webAppFiles) {
    const webFilePath = path.join(webAppSrc, webFile);
    const extFilePath = path.join(extensionSrc, webFile);

    if (!extensionFileSet.has(webFile)) {
      // File only exists in web app
      if (!isPlatformSpecific(webFile)) {
        results.webOnly.push({
          path: webFile,
          reason: 'Only exists in web app',
        });
      }
      continue;
    }

    // File exists in both locations
    if (isPlatformSpecific(webFile)) {
      results.platformSpecific.push({
        path: webFile,
        reason: 'Known platform-specific file',
      });
      continue;
    }

    const webHash = getFileHash(webFilePath);
    const extHash = getFileHash(extFilePath);

    if (webHash === extHash) {
      // Files are identical
      results.trulyShared.push({
        path: webFile,
        hash: webHash,
        size: fs.statSync(webFilePath).size,
      });
    } else {
      // Files differ - calculate similarity
      const similarity = calculateSimilarity(webFilePath, extFilePath);

      if (similarity >= 90) {
        results.needsModification.push({
          path: webFile,
          similarity: similarity.toFixed(1) + '%',
          reason: 'Files are very similar but not identical',
        });
      } else if (similarity >= 50) {
        results.needsModification.push({
          path: webFile,
          similarity: similarity.toFixed(1) + '%',
          reason: 'Files have significant differences',
        });
      } else {
        results.platformSpecific.push({
          path: webFile,
          similarity: similarity.toFixed(1) + '%',
          reason: 'Files are substantially different',
        });
      }
    }
  }

  // Find extension-only files
  for (const extFile of extensionFiles) {
    const webFilePath = path.join(webAppSrc, extFile);

    if (!fs.existsSync(webFilePath)) {
      results.extensionOnly.push({
        path: extFile,
        reason: 'Only exists in extension',
      });
    }
  }

  return results;
}

/**
 * Print results
 */
function printResults(results) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    DUPLICATE FILES AUDIT REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Summary
  console.log('📊 SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`✅ Truly Shared (Identical):        ${results.trulyShared.length} files`);
  console.log(`🔀 Platform-Specific:               ${results.platformSpecific.length} files`);
  console.log(`⚠️  Needs Modification:              ${results.needsModification.length} files`);
  console.log(`📦 Extension-Only:                  ${results.extensionOnly.length} files`);
  console.log(`🌐 Web-Only:                        ${results.webOnly.length} files`);
  console.log('');

  // Calculate duplication percentage
  const totalExtensionFiles = results.trulyShared.length + 
                              results.platformSpecific.length + 
                              results.needsModification.length + 
                              results.extensionOnly.length;
  const duplicatePercentage = ((results.trulyShared.length + results.needsModification.length) / totalExtensionFiles * 100).toFixed(1);
  
  console.log(`📈 Duplication Rate: ${duplicatePercentage}% of extension files are duplicates`);
  console.log('');

  // Truly Shared Files
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ TRULY SHARED FILES (Identical - Can be deleted from extension)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.trulyShared.length === 0) {
    console.log('No identical files found.\n');
  } else {
    // Group by directory
    const byDirectory = {};
    for (const file of results.trulyShared) {
      const dir = path.dirname(file.path);
      if (!byDirectory[dir]) byDirectory[dir] = [];
      byDirectory[dir].push(file);
    }

    for (const [dir, files] of Object.entries(byDirectory).sort()) {
      console.log(`📁 ${dir}/`);
      for (const file of files) {
        const fileName = path.basename(file.path);
        const sizeKB = (file.size / 1024).toFixed(1);
        console.log(`   ├─ ${fileName} (${sizeKB} KB)`);
      }
      console.log('');
    }
  }

  // Platform-Specific Files
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔀 PLATFORM-SPECIFIC FILES (Keep separate in both locations)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.platformSpecific.length === 0) {
    console.log('No platform-specific files found.\n');
  } else {
    for (const file of results.platformSpecific.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`📄 ${file.path}`);
      console.log(`   └─ ${file.reason}`);
      if (file.similarity) {
        console.log(`   └─ Similarity: ${file.similarity}`);
      }
      console.log('');
    }
  }

  // Needs Modification
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('⚠️  NEEDS MODIFICATION (Similar but requires changes to unify)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.needsModification.length === 0) {
    console.log('No files need modification.\n');
  } else {
    for (const file of results.needsModification.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`📄 ${file.path}`);
      console.log(`   ├─ Similarity: ${file.similarity}`);
      console.log(`   └─ ${file.reason}`);
      console.log('');
    }
  }

  // Extension-Only Files
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📦 EXTENSION-ONLY FILES (Keep in extension)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.extensionOnly.length === 0) {
    console.log('No extension-only files found.\n');
  } else {
    for (const file of results.extensionOnly.sort((a, b) => a.path.localeCompare(b.path))) {
      console.log(`📄 ${file.path}`);
      console.log(`   └─ ${file.reason}`);
      console.log('');
    }
  }

  // Web-Only Files
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🌐 WEB-ONLY FILES (Not in extension)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.webOnly.length === 0) {
    console.log('No web-only files found.\n');
  } else {
    // Group by directory
    const byDirectory = {};
    for (const file of results.webOnly) {
      const dir = path.dirname(file.path);
      if (!byDirectory[dir]) byDirectory[dir] = [];
      byDirectory[dir].push(file);
    }

    for (const [dir, files] of Object.entries(byDirectory).sort()) {
      console.log(`📁 ${dir}/`);
      for (const file of files) {
        const fileName = path.basename(file.path);
        console.log(`   ├─ ${fileName}`);
      }
      console.log('');
    }
  }

  // Deletion Plan
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🗑️  DELETION PLAN');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log('The following files can be safely deleted from the extension:\n');
  console.log(`Total files to delete: ${results.trulyShared.length}\n`);
  
  if (results.trulyShared.length > 0) {
    console.log('Commands to delete duplicate files:\n');
    console.log('```bash');
    console.log('cd notes-app-chrome-extension/src');
    
    // Group deletions by directory for efficiency
    const deleteCommands = results.trulyShared
      .map(file => `rm "${file.path}"`)
      .sort();
    
    for (const cmd of deleteCommands) {
      console.log(cmd);
    }
    console.log('```\n');
  }

  console.log('After deletion, update imports in remaining extension files to use @/ alias.\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         END OF REPORT');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run the analysis
try {
  const results = analyzeDuplicates();
  printResults(results);
  
  // Write results to JSON file for programmatic access
  const outputPath = path.join(rootDir, 'duplicates.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Detailed results saved to: duplicates.json\n`);
  
  process.exit(0);
} catch (error) {
  console.error('❌ Error during analysis:', error);
  process.exit(1);
}
