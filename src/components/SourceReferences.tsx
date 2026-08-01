type SourceReferencesProps = {
  sources: Array<{
    fileName: string;
    chunkIndex: number;
    preview?: string;
    score?: number;
  }>;
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
        <p className="text-xs text-slate-500">No source references for this response.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold uppercase text-slate-500">Sources</p>
      {sources.map((source, index) => (
        <details
          key={`${source.fileName}-${source.chunkIndex}-${index}`}
          className="break-words rounded-md border border-slate-200 bg-white text-xs text-slate-600"
        >
          <summary className="cursor-pointer list-none px-3 py-2 font-medium">
            <span className="mr-2">{source.fileName}</span>{" "}
            <span className="text-slate-500">chunk {source.chunkIndex + 1}</span>
            {formatScore(source.score) ? (
              <>
                {" "}
                <span className="ml-2 text-slate-500">score {formatScore(source.score)}</span>
              </>
            ) : null}
          </summary>
          {source.preview ? (
            <p className="border-t border-slate-100 px-3 py-2 leading-5 text-slate-500">
              {source.preview}
            </p>
          ) : (
            <p className="border-t border-slate-100 px-3 py-2 leading-5 text-slate-500">
              No preview saved for this source.
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
