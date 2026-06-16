import mammoth from "mammoth";
import { MAX_VET_ONBOARDING_DOC_BYTES } from "@/lib/vet-onboarding/form-options";

function normalizeDocumentText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim();
}

export type SupportedDocumentType = "docx" | "txt" | "pdf";

export type DocumentPayload =
  | { kind: "text"; text: string; fileName: string }
  | { kind: "pdf"; base64: string; fileName: string };

export function detectDocumentType(
  fileName: string,
  mimeType: string,
): SupportedDocumentType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }
  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    return "docx";
  }
  if (lower.endsWith(".txt") || mimeType.startsWith("text/")) {
    return "txt";
  }
  return null;
}

async function parseDocxToText(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function readDocumentPayload(file: File): Promise<DocumentPayload> {
  if (file.size > MAX_VET_ONBOARDING_DOC_BYTES) {
    throw new Error("Document must be 4MB or smaller.");
  }

  const docType = detectDocumentType(file.name, file.type || "");
  if (!docType) {
    throw new Error("Upload a .pdf, .docx, or .txt file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (docType === "pdf") {
    return {
      kind: "pdf",
      base64: buffer.toString("base64"),
      fileName: file.name,
    };
  }

  if (docType === "txt") {
    const text = normalizeDocumentText(buffer.toString("utf8"));
    if (!text) throw new Error("Text file appears empty.");
    return { kind: "text", text, fileName: file.name };
  }

  const text = normalizeDocumentText(await parseDocxToText(buffer));
  if (!text) throw new Error("DOCX did not contain readable content.");
  return { kind: "text", text, fileName: file.name };
}

/** @deprecated Use readDocumentPayload */
export async function extractDocumentText(file: File): Promise<string> {
  const payload = await readDocumentPayload(file);
  if (payload.kind === "pdf") {
    throw new Error("PDF files must be processed through the Anthropic document API.");
  }
  return payload.text;
}
