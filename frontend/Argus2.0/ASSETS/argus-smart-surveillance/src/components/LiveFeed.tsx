import { Camera, Maximize2, Activity } from 'lucide-react';
import { CameraStream } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface LiveFeedGridProps {
  streams: CameraStream[];
}

export default function LiveFeedGrid({ streams }: LiveFeedGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
      {streams.map((stream) => (
        <motion.div
          key={stream.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group aspect-video bg-white/5 rounded-xl border border-white/10 overflow-hidden ring-1 ring-white/5 hover:ring-white/20 transition-all"
        >
          {/* Simulated Video Placeholder */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
          <img 
            src={stream.feedUrl} 
            alt={stream.name}
            className="w-full h-full object-cover opacity-60 mix-blend-luminosity group-hover:opacity-80 transition-opacity"
            referrerPolicy="no-referrer"
          />

          {/* Overlay UI */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
            <div className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
              stream.status === 'tracking' ? "bg-brand-red text-white" : "bg-black/60 text-white/70"
            )}>
              {stream.status === 'tracking' && <Activity className="w-3 h-3 animate-pulse" />}
              {stream.status}
            </div>
            <div className="px-2 py-0.5 rounded bg-black/60 text-white/70 text-[10px] font-mono border border-white/10">
              HD:04
            </div>
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white truncate max-w-[140px]">{stream.name}</p>
              <p className="text-[10px] text-white/50 font-mono uppercase tracking-tighter">{stream.location}</p>
            </div>
            <button className="p-1.5 rounded-lg bg-white/5 hover:bg-white/20 border border-white/10 text-white/40 hover:text-white transition-all opacity-0 group-hover:opacity-100">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scanning Effect Overlay */}
          <div className="absolute inset-x-0 top-0 h-0.5 bg-brand-red/20 animate-[scan_3s_linear_infinite] shadow-[0_0_10px_rgba(239,68,68,0.5)] z-30" />
        </motion.div>
      ))}
    </div>
  );
}
