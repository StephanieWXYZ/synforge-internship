import type { SourceReference } from "@/lib/rag";

type SourceReferencesProps = {
  sources: SourceReference[];
};

function formatScore(score?: number) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }

  return score.toFixed(2);
}

export function SourceReferences({ sources }: SourceReferencesProps) {
  if (sources.length === 0) {
    return (
      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-500">No source references saved for this response.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold uppercase text-slate-500">
        Source references ({sources.length})
      </p>
      {sources.map((source) => (
        <details
          key={source.chunkId}
          className="group rounded-md border border-slate-200 bg-white text-xs text-slate-600"
        >
          <summary className="flex cursor-pointer list-none flex-col gap-2 px-3 py-2 font-medium sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0">
              <span className="block truncate text-slate-700 sm:inline">{source.fileName}</span>{" "}
              <span className="text-slate-500">chunk {source.chunkIndex + 1}</span>
              {formatScore(source.score) ? (
                <>
                  {" "}
                  <span className="text-slate-500">
                    retrieval score {formatScore(source.score)}
                  </span>
                </>
              ) : null}
            </span>
            <span className="shrink-0 text-blue-700">
              <span className="group-open:hidden">Show preview</span>
              <span className="hidden group-open:inline">Hide preview</span>
            </span>
          </summary>
          <div className="border-t border-slate-100 px-3 py-2">
            {source.preview ? (
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words leading-5 text-slate-500">
                {source.preview}
              </p>
            ) : (
              <p className="leading-5 text-slate-500">No preview saved for this source.</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
