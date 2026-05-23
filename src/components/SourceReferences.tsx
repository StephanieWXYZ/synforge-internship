type SourceReferencesProps = {
  sources: Array<{
    fileName: string;
    chunkIndex: number;
    score?: number;
  }>;
};

export function SourceReferences({ sources }: SourceReferencesProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((source, index) => (
        <span
          key={`${source.fileName}-${source.chunkIndex}-${index}`}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
        >
          {source.fileName}, chunk {source.chunkIndex + 1}
        </span>
      ))}
    </div>
  );
}
