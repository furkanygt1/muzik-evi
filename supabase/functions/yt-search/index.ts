// Müzik Sokağı · YouTube araması (API anahtarı gerekmez)
// Supabase panelinde: Edge Functions → Deploy a new function → adı "yt-search" → bu kodu yapıştır → Deploy
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = new URL(req.url).searchParams.get("q") || "";
  const html = await fetch("https://www.youtube.com/results?hl=tr&gl=TR&search_query=" + encodeURIComponent(q), {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "tr-TR,tr;q=0.9" } }).then((r) => r.text());
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
  const items: unknown[] = [];
  if (m) {
    const walk = (o: any) => {
      if (!o || typeof o !== "object" || items.length >= 15) return;
      if (o.videoRenderer?.videoId) {
        const v = o.videoRenderer;
        const d = (v.lengthText?.simpleText || "").split(":").reduce((a: number, b: string) => a * 60 + (+b || 0), 0);
        items.push({ id: v.videoId, t: v.title?.runs?.[0]?.text || "", c: v.ownerText?.runs?.[0]?.text || "", th: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, d });
        return;
      }
      for (const k in o) walk(o[k]);
    };
    walk(JSON.parse(m[1]));
  }
  return new Response(JSON.stringify({ items }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
