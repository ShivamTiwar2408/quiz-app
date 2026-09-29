#!/usr/bin/env node
/**
 * validate-quiz-sets.js — sanity-check quiz/data/sets/*.json against the schema
 * quiz/index.html actually consumes, and check manifest counts match the files.
 *
 * Catches the failures that are otherwise silent in the browser: a `correct`
 * key that no option has (question ungradeable), duplicate option keys, a
 * manifest count that disagrees with the set, raw `<` in text the app injects
 * with innerHTML.
 *
 * Run: node scripts/validate-quiz-sets.js [setNamePrefix]
 * Exits non-zero if any set is invalid.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SETS = path.join(ROOT, 'quiz', 'data', 'sets');
const MANIFEST = path.join(ROOT, 'quiz', 'data', 'manifest.json');
const only = process.argv[2] || '';

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const counts = {};
for (const topic of manifest.tree || [])
  for (const child of topic.children || []) counts[child.set] = child.count;

const errors = [];
const warnings = [];
let files = 0;
let questions = 0;

for (const file of fs.readdirSync(SETS).filter((f) => f.endsWith('.json'))) {
  const setId = path.basename(file, '.json');
  if (only && !setId.startsWith(only)) continue;
  files++;
  const err = (msg) => errors.push(`${setId}: ${msg}`);
  // quiz/index.html renders `q.explanation||''`, so a missing one degrades the
  // review screen but still grades correctly — warn, don't fail.
  const warn = (msg) => warnings.push(`${setId}: ${msg}`);

  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(SETS, file), 'utf8'));
  } catch (e) {
    err(`unparseable JSON — ${e.message}`);
    continue;
  }
  const qs = data.questions || data;
  if (!Array.isArray(qs)) {
    err('no questions array');
    continue;
  }
  questions += qs.length;

  if (counts[setId] === undefined) err('not listed in manifest.json');
  else if (counts[setId] !== qs.length)
    err(`manifest says ${counts[setId]} questions, file has ${qs.length}`);

  qs.forEach((q, i) => {
    const at = `Q${i + 1}`;
    if (!q.question || typeof q.question !== 'string') return err(`${at} missing question text`);
    if (!Array.isArray(q.options) || q.options.length < 2) return err(`${at} needs 2+ options`);
    const keys = q.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) err(`${at} duplicate option keys`);
    q.options.forEach((o, j) => {
      if (!o.key || !o.text) err(`${at} option ${j + 1} missing key or text`);
    });
    if (!Array.isArray(q.correct) || q.correct.length === 0) return err(`${at} no correct answer`);
    for (const k of q.correct)
      if (!keys.includes(k)) err(`${at} correct key "${k}" is not an option — ungradeable`);
    if (q.correct.length === keys.length) warn(`${at} every option marked correct`);
    if (!q.explanation) warn(`${at} missing explanation`);
    // options + explanation are injected with innerHTML by quiz/index.html
    for (const s of [...q.options.map((o) => o.text), q.explanation || ''])
      if (/[<>]/.test(s)) warn(`${at} raw angle bracket in innerHTML-rendered text`);
  });
}

const declared = manifest.total_questions;
console.log(`checked ${files} set(s), ${questions} questions`);
if (!only) {
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  if (sum !== declared)
    errors.push(`manifest.total_questions is ${declared} but children sum to ${sum}`);
}
if (warnings.length) console.log(`${warnings.length} warning(s) (cosmetic; app still grades correctly)`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors.slice(0, 60)) console.error('  ' + e);
  if (errors.length > 60) console.error(`  … and ${errors.length - 60} more`);
  process.exit(1);
}
console.log('all sets valid');
