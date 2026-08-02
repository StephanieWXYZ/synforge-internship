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
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      setUploadStatus("idle");
      return;
    }

    const metadata = {
      chatbotId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };

    async function readError(response: Response) {
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as { error?: string };
        return data.error;
      }
      return response.text();
    }

    try {
      const uploadRequest = await fetch("/api/documents/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(metadata),
      });

      if (!uploadRequest.ok) {
        throw new Error((await readError(uploadRequest)) || "Upload failed. Please try again.");
      }

      const upload = (await uploadRequest.json()) as
        | { directUpload: false }
        | { directUpload: true; uploadUrl: string; filePath: string };

      let response: Response;
      if (upload.directUpload) {
        const s3Response = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!s3Response.ok) {
          throw new Error("Could not upload the file to document storage.");
        }

        setUploadStatus("processing");
        response = await fetch("/api/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...metadata, filePath: upload.filePath }),
        });
      } else {
        const formData = new FormData();
        formData.set("chatbotId", chatbotId);
        formData.set("file", file);
        setUploadStatus("processing");
        response = await fetch("/api/documents", { method: "POST", body: formData });
      }

      if (!response.ok) {
        throw new Error((await readError(response)) || "Upload failed. Please try again.");
      }

      form.reset();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload failed. Please try again.");
    } finally {
      setUploadStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
      <label className="block text-sm font-medium text-slate-700" htmlFor="file">
        Upload PDF, TXT, or DOCX
      </label>
      <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          disabled={isUploading}
          className="min-h-11 min-w-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
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
