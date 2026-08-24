"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "./drop.css";
import "./github-projects.css";

type Status = "LIVE" | "BETA" | "LAB" | "COMING SOON";
type SyncState = "loading" | "synced" | "degraded";

type PublishedProject = {
  slug: string;
  name: string;
  public_url: string;
  status: string;
};

type GitHubProject = {
  id: string;
  name: string;
  full_name: string;
  description: string;
  repository_url: string;
  homepage: string | null;
  public_url: string;
  owner: string;
  language: string | null;
  topics: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

type GalleryProject = {
  id: string;
  name: string;
  problem: string;
  field: string;
  maker: string;
  stack: string;
  status: string;
  href: string;
  source: "github" | "drop" | "core";
  hasHomepage?: boolean;
};

const services: Array<{
  name: string;
  description: string;
  status: Status;
  category: string;
  tags: string[];
  href: string;
}> = [
  {
    name: "AI 정책상황실",
    description:
      "데이터와 AI를 이용해 정책대안을 분석하고 행정문서를 작성합니다.",
    status: "LIVE",
    category: "정책·행정",
    tags: ["정책", "데이터", "법령", "보고서"],
    href: "https://policy.00ai.kr",
  },
  {
    name: "00AI Harness",
    description:
      "행정망 안의 시스템, 데이터, 문서와 AI를 안전하게 연결합니다.",
    status: "LAB",
    category: "개발",
    tags: ["공공AI", "오케스트레이션", "행정망"],
    href: "https://harness.00ai.kr/",
  },
  {
    name: "00AI DROP",
    description:
      "ZIP이나 정적 웹 파일을 올리고 공공AI 서비스를 바로 공유하세요.",
    status: "BETA",
    category: "개발",
    tags: ["배포", "Hosting", "GitHub"],
    href: "#deploy",
  },
];

const coreProjects: GalleryProject[] = [
  {
    id: "core-policy",
    name: "AI 정책상황실",
    problem: "정책 대안 검토와 보고자료 작성",
    field: "행정",
    maker: "00AI",
    stack: "AI · 데이터 · 법령",
    status: "LIVE",
    href: "https://policy.00ai.kr",
    source: "core",
  },
  {
    id: "core-harness",
    name: "00AI Harness",
    problem: "행정망에서의 안전한 AI 실행",
    field: "행정",
    maker: "00AI Lab",
    stack: "Local AI · Orchestration",
    status: "LAB",
    href: "https://harness.00ai.kr/",
    source: "core",
  },
];

function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge ${status.toLowerCase().replace(" ", "-")}`}>
      <i />
      {status}
    </span>
  );
}

function topicLabel(topic: string) {
  return topic.replaceAll("-", " ");
}

function toGalleryProject(project: GitHubProject): GalleryProject {
  const stack = [
    project.language,
    ...project.topics.slice(0, 2).map(topicLabel),
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `github-${project.id}`,
    name: project.name,
    problem: project.description,
    field: project.topics[0]
      ? topicLabel(project.topics[0])
      : "오픈소스",
    maker: project.owner,
    stack: stack || "GitHub",
    status: project.status,
    href: project.public_url,
    source: "github",
    hasHomepage: Boolean(project.homepage),
  };
}

function projectLinkLabel(project: GalleryProject) {
  if (project.source === "github") {
    return project.hasHomepage ? "서비스 열기 →" : "GitHub 보기 →";
  }
  return project.source === "drop" ? "프로젝트 열기 →" : "상세 보기 →";
}

export default function Home() {
  const [tab, setTab] = useState<"services" | "projects">("services");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("");
  const [deployState, setDeployState] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [publishedProjects, setPublishedProjects] = useState<
    PublishedProject[]
  >([]);
  const [githubProjects, setGitHubProjects] = useState<GitHubProject[]>([]);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [githubOwner, setGithubOwner] = useState("ImZooMooGwan");
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredServices = useMemo(
    () =>
      services.filter((service) =>
        `${service.name} ${service.description} ${service.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query],
  );

  const galleryProjects = useMemo(() => {
    const candidates: GalleryProject[] = [
      ...githubProjects.map(toGalleryProject),
      ...publishedProjects.map((project) => ({
        id: `drop-${project.slug}`,
        name: project.name,
        problem: "00AI DROP 공개 프로젝트",
        field: "공개",
        maker: "00AI 참여자",
        stack: project.slug,
        status: project.status,
        href: project.public_url,
        source: "drop" as const,
      })),
      ...coreProjects,
    ];
    const seen = new Set<string>();
    return candidates.filter((project) => {
      const key = project.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [githubProjects, publishedProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return galleryProjects;
    return galleryProjects.filter((project) =>
      `${project.name} ${project.problem} ${project.field} ${project.maker} ${project.stack}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [galleryProjects, query]);

  useEffect(() => {
    let active = true;
    fetch("/api/projects", { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) throw new Error("Project registry unavailable");
        return response.json();
      })
      .then((result) => {
        if (!active) return;
        setPublishedProjects(result.projects || []);
        setGitHubProjects(result.githubProjects || []);
        setGithubOwner(result.sources?.github?.owner || "ImZooMooGwan");
        setSyncState(
          result.sources?.github?.available ? "synced" : "degraded",
        );
      })
      .catch(() => {
        if (active) setSyncState("degraded");
      });
    return () => {
      active = false;
    };
  }, []);

  const selectFiles = (selected: FileList | null) =>
    setFiles(selected ? Array.from(selected) : []);

  const deploy = async () => {
    if (!projectName.trim()) {
      setDeployState("error");
      setMessage("프로젝트 이름을 입력해 주세요.");
      return;
    }
    if (!files.length) {
      setDeployState("error");
      setMessage("업로드할 파일을 선택해 주세요.");
      return;
    }

    setDeployState("uploading");
    setMessage("파일 검사와 저장을 진행하고 있습니다.");
    const data = new FormData();
    data.append("name", projectName.trim());
    data.append("visibility", "public");
    files.forEach((file) => data.append("files", file));

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        body: data,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "배포를 완료하지 못했습니다.");
      }
      setDeployState("done");
      setPublishedProjects((items) => [
        {
          slug: result.slug,
          name: result.name,
          public_url: result.publicUrl,
          status: result.status,
        },
        ...items,
      ]);
      setMessage(
        `${result.name} 파일이 안전하게 저장되었습니다. 00ai.kr 도메인 연결 후 ${result.publicUrl}에서 공개됩니다.`,
      );
    } catch (error) {
      setDeployState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "파일 저장 중 문제가 발생했습니다.",
      );
    }
  };

  const liveServiceCount = services.filter(
    (service) => service.status === "LIVE",
  ).length;
  const experimentCount = services.filter(
    (service) => service.status === "LAB" || service.status === "BETA",
  ).length;

  return (
    <main>
      <header className="nav-wrap">
        <nav className="nav" aria-label="주요 메뉴">
          <a className="brand" href="#top" aria-label="00AI 첫 화면">
            <span>00</span>AI
          </a>
          <div className="nav-links">
            <a href="#services">서비스</a>
            <a href="#projects">프로젝트</a>
            <a href="#deploy">배포</a>
            <a
              href="https://harness.00ai.kr/"
              target="_blank"
              rel="noreferrer"
            >
              Harness
            </a>
            <a href="#about">소개</a>
          </div>
          <div className="repository-links" aria-label="00AI 저장소">
            <a
              className="github"
              href="https://github.com/ImZooMooGwan/00AI"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <span aria-hidden>↗</span>
            </a>
            <a
              className="github gitlab"
              href="https://gitlab.aigov.go.kr/00AI"
              target="_blank"
              rel="noreferrer"
            >
              GitLab <span aria-hidden>↗</span>
            </a>
          </div>
        </nav>
      </header>

      <section id="top" className="hero section">
        <div className="eyebrow">
          <span className="pulse" />PUBLIC AI PLATFORM · v0.2
        </div>
        <h1>
          공공을 위한
          <br />
          <em>AI를 만듭니다.</em>
        </h1>
        <p className="hero-copy">
          정책분석, 행정업무 자동화, 공공데이터 활용부터
          <br className="desktop" /> AI 서비스 개발과 배포까지.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#services">
            AI 서비스 둘러보기 <span>→</span>
          </a>
          <a className="button ghost" href="#deploy">
            서비스 배포하기
          </a>
        </div>
        <div className="metric-row" aria-label="현재 서비스 현황">
          <div>
            <b>{String(liveServiceCount).padStart(2, "0")}</b>
            <span>운영 서비스</span>
          </div>
          <div>
            <b>{String(galleryProjects.length).padStart(2, "0")}</b>
            <span>공개 프로젝트</span>
          </div>
          <div>
            <b>{String(experimentCount).padStart(2, "0")}</b>
            <span>실험 서비스</span>
          </div>
        </div>
      </section>

      <section id="services" className="section section-rule">
        <div className="section-head">
          <div>
            <p className="kicker">SERVICES</p>
            <h2>
              바로 쓸 수 있는
              <br />
              공공 AI 서비스
            </h2>
          </div>
          <a className="text-link" href="#registry">
            전체 서비스 보기 <span>→</span>
          </a>
        </div>
        <div className="service-grid">
          {services.map((service, index) => (
            <article className="service-card" key={service.name}>
              <div className="card-top">
                <Badge status={service.status} />
                <span className="card-index">0{index + 1}</span>
              </div>
              <div>
                <p className="category">{service.category}</p>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>
              <div className="card-bottom">
                <div className="tags">
                  {service.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <a
                  href={service.href}
                  target={
                    service.href.startsWith("http") ? "_blank" : undefined
                  }
                  rel="noreferrer"
                >
                  열기 <span>→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="harness" className="harness section">
        <div className="harness-copy">
          <div className="eyebrow muted">
            <span className="ring" />00AI HARNESS · LAB
          </div>
          <h2>
            AI는 밖에서
            <br />
            <em>계획하고,</em>
            <br />
            실행은 안에서.
          </h2>
          <p>
            외부 AI에는 내부 데이터를 전달하지 않고, 추론계획만 요청합니다.
            실제 데이터 조회·문서 처리·행정 시스템 실행은 기관 내부 환경에서
            수행합니다.
          </p>
          <a className="text-link light" href="#about">
            구조 알아보기 <span>→</span>
          </a>
        </div>
        <div className="flow" aria-label="00AI Harness 실행 흐름">
          <div>사용자 요청</div>
          <span>↓</span>
          <div>요청 분석 · AI 추론계획</div>
          <span>↓</span>
          <div className="highlight">권한 확인 · 내부 데이터 검색</div>
          <span>↓</span>
          <div>행정 시스템 실행 · 문서 생성</div>
          <span>↓</span>
          <div>검증 · 결과 반환</div>
        </div>
      </section>

      <section id="deploy" className="deploy section section-rule">
        <div className="deploy-intro">
          <p className="kicker">
            00AI DROP <Badge status="BETA" />
          </p>
          <h2>
            파일을 놓으면
            <br />
            서비스가 됩니다.
          </h2>
          <p>
            HTML, CSS, JavaScript 또는 빌드가 완료된 웹앱을 올려보세요.
            ZIP 파일은 안전검사를 거쳐 자동으로 풀립니다.
          </p>
        </div>
        <div className="drop-panel">
          <label className="project-input">
            프로젝트 이름
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              maxLength={80}
              placeholder="예: 대전 청년정책 AI"
            />
          </label>
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFiles(event.dataTransfer.files);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                inputRef.current?.click();
              }
            }}
            onClick={() => inputRef.current?.click()}
          >
            <div className="drop-icon">↓</div>
            <h3>웹 서비스 파일을 놓으세요</h3>
            <p>ZIP · index.html · CSS · JS · 이미지 · 폰트</p>
            <button
              type="button"
              className="button ghost"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
            >
              파일 선택
            </button>
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              multiple
              accept=".zip,.html,.htm,.css,.js,.mjs,.json,.svg,.png,.jpg,.jpeg,.webp,.woff,.woff2"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                selectFiles(event.target.files)
              }
            />
          </div>
          {files.length > 0 && (
            <div className="file-list" aria-live="polite">
              <b>{files.length}개 파일 선택됨</b>
              {files.slice(0, 3).map((file) => (
                <span key={`${file.name}-${file.size}`}>
                  {file.name} <small>{Math.ceil(file.size / 1024)}KB</small>
                </span>
              ))}
              {files.length > 3 && <span>외 {files.length - 3}개</span>}
              <button
                className="button primary"
                type="button"
                disabled={deployState === "uploading"}
                onClick={deploy}
              >
                {deployState === "uploading"
                  ? "저장 중…"
                  : "파일 저장하기 →"}
              </button>
            </div>
          )}
          {deployState !== "idle" && (
            <p className={`deploy-message ${deployState}`} role="status">
              {message}
            </p>
          )}
          <div className="deploy-notes">
            <span>최대 50MB · 파일 1,000개</span>
            <span>ZIP 경로 이탈·실행 파일은 차단합니다</span>
          </div>
          <div className="github-import">
            <b>GitHub 자동 등록</b>
            <p>
              {githubOwner} 계정에 공개 저장소를 만들면 프로젝트 갤러리에
              자동으로 추가됩니다. 저장소의 설명·Homepage·Topics를 카드 정보로
              사용합니다.
            </p>
            <a
              className="text-link"
              href={`https://github.com/${githubOwner}?tab=repositories`}
              target="_blank"
              rel="noreferrer"
            >
              GitHub 프로젝트 관리 <span>→</span>
            </a>
          </div>
        </div>
      </section>

      <section id="projects" className="section section-rule">
        <div className="section-head">
          <div>
            <p className="kicker">PROJECTS</p>
            <h2>
              공공문제를 푸는
              <br />
              작은 시작들
            </h2>
          </div>
          <div className="project-section-meta">
            <p className="section-description">
              00AI에서 만든 서비스와 실험 중인 프로젝트를 공개합니다.
            </p>
            <p className={`project-sync ${syncState}`} aria-live="polite">
              <i />
              {syncState === "loading" && "GitHub 확인 중"}
              {syncState === "synced" &&
                `GitHub 자동 동기화 · ${githubProjects.length}개 연결`}
              {syncState === "degraded" &&
                "GitHub 연결 지연 · 기존 목록 표시 중"}
            </p>
          </div>
        </div>
        <div className="registry" id="registry">
          <div className="registry-tabs">
            <button
              className={tab === "services" ? "active" : ""}
              onClick={() => setTab("services")}
            >
              서비스 등록부
            </button>
            <button
              className={tab === "projects" ? "active" : ""}
              onClick={() => setTab("projects")}
            >
              프로젝트 갤러리 · {galleryProjects.length}
            </button>
            <label>
              <span className="sr-only">검색</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  tab === "services" ? "서비스 검색" : "프로젝트 검색"
                }
              />
            </label>
          </div>
          {tab === "services" ? (
            <div className="registry-list">
              {filteredServices.map((service) => (
                <div className="registry-row" key={service.name}>
                  <Badge status={service.status} />
                  <div>
                    <b>{service.name}</b>
                    <span>{service.description}</span>
                  </div>
                  <span className="row-category">{service.category}</span>
                  <a
                    href={service.href}
                    target={
                      service.href.startsWith("http") ? "_blank" : undefined
                    }
                    rel="noreferrer"
                  >
                    열기 →
                  </a>
                </div>
              ))}
              {filteredServices.length === 0 && (
                <p className="empty">검색 결과가 없습니다.</p>
              )}
            </div>
          ) : (
            <div className="project-list">
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className={`project-source-${project.source}`}
                >
                  <div className="project-mark">
                    {project.source === "github" ? "GH" : "00"}
                  </div>
                  <div>
                    <p>
                      {project.field} · {project.status}
                    </p>
                    <h3>{project.name}</h3>
                    <span>{project.problem}</span>
                  </div>
                  <dl>
                    <div>
                      <dt>제작</dt>
                      <dd>{project.maker}</dd>
                    </div>
                    <div>
                      <dt>기술</dt>
                      <dd>{project.stack}</dd>
                    </div>
                  </dl>
                  <a href={project.href} target="_blank" rel="noreferrer">
                    {projectLinkLabel(project)}
                  </a>
                </article>
              ))}
              {filteredProjects.length === 0 && (
                <p className="empty">검색 결과가 없습니다.</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section id="about" className="about section">
        <p className="kicker">ABOUT 00AI</p>
        <h2>
          공공의 문제를 AI로 해결하기 위한
          <br />
          <em>실험 플랫폼입니다.</em>
        </h2>
        <p>
          완성된 서비스뿐 아니라 실험 과정과 프로토타입도 공개합니다. 00AI는
          공식 정부 서비스가 아니며, 공공 AI의 실제 활용 방식을 만들고 검증하는
          독립 실험 플랫폼입니다.
        </p>
      </section>
      <footer>
        <a className="brand" href="#top">
          <span>00</span>AI
        </a>
        <p>Public AI Platform · 2026</p>
        <a href="#top">맨 위로 ↑</a>
      </footer>
    </main>
  );
}
