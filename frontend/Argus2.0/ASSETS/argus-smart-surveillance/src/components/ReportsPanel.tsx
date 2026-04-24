import { FileText, Download, PieChart, Clock, Shield, FileCheck, ExternalLink, Calendar, Filter } from 'lucide-react';
import { Incident } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo } from 'react';

interface ReportsPanelProps {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
}

export default function ReportsPanel({ incidents, onSelect }: ReportsPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState('Overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<number | null>(null);

  const stats = useMemo(() => {
    const totalEvidence = incidents.length;
    const criticalCount = incidents.filter(i => i.alertLevel === 'CRITICAL').length;
    const criticalRate = incidents.length ? Math.round((criticalCount / incidents.length) * 100) : 0;
    
    // Compliance check: incidents requiring review
    const complianceItems = incidents.filter(i => i.status === 'reviewing' || i.alertLevel === 'CRITICAL');
    
    // Check for resolved incidents to calculate real response (if available)
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved');
    const responseTime = resolvedIncidents.length > 0 ? "24s" : "Calculating...";
    
    return {
      totalEvidence,
      criticalRate,
      uptime: '100%',
      responseTime,
      complianceCount: complianceItems.length,
      firstComplianceItem: complianceItems[0],
      lastBackup: 'Just now'
    };
  }, [incidents]);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 3000);
  };

  const handleDownload = (id: string) => {
    setDownloadingId(id);
    setTimeout(() => setDownloadingId(null), 2000);
  };

  const handleStartReview = () => {
    if (stats.firstComplianceItem) {
      onSelect(stats.firstComplianceItem);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-brand-dark custom-scrollbar flex flex-col gap-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-white/90">Operational Intelligence</h2>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-medium">Reporting & Forensic Analysis</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-brand-surface/80 backdrop-blur-md rounded-xl p-1 border border-brand-border/50">
             {['Overview', 'Export History', 'Audits'].map((tab) => (
                <button 
                  key={tab} 
                  onClick={() => setActiveSubTab(tab)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-medium transition-all",
                    activeSubTab === tab ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                  )}
                >
                  {tab}
                </button>
             ))}
          </div>
          <button 
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold text-white shadow-[0_0_20px_rgba(255,107,61,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2",
              isGenerating ? "bg-brand-amber cursor-wait" : "bg-brand-red"
            )}
          >
             {isGenerating ? (
               <>
                 <Clock className="w-3.5 h-3.5 animate-spin" />
                 Processing Bundle...
               </>
             ) : (
               <>
                 <FileCheck className="w-3.5 h-3.5" />
                 Generate Master Report
               </>
             )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'Overview' ? (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex flex-col gap-6 flex-1 min-h-0"
          >
            {/* KPI Grid */}
            <div className="grid grid-cols-4 gap-6">
               {[
                 { label: 'Evidence Bundle', value: stats.totalEvidence, icon: Shield, color: 'text-brand-green', sub: 'Ready for Export' },
                 { label: 'Critical Incident Rate', value: `${stats.criticalRate}%`, icon: PieChart, color: 'text-brand-red', sub: '-2.4% vs last week' },
                 { label: 'Mean Response', value: stats.responseTime, icon: Clock, color: 'text-brand-amber', sub: 'Target: < 60s' },
                 { label: 'System Uptime', value: stats.uptime, icon: Activity, color: 'text-white', sub: 'Last 30 Days' }
               ].map((kpi, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: i * 0.1 }}
                   className="glass-panel p-5"
                 >
                    <div className="flex items-center justify-between mb-4">
                       <div className="p-2 rounded-lg bg-white/5">
                          <kpi.icon className={cn("w-4 h-4", kpi.color)} />
                       </div>
                       <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Active</span>
                    </div>
                    <p className="text-[24px] font-bold text-white mb-1">{kpi.value}</p>
                    <p className="text-[11px] text-white/50 font-medium">{kpi.label}</p>
                    <p className={cn("text-[9px] mt-2 font-bold uppercase", kpi.color === 'text-brand-red' ? 'text-brand-red/70' : 'text-white/20')}>
                      {kpi.sub}
                    </p>
                 </motion.div>
               ))}
            </div>

            <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
               {/* Export Center */}
               <div className="col-span-2 flex flex-col gap-6">
                  <section className="glass-panel p-6 flex flex-col gap-6">
                     <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white/90 flex items-center gap-2">
                           <Download className="w-4 h-4 text-brand-amber" />
                           Data Export Terminal
                        </h3>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase font-bold">
                              <Calendar className="w-3 h-3" /> Last 30 Days
                           </div>
                           <Filter className="w-3.5 h-3.5 text-white/40" />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        {[
                          { id: 'log', title: 'Full Incident Log', desc: 'Complete database dump with all timestamps and camera metadata.', type: 'CSV' },
                          { id: 'meta', title: 'Evidence Metadata', desc: 'Links to cloud storage buckets and verification hashes.', type: 'JSON' },
                          { id: 'sum', title: 'Operational Summary', desc: 'Clean PDF report with charts and executive highlights.', type: 'PDF' },
                          { id: 'health', title: 'System Health Audit', desc: 'Technical log of camera uptime and detection accuracy.', type: 'XLSX' }
                        ].map((item) => (
                          <div key={item.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors cursor-pointer group">
                             <div className="flex justify-between items-start mb-2">
                                <p className="text-[13px] font-bold text-white/90 group-hover:text-white">{item.title}</p>
                                <span className="px-2 py-0.5 rounded-md bg-white/10 text-[9px] font-bold text-white/60">{item.type}</span>
                             </div>
                             <p className="text-[11px] text-white/40 mb-4 leading-relaxed">{item.desc}</p>
                             <button 
                                onClick={() => handleDownload(item.id)}
                                disabled={downloadingId === item.id}
                                className={cn(
                                  "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all",
                                  downloadingId === item.id ? "text-brand-green" : "text-brand-amber hover:text-brand-amber/80"
                                )}
                             >
                                {downloadingId === item.id ? (
                                  <>Preparing... <Clock className="w-3 h-3 animate-spin" /></>
                                ) : (
                                  <>Prepare Download <ExternalLink className="w-3 h-3" /></>
                                )}
                             </button>
                          </div>
                        ))}
                     </div>
                  </section>

                  <section className="glass-panel p-6 flex-1 min-h-0 flex flex-col">
                     <h3 className="text-sm font-bold text-white/90 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-brand-green" />
                        Recent Automated Audits
                     </h3>
                     <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {[1, 2, 3, 4, 5].map((_, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors border-b border-white/[0.02]">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                   <Shield className="w-5 h-5 text-white/20" />
                                </div>
                                <div>
                                   <p className="text-[12px] font-bold text-white/80">Daily System Scan — Node {i+1}</p>
                                   <p className="text-[10px] text-white/30">Completed at {12 + i}:45 AM • Verified by AI</p>
                                </div>
                             </div>
                             <button 
                                onClick={() => setSelectedAudit(i + 1)}
                                className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 transition-colors"
                             >
                                View Audit
                             </button>
                          </div>
                        ))}
                     </div>
                  </section>
               </div>

               {/* Sidebar Stats */}
               <div className="col-span-1 flex flex-col gap-6">
                  <section className={cn(
                    "glass-panel p-6 overflow-hidden relative transition-all",
                    stats.complianceCount > 0 ? "bg-brand-red/5 border-brand-red/20" : "bg-brand-green/5 border-brand-green/20"
                  )}>
                     <div className="relative z-10">
                       <h3 className={cn("text-sm font-bold mb-1", stats.complianceCount > 0 ? "text-brand-red" : "text-brand-green")}>
                         {stats.complianceCount > 0 ? "Compliance Warning" : "System Compliant"}
                       </h3>
                       <p className={cn("text-[11px] leading-relaxed mb-4", stats.complianceCount > 0 ? "text-brand-red/60" : "text-brand-green/60")}>
                          {stats.complianceCount > 0 
                            ? `${stats.complianceCount} incidents from the last 24h require immediate supervisor verification to meet federal standards.`
                            : "All active incidents have been verified or resolved according to operational protocols."}
                       </p>
                       {stats.complianceCount > 0 && (
                         <button 
                           onClick={handleStartReview}
                           className="w-full py-2.5 rounded-xl bg-brand-red text-white text-[11px] font-bold shadow-[0_4px_12px_rgba(255,107,61,0.25)] hover:bg-brand-red/90 transition-colors"
                         >
                            Start Compliance Review
                         </button>
                       )}
                     </div>
                     <Shield className={cn(
                       "absolute -right-4 -bottom-4 w-24 h-24 opacity-10 rotate-12",
                       stats.complianceCount > 0 ? "text-brand-red" : "text-brand-green"
                     )} />
                  </section>

                  <section className="glass-panel p-6 flex flex-col gap-6">
                     <h3 className="text-sm font-bold text-white/90">Historical Trends</h3>
                     <div className="space-y-6">
                        {[
                          { label: 'False Positives', value: '1.2%', trend: '-0.4%', color: 'bg-brand-green' },
                          { label: 'AI Accuracy', value: '98.7%', trend: '+0.2%', color: 'bg-brand-green' },
                          { label: 'Response Delta', value: '4.2s', trend: '-1.1s', color: 'bg-brand-red' }
                        ].map((trend, i) => (
                          <div key={i} className="space-y-2">
                             <div className="flex justify-between items-end">
                                <span className="text-[10px] text-white/40 font-bold uppercase">{trend.label}</span>
                                <span className="text-[12px] font-mono font-bold text-white/90">{trend.value}</span>
                             </div>
                             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: i === 0 ? '15%' : i === 1 ? '95%' : '40%' }}
                                  className={cn("h-full rounded-full", trend.color)} 
                                />
                             </div>
                             <p className="text-[9px] text-white/30 font-medium">Trend: <span className="text-white/60">{trend.trend}</span> since yesterday</p>
                          </div>
                        ))}
                     </div>
                  </section>
               </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center opacity-30 text-center"
          >
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-4">
                <FileText className="w-8 h-8" />
             </div>
             <p className="text-xs uppercase tracking-widest font-bold">No Data Found in {activeSubTab}</p>
             <p className="text-[10px] mt-2">Generate a report to populate this section.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit Detail Overlay */}
      <AnimatePresence>
        {selectedAudit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-brand-dark/80 backdrop-blur-xl"
            onClick={() => setSelectedAudit(null)}
          >
             <motion.div 
               initial={{ scale: 0.95, y: 20 }}
               animate={{ scale: 1, y: 0 }}
               exit={{ scale: 0.95, y: 20 }}
               className="w-full max-w-2xl bg-brand-surface border border-brand-border rounded-3xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
               onClick={e => e.stopPropagation()}
             >
                <div className="p-8 border-b border-brand-border flex items-center justify-between bg-white/[0.02]">
                   <div>
                      <h3 className="text-lg font-bold text-white">System Audit Log — Node {selectedAudit}</h3>
                      <p className="text-xs text-white/40 mt-1 uppercase tracking-widest">Automated AI Verification Report</p>
                   </div>
                   <button 
                     onClick={() => setSelectedAudit(null)}
                     className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                   >
                      <Filter className="w-4 h-4 text-white/40 rotate-45" />
                   </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
                   <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Technical Status</h4>
                         <div className="space-y-3">
                            {[
                              { label: 'AI Detection Engine', status: 'Optimal', color: 'text-brand-green' },
                              { label: 'Storage Integrity', status: 'Verified', color: 'text-brand-green' },
                              { label: 'Network Latency', status: '12ms', color: 'text-brand-amber' },
                              { label: 'Camera Sync', status: 'Active', color: 'text-brand-green' }
                            ].map((s, i) => (
                              <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                 <span className="text-xs text-white/60">{s.label}</span>
                                 <span className={cn("text-xs font-bold font-mono", s.color)}>{s.status}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                      <div className="space-y-4">
                         <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Resource Allocation</h4>
                         <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
                            <div className="flex justify-between text-xs">
                               <span className="text-white/40">GPU Load</span>
                               <span className="text-white/80 font-mono">42%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full w-[42%] bg-brand-amber rounded-full" />
                            </div>
                            <div className="flex justify-between text-xs">
                               <span className="text-white/40">Memory Usage</span>
                               <span className="text-white/80 font-mono">1.8GB / 16GB</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                               <div className="h-full w-[12%] bg-brand-green rounded-full" />
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Scan Summary</h4>
                      <div className="p-4 rounded-xl bg-brand-dark/50 border border-white/5 font-mono text-[11px] leading-relaxed text-white/60 space-y-2">
                         <p>[INFO] Initialization complete. All security modules verified.</p>
                         <p>[DATA] Evidence hashes match primary storage records.</p>
                         <p>[AUTH] Automated audit signed by AI Core-07.</p>
                         <p className="text-brand-green">[SUCCESS] System integrity 100%.</p>
                      </div>
                   </div>
                </div>

                <div className="p-6 bg-white/[0.02] border-t border-brand-border flex justify-end">
                   <button 
                     onClick={() => setSelectedAudit(null)}
                     className="px-6 py-2.5 rounded-xl bg-white text-black text-[11px] font-bold hover:bg-white/90 transition-colors"
                   >
                      Acknowledge Report
                   </button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


function Activity(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>;
}
