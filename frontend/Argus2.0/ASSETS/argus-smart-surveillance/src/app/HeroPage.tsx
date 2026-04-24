import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import ParticleBackground from '../components/ParticleBackground';

export default function HeroPage() {
  const navigate = useNavigate();

  const handleOpenDashboard = () => {
    navigate('/loading');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="relative w-full h-screen overflow-hidden bg-brand-dark flex flex-col items-center justify-center font-sans"
    >
      <ParticleBackground />
      
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 z-10 bg-brand-dark/10" />
      
      {/* Vignette / Grain overlay */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(18,18,20,0.8)_100%)] mix-blend-multiply pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdHRoIGQ9Ik0wIDQwaDQwVDBIMHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50 pointer-events-none" />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-4xl px-4 text-center">

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        >
          <img 
            src="/bat-logo.jpeg" 
            alt="Argus Logo" 
            className="w-[201px] h-[201px] md:w-[269px] md:h-[269px] mx-auto mb-8 object-contain filter invert brightness-[2] contrast-[2] mix-blend-screen animate-pulse" 
          />
          <h1 className="text-6xl md:text-8xl font-bold tracking-[0.2em] text-white uppercase font-mono drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] mb-4">
            Argus
          </h1>
          <p className="text-white/50 text-sm md:text-base tracking-[0.3em] font-mono uppercase mt-2 mb-12">
            Smart Surveillance Interface
          </p>
        </motion.div>

        {/* Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        >
          <button
            onClick={handleOpenDashboard}
            className="group relative px-8 py-4 bg-transparent border border-white/20 text-white font-mono tracking-widest text-sm uppercase overflow-hidden rounded-sm transition-all hover:border-white/50"
          >
            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            <span className="relative flex items-center gap-3">
              Open Dashboard
              <svg className="w-4 h-4 translate-x-0 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/80" />
            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-white/80" />
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-white/80" />
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-white/80" />
          </button>
        </motion.div>
      </div>

      {/* Footer Text */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <p className="text-white/20 font-mono text-xs tracking-[0.4em] uppercase">
          System Initialized // v2.4.0
        </p>
      </div>
    </motion.div>
  );
}
