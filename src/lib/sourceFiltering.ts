export const MIN_RELEVANT_CHUNK_SCORE = 0.25;

type ScoredSource = {
  score: number;
};

export function filterRelevantSources<TSource extends ScoredSource>(
  sources: TSource[],
  minScore = MIN_RELEVANT_CHUNK_SCORE,
) {
  return sources.filter((source) => source.score >= minScore);
}
