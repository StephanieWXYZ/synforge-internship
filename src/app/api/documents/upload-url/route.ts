import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { prepareDirectDocumentUpload } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = (await request.json()) as {
      chatbotId?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    };

    if (!body.chatbotId || !body.fileName) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.missingUploadFields },
        { status: 400 },
      );
    }

    const upload = await prepareDirectDocumentUpload(user.id, body.chatbotId, {
      fileName: body.fileName,
      fileType: body.fileType ?? "",
      fileSize: Number(body.fileSize),
    });
    return NextResponse.json(upload);
  } catch (error) {
    const authResponse = authenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : DOCUMENT_ERROR_MESSAGES.uploadFailed },
      { status: 400 },
    );
  }
}
