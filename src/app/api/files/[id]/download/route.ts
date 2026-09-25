// src/app/api/files/[id]/download/route.ts
import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { auth } from "@/lib/auth";
import { getFileForDownload } from "@/lib/files/service";
import { createReadStream } from "@/lib/files/store";
import { isInlineExt } from "@/lib/files/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", txt: "text/plain", md: "text/markdown", html: "text/html", csv: "text/csv" };

// Response body is typed against the DOM ReadableStream; node:stream/web's is
// structurally incompatible, so adapt at this boundary.
function streamBody(absPath: string, opts?: { start?: number; end?: number }): BodyInit {
  return Readable.toWeb(createReadStream(absPath, opts)) as unknown as BodyInit;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "login required" }, { status: 401 });
  const { id } = await params;
  const version = Number(new URL(req.url).searchParams.get("version") ?? "");
  const file = await getFileForDownload(id, Number.isFinite(version) && version > 0 ? version : undefined);
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d*)/);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), file.size - 1) : file.size - 1;
      if (start >= file.size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${file.size}` } });
      return new Response(streamBody(file.storagePath, { start, end }), {
        status: 206,
        headers: {
          "content-type": MIME[file.ext] ?? "application/octet-stream",
          "content-range": `bytes ${start}-${end}/${file.size}`,
          "content-length": String(end - start + 1),
          "accept-ranges": "bytes",
          "content-disposition": `inline; filename="${file.name}"`,
        },
      });
    }
  }
  return new Response(streamBody(file.storagePath), {
    headers: {
      "content-type": MIME[file.ext] ?? "application/octet-stream",
      "content-length": String(file.size),
      "accept-ranges": "bytes",
      "content-disposition": isInlineExt(file.ext) ? `inline; filename="${file.name}"` : `attachment; filename="${file.name}"`,
    },
  });
}
