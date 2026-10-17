#!/usr/bin/env node
/**
 * Per-question option-quality audit.
 *
 * validate-quiz-sets.js answers "will the app grade this correctly?".
 * This answers "is the question actually testing anyone?" — a set can be
 * perfectly valid and still be free marks if the correct option is always the
 * long one, or if the distractors are visibly throwaway.
 *
 * Usage: node scripts/audit-options.js [setIdPrefix] [--list] [--selftest]
 * Exits non-zero if any question is flagged (or the self-test fails).
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

// A question must be self-contained: a reader who knows the subject should be able to answer
// it without having the book open, and it is shuffled in among others so it cannot lean on its
// neighbours. Any appeal to the source ("the chapter says", "Figure 3-6", "six in the figure"),
// to an unseen example, or to another question tests recall of the text, not understanding.
// Checked in every field the learner sees: stem, every option, explanation, every rationale —
// the branching-factor question survived earlier passes because only stems were checked.
const CONTEXT_PATTERNS = [
  ['source-reference', /\bchapters?\b|\bthe book\b|\bthe author\b|\bthe (text|passage|quote)\b|\bSummary\b|epigraph|footnote|boxed note|sidebar|who said it|\bKleppmann\b|\bDDIA\b/i],
  ['missing-figure', /\b(figures?|tables?|listings?|examples?)\s*\d+(-\d+)?\b|\b(in|from|of) the (figure|diagram|illustration|chart)\b|\bthe (figure|diagram|illustration)\b|\bas shown\b|\b(shown|depicted|pictured|illustrated) (above|below|earlier)\b|\bon page \d/i],
  ['neighbor-dependency', /\b(previous|next|preceding|prior|last|earlier|above|following) (question|scenario|example|case|setup|answer)\b|\bthe same (scenario|example|setup) as\b|\bas (before|above)\b/i],
  ['unseen-example', /\b(this|the) (worked |running |earlier |book's |chapter's )?example\b(?! (of|is|where|in which|that|:))|\bthe example's\b/i],
];
// A stem that opens on a demonstrative has nothing for "this"/"these" to point at.
const DANGLING_STEM = /^(this|these|that|those|both|such|it|they|here)\b(?! (is|are) (a|an|the|why|how))/i;
// A stem that quotes the book at length is testing recognition of a sentence.
const QUOTED_PASSAGE = /['"“‘][A-Z][^'"”’]{30,}['"”’]/;
// Rationales are shown against shuffled, relabelled options, so authored letters mean nothing.
const LETTER_REFERENCE = /\b(options?|choices?|answers?) \(?[a-dA-D]\)?(?=[\s,.;:)]|$)|\([a-d]\)/;

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);
const jaccard = (a, b) => {
  const x = new Set(words(a)), y = new Set(words(b));
  const inter = [...x].filter((w) => y.has(w)).length;
  return inter / (new Set([...x, ...y]).size || 1);
};
// Shape heuristics: worth a human look, but permutation-style ordering questions and
// name-vs-mechanism options can be legitimate, so these are listed without failing the run.
const ADVISORY = new Set(['near-duplicate-options', 'uneven-option-form', 'correct-strictly-longest']);
// Per set, "pick the longest option" should not beat chance (25% with four options) by much.
const MAX_LONGEST_SHARE = 0.35;
// ...nor fall far below it: "never pick the longest" is just as exploitable.
const MIN_LONGEST_SHARE = 0.15;
const fieldsOf = (q) => [
  ['question', q.question],
  ...q.options.map((o) => [`options.${o.key}`, o.text]),
  ['explanation', q.explanation || ''],
  ...Object.entries(q.optionExplanations || {}).map(([k, v]) => [`optionExplanations.${k}`, String(v)]),
];

// Every structural/contextual defect for one question, as {flag, field, match}.
function inspect(q) {
  const hits = [];
  const hit = (flag, field, match = '') => hits.push({ flag, field, match });
  for (const [field, text] of fieldsOf(q)) {
    for (const [flag, re] of CONTEXT_PATTERNS) {
      const m = text.match(re);
      if (m) hit(flag, field, m[0]);
    }
    if (field.startsWith('optionExplanations') && LETTER_REFERENCE.test(text)) hit('letter-reference', field, text.match(LETTER_REFERENCE)[0]);
  }
  const ds = q.question.match(DANGLING_STEM);
  if (ds) hit('dangling-stem', 'question', ds[0]);
  const qp = q.question.match(QUOTED_PASSAGE);
  if (qp) hit('quoted-passage', 'question', qp[0].slice(0, 40));
  if (!q.explanation || q.explanation.trim().length < 40) hit('weak-explanation', 'explanation', (q.explanation || '').slice(0, 40));

  const keys = q.options.map((o) => o.key);
  const reasons = q.optionExplanations;
  if (q.correct.length > 1 && !reasons) hit('missing-option-explanations', 'optionExplanations');
  if (reasons) {
    const rk = Object.keys(reasons);
    if (rk.length !== keys.length || !keys.every((k) => rk.includes(k))) hit('option-explanation-keys-mismatch', 'optionExplanations', rk.join(','));
    for (const o of q.options) {
      const r = String(reasons[o.key] || '').trim();
      if (r.length < 50) hit('short-option-explanation', `optionExplanations.${o.key}`, r.slice(0, 40));
      else if (norm(r) === norm(o.text) || (words(o.text).length >= 6 && norm(r).startsWith(norm(o.text)))) hit('rationale-restates-option', `optionExplanations.${o.key}`, r.slice(0, 40));
    }
  }

  // Near-duplicate options muddy grading even when the keys are distinct.
  for (let i = 0; i < q.options.length; i++)
    for (let j = i + 1; j < q.options.length; j++)
      if (jaccard(q.options[i].text, q.options[j].text) >= 0.8 && words(q.options[i].text).length > 3)
        hit('near-duplicate-options', `options.${q.options[i].key}/${q.options[j].key}`);

  // Options answering different kinds of question show up as wildly different shapes:
  // a two-word product name next to a sentence-long mechanism.
  const wc = q.options.map((o) => words(o.text).length);
  if (Math.max(...wc) >= 10 && Math.max(...wc) >= 4 * Math.min(...wc)) hit('uneven-option-form', 'options', wc.join('/'));
  return hits;
}



const files = fs
  .readdirSync(SETS)
  .filter((f) => f.endsWith('.json') && f.startsWith(prefix))
  .sort();

let totalQ = 0;
const tally = {};
const bump = (k) => (tally[k] = (tally[k] || 0) + 1);
const rows = [];
const setLongest = {};
const setSingles = {};
const setRanks = {};
// Fixing "key is longest" by trimming keys just moves the key to second-longest. No length rank
// should hold the key much more often than chance (25% each with four options).
const MAX_RANK_SHARE = 0.38;

for (const file of files) {
  const setId = file.replace(/\.json$/, '');
  const qs = JSON.parse(fs.readFileSync(path.join(SETS, file), 'utf8')).questions || [];

  qs.forEach((q, i) => {
    totalQ++;
    const at = `${setId} Q${i + 1}`;
    const flags = [];
    const right = q.options.filter((o) => q.correct.includes(o.key));
    if (q.correct.length === 1 && Math.max(...q.options.map((o) => o.text.length)) >= 45) setSingles[setId] = (setSingles[setId] || 0) + 1;
    const wrong = q.options.filter((o) => !q.correct.includes(o.key));

    const where = [];
    for (const h of inspect(q)) {
      flags.push(h.flag);
      where.push(`[${h.field}] ${h.flag}${h.match ? `: "${h.match}"` : ''}`);
    }

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
        // A small margin on one question is noise; the same small margin on most questions is a tell.
        if (right.length === 1 && q.options.length === 4) {
          const rank = q.options.filter((o) => o.text.length > right[0].text.length).length;
          (setRanks[setId] = setRanks[setId] || [0, 0, 0, 0])[rank]++;
        }
        if (right.length === 1 && wrong.every((o) => o.text.length < right[0].text.length)) {
          flags.push('correct-strictly-longest');
          setLongest[setId] = (setLongest[setId] || 0) + 1;
        }
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
    if (flags.length) rows.push({ at, flags: [...new Set(flags)], where, q: q.question.slice(0, 72) });
  });
}

console.log(`audited ${files.length} set(s), ${totalQ} questions\n`);
const width = Math.max(...Object.keys(tally).map((k) => k.length));
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(width)}  ${String(v).padStart(5)}  ${((100 * v) / totalQ).toFixed(1)}%`);
}
console.log(`\n${rows.length} question(s) flagged (${((100 * rows.length) / totalQ).toFixed(1)}%)`);

const longestShare = (k) => (setLongest[k] || 0) / setSingles[k];
const tellSets = [];
// Only meaningful with enough questions for the share to be stable.
for (const k of Object.keys(setSingles))
  if (setSingles[k] >= 20 && (longestShare(k) > MAX_LONGEST_SHARE || longestShare(k) < MIN_LONGEST_SHARE)) {
    tellSets.push(k);
    console.log(`  ${k}: correct option is strictly longest in ${setLongest[k] || 0}/${setSingles[k]} single-answer questions (allowed ${MIN_LONGEST_SHARE * 100}-${MAX_LONGEST_SHARE * 100}%)`);
  }
for (const [k, r] of Object.entries(setRanks)) {
  const n = r.reduce((a, b) => a + b, 0);
  if (n >= 50 && Math.max(...r) / n > MAX_RANK_SHARE) {
    tellSets.push(k);
    console.log(`  ${k}: correct option's length rank (longest→shortest) is ${r.map((x) => `${Math.round((100 * x) / n)}%`).join('/')}; no rank may exceed ${MAX_RANK_SHARE * 100}%`);
  }
}

if (list) {
  console.log('');
  for (const r of rows) console.log(`${r.at}: ${r.flags.join(', ')}\n    ${r.q}${r.where.map((w) => `\n      ${w}`).join('')}`);
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
  const assert = (ok, msg, detail) => { if (!ok) { console.error('selftest FAILED:', msg, detail || ''); process.exit(1); } };
  assert(b.lengthTell && b.throwaway === 3, 'detectors should flag the bad question', b);
  assert(!g.lengthTell && g.throwaway === 0, 'detectors should pass the good question', g);
  assert(inspect({ ...good, explanation: 'Replication keeps copies so a node failure loses nothing.' }).length === 0, 'good question should have no context hits', inspect(good));
  // The question that survived every earlier pass: its defect lived only in the options.
  const branching = { question: 'Define branching factor, and give its typical value in practice.', correct: ['a'],
    explanation: 'In practice it depends on the space required to store page references and range boundaries.',
    options: [{ key: 'a', text: 'Child page references per page; six in the figure; typically several hundred' },
      { key: 'b', text: 'The number of levels in the tree; two in the figure; typically four' }] };
  const bh = inspect(branching);
  assert(bh.some((h) => h.flag === 'missing-figure' && h.field === 'options.a'), 'must catch figure reference inside an option', bh);
  const multi = { question: 'Which hold?', correct: ['a', 'b'], explanation: 'Both a and b describe replication correctly here.',
    options: [{ key: 'a', text: 'x one two three' }, { key: 'b', text: 'y four five six' }, { key: 'c', text: 'z seven eight nine' }],
    optionExplanations: { a: 'Correct.', b: 'See option C, which is the opposite of this one and therefore wrong.' } };
  const mh = inspect(multi).map((h) => h.flag);
  assert(mh.includes('option-explanation-keys-mismatch') && mh.includes('short-option-explanation') && mh.includes('letter-reference'), 'rationale checks', mh);
  assert(inspect({ ...multi, optionExplanations: undefined }).some((h) => h.flag === 'missing-option-explanations'), 'missing rationale check');
  assert(inspect({ ...good, question: 'As in the previous question, what happens?' }).some((h) => h.flag === 'neighbor-dependency'), 'neighbor check');
  console.log('\nselftest: ok');
}

if (tellSets.length || rows.some((r) => r.flags.some((f) => !ADVISORY.has(f)))) process.exitCode = 1;
