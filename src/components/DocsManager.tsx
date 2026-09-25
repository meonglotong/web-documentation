// src/components/DocsManager.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { renderMarkdown } from "@/lib/md/render";

type PageRow = { id: string; title: string; slug: string | null; isSection: boolean; position: number; parentId: string | null; bodyMd: string | null };
type EditForm = { title: string; isSection: boolean; bodyMd: string };
type AddForm = { title: string; parentId: string; isSection: boolean; bodyMd: string };
const EMPTY_ADD: AddForm = { title: "", parentId: "", isSection: false, bodyMd: "" };

export function DocsManager() {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditForm>({ title: "", isSection: false, bodyMd: "" });
  const [preview, setPreview] = useState<string | null>(null);
  const [add, setAdd] = useState<AddForm>(EMPTY_ADD);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/pages");
    if (res.ok) setPages(await res.json());
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const patch = (id: string, body: Record<string, unknown>, failMsg: string) => {
    void (async () => {
      const res = await fetch(`/api/admin/pages/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setMsg(`${failMsg}: ${json.error}`); return; }
      location.reload();
    })();
  };

  const startEdit = (p: PageRow) => {
    setEditingId(p.id);
    setEdit({ title: p.title, isSection: p.isSection, bodyMd: p.bodyMd ?? "" });
    setPreview(null);
  };

  const remove = (id: string) => {
    void (async () => {
      const res = await fetch(`/api/admin/pages/${id}`, { method: "DELETE" });
      if (res.status === 409) { setMsg("cannot delete: page has children"); return; }
      if (!res.ok) { const json = await res.json(); setMsg(`delete failed: ${json.error}`); return; }
      location.reload();
    })();
  };

  const saveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      const res = await fetch("/api/admin/pages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: add.title, isSection: add.isSection, bodyMd: add.isSection ? null : add.bodyMd, parentId: add.parentId || null, position: 0 }),
      });
      const json = await res.json();
      if (!res.ok) { setMsg(`add failed: ${json.error}`); return; }
      location.reload();
    })();
  };

  const parentOptions = (
    <>
      <option value="">(root)</option>
      {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
    </>
  );

  return (
    <div>
      {msg ? <p style={{ color: "var(--muted)", marginBottom: 8 }}>{msg}</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th>Title</th><th>Parent</th><th>Position</th><th></th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => editingId === p.id ? (
            <tr key={p.id}>
              <td colSpan={4}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }}>
                  <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="title" />
                  <label><input type="checkbox" checked={edit.isSection} onChange={(e) => setEdit({ ...edit, isSection: e.target.checked })} /> section</label>
                  <textarea rows={6} value={edit.bodyMd} onChange={(e) => setEdit({ ...edit, bodyMd: e.target.value })} placeholder="body markdown" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPreview(edit.isSection ? "" : renderMarkdown(edit.bodyMd).html)}>preview</button>
                    <button onClick={() => patch(p.id, { title: edit.title, isSection: edit.isSection, bodyMd: edit.isSection ? null : edit.bodyMd }, "save failed")}>save</button>
                    <button onClick={() => { setEditingId(null); setPreview(null); }}>cancel</button>
                  </div>
                  {preview != null ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: preview }} /> : null}
                </div>
              </td>
            </tr>
          ) : (
            <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td>{p.title}{p.isSection ? " (section)" : ""}</td>
              <td>
                <select value={p.parentId ?? ""} onChange={(e) => patch(p.id, { parentId: e.target.value || null }, "move failed")}>
                  {parentOptions}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  defaultValue={p.position}
                  style={{ width: 64 }}
                  onBlur={(e) => { if (Number(e.target.value) !== p.position) patch(p.id, { position: Number(e.target.value) }, "move failed"); }}
                />
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button onClick={() => startEdit(p)}>edit</button>{" "}
                <button onClick={() => remove(p.id)}>delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={saveAdd} style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Add page:</span>
        <input placeholder="title" value={add.title} onChange={(e) => setAdd({ ...add, title: e.target.value })} />
        <select value={add.parentId} onChange={(e) => setAdd({ ...add, parentId: e.target.value })}>{parentOptions}</select>
        <label><input type="checkbox" checked={add.isSection} onChange={(e) => setAdd({ ...add, isSection: e.target.checked })} /> section</label>
        <textarea rows={2} style={{ width: 240 }} placeholder="body markdown" value={add.bodyMd} onChange={(e) => setAdd({ ...add, bodyMd: e.target.value })} />
        <button>add</button>
      </form>
    </div>
  );
}
