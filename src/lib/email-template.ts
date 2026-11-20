const colors = {
  paper: "#f8f5ee",
  sage: "#e4ebdf",
  green: "#36594d",
  deep: "#243f35",
  ink: "#294336",
  muted: "#61705f",
  line: "#d4dfcc",
};
const serif = "'Cormorant Garamond',Georgia,serif";
const sans = "'DM Sans',Arial,sans-serif";

const linkLabels: Readonly<Record<string, string>> = {
  "/verifiera-epost": "Bekräfta e-postadressen",
  "/aterstall-losenord": "Välj nytt lösenord",
  "/bokning/bekraftelse": "Öppna bokningssidan",
  "/anamnes": "Fyll i anamnesen",
  "/bestallning/bekraftelse": "Öppna beställningen",
};
const entities: Readonly<Record<string, string>> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => entities[character]);
}

function emailLink(line: string) {
  if (!/^https?:\/\/\S+$/i.test(line)) return null;
  const url = URL.parse(line);
  if (!url || url.username || url.password) return null;
  if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
  const label = linkLabels[url.pathname]
    ?? (/^\/admin\/bokningar\/\d+$/.test(url.pathname) ? "Visa bokningen i admin" : null)
    ?? (/^\/admin\/bestallningar\/\d+$/.test(url.pathname) ? "Visa beställningen i admin" : null);
  return label ? { href: escapeHtml(url.href), label } : null;
}

export function renderEmailTemplate({ title, text, origin }: { title: string; text: string; origin: string }) {
  let firstAction = true;
  const paragraphs = text.trim().split(/\r?\n(?:\s*\r?\n)+/);
  const body = paragraphs.map(paragraph => {
    const lines = paragraph.split(/\r?\n/);
    const link = emailLink(lines[lines.length - 1]);
    const copy = (link ? lines.slice(0, -1) : lines).map(escapeHtml).join("<br>");
    if (paragraph.startsWith("Tid: ") && !link && lines.length === 1) {
      return `<p style="margin:0 0 20px;padding:12px 16px;background-color:${colors.sage};border-radius:8px"><strong>Tid</strong><br>${escapeHtml(paragraph.slice(5))}</p>`;
    }
    const message = copy ? `<p style="margin:0 0 ${link ? "8" : "18"}px;overflow-wrap:anywhere">${copy}</p>` : "";
    if (!link) return message;
    const style = firstAction
      ? `display:inline-block;background-color:${colors.green};color:${colors.paper};border:1px solid ${colors.green};border-radius:999px;padding:11px 19px;text-decoration:none`
      : `color:${colors.deep};text-decoration:underline`;
    firstAction = false;
    return `${message}<p style="margin:0 0 22px"><a href="${link.href}" style="${style};font-weight:700">${link.label}</a></p>`;
  }).join("\n");
  const site = escapeHtml(origin);
  const heading = escapeHtml(title);

  return `<!doctype html>
<html lang="sv">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${heading}</title>
  <style>@media (max-width:480px) { .email-padding { padding-right:20px !important; padding-left:20px !important; } .email-title { font-size:32px !important; } }</style>
</head>
<body style="margin:0;padding:0;background-color:${colors.paper};color:${colors.ink};font-family:${sans}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${colors.paper}">
    <tr><td align="center" style="padding:24px 12px">
      <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid ${colors.line};border-radius:16px">
        <tr><td class="email-padding" style="padding:20px 36px;background-color:${colors.sage};border-radius:15px 15px 0 0;border-bottom:1px solid ${colors.line}">
          <span style="color:${colors.deep};font-family:${serif};font-size:28px;line-height:1.1">Tibb.nu</span>
        </td></tr>
        <tr><td class="email-padding" style="padding:30px 36px 12px;font-family:${sans};font-size:16px;line-height:1.6">
          <h1 class="email-title" style="margin:0 0 18px;color:${colors.deep};font-family:${serif};font-size:40px;font-weight:500;line-height:1.12;letter-spacing:-0.025em">${heading}</h1>
          ${body}
        </td></tr>
        <tr><td class="email-padding" style="padding:16px 36px;border-top:1px solid ${colors.line};font-family:${sans};font-size:14px;line-height:1.5;color:${colors.muted}">
          <a href="${site}" style="color:${colors.deep};text-decoration:underline">Besök Tibb.nu</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}
