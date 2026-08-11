import { NextResponse } from "next/server";

import { authenticationErrorResponse, requireApiUser } from "@/lib/auth";
import { deleteDocument, reprocessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

export const runtime = "nodejs";

type DocumentRouteContext = {
  params: Promise<{ id: string }>;
};

function getChatbotId(request: Request) {
  return new URL(request.url).searchParams.get("chatbotId") ?? "";
}

function getSafeReprocessError(error: unknown) {
  if (!(error instanceof Error)) {
    return DOCUMENT_ERROR_MESSAGES.reprocessFailed;
  }

  if (
    error.message === DOCUMENT_ERROR_MESSAGES.documentNotFound ||
    error.message === DOCUMENT_ERROR_MESSAGES.reprocessOnlyFailed
  ) {
    return error.message;
  }

  return DOCUMENT_ERROR_MESSAGES.reprocessFailed;
}

export async function DELETE(request: Request, { params }: DocumentRouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const chatbotId = getChatbotId(request);

    if (!chatbotId) {
      return NextResponse.json({ error: "chatbotId is required." }, { status: 400 });
    }

    await deleteDocument(user.id, chatbotId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : DOCUMENT_ERROR_MESSAGES.deleteFailed },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, { params }: DocumentRouteContext) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const chatbotId = getChatbotId(request);

    if (!chatbotId) {
      return NextResponse.json({ error: "chatbotId is required." }, { status: 400 });
    }

    const document = await reprocessDocument(user.id, chatbotId, id);
    return NextResponse.json({ document });
  } catch (error) {
    const authResponse = authenticationErrorResponse(error);
    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      { error: getSafeReprocessError(error) },
      { status: 400 },
    );
  }
}
