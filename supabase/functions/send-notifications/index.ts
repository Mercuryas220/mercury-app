// =====================================================================
// Mercury Operations Platform — send-notifications
// Sends queued client emails. Driven by pg_cron (02_schedule.sql).
//
//   supabase functions deploy send-notifications
//   supabase secrets set RESEND_API_KEY=... MAIL_FROM=... APP_URL=... ACTIONS_URL=...
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const MAIL_FROM = Deno.env.get("MAIL_FROM")!;
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const ACTIONS_URL = (Deno.env.get("ACTIONS_URL") ?? "").replace(/\/$/, "");

// Supabase is retiring service_role during 2026 in favour of secret keys.
// Both are injected into the function environment during the changeover,
// so read the new one when it exists and fall back to the old one.
function secretKey(): string {
  try {
    const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (keys) {
      const parsed = JSON.parse(keys);
      if (parsed?.default) return parsed.default;
    }
  } catch { /* fall through */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  secretKey(),
  { auth: { persistSession: false } },
);

type Row = {
  email_id: number;
  kind: "instant" | "digest" | "verify";
  email: string;
  contact_name: string | null;
  contact_id: string;
  unsubscribe_token: string;
  verify_token: string;
  client_name: string | null;
  brand_color: string | null;
  notif_kind: string | null;
  title: string | null;
  body: string | null;
  link_page: string | null;
  occurred_at: string;
};

// Mercury palette. The email body stays light — dark-background email
// renders unpredictably across Outlook and print — with the platform's
// navy in the header bar and the client's own brand colour on the button.
const INK = "#0a0e16";
const RULE = "#e3e8ef";
const MUTED = "#5b6c85";
const TEXT = "#111a28";

const ICONS: Record<string, string> = {
  quote: "Quote",
  request: "Work request",
  job: "Schedule",
  document: "Document",
  report: "Report",
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );
}

function link(page: string | null) {
  if (!APP_URL) return "";
  return page ? `${APP_URL}?page=${encodeURIComponent(page)}` : APP_URL;
}

function ukTime(iso: string, withDate = true) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: withDate ? "medium" : undefined,
    timeStyle: "short",
    timeZone: "Europe/London",
  });
}

