import { Shield, Github, Globe, Cpu, Eye, Bell, Zap, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function AboutPage() {
  const features = [
    { icon: Eye, title: 'Real-time Detection', desc: 'YOLOv8 + MediaPipe pose analysis tracks and identifies distress in live video streams.' },
    { icon: Cpu, title: 'AI-Powered Analysis', desc: 'Distress engine scores 5 signatures: encirclement, following, struggle, panic, collapse.' },
    { icon: Bell, title: 'Smart Alerting', desc: 'Per-person and per-camera cooldowns prevent alert spam while catching real threats.' },
    { icon: Zap, title: 'Instant Response', desc: 'WebSocket-driven dashboard with < 1s alert latency from detection to notification.' },
    { icon: Lock, title: 'Evidence Capture', desc: 'Automatic screenshot capture and Supabase persistence for every incident.' },
    { icon: Globe, title: 'Multi-Camera', desc: 'Supports webcams, RTSP streams, and video files with independent processing pipelines.' },
  ];

  const techStack = [
    { category: 'Backend', items: ['Python 3.11', 'FastAPI', 'YOLOv8 (Ultralytics)', 'MediaPipe', 'Supabase'] },
    { category: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Framer Motion'] },
    { category: 'AI/ML', items: ['YOLOv8n (Detection)', 'MediaPipe Pose', 'Distress Engine', 'Gemini Vision (Validation)'] },
    { category: 'Infrastructure', items: ['WebSocket (Real-time)', 'MJPEG Streaming', 'Supabase Storage', 'Fast2SMS'] },
  ];

  return (
    <div className="h-full w-full overflow-y-auto bg-brand-dark text-white p-8 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-10">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 border border-white/10 mb-6">
            <Shield className="w-10 h-10 text-white/80" strokeWidth={1.4} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Argus</h1>
          <p className="text-lg text-white/50 mt-2">AI-Powered Smart Surveillance System</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <span className="px-3 py-1 rounded-full bg-brand-green/15 text-brand-green text-xs font-semibold border border-brand-green/30">
              v3.0
            </span>
            <span className="text-xs text-white/30">Built for real-time distress detection & response</span>
          </div>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass-panel p-6"
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/70 mb-3">About</h2>
          <p className="text-sm leading-relaxed text-white/60">
            Argus is an AI-powered surveillance system that detects distress situations in real-time video feeds. 
            Using a combination of YOLOv8 person tracking, MediaPipe pose estimation, and a custom distress engine, 
            Argus identifies threats like physical struggles, encirclement, panic running, and collapses — then 
            instantly alerts operators with evidence-backed notifications.
          </p>
          <p className="text-sm leading-relaxed text-white/60 mt-3">
            Designed for safety-critical environments, Argus operates with sub-second latency from detection to 
            dashboard alert, ensuring rapid response when it matters most.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/70 mb-4">Core Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                className="glass-panel p-4 flex gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-white/60" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white/90">{f.title}</h3>
                  <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Tech Stack */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/70 mb-4">Technology Stack</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {techStack.map((group) => (
              <div key={group.category} className="glass-panel p-4">
                <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">{group.category}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((item) => (
                    <span key={item} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/60">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Detection Signatures */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="glass-panel p-6"
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/70 mb-4">Detection Signatures</h2>
          <div className="space-y-3">
            {[
              { name: 'Encirclement', desc: 'Multiple people surrounding a target from different angles', weight: '25%' },
              { name: 'Being Followed', desc: 'Consistent directional movement matching between two individuals', weight: '15%' },
              { name: 'Physical Struggle', desc: 'Raised arms, grappling postures, rapid movement, close proximity fights', weight: '30%' },
              { name: 'Panic Running', desc: 'Abnormally fast movement indicating flight response', weight: '15%' },
              { name: 'Collapsed', desc: 'Extended stillness with horizontal body posture', weight: '15%' },
            ].map((sig) => (
              <div key={sig.name} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-red shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/80">{sig.name}</span>
                    <span className="text-[10px] text-white/30 font-mono">{sig.weight}</span>
                  </div>
                  <p className="text-[11px] text-white/40 mt-0.5">{sig.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center pb-8"
        >
          <p className="text-xs text-white/20">Argus v3.0 · Built with ❤️ for safety</p>
        </motion.div>
      </div>
    </div>
  );
}
