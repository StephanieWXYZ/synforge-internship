import { FileText } from "lucide-react";

type DocumentListProps = {
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    createdAt: Date;
  }>;
};

const statusClass: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
};

export function DocumentList({ documents }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <FileText size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">{document.fileName}</p>
              <p className="text-xs text-slate-500">
                {document.fileType || "unknown"} · {document.createdAt.toLocaleDateString()}
              </p>
            </div>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass[document.status]}`}
          >
            {document.status}
          </span>
        </div>
      ))}
    </div>
  );
}
