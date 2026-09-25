// src/app/api/upload/route.ts
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { storeUpload } from "@/lib/files/service";
import { MAX_UPLOAD_BYTES } from "@/lib/files/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "login required" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "multipart form expected" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file field required" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "maks 100MB" }, { status: 413 });

  const rawNote = form.get("note");
  const note = typeof rawNote === "string" ? rawNote.slice(0, 500) : null;
  try {
    // File.stream() is a WHATWG ReadableStream; storeUpload consumes Node streams.
    // The DOM and node:stream/web stream types don't overlap structurally, hence the cast.
    const result = await storeUpload({
      filename: file.name,
      note,
      userId: session.user.id,
      stream: Readable.fromWeb(file.stream() as unknown as Parameters<typeof Readable.fromWeb>[0]),
    });
    return NextResponse.json(result, { status: result.isNewFile ? 201 : 200 });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code === "BAD_NAME" ? "nama file kosong" : "gagal simpan" }, { status: code === "BAD_NAME" ? 400 : 500 });
  }
}
