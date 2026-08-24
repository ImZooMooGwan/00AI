"use client";

import { useState } from "react";

type SyncResponse = {
  results?: Array<{
    sourceId: string;
    status: string;
    fetchedCount: number;
    insertedCount: number;
    updatedCount: number;
    message?: string;
  }>;
  error?: string;
};

export function SyncControl({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function synchronize() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/system/sync?source=all", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as SyncResponse;
      if (!response.ok) throw new Error(payload.error ?? "동기화 요청 실패");
      const results = payload.results ?? [];
      const fetched = results.reduce((sum, result) => sum + result.fetchedCount, 0);
      const changed = results.reduce(
        (sum, result) => sum + result.insertedCount + result.updatedCount,
        0,
      );
      const waiting = results.filter((result) => result.status === "skipped").length;
      setMessage(
        `수집 ${fetched.toLocaleString("ko-KR")}건 · 신규·변경 ${changed.toLocaleString("ko-KR")}건${waiting ? ` · 키 대기 ${waiting}개` : ""}`,
      );
      window.setTimeout(() => window.location.reload(), 1_200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동기화 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sync-control">
      <button
        className="button button-primary"
        disabled={disabled || busy}
        onClick={synchronize}
        type="button"
      >
        {busy ? "공식 원천 수집 중…" : "지금 전체 동기화"}
      </button>
      <span aria-live="polite">{message || "키가 연결된 원천만 수집합니다."}</span>
    </div>
  );
}

