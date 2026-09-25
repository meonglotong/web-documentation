// src/components/VersionTable.tsx
"use client";
import { useState } from "react";

interface V { version: number; size: number; sha256: string; note: string | null; uploadedByName: string; createdAt: string }

export function VersionTable({ id, admin, versions, currentVersion }: { id: string; admin: boolean; versions: V[]; currentVersion: number }) {
  const [msg, setMsg] = useState<string | null>(null);
  const act = async (v: number) => {
    const res = await fetch(`/api/files/${id}/versions/${v}/restore`, { method: "POST" });
    setMsg(res.ok ? `Versi ${v} jadi aktif.` : `Gagal: ${JSON.parse(await res.text()).error}`);
    if (res.ok) location.reload();
  };
  const del = async () => {
    if (!confirm("Hapus file ini dan semua versinya?")) return;
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    setMsg(res.ok ? "File terhapus." : "Gagal hapus.");
    if (res.ok) location.href = "/files";
  };
  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}><th style={{ padding: 8 }}>Ver</th><th>Ukuran</th><th>Catatan</th><th>Oleh</th><th>Tanggal</th><th /></tr></thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: 8 }}>v{v.version}{v.version === currentVersion ? " (aktif)" : ""}</td>
              <td>{(v.size / 1024).toFixed(1)} KB</td>
              <td>{v.note ?? "—"}</td>
              <td>{v.uploadedByName}</td>
              <td>{new Date(v.createdAt).toLocaleString()}</td>
              <td style={{ textAlign: "right" }}>
                <a href={`/api/files/${id}/download?version=${v.version}`}>↓</a>
                {admin && v.version !== currentVersion ? <button onClick={() => act(v.version)} style={{ marginLeft: 8 }}>restore</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {admin ? <button onClick={del} style={{ marginTop: 12, color: "#b91c1c", background: "none", border: "1px solid #f3b4b4", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>Hapus file</button> : null}
      {msg ? <p style={{ color: "var(--muted)" }}>{msg}</p> : null}
    </>
  );
}
