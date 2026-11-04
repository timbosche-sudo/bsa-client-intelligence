#!/usr/bin/env node
/**
 * Confidentiality guard.
 *
 * Scans the given directories (default: src public dist) for content that must never be
 * committed to the repository or published in the public GitHub Pages build:
 *
 *  1. Real-format BSA project numbers (e.g. 12345678.00A). Demo data uses "DEMO-###" numbers.
 *  2. Phrases describing confidential internal performance matters.
 *  3. Any exact string listed in private-data/denylist.txt (git-ignored, optional, one per line).
 *     Put real client project names, fee values, etc. there on machines that hold real data.
 *
 * Usage:
 *   node scripts/check-confidential.mjs [dirs...]   scan files on disk (default: src public dist)
 *   node scripts/check-confidential.mjs --history   scan every line ever added in git history (all refs)
 *
 * Exits non-zero when anything is found so CI and `npm run build` fail closed.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const historyMode = args.includes('--history');
const roots = historyMode ? [] : args.length ? args : ['src', 'public', 'dist'];
// This script and its documentation necessarily contain the patterns themselves.
const HISTORY_SELF = new Set(['scripts/check-confidential.mjs']);
// Binary or data files that must never exist in history at all.
const FORBIDDEN_PATHS = [/(^|\/)private-data\/(?!README\.md$)/, /_Seed\.json$/i, /\.seed\.json$/i, /Portfolio_Seed\.json$/i, /(^|\/)real-data\//];
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.jsx', '.json', '.html', '.css', '.md', '.txt', '.webmanifest', '.svg']);

const patterns = [
  { name: 'real-format BSA project number', re: /\b\d{8}\.\d{2}[A-Z]\b/g },
  { name: 'confidential internal performance language', re: /personality conflict|excessive delegation/gi },
];

const denylistPath = 'private-data/denylist.txt';
if (existsSync(denylistPath)) {
  const terms = readFileSync(denylistPath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  for (const t of terms) {
    patterns.push({ name: 'private denylist term', re: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') });
  }
}

const findings = [];
function walk(path) {
  if (!existsSync(path)) return;
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }
  if (!TEXT_EXT.has(extname(path))) return;
  const text = readFileSync(path, 'utf8');
  for (const { name, re } of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) findings.push(`${relative('.', path)}: ${name} ("${m[0]}")`);
  }
}
roots.forEach(walk);

if (historyMode) {
  const log = execFileSync('git', ['log', '--all', '-p', '--no-color', '--no-ext-diff', '--format=commit %H', '-U0'], { encoding: 'utf8', maxBuffer: 1 << 30 });
  let commit = '';
  let file = '';
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) commit = line.slice(7, 15);
    else if (line.startsWith('+++ ')) {
      file = line.slice(4).replace(/^b\//, '');
      if (FORBIDDEN_PATHS.some((re) => re.test(file))) findings.push(`${commit} ${file}: forbidden data file path`);
    } else if (line.startsWith('+') && !HISTORY_SELF.has(file)) {
      for (const { name, re } of patterns) {
        re.lastIndex = 0;
        const m = re.exec(line);
        if (m) findings.push(`${commit} ${file}: ${name} ("${m[0]}")`);
      }
    }
  }
  const commits = execFileSync('git', ['rev-list', '--all', '--count'], { encoding: 'utf8' }).trim();
  roots.push(`git history: ${commits} commits, all refs`);
}

if (findings.length) {
  console.error('\n✖ Confidentiality check failed. Remove the following before committing or publishing:\n');
  findings.forEach((f) => console.error('  - ' + f));
  console.error('');
  process.exit(1);
}
console.log(`✓ Confidentiality check passed (${roots.join(', ')})`);
