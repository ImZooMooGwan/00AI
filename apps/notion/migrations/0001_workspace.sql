PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE login_codes (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER NOT NULL
);
CREATE TABLE email_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member','guest')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY(workspace_id,user_id)
);

CREATE TABLE workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','member','guest')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE(workspace_id,email)
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '새 페이지',
  icon TEXT NOT NULL DEFAULT '📄',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  starter_json TEXT,
  starter_claimed_at TEXT
);
CREATE INDEX pages_workspace_updated ON pages(workspace_id,archived_at,updated_at DESC);

CREATE TABLE page_members (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('editor','commenter','viewer')),
  granted_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(page_id,user_id)
);
CREATE TABLE page_invites (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('editor','commenter','viewer')),
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  accepted_at TEXT,
  UNIQUE(page_id,email)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','unlisted','private')),
  license TEXT NOT NULL DEFAULT '00AI Community Template License',
  blocks_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_workspace_created ON audit_log(workspace_id,created_at DESC);

INSERT INTO templates(id,title,description,category,icon,blocks_json,created_at,updated_at) VALUES
('public-meeting-minutes','회의록','안건, 논의 내용, 결정 사항, 담당자와 기한을 한 페이지에 정리합니다.','회의·협의','🗒️','[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"회의 개요"}]},{"type":"paragraph","content":[{"type":"text","text":"일시 · 참석자 · 장소를 입력하세요."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"안건"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"안건과 담당자를 적으세요."}]}]}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"결정 및 후속 조치"}]},{"type":"paragraph","content":[{"type":"text","text":"결정 사항 · 담당자 · 완료 기한"}]}]','2026-10-30T00:00:00.000Z','2026-10-30T00:00:00.000Z'),
('public-policy-brief','정책 기획 노트','문제 정의부터 대안 비교, 실행 계획과 성과지표까지 구조화합니다.','정책기획','🧭','[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"정책 기획"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"1. 해결할 문제"}]},{"type":"paragraph","content":[{"type":"text","text":"대상과 현황, 확인한 근거를 기록하세요."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"2. 목표와 대안"}]},{"type":"paragraph","content":[{"type":"text","text":"목표와 대안별 기대효과·비용·위험을 비교하세요."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"3. 실행 계획과 성과지표"}]},{"type":"paragraph","content":[{"type":"text","text":"담당, 일정, 산출물, 성과지표와 점검 주기를 정하세요."}]}]','2026-10-30T00:00:00.000Z','2026-10-30T00:00:00.000Z'),
('public-handover','업무 인수인계','정기 업무, 담당자, 일정, 참고 자료를 빠뜨리지 않도록 정리합니다.','업무관리','🔁','[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"업무 인수인계"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"정기 업무"}]},{"type":"paragraph","content":[{"type":"text","text":"업무 내용, 주기, 마감일, 협조 부서를 적으세요."}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"진행 중인 업무"}]},{"type":"paragraph","content":[{"type":"text","text":"현재 상태, 다음 조치, 담당자와 일정"}]},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"참고 자료와 연락처"}]},{"type":"paragraph","content":[{"type":"text","text":"내부 규정과 자료 위치를 링크로 연결하세요. 개인정보나 비밀번호는 기록하지 마세요."}]}]','2026-10-30T00:00:00.000Z','2026-10-30T00:00:00.000Z');
