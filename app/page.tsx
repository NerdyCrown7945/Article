"use client";

import { FormEvent, useState } from "react";
import type { SummaryResponse } from "@/lib/types";

type ApiResponse = {
  data?: SummaryResponse;
  error?: string;
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SummaryResponse | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResult(null);

    if (!url.trim()) {
      setError("기사 URL을 입력해 주세요.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || payload.error) {
        setError(payload.error ?? "요약에 실패했습니다.");
        return;
      }

      setResult(payload.data ?? null);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <h1>Article Summarizer</h1>
      <p className="muted">웹 기사 URL을 넣으면 핵심 내용을 한국어로 정리합니다.</p>

      <div className="card">
        <form onSubmit={onSubmit}>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/article"
          />
          <button type="submit" disabled={loading}>
            {loading ? "정리 중..." : "정리하기"}
          </button>
        </form>
      </div>

      {!loading && !error && !result && (
        <div className="card muted">아직 결과가 없습니다. URL을 입력하고 정리하기를 눌러보세요.</div>
      )}

      {loading && <div className="card">요약을 생성하고 있습니다...</div>}

      {error && <div className="card error">{error}</div>}

      {result && (
        <div className="card">
          <h2>{result.title}</h2>
          <p className="muted">
            {result.source} · {result.url}
          </p>
          <p>
            <strong>한 줄 요약:</strong> {result.one_line_summary}
          </p>

          {result.warning && <p className="warning">주의: {result.warning}</p>}

          <div className="section">
            <h3>핵심 포인트</h3>
            <ul>
              {result.key_points.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="section">
            <h3>섹션별 요약</h3>
            {result.sections.map((section, index) => (
              <div key={`${section.heading}-${index}`}>
                <p>
                  <strong>{section.heading}</strong>
                </p>
                <p>{section.summary}</p>
              </div>
            ))}
          </div>

          <div className="section">
            <h3>주의/한계</h3>
            <ul>
              {result.cautions.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
