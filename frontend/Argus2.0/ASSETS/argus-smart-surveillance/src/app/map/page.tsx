import { useState } from 'react';
import MapComponent from '../../components/MapComponent';
import { Incident } from '../../types';
import { motion } from 'motion/react';
import { Map as MapIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MapPageProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
}

export default function MapPage({ incidents, onSelectIncident }: MapPageProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full relative"
    >
      <div className="absolute top-6 left-6 z-[1000] p-4 bg-brand-dark/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl w-64 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
         <div className="flex items-center justify-between mb-4">
           <h3 className="font-bold text-sm tracking-tight">Geospatial Overlay</h3>
           <MapIcon className="w-4 h-4 text-white/30" />
         </div>
         <div className="space-y-3">
           <div className="flex items-center justify-between">
             <span className="text-xs text-white/60">Incident Heatmap</span>
             <button 
               onClick={() => setShowHeatmap(!showHeatmap)}
               className={cn(
                 "w-8 h-4 rounded-full transition-all relative border",
                 showHeatmap ? "bg-brand-red border-brand-red" : "bg-white/10 border-white/20"
               )}
             >
               <div className={cn(
                 "absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all",
                 showHeatmap ? "left-4.5" : "left-0.5"
               )} />
             </button>
           </div>
           <div className="pt-3 border-t border-white/10">
              <p className="text-[10px] text-white/40 uppercase font-bold mb-2">Zone Risk Index</p>
              <div className="flex items-center justify-between text-[10px] text-white/30 font-mono">
                 <span>SECURED</span>
                 <span>ACTIVE</span>
                 <span className="text-brand-red font-bold">HAZARD</span>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-brand-green/20 via-brand-amber/40 to-brand-red mt-1 rounded-full opacity-50" />
           </div>
         </div>
      </div>
      <MapComponent 
        incidents={incidents} 
        onSelectIncident={onSelectIncident}
        showHeatmap={showHeatmap}
      />
    </motion.div>
  );
}
