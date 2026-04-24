import { Search, Filter, Layers, Maximize2, X, Plus, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Incident } from '../types';

interface AlertPanelProps {
  criticalIncident: Incident | null;
}

export default function AlertPanel({ criticalIncident }: AlertPanelProps) {
  return (
    <header className="h-14 border-b border-brand-border flex items-center px-6 justify-between bg-brand-dark/40 backdrop-blur-md relative z-50">
      <AnimatePresence>
        {criticalIncident && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-brand-red flex items-center gap-3 shadow-[0_0_20px_rgba(255,77,77,0.4)] pointer-events-none"
          >
            <Terminal className="w-3.5 h-3.5 text-white" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white">Critical Alert: {criticalIncident.type} @ {criticalIncident.location.address}</span>
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex items-center gap-6">
        <nav className="flex items-center gap-4 border-r border-brand-border pr-6 mr-6 h-8">
          <button className="text-xs font-bold text-white px-3 py-1 bg-white/10 rounded-lg">Overview</button>
          <button className="text-xs font-bold text-white/40 hover:text-white/60 transition-colors">Logs</button>
          <button className="text-xs font-bold text-white/40 hover:text-white/60 transition-colors">Devices</button>
        </nav>

        <div className="relative group max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
             type="text" 
             placeholder="Cedars-Sinai Medical Center, 8700 Beverly Blvd, LA"
             className="w-full bg-transparent border-none text-[13px] py-1 pl-10 text-white/70 placeholder:text-white/20 focus:ring-0 focus:text-white transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-[10px] font-mono text-white/20">
            <span className="px-1.5 py-0.5 border border-white/10 rounded">⌘</span>
            <span className="px-1.5 py-0.5 border border-white/10 rounded">Space</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 px-3 py-2 border-l border-brand-border pl-6">
          <Filter className="w-3.5 h-3.5 text-white/30" />
          <span className="text-[11px] font-bold text-white/60 uppercase tracking-widest ml-1.5">Filters</span>
          <span className="ml-1 px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-mono text-white/40">3</span>
        </div>
        
        <button className="text-[11px] font-bold text-white/60 uppercase tracking-widest hover:text-white/80 transition-colors">Clear all</button>
        
        <button className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-xs font-bold shadow-inner">
           <Layers className="w-3.5 h-3.5" />
           Set up view
        </button>

        <div className="flex items-center gap-2 ml-4">
          <button className="p-1.5 rounded-lg border border-brand-border hover:bg-white/5 text-white/30">
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg border border-brand-border hover:bg-white/5 text-white/30">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
