import { NextResponse } from "next/server";

import { saveAndProcessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const chatbotId = String(formData.get("chatbotId") ?? "");
    const file = formData.get("file");

    if (!chatbotId || !(file instanceof File)) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.missingUploadFields },
        { status: 400 },
      );
    }

    const document = await saveAndProcessDocument(chatbotId, file);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : DOCUMENT_ERROR_MESSAGES.uploadFailed },
      { status: 400 },
    );
  }
}
