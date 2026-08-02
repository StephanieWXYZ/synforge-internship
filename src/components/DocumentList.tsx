"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { canReprocessDocument } from "@/lib/documentStatus";

type DocumentListProps = {
  chatbotId: string;
  documents: Array<{
    id: string;
    fileName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: { chunks: number };
  }>;
};

const statusClass: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  queued: "bg-blue-100 text-blue-800",
  processing: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
};

const statusLabel: Record<string, string> = {
  uploaded: "Processing document...",
  queued: "Queued for processing...",
  processing: "Processing document...",
  ready: "Ready",
  failed: "Processing failed",
};

export function DocumentList({ chatbotId, documents }: DocumentListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    documentId: string;
    action: "delete" | "reprocess";
  } | null>(null);
  const hasActiveProcessingDocument = documents.some(
    (document) =>
      ["uploaded", "queued", "processing"].includes(document.status) &&
      !canReprocessDocument(document.status, document.updatedAt ?? document.createdAt),
  );

  useEffect(() => {
    if (!hasActiveProcessingDocument) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      router.refresh();
    }, 2000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [hasActiveProcessingDocument, router]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    if (!normalizedSearchTerm) {
      return documents;
    }

    return documents.filter((document) =>
      document.fileName.toLowerCase().includes(normalizedSearchTerm),
    );
  }, [documents, searchTerm]);

  async function deleteUploadedDocument(documentId: string, fileName: string) {
    const shouldDelete = window.confirm(`Delete "${fileName}" and its chunks?`);
    if (!shouldDelete) {
      return;
    }

    setActionError("");
    setPendingAction({ documentId, action: "delete" });

    const response = await fetch(
      `/api/documents/${documentId}?chatbotId=${encodeURIComponent(chatbotId)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setActionError(data.error ?? "Delete failed.");
    } else {
      router.refresh();
    }

    setPendingAction(null);
  }

  async function reprocessUploadedDocument(documentId: string) {
    setActionError("");
    setPendingAction({ documentId, action: "reprocess" });

    const response = await fetch(
      `/api/documents/${documentId}?chatbotId=${encodeURIComponent(chatbotId)}`,
      { method: "PATCH" },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setActionError(data.error ?? "Reprocess failed.");
    } else {
      router.refresh();
    }

    setPendingAction(null);
  }

  if (documents.length === 0) {
    return (
      <div className="min-w-0 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        <h2 className="font-semibold text-slate-950">No documents uploaded yet</h2>
        <p className="mx-auto mt-2 max-w-sm leading-6">
          Upload a PDF, TXT, or DOCX file to make this chatbot answer from your documents.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
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

      {actionError ? (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}

      {filteredDocuments.map((document) => {
        const canReprocess = canReprocessDocument(
          document.status,
          document.updatedAt ?? document.createdAt,
        );
        const displayStatus =
          canReprocess && ["uploaded", "queued", "processing"].includes(document.status)
            ? "Processing stalled"
            : (statusLabel[document.status] ?? document.status);

        return (
        <div
          key={document.id}
          className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-md bg-slate-100 p-2 text-slate-600">
              <FileText size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate break-all font-medium text-slate-950">{document.fileName}</p>
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
          <div className="flex items-center gap-2">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusClass[document.status]}`}
            >
              {displayStatus}
            </span>
            {canReprocess ? (
              <button
                type="button"
                onClick={() => reprocessUploadedDocument(document.id)}
                disabled={pendingAction !== null}
                className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                aria-label={`Reprocess ${document.fileName}`}
                title="Reprocess document"
              >
                <RefreshCw
                  size={16}
                  aria-hidden="true"
                  className={
                    pendingAction?.documentId === document.id &&
                    pendingAction.action === "reprocess"
                      ? "animate-spin"
                      : undefined
                  }
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => deleteUploadedDocument(document.id, document.fileName)}
              disabled={pendingAction !== null}
              className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-rose-300 hover:text-rose-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              aria-label={`Delete ${document.fileName}`}
              title="Delete document"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
