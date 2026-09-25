// src/app/api/files/[id]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/guards";
import { getFileDetail, deleteFile } from "@/lib/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "login required" : "admin only" },
    { status }
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { id } = await params;
  const detail = await getFileDetail(id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin();
  if ("status" in g) return forbidden(g.status);
  const { id } = await params;
  if (!(await getFileDetail(id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await deleteFile(id);
  return NextResponse.json({ ok: true });
}
