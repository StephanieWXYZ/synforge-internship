import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const SUPPORTED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedFileMetadata(file: { name: string; type: string }) {
  const extension = getFileExtension(file.name);
  return (
    SUPPORTED_FILE_TYPES.has(file.type) ||
    extension === "pdf" ||
    extension === "txt" ||
    extension === "docx"
  );
}

export function isSupportedFile(file: File) {
  return isSupportedFileMetadata(file);
}

export async function parseDocument(buffer: Buffer, fileName: string, fileType: string) {
  const extension = getFileExtension(fileName);

  if (fileType === "text/plain" || extension === "txt") {
    return buffer.toString("utf8");
  }

  if (fileType === "application/pdf" || extension === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value;
  }

  throw new Error("Unsupported file type.");
}
