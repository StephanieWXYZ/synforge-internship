export const DOCUMENT_ERROR_MESSAGES = {
  missingUploadFields: "chatbotId and file are required.",
  unsupportedFileType: "Unsupported file type. Upload a PDF, TXT, or DOCX file.",
  fileTooLarge: "File is too large. The MVP limit is 10 MB.",
  fileSizeMismatch: "The uploaded file size did not match the upload request.",
  chatbotNotFound: "Chatbot not found.",
  noReadableText: "No readable text was found in the document.",
  documentNotFound: "Document not found.",
  reprocessOnlyFailed: "Only failed documents can be reprocessed.",
  uploadFailed: "Upload failed.",
  deleteFailed: "Delete failed.",
  reprocessFailed: "Reprocess failed.",
} as const;
