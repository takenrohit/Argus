import { useEffect, useState } from 'react';
import { X, Activity, Video, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraInfo {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
}

interface CameraFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API = import.meta.env.VITE_API_BASE_URL || '';

export default function CameraFeedModal({ isOpen, onClose }: CameraFeedModalProps) {
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);

    fetch(`${API}/api/cameras`)
      .then((r) => r.json())
      .then((d) => {
        setCameras(d.cameras || []);
        if (d.cameras?.length) {
          setSelectedCamera(d.cameras[0].id);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCam = cameras.find((c) => c.id === selectedCamera);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            className="relative w-[94vw] max-w-6xl max-h-[90vh] rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center">
                  <Video className="w-4 h-4 text-white/70" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white tracking-tight">Live Camera Feeds</h2>
                  <p className="text-xs text-white/40 mt-0.5">{cameras.length} camera{cameras.length !== 1 ? 's' : ''} connected</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Content */}
            <div className="flex h-[calc(90vh-72px)]">
              {/* Camera selector sidebar */}
              <div className="w-56 border-r border-white/8 bg-black/40 overflow-y-auto shrink-0">
                <div className="p-3 space-y-1">
                  {cameras.map((cam) => (
                    <button
                      key={cam.id}
                      onClick={() => setSelectedCamera(cam.id)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                        selectedCamera === cam.id
                          ? 'bg-white/10 border border-white/15'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${cam.status === 'active' ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]' : 'bg-white/20'}`} />
                        <span className="text-xs font-mono text-white/60">{cam.id}</span>
                      </div>
                      <p className="text-sm text-white/85 font-medium truncate">{cam.name}</p>
                      <p className="text-[10px] text-white/35 mt-0.5 truncate">{cam.location}</p>
                    </button>
                  ))}

                  {loading && (
                    <div className="px-3 py-8 text-center">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-white/30 mt-3">Loading cameras…</p>
                    </div>
                  )}

                  {error && (
                    <div className="px-3 py-6 text-center">
                      <AlertCircle className="w-5 h-5 text-red-400/60 mx-auto" />
                      <p className="text-xs text-red-400/60 mt-2">{error}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Main feed view */}
              <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {activeCam ? (
                  <>
                    <img
                      key={activeCam.id}
                      src={`${API}/api/video/${activeCam.id}`}
                      alt={activeCam.name}
                      className="w-full h-full object-contain"
                    />

                    {/* LIVE badge */}
                    <div className="absolute top-4 left-4 flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-lg bg-red-500/90 text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_16px_rgba(239,68,68,0.4)]">
                        <Activity className="w-3 h-3 animate-pulse" /> LIVE
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-black/70 text-white/70 text-[10px] font-mono border border-white/10 backdrop-blur-sm">
                        {activeCam.id}
                      </div>
                    </div>

                    {/* Camera info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-5 pb-4 pt-10">
                      <p className="text-sm font-semibold text-white">{activeCam.name}</p>
                      <p className="text-[11px] text-white/45 font-mono uppercase mt-0.5">{activeCam.location}</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <Video className="w-10 h-10 text-white/15 mx-auto" />
                    <p className="text-sm text-white/30 mt-3">Select a camera to view its live feed</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
