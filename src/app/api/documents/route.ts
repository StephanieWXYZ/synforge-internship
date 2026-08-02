import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { processDirectDocumentUpload, saveAndProcessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json()) as {
        chatbotId?: string;
        fileName?: string;
        fileType?: string;
        fileSize?: number;
        filePath?: string;
      };

      if (!body.chatbotId || !body.fileName || !body.filePath) {
        return NextResponse.json(
          { error: DOCUMENT_ERROR_MESSAGES.missingUploadFields },
          { status: 400 },
        );
      }

      const document = await processDirectDocumentUpload(
        user.id,
        body.chatbotId,
        {
          fileName: body.fileName,
          fileType: body.fileType ?? "",
          fileSize: Number(body.fileSize),
        },
        body.filePath,
      );
      return NextResponse.json({ document }, { status: 201 });
    }

    const formData = await request.formData();
    const chatbotId = String(formData.get("chatbotId") ?? "");
    const file = formData.get("file");

    if (!chatbotId || !(file instanceof File)) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.missingUploadFields },
        { status: 400 },
      );
    }

    const document = await saveAndProcessDocument(user.id, chatbotId, file);
    return NextResponse.json({ document }, { status: 201 });
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
