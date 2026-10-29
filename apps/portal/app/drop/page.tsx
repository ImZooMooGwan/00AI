"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "./drop-tool.css";

const MAX_FILES = 1000;
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".zip", ".html", ".htm", ".css", ".js", ".mjs", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"];
type DeployState = "checking" | "ready" | "unavailable" | "uploading" | "success" | "error";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.ceil(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DropPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [organization, setOrganization] = useState("");
  const [uploaderName, setUploaderName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<DeployState>("checking");
  const [statusMessage, setStatusMessage] = useState("배포 저장소 연결을 확인하고 있습니다.");
  const [message, setMessage] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const filesValid = files.length > 0 && files.length <= MAX_FILES && totalBytes <= MAX_BYTES;
  const canSubmit = state !== "checking" && state !== "unavailable" && state !== "uploading" && state !== "success"
    && Boolean(organization.trim() && uploaderName.trim() && projectName.trim() && description.trim().length >= 5)
    && filesValid && consent;

  useEffect(() => {
    let active = true;
    fetch("/api/deploy", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.available !== true) throw new Error(result.error || "배포 저장소에 연결할 수 없습니다.");
        if (active) {
          setState("ready");
          setProjectCount(typeof result.count === "number" ? result.count : null);
          setStatusMessage("배포 저장소 연결됨 · 업로드할 수 있습니다.");
        }
      })
      .catch((error) => {
        if (!active) return;
        setState("unavailable");
        setStatusMessage(error instanceof Error ? error.message : "배포 저장소 상태를 확인하지 못했습니다.");
      });
    return () => { active = false; };
  }, []);

  const chooseFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming);
    setMessage("");
    setPublicUrl("");
    if (next.length > MAX_FILES) {
      setFiles([]);
      setState("error");
      setMessage("파일은 한 번에 최대 " + MAX_FILES.toLocaleString() + "개까지 올릴 수 있습니다.");
      return;
    }
    const unsupported = next.find((file) => !ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)));
    if (unsupported) {
      setFiles([]);
      setState("error");
      setMessage("지원하지 않는 파일 형식입니다: " + unsupported.name);
      return;
    }
    const total = next.reduce((sum, file) => sum + file.size, 0);
    if (total > MAX_BYTES) {
      setFiles([]);
      setState("error");
      setMessage("전체 파일 크기는 50MB 이하여야 합니다. 완성된 웹앱은 ZIP 파일로 압축해 올려주세요.");
      return;
    }
    setFiles(next);
    setState((current) => current === "unavailable" ? current : "ready");
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFiles(event.dataTransfer.files);
  };

  const deploy = async () => {
    if (!canSubmit) return;
    setState("uploading");
    setMessage("파일 형식과 크기를 확인한 뒤 저장하고 있습니다.");
    const data = new FormData();
    data.append("organization", organization.trim());
    data.append("uploaderName", uploaderName.trim());
    data.append("name", projectName.trim());
    data.append("description", description.trim());
    data.append("visibility", "public");
    files.forEach((file) => data.append("files", file, file.name));

    try {
      const response = await fetch("/api/deploy", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "배포에 실패했습니다. (오류 " + response.status + ")");
      if (typeof result.publicUrl !== "string" || !/^https:\/\/[a-z0-9-]+\.00ai\.kr\/$/.test(result.publicUrl)) {
        throw new Error("파일은 저장됐지만 공개 주소를 확인하지 못했습니다. 운영자에게 상태를 알려주세요.");
      }
      setPublicUrl(result.publicUrl);
      setState("success");
      setProjectCount((count) => count === null ? null : count + 1);
      setMessage((result.name || projectName) + " 배포를 완료했습니다.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "파일 저장 중 문제가 발생했습니다.");
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setMessage("주소를 복사하지 못했습니다. 공개 주소를 직접 선택해 복사해 주세요.");
    }
  };

  return (
    <main className="drop-page">
      <header className="drop-header">
        <Link className="drop-brand" href="/" aria-label="00AI 홈으로 돌아가기"><span>00</span><b>AI<small>PUBLIC WORK TOOLS</small></b></Link>
        <Link className="drop-back" href="/">00AI 서비스 목록 <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="drop-hero">
        <p className="drop-eyebrow"><span className="drop-live-dot" /> 00AI / SERVICE PUBLISHER</p>
        <h1>완성한 웹 서비스를<br /><em>바로 배포하세요.</em></h1>
        <p>정적 웹 파일이나 ZIP을 올리면 공개 주소를 발급합니다.<br className="drop-desktop-only" /> 저장 전에 파일과 공개 정보를 확인합니다.</p>
        <div className={"drop-health " + (state === "ready" || state === "success" ? "is-ready" : state === "unavailable" ? "is-error" : "")} role="status">
          <span className="drop-health-dot" />
          <span>{statusMessage}</span>
          {projectCount !== null && <small>등록 프로젝트 {projectCount}개</small>}
        </div>
      </section>

      <section className="drop-workspace" aria-label="서비스 배포">
        <form className="drop-form" onSubmit={(event) => { event.preventDefault(); void deploy(); }}>
          <div className="drop-section-title"><span>01</span><div><h2>공개 정보</h2><p>입력한 정보는 배포 페이지에서 공개됩니다.</p></div></div>
          <div className="drop-fields">
            <label>소속<input value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={80} autoComplete="organization" placeholder="예: 대전광역시 청년정책과 / 개인" required /></label>
            <label>성명<input value={uploaderName} onChange={(event) => setUploaderName(event.target.value)} maxLength={40} autoComplete="name" placeholder="공개할 이름" required /></label>
            <label className="drop-field-full">서비스 이름<input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} placeholder="예: 공공문서 검토 도구" required /></label>
            <label className="drop-field-full">서비스 설명<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} minLength={5} placeholder="무엇을 해결하는 서비스인지 설명해 주세요." required /><small>{description.length} / 600자</small></label>
          </div>

          <div className="drop-section-title drop-file-title"><span>02</span><div><h2>배포 파일</h2><p>완성된 웹앱은 파일 구조가 유지되도록 ZIP으로 올려주세요.</p></div></div>
          <div className={"drop-upload-zone " + (dragging ? "is-dragging " : "") + (files.length ? "has-files" : "")}
            role="button" tabIndex={0} aria-label="배포 파일 선택 또는 끌어놓기"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}>
            <input ref={inputRef} type="file" multiple accept={ALLOWED_EXTENSIONS.join(",")} onChange={(event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) chooseFiles(event.target.files); }} />
            <span className="drop-upload-icon" aria-hidden="true">↑</span>
            <strong>{files.length ? files.length + "개 파일 선택됨" : "파일을 여기로 끌어오거나 선택하세요"}</strong>
            <span>ZIP · HTML · CSS · JavaScript · 이미지 · 폰트</span>
            <span className="drop-file-button">파일 선택</span>
          </div>
          {files.length > 0 && <div className="drop-file-summary" aria-live="polite">
            <div><strong>{files.length.toLocaleString()}개 파일</strong><span>{formatBytes(totalBytes)} / 50 MB</span></div>
            <button type="button" onClick={() => { setFiles([]); setPublicUrl(""); setMessage(""); if (state !== "unavailable") setState("ready"); }}>선택 지우기</button>
            <ul>{files.slice(0, 4).map((file, index) => <li key={file.name + "-" + file.size + "-" + index}>{file.name}<span>{formatBytes(file.size)}</span></li>)}</ul>
            {files.length > 4 && <small>외 {files.length - 4}개 파일</small>}
          </div>}

          <label className="drop-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>서비스 파일과 입력한 소속·성명·설명 전체가 인터넷에 공개되는 것에 동의합니다.</span></label>
          <p className="drop-safety-note"><b>공개 전 확인</b> 개인정보, 비공개 문서, API 키·비밀번호가 포함된 파일은 올리지 마세요. 배포된 파일은 누구나 주소로 열 수 있습니다. ZIP은 루트에 <code>index.html</code>을 포함해 주세요.</p>

          {message && <div className={"drop-result " + (state === "success" ? "is-success" : state === "error" ? "is-error" : "")} role="status">
            <p>{message}</p>
            {publicUrl && <div className="drop-result-actions"><a href={publicUrl} target="_blank" rel="noreferrer">배포 서비스 열기 ↗</a><button type="button" onClick={() => void copyUrl()}>{copied ? "복사 완료" : "주소 복사"}</button></div>}
          </div>}

          <button className="drop-submit" type="submit" disabled={!canSubmit}>{state === "uploading" ? "저장 및 배포 중…" : "공개 배포하기"}<span aria-hidden="true">↗</span></button>
          <p className="drop-limit-note">최대 50MB · 최대 1,000개 파일 · ZIP 권장</p>
        </form>

        <aside className="drop-help">
          <div className="drop-help-card"><span>DEPLOY FLOW</span><h2>세 단계로<br />서비스를 공개합니다.</h2><ol><li><b>파일 선택</b><small>ZIP 또는 정적 웹 파일을 준비합니다.</small></li><li><b>정보 확인</b><small>공개될 서비스 이름과 설명을 입력합니다.</small></li><li><b>주소 발급</b><small>프로젝트 전용 .00ai.kr 주소를 확인합니다.</small></li></ol></div>
          <div className="drop-help-card is-muted"><b>ZIP 배포가 잘 되는 조건</b><p>압축을 풀었을 때 첫 화면 파일이 최상위 폴더에 있는지 확인하세요. 보통 <code>index.html</code> 또는 빌드 폴더의 내용 전체를 압축하면 됩니다.</p></div>
          <a className="drop-support" href="https://github.com/ImZooMooGwan/00AI/issues" target="_blank" rel="noreferrer">배포에 문제가 있나요? GitHub 이슈로 알려주세요 ↗</a>
        </aside>
      </section>
      <footer className="drop-footer"><Link href="/">← 00AI 서비스 허브</Link><span>00AI DROP · 공개 웹 서비스 배포 도구</span></footer>
    </main>
  );
}
