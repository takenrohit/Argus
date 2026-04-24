import { MapPin, ChevronRight, Activity } from 'lucide-react';
import { Incident } from '../types';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface IncidentCardProps {
  incident: Incident;
  onClick: (incident: Incident) => void;
}

export default function IncidentCard({ incident, onClick }: IncidentCardProps) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => onClick(incident)}
      className={cn(
        "w-full p-4 text-left hover:bg-white/5 transition-all group relative border-b border-white/5",
        incident.confidence > 80 ? "bg-brand-red/5" : ""
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={cn(
          "px-2 py-0.5 rounded text-[10px] font-bold",
          incident.confidence > 80 ? "bg-brand-red text-white" : "bg-brand-amber/20 text-brand-amber border border-brand-amber/30"
        )}>
          {incident.confidence > 80 ? 'CRITICAL' : 'REVIEW'}
        </div>
        <span className="text-[10px] font-mono text-white/30">{incident.timestamp}</span>
      </div>

      <h3 className="text-sm font-semibold mb-1 group-hover:text-brand-red transition-colors">{incident.type}</h3>
      
      <div className="flex items-center gap-3 text-[10px] text-white/40 mb-3 font-mono">
         <div className="flex items-center gap-1">
           <MapPin className="w-3 h-3" />
           {incident.location.address.split(',')[0]}
         </div>
         <div className="flex items-center gap-1">
           <Activity className="w-3 h-3" />
           {incident.confidence}% CONF
         </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
         <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">View Evidence</span>
         <ChevronRight className="w-3 h-3 text-white/30" />
      </div>
    </motion.button>
  );
}
