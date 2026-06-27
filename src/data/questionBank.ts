// Question bank loader — the full question set is bundled as a static JSON
// asset and fetched once, then cached in memory. This keeps quiz generation
// fully client-side (no server round-trip) and trivially scalable.
import { Question, TopicsMap } from '../lib/types';

let cache: Question[] | null = null;
let inflight: Promise<Question[]> | null = null;

/** Load (and memoize) the bundled question bank. */
export async function loadQuestions(): Promise<Question[]> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const base = process.env.PUBLIC_URL || '';
      const res = await fetch(`${base}/questions-data.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Question[];
      cache = data;
      return data;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[questionBank] failed to load:', err);
      cache = [];
      return cache;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** A Map keyed by question id, for O(1) lookups during answer submission. */
export async function loadQuestionMap(): Promise<Map<string, Question>> {
  const list = await loadQuestions();
  return new Map(list.map((q) => [q.id, q]));
}

/** Derive the topic → subtopics map from the question bank. */
export async function loadTopics(): Promise<TopicsMap> {
  const list = await loadQuestions();
  const map: TopicsMap = {};
  for (const q of list) {
    if (!map[q.topic]) map[q.topic] = [];
    if (q.subtopic && !map[q.topic].includes(q.subtopic)) {
      map[q.topic].push(q.subtopic);
    }
  }
  for (const t of Object.keys(map)) map[t].sort();
  return map;
}
