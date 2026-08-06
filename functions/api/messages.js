// Cloudflare Pages Function — serves the route POST /api/messages
//
// This runs on Cloudflare's servers, NOT in the browser, so the API key stays
// secret. The browser calls /api/messages; this function checks the access code,
// then forwards the request to Anthropic with the real key attached.
//
// Two secrets must be set in the Pages project (Settings → Environment variables):
//   ANTHROPIC_API_KEY  — your Anthropic API key
//   ACCESS_CODE        — the passphrase you give member schools

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Check the access code sent by the app.
  const pass = request.headers.get("X-Access-Pass") || "";
  if (!env.ACCESS_CODE || pass !== env.ACCESS_CODE) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Make sure the key is configured.
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Server is missing ANTHROPIC_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Read the request body the app sent (model, max_tokens, messages).
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Forward to Anthropic with the real key.
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  // 5. Pass Anthropic's response straight back to the app.
  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Reject non-POST methods cleanly.
export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  return onRequestPost(context);
}
