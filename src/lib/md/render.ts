import { Marked } from "marked";
import type { Tokens } from "marked";
import { slugify } from "./slugify";
import { calloutExtension } from "./callouts";

export interface TocItem { level: 2 | 3; text: string; id: string }

const marked = new Marked({ gfm: true, breaks: false });

// Base id from the heading text; "" (empty heading) falls back to "section".
function headingBase(text: string): string {
  return slugify(text) || "section";
}

// GitHub-style dedup: first occurrence keeps the base, later ones get -2, -3…
// Each caller passes its own counter, so the TOC pass and the renderer pass
// both compute the identical id sequence without sharing mutable state.
function dedupedId(base: string, counts: Map<string, number>): string {
  const n = counts.get(base) ?? 0;
  counts.set(base, n + 1);
  return n === 0 ? base : `${base}-${n + 1}`;
}

// Module-level counter, advanced by the heading renderer exactly once per
// renderMarkdown() call (reset below).
const renderedCounts = new Map<string, number>();

marked.use(calloutExtension);

// marked v16 has no getRenderer(); heading ids are injected through a
// renderer override that feeds the same counter the TOC pass mirrors.
marked.use({
  renderer: {
    heading(token: Tokens.Heading): string {
      const id = dedupedId(headingBase(token.text), renderedCounts);
      const html = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${id}">${html}</h${token.depth}>\n`;
    },
  },
});

export function renderMarkdown(md: string): { html: string; toc: TocItem[] } {
  renderedCounts.clear();
  const toc: TocItem[] = [];
  const tocCounts = new Map<string, number>();
  // Mirror the renderer's id assignment (every heading consumes a counter
  // slot) so TOC ids always match the emitted heading ids.
  for (const token of marked.lexer(md)) {
    if (token.type !== "heading") continue;
    const id = dedupedId(headingBase(token.text), tocCounts);
    if (token.depth === 2 || token.depth === 3) {
      toc.push({ level: token.depth as 2 | 3, text: token.text, id });
    }
  }
  return { html: marked.parse(md, { async: false }) as string, toc };
}

export function markedWithCallouts(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
