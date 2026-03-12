import { NextResponse } from "next/server";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  url: z.string().url("유효한 URL이 아닙니다."),
});

const summarizeSchema = z.object({
  title: z.string(),
  source: z.string(),
  url: z.string().url(),
  one_line_summary: z.string(),
  key_points: z.array(z.string()).min(2).max(8),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        summary: z.string(),
      }),
    )
    .min(1)
    .max(8),
  cautions: z.array(z.string()).min(1).max(5),
});

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function extractArticle(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  return reader.parse();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.issues[0]?.message ?? "잘못된 요청입니다." }, { status: 400 });
  }

  if (!client) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
  }

  const articleUrl = parsedBody.data.url;

  try {
    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ArticleSummarizer/1.0)",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `기사를 불러오지 못했습니다. (${response.status} ${response.statusText})` },
        { status: 400 },
      );
    }

    const html = await response.text();
    const article = extractArticle(html, articleUrl);

    if (!article?.textContent?.trim()) {
      return NextResponse.json(
        {
          error:
            "기사 본문을 추출하지 못했습니다. 본문이 스크립트 기반이거나 접근이 제한된 페이지일 수 있습니다. 다른 URL을 시도해 주세요.",
        },
        { status: 422 },
      );
    }

    const cleanText = article.textContent.replace(/\s+/g, " ").trim();
    const warning = cleanText.length < 700 ? "본문 길이가 짧아 요약 정확도가 낮을 수 있습니다." : undefined;

    const openaiResponse = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "당신은 사실 기반 기사 요약 도우미입니다. 반드시 한국어로 작성하세요. 기사에 없는 사실을 만들지 마세요. 인명, 지명, 날짜, 수치, 금액, 퍼센트는 원문 정보를 최대한 보존하세요. 추정이 필요한 경우 cautions에 불확실성을 명시하세요.",
        },
        {
          role: "user",
          content: `URL: ${articleUrl}\n제목: ${article.title ?? "(제목 없음)"}\n출처: ${new URL(articleUrl).hostname}\n\n원문 본문:\n${cleanText.slice(0, 12000)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "article_summary",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              source: { type: "string" },
              url: { type: "string", format: "uri" },
              one_line_summary: { type: "string" },
              key_points: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 8,
              },
              sections: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    heading: { type: "string" },
                    summary: { type: "string" },
                  },
                  required: ["heading", "summary"],
                },
              },
              cautions: {
                type: "array",
                items: { type: "string" },
                minItems: 1,
                maxItems: 5,
              },
            },
            required: ["title", "source", "url", "one_line_summary", "key_points", "sections", "cautions"],
          },
          strict: true,
        },
      },
    });

    const jsonText = openaiResponse.output_text;
    const parsedSummary = summarizeSchema.safeParse(JSON.parse(jsonText));

    if (!parsedSummary.success) {
      return NextResponse.json({ error: "요약 결과 형식이 올바르지 않습니다." }, { status: 500 });
    }

    return NextResponse.json({ data: { ...parsedSummary.data, warning } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: `요약 처리 중 오류가 발생했습니다: ${message}` }, { status: 500 });
  }
}
