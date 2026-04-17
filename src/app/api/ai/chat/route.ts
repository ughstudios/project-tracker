import { auth } from "@/auth";
import { buildAiKnowledgeSnapshot } from "@/lib/ai-knowledge-snapshot";
import { TABS_AI_PAGE } from "@/lib/employee-nav-shared";
import { guardEmployeeNavApi } from "@/lib/employee-nav-api";
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";

function getAiApiKey() {
  return process.env.AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
}

function getChatModelId() {
  return process.env.AI_CHAT_MODEL?.trim() || "gpt-5.4";
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = await guardEmployeeNavApi(session, TABS_AI_PAGE);
  if (denied) return denied;

  const apiKey = getAiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured (set AI_KEY or OPENAI_API_KEY)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object." }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const messages = rec.messages;
  const localeRaw = rec.locale;

  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: "messages must be an array." }, { status: 400 });
  }

  const replyLocale = localeRaw === "zh" ? "zh" : "en";
  const langName = replyLocale === "zh" ? "Simplified Chinese" : "English";

  const snapshot = await buildAiKnowledgeSnapshot({
    userId: session.user.id,
    role: session.user.role,
    userName: session.user.name,
  });

  const snapshotJson = JSON.stringify(snapshot);

  const openai = createOpenAI({ apiKey });

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(
      messages as UIMessage[],
    );
  } catch (e) {
    console.error("[ai/chat] convertToModelMessages failed:", e);
    return NextResponse.json({ error: "Invalid message payload." }, { status: 400 });
  }

  const system = [
    "You are an internal assistant for a project and issue tracking web app.",
    `Always answer in ${langName} (locale code: ${replyLocale}).`,
    "You must only rely on the following JSON snapshot for factual claims about customers, projects, issues, inventory, work records, or audit logs.",
    "If the user asks about data that is not present in the snapshot (or the relevant scope is missing), explain that they do not have access or that the snapshot does not include it — do not invent rows, IDs, or ticket contents.",
    "Never reveal environment variables, API keys, password hashes, or other secrets.",
    "Prefer concise answers. When listing items, keep lists short and relevant to the question.",
    "",
    "DATABASE_SNAPSHOT_JSON:",
    snapshotJson,
  ].join("\n");

  const result = streamText({
    model: openai(getChatModelId()),
    system,
    messages: modelMessages,
  });

  const safeStreamError =
    replyLocale === "zh"
      ? "AI 服务出错，请稍后再试。若持续失败，请让管理员检查 AI 服务配置。"
      : "Something went wrong with the AI service. Please try again. If it keeps failing, ask an admin to verify the AI service configuration.";

  return result.toUIMessageStreamResponse({
    onError: (error) => {
      console.error("[ai/chat] stream error:", error);
      return safeStreamError;
    },
  });
}
