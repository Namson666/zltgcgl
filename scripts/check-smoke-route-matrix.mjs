#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutPath = path.join(rootDir, 'frontend/src/components/layout/Layout.tsx');
const smokePath = path.join(rootDir, 'frontend/tests/smoke/browser-smoke.spec.ts');

const layoutSource = fs.readFileSync(layoutPath, 'utf8');
const smokeSource = fs.readFileSync(smokePath, 'utf8');

// NOTE: This guard intentionally follows the current Layout contract:
// `menuGroups` and `developerMenuGroup` are the menu source of truth.
// If the menu is split into new constants/files, update this script together
// so new product sections cannot bypass real-browser route coverage.

function fail(message, details = []) {
  console.error(`Smoke route matrix check failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function extractConstBlock(source, constName) {
  const startToken = `const ${constName}`;
  const start = source.indexOf(startToken);
  if (start < 0) {
    fail(`Cannot find ${constName}`);
  }

  const equals = source.indexOf('=', start);
  const firstBracket = source.indexOf('[', equals);
  const firstBrace = source.indexOf('{', equals);
  const open = firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace) ? firstBracket : firstBrace;
  const openChar = source[open];
  const closeChar = openChar === '[' ? ']' : '}';
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = open; i < source.length; i += 1) {
    const char = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, i + 1);
      }
    }
  }

  fail(`Cannot parse ${constName} block`);
}

function extractMenuPairs(block) {
  const pairs = [];
  const pathPattern = /path:\s*['"]([^'"]+)['"]/g;
  for (const match of block.matchAll(pathPattern)) {
    const itemStart = block.lastIndexOf('{', match.index);
    const itemPrefix = block.slice(itemStart, match.index);
    const nameMatch = itemPrefix.match(/name:\s*['"]([^'"]+)['"]/);
    if (!nameMatch) {
      fail(`Cannot find menu item name for path ${match[1]}`);
    }
    pairs.push({ label: nameMatch[1], path: match[1] });
  }
  return pairs;
}

function extractSmokePairs(constName) {
  const block = extractConstBlock(smokeSource, constName);
  const pairs = [];
  const tuplePattern = /\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g;
  for (const match of block.matchAll(tuplePattern)) {
    pairs.push({ label: match[1], path: match[2] });
  }
  return pairs;
}

function keyOf(pair) {
  return `${pair.label} -> ${pair.path}`;
}

function compare(expected, actual, label, allowedExtraPaths = new Set()) {
  const expectedKeys = new Set(expected.map(keyOf));
  const actualKeys = new Set(actual.map(keyOf));

  const missing = [...expectedKeys].filter((key) => !actualKeys.has(key));
  const extra = actual.filter((pair) => !expectedKeys.has(keyOf(pair)) && !allowedExtraPaths.has(pair.path)).map(keyOf);

  if (missing.length > 0 || extra.length > 0) {
    fail(`${label} is out of sync with Layout menu`, [
      ...missing.map((item) => `missing in smoke matrix: ${item}`),
      ...extra.map((item) => `extra in smoke matrix: ${item}`),
    ]);
  }
}

function assertNoInventoryAlertResidue() {
  const residuePattern = /库存预警|低库存|预警阈值|alertThreshold|\/wms\/alerts|InventoryAlert|inventory alert/i;
  const residues = [
    [layoutPath, layoutSource],
    [smokePath, smokeSource],
  ].filter(([, source]) => residuePattern.test(source));

  if (residues.length > 0) {
    fail('inventory alert / 库存预警 residue found in menu or smoke matrix', residues.map(([file]) => file));
  }
}

const enterpriseMenuPairs = extractMenuPairs(extractConstBlock(layoutSource, 'menuGroups'));
const developerMenuPairs = extractMenuPairs(extractConstBlock(layoutSource, 'developerMenuGroup'));
const enterpriseSmokePairs = extractSmokePairs('enterpriseRouteMatrix');
const developerSmokePairs = extractSmokePairs('developerRouteMatrix');

compare(enterpriseMenuPairs, enterpriseSmokePairs, 'enterpriseRouteMatrix', new Set(['/subscription']));
compare(developerMenuPairs, developerSmokePairs, 'developerRouteMatrix');
assertNoInventoryAlertResidue();

console.log(`Smoke route matrix check passed: ${enterpriseSmokePairs.length} enterprise routes, ${developerSmokePairs.length} developer routes.`);
