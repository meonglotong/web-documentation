// src/components/Toc.tsx
"use client";
import Link from "next/link";
interface TocItem { level: 2 | 3; text: string; id: string }
export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;
  return (
    <details className="toc-box" open>
      <summary style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>On this page</summary>
      <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
        {items.map((t) => (
          <li key={t.id} style={{ paddingLeft: t.level === 3 ? 16 : 0 }}>
            <a href={`#${t.id}`} style={{ fontSize: 13, color: "var(--muted)" }}>{t.text}</a>
          </li>
        ))}
      </ul>
    </details>
  );
}
