// src/app/api/files/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listFiles } from "@/lib/files/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "login required" }, { status: 401 });
  return NextResponse.json(await listFiles(100, 0));
}
