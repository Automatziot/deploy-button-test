import { OAuthProvider } from "@cloudflare/workers-oauth-provider";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Minimal MCP over Streamable HTTP (JSON replies). One harmless tool.
const apiHandler = {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const msg = await request.json();
    if (msg.id === undefined) return new Response(null, { status: 202 });
    const ok = (result) => json({ jsonrpc: "2.0", id: msg.id, result });
    switch (msg.method) {
      case "initialize":
        return ok({ protocolVersion: msg.params?.protocolVersion || "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "az-test-mcp-a", version: "0.0.1" } });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: [{ name: "whoami", description: "Returns the logged-in test user. Harmless.", inputSchema: { type: "object", properties: {} } }] });
      case "tools/call":
        return ok({ content: [{ type: "text", text: "logged in as: " + (ctx.props?.user ?? "unknown") }] });
      default:
        return json({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    }
  },
};

// Login page: a single Approve button (test only; no key, no password).
const defaultHandler = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/authorize") {
      const oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      if (request.method === "POST") {
        const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
          request: oauthReq, userId: "test-user", metadata: {}, scope: oauthReq.scope, props: { user: "test-user" },
        });
        return Response.redirect(redirectTo, 302);
      }
      return new Response(`<!doctype html><meta charset=utf-8><title>Test login</title><h1>Automatziot test MCP</h1><p>Approve access for the test connector?</p><form method=post action="/authorize${url.search.replace(/"/g, "&quot;")}"><button>Approve</button></form>`, { headers: { "content-type": "text/html" } });
    }
    return new Response("az-test-mcp-a up", { status: 200 });
  },
};

export default new OAuthProvider({
  apiRoute: "/mcp",
  resourceMetadata: { resource: "https://az-test-mcp-a.reuven007.workers.dev/mcp" },
  apiHandler,
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
