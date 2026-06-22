// Client-side helper that rasterises a DOM element into a multi-page, brand-safe
// A4 PDF. Page breaks are chosen at whitespace rows so text is never cut mid-line.
// Tailwind v4 emits oklch() colours that html2canvas can't parse, so we inject a
// hex override stylesheet into the cloned document before capture.

/** Finds page-cut rows that fall in whitespace rather than through text. */
function findSmartPageCuts(
  canvas: HTMLCanvasElement,
  pageHeightPx: number,
): Array<{ start: number; end: number }> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [{ start: 0, end: canvas.height }];

  const slices: Array<{ start: number; end: number }> = [];
  let start = 0;

  while (start < canvas.height) {
    const nominalEnd = Math.min(start + pageHeightPx, canvas.height);
    if (nominalEnd === canvas.height) {
      slices.push({ start, end: canvas.height });
      break;
    }

    const searchHeight = Math.max(1, Math.floor(pageHeightPx * 0.15));
    const searchFrom = nominalEnd - searchHeight;
    const region = ctx.getImageData(0, searchFrom, canvas.width, searchHeight);
    const w4 = canvas.width * 4;

    let cutAt = nominalEnd;
    for (let row = searchHeight - 1; row >= 0; row--) {
      let isWhite = true;
      const rowBase = row * w4;
      for (let px = 0; px < w4; px += 4) {
        const i = rowBase + px;
        if (region.data[i] < 245 || region.data[i + 1] < 245 || region.data[i + 2] < 245) {
          isWhite = false;
          break;
        }
      }
      if (isWhite) {
        cutAt = searchFrom + row;
        break;
      }
    }

    slices.push({ start, end: cutAt });
    start = cutAt;
  }

  return slices;
}

const OKLCH_OVERRIDE = `
  :root {
    --color-white:#fff; --color-black:#000;
    --color-gray-50:#f9fafb; --color-gray-100:#f3f4f6; --color-gray-200:#e5e7eb;
    --color-gray-300:#d1d5db; --color-gray-400:#9ca3af; --color-gray-500:#6b7280;
    --color-gray-600:#4b5563; --color-gray-700:#374151; --color-gray-800:#1f2937;
    --color-gray-900:#111827;
    --color-slate-50:#f8fafc; --color-slate-100:#f1f5f9; --color-slate-200:#e2e8f0;
    --color-slate-300:#cbd5e1; --color-slate-400:#94a3b8; --color-slate-500:#64748b;
    --color-slate-600:#475569; --color-slate-700:#334155; --color-slate-800:#1e293b;
    --color-slate-900:#0f172a;
    --color-red-300:#fca5a5; --color-red-400:#f87171; --color-red-500:#ef4444;
    --color-red-600:#dc2626; --color-red-700:#b91c1c;
    --color-amber-400:#fbbf24; --color-amber-500:#f59e0b; --color-amber-600:#d97706;
    --color-green-500:#22c55e; --color-green-600:#16a34a;
    --color-emerald-500:#10b981; --color-emerald-600:#059669;
    --color-cyan-600:#0891b2; --color-cyan-700:#0e7490;
    --color-blue-500:#3b82f6; --color-blue-600:#2563eb;
    --color-purple-500:#a855f7; --color-purple-600:#9333ea;
    --color-pink-500:#ec4899; --color-pink-600:#db2777;
  }
`;

async function saveBlob(blob: Blob, fileName: string) {
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (o: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "PDF Document", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (pickerErr: unknown) {
      // User cancelled — fall through to auto-download. Re-throw real errors? No:
      // any picker failure falls back to a plain download below.
      if ((pickerErr as { name?: string }).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Captures `element` and downloads it as a brand-styled A4 PDF named `fileName`.
 * Elements with the `no-print` class are excluded from the capture.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (el) => el.classList.contains("no-print"),
    onclone: (clonedDoc) => {
      const s = clonedDoc.createElement("style");
      s.textContent = OKLCH_OVERRIDE;
      clonedDoc.head.appendChild(s);
    },
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const pxPerMm = canvas.width / pageW;
  const pageHeightPx = Math.floor(pageH * pxPerMm);
  const cuts = findSmartPageCuts(canvas, pageHeightPx);

  let firstPage = true;
  for (const { start, end } of cuts) {
    if (!firstPage) pdf.addPage();
    firstPage = false;

    const sliceH = end - start;
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = sliceH;
    const ctx2d = sliceCanvas.getContext("2d")!;
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, canvas.width, sliceH);
    ctx2d.drawImage(canvas, 0, start, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHeightMm = sliceH / pxPerMm;
    pdf.addImage(sliceData, "JPEG", 0, 0, pageW, sliceHeightMm);
  }

  await saveBlob(pdf.output("blob"), fileName);
}
