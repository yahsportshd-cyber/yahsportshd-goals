export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // استقبال منشورات تيليجرام
    if (request.method === "POST" && url.pathname === "/telegram") {
      const telegramSecret = request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token"
      );

      if (telegramSecret !== env.TG_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const update = await request.json();
        const post = update.channel_post;

        if (post) {
          const item = {
            id: post.message_id,
            text: post.text || post.caption || "🎯 هدف جديد",
            date: post.date,
            link: post.chat.username
              ? `https://t.me/${post.chat.username}/${post.message_id}`
              : null
          };

          const previous =
            await env.GOALS_KV.get("latest", "json") || [];

          const latest = [item, ...previous]
            .filter((goal, index, list) =>
              list.findIndex(x => x.id === goal.id) === index
            )
            .slice(0, 3);

          await env.GOALS_KV.put(
            "latest",
            JSON.stringify(latest)
          );
        }

        return new Response("OK", { headers: cors });
      } catch (error) {
        return new Response("Error", {
          status: 500,
          headers: cors
        });
      }
    }

    // عرض آخر ثلاثة أهداف
    if (request.method === "GET" && url.pathname === "/api/goals") {
      const goals =
        await env.GOALS_KV.get("latest", "json") || [];

      return new Response(JSON.stringify(goals), {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      });
    }

    // إعداد Webhook تيليجرام
    if (request.method === "POST" && url.pathname === "/setup-webhook") {
      if (request.headers.get("X-Setup-Key") !== env.SETUP_KEY) {
        return new Response("Unauthorized", { status: 401 });
      }

      const webhookUrl = `${url.origin}/telegram`;

      const response = await fetch(
        `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: env.TG_WEBHOOK_SECRET,
            allowed_updates: ["channel_post"]
          })
        }
      );

      return new Response(await response.text(), {
        headers: {
          ...cors,
          "Content-Type": "application/json"
        }
      });
    }

    return new Response("YahSportsHD Goals Worker is running", {
      headers: cors
    });
  }
};
