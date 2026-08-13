"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { readJsonResponse } from "@/lib/api-response";
import { generateId } from "@/lib/training/id";
import { FUNNEL_STICKY_COLORS } from "@/lib/marketing/funnel-types";
import type { FunnelBoard, FunnelEdge, FunnelNode, FunnelNodeKind, FunnelViewport } from "@/lib/marketing/funnel-types";

type Tool = "select" | "sticky" | "step" | "connect";
type Drag =
  | { kind: "pan"; x: number; y: number; vx: number; vy: number }
  | { kind: "node"; id: string; dx: number; dy: number };

const STEP_SIZE = { w: 240, h: 112 };
const STICKY_SIZE = { w: 200, h: 140 };

function screenToWorld(clientX: number, clientY: number, rect: DOMRect, viewport: FunnelViewport) {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale
  };
}

function clampScale(value: number) {
  return Math.min(2.4, Math.max(0.28, value));
}

function nodeAnchor(node: FunnelNode, side: "left" | "right") {
  return {
    x: side === "left" ? node.x : node.x + node.w,
    y: node.y + node.h / 2
  };
}

function edgePath(from: FunnelNode, to: FunnelNode) {
  const a = nodeAnchor(from, "right");
  const b = nodeAnchor(to, "left");
  const mid = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + mid} ${a.y}, ${b.x - mid} ${b.y}, ${b.x} ${b.y}`;
}

export function FunnelBoardScreen({ funnelId }: { funnelId: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number | null>(null);
  const boardRef = useRef<FunnelBoard | null>(null);
  const [board, setBoard] = useState<FunnelBoard | null>(null);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState<string>(FUNNEL_STICKY_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const drag = useRef<Drag | null>(null);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch(`/api/marketing/funnels/${encodeURIComponent(funnelId)}`, { cache: "no-store" });
    const payload = await readJsonResponse<{ ok: true; funnel: FunnelBoard } | { ok: false; error: string }>(response);
    if (!response.ok || !("ok" in payload) || payload.ok !== true) {
      throw new Error("error" in payload ? payload.error : "Не удалось открыть воронку");
    }
    setBoard(payload.funnel);
    boardRef.current = payload.funnel;
  }, [funnelId]);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    });
  }, [load]);

  const persist = useCallback((next: FunnelBoard) => {
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/marketing/funnels/${encodeURIComponent(funnelId)}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: next.title,
              description: next.description,
              stage: next.stage,
              viewport: next.viewport,
              nodes: next.nodes,
              edges: next.edges
            })
          });
          const payload = await readJsonResponse<{ ok: true } | { ok: false; error: string }>(response);
          if (!response.ok || !("ok" in payload) || payload.ok !== true) {
            throw new Error("error" in payload ? payload.error : "Ошибка сохранения");
          }
          setSaveState("saved");
        } catch {
          setSaveState("error");
        }
      })();
    }, 700);
  }, [funnelId]);

  const updateBoard = useCallback(
    (mutator: (current: FunnelBoard) => FunnelBoard) => {
      setBoard((current) => {
        if (!current) return current;
        const next = mutator(current);
        boardRef.current = next;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const patchBoard = (mutator: (current: FunnelBoard) => FunnelBoard) => {
    setBoard((current) => {
      if (!current) return current;
      const next = mutator(current);
      boardRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " && !event.repeat && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setSpaceDown(true);
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        updateBoard((current) => {
          if (selectedEdge) {
            return { ...current, edges: current.edges.filter((item) => item.id !== selectedEdge) };
          }
          if (!selectedId) return current;
          return {
            ...current,
            nodes: current.nodes.filter((item) => item.id !== selectedId),
            edges: current.edges.filter((item) => item.from !== selectedId && item.to !== selectedId)
          };
        });
        setSelectedId(null);
        setSelectedEdge(null);
        setEditingId(null);
      }
      if (event.key === "Escape") {
        setTool("select");
        setConnectFrom(null);
        setSelectedId(null);
        setSelectedEdge(null);
        setEditingId(null);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [selectedEdge, selectedId, updateBoard]);

  const addNode = (kind: FunnelNodeKind, x: number, y: number) => {
    const size = kind === "step" ? STEP_SIZE : STICKY_SIZE;
    const created: FunnelNode = {
      id: generateId("node"),
      kind,
      x,
      y,
      w: size.w,
      h: size.h,
      color: kind === "step" ? "#ffffff" : color,
      text: kind === "step" ? "Новый шаг" : "Стикер"
    };
    updateBoard((current) => ({ ...current, nodes: [...current.nodes, created] }));
    setSelectedId(created.id);
    setEditingId(created.id);
    setTool("select");
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onNativeWheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = boardRef.current;
      if (!current) return;
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(event.clientX, event.clientY, rect, current.viewport);
      const nextScale = clampScale(current.viewport.scale * (event.deltaY > 0 ? 0.9 : 1.1));
      updateBoard(() => ({
        ...current,
        viewport: {
          scale: nextScale,
          x: event.clientX - rect.left - world.x * nextScale,
          y: event.clientY - rect.top - world.y * nextScale
        }
      }));
    };
    canvas.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onNativeWheel);
  }, [board?.id, updateBoard]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!board) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const world = screenToWorld(event.clientX, event.clientY, rect, board.viewport);
    const panMode = spaceDown || event.button === 1 || event.altKey;
    if (panMode) {
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { kind: "pan", x: event.clientX, y: event.clientY, vx: board.viewport.x, vy: board.viewport.y };
      return;
    }
    if (tool === "sticky" || tool === "step") {
      addNode(tool, world.x - 40, world.y - 24);
      return;
    }
    setEditingId(null);
    setSelectedId(null);
    setSelectedEdge(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind: "pan", x: event.clientX, y: event.clientY, vx: board.viewport.x, vy: board.viewport.y };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!board || !drag.current) return;
    if (drag.current.kind === "pan") {
      const nextX = drag.current.vx + event.clientX - drag.current.x;
      const nextY = drag.current.vy + event.clientY - drag.current.y;
      patchBoard((current) => ({
        ...current,
        viewport: { ...current.viewport, x: nextX, y: nextY }
      }));
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextX = (event.clientX - rect.left - board.viewport.x) / board.viewport.scale - drag.current.dx;
    const nextY = (event.clientY - rect.top - board.viewport.y) / board.viewport.scale - drag.current.dy;
    const nodeId = drag.current.id;
    patchBoard((current) => ({
      ...current,
      nodes: current.nodes.map((item) => (item.id === nodeId ? { ...item, x: nextX, y: nextY } : item))
    }));
  };

  const onPointerUp = () => {
    if (drag.current && boardRef.current) persist(boardRef.current);
    drag.current = null;
  };

  const onNodePointerDown = (event: React.PointerEvent, node: FunnelNode) => {
    event.stopPropagation();
    if (!board) return;
    if (tool === "connect") {
      if (!connectFrom) {
        setConnectFrom(node.id);
        setSelectedId(node.id);
        return;
      }
      if (connectFrom !== node.id) {
        const created: FunnelEdge = { id: generateId("edge"), from: connectFrom, to: node.id };
        updateBoard((current) => {
          const exists = current.edges.some((item) => item.from === created.from && item.to === created.to);
          return exists ? current : { ...current, edges: [...current.edges, created] };
        });
      }
      setConnectFrom(null);
      setTool("select");
      return;
    }
    setSelectedId(node.id);
    setSelectedEdge(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const world = screenToWorld(event.clientX, event.clientY, rect, board.viewport);
    drag.current = { kind: "node", id: node.id, dx: world.x - node.x, dy: world.y - node.y };
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const saveTitle = (title: string) => {
    updateBoard((current) => ({ ...current, title }));
  };

  if (error && !board) {
    return (
      <main className="mx-auto w-[min(900px,calc(100%-32px))] py-8">
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ArrowLeft size={16} /> К маркетингу
        </Link>
        <p className="mt-6 text-sm text-red-700">{error}</p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="mx-auto w-[min(900px,calc(100%-32px))] py-8">
        <p className="text-sm text-slate-500">Открываю доску…</p>
      </main>
    );
  }

  const saveLabel =
    saveState === "saving" ? "Сохраняю…" : saveState === "saved" ? "Сохранено" : saveState === "error" ? "Не удалось сохранить" : "";

  return (
    <div className="flex h-screen flex-col bg-[#eef1f4]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--line)] bg-white px-4 py-3">
        <Link href="/marketing" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} /> К маркетингу
        </Link>
        <input
          className="min-w-[200px] flex-1 rounded-lg border border-transparent px-2 py-1 text-lg font-black text-slate-950 outline-none hover:border-[var(--line)] focus:border-blue-300"
          value={board.title}
          onChange={(event) => saveTitle(event.target.value)}
        />
        <p className="text-xs font-semibold text-slate-500">{saveLabel}</p>
        {!board.seeded ? (
          <button
            type="button"
            className="text-sm font-semibold text-red-600"
            onClick={() => {
              void (async () => {
                const response = await fetch(`/api/marketing/funnels/${encodeURIComponent(funnelId)}`, { method: "DELETE" });
                if (response.ok) router.push("/marketing");
              })();
            }}
          >
            Удалить
          </button>
        ) : null}
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--line)] bg-white px-4 py-2">
        {(
          [
            ["select", "Выбор"],
            ["sticky", "Стикер"],
            ["step", "Шаг"],
            ["connect", "Стрелка"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTool(id);
              setConnectFrom(null);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
              tool === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--line)]" />
        {FUNNEL_STICKY_COLORS.map((item) => (
          <button
            key={item}
            type="button"
            aria-label="Цвет стикера"
            onClick={() => setColor(item)}
            className={`h-6 w-6 rounded-full border ${color === item ? "border-slate-900" : "border-white ring-1 ring-slate-200"}`}
            style={{ background: item }}
          />
        ))}
        <p className="ml-auto text-xs text-slate-500">
          Колесо — масштаб · пробел или пустое место — сдвиг · Delete — удалить
        </p>
      </div>

      <div
        ref={canvasRef}
        className={`relative min-h-0 flex-1 overflow-hidden touch-none ${spaceDown || tool === "select" ? "cursor-grab" : "cursor-crosshair"}`}
        style={{
          backgroundImage: "radial-gradient(#d3dae2 1.2px, transparent 1.2px)",
          backgroundSize: `${22 * board.viewport.scale}px ${22 * board.viewport.scale}px`,
          backgroundPosition: `${board.viewport.x}px ${board.viewport.y}px`
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${board.viewport.x}px, ${board.viewport.y}px) scale(${board.viewport.scale})` }}
        >
          <svg className="absolute left-0 top-0 overflow-visible" width={12000} height={8000}>
            <defs>
              <marker id="funnel-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
              </marker>
            </defs>
            {board.edges.map((item) => {
              const from = board.nodes.find((node) => node.id === item.from);
              const to = board.nodes.find((node) => node.id === item.to);
              if (!from || !to) return null;
              const active = selectedEdge === item.id;
              return (
                <path
                  key={item.id}
                  d={edgePath(from, to)}
                  fill="none"
                  stroke={active ? "#2563eb" : "#64748b"}
                  strokeWidth={active ? 3 : 2}
                  markerEnd="url(#funnel-arrow)"
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedEdge(item.id);
                    setSelectedId(null);
                  }}
                />
              );
            })}
          </svg>

          {board.nodes.map((node) => {
            const active = selectedId === node.id || connectFrom === node.id;
            return (
              <div
                key={node.id}
                className={`absolute rounded-xl shadow-sm ${
                  node.kind === "sticky" ? "border border-black/5" : "border border-[var(--line)]"
                } ${active ? "ring-2 ring-blue-500" : ""}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  background: node.color,
                  cursor: tool === "connect" ? "cell" : "grab"
                }}
                onPointerDown={(event) => onNodePointerDown(event, node)}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setEditingId(node.id);
                }}
              >
                {editingId === node.id ? (
                  <textarea
                    autoFocus
                    className="h-full w-full resize-none rounded-xl bg-transparent p-3 text-sm font-semibold leading-5 text-slate-900 outline-none"
                    value={node.text}
                    onChange={(event) => {
                      const text = event.target.value;
                      updateBoard((current) => ({
                        ...current,
                        nodes: current.nodes.map((item) => (item.id === node.id ? { ...item, text } : item))
                      }));
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <p className="h-full overflow-hidden p-3 text-sm font-semibold leading-5 text-slate-900">{node.text}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
