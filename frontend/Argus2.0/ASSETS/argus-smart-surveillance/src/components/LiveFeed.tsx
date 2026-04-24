import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Swords } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchClusters } from "../lib/api";
import type { FightCluster } from "../types";

interface CameraInfo {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
}

const API = import.meta.env.VITE_API_BASE_URL || "";
const POLL_MS = 700;

// ─────────────────────────────────────────────
//  GRID
// ─────────────────────────────────────────────

export default function LiveFeedGrid() {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/cameras`)
      .then((r) => r.json())
      .then((d) => setCameras(d.cameras || []))
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-brand-red text-sm">
        Cameras unreachable: {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {cameras.map((cam) => (
        <CameraTile key={cam.id} cam={cam} />
      ))}
      <DemoTriggerButton />
    </div>
  );
}

// ─────────────────────────────────────────────
//  ONE CAMERA TILE  (video + cluster overlay)
// ─────────────────────────────────────────────

function CameraTile({ cam }: { cam: CameraInfo }) {
  const imgRef  = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [clusters, setClusters] = useState<FightCluster[]>([]);
  const [scale, setScale] = useState({ sx: 1, sy: 1, ox: 0, oy: 0, ready: false });

  // Poll cluster endpoint
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetchClusters(cam.id);
        if (alive) setClusters(r.clusters || []);
      } catch {
        if (alive) setClusters([]);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [cam.id]);

  // Re-compute scaling factors when image loads or window resizes
  const recomputeScale = () => {
    const img  = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap || !img.naturalWidth || !img.naturalHeight) return;

    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // object-cover: scale to MAX axis, may crop the other
    const s  = Math.max(cw / iw, ch / ih);
    const dw = iw * s;
    const dh = ih * s;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    setScale({ sx: s, sy: s, ox, oy, ready: true });
  };

  useEffect(() => {
    window.addEventListener("resize", recomputeScale);
    return () => window.removeEventListener("resize", recomputeScale);
  }, []);

  const visibleClusters = clusters.filter(
    (c) => c.alert_level !== "NONE" && c.intensity >= 0.20
  );
  const worst = visibleClusters[0]; // already sorted desc by backend

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative group aspect-video bg-black rounded-xl border border-white/10 overflow-hidden"
    >
      <div ref={wrapRef} className="absolute inset-0">
        <img
          ref={imgRef}
          src={`${API}/api/video/${cam.id}`}
          alt={cam.name}
          className="w-full h-full object-cover"
          onLoad={recomputeScale}
        />

        {/* Cluster overlay — absolute boxes positioned over the video */}
        {scale.ready && (
          <ClusterOverlay clusters={visibleClusters} scale={scale} />
        )}
      </div>

      {/* LIVE badge + camera ID */}
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div className="px-2 py-0.5 rounded bg-brand-red/80 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3 h-3 animate-pulse" /> LIVE
        </div>
        <div className="px-2 py-0.5 rounded bg-black/60 text-white/70 text-[10px] font-mono border border-white/10">
          {cam.id}
        </div>
        {worst && <FightBadge level={worst.alert_level} count={visibleClusters.length} />}
      </div>

      {/* Camera name + location */}
      <div className="absolute bottom-3 left-3 right-3 z-30">
        <p className="text-xs font-semibold text-white truncate">{cam.name}</p>
        <p className="text-[10px] text-white/50 font-mono uppercase">{cam.location}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  CLUSTER OVERLAY  (the new visual layer)
// ─────────────────────────────────────────────

const LEVEL_STYLES: Record<string, { border: string; bg: string; label: string; pulse: boolean }> = {
  CRITICAL: { border: "border-red-500",    bg: "bg-red-500/15",    label: "text-red-300",    pulse: true  },
  REVIEW:   { border: "border-orange-400", bg: "bg-orange-400/15", label: "text-orange-200", pulse: true  },
  MONITOR:  { border: "border-yellow-300", bg: "bg-yellow-300/10", label: "text-yellow-200", pulse: false },
};

function ClusterOverlay({
  clusters,
  scale,
}: {
  clusters: FightCluster[];
  scale: { sx: number; sy: number; ox: number; oy: number };
}) {
  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <AnimatePresence>
        {clusters.map((c, i) => {
          const [x1, y1, x2, y2] = c.bbox;
          const left   = x1 * scale.sx + scale.ox;
          const top    = y1 * scale.sy + scale.oy;
          const width  = (x2 - x1) * scale.sx;
          const height = (y2 - y1) * scale.sy;

          const style = LEVEL_STYLES[c.alert_level] ?? LEVEL_STYLES.MONITOR;

          return (
            <motion.div
              key={`${c.alert_level}-${x1}-${y1}-${i}`}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className={`absolute rounded-md border-2 ${style.border} ${style.bg} ${
                style.pulse ? "animate-pulse" : ""
              }`}
              style={{ left, top, width, height }}
            >
              {/* Label tag at top-left of the box */}
              <div
                className={`absolute -top-5 left-0 flex items-center gap-1 rounded-sm bg-black/80 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${style.label}`}
              >
                <Swords className="w-3 h-3" />
                FIGHT · {Math.round(c.intensity * 100)}%
                {c.source === "motion-only" && (
                  <span className="opacity-60">· motion</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
//  FIGHT BADGE  (top-left summary chip)
// ─────────────────────────────────────────────

function FightBadge({ level, count }: { level: string; count: number }) {
  const color =
    level === "CRITICAL" ? "bg-red-500/90"  :
    level === "REVIEW"   ? "bg-orange-500/90" :
                            "bg-yellow-500/80";

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`px-2 py-0.5 rounded ${color} text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5`}
    >
      <AlertTriangle className="w-3 h-3" />
      {level} · {count} FIGHT{count > 1 ? "S" : ""}
    </motion.div>
  );
}

// ─────────────────────────────────────────────
//  DEMO SAFETY NET
// ─────────────────────────────────────────────

function DemoTriggerButton() {
  const fire = (cam: string) =>
    fetch(`${API}/api/demo/trigger/${cam}`, { method: "POST" });

  return (
    <button
      onClick={() => fire("CAM-01")}
      className="fixed bottom-4 right-4 z-[200] px-3 py-2 rounded-lg bg-brand-red/80 text-white text-xs font-mono uppercase tracking-wider shadow-lg hover:bg-brand-red"
    >
      ▶ Inject Test Incident
    </button>
  );
}