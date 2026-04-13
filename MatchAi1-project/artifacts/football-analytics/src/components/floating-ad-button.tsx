import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Megaphone } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const STORAGE_KEY = "matchai1_fab_pos";
const SHOW_ON_PATHS = ["/", "/ai", "/author", "/statistics"];

export function FloatingAdButton() {
  const [location, navigate] = useLocation();
  const [hasAd, setHasAd] = useState(false);
  const [ready, setReady] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, bx: 0, by: 0 });
  const moved = useRef(false);

  const visible = SHOW_ON_PATHS.includes(location);

  // Default position: bottom-right just above navbar — same for all users on first open
  function defaultPos() {
    return { x: window.innerWidth - 62, y: window.innerHeight - 136 };
  }

  // Load saved position
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        setPos({
          x: Math.max(10, Math.min(window.innerWidth - 54, p.x)),
          y: Math.max(10, Math.min(window.innerHeight - 130, p.y)),
        });
      } else {
        setPos(defaultPos());
      }
    } catch {
      setPos(defaultPos());
    }
  }, []);

  // Check for active ad — only show button if ad exists
  useEffect(() => {
    if (!visible) return;
    fetch(`${BASE}/api/ads/active`)
      .then(r => r.json())
      .then(data => {
        setHasAd(!!(data && data.id));
        setReady(true);
      })
      .catch(() => { setHasAd(false); setReady(true); });
  }, [visible]);

  // ── Drag logic ────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    const rect = btnRef.current!.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, bx: rect.left, by: rect.top };
    btnRef.current!.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true;
    const newX = Math.max(10, Math.min(window.innerWidth - 54, dragStart.current.bx + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 130, dragStart.current.by + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
    if (pos) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch {}
    }
    if (!moved.current) navigate("/earn");
    moved.current = false;
  }, [pos, navigate]);

  // Hide if not on relevant page, no active ad, or position not loaded yet
  if (!visible || !ready || !hasAd || pos === null) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 100,
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "1px solid rgba(245,158,11,0.12)",
        background: "rgba(10,8,3,0.10)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 0 10px rgba(245,158,11,0.12), 0 2px 6px rgba(0,0,0,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        animation: "fab-appear 0.25s ease",
      }}
    >
      {/* Ad megaphone icon */}
      <Megaphone
        style={{
          width: 18,
          height: 18,
          color: "rgba(245,158,11,0.45)",
        }}
      />

      {/* Glowing badge */}
      <span
        style={{
          position: "absolute",
          top: -3,
          right: -3,
          width: 15,
          height: 15,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          border: "1.5px solid rgba(10,8,3,0.9)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 900,
          fontFamily: "monospace",
          color: "#000",
          animation: "fab-badge-pulse 2.2s ease-in-out infinite",
        }}
      >
        1
      </span>

      <style>{`
        @keyframes fab-appear {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fab-badge-pulse {
          0%, 100% { box-shadow: 0 0 4px rgba(245,158,11,0.6); }
          50%       { box-shadow: 0 0 10px rgba(245,158,11,0.95), 0 0 3px rgba(245,158,11,0.4); }
        }
      `}</style>
    </button>
  );
}
