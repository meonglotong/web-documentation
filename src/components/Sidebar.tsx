// src/components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Node { id: string; title: string; slug: string | null; isSection: boolean; children: Node[] }

export function Sidebar({ tree }: { tree: Node[] }) {
  const pathname = usePathname();
  const render = (nodes: Node[], depth: number) => (
    <ul style={{ listStyle: "none", margin: 0, paddingLeft: depth ? 12 : 0 }}>
      {nodes.map((n) => (
        <li key={n.id} style={{ margin: "2px 0" }}>
          {n.isSection ? (
            <span style={{ display: "block", padding: "6px 10px", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{n.title}</span>
          ) : (
            <Link href={`/docs/${n.slug}`} style={{ display: "block", padding: "6px 10px", borderRadius: 6, fontSize: 14, background: pathname === `/docs/${n.slug}` ? "var(--code-bg)" : "transparent", color: pathname === `/docs/${n.slug}` ? "var(--fg)" : "inherit", fontWeight: pathname === `/docs/${n.slug}` ? 600 : 400 }}>{n.title}</Link>
          )}
          {n.children.length > 0 ? render(n.children, depth + 1) : null}
        </li>
      ))}
    </ul>
  );
  return <nav className="docs-sidebar">{render(tree, 0)}</nav>;
}
