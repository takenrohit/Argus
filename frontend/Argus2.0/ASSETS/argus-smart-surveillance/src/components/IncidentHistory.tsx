import { Search, ChevronDown, Activity, Settings, User } from 'lucide-react';
import { Incident } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useMemo } from 'react';

interface IncidentHistoryProps {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
}

export default function IncidentHistory({ incidents, onSelect }: IncidentHistoryProps) {
  const criticalIncidents = useMemo(
    () => incidents.filter((incident) => incident.alertLevel === 'CRITICAL'),
    [incidents]
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-brand-dark custom-scrollbar flex flex-col gap-6">
      
      {/* Top Header / Tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-white/90">Incident History & Management</h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-brand-surface/80 backdrop-blur-md rounded-xl p-1 border border-brand-border/50">
             {['Overview', 'Active Incidents', 'History', 'Reports', 'Configuration'].map((tab, i) => (
                <button 
                  key={tab} 
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                    i === 0 ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab}
                </button>
             ))}
          </div>
          <button className="px-4 py-1.5 rounded-xl text-xs font-medium bg-brand-surface/80 backdrop-blur-md border border-brand-border/50 text-white/60 hover:text-white transition-colors flex items-center gap-2">
             <Settings className="w-3.5 h-3.5" />
             Argus Workspace
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
         {/* Left Stats Column */}
         <div className="w-[320px] flex flex-col gap-6">
            
            {/* Incident Overview */}
            <section className="glass-panel p-5">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-[13px] font-semibold text-white/90">Incident Overview</h3>
                 <MoreHorizontal className="w-4 h-4 text-white/40" />
               </div>
               
               <div className="flex items-center gap-4 text-[10px] text-white/50 mb-6 font-medium">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-[2px] bg-brand-red" /> Critical by Severity</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-[2px] bg-white/20" /> Severity</div>
               </div>
               
               {/* Bar Chart */}
               <div className="flex items-end gap-3 h-[120px] pb-4 border-b border-white/5 relative">
                  <div className="absolute left-0 top-0 bottom-4 flex flex-col justify-between text-[10px] text-white/30 w-6">
                     <span>50</span><span>25</span><span>0</span>
                  </div>
                  <div className="flex-1 flex items-end gap-2 pl-8 h-full">
                     {[20, 45, 80, 50, 15, 5, 20].map((h, i) => (
                       <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                         <div 
                           className={cn("w-full rounded-sm transition-all relative overflow-hidden", i === 2 ? "bg-brand-red" : "bg-brand-amber")} 
                           style={{ height: `${h}%` }} 
                         />
                         <span className="text-[9px] text-white/40 uppercase">
                           {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                         </span>
                       </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Status Breakdown */}
            <section className="glass-panel p-5">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-[13px] font-semibold text-white/90">Status Breakdown</h3>
                 <MoreHorizontal className="w-4 h-4 text-white/40" />
               </div>
               
               <div className="flex items-center justify-between">
                  <div className="relative w-[100px] h-[100px]">
                     <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#0fb0b5" strokeWidth="10" strokeDasharray="263" strokeDashoffset="144" strokeLinecap="round" className="drop-shadow-[0_0_8px_rgba(15,176,181,0.55)]" />
                     </svg>
                     <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-[18px] font-bold text-white/90">45%</p>
                     </div>
                  </div>
                  
                  <div className="flex-1 grid grid-cols-2 gap-y-4 pl-6">
                     {[
                        { label: 'Critical', color: 'bg-brand-red' },
                        { label: 'Major', color: 'bg-brand-amber' },
                        { label: 'Status Reviews', color: 'bg-brand-blue' },
                        { label: 'Minor', color: 'bg-white/20' }
                     ].map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                           <div className={cn("w-2 h-2 rounded-[2px]", s.color)} />
                           <span className="text-[11px] text-white/60">{s.label}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </section>

            {/* Recent Critical Incidents */}
            <section className="glass-panel p-5 flex-1 min-h-0 flex flex-col">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-[13px] font-semibold text-white/90">Recent Critical Incidents</h3>
                 <MoreHorizontal className="w-4 h-4 text-white/40" />
               </div>
               <div className="space-y-4 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                  {criticalIncidents.slice(0, 3).map((item) => (
                     <div key={item.id} className="flex items-start gap-3 cursor-pointer group" onClick={() => onSelect(item)}>
                        <div className="w-8 h-8 rounded-lg bg-brand-red/20 border border-brand-red/40 flex items-center justify-center shrink-0">
                           <Activity className="w-4 h-4 text-brand-red" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                           <p className="text-[12px] text-white/90 font-medium truncate group-hover:text-white transition-colors">{item.type}</p>
                           <p className="text-[11px] text-white/40 truncate">{item.location.address}</p>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-brand-red shadow-[0_0_6px_rgba(15,176,181,0.65)]" />
                     </div>
                  ))}
                  {!criticalIncidents.length && (
                     <p className="text-[11px] text-white/40">No critical incidents available from the backend yet.</p>
                  )}
               </div>
            </section>
         </div>

         {/* Main History Log Column */}
         <div className="flex-1 glass-panel flex flex-col overflow-hidden">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-[14px] font-semibold text-white/90">Incident History Log</h3>
               
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 bg-brand-dark px-3 py-1.5 rounded-lg border border-white/5 text-[11px] text-white/60">
                     Timeframe <span className="text-white/90">Status (All Days)</span>
                     <div className="w-px h-3 bg-white/10 mx-1" />
                     Status <span className="text-white/90">Status (All)</span>
                     <div className="w-px h-3 bg-white/10 mx-1" />
                     <div className="flex items-center gap-2">
                        <input type="text" placeholder="Search 30 Days..." className="bg-transparent border-none text-white/90 focus:outline-none placeholder:text-white/30 w-24" />
                        <Search className="w-3.5 h-3.5" />
                     </div>
                  </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-brand-surface shadow-sm">
                     <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-[11px] font-medium text-white/50">Node/Device/System</th>
                        <th className="px-6 py-4 text-[11px] font-medium text-white/50">Title</th>
                        <th className="px-6 py-4 text-[11px] font-medium text-white/50">Severity</th>
                        <th className="px-6 py-4 text-[11px] font-medium text-white/50">Assigned To</th>
                        <th className="px-6 py-4 text-[11px] font-medium text-white/50">Last Update</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {incidents.map((row) => (
                        <tr key={row.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors group" onClick={() => onSelect(row)}>
                           <td className="px-6 py-4 text-[12px] text-white/80 font-medium group-hover:text-white">{row.cameraId}</td>
                           <td className="px-6 py-4 text-[12px] text-white/60">{row.type}</td>
                           <td className="px-6 py-4 text-[12px] text-white/60">{row.alertLevel}</td>
                           <td className="px-6 py-4 text-[12px] text-white/60">{row.status}</td>
                           <td className="px-6 py-4 text-[12px] text-white/40 font-mono">{row.timestamp}</td>
                        </tr>
                     ))}
                     {!incidents.length && (
                        <tr>
                           <td className="px-6 py-8 text-[12px] text-white/40 font-mono" colSpan={5}>
                             No incidents have been returned by the backend yet.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}

function MoreHorizontal(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
}
