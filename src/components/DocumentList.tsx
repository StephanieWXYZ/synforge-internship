"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";

type DocumentListProps = {
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    _count?: { chunks: number };
  }>;
};

const statusClass: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
};

export function DocumentList({ documents }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const filteredDocuments = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return documents;
    }

    return documents.filter((document) =>
      document.fileName.toLowerCase().includes(normalizedSearchTerm),
    );
  }, [documents, searchTerm]);

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="document-search">
          Search documents
        </label>
        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={17}
            aria-hidden="true"
          />
          <input
            id="document-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by file name..."
            className="min-h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 text-sm"
          />
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          No documents match that file name.
        </div>
      ) : null}

      {filteredDocuments.map((document) => (
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
              <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <div className="flex gap-1">
                  <dt>Type:</dt>
                  <dd>{document.fileType || "unknown"}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Uploaded:</dt>
                  <dd>{document.createdAt.toLocaleDateString()}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Chunks:</dt>
                  <dd>{document._count?.chunks ?? 0}</dd>
                </div>
              </dl>
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
