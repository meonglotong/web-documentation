// src/app/api/files/[id]/versions/[version]/restore/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { restoreVersion } from "@/lib/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function forbidden(status: 401 | 403) {
  return NextResponse.json(
    { error: status === 401 ? "login required" : "admin only" },
    { status }
  );
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const g = await requireAdmin();
  if ("status" in g) return forbidden(g.status);
  const { id, version } = await params;
  try {
    await restoreVersion(id, Number(version));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "NOT_FOUND") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (code === "VERSION_NOT_FOUND") return NextResponse.json({ error: "versi tidak ada" }, { status: 409 });
    throw e;
  }
}
