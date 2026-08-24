"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type McpUiState =
  | "checking"
  | "connected"
  | "degraded"
  | "unavailable"
  | "not_configured";

interface McpPublicStatus {
  state: Exclude<McpUiState, "checking">;
  configured: boolean;
  reachable: boolean;
  ready: boolean;
  endpoint: string | null;
  protocol: string;
  service: string;
  version: string | null;
  toolCount: number;
  database: {
    connected: boolean | null;
    policyCount: number | null;
  };
  lastSyncAt: string | null;
  fallback: string;
  message: string;
  sourceRepository: string;
}

type CardStatus = Omit<McpPublicStatus, "state"> & { state: McpUiState };

const INITIAL_STATUS: CardStatus = {
  state: "checking",
  configured: false,
  reachable: false,
  ready: false,
  endpoint: null,
  protocol: "Streamable HTTP",
  service: "00AI Youth Policy MCP",
  version: null,
  toolCount: 0,
  database: { connected: null, policyCount: null },
  lastSyncAt: null,
  fallback: "d1_then_verified_snapshot",
  message: "GitHub 청년정책 MCP 연결 상태를 확인하고 있습니다.",
  sourceRepository:
    "https://github.com/ImZooMooGwan/00AI/tree/main/apps/youth-policy-mcp",
};

const STATE_LABELS: Record<McpUiState, string> = {
  checking: "상태 확인 중",
  connected: "실시간 연결",
  degraded: "부분 연결",
  unavailable: "D1 폴백",
  not_configured: "설정 대기",
};

export function McpConnectionCard({
  variant = "home",
}: {
  variant?: "home" | "ops";
}) {
  const [status, setStatus] = useState<CardStatus>(INITIAL_STATUS);
  const titleId = variant === "ops" ? "mcp-ops-title" : "mcp-home-title";

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/mcp/status", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("MCP status request failed");
        return response.json() as Promise<McpPublicStatus>;
      })
      .then((nextStatus) => setStatus(nextStatus))
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus({
            ...INITIAL_STATUS,
            state: "unavailable",
            message:
              "연결 진단을 완료하지 못해 D1·검증 스냅샷을 계속 제공합니다.",
          });
        }
      });
    return () => controller.abort();
  }, []);

  const policyCount = status.database.policyCount;
  return (
    <section
      className={`mcp-bridge mcp-state-${status.state} mcp-bridge-${variant}`}
      aria-labelledby={titleId}
    >
      <div className="mcp-bridge-mark" aria-hidden="true">
        <span>MCP</span>
        <i />
        <span>Y-HUB</span>
      </div>
      <div className="mcp-bridge-copy">
        <span className="eyebrow cyan">GITHUB MCP · REMOTE DATA LAYER</span>
        <h2 id={titleId}>청년정책 MCP 연결</h2>
        <p>{status.message}</p>
      </div>
      <dl className="mcp-bridge-facts">
        <div>
          <dt>연결</dt>
          <dd className="mcp-live-state" aria-live="polite">
            <i aria-hidden="true" />{STATE_LABELS[status.state]}
          </dd>
        </div>
        <div><dt>도구</dt><dd>{status.toolCount || 6}개 읽기 전용</dd></div>
        <div>
          <dt>MCP DB</dt>
          <dd>
            {status.database.connected === true
              ? `${policyCount?.toLocaleString("ko-KR") ?? 0}건`
              : "상태 확인 필요"}
          </dd>
        </div>
        <div><dt>장애 시</dt><dd>D1 → 검증 스냅샷</dd></div>
      </dl>
      <div className="mcp-bridge-links">
        <Link href="/api/v1/mcp/status">연결 진단 ↗</Link>
        <a href={status.sourceRepository} target="_blank" rel="noreferrer">
          GitHub 소스 ↗
        </a>
      </div>
    </section>
  );
}