function shell(inner: string, unsubUrl: string, preheader: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${RULE};border-radius:14px;overflow:hidden;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
  <tr><td style="background:${INK};padding:16px 24px;">
    <span style="color:#ffffff;font-size:14px;font-weight:600;">Mercury</span>
    <span style="color:#8497b0;font-size:14px;"> Operations Platform</span>
  </td></tr>
  <tr><td style="padding:28px 24px 24px;font-size:15px;line-height:1.55;">${inner}</td></tr>
  <tr><td style="padding:16px 24px 22px;border-top:1px solid ${RULE};color:${MUTED};font-size:12px;line-height:1.5;">
    Sent because this address is listed for programme updates on your Mercury dashboard.<br>
    <a href="${esc(unsubUrl)}" style="color:${MUTED};">Stop these emails</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function button(url: string, label: string, colour: string) {
  if (!url) return "";
  return `<p style="margin:24px 0 4px;"><a href="${esc(url)}" style="display:inline-block;background:${esc(colour)};color:${INK};text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:700;">${esc(label)}</a></p>`;
}

function buildVerify(r: Row) {
  const url = `${ACTIONS_URL}/verify?token=${r.verify_token}`;
  const first = (r.contact_name ?? "").split(" ")[0] || "there";
  const brand = r.brand_color || "#22c55e";
  return {
    subject: "Confirm your Mercury programme updates",
    html: shell(
      `<p style="margin:0 0 14px;">Hello ${esc(first)},</p>
       <p style="margin:0 0 14px;">This address has been added to programme updates for
        <strong>${esc(r.client_name || "your account")}</strong> on the Mercury dashboard.</p>
       <p style="margin:0;">Confirm it and you'll be told as work progresses on site.</p>
       ${button(url, "Confirm this address", brand)}
       <p style="margin:18px 0 0;color:${MUTED};font-size:13px;">Not expecting this? Ignore it — nothing is sent until you confirm.</p>`,
      `${ACTIONS_URL}/unsubscribe?token=${r.unsubscribe_token}`,
      "Confirm your address to receive programme updates.",
    ),
    text: `Hello ${first},

This address has been added to programme updates for ${r.client_name || "your account"} on the Mercury dashboard.

Confirm it here: ${url}

Not expecting this? Ignore it — nothing is sent until you confirm.`,
  };
}

function buildInstant(r: Row) {
  const url = link(r.link_page);
  const brand = r.brand_color || "#22c55e";
  const tag = ICONS[r.notif_kind ?? ""] ?? "Update";
  return {
    subject: r.title ?? "Mercury programme update",
    html: shell(
      `<p style="margin:0 0 10px;color:${MUTED};font-size:13px;">${esc(tag)} · ${esc(ukTime(r.occurred_at))}</p>
       <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;font-weight:650;">${esc(r.title)}</h1>
       ${r.body ? `<p style="margin:0;">${esc(r.body)}</p>` : ""}
       ${button(url, "Open the dashboard", brand)}`,
      `${ACTIONS_URL}/unsubscribe?token=${r.unsubscribe_token}`,
      r.body ?? r.title ?? "",
    ),
    text: `${r.title}\n${tag} · ${ukTime(r.occurred_at)}\n\n${r.body ?? ""}\n\n${url}`,
  };
}

function buildDigest(rows: Row[]) {
  const head = rows[0];
  const brand = head.brand_color || "#22c55e";
  const day = new Date().toLocaleDateString("en-GB", {
    dateStyle: "full",
    timeZone: "Europe/London",
  });
  const items = rows.map((r) => `
    <tr><td style="padding:13px 0;border-top:1px solid ${RULE};">
      <div style="font-size:12px;color:${MUTED};">${esc(ICONS[r.notif_kind ?? ""] ?? "Update")} · ${esc(ukTime(r.occurred_at, false))}</div>
      <div style="font-weight:650;">${esc(r.title)}</div>
      ${r.body ? `<div style="color:${MUTED};font-size:14px;">${esc(r.body)}</div>` : ""}
    </td></tr>`).join("");

  return {
    subject: `Mercury daily summary — ${rows.length} update${rows.length === 1 ? "" : "s"}`,
    html: shell(
      `<p style="margin:0 0 4px;color:${MUTED};font-size:13px;">${esc(day)}</p>
       <h1 style="margin:0 0 4px;font-size:20px;line-height:1.3;font-weight:650;">Your daily summary</h1>
       <p style="margin:0 0 8px;color:${MUTED};font-size:14px;">${rows.length} update${rows.length === 1 ? "" : "s"} across your programme.</p>
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
       ${button(link(null), "Open the dashboard", brand)}`,
      `${ACTIONS_URL}/unsubscribe?token=${head.unsubscribe_token}`,
      `${rows.length} updates across your programme.`,
    ),
    text: `Your daily summary — ${day}\n\n` +
      rows.map((r) => `• ${r.title}${r.body ? `\n  ${r.body}` : ""}`).join("\n") +
      (APP_URL ? `\n\n${APP_URL}` : ""),
  };
}

// The only place that talks to the email provider. Swapping Resend for
// Postmark or SendGrid means changing this function and nothing else.
async function sendEmail(o: {
  to: string; subject: string; html: string; text: string; unsubUrl: string;
}): Promise<string> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [o.to],
      subject: o.subject,
      html: o.html,
      text: o.text,
      headers: {
        "List-Unsubscribe": `<${o.unsubUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body?.id ?? "";
}

async function markSent(ids: number[], providerId: string) {
  if (!ids.length) return;
  await db.from("notification_emails")
    .update({ status: "sent", sent_at: new Date().toISOString(), provider_id: providerId })
    .in("id", ids);
}

async function markFailed(ids: number[], message: string) {
  if (!ids.length) return;
  const { data } = await db.from("notification_emails").select("id, attempts").in("id", ids);
  for (const row of data ?? []) {
    await db.from("notification_emails").update({
      status: (row.attempts ?? 0) >= 5 ? "failed" : "pending",
      last_error: message.slice(0, 500),
    }).eq("id", row.id);
  }
}

Deno.serve(async (req) => {
  let mode = "instant";
  try {
    const b = await req.json();
    if (b?.mode === "digest") mode = "digest";
  } catch {
    if (new URL(req.url).searchParams.get("mode") === "digest") mode = "digest";
  }

  const { data, error } = await db.rpc("claim_notification_emails", {
    p_kinds: mode === "digest" ? ["digest"] : ["instant", "verify"],
    p_limit: mode === "digest" ? 400 : 60,
  });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const rows = (data ?? []) as Row[];
  let sent = 0, failed = 0;

  if (mode === "digest") {
    const byContact = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byContact.get(r.contact_id) ?? [];
      list.push(r);
      byContact.set(r.contact_id, list);
    }
    for (const group of byContact.values()) {
      const ids = group.map((g) => g.email_id);
      try {
        const id = await sendEmail({
          to: group[0].email,
          ...buildDigest(group),
          unsubUrl: `${ACTIONS_URL}/unsubscribe?token=${group[0].unsubscribe_token}`,
        });
        await markSent(ids, id);
        sent += ids.length;
      } catch (e) {
        await markFailed(ids, String(e));
        failed += ids.length;
      }
    }
  } else {
    for (const r of rows) {
      try {
        const id = await sendEmail({
          to: r.email,
          ...(r.kind === "verify" ? buildVerify(r) : buildInstant(r)),
          unsubUrl: `${ACTIONS_URL}/unsubscribe?token=${r.unsubscribe_token}`,
        });
        await markSent([r.email_id], id);
        sent++;
      } catch (e) {
        await markFailed([r.email_id], String(e));
        failed++;
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, mode, claimed: rows.length, sent, failed }),
    { headers: { "Content-Type": "application/json" } },
  );
});
