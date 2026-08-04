import { NextResponse } from "next/server";

import { parseDocumentProcessingJob } from "@/lib/documentJob";
import { processQueuedDocument } from "@/lib/documents";
import { verifyWorkerRequest } from "@/lib/workerAuth";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(request: Request) {
  const body = await request.text();
  const authorized = await verifyWorkerRequest(
    body,
    request.headers.get("x-worker-timestamp"),
    request.headers.get("x-worker-signature"),
  );
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized worker request." }, { status: 401 });
  }

  try {
    const job = parseDocumentProcessingJob(body);
    const document = await processQueuedDocument(job.userId, job.chatbotId, job.documentId);
    return NextResponse.json({ document });
  } catch (error) {
    console.error("Queued document processing failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Document processing failed." },
      { status: 500 },
    );
  }
}
