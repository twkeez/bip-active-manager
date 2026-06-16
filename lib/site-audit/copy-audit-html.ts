import {
  buildDocumentBrandedHtml,
  buildDocumentPlainText,
} from "@/lib/site-audit/document-brand-html";
import type { SiteAuditDocumentDraft } from "@/lib/site-audit/document-draft";

export async function copyDocumentToClipboard(draft: SiteAuditDocumentDraft): Promise<void> {
  const html = buildDocumentBrandedHtml(draft);
  const plain = buildDocumentPlainText(draft);
  await writeRichClipboard(html, plain);
}

async function writeRichClipboard(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const item = new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    return;
  }

  await navigator.clipboard.writeText(plain);
}
