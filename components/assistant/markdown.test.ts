import { describe, expect, it } from "vitest";
import { parseBlocks } from "./markdown";

describe("parseBlocks", () => {
  it("splits headings, lists and paragraphs the way the assistant writes them", () => {
    const blocks = parseBlocks(`# Tuesday 16 September

## Suggested focus
1. **Bowman ads** — spent nothing
2. MarketPlace account

Some closing thought
that wraps.`);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "heading", "list", "paragraph"]);
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: true });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toEqual({ kind: "paragraph", text: "Some closing thought that wraps." });
  });

  it("nests indented bullets under their parent list", () => {
    const blocks = parseBlocks(`- *Stale* — close these
  - Twin Blades
  - Carla Matias`);
    expect(blocks).toHaveLength(1);
    const items = (blocks[0] as { items: Array<{ depth: number }> }).items;
    expect(items.map((i) => i.depth)).toEqual([0, 1, 1]);
  });

  // Quoted email text is data; the renderer never hands it to the browser as HTML.
  it("keeps markup-looking text as plain text", () => {
    const blocks = parseBlocks(`<img src=x onerror=alert(1)> from a client email`);
    expect(blocks).toEqual([{ kind: "paragraph", text: "<img src=x onerror=alert(1)> from a client email" }]);
  });
});
