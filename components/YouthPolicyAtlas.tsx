"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  changes,
  formatPolicyStatus,
  policies,
  pulse,
  snapshot,
  sources,
  type PolicyCategory,
  type PolicyRecord,
  type SourceRecord,
} from "@/lib/data";

type GalaxyMode = "galaxy" | "category";
type PlaybackSpeed = 0.5 | 1 | 2;
type NodeKind = "core" | "category" | "policy" | "source";

interface GalaxyNode {
  id: string;
  kind: NodeKind;
  label: string;
  color: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  category?: PolicyCategory;
  policy?: PolicyRecord;
  source?: SourceRecord;
  count?: number;
}

interface GalaxyEdge {
  from: string;
  to: string;
  kind: "axis" | "policy" | "evidence" | "sibling";
}

interface ProjectedNode extends GalaxyNode {
  screenX: number;
  screenY: number;
  screenRadius: number;
  depth: number;
  scale: number;
}

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = 2.399963229728653;

const categoryMeta: Array<{ name: PolicyCategory; color: string }> = [
  { name: "일자리", color: "#58a7ff" },
  { name: "주거", color: "#8b7cff" },
  { name: "교육", color: "#5de0bd" },
  { name: "금융", color: "#ffc766" },
  { name: "복지·문화", color: "#ff6cae" },
  { name: "창업", color: "#ff8c68" },
  { name: "참여·기반", color: "#4fd6dd" },
];

const sourceKindLabels: Record<SourceRecord["kind"], string> = {
  policy_portal: "정책 포털",
  official_notice: "공식 공고",
  statistics: "국가통계",
  law: "법령 근거",
};

const staticStars = Array.from({ length: 380 }, (_, index) => ({
  x: hashNumber(`star-x-${index}`),
  y: hashNumber(`star-y-${index}`),
  depth: 0.2 + hashNumber(`star-d-${index}`) * 0.8,
  size: 0.35 + hashNumber(`star-s-${index}`) * 1.35,
  phase: hashNumber(`star-p-${index}`) * TAU,
}));

function hashNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function colorWithAlpha(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((character) => `${character}${character}`).join("")
    : value;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

function categoryPosition(index: number, mode: GalaxyMode) {
  if (mode === "category") {
    const column = index % 4;
    const row = Math.floor(index / 4);
    return {
      x: (column - 1.5) * 235,
      y: (row - 0.45) * 255,
      z: (column % 2 === 0 ? -1 : 1) * 34,
    };
  }

  const angle = -1.85 + (index / categoryMeta.length) * TAU;
  const radius = 300 + Math.sin(index * 1.7) * 28;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.68,
    z: Math.sin(angle * 2.15) * 165,
  };
}

function buildGraph(visiblePolicies: PolicyRecord[], mode: GalaxyMode) {
  const nodes: GalaxyNode[] = [{
    id: "core:yhub",
    kind: "core",
    label: "Y-HUB",
    color: "#dce8ff",
    x: 0,
    y: 0,
    z: 0,
    radius: 31,
  }];
  const edges: GalaxyEdge[] = [];
  const policyIds = new Set(visiblePolicies.map((policy) => policy.id));
  const usedSourceIds = new Set(visiblePolicies.map((policy) => policy.sourceId));

  categoryMeta.forEach((category, categoryIndex) => {
    const position = categoryPosition(categoryIndex, mode);
    const siblings = visiblePolicies.filter((policy) => policy.category === category.name);
    const categoryId = `category:${category.name}`;
    nodes.push({
      id: categoryId,
      kind: "category",
      label: category.name,
      color: category.color,
      ...position,
      radius: 20 + Math.min(siblings.length, 7) * 1.25,
      category: category.name,
      count: siblings.length,
    });
    edges.push({ from: "core:yhub", to: categoryId, kind: "axis" });

    siblings.forEach((policy, policyIndex) => {
      const seed = hashNumber(policy.id);
      const angle = policyIndex * GOLDEN_ANGLE + seed * 0.8;
      const localRadius = 58 + (policyIndex % 3) * 24 + seed * 16;
      const policyId = `policy:${policy.id}`;
      nodes.push({
        id: policyId,
        kind: "policy",
        label: policy.officialName,
        color: category.color,
        x: position.x + Math.cos(angle) * localRadius,
        y: position.y + Math.sin(angle) * localRadius * (mode === "category" ? 0.7 : 0.82),
        z: position.z + Math.sin(angle * 1.63) * (mode === "category" ? 36 : 72),
        radius: policy.status === "open" ? 7 : policy.status === "rolling" ? 5.8 : 4.8,
        category: policy.category,
        policy,
      });
      edges.push({ from: categoryId, to: policyId, kind: "policy" });
      edges.push({ from: policyId, to: `source:${policy.sourceId}`, kind: "evidence" });

      if (policyIndex > 0) {
        edges.push({
          from: `policy:${siblings[policyIndex - 1].id}`,
          to: policyId,
          kind: "sibling",
        });
      }
      policy.relatedPolicyIds.filter((id) => policyIds.has(id)).forEach((relatedId) => {
        edges.push({ from: policyId, to: `policy:${relatedId}`, kind: "sibling" });
      });
    });
  });

  const visibleSources = sources.filter((source) => usedSourceIds.has(source.id));
  visibleSources.forEach((source, index) => {
    const angle = -0.45 + (index / Math.max(visibleSources.length, 1)) * TAU;
    const radius = mode === "category" ? 570 : 510;
    nodes.push({
      id: `source:${source.id}`,
      kind: "source",
      label: source.name,
      color: source.kind === "law" ? "#ffcc7a" : source.kind === "statistics" ? "#65d7ff" : "#b6c3ff",
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.72,
      z: Math.cos(angle * 1.7) * 120,
      radius: source.kind === "law" ? 5.2 : 4.2,
      source,
    });
  });

  categoryMeta.forEach((category, index) => {
    const next = categoryMeta[(index + 1) % categoryMeta.length];
    edges.push({ from: `category:${category.name}`, to: `category:${next.name}`, kind: "sibling" });
  });

  return { nodes, edges };
}

