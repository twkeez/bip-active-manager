import { JWT, OAuth2Client } from "google-auth-library";
import {
  getGoogleOAuthRefreshConfig,
  getGoogleServiceAccountConfig,
} from "@/lib/env";
import { refineBlocks } from "@/lib/reporting/block-refine";

// Read-only access to Docs (and Drive for export-as-fallback / metadata).
const DOC_SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

export type DocBlockType = "h1" | "h2" | "h3" | "label" | "p" | "bullet";

export type DocBlock = {
  /** Stable id for React keys + edit tracking. */
  id: string;
  type: DocBlockType;
  text: string;
};

export type ParsedGoogleDoc = {
  title: string;
  blocks: DocBlock[];
};

/**
 * Extracts the document id from any of the common Google Docs URL shapes, or
 * accepts a raw id that was pasted directly.
 *   https://docs.google.com/document/d/<ID>/edit
 *   https://docs.google.com/document/u/0/d/<ID>/edit
 *   https://drive.google.com/open?id=<ID>
 */
export function extractDocId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const pathMatch = value.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch) return pathMatch[1];

  const queryMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  // A bare id (no slashes, no scheme) — Google ids are long alphanumerics.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value;

  return null;
}

async function getAccessToken(): Promise<string> {
  let tokenResponse: string | { token?: string | null } | null;

  // Prefer the service account: it requests the Docs/Drive scopes explicitly and
  // is isolated from the shared OAuth refresh token (used by Analytics, Search
  // Console, Ads), which is not guaranteed to carry the Docs scope. Fall back to
  // the OAuth refresh token only when no service account is configured.
  let serviceAccount: { clientEmail: string; privateKey: string } | null = null;
  try {
    serviceAccount = getGoogleServiceAccountConfig();
  } catch {
    serviceAccount = null;
  }

  if (serviceAccount) {
    const auth = new JWT({
      email: serviceAccount.clientEmail,
      key: serviceAccount.privateKey,
      scopes: DOC_SCOPES,
    });
    tokenResponse = await auth.getAccessToken();
  } else {
    const oauthConfig = getGoogleOAuthRefreshConfig();
    if (!oauthConfig) {
      throw new Error(
        "No Google credentials configured for Doc import (need a service account or OAuth refresh token).",
      );
    }
    const oauth = new OAuth2Client(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri,
    );
    oauth.setCredentials({ refresh_token: oauthConfig.refreshToken });
    tokenResponse = await oauth.getAccessToken();
  }

  const token =
    typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token ?? null;
  if (!token) throw new Error("Failed to acquire Google access token.");
  return token;
}

// ── Google Docs API response shapes (only the fields we read) ────────────────

type DocsTextRun = { content?: string };
type DocsParagraphElement = { textRun?: DocsTextRun };
type DocsParagraph = {
  elements?: DocsParagraphElement[];
  paragraphStyle?: { namedStyleType?: string };
  bullet?: { listId?: string };
};
type DocsTableCell = { content?: DocsStructuralElement[] };
type DocsTableRow = { tableCells?: DocsTableCell[] };
type DocsTable = { tableRows?: DocsTableRow[] };
type DocsStructuralElement = {
  paragraph?: DocsParagraph;
  table?: DocsTable;
};
type DocsDocument = {
  title?: string;
  body?: { content?: DocsStructuralElement[] };
};

const HEADING_MAP: Record<string, DocBlockType> = {
  TITLE: "h1",
  SUBTITLE: "h2",
  HEADING_1: "h1",
  HEADING_2: "h2",
  HEADING_3: "h3",
  HEADING_4: "h3",
  HEADING_5: "h3",
  HEADING_6: "h3",
};

function paragraphText(paragraph: DocsParagraph): string {
  return (paragraph.elements ?? [])
    .map((el) => el.textRun?.content ?? "")
    .join("")
    .replace(/\x0b/g, " ") // vertical tab → space
    .replace(/\s+\n/g, "\n")
    .trim();
}

function blockFromParagraph(paragraph: DocsParagraph, index: number): DocBlock | null {
  const text = paragraphText(paragraph);
  if (!text) return null;

  let type: DocBlockType;
  if (paragraph.bullet) {
    type = "bullet";
  } else {
    const named = paragraph.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
    type = HEADING_MAP[named] ?? "p";
  }

  return { id: `b${index}`, type, text };
}

function walkContent(
  content: DocsStructuralElement[],
  blocks: DocBlock[],
  counter: { n: number },
) {
  for (const element of content) {
    if (element.paragraph) {
      const block = blockFromParagraph(element.paragraph, counter.n++);
      if (block) blocks.push(block);
    } else if (element.table?.tableRows) {
      // Flatten table cell text into paragraphs/bullets so nothing is lost.
      for (const row of element.table.tableRows) {
        for (const cell of row.tableCells ?? []) {
          if (cell.content) walkContent(cell.content, blocks, counter);
        }
      }
    }
  }
}

function mapGoogleError(status: number, docId: string, googleMessage: string, reason: string): string {
  if (reason === "SERVICE_DISABLED" || /has not been used in project|is disabled/i.test(googleMessage)) {
    return "The Google Docs API is disabled for this project. Enable it in Google Cloud Console (APIs & Services → Library → Google Docs API → Enable), wait a minute, then retry. Meanwhile you can use the Upload .docx or Paste tabs.";
  }
  if (status === 403) {
    return "Access denied. Share the Google Doc (Viewer) with the app's service account, or use the Upload .docx / Paste tabs instead.";
  }
  if (status === 404) {
    return `No Google Doc found for id "${docId}". Check the link is a Google Doc (not a Sheet, Slide, or PDF) and that it's shared with the service account.`;
  }
  if (status === 401) {
    return "Google authentication failed. The service account or OAuth credentials may need to be reconnected.";
  }
  return googleMessage
    ? `Google Docs API error (${status}): ${googleMessage}`
    : `Google Docs API returned an error (${status}).`;
}

/** Fetches a Google Doc by URL/id and returns an editable block model. */
export async function fetchGoogleDoc(urlOrId: string): Promise<ParsedGoogleDoc> {
  const docId = extractDocId(urlOrId);
  if (!docId) {
    throw new Error(
      "That doesn't look like a Google Doc link. Paste the full URL, e.g. https://docs.google.com/document/d/…/edit",
    );
  }

  const token = await getAccessToken();
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    let googleMessage = "";
    let reason = "";
    try {
      const err = (await res.json()) as {
        error?: { message?: string; details?: Array<{ reason?: string }> };
      };
      googleMessage = err.error?.message ?? "";
      reason = err.error?.details?.find((d) => d.reason)?.reason ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new Error(mapGoogleError(res.status, docId, googleMessage, reason));
  }

  const doc = (await res.json()) as DocsDocument;
  const blocks: DocBlock[] = [];
  walkContent(doc.body?.content ?? [], blocks, { n: 0 });

  if (blocks.length === 0) {
    throw new Error("The Google Doc appears to be empty.");
  }

  return {
    title: doc.title?.trim() || "Untitled document",
    blocks: refineBlocks(blocks),
  };
}
