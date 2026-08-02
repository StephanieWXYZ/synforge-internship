export const STALE_PROCESSING_AFTER_MS = 20 * 60 * 1000;

export function canReprocessDocument(
  status: string,
  statusUpdatedAt: Date | string,
  now = Date.now(),
) {
  if (status === "failed") {
    return true;
  }

  if (status !== "processing" && status !== "uploaded" && status !== "queued") {
    return false;
  }

  return now - new Date(statusUpdatedAt).getTime() >= STALE_PROCESSING_AFTER_MS;
}