function projectNode(
  node: GalaxyNode,
  width: number,
  height: number,
  yaw: number,
  pitch: number,
  zoom: number,
): ProjectedNode {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const rotatedX = node.x * cosYaw - node.z * sinYaw;
  const yawZ = node.x * sinYaw + node.z * cosYaw;
  const rotatedY = node.y * cosPitch - yawZ * sinPitch;
  const rotatedZ = node.y * sinPitch + yawZ * cosPitch;
  const perspective = 850 / Math.max(290, 850 + rotatedZ);
  const viewportScale = Math.max(0.43, Math.min(1.08, Math.min(width / 1180, height / 790)));
  const scale = perspective * viewportScale * zoom;
  return {
    ...node,
    screenX: width / 2 + rotatedX * scale,
    screenY: height / 2 + rotatedY * scale,
    screenRadius: Math.max(1.4, node.radius * scale),
    depth: rotatedZ,
    scale,
  };
}

export function YouthPolicyAtlas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const projectedRef = useRef<ProjectedNode[]>([]);
  const cameraRef = useRef({ yaw: 0.52, pitch: -0.16 });
  const visualTimeRef = useRef(0);
  const pointerRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    moved: false,
    resume: true,
    pinchDistance: 0,
    pinchZoom: 1,
  });

  const [mode, setMode] = useState<GalaxyMode>("galaxy");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"전체" | PolicyCategory>("전체");
  const [coreOnly, setCoreOnly] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [zoom, setZoom] = useState(1);
  const [cinematic, setCinematic] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState(changes.length);

  const searchMatches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return policies.filter((policy) => {
      const haystack = [
        policy.officialName,
        policy.summary,
        policy.category,
        policy.region,
        policy.leadOrganization,
        policy.legalBasis,
        ...policy.eligibility,
        ...policy.lifeSituations,
      ].join(" ").toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [query]);

  const visiblePolicies = useMemo(() => {
    const matchIds = new Set(searchMatches.map((policy) => policy.id));
    const hasQuery = query.trim().length > 0;
    return policies.filter((policy) => (
      (category === "전체" || policy.category === category)
      && (!coreOnly || policy.status === "open" || policy.status === "rolling")
      && (!hasQuery || matchIds.has(policy.id))
    ));
  }, [category, coreOnly, query, searchMatches]);

  const graph = useMemo(() => buildGraph(visiblePolicies, mode), [mode, visiblePolicies]);
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? null;
  const selectedSource = sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedPolicyChanges = selectedPolicy
    ? changes.filter((change) => change.policyId === selectedPolicy.id)
    : [];
  const activeChangePolicyIds = useMemo(
    () => new Set(changes.slice(0, timeline).map((change) => change.policyId)),
    [timeline],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = requestAnimationFrame(() => {
      if (media.matches) setPlaying(false);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        setUiHidden(false);
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "h" && document.activeElement?.tagName !== "INPUT") {
        setUiHidden((current) => !current);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!cinematic || visiblePolicies.length === 0) return;
    let index = 0;
    const interval = window.setInterval(() => {
      const policy = visiblePolicies[index % visiblePolicies.length];
      setSelectedPolicyId(policy.id);
      setSelectedSourceId(null);
      index += 1;
    }, 3800);
    return () => window.clearInterval(interval);
  }, [cinematic, visiblePolicies]);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;
    const contextCandidate = canvasElement.getContext("2d");
    if (!contextCandidate) return;
    const canvas: HTMLCanvasElement = canvasElement;
    const context: CanvasRenderingContext2D = contextCandidate;
    let frame = 0;
    let previous = performance.now();
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawGlow(node: ProjectedNode, alpha: number) {
      const gradient = context.createRadialGradient(
        node.screenX - node.screenRadius * 0.25,
        node.screenY - node.screenRadius * 0.25,
        0,
        node.screenX,
        node.screenY,
        node.screenRadius * 3.2,
      );
      gradient.addColorStop(0, colorWithAlpha("#ffffff", Math.min(0.95, alpha + 0.25)));
      gradient.addColorStop(0.18, colorWithAlpha(node.color, alpha));
      gradient.addColorStop(1, colorWithAlpha(node.color, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(node.screenX, node.screenY, node.screenRadius * 3.2, 0, TAU);
      context.fill();
    }

    function drawLabel(node: ProjectedNode, primary: string, secondary?: string) {
      const y = node.screenY + Math.max(18, node.screenRadius + 14);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `650 ${node.kind === "category" ? 13 : 11}px Pretendard, system-ui, sans-serif`;
      context.fillStyle = colorWithAlpha("#f0f4ff", node.depth < 320 ? 0.94 : 0.68);
      context.fillText(primary, node.screenX, y);
      if (secondary) {
        context.font = "500 9px ui-monospace, SFMono-Regular, monospace";
        context.fillStyle = "rgba(151, 163, 205, .72)";
        context.fillText(secondary, node.screenX, y + 14);
      }
    }

    function draw(now: number) {
      const elapsed = Math.min(50, now - previous);
      previous = now;
      if (playing) {
        visualTimeRef.current += elapsed * speed;
        cameraRef.current.yaw += elapsed * 0.000045 * speed * (cinematic ? 1.75 : 1);
        if (cinematic) cameraRef.current.pitch = -0.12 + Math.sin(visualTimeRef.current * 0.00018) * 0.2;
      }
      const time = visualTimeRef.current;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const background = context.createRadialGradient(width * 0.49, height * 0.48, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.78);
      background.addColorStop(0, "#101426");
      background.addColorStop(0.42, "#080b16");
      background.addColorStop(1, "#03050b");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      staticStars.forEach((star) => {
        const parallaxX = cameraRef.current.yaw * 52 * star.depth;
        const parallaxY = cameraRef.current.pitch * 34 * star.depth;
        const x = ((star.x * width + parallaxX) % width + width) % width;
        const y = ((star.y * height + parallaxY) % height + height) % height;
        const twinkle = 0.48 + Math.sin(time * 0.0012 + star.phase) * 0.28;
        context.fillStyle = `rgba(197, 210, 255, ${Math.max(0.1, twinkle) * star.depth})`;
        context.beginPath();
        context.arc(x, y, star.size * star.depth, 0, TAU);
        context.fill();
      });

      const projected = graph.nodes.map((node) => projectNode(
        node,
        width,
        height,
        cameraRef.current.yaw,
        cameraRef.current.pitch,
        zoom,
      ));
      projectedRef.current = projected;
      const projectedById = new Map(projected.map((node) => [node.id, node]));
      const highlightedId = selectedPolicyId ? `policy:${selectedPolicyId}` : selectedSourceId ? `source:${selectedSourceId}` : hoveredNodeId;

      if (showLines) {
        graph.edges.forEach((edge) => {
          const from = projectedById.get(edge.from);
          const to = projectedById.get(edge.to);
          if (!from || !to) return;
          const highlighted = highlightedId && (edge.from === highlightedId || edge.to === highlightedId);
          const alpha = highlighted ? 0.54 : edge.kind === "axis" ? 0.13 : edge.kind === "evidence" ? 0.075 : 0.095;
          context.strokeStyle = highlighted
            ? colorWithAlpha(to.color, alpha)
            : `rgba(142, 158, 220, ${alpha})`;
          context.lineWidth = highlighted ? 1.25 : edge.kind === "axis" ? 0.8 : 0.55;
          if (edge.kind === "evidence") context.setLineDash([2, 5]);
          else context.setLineDash([]);
          context.beginPath();
          context.moveTo(from.screenX, from.screenY);
          context.lineTo(to.screenX, to.screenY);
          context.stroke();
        });
        context.setLineDash([]);
      }

      [...projected].sort((left, right) => right.depth - left.depth).forEach((node) => {
        const isHovered = node.id === hoveredNodeId;
        const isSelected = node.id === highlightedId;
        const depthAlpha = Math.max(0.34, Math.min(1, 1.03 - (node.depth + 340) / 1200));

        if (node.kind === "core") {
          const corePulse = 1 + Math.sin(time * 0.0011) * 0.035;
          const radius = node.screenRadius * corePulse;
          const gradient = context.createRadialGradient(node.screenX - radius * 0.25, node.screenY - radius * 0.3, 0, node.screenX, node.screenY, radius * 2.6);
          gradient.addColorStop(0, "rgba(255,255,255,.98)");
          gradient.addColorStop(0.12, "rgba(129,203,255,.92)");
          gradient.addColorStop(0.42, "rgba(81,93,226,.38)");
          gradient.addColorStop(1, "rgba(65,72,190,0)");
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(node.screenX, node.screenY, radius * 2.6, 0, TAU);
          context.fill();
          context.fillStyle = "rgba(245,249,255,.97)";
          context.beginPath();
          context.arc(node.screenX, node.screenY, Math.max(4, radius * 0.21), 0, TAU);
          context.fill();
          drawLabel(node, "Y-HUB", `${visiblePolicies.length} POLICIES`);
          return;
        }

        if (node.kind === "category") {
          drawGlow(node, isHovered || isSelected ? 0.72 : 0.48 * depthAlpha);
          context.strokeStyle = colorWithAlpha(node.color, isHovered ? 0.76 : 0.28);
          context.lineWidth = isHovered ? 1.4 : 0.75;
          context.beginPath();
          context.arc(node.screenX, node.screenY, node.screenRadius * 1.55, 0, TAU);
          context.stroke();
          context.fillStyle = colorWithAlpha(node.color, 0.92 * depthAlpha);
          context.beginPath();
          context.arc(node.screenX, node.screenY, Math.max(3.2, node.screenRadius * 0.34), 0, TAU);
          context.fill();
          drawLabel(node, node.label, `${node.count ?? 0}개 정책`);
          return;
        }

        if (node.kind === "source") {
          const radius = Math.max(2.2, node.screenRadius * (isHovered || isSelected ? 1.55 : 1));
          context.save();
          context.translate(node.screenX, node.screenY);
          context.rotate(Math.PI / 4 + time * 0.00004);
          context.shadowColor = node.color;
          context.shadowBlur = isHovered || isSelected ? 18 : 8;
          context.fillStyle = colorWithAlpha(node.color, 0.84 * depthAlpha);
          context.fillRect(-radius, -radius, radius * 2, radius * 2);
          context.restore();
          if (isHovered || isSelected) drawLabel(node, truncate(node.label, 24), sourceKindLabels[node.source!.kind]);
          return;
        }

        const policy = node.policy!;
        const changed = activeChangePolicyIds.has(policy.id);
        if (changed) {
          const pulseRadius = node.screenRadius * (2.1 + ((time * 0.001 + hashNumber(policy.id)) % 1) * 2.2);
          context.strokeStyle = colorWithAlpha(policy.status === "open" ? "#63f1ca" : node.color, 0.32);
          context.lineWidth = 0.8;
          context.beginPath();
          context.arc(node.screenX, node.screenY, pulseRadius, 0, TAU);
          context.stroke();
        }
        if (isHovered || isSelected || policy.status === "open") drawGlow(node, isSelected ? 0.82 : policy.status === "open" ? 0.38 : 0.54);
        const radius = Math.max(2.1, node.screenRadius * (isHovered || isSelected ? 1.55 : 1));
        context.fillStyle = colorWithAlpha(policy.status === "unknown" ? "#7c85a1" : node.color, depthAlpha);
        context.beginPath();
        context.arc(node.screenX, node.screenY, radius, 0, TAU);
        context.fill();
        if (policy.status === "open") {
          context.strokeStyle = "rgba(105,255,214,.86)";
          context.lineWidth = 1;
          context.beginPath();
          context.arc(node.screenX, node.screenY, radius + 3, 0, TAU);
          context.stroke();
        }

        if (showParticles) {
          const particleCount = policy.verificationStatus === "verified" ? 6 : 4;
          for (let index = 0; index < particleCount; index += 1) {
            const angle = index / particleCount * TAU + time * 0.00022 * (index % 2 ? -1 : 1) + hashNumber(`${policy.id}-${index}`) * TAU;
            const orbit = radius + 5 + (index % 3) * 2.6;
            context.fillStyle = colorWithAlpha(node.color, 0.38 + (index % 2) * 0.2);
            context.beginPath();
            context.arc(node.screenX + Math.cos(angle) * orbit, node.screenY + Math.sin(angle) * orbit * 0.58, 0.75 + (index % 2) * 0.35, 0, TAU);
            context.fill();
          }
        }

        const showPolicyLabel = isHovered || isSelected || (zoom > 1.32 && (policy.status === "open" || policy.verificationStatus === "verified"));
        if (showPolicyLabel) drawLabel(node, truncate(policy.officialName, 22), `${policy.category} · ${formatPolicyStatus(policy.status)}`);
      });

      const hovered = projectedById.get(hoveredNodeId ?? "");
      if (hovered && hovered.kind !== "category" && hovered.kind !== "core") {
        const title = hovered.kind === "policy" ? hovered.policy!.officialName : hovered.source!.name;
        const meta = hovered.kind === "policy"
          ? `${hovered.policy!.category} · ${formatPolicyStatus(hovered.policy!.status)}`
          : sourceKindLabels[hovered.source!.kind];
        const boxWidth = Math.min(290, Math.max(150, title.length * 9.4));
        const boxX = Math.min(width - boxWidth - 14, Math.max(14, hovered.screenX - boxWidth / 2));
        const boxY = Math.max(78, hovered.screenY - hovered.screenRadius - 62);
        context.fillStyle = "rgba(10,13,25,.92)";
        context.strokeStyle = colorWithAlpha(hovered.color, 0.38);
        context.lineWidth = 0.8;
        context.beginPath();
        context.roundRect(boxX, boxY, boxWidth, 45, 10);
        context.fill();
        context.stroke();
        context.textAlign = "left";
        context.font = "650 11px Pretendard, system-ui, sans-serif";
        context.fillStyle = "rgba(243,246,255,.95)";
        context.fillText(truncate(title, 31), boxX + 12, boxY + 17);
        context.font = "500 9px ui-monospace, monospace";
        context.fillStyle = "rgba(159,171,214,.78)";
        context.fillText(meta, boxX + 12, boxY + 33);
      }

      frame = requestAnimationFrame(draw);
    }

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [
    activeChangePolicyIds,
    cinematic,
    graph,
    hoveredNodeId,
    playing,
    selectedPolicyId,
    selectedSourceId,
    showLines,
    showParticles,
    speed,
    visiblePolicies.length,
    zoom,
  ]);

  function hitTest(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return [...projectedRef.current]
      .filter((node) => node.kind !== "core")
      .sort((left, right) => left.depth - right.depth)
      .find((node) => Math.hypot(node.screenX - x, node.screenY - y) <= Math.max(12, node.screenRadius + 6)) ?? null;
  }

  function selectNode(node: ProjectedNode | null) {
    if (!node) return;
    if (node.kind === "policy" && node.policy) {
      setSelectedPolicyId(node.policy.id);
      setSelectedSourceId(null);
    } else if (node.kind === "source" && node.source) {
      setSelectedSourceId(node.source.id);
      setSelectedPolicyId(null);
    } else if (node.kind === "category" && node.category) {
      setCategory((current) => current === node.category ? "전체" : node.category!);
      setSelectedPolicyId(null);
      setSelectedSourceId(null);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const resume = playing;
    if (pointerRef.current.size === 1) {
      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startYaw: cameraRef.current.yaw,
        startPitch: cameraRef.current.pitch,
        moved: false,
        resume,
        pinchDistance: 0,
        pinchZoom: zoom,
      };
      setPlaying(false);
      setDragging(true);
    } else if (pointerRef.current.size === 2) {
      const [first, second] = [...pointerRef.current.values()];
      dragRef.current.pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      dragRef.current.pinchZoom = zoom;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current.has(event.pointerId)) {
      pointerRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    if (pointerRef.current.size >= 2) {
      const [first, second] = [...pointerRef.current.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (dragRef.current.pinchDistance > 0) {
        setZoom(Math.min(2.35, Math.max(0.58, dragRef.current.pinchZoom * distance / dragRef.current.pinchDistance)));
      }
      dragRef.current.moved = true;
      return;
    }
    if (dragRef.current.active && dragRef.current.pointerId === event.pointerId) {
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;
      if (Math.hypot(deltaX, deltaY) > 4) dragRef.current.moved = true;
      cameraRef.current.yaw = dragRef.current.startYaw + deltaX * 0.0062;
      cameraRef.current.pitch = Math.min(1.05, Math.max(-1.05, dragRef.current.startPitch + deltaY * 0.0048));
      return;
    }
    const hovered = hitTest(event.clientX, event.clientY);
    setHoveredNodeId((current) => current === hovered?.id ? current : hovered?.id ?? null);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    const wasPrimary = dragRef.current.pointerId === event.pointerId;
    const moved = dragRef.current.moved;
    const resume = dragRef.current.resume;
    pointerRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (wasPrimary && !moved) selectNode(hitTest(event.clientX, event.clientY));
    if (pointerRef.current.size === 0) {
      dragRef.current.active = false;
      setDragging(false);
      if (resume) setPlaying(true);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    setZoom((current) => Math.min(2.35, Math.max(0.58, current - event.deltaY * 0.00115)));
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (event.key === "ArrowLeft") cameraRef.current.yaw -= 0.12;
    else if (event.key === "ArrowRight") cameraRef.current.yaw += 0.12;
    else if (event.key === "ArrowUp") cameraRef.current.pitch = Math.max(-1.05, cameraRef.current.pitch - 0.1);
    else if (event.key === "ArrowDown") cameraRef.current.pitch = Math.min(1.05, cameraRef.current.pitch + 0.1);
    else if (event.key === "+" || event.key === "=") setZoom((current) => Math.min(2.35, current + 0.12));
    else if (event.key === "-" || event.key === "_") setZoom((current) => Math.max(0.58, current - 0.12));
    else if (event.key === " ") {
      event.preventDefault();
      setPlaying((current) => !current);
    } else if (event.key === "Escape") {
      setSelectedPolicyId(null);
      setSelectedSourceId(null);
    }
  }

  function resetCamera() {
    cameraRef.current = { yaw: 0.52, pitch: -0.16 };
    setZoom(1);
  }

  function cycleCategory(direction: -1 | 1) {
    const currentIndex = category === "전체" ? -1 : categoryMeta.findIndex((item) => item.name === category);
    const nextIndex = (currentIndex + direction + categoryMeta.length) % categoryMeta.length;
    setCategory(categoryMeta[nextIndex].name);
    setSelectedPolicyId(null);
    setSelectedSourceId(null);
  }

  function chooseSearchResult(policy: PolicyRecord) {
    setQuery(policy.officialName);
    setCategory("전체");
    setSelectedPolicyId(policy.id);
    setSelectedSourceId(null);
    searchRef.current?.blur();
  }

  const timelineLabel = timeline === changes.length
    ? "현재"
    : new Date(changes[Math.max(0, timeline - 1)]?.detectedAt ?? snapshot.generatedAt).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Seoul",
    });

  return (
    <section className={`yh-galaxy-experience ${uiHidden ? "ui-hidden" : ""} ${dragging ? "is-dragging" : ""}`} aria-labelledby="galaxy-title">
      <canvas
        ref={canvasRef}
        className="yh-galaxy-canvas"
        tabIndex={0}
        role="img"
        aria-labelledby="atlas-graph-title atlas-graph-desc"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onPointerLeave={() => { if (!dragging) setHoveredNodeId(null); }}
        onWheel={handleWheel}
        onDoubleClick={resetCamera}
        onKeyDown={handleCanvasKeyDown}
      />
      <span className="sr-only" id="atlas-graph-title">대한민국 청년정책 은하 관계지도</span>
      <span className="sr-only" id="atlas-graph-desc">분야는 행성, 정책은 입자 무리, 공식 출처는 성좌로 표현됩니다. 드래그로 회전하고 휠이나 손가락으로 확대하며 노드를 선택해 세부 내용을 볼 수 있습니다.</span>
      <div className="yh-space-vignette" aria-hidden="true" />

      <div className="yh-ui-chrome yh-topbar">
        <Link className="yh-galaxy-brand" href="/" aria-label="Y-HUB 정책 은하 홈">
          <span className="yh-brand-orb" aria-hidden="true"><i /></span>
          <span>
            <b id="galaxy-title">청년정책 은하 <em>· Y-HUB 온톨로지</em></b>
            <small>분야는 행성 · 정책은 입자 무리 · 공식 출처는 성좌 — 정책 {policies.length}개</small>
          </span>
        </Link>
        <div className="yh-galaxy-actions">
          <form className="yh-galaxy-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <span aria-hidden="true">⌕</span>
            <label className="sr-only" htmlFor="galaxy-query">정책·기관·지역 검색</label>
            <input
              ref={searchRef}
              id="galaxy-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="정책·기관·지역 검색 — /"
              autoComplete="off"
            />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
            <kbd>/</kbd>
            {query && (
              <div className="yh-search-results" role="listbox" aria-label="정책 검색 결과">
                {searchMatches.slice(0, 7).map((policy) => (
                  <button type="button" role="option" aria-selected={policy.id === selectedPolicyId} key={policy.id} onClick={() => chooseSearchResult(policy)}>
                    <i style={{ background: categoryMeta.find((item) => item.name === policy.category)?.color }} />
                    <span><b>{policy.officialName}</b><small>{policy.category} · {policy.region} · {formatPolicyStatus(policy.status)}</small></span>
                  </button>
                ))}
                {searchMatches.length === 0 && <p>일치하는 정책이 없습니다.</p>}
              </div>
            )}
          </form>
          <div className="yh-mode-switch" role="group" aria-label="정책 은하 보기 방식">
            <button type="button" className={mode === "galaxy" ? "active" : ""} aria-pressed={mode === "galaxy"} onClick={() => setMode("galaxy")}>은하</button>
            <button type="button" className={mode === "category" ? "active" : ""} aria-pressed={mode === "category"} onClick={() => setMode("category")}>분야별</button>
          </div>
          <button type="button" className={`yh-cinema-button ${cinematic ? "active" : ""}`} aria-pressed={cinematic} onClick={() => { setCinematic((current) => !current); setPlaying(true); }}><i />시네마</button>
          <details className="yh-map-menu">
            <summary aria-label="다른 Y-HUB 화면 열기">•••</summary>
            <nav aria-label="Y-HUB 주요 메뉴">
              <Link href="/policies">정책 대장</Link>
              <Link href="/changes">변화 추적</Link>
              <Link href="/map">지역 지도</Link>
              <Link href="/indicators">청년 지표</Link>
              <Link href="/api">Open API</Link>
              <Link href="/admin">수집 관제</Link>
            </nav>
          </details>
          <button type="button" className="yh-hide-ui" onClick={() => setUiHidden(true)} aria-label="UI 감추기 — 우주만 남기기 (H)">◉</button>
        </div>
      </div>

      <button type="button" className="yh-ui-restore" onClick={() => setUiHidden(false)} aria-label="UI 다시 보이기">Y-HUB UI</button>
      <button type="button" className="yh-side-arrow left yh-ui-chrome" onClick={() => cycleCategory(-1)} aria-label="이전 정책 분야">‹</button>
      <button type="button" className="yh-side-arrow right yh-ui-chrome" onClick={() => cycleCategory(1)} aria-label="다음 정책 분야">›</button>

      <div className="yh-ui-chrome yh-active-scope" aria-live="polite">
        <span><i className={playing ? "live" : ""} />{playing ? `${cinematic ? "CINEMA · " : ""}${speed}× 공전 중` : "정지됨"}</span>
        <b>{category === "전체" ? "전체 정책 우주" : `${category} 성좌`}</b>
        <small>{visiblePolicies.length}개 정책 · {activeChangePolicyIds.size}개 변화 신호</small>
        {(category !== "전체" || query || coreOnly) && <button type="button" onClick={() => { setCategory("전체"); setQuery(""); setCoreOnly(false); }}>필터 해제</button>}
      </div>

      <div className="yh-ui-chrome yh-category-legend" aria-label="정책 분야 범례">
        {categoryMeta.map((item) => (
          <button type="button" key={item.name} className={category === item.name ? "active" : ""} onClick={() => setCategory((current) => current === item.name ? "전체" : item.name)}>
            <i style={{ backgroundColor: item.color }} />{item.name}<b>{policies.filter((policy) => policy.category === item.name).length}</b>
          </button>
        ))}
      </div>

      <div className="yh-ui-chrome yh-controlbar" aria-label="정책 은하 움직임 제어">
        <label className="yh-switch-control"><input type="checkbox" checked={showLines} onChange={(event) => setShowLines(event.target.checked)} /><i /><span>관계 성좌</span></label>
        <label className="yh-switch-control"><input type="checkbox" checked={coreOnly} onChange={(event) => setCoreOnly(event.target.checked)} /><i /><span>핵심 정책만</span></label>
        <label className="yh-switch-control"><input type="checkbox" checked={showParticles} onChange={(event) => setShowParticles(event.target.checked)} /><i /><span>정책 입자</span></label>
        <div className="yh-timeline-control">
          <span>변화 연대기</span>
          <button type="button" onClick={() => setTimeline(0)} aria-label="변화 연대기 처음으로">|‹</button>
          <button className="yh-play-button" type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "자동 공전 일시 정지" : "자동 공전 재생"}>{playing ? "Ⅱ" : "▶"}</button>
          <div className="yh-speed-buttons" role="group" aria-label="공전 속도">
            {([0.5, 1, 2] as PlaybackSpeed[]).map((value) => <button type="button" key={value} className={speed === value ? "active" : ""} aria-pressed={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
          </div>
          <input aria-label="정책 변화 연대기" type="range" min="0" max={changes.length} value={timeline} onChange={(event) => setTimeline(Number(event.target.value))} />
          <b><i />{timelineLabel}</b>
        </div>
        <button type="button" className="yh-reset-camera" onClick={resetCamera}>시점 초기화 · {Math.round(zoom * 100)}%</button>
      </div>

      <div className="yh-ui-chrome yh-data-credit">
        <span>참고용 데이터 · 기준일 {snapshot.basisDate}</span>
        <Link href="/sources">공식 출처 {sources.length}개 ↗</Link>
        <Link href="/changes">오늘 변화 {pulse.detectedToday}건 ↗</Link>
      </div>

      <aside className={`yh-detail-panel ${(selectedPolicy || selectedSource) ? "open" : ""}`} aria-label="선택한 정책 또는 출처 상세">
        <button type="button" className="yh-detail-close" onClick={() => { setSelectedPolicyId(null); setSelectedSourceId(null); }} aria-label="상세 패널 닫기">×</button>
        {selectedPolicy && (
          <>
            <header>
              <span><i style={{ backgroundColor: categoryMeta.find((item) => item.name === selectedPolicy.category)?.color }} />{selectedPolicy.category} 성좌</span>
              <b>{selectedPolicy.id}</b>
            </header>
            <div className="yh-detail-status"><em className={`status-${selectedPolicy.status}`}><i />{formatPolicyStatus(selectedPolicy.status)}</em><span>{selectedPolicy.region}</span><span>{selectedPolicy.verificationStatus === "verified" ? "검증 완료" : "검증 진행"}</span></div>
            <h2>{selectedPolicy.officialName}</h2>
            <p>{selectedPolicy.summary}</p>
            <dl>
              <div><dt>지원</dt><dd>{selectedPolicy.benefit}</dd></div>
              <div><dt>대상</dt><dd>{selectedPolicy.age} · {selectedPolicy.eligibility.join(" · ")}</dd></div>
              <div><dt>기관</dt><dd>{selectedPolicy.leadOrganization}</dd></div>
              <div><dt>기간</dt><dd>{selectedPolicy.applicationPeriod}</dd></div>
              <div><dt>근거</dt><dd>{selectedPolicy.legalBasis}</dd></div>
            </dl>
            {selectedPolicyChanges.length > 0 && (
              <section className="yh-detail-changes">
                <h3><i />관측된 변화 {selectedPolicyChanges.length}건</h3>
                {selectedPolicyChanges.slice(0, 3).map((change) => <p key={change.id}><b>{change.type}</b><span>{change.summary}</span></p>)}
              </section>
            )}
            <Link className="yh-detail-link" href={`/policy/${selectedPolicy.slug}`}>정책 원문·변경 이력 열기 <span>↗</span></Link>
          </>
        )}
        {selectedSource && (
          <>
            <header><span><i style={{ backgroundColor: selectedSource.kind === "law" ? "#ffcc7a" : "#8aa5ff" }} />공식 출처 성좌</span><b>{selectedSource.id}</b></header>
            <div className="yh-detail-status"><em><i />{sourceKindLabels[selectedSource.kind]}</em><span>공식 원천</span></div>
            <h2>{selectedSource.name}</h2>
            <p>{selectedSource.organization}이 제공하는 Y-HUB 정책 근거 원천입니다.</p>
            <dl>
              <div><dt>기관</dt><dd>{selectedSource.organization}</dd></div>
              <div><dt>수집</dt><dd>{new Date(selectedSource.fetchedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</dd></div>
              <div><dt>이용</dt><dd>{selectedSource.license}</dd></div>
              <div><dt>연결</dt><dd>{policies.filter((policy) => policy.sourceId === selectedSource.id).length}개 정책</dd></div>
            </dl>
            <a className="yh-detail-link" href={selectedSource.url} target="_blank" rel="noreferrer">공식 출처 열기 <span>↗</span></a>
          </>
        )}
      </aside>

      <div className="sr-only" aria-live="polite">
        {selectedPolicy ? `${selectedPolicy.officialName} 정책을 선택했습니다.` : selectedSource ? `${selectedSource.name} 출처를 선택했습니다.` : "정책 은하를 탐색 중입니다."}
      </div>
    </section>
  );
}
