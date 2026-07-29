"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

type FileUploaderProps = {
  chatbotId: string;
};

export function FileUploader({ chatbotId }: FileUploaderProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing">("idle");

  const isUploading = uploadStatus !== "idle";
  const buttonLabel =
    uploadStatus === "uploading"
      ? "Uploading..."
      : uploadStatus === "processing"
        ? "Processing document..."
        : "Upload";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) {
      return;
    }

    const form = event.currentTarget;
    setError("");
    setUploadStatus("uploading");
    const processingTimer = window.setTimeout(() => {
      setUploadStatus("processing");
    }, 500);

    const formData = new FormData(form);
    formData.set("chatbotId", chatbotId);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Upload failed. Please try again.");
      } else {
        form.reset();
        router.refresh();
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      window.clearTimeout(processingTimer);
      setUploadStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
      <label className="block text-sm font-medium text-slate-700" htmlFor="file">
        Upload PDF, TXT, or DOCX
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          disabled={isUploading}
          className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          <Upload size={18} aria-hidden="true" />
          {buttonLabel}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </form>
  );
}
