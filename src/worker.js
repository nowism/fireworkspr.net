import { EmailMessage } from "cloudflare:email";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// Strip CR/LF so user input can't inject extra mail headers.
const oneLine = (s) => String(s || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);

async function handleContact(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const form = await request.formData();
  if (form.get("website")) return json({ ok: true }); // honeypot: silently drop bots

  const first = oneLine(form.get("first"));
  const last = oneLine(form.get("last"));
  const email = oneLine(form.get("email"));
  const message = String(form.get("message") || "").slice(0, 10000);
  const newsletter = form.get("newsletter") === "yes";

  if (!first || !last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Please fill in your first name, last name and a valid email." }, 400);
  }

  const body = [
    `Name: ${first} ${last}`,
    `Email: ${email}`,
    `Newsletter sign-up: ${newsletter ? "yes" : "no"}`,
    "",
    message || "(no message)",
  ].join("\n");

  const raw = [
    `From: Fireworks PR Website <${env.CONTACT_FROM}>`,
    `To: ${env.CONTACT_TO}`,
    `Reply-To: ${first} ${last} <${email}>`,
    `Subject: Website contact: ${first} ${last}`,
    `Message-ID: <${crypto.randomUUID()}@fireworkspr.net>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(env.CONTACT_FROM, env.CONTACT_TO, raw));
  } catch (err) {
    console.error("contact send failed", err);
    return json({ error: "Sorry, your message couldn’t be sent." }, 502);
  }

  // Plain (non-JS) form posts get redirected back with a thank-you flag.
  if (!(request.headers.get("accept") || "").includes("application/json")) {
    return Response.redirect(new URL("/contact/?sent=1", request.url), 303);
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === "fireworkspr.net") {
      url.hostname = "www.fireworkspr.net";
      return Response.redirect(url, 301);
    }
    // Old Squarespace URLs.
    if (url.pathname === "/home") return Response.redirect(new URL("/", url), 301);
    if (url.pathname === "/api/contact") return handleContact(request, env);
    return env.ASSETS.fetch(request);
  },
};
