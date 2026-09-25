// src/app/files/[id]/page.tsx
import { notFound } from "next/navigation";
import { getFileDetail } from "@/lib/files/service";
import { TopBar } from "@/components/TopBar";
import { VersionTable } from "@/components/VersionTable";
import { isInlineExt } from "@/lib/files/limits";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Inline extensions that the browser renders as a raster/vector image.
// Other inline types (pdf, txt, md, html, csv) get an iframe: the browser
// shows text/html and text/plain natively, while <img> would be a broken icon.
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

export default async function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getFileDetail(id);
  if (!detail) notFound();
  const session = await auth();
  const admin = session?.user.role === "admin";
  const preview = isInlineExt(detail.file.ext) ? (IMAGE_EXTS.has(detail.file.ext) ? "image" : "iframe") : null;
  return (
    <div className="docs-shell">
      <TopBar />
      <main className="docs-main" style={{ maxWidth: 900 }}>
        <h1>{detail.file.name}</h1>
        <p style={{ color: "var(--muted)" }}>
          v{detail.file.currentVersion} · {(detail.file.currentSize / 1024).toFixed(1)} KB ·
          <a href={`/api/files/${id}/download`}> Download</a>
        </p>
        {preview === "image" ? (
          <img src={`/api/files/${id}/download`} alt={detail.file.name} style={{ maxWidth: "100%", borderRadius: 8 }} />
        ) : preview === "iframe" ? (
          <iframe src={`/api/files/${id}/download`} style={{ width: "100%", height: 600, border: "1px solid var(--border)", borderRadius: 8 }} title={detail.file.name} />
        ) : null}
        <h2 style={{ marginTop: 32 }}>Riwayat versi</h2>
        <VersionTable id={id} admin={admin} versions={detail.versions} currentVersion={detail.file.currentVersion} />
      </main>
    </div>
  );
}
