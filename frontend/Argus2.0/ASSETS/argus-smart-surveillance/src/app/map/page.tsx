import { useState, useMemo } from 'react';
import MapComponent from '../../components/MapComponent';
import { Incident } from '../../types';
import { motion } from 'motion/react';
import { Map as MapIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MapPageProps {
  incidents: Incident[];
  cameras?: any[];
  onSelectIncident: (inc: Incident) => void;
  searchQuery: string;
}

export default function MapPage({ incidents, cameras = [], onSelectIncident, searchQuery }: MapPageProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  const stats = useMemo(() => {
    const validIncidents = incidents.filter(i => i.location.lat !== 0);
    const criticalCount = validIncidents.filter(i => i.alertLevel === 'CRITICAL').length;
    const avgConfidence = validIncidents.length 
      ? Math.round(validIncidents.reduce((acc, curr) => acc + curr.confidence, 0) / validIncidents.length) 
      : 0;
    
    // Find highest risk camera
    const camCounts: Record<string, number> = {};
    validIncidents.forEach(i => {
      camCounts[i.cameraId] = (camCounts[i.cameraId] || 0) + (i.alertLevel === 'CRITICAL' ? 5 : 1);
    });
    const highestRiskCam = Object.entries(camCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NONE';

    return {
      validCount: validIncidents.length,
      criticalCount,
      avgConfidence,
      highestRiskCam,
      recent: validIncidents.slice(0, 3)
    };
  }, [incidents]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full relative"
    >
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-4">
        {/* Main Controls */}
        <div className="p-5 bg-brand-dark/90 backdrop-blur-md border border-brand-border rounded-2xl shadow-2xl w-72 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
           <div className="flex items-center justify-between mb-4">
             <h3 className="font-bold text-sm tracking-tight">Geospatial Overlay</h3>
             <MapIcon className="w-4 h-4 text-white/30" />
           </div>
           
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <span className="text-[11px] text-white/60 font-medium">Incident Heatmap</span>
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

             <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/40 uppercase font-bold">Highest Risk Area</span>
                  <span className="text-[10px] font-mono text-brand-red font-bold">{stats.highestRiskCam}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/40 uppercase font-bold">Live Tracked Zones</span>
                  <span className="text-[10px] font-mono text-white/90">{stats.validCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-white/40 uppercase font-bold">Mean Confidence</span>
                  <span className="text-[10px] font-mono text-white/90">{stats.avgConfidence}%</span>
                </div>
             </div>

             <div className="pt-3">
                <p className="text-[10px] text-white/30 uppercase font-bold mb-2 tracking-widest">Zone Risk Gradient</p>
                <div className="h-1 w-full bg-gradient-to-r from-brand-green via-brand-amber to-brand-red rounded-full opacity-60" />
                <div className="flex items-center justify-between text-[8px] text-white/30 mt-1.5 font-bold uppercase tracking-tighter">
                   <span>Safe</span>
                   <span>Caution</span>
                   <span>Hazard</span>
                </div>
             </div>
           </div>
        </div>

        {/* Recent Geolocated Alerts */}
        {stats.recent.length > 0 && (
          <div className="p-5 bg-brand-dark/90 backdrop-blur-md border border-brand-border rounded-2xl shadow-2xl w-72">
             <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Recent Activity</h3>
             <div className="space-y-3">
                {stats.recent.map(inc => (
                  <div 
                    key={inc.id} 
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => onSelectIncident(inc)}
                  >
                    <div className={cn(
                      "w-1.5 h-6 rounded-full",
                      inc.alertLevel === 'CRITICAL' ? "bg-brand-red" : "bg-brand-amber"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-white/90 truncate group-hover:text-brand-red transition-colors">{inc.type}</p>
                      <p className="text-[9px] text-white/40 truncate">{inc.cameraId}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <MapComponent 
        incidents={incidents} 
        cameras={cameras}
        onSelectIncident={onSelectIncident}
        showHeatmap={showHeatmap}
        searchQuery={searchQuery}
      />
    </motion.div>
  );
}

