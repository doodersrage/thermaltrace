import type { APIRoute } from "astro";
import { getOpenWeatherApiKey } from "../../../../../../../lib/FetchWeather";
import { checkWeatherTileRateLimit } from "../../../../../../../lib/weatherTileLimits";

const ALLOWED_LAYERS = new Set(["temp_new", "precipitation_new"]);

/**
 * Proxy OpenWeather map tiles so the API key stays server-side.
 * GET /api/weather/tiles/:layer/:z/:x/:y
 */
export const GET: APIRoute = async ({ params, clientAddress }) => {
  const rate = checkWeatherTileRateLimit(clientAddress || "unknown");
  if (!rate.ok) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        ...(rate.retryAfterSec ? { "Retry-After": String(rate.retryAfterSec) } : {}),
      },
    });
  }

  const layer = params.layer?.trim() ?? "";
  const z = params.z?.trim() ?? "";
  const x = params.x?.trim() ?? "";
  const y = params.y?.trim() ?? "";

  if (!ALLOWED_LAYERS.has(layer) || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return new Response("Not found", { status: 404 });
  }

  const apiKey = getOpenWeatherApiKey();
  if (!apiKey) {
    return new Response("Weather tiles unavailable", { status: 503 });
  }

  const upstream = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${encodeURIComponent(apiKey)}`;
  const res = await fetch(upstream);
  if (!res.ok) {
    return new Response("Upstream tile error", {
      status: res.status === 401 ? 502 : res.status,
    });
  }

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=1800",
    },
  });
};
