// =====================================================================
// Mercury Operations Platform — notify-actions
// Handles the links inside notification emails:
//   /verify?token=...       confirms an address
//   /unsubscribe?token=...  stops emails to an address
//
// Must be deployed WITHOUT JWT checking — recipients are not logged in:
//   supabase functions deploy notify-actions --no-verify-jwt
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// service_role is being retired during 2026 in favour of secret keys;
// read the new variable when present, fall back to the old one.
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

const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );
}

function page(heading: string, body: string, cta = true) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(heading)} — Mercury</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
         background:#eef1f6; color:#111a28; padding:24px;
         font-family:Inter,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif; }
  .card { background:#fff; border:1px solid #e3e8ef; border-radius:12px;
          max-width:440px; padding:32px; }
  .mark { font-size:13px; font-weight:600; color:#5b6c85; margin:0 0 20px; }
  h1 { font-size:21px; line-height:1.3; margin:0 0 10px; font-weight:650; }
  p { margin:0 0 8px; line-height:1.55; color:#334155; }
  a.btn { display:inline-block; margin-top:22px; background:#22c55e; color:#0a0e16;
          text-decoration:none; padding:11px 20px; border-radius:6px;
          font-size:14px; font-weight:600; }
  a.btn:focus-visible { outline:3px solid #22c55e; outline-offset:2px; }
  @media (prefers-color-scheme: dark) {
    body { background:#0a0e16; color:#eaf1fb; }
    .card { background:#121a27; border-color:#1f2b3d; }
    p { color:#8497b0; }
  }
</style></head><body>
<div class="card">
  <p class="mark">Mercury Operations Platform</p>
  <h1>${esc(heading)}</h1>
  ${body}
  ${cta && APP_URL ? `<a class="btn" href="${esc(APP_URL)}">Open the dashboard</a>` : ""}
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop();
  const token = url.searchParams.get("token") ?? "";

  if (!UUID.test(token)) {
    return page(
      "That link didn't work",
      "<p>The link is incomplete or has already been used. Ask your Mercury contact to send a fresh one.</p>",
      false,
    );
  }

  if (action === "verify") {
    const { data, error } = await db.rpc("confirm_contact", { p_token: token });
    if (error || !data?.length) {
      return page(
        "That link didn't work",
        "<p>We couldn't match this link to an address. It may have been replaced by a newer one.</p>",
        false,
      );
    }
    const name = data[0].contact_name ?? "";
    return page(
      "You're all set",
      `<p>${esc(name ? name.split(" ")[0] + ", this" : "This")} address is now confirmed. You'll receive updates as work progresses on your projects.</p>
       <p>You can change what you receive, or stop the emails, from the notifications page on the dashboard.</p>`,
    );
  }

  if (action === "unsubscribe") {
    const { data, error } = await db.rpc("unsubscribe_contact", { p_token: token });
    if (error || !data?.length) {
      return page(
        "That link didn't work",
        "<p>We couldn't match this link to an address. If you keep receiving emails, reply to this one and we'll remove you.</p>",
        false,
      );
    }
    return page(
      "Emails stopped",
      `<p>We won't send any more updates to this address.</p>
       <p>Your dashboard login is unaffected — you can still sign in and see everything there, and turn emails back on whenever you want.</p>`,
    );
  }

  return page(
    "Page not found",
    "<p>Check the link in your email, or open the dashboard instead.</p>",
  );
});
