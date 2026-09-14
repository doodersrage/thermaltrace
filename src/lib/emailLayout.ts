import { resolveSiteUrl } from "./schemaMarkup";

export type EmailCta = {
  label: string;
  url: string;
};

export type EmailCalloutTone = "success" | "alert" | "brand" | "muted";

export type EmailStat = {
  label: string;
  value: string;
  detail?: string;
};

export type EmailSection =
  | { type: "callout"; tone?: EmailCalloutTone; title: string; body: string }
  | { type: "heading"; text: string }
  | { type: "stats"; items: EmailStat[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "note"; text: string };

export type BrandedEmailContent = {
  /** Inbox preview text (hidden in body). */
  preheader?: string;
  /** Small label above the title (e.g. Welcome, Alerts). */
  eyebrow?: string;
  title: string;
  /** Lead paragraph under the title. */
  intro?: string;
  paragraphs?: string[];
  /** Structured blocks (callouts, stats, tables) rendered before bullets. */
  sections?: EmailSection[];
  bullets?: string[];
  cta?: EmailCta;
  secondaryCta?: EmailCta;
  footerNote?: string;
  /** Visual tone for the accent bar / CTA. */
  tone?: "brand" | "alert" | "success";
};

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const COLORS = {
  bg: "#090b0f",
  card: "#151b24",
  border: "#2a3441",
  text: "#f8fafc",
  muted: "#94a3b8",
  steel: "#c5cbd3",
  brand: "#e85500",
  brandSoft: "#ff9e4a",
  alert: "#f87171",
  success: "#22c55e",
} as const;

export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accentForTone(tone: BrandedEmailContent["tone"]): string {
  if (tone === "alert") return COLORS.alert;
  if (tone === "success") return COLORS.success;
  return COLORS.brand;
}

function calloutColors(tone: EmailCalloutTone): {
  bg: string;
  border: string;
  title: string;
} {
  if (tone === "success") {
    return { bg: "#10241a", border: "#166534", title: COLORS.success };
  }
  if (tone === "alert") {
    return { bg: "#2a1416", border: "#7f1d1d", title: COLORS.alert };
  }
  if (tone === "muted") {
    return { bg: "#10151d", border: COLORS.border, title: COLORS.muted };
  }
  return { bg: "#24180f", border: "#9a3412", title: COLORS.brandSoft };
}

function emailSectionToText(section: EmailSection): string[] {
  if (section.type === "callout") {
    return [section.title, section.body];
  }
  if (section.type === "heading") {
    return [section.text];
  }
  if (section.type === "stats") {
    return section.items.map((item) =>
      item.detail ? `${item.label}: ${item.value} (${item.detail})` : `${item.label}: ${item.value}`,
    );
  }
  if (section.type === "table") {
    return section.rows.map((row) =>
      section.headers.map((header, index) => `${header}: ${row[index] ?? ""}`).join(" · "),
    );
  }
  return [section.text];
}

function renderStatCell(item: EmailStat): string {
  const detail = item.detail
    ? `<p style="margin:4px 0 0;color:${COLORS.muted};font-size:12px;line-height:1.4">${escapeEmailHtml(item.detail)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#10151d;border:1px solid ${COLORS.border};border-radius:12px">
    <tr>
      <td style="padding:12px 14px">
        <p style="margin:0;color:${COLORS.muted};font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase">${escapeEmailHtml(item.label)}</p>
        <p style="margin:6px 0 0;color:${COLORS.text};font-size:20px;font-weight:700;letter-spacing:-0.02em;line-height:1.2">${escapeEmailHtml(item.value)}</p>
        ${detail}
      </td>
    </tr>
  </table>`;
}

function renderEmailSection(section: EmailSection): string {
  if (section.type === "callout") {
    const colors = calloutColors(section.tone ?? "brand");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
      <tr>
        <td style="background:${colors.bg};border:1px solid ${colors.border};border-radius:12px;padding:14px 16px">
          <p style="margin:0;color:${colors.title};font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase">${escapeEmailHtml(section.title)}</p>
          <p style="margin:6px 0 0;color:${COLORS.text};font-size:16px;line-height:1.5;font-weight:600">${escapeEmailHtml(section.body)}</p>
        </td>
      </tr>
    </table>`;
  }

  if (section.type === "heading") {
    return `<p style="margin:22px 0 10px;color:${COLORS.text};font-size:12px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase">${escapeEmailHtml(section.text)}</p>`;
  }

  if (section.type === "stats") {
    const rows: string[] = [];
    for (let i = 0; i < section.items.length; i += 2) {
      const left = section.items[i];
      const right = section.items[i + 1];
      rows.push(`<tr>
        <td width="50%" valign="top" style="padding:0 6px 12px 0">${renderStatCell(left)}</td>
        <td width="50%" valign="top" style="padding:0 0 12px 6px">${right ? renderStatCell(right) : ""}</td>
      </tr>`);
    }
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">${rows.join("")}</table>`;
  }

  if (section.type === "table") {
    const head = section.headers
      .map(
        (header) =>
          `<th align="left" style="padding:8px 10px;color:${COLORS.muted};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;border-bottom:1px solid ${COLORS.border}">${escapeEmailHtml(header)}</th>`,
      )
      .join("");
    const body = section.rows
      .map(
        (row, rowIndex) =>
          `<tr>${section.headers
            .map((_, index) => {
              const value = row[index] ?? "";
              const border = rowIndex === 0 ? "" : `border-top:1px solid ${COLORS.border};`;
              return `<td style="padding:9px 10px;color:${COLORS.steel};font-size:13px;line-height:1.4;${border}">${escapeEmailHtml(value)}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#10151d;border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden">
      <tr style="background:#121821">${head}</tr>
      ${body}
    </table>`;
  }

  return `<p style="margin:16px 0 20px;color:${COLORS.muted};font-size:14px;line-height:1.55">${linkifyPlainUrls(section.text)}</p>`;
}

function renderEmailSections(sections: EmailSection[] | undefined): string {
  if (!sections?.length) return "";
  return sections.map(renderEmailSection).join("");
}

function linkifyPlainUrls(text: string): string {
  return escapeEmailHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#ff9e4a;text-decoration:underline">$1</a>',
  );
}

export function buildBrandedEmailText(content: BrandedEmailContent): string {
  const lines: string[] = [];
  lines.push(content.title);
  lines.push("");
  if (content.intro) {
    lines.push(content.intro);
    lines.push("");
  }
  for (const paragraph of content.paragraphs ?? []) {
    lines.push(paragraph);
    lines.push("");
  }
  for (const section of content.sections ?? []) {
    lines.push(...emailSectionToText(section));
    lines.push("");
  }
  for (const bullet of content.bullets ?? []) {
    const trimmed = bullet.trimStart();
    lines.push(/^[✓○•\-]/.test(trimmed) ? bullet : `• ${bullet}`);
  }
  if (content.bullets?.length) lines.push("");
  if (content.cta) {
    lines.push(`${content.cta.label}: ${content.cta.url}`);
    lines.push("");
  }
  if (content.secondaryCta) {
    lines.push(`${content.secondaryCta.label}: ${content.secondaryCta.url}`);
    lines.push("");
  }
  lines.push(content.footerNote ?? "ThermalTrace — live probe curves, freeze and flood/leak alerts, and history.");
  const siteUrl = resolveSiteUrl(null);
  lines.push(`${siteUrl}/dashboard`);
  return lines.join("\n").trim() + "\n";
}

export function buildBrandedEmailHtml(content: BrandedEmailContent): string {
  const siteUrl = resolveSiteUrl(null);
  const accent = accentForTone(content.tone ?? "brand");
  const preheader = content.preheader ?? content.intro ?? content.title;
  const paragraphs = (content.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;color:${COLORS.steel};font-size:16px;line-height:1.6">${linkifyPlainUrls(p)}</p>`,
    )
    .join("");
  const bullets =
    content.bullets && content.bullets.length > 0
      ? `<ul style="margin:0 0 20px;padding:0;list-style:none;color:${COLORS.steel};font-size:16px;line-height:1.55">${content.bullets
          .map((item) => {
            const trimmed = item.trimStart();
            const alreadyMarked = /^[✓○•\-]/.test(trimmed);
            const body = alreadyMarked ? linkifyPlainUrls(item) : `• ${linkifyPlainUrls(item)}`;
            return `<li style="margin:0 0 10px;padding:0">${body}</li>`;
          })
          .join("")}</ul>`
      : "";

  const ctaHtml = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px">
        <tr>
          <td style="border-radius:10px;background:${accent}">
            <a href="${escapeEmailHtml(content.cta.url)}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em">${escapeEmailHtml(content.cta.label)}</a>
          </td>
        </tr>
      </table>`
    : "";

  const secondaryHtml = content.secondaryCta
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.5"><a href="${escapeEmailHtml(content.secondaryCta.url)}" style="color:${COLORS.brandSoft};text-decoration:underline">${escapeEmailHtml(content.secondaryCta.label)}</a></p>`
    : "";

  const eyebrow = content.eyebrow
    ? `<p style="margin:0 0 10px;color:${accent};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${escapeEmailHtml(content.eyebrow)}</p>`
    : "";

  const intro = content.intro
    ? `<p style="margin:0 0 18px;color:${COLORS.text};font-size:17px;line-height:1.55;font-weight:500">${linkifyPlainUrls(content.intro).replace(/\n/g, "<br />")}</p>`
    : "";

  const footerNote = escapeEmailHtml(
    content.footerNote ??
      "You’re receiving this because you have a ThermalTrace account. Manage email preferences in Dashboard → Alerts.",
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeEmailHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};color:${COLORS.text};font-family:${FONT}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeEmailHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:28px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;font-family:${FONT}">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, ${COLORS.brandSoft}, ${COLORS.brand});font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px">
              <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.2">
                <span style="color:${COLORS.steel}">Thermal</span><span style="color:${COLORS.brand}">Trace</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 32px">
              ${eyebrow}
              <h1 style="margin:0 0 14px;color:${COLORS.text};font-size:24px;line-height:1.25;font-weight:700">${escapeEmailHtml(content.title)}</h1>
              ${intro}
              ${paragraphs}
              ${renderEmailSections(content.sections)}
              ${bullets}
              ${ctaHtml}
              ${secondaryHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${COLORS.border};background:#10151d">
              <p style="margin:0 0 8px;color:${COLORS.muted};font-size:12px;line-height:1.55">${footerNote}</p>
              <p style="margin:0;font-size:12px;line-height:1.5">
                <a href="${escapeEmailHtml(siteUrl)}/dashboard" style="color:${COLORS.brandSoft};text-decoration:none">Dashboard</a>
                <span style="color:${COLORS.border}"> · </span>
                <a href="${escapeEmailHtml(siteUrl)}/dashboard/alerts" style="color:${COLORS.brandSoft};text-decoration:none">Alert settings</a>
                <span style="color:${COLORS.border}"> · </span>
                <a href="${escapeEmailHtml(siteUrl)}/about" style="color:${COLORS.brandSoft};text-decoration:none">Guides</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:${COLORS.muted};font-size:11px;line-height:1.4">© ThermalTrace · ${escapeEmailHtml(siteUrl.replace(/^https?:\/\//, ""))}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function brandedEmailParts(content: BrandedEmailContent): {
  text: string;
  html: string;
} {
  return {
    text: buildBrandedEmailText(content),
    html: buildBrandedEmailHtml(content),
  };
}
