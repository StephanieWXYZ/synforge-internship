import { NextResponse } from "next/server";

import { deleteDocument, reprocessDocument } from "@/lib/documents";
import { DOCUMENT_ERROR_MESSAGES } from "@/lib/documentErrors";

export const runtime = "nodejs";

type DocumentRouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, { params }: DocumentRouteContext) {
  try {
    const { id } = await params;
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : DOCUMENT_ERROR_MESSAGES.deleteFailed },
      { status: 400 },
    );
  }
}

export async function PATCH(_request: Request, { params }: DocumentRouteContext) {
  try {
    const { id } = await params;
    const document = await reprocessDocument(id);
    return NextResponse.json({ document });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : DOCUMENT_ERROR_MESSAGES.reprocessFailed },
      { status: 400 },
    );
  }
}
