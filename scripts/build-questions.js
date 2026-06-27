#!/usr/bin/env node
/**
 * build-questions.js — consolidate every question source into a single
 * normalized bundle that the app loads at runtime: public/questions-data.json.
 *
 * Sources (each normalized to the canonical schema below):
 *   1. questions/<Topic>/<Subtopic>.json
 *        canonical array — system-design + electronics question bank.
 *   2. quiz/data/sets/bhagavatam-*.json (+ manifest for nice chapter names)
 *        Śrīmad Bhāgavatam (Canto 3); converts {key,text}/correct -> canonical.
 *
 * Canonical question schema (what the React app + SM-2 engine expect):
 *   {
 *     id, topic, subtopic, question,
 *     options: { A: "...", B: "...", ... },
 *     correct_answers: ["A", ...],
 *     explanation, difficulty, category?, tags?
 *   }
 *
 * Run: `npm run build:questions` (also runs automatically via `prebuild`).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'questions-data.json');
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Stable id from human-readable parts. */
function makeId(topic, subtopic, i) {
  const slug = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${slug(topic)}__${slug(subtopic)}__${i}`;
}

const all = [];

// ---------------------------------------------------------------------------
// Source 1: questions/<Topic>/<Subtopic>.json  (already canonical arrays)
// ---------------------------------------------------------------------------
const questionsDir = path.join(ROOT, 'questions');
// Śrīmad Bhāgavatam is sourced from quiz/data/sets (the consolidated 891-question
// superset, source 2 below), so any legacy raw Bhāgavatam folder here is skipped
// to avoid duplication.
const SKIP_TOPICS = new Set(['Srimad Bhagavatam']);
let s1 = 0;
for (const topic of fs.readdirSync(questionsDir)) {
  const topicPath = path.join(questionsDir, topic);
  if (!fs.statSync(topicPath).isDirectory()) continue;
  if (SKIP_TOPICS.has(topic)) continue;
  for (const file of fs.readdirSync(topicPath)) {
    if (!file.endsWith('.json')) continue;
    const subtopic = path.basename(file, '.json');
    const arr = JSON.parse(fs.readFileSync(path.join(topicPath, file), 'utf8'));
    if (!Array.isArray(arr)) {
      console.warn(`  skip (not a question array): questions/${topic}/${file}`);
      continue;
    }
    arr.forEach((q, i) => {
      all.push({
        id: makeId(topic, subtopic, i),
        topic,
        subtopic,
        question: q.question,
        options: q.options,
        correct_answers: q.correct_answers,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium',
        ...(q.category ? { category: q.category } : {}),
        ...(q.tags ? { tags: q.tags } : {}),
      });
      s1++;
    });
  }
}

// ---------------------------------------------------------------------------
// Source 2: quiz/data/sets/bhagavatam-*.json  (convert to canonical)
// ---------------------------------------------------------------------------
const setsDir = path.join(ROOT, 'quiz', 'data', 'sets');
const manifestPath = path.join(ROOT, 'quiz', 'data', 'manifest.json');

// Map set-id -> friendly chapter name from the manifest, when available.
const setLabels = {};
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const cat of manifest.tree || []) {
    for (const child of cat.children || []) {
      if (child.set) setLabels[child.set] = child.name;
    }
  }
}

let s2 = 0;
if (fs.existsSync(setsDir)) {
  const bhagavatamFiles = fs
    .readdirSync(setsDir)
    .filter((f) => f.startsWith('bhagavatam-') && f.endsWith('.json'))
    // numeric chapter order (ch1, ch2, … ch10) rather than lexical
    .sort((a, b) => {
      const n = (s) => parseInt((s.match(/ch(\d+)/) || [])[1] || '0', 10);
      return n(a) - n(b);
    });

  for (const file of bhagavatamFiles) {
    const setId = path.basename(file, '.json');
    const data = JSON.parse(fs.readFileSync(path.join(setsDir, file), 'utf8'));
    const questions = data.questions || data;
    const subtopic = setLabels[setId] || setId.replace(/^bhagavatam-canto3-/, '');

    questions.forEach((q, i) => {
      // options: [{key:'a',text:'…'}] -> {A:'…', …}; correct:['b'] -> ['B']
      const options = {};
      const keyToLetter = {};
      q.options.forEach((opt, idx) => {
        const letter = LETTERS[idx];
        options[letter] = opt.text;
        keyToLetter[String(opt.key).toLowerCase()] = letter;
      });
      const correct_answers = (q.correct || []).map(
        (k) => keyToLetter[String(k).toLowerCase()] || String(k).toUpperCase()
      );
      all.push({
        id: makeId('Srimad Bhagavatam', subtopic, i),
        topic: 'Śrīmad Bhāgavatam (Canto 3)',
        subtopic,
        question: q.question,
        options,
        correct_answers,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium',
        category: 'Scripture',
      });
      s2++;
    });
  }
}

// ---------------------------------------------------------------------------
// Write bundle + report
// ---------------------------------------------------------------------------
fs.writeFileSync(OUT, JSON.stringify(all, null, 2));

const topics = {};
for (const q of all) topics[q.topic] = (topics[q.topic] || 0) + 1;

console.log('Built', path.relative(ROOT, OUT));
console.log(`  source 1 (questions/):        ${s1}`);
console.log(`  source 2 (Śrīmad Bhāgavatam): ${s2}`);
console.log(`  TOTAL:                        ${all.length} questions across ${Object.keys(topics).length} topics`);
