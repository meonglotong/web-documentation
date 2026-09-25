// src/components/UploadBox.tsx
"use client";
import { useRef, useState } from "react";

export function UploadBox() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = (file: File) => {
    const note = window.prompt("Catatan versi (opsional):") ?? "";
    const form = new FormData();
    form.append("file", file);
    if (note) form.append("note", note);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      setMsg(xhr.status === 200 || xhr.status === 201 ? "Tersimpan." : `Gagal: ${JSON.parse(xhr.responseText).error}`);
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.send(form);
  };

  return (
    <div style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 16, marginBottom: 8 }}>
      <input ref={inputRef} type="file" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {progress !== null ? <div style={{ marginTop: 8, height: 8, background: "var(--code-bg)", borderRadius: 4 }}><div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", borderRadius: 4 }} /></div> : null}
      {msg ? <p style={{ color: "var(--muted)", margin: "8px 0 0" }}>{msg}</p> : null}
    </div>
  );
}
