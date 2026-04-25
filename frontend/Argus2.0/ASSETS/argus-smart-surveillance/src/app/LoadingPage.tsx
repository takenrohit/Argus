import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function LoadingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2500); // 2.5s duration
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
    >
      {/* Cat loading GIF — high contrast, blacks merge into bg, whites pop */}
      <img
        src={`/catlogo2.gif?t=${Date.now()}`}
        alt="Loading..."
        style={{
          width: '390px',
          height: '390px',
          objectFit: 'contain',
          mixBlendMode: 'screen',
          filter: 'contrast(1.8) brightness(1.3)',
        }}
      />

      {/* Vignette overlay */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)] pointer-events-none" />

      {/* Loading text + progress bar */}
      <div className="relative z-20 flex flex-col items-center mt-8 w-64">
        <p
          style={{
            fontFamily: "'Inter', 'SF Mono', 'Fira Code', monospace",
            fontSize: '0.85rem',
            fontWeight: 500,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)',
            marginBottom: '1rem',
          }}
        >
          Loading
        </p>

        {/* Progress bar */}
        <div className="w-full h-[2px] bg-white/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.5, ease: 'linear' }}
            className="h-full bg-white/80"
          />
        </div>

        <p className="text-white/40 font-mono text-[10px] tracking-[0.4em] mt-4 uppercase">
          Initializing Secure Connection
        </p>
      </div>
    </motion.div>
  );
}
