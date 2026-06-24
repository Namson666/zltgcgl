#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const matrixPath = path.join(rootDir, '.ai/DELIVERY_EVIDENCE_MATRIX.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

const allowedStatuses = new Set([
  'verified',
  'verified_with_external_yellow',
  'external_yellow',
  'not_verified',
]);
const inventoryAlertPattern = /库存预警|低库存|预警阈值|alertThreshold|\/wms\/alerts|InventoryAlert|inventory alert/i;

function fail(message, details = []) {
  console.error(`Delivery evidence matrix check failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    fail(`${label} must be an array`);
  }
}

function assertEvidenceFilesExist(items, label) {
  const missing = [];
  for (const item of items) {
    assertArray(item.evidence, `${label}.${item.id}.evidence`);
    for (const evidencePath of item.evidence) {
      const absolute = path.join(rootDir, evidencePath);
      if (!fs.existsSync(absolute)) {
        missing.push(`${item.id}: ${evidencePath}`);
      }
    }
  }
  if (missing.length > 0) {
    fail('evidence files are missing', missing);
  }
}

function assertStatuses(items, label) {
  const invalid = items
    .filter((item) => !allowedStatuses.has(item.status))
    .map((item) => `${label}.${item.id}: ${item.status}`);
  if (invalid.length > 0) {
    fail('invalid statuses', invalid);
  }
}

function assertExternalYellowHasRemainingEvidence(items) {
  const invalid = items
    .filter((item) => item.status === 'external_yellow' || item.status === 'verified_with_external_yellow')
    .filter((item) => !Array.isArray(item.remaining_external_evidence) || item.remaining_external_evidence.length === 0)
    .map((item) => item.id);
  if (invalid.length > 0) {
    fail('external-yellow items must state remaining external evidence', invalid);
  }
}

function assertNoInventoryAlertResidue() {
  const serialized = JSON.stringify(matrix, null, 2);
  if (inventoryAlertPattern.test(serialized)) {
    const allowedPhrase = '删除库存预警';
    const lines = serialized
      .split('\n')
      .map((line, index) => ({ line, index: index + 1 }))
      .filter(({ line }) => inventoryAlertPattern.test(line) && !line.includes(allowedPhrase) && !line.includes('不得恢复'));
    if (lines.length > 0) {
      fail('inventory alert residue appears outside explicit removal invariant', lines.map(({ index, line }) => `${index}: ${line.trim()}`));
    }
  }
}

assertArray(matrix.global_invariants, 'global_invariants');
assertArray(matrix.requirements, 'requirements');
assertStatuses(matrix.global_invariants, 'global_invariants');
assertStatuses(matrix.requirements, 'requirements');
assertEvidenceFilesExist(matrix.global_invariants, 'global_invariants');
assertEvidenceFilesExist(matrix.requirements, 'requirements');
assertExternalYellowHasRemainingEvidence(matrix.requirements);
assertNoInventoryAlertResidue();

const productGreen = matrix.status?.product_green;
if (productGreen !== 'external_yellow') {
  fail('product_green must remain external_yellow until real Production Smoke is green', [`product_green=${productGreen}`]);
}

console.log(`Delivery evidence matrix check passed: ${matrix.requirements.length} requirements, ${matrix.global_invariants.length} invariants.`);
