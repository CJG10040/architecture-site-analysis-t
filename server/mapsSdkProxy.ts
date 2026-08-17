import type { Express, Request } from "express";
import { ENV } from "./_core/env";

const DEV_PREVIEW_ORIGIN = "https://3000-ifz6t6fcaupam64k9e60m-b45efd32.sg1.manus.computer";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function resolveMapsProxyOrigin(req: Pick<Request, "headers">) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(",")[0]?.trim()
    || req.headers.host?.split(",")[0]?.trim();
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(",")[0]?.trim() || "https";
  const bareHost = host?.replace(/:\d+$/, "");

  if (!host || (bareHost && LOOPBACK_HOSTS.has(bareHost))) return DEV_PREVIEW_ORIGIN;
  return `${protocol === "http" ? "http" : "https"}://${host}`;
}

export function registerMapsSdkProxy(app: Express) {
  app.get("/api/maps/sdk.js", async (req, res) => {
    try {
      const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
      if (!ENV.forgeApiKey) throw new Error("Server Maps proxy credential is unavailable.");
      const url = new URL(`${baseUrl}/v1/maps/proxy/maps/api/js`);
      url.searchParams.set("key", ENV.forgeApiKey);
      url.searchParams.set("v", "weekly");
      url.searchParams.set("libraries", "drawing,marker,places,geocoding,geometry");

      const origin = resolveMapsProxyOrigin(req);
      const upstream = await fetch(url, {
        headers: {
          Authorization: `Bearer ${ENV.forgeApiKey}`,
          Origin: origin,
          Referer: `${origin}/`,
        },
      });

      if (!upstream.ok) {
        const details = await upstream.text();
        console.error(`[Maps SDK] Upstream failed: ${upstream.status}`, details.slice(0, 500));
        res.status(502).type("application/javascript").send("throw new Error('Google Maps SDK is temporarily unavailable.');");
        return;
      }

      const contentType = upstream.headers.get("content-type") || "application/javascript; charset=utf-8";
      res.setHeader("Cache-Control", "private, max-age=300");
      res.type(contentType).send(await upstream.text());
    } catch (error) {
      console.error("[Maps SDK] Failed to proxy SDK", error);
      res.status(502).type("application/javascript").send("throw new Error('Google Maps SDK is temporarily unavailable.');");
    }
  });
}
