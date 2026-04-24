import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { motion } from "motion/react";

interface CameraInfo {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
}

const API = import.meta.env.VITE_API_BASE_URL || "";

export default function LiveFeedGrid() {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

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
        <motion.div
          key={cam.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group aspect-video bg-black rounded-xl border border-white/10 overflow-hidden"
        >
          {/* MJPEG stream — served directly by FastAPI */}
          <img
            src={`${API}/api/video/${cam.id}`}
            alt={cam.name}
            className="w-full h-full object-cover"
          />

          {/* LIVE badge + camera ID */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <div className="px-2 py-0.5 rounded bg-brand-red/80 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3 h-3 animate-pulse" /> LIVE
            </div>
            <div className="px-2 py-0.5 rounded bg-black/60 text-white/70 text-[10px] font-mono border border-white/10">
              {cam.id}
            </div>
          </div>

          {/* Camera name + location */}
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <p className="text-xs font-semibold text-white truncate">
              {cam.name}
            </p>
            <p className="text-[10px] text-white/50 font-mono uppercase">
              {cam.location}
            </p>
          </div>
        </motion.div>
      ))}

      <DemoTriggerButton />
    </div>
  );
}

// ─────────────────────────────────────────────
//  DEMO SAFETY NET — inject a fake incident during judge demo
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
