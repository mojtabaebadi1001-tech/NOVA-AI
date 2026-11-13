export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "فقط درخواست POST پشتیبانی می‌شود." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "کلید هوش مصنوعی هنوز در تنظیمات Netlify ثبت نشده است." }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  try {
    const body = await request.json();
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "پیام معتبری دریافت نشد." }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const messages = body.messages
      .filter(m => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .slice(-20)
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 4000) }]
      }));

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return new Response(JSON.stringify({ error: "آخرین پیام باید از طرف کاربر باشد." }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const apiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "تو NOVA AI هستی؛ دستیار مفید، دقیق و مؤدب. به زبان فارسی روان پاسخ بده، مگر کاربر زبان دیگری بخواهد. پاسخ‌ها را روشن و کاربردی بنویس. اگر چیزی را نمی‌دانی، صادقانه بگو و اطلاعات ساختگی نساز." }]
          },
          contents: messages,
          generationConfig: { maxOutputTokens: 900 }
        })
      }
    );

    const result = await apiResponse.json();
    if (!apiResponse.ok) {
      const message = result?.error?.message || "سرویس هوش مصنوعی پاسخ نداد.";
      return new Response(JSON.stringify({ error: message }), {
        status: apiResponse.status,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }

    const reply = result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) throw new Error("پاسخ متنی معتبری از هوش مصنوعی دریافت نشد.");

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "خطای داخلی سرور" }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
};
