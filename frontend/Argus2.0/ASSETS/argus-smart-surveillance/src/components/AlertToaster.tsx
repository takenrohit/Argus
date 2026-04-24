import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, ShieldAlert, Bell, X } from "lucide-react";
import { buildAlertsWebSocketUrl, normalizeIncident } from "../lib/api";
import { isSoundMuted } from "../lib/sound";
import type { BackendIncidentPayload, Incident } from "../types";

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────

const AUTO_DISMISS_MS = {
  CRITICAL: 0,        // sticky — operator must close
  REVIEW:   12_000,
  MONITOR:  6_000,
  SYSTEM:   6_000,
};

const MAX_TOASTS = 5;
const RECONNECT_MS = 3_000;

interface Toast {
  key:      string;
  incident: Incident;
}

// ─────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────

export default function AlertToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<Map<string, number>>(new Map());

  const addToast = (incident: Incident) => {
    const key = `${incident.id}-${Date.now()}`;
    setToasts((cur) => [{ key, incident }, ...cur].slice(0, MAX_TOASTS));

    const ttl = AUTO_DISMISS_MS[incident.alertLevel] ?? 6_000;
    if (ttl > 0) {
      const timerId = window.setTimeout(() => dismiss(key), ttl);
      timersRef.current.set(key, timerId);
    }

    if (incident.alertLevel === "CRITICAL") playBeep();
  };

  const dismiss = (key: string) => {
    setToasts((cur) => cur.filter((t) => t.key !== key));
    const timerId = timersRef.current.get(key);
    if (timerId) {
      clearTimeout(timerId);
      timersRef.current.delete(key);
    }
  };

  // ─── WebSocket lifecycle (auto-reconnect) ───
  useEffect(() => {
    let alive = true;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (!alive) return;
      const ws = new WebSocket(buildAlertsWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        try { ws.send("ping"); } catch { /* ignore */ }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as BackendIncidentPayload & {
            type?: string;
          };
          if (payload.type !== "alert") return;
          const incident = normalizeIncident(payload);
          addToast(incident);
        } catch {
          // malformed payload — ignore
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current.clear();
      try { wsRef.current?.close(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed top-20 right-4 z-[300] flex flex-col gap-3 w-[360px] pointer-events-none">
      <AnimatePresence>
        {toasts.map(({ key, incident }) => (
          <ToastCard
            key={key}
            incident={incident}
            onClose={() => dismiss(key)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
//  TOAST CARD
// ─────────────────────────────────────────────

const LEVEL_STYLES = {
  CRITICAL: {
    border: "border-red-500/80",
    glow:   "shadow-[0_0_24px_rgba(239,68,68,0.45)]",
    bg:     "bg-gradient-to-br from-red-950/95 via-black/95 to-red-900/90",
    accent: "text-red-300",
    chip:   "bg-red-500 text-white",
    icon:   <ShieldAlert className="w-5 h-5 text-red-400" />,
    pulse:  true,
  },
  REVIEW: {
    border: "border-orange-400/70",
    glow:   "shadow-[0_0_18px_rgba(251,146,60,0.35)]",
    bg:     "bg-gradient-to-br from-orange-950/95 via-black/95 to-orange-900/85",
    accent: "text-orange-200",
    chip:   "bg-orange-500 text-white",
    icon:   <AlertTriangle className="w-5 h-5 text-orange-300" />,
    pulse:  false,
  },
  MONITOR: {
    border: "border-yellow-300/60",
    glow:   "shadow-[0_0_14px_rgba(253,224,71,0.25)]",
    bg:     "bg-gradient-to-br from-yellow-950/95 via-black/95 to-yellow-900/80",
    accent: "text-yellow-200",
    chip:   "bg-yellow-400 text-black",
    icon:   <Bell className="w-5 h-5 text-yellow-300" />,
    pulse:  false,
  },
  SYSTEM: {
    border: "border-white/20",
    glow:   "shadow-[0_0_14px_rgba(255,255,255,0.15)]",
    bg:     "bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-800/85",
    accent: "text-white/80",
    chip:   "bg-white/15 text-white",
    icon:   <Bell className="w-5 h-5 text-white/70" />,
    pulse:  false,
  },
} as const;

function ToastCard({
  incident,
  onClose,
}: {
  incident: Incident;
  onClose: () => void;
}) {
  const style = LEVEL_STYLES[incident.alertLevel] ?? LEVEL_STYLES.SYSTEM;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className={`pointer-events-auto rounded-xl border ${style.border} ${style.bg} ${style.glow} backdrop-blur-md p-4 ${style.pulse ? "animate-pulse-slow" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{style.icon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${style.chip}`}>
              {incident.alertLevel}
            </span>
            <span className="text-[10px] font-mono text-white/50 uppercase">
              {incident.cameraId}
            </span>
            <span className="text-[10px] font-mono text-white/30 ml-auto">
              {incident.confidence}%
            </span>
          </div>

          <p className={`text-sm font-semibold leading-tight ${style.accent}`}>
            {incident.type}
          </p>

          <p className="text-[11px] text-white/55 mt-1 truncate">
            {incident.location.address}
          </p>

          <p className="text-[10px] text-white/35 mt-1 font-mono">
            {incident.timestamp}
          </p>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 -mt-1 -mr-1 p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {incident.evidenceUrl && (
        <img
          src={incident.evidenceUrl}
          alt="incident snapshot"
          className="mt-3 w-full h-24 object-cover rounded-md border border-white/10"
        />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  AUDIO  (no asset file — synthesised beep)
// ─────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function playBeep() {
  if (isSoundMuted()) return;
  try {
    if (!audioCtx) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      audioCtx = new Ctor();
    }
    const ctx = audioCtx!;
    const now = ctx.currentTime;

    // Two-tone "alert" chirp
    [880, 1320].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);

      const t0 = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  } catch {
    // Audio not available — fail silently
  }
}