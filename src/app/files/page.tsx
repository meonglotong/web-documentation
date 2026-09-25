// src/app/files/page.tsx
import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { UploadBox } from "@/components/UploadBox";
import { listFiles } from "@/lib/files/service";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const { items } = await listFiles(200, 0);
  return (
    <div className="docs-shell">
      <TopBar />
      <main className="docs-main" style={{ maxWidth: 900 }}>
        <h1>Files</h1>
        <UploadBox />
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Nama</th><th>Ukuran</th><th>Ver</th><th>Updated</th><th>Oleh</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: 8 }}><Link href={`/files/${f.id}`}>{f.name}</Link></td>
                <td>{(f.currentSize / 1024).toFixed(0)} KB</td>
                <td>v{f.currentVersion}</td>
                <td>{new Date(f.updatedAt).toLocaleDateString()}</td>
                <td>{f.uploadedByName}</td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={5} style={{ padding: 16, color: "var(--muted)" }}>Belum ada file.</td></tr> : null}
          </tbody>
        </table>
      </main>
    </div>
  );
}
