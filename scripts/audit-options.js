#!/usr/bin/env node
/**
 * Per-question option-quality audit.
 *
 * validate-quiz-sets.js answers "will the app grade this correctly?".
 * This answers "is the question actually testing anyone?" — a set can be
 * perfectly valid and still be free marks if the correct option is always the
 * long one, or if the distractors are visibly throwaway.
 *
 * Usage: node scripts/audit-options.js [setIdPrefix] [--list]
 */
const fs = require('fs');
const path = require('path');

const SETS = path.join(__dirname, '..', 'quiz', 'data', 'sets');
const prefix = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
const list = process.argv.includes('--list');

// A distractor matching one of these is doing no work: the reader rejects it
// without knowing the subject.
const THROWAWAY = [
  /^(nothing|none|neither|no |there (is|are) no|it is not|they are not)/i,
  /\b(no|not) (such |any )?(example|distinction|difference|answer|limit|tension|claim|benefit|problem|change|relationship|trade-?offs?|guidance|position|name|comparison|questions?|harms?|advantage)/i,
  /(does not|doesn't|did not|didn't) (address|exist|say|give|discuss|mention|apply|matter)/i,
  /^(both|either) (are|do|use|provide|aim|apply|only|mean|require|suffer|achieve|query|maintain)/i,
  /^the (chapter|book|author) (gives|makes|offers|names|provides|draws|says) no/i,
  /(is|are) (entirely )?(unrelated|irrelevant|meaningless|impossible|forbidden|always wrong)/i,
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const files = fs
  .readdirSync(SETS)
  .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
  .sort();

let totalQ = 0;
const tally = {};
const bump = (k) => (tally[k] = (tally[k] || 0) + 1);
const rows = [];

for (const file of files) {
  const setId = file.replace(/\.json$/, '');
  const qs = JSON.parse(fs.readFileSync(path.join(SETS, file), 'utf8')).questions || [];

  qs.forEach((q, i) => {
    totalQ++;
    const at = `${setId} Q${i + 1}`;
    const flags = [];
    const right = q.options.filter((o) => q.correct.includes(o.key));
    const wrong = q.options.filter((o) => !q.correct.includes(o.key));

    if (!wrong.length) {
      flags.push('no-wrong-option');
    } else {
      const rLen = right.reduce((a, o) => a + o.text.length, 0) / right.length;
      const wLen = wrong.reduce((a, o) => a + o.text.length, 0) / wrong.length;
      const longest = Math.max(...q.options.map((o) => o.text.length));

      // The dominant tell: pick the longest option and you are right. Only meaningful when
      // the options are long enough for the difference to be visible — "Maintainability" vs
      // "Reliability" is a 4-character gap that no reader can use as a cue.
      if (longest >= 45) {
        if (right.every((o) => o.text.length >= longest) && rLen > wLen * 1.3) flags.push('correct-is-longest');
        if (rLen > wLen * 2) flags.push(`length-tell-${(rLen / wLen).toFixed(1)}x`);
      }

      // A negation only counts as throwaway if it is also bare: "Nothing changed" does no
      // work, whereas "None of the columns are hashed, so range scans stay efficient" is a
      // real claim a reader has to evaluate.
      const throwaway = wrong.filter((o) => o.text.length < 70 && THROWAWAY.some((p) => p.test(o.text.trim())));
      if (throwaway.length) flags.push(`throwaway-distractor-x${throwaway.length}`);
      if (throwaway.length === wrong.length) flags.push('all-distractors-throwaway');

      // A distractor that only differs by a negation is guessable from surface form.
      for (const o of wrong) {
        if (right.some((r) => norm(o.text) === norm(r.text).replace(/\bnot \b/g, ''))) flags.push('negation-mirror');
      }
      // Near-duplicate options muddy grading even when the keys are distinct.
      const seen = new Map();
      for (const o of q.options) {
        const n = norm(o.text);
        if (seen.has(n)) flags.push('duplicate-option-text');
        seen.set(n, o.key);
      }
    }

    if (q.correct.length === 1 && q.correct[0] === 'a') bump('answer-authored-first');
    flags.forEach((f) => bump(f.replace(/-[\d.]+x$/, '').replace(/-x\d+$/, '')));
    if (flags.length) rows.push({ at, flags, q: q.question.slice(0, 72) });
  });
}

console.log(`audited ${files.length} set(s), ${totalQ} questions\n`);
const width = Math.max(...Object.keys(tally).map((k) => k.length));
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(width)}  ${String(v).padStart(5)}  ${((100 * v) / totalQ).toFixed(1)}%`);
}
console.log(`\n${rows.length} question(s) flagged (${((100 * rows.length) / totalQ).toFixed(1)}%)`);

if (list) {
  console.log('');
  for (const r of rows) console.log(`${r.at}: ${r.flags.join(', ')}\n    ${r.q}`);
}

// Self-check: the detectors must fire on a known-bad question and stay quiet on a
// known-good one. Run with --selftest.
if (process.argv.includes('--selftest')) {
  const bad = { question: 'x', correct: ['a'], options: [
    { key: 'a', text: 'A'.repeat(300) }, { key: 'b', text: 'Nothing changed' },
    { key: 'c', text: 'There is no such example' }, { key: 'd', text: 'Both are identical' }] };
  const good = { question: 'x', correct: ['b'], options: [
    { key: 'a', text: 'Partitioning splits data across machines so each holds a subset' },
    { key: 'b', text: 'Replication keeps a copy of the same data on several machines' },
    { key: 'c', text: 'Sharding routes each request to the least loaded replica node' },
    { key: 'd', text: 'Caching stores a precomputed view of the data close to readers' }] };
  const run = (q) => {
    const wrong = q.options.filter((o) => !q.correct.includes(o.key));
    const right = q.options.filter((o) => q.correct.includes(o.key));
    const rLen = right.reduce((a, o) => a + o.text.length, 0) / right.length;
    const wLen = wrong.reduce((a, o) => a + o.text.length, 0) / wrong.length;
    return { lengthTell: rLen > wLen * 2, throwaway: wrong.filter((o) => THROWAWAY.some((p) => p.test(o.text.trim()))).length };
  };
  const b = run(bad), g = run(good);
  console.assert(b.lengthTell && b.throwaway === 3, 'detectors should flag the bad question', b);
  console.assert(!g.lengthTell && g.throwaway === 0, 'detectors should pass the good question', g);
  console.log('\nselftest: ok');
}
