// Müzik Sokağı · NPC sohbet beyni. GEMINI_API_KEY varsa Gemini, yoksa Pollinations.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const FORMAT = '\n\nYANIT BİÇİMİ: Sadece JSON döndür: {"reply":"karakterin söylediği söz","aff":-10..10 arası tam sayı (bu mesajla ilişkin nasıl değişti),"remember":"Yiğit hakkında yeni öğrendiğin kalıcı bir bilgi varsa kısa not, yoksa boş"}';
function parse(t: string) { try { const m = t.match(/\{[\s\S]*\}/); const o = JSON.parse(m ? m[0] : t); if (o.reply) return { reply: String(o.reply), aff: Math.max(-10, Math.min(10, Math.round(+o.aff || 0))), remember: String(o.remember || "") }; } catch (_) {} return t && t.length < 600 ? { reply: t.replace(/\[aff:[^\]]*\]/g, "").trim(), aff: 0, remember: "" } : null; }
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let b: any; try { b = await req.json(); } catch (_) { return J({ error: "bad json" }, 400); }
  const system = String(b.system || "").slice(0, 9000), msg = String(b.message || "").slice(0, 600);
  const hist = (Array.isArray(b.history) ? b.history : []).slice(-16).map((m: any) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 600) }));
  const gk = Deno.env.get("GEMINI_API_KEY");
  if (gk) {
    for (const model of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]) {
      try {
        const gc: any = { temperature: 0.9, topP: 0.95, maxOutputTokens: 400, responseMimeType: "application/json" };
        if (model.startsWith("gemini-2.5")) gc.thinkingConfig = { thinkingBudget: 0 };
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gk}`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system_instruction: { parts: [{ text: system + FORMAT }] }, contents: [...hist.map((m: any) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), { role: "user", parts: [{ text: msg }] }], generationConfig: gc,
            safetySettings: ["HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH", "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT"].map((c) => ({ category: c, threshold: "BLOCK_ONLY_HIGH" })) }) });
        if (!r.ok) continue; const j = await r.json(); const t = j.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""; const o = parse(t); if (o) return J({ ...o, src: "gemini:" + model });
      } catch (_) {}
    }
  }
  const pk = Deno.env.get("POLLINATIONS_KEY");
  try {
    const r = await fetch(pk ? "https://gen.pollinations.ai/v1/chat/completions" : "https://text.pollinations.ai/openai", { method: "POST", headers: { "Content-Type": "application/json", ...(pk ? { Authorization: "Bearer " + pk } : {}) },
      body: JSON.stringify({ model: "openai", messages: [{ role: "system", content: system + FORMAT }, ...hist, { role: "user", content: msg }], temperature: 0.9, private: true, referrer: "muzik-sokagi" }) });
    if (r.ok) { const j = await r.json(); const o = parse(j.choices?.[0]?.message?.content || ""); if (o) return J({ ...o, src: "pollinations" }); }
    return J({ error: "limit", status: r.status }, 429);
  } catch (e) { return J({ error: String(e) }, 502); }
});
