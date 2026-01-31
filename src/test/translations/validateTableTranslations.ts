/**
 * Validation script for table feature translations
 * This script checks that all table-related translation keys exist in all locale files
 */

import en from '../../locales/en.json';
import vi from '../../locales/vi.json';
import es from '../../locales/es.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';
import ar from '../../locales/ar.json';
import hi from '../../locales/hi.json';
import id from '../../locales/id.json';
import it from '../../locales/it.json';
import ja from '../../locales/ja.json';
import ko from '../../locales/ko.json';
import nl from '../../locales/nl.json';
import pl from '../../locales/pl.json';
import ptBR from '../../locales/pt-BR.json';
import th from '../../locales/th.json';
import tr from '../../locales/tr.json';
import zhCN from '../../locales/zh-CN.json';
import zhTW from '../../locales/zh-TW.json';

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

const locales = {
  en,
  vi,
  es,
  fr,
  de,
  ar,
  hi,
  id,
  it,
  ja,
  ko,
  nl,
  pl,
  'pt-BR': ptBR,
  th,
  tr,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};

// Helper function to get nested property value
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

interface ValidationResult {
  locale: string;
  totalKeys: number;
  presentKeys: number;
  missingKeys: string[];
  emptyKeys: string[];
  sampleTranslations: Record<string, string>;
}

function validateTranslations(): ValidationResult[] {
  const results: ValidationResult[] = [];

  Object.entries(locales).forEach(([localeName, localeData]) => {
    const missingKeys: string[] = [];
    const emptyKeys: string[] = [];
    const sampleTranslations: Record<string, string> = {};
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

function printReport(results: ValidationResult[]): void {
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
}

// Run validation
const results = validateTranslations();
printReport(results);

// Export for potential use in tests
export { validateTranslations, tableTranslationKeys };
