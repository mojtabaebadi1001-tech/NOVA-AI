const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const ALLOWED_ORIGIN = "https://mojtabaebadi1001-tech.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "فقط درخواست POST پشتیبانی می‌شود." }), {
        status: 405, headers: corsHeaders
      });
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      return new Response(JSON.stringify({ error: "اتصال AI در تنظیمات Cloudflare Worker پیدا نشد. یک AI binding با نام AI اضافه کن." }), {
        status: 500, headers: corsHeaders
      });
    }

    try {
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return new Response(JSON.stringify({ error: "پیام معتبری دریافت نشد." }), {
          status: 400, headers: corsHeaders
        });
      }

      const messages = body.messages
        .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

      if (!messages.length || messages[messages.length - 1].role !== "user") {
        return new Response(JSON.stringify({ error: "آخرین پیام باید از طرف کاربر باشد." }), {
          status: 400, headers: corsHeaders
        });
      }

      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "تو NOVA AI هستی؛ دستیار مفید، دقیق و مؤدب. به زبان فارسی روان پاسخ بده، مگر کاربر زبان دیگری بخواهد. پاسخ‌ها را روشن و کاربردی بنویس. اگر چیزی را نمی‌دانی، صادقانه بگو و اطلاعات ساختگی نساز." },
          ...messages
        ],
        max_tokens: 900
      });

      const reply = result.response || result.result || result.output_text;
      if (typeof reply !== "string" || !reply.trim()) {
        throw new Error("مدل پاسخ متنی برنگرداند.");
      }
      return new Response(JSON.stringify({ reply: reply.trim() }), {
        status: 200, headers: corsHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message || "خطای داخلی سرور" }), {
        status: 500, headers: corsHeaders
      });
    }
  }
};