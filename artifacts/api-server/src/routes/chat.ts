import { Router, type IRouter, type Request } from "express";
import { SendChatMessageBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { systemPrompt } from "../lib/systemPrompt";

const router: IRouter = Router();
const requestsByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const PREFERRED_MODELS = [
  DEFAULT_MODEL,
  "llama-3.1-8b-instant",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];
let modelCache: { ids: string[]; expiresAt: number } | undefined;

function getClientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function sendError(res: Parameters<Parameters<IRouter["post"]>[1]>[1], status: number, error: string) {
  res.status(status).json({ error });
}

async function resolveModel(apiKey: string, requestedModel: string) {
  if (modelCache && modelCache.expiresAt > Date.now() && modelCache.ids.length > 0) {
    return modelCache.ids.includes(requestedModel)
      ? requestedModel
      : PREFERRED_MODELS.find((model) => modelCache?.ids.includes(model)) || modelCache.ids[0];
  }

  try {
    const response = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      const payload = (await response.json()) as { data?: Array<{ id?: string }> };
      const ids = (payload.data || []).flatMap((model) => (model.id ? [model.id] : []));
      modelCache = { ids, expiresAt: Date.now() + 5 * 60_000 };
      return ids.includes(requestedModel)
        ? requestedModel
        : PREFERRED_MODELS.find((model) => ids.includes(model)) || ids[0] || requestedModel;
    }
    logger.warn({ status: response.status }, "Groq model list unavailable; using configured model");
  } catch (error) {
    logger.warn({ err: error }, "Groq model list request failed; using configured model");
  }
  return requestedModel;
}

router.post("/chat", async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const current = requestsByIp.get(ip);

  if (!current || current.resetAt <= now) {
    requestsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    sendError(res, 429, "You’ve reached the short-term chat limit. Please try again in a minute.");
    return;
  } else {
    current.count += 1;
  }

  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    sendError(res, 400, "Please send a message up to 500 characters.");
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logger.error("GROQ_API_KEY is not configured");
    sendError(res, 503, "The school assistant is temporarily unavailable. Please contact the school office directly.");
    return;
  }

  const requestedModel = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const model = await resolveModel(apiKey, requestedModel);
  const messages = [
    { role: "system", content: systemPrompt },
    ...parsed.data.messages.slice(-10),
  ];

  try {
    const groqResponse = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 600,
        stream: true,
      }),
    });

    if (!groqResponse.ok || !groqResponse.body) {
      const providerMessage = await groqResponse.text().catch(() => "");
      logger.error(
        { status: groqResponse.status, providerMessage: providerMessage.slice(0, 300) },
        "Groq request failed",
      );
      sendError(res, 502, "The school assistant is having trouble right now. Please try again or contact the school office.");
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const writeChunk = (content: string) => {
      res.write(`data: ${JSON.stringify(content)}\n\n`);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;

          try {
            const json = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const content = json.choices?.[0]?.delta?.content;
            if (content) writeChunk(content);
          } catch {
            // Ignore incomplete provider frames; the next frame will complete them.
          }
        }

        if (done) break;
      }
      res.write("event: done\ndata: [DONE]\n\n");
      res.end();
    } catch (error) {
      logger.error({ err: error }, "Groq stream failed");
      if (!res.headersSent) {
        sendError(res, 502, "The school assistant could not finish replying. Please try again.");
      } else {
        res.end();
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Groq request threw an error");
    sendError(res, 502, "The school assistant is having trouble right now. Please try again.");
  }
});

export default router;