// Vercel serverless function: receives applications from the landing page,
// blocks bots (Turnstile CAPTCHA, honeypot, timing, rate limit), then forwards
// the lead to the Zapier "Applications to GHL" webhook.
//
// Required environment variables (Vercel → Project → Settings → Environment Variables):
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key
//   ZAPIER_HOOK_URL       Zapier catch-hook URL (kept secret, never in the page)
// Optional:
//   ALLOWED_ORIGINS       comma-separated origins (default: https://agency.stratonmanagement.com)

const FIELDS = [
  "first_name", "last_name", "full_name", "phone", "email", "instagram", "telegram",
  "preferred_contact", "monthly_revenue", "current_setup", "stage_name", "anything_else",
  "tag", "notes", "gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term",
  "utm_content", "form_location", "landing_page", "est_monthly",
];
const MIN_FILL_MS = 3000;           // humans can't finish both steps faster than this
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const hits = new Map();             // per-instance, best effort

function clientIp(req) {
  const xf = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.headers["x-real-ip"] || "unknown";
}

function rateLimited(ip, now) {
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_LIMIT.windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > RATE_LIMIT.max;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

async function verifyTurnstile(token, ip, secret, fetchImpl) {
  const form = new URLSearchParams({ secret, response: token || "" });
  if (ip && ip !== "unknown") form.set("remoteip", ip);
  const r = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const data = await r.json().catch(() => ({}));
  return data && data.success === true;
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function handler(req, res, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const env = deps.env || process.env;
  const now = deps.now ? deps.now() : Date.now();

  if (req.method !== "POST") return send(res, 405, { ok: false, error: "method_not_allowed" });

  const allowed = (env.ALLOWED_ORIGINS || "https://agency.stratonmanagement.com").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || "";
  if (origin && !allowed.includes(origin)) return send(res, 403, { ok: false, error: "origin" });

  const ip = clientIp(req);
  if (rateLimited(ip, now)) return send(res, 429, { ok: false, error: "too_many_requests" });

  const body = await readBody(req);

  // Honeypot: a hidden field only bots fill in. Pretend success so they don't adapt.
  if ((body.company_website || "").trim()) return send(res, 200, { ok: true });

  // Timing: reject submissions completed impossibly fast.
  const started = Number(body.started_at || 0);
  if (!started || now - started < MIN_FILL_MS) return send(res, 400, { ok: false, error: "too_fast" });

  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || phone.replace(/\D/g, "").length < 7) {
    return send(res, 400, { ok: false, error: "invalid" });
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.ZAPIER_HOOK_URL) return send(res, 500, { ok: false, error: "not_configured" });
  const human = await verifyTurnstile(body.turnstile_token, ip, env.TURNSTILE_SECRET_KEY, fetchImpl);
  if (!human) return send(res, 403, { ok: false, error: "captcha" });

  const lead = new URLSearchParams();
  for (const k of FIELDS) lead.set(k, String(body[k] ?? "").slice(0, 2000));
  const z = await fetchImpl(env.ZAPIER_HOOK_URL, { method: "POST", body: lead });
  if (!z.ok) return send(res, 502, { ok: false, error: "forward_failed" });

  return send(res, 200, { ok: true });
}

module.exports = handler;
module.exports.default = handler;
module.exports._internal = { hits, MIN_FILL_MS };
