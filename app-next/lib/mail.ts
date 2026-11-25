// Outbound mail. Always writes to the DB (admin inbox) and, on filesystem
// targets, to logs/outbound_mail.log. If ZeptoMail is configured, also sends
// via HTTP API (works on Node and Cloudflare Workers).
import { prisma } from "@/lib/prisma";

const IS_CLOUDFLARE = process.env.DEPLOY_TARGET === "cloudflare";

export type MailCategory =
  | "fighter_signup"
  | "fighter_submitted"
  | "fighter_approved"
  | "fighter_rejected"
  | "fighter_ranked"
  | "gym_enquiry"
  | "gym_onboarding"
  | "gym_submitted"
  | "gym_approved"
  | "gym_join_request"
  | "class_booking"
  | "account_deletion"
  | "account_deletion_ack"
  | "account_closed"
  | "verification_submitted"
  | "verification_verified"
  | "verification_rejected";

export const MAIL_ADMIN = process.env.WUCO_MAIL_ADMIN || "admin@wucoireland.ie";
export const MAIL_INFO = process.env.WUCO_MAIL_INFO || "info@wucoireland.ie";
export const MAIL_FROM = process.env.WUCO_EMAIL_FROM || process.env.WUCO_MAIL_FROM || MAIL_INFO;
export const MAIL_FROM_NAME = process.env.WUCO_EMAIL_FROM_NAME || "WUCO Ireland";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const ZEPTO_URL = process.env.WUCO_EMAIL_API_URL || "https://api.zeptomail.eu/v1.1/email";
const ZEPTO_KEY = process.env.WUCO_ZEPTOMAIL_API_KEY || "";

function zeptoConfigured() {
  return !!ZEPTO_KEY;
}

async function logToFile(entry: Record<string, unknown>) {
  if (IS_CLOUDFLARE) return;
  try {
    const { mkdir, appendFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "logs");
    await mkdir(dir, { recursive: true });
    await appendFile(join(dir, "outbound_mail.log"), JSON.stringify(entry) + "\n", "utf8");
  } catch {
    /* best-effort */
  }
}

