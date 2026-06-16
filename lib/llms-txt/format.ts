import type { CuratedLink, CuratedSection, LlmsTxtCuration, PageSnapshot } from "@/lib/llms-txt/types";

function formatLinkLine(link: CuratedLink): string {
  const desc = link.description.trim();
  return desc
    ? `- [${link.title}](${link.url}): ${desc}`
    : `- [${link.title}](${link.url})`;
}

export function formatLlmsTxt(curation: LlmsTxtCuration): string {
  const lines: string[] = [`# ${curation.h1Title.trim()}`, ""];

  const summary = curation.blockquoteSummary.trim();
  if (summary) {
    lines.push(`> ${summary}`, "");
  }

  const notes = curation.guidanceNotes.trim();
  if (notes) {
    lines.push(notes, "");
  }

  const primarySections = curation.sections.filter((s) => s.name.trim().toLowerCase() !== "optional");
  const optionalSection = curation.sections.find((s) => s.name.trim().toLowerCase() === "optional");

  for (const section of primarySections) {
    if (!section.links.length) continue;
    lines.push(`## ${section.name.trim()}`);
    for (const link of section.links) {
      if (!link.optional) {
        lines.push(formatLinkLine(link));
      }
    }
    lines.push("");
  }

  const optionalLinks: CuratedLink[] = [
    ...(optionalSection?.links ?? []),
    ...primarySections.flatMap((s) => s.links.filter((l) => l.optional)),
  ];

  if (optionalLinks.length) {
    lines.push("## Optional");
    for (const link of optionalLinks) {
      lines.push(formatLinkLine(link));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function collectIndexedUrls(curation: LlmsTxtCuration): string[] {
  const urls = new Set<string>();
  for (const section of curation.sections) {
    for (const link of section.links) {
      urls.add(link.url);
    }
  }
  return [...urls];
}

export function collectFullTextUrls(curation: LlmsTxtCuration): string[] {
  const urls: string[] = [];
  for (const section of curation.sections) {
    if (section.name.trim().toLowerCase() === "optional") continue;
    for (const link of section.links) {
      if (!link.optional) {
        urls.push(link.url);
      }
    }
  }
  return urls;
}

export function formatLlmsFullTxt(
  curation: LlmsTxtCuration,
  pagesByUrl: Map<string, PageSnapshot>,
  maxBytes: number,
): { content: string; urlsIncluded: number; truncated: boolean } {
  const header = formatLlmsTxt(curation).trimEnd();
  const fullUrls = collectFullTextUrls(curation);
  const bodyParts: string[] = [header, "", "# Full page content", ""];

  let truncated = false;
  let urlsIncluded = 0;

  for (const url of fullUrls) {
    const page = pagesByUrl.get(url);
    const title = page?.title?.trim() || url;
    const text = (page?.text ?? page?.fetchError ?? "(Content unavailable)").trim();
    const section = `## ${title}\n\nSource: ${url}\n\n${text}\n\n---\n`;
    const nextSize = Buffer.byteLength([...bodyParts, section].join("\n"), "utf8");
    if (nextSize > maxBytes) {
      truncated = true;
      break;
    }
    bodyParts.push(section);
    urlsIncluded += 1;
  }

  return {
    content: bodyParts.join("\n").trimEnd() + "\n",
    urlsIncluded,
    truncated,
  };
}

export function flattenCurationLinks(sections: CuratedSection[]): CuratedLink[] {
  return sections.flatMap((s) => s.links);
}
