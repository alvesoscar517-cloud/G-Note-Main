/**
 * Validation script for table feature translations
 * Run with: node scripts/validateTableTranslations.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load all locale files
const localeDir = join(__dirname, '../src/locales');

const localeFiles = [
  'en.json',
  'vi.json',
  'es.json',
  'fr.json',
  'de.json',
  'ar.json',
  'hi.json',
  'id.json',
  'it.json',
  'ja.json',
  'ko.json',
  'nl.json',
  'pl.json',
  'pt-BR.json',
  'th.json',
  'tr.json',
  'zh-CN.json',
  'zh-TW.json',
];

const locales = {};
localeFiles.forEach((file) => {
  const localeName = file.replace('.json', '');
  const content = readFileSync(join(localeDir, file), 'utf-8');
  locales[localeName] = JSON.parse(content);
});

// All table-related translation keys from the design document
const tableTranslationKeys = [
  'editor.insertTable',
  'editor.tableOperations',
  'editor.addColumnBefore',
  'editor.addColumnAfter',
  'editor.addRowBefore',
  'editor.addRowAfter',
  'editor.deleteColumn',
  'editor.deleteRow',
  'editor.deleteTable',
  'editor.deleteTableConfirmTitle',
  'editor.deleteTableConfirmDescription',
  'editor.mergeCells',
  'editor.splitCell',
  'editor.toggleHeaderRow',
  'editor.toggleHeaderColumn',
  'editor.exportTableCSV',
  'editor.exportTableMarkdown',
  'editor.tableRows',
  'editor.tableColumns',
  'editor.includeHeaderRow',
  'editor.tablePreview',
  'editor.createTable',
  'editor.tableProperties',
  'editor.tableDimensions',
  'editor.tableHeaders',
  'editor.tableWidth',
  'editor.tableOptions',
  'editor.resizableColumns',
  'editor.fixedLayout',
  'editor.headerRow',
  'editor.headerColumn',
  'editor.autoWidth',
  'editor.fullWidth',
  'editor.customWidth',
];

// Helper function to get nested property value
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

function validateTranslations() {
  const results = [];

  Object.entries(locales).forEach(([localeName, localeData]) => {
    const missingKeys = [];
    const emptyKeys = [];
    const sampleTranslations = {};
    let presentKeys = 0;

    tableTranslationKeys.forEach((key) => {
      const value = getNestedValue(localeData, key);

      if (value === undefined) {
        missingKeys.push(key);
      } else if (typeof value === 'string' && value.trim() === '') {
        emptyKeys.push(key);
      } else {
        presentKeys++;

        // Collect sample translations for key features
        if (
          key === 'editor.insertTable' ||
          key === 'editor.createTable' ||
          key === 'editor.tableProperties' ||
          key === 'editor.addRowBefore' ||
          key === 'editor.deleteColumn'
        ) {
          sampleTranslations[key] = value;
        }
      }
    });

    results.push({
      locale: localeName,
      totalKeys: tableTranslationKeys.length,
      presentKeys,
      missingKeys,
      emptyKeys,
      sampleTranslations,
    });
  });

  return results;
}

function printReport(results) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         TABLE FEATURE TRANSLATION VALIDATION REPORT           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`Total translation keys to validate: ${tableTranslationKeys.length}`);
  console.log(`Total locales checked: ${results.length}\n`);

  // Summary table
  console.log('┌─────────────┬─────────┬─────────┬──────────┬────────────┐');
  console.log('│   Locale    │  Total  │ Present │  Missing │   Empty    │');
  console.log('├─────────────┼─────────┼─────────┼──────────┼────────────┤');

  results.forEach((result) => {
    const locale = result.locale.padEnd(11);
    const total = result.totalKeys.toString().padStart(7);
    const present = result.presentKeys.toString().padStart(7);
    const missing = result.missingKeys.length.toString().padStart(8);
    const empty = result.emptyKeys.length.toString().padStart(10);

    console.log(`│ ${locale} │ ${total} │ ${present} │ ${missing} │ ${empty} │`);
  });

  console.log('└─────────────┴─────────┴─────────┴──────────┴────────────┘\n');

  // Detailed issues
  const localesWithIssues = results.filter(
    (r) => r.missingKeys.length > 0 || r.emptyKeys.length > 0
  );

  if (localesWithIssues.length > 0) {
    console.log('⚠️  ISSUES FOUND:\n');

    localesWithIssues.forEach((result) => {
      console.log(`\n${result.locale}:`);

      if (result.missingKeys.length > 0) {
        console.log(`  ❌ Missing keys (${result.missingKeys.length}):`);
        result.missingKeys.forEach((key) => console.log(`     - ${key}`));
      }

      if (result.emptyKeys.length > 0) {
        console.log(`  ⚠️  Empty keys (${result.emptyKeys.length}):`);
        result.emptyKeys.forEach((key) => console.log(`     - ${key}`));
      }
    });
  } else {
    console.log('✅ All translations are complete!\n');
  }

  // Sample translations
  console.log('\n📝 SAMPLE TRANSLATIONS:\n');

  const sampleKeys = [
    'editor.insertTable',
    'editor.createTable',
    'editor.tableProperties',
    'editor.addRowBefore',
    'editor.deleteColumn',
  ];

  sampleKeys.forEach((key) => {
    console.log(`\n${key}:`);
    results.forEach((result) => {
      if (result.sampleTranslations[key]) {
        console.log(`  ${result.locale.padEnd(8)}: ${result.sampleTranslations[key]}`);
      }
    });
  });

  // Final summary
  const allComplete = localesWithIssues.length === 0;
  const completionRate =
    (results.reduce((sum, r) => sum + r.presentKeys, 0) /
      (results.length * tableTranslationKeys.length)) *
    100;

  console.log('\n' + '═'.repeat(66));
  console.log(`\n📊 OVERALL COMPLETION: ${completionRate.toFixed(1)}%`);

  if (allComplete) {
    console.log('✅ STATUS: All table translations are complete and ready!');
  } else {
    console.log(`⚠️  STATUS: ${localesWithIssues.length} locale(s) need attention`);
  }

  console.log('\n' + '═'.repeat(66) + '\n');

  // Return exit code based on completion
  return allComplete ? 0 : 1;
}

// Run validation
const results = validateTranslations();
const exitCode = printReport(results);
process.exit(exitCode);