async function sendViaZepto(args: {
  to: string;
  from: string;
  fromName: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}) {
  const auth = ZEPTO_KEY.startsWith("Zoho-enczapikey") ? ZEPTO_KEY : `Zoho-enczapikey ${ZEPTO_KEY}`;
  const payload: Record<string, unknown> = {
    from: { address: args.from, name: args.fromName },
    to: [{ email_address: { address: args.to } }],
    subject: args.subject,
    textbody: args.textBody,
  };
  if (args.htmlBody) payload.htmlbody = args.htmlBody;
  const res = await fetch(ZEPTO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: auth,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ZeptoMail ${res.status}: ${text.slice(0, 500)}`);
  }
}

export async function sendMail(args: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  category: MailCategory;
  from?: string;
}) {
  const from = args.from || MAIL_FROM;
  const ts = new Date().toISOString();
  await logToFile({ ts, from, ...args });
  await prisma.outboundMail.create({
    data: {
      toAddress: args.to,
      subject: args.subject,
      body: args.body,
      category: args.category,
    },
  });
  if (zeptoConfigured()) {
    void sendViaZepto({
      to: args.to,
      from,
      fromName: MAIL_FROM_NAME,
      subject: args.subject,
      textBody: args.body,
      htmlBody: args.html,
    }).catch((e) => {
      console.error("[sendMail] ZeptoMail delivery failed:", e);
    });
  }
}

// ---- HTML templates -------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSubmissionHtml(args: {
  name: string;
  division: string;
  disciplines: Array<{
    name: string;
    className: string;
    record: string;
    isPrimary: boolean;
  }>;
}): string {
  const rows = args.disciplines
    .map((d) => {
      const primary = d.isPrimary
        ? `<span style="background:#d4a53a;color:#0a2f23;font-size:9px;letter-spacing:1.5px;padding:2px 6px;border-radius:999px;margin-left:6px;vertical-align:middle;">PRIMARY</span>`
        : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #d4a53a22;color:#fff;font-size:14px;">${esc(d.name)}${primary}<br><span style="color:#cfe3d8;font-size:12px;">${esc(d.className)}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #d4a53a22;color:#fff;font-size:14px;text-align:right;font-family:'Courier New',monospace;letter-spacing:1px;">${esc(d.record)}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b1a14;font-family:Helvetica,Arial,sans-serif;color:#f4f1e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1a14;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a2f23,#0b3d2e,#07251b);border:2px solid #d4a53a66;border-radius:14px;padding:32px;">
      <tr><td align="center">
        <p style="font-size:11px;letter-spacing:4px;color:#d4a53a;margin:0 0 6px;">WORLD UNITED COMBAT ORGANISATION · <em style="font-style:normal;color:#fff;">IRELAND</em></p>
        <h1 style="font-size:24px;letter-spacing:2px;margin:0 0 20px;color:#fff;">APPLICATION RECEIVED</h1>
      </td></tr>
      <tr><td style="color:#cfe3d8;font-size:15px;line-height:1.55;padding:0 8px;">
        <p>Hi ${esc(args.name)},</p>
        <p>Thanks — your W.U.C.O fighter application is in. Here&#39;s what you submitted:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,0.25);border:1px solid #d4a53a33;border-radius:8px;padding:0;margin:14px 0;">
          <tr><td style="padding:12px 16px;">
            <p style="margin:0 0 10px;"><span style="color:#d4a53a;font-size:11px;letter-spacing:2px;">DIVISION</span><br>${esc(args.division)}</p>
            <p style="color:#d4a53a;font-size:11px;letter-spacing:2px;margin:12px 0 4px;">DISCIPLINES &amp; DECLARED RECORD</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </td></tr>
        </table>
        <p>A W.U.C.O admin will review your application and get back to you by email. If anything needs clarifying, reply to this email.</p>
        <p style="margin-top:20px;">— W.U.C.O Ireland</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function buildSupportHtml(args: {
  priority: "low" | "normal" | "high" | "urgent";
  fromName: string;
  fromEmail: string;
  role: string;
  subject: string;
  message: string;
}): string {
  const colours: Record<typeof args.priority, { bg: string; fg: string }> = {
    low: { bg: "#334155", fg: "#cbd5e1" },
    normal: { bg: "#0b3d2e", fg: "#a7f3d0" },
    high: { bg: "#d4a53a", fg: "#1a1a1a" },
    urgent: { bg: "#dc2626", fg: "#ffffff" },
  };
  const c = colours[args.priority];
  const label = args.priority.toUpperCase();
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b1a14;font-family:Helvetica,Arial,sans-serif;color:#f4f1e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1a14;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#0a2f23;border:2px solid #d4a53a66;border-radius:14px;padding:0;overflow:hidden;">
      <tr><td style="background:${c.bg};color:${c.fg};padding:14px 24px;font-size:12px;letter-spacing:4px;">
        <strong>PRIORITY: ${esc(label)}</strong>
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="font-size:11px;letter-spacing:3px;color:#d4a53a;margin:0 0 4px;">WUCO IRELAND · SUPPORT REQUEST</p>
        <h1 style="font-size:20px;letter-spacing:1px;margin:0 0 16px;color:#fff;">${esc(args.subject)}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#cfe3d8;margin-bottom:16px;">
          <tr><td style="padding:4px 0;color:#d4a53a;letter-spacing:2px;font-size:11px;width:90px;">FROM</td><td>${esc(args.fromName)} &lt;${esc(args.fromEmail)}&gt;</td></tr>
          <tr><td style="padding:4px 0;color:#d4a53a;letter-spacing:2px;font-size:11px;">ROLE</td><td>${esc(args.role)}</td></tr>
        </table>
        <div style="background:rgba(0,0,0,.25);border:1px solid #d4a53a33;border-radius:8px;padding:16px;color:#fff;font-size:14px;line-height:1.55;white-space:pre-wrap;">
          ${esc(args.message)}
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

export function buildPassportCardHtml(args: {
  name: string;
  fighterNo: string;
  discipline: string;
  division: string;
  className: string;
  record: string;
  nationality: string;
  club: string;
  ranking: number | null;
  passportUrl: string;
}): string {
  const rankingLabel = args.ranking == null ? "Not yet allotted" : `#${args.ranking}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b1a14;font-family:Helvetica,Arial,sans-serif;color:#f4f1e4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1a14;padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a2f23,#0b3d2e,#07251b);border:2px solid #d4a53a;border-radius:14px;padding:32px;">
      <tr><td align="center">
        <p style="font-size:11px;letter-spacing:4px;color:#d4a53a;margin:0 0 4px;">WORLD UNITED COMBAT ORGANISATION · <em style="font-style:normal;color:#fff;">IRELAND</em></p>
        <h1 style="font-size:22px;letter-spacing:2px;margin:0 0 20px;color:#fff;">DIGITAL FIGHTER <span style="color:#d4a53a;">PASSPORT</span></h1>
      </td></tr>
      <tr><td align="center">
        <div style="display:inline-block;border:2px solid #d4a53a;padding:10px 20px;background:rgba(0,0,0,0.3);margin-bottom:18px;">
          <p style="font-size:10px;letter-spacing:3px;color:#d4a53a;margin:0 0 2px;">WUCO FIGHTER NO</p>
          <p style="font-size:22px;letter-spacing:3px;margin:0;color:#fff;">${esc(args.fighterNo)}</p>
        </div>
      </td></tr>
      <tr><td style="padding:0 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${[
            ["Name", args.name],
            ["Club", args.club || "—"],
            ["Discipline", args.discipline],
            ["Division", args.division],
            ["Class", args.className || "—"],
            ["Record", args.record],
            ["Ranking", rankingLabel],
            ["Nationality", args.nationality || "—"],
            ["Status", "Active"],
          ]
            .map(
              ([label, value]) => `
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #d4a53a33;width:120px;">
              <span style="font-size:11px;letter-spacing:2px;color:#d4a53a;">${esc(String(label).toUpperCase())}</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #d4a53a33;color:#fff;font-size:15px;letter-spacing:1px;">
              ${esc(String(value))}
            </td>
          </tr>`,
            )
            .join("")}
        </table>
      </td></tr>
      <tr><td align="center" style="padding-top:22px;">
        <a href="${esc(args.passportUrl)}" style="display:inline-block;background:#d4a53a;color:#0b1a14;text-decoration:none;font-weight:bold;letter-spacing:2px;font-size:12px;padding:12px 24px;border-radius:999px;">VIEW LIVE PASSPORT →</a>
        <p style="font-size:11px;color:#cfe3d8;margin:14px 0 0;letter-spacing:1px;">Share this link to verify your record and rankings.</p>
      </td></tr>
      <tr><td style="padding-top:22px;border-top:1px solid #d4a53a33;margin-top:16px;color:#cfe3d8;font-size:14px;line-height:1.55;">
        <p>Your fighter application has been approved. Your passport is now live at the link above — bookmark it or save it to your phone.</p>
        ${
          args.ranking == null
            ? `<p><strong style="color:#d4a53a;">Ranking:</strong> not yet allotted. A W.U.C.O admin will review your record and assign your official ranking. You'll get another email as soon as it's updated.</p>`
            : ""
        }
        <p>Welcome to W.U.C.O Ireland.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
