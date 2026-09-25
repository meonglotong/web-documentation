// src/app/admin/docs/page.tsx
import { DocsManager } from "@/components/DocsManager";

export default function AdminDocsPage() {
  return (
    <section>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Docs</h1>
      <DocsManager />
    </section>
  );
}
