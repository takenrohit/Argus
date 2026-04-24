import { X, Clock, User, Download, ChevronDown, Activity, Settings, FileText, Check, FileCheck } from 'lucide-react';
import { Incident } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface EvidenceModalProps {
  incident: Incident | null;
  onClose: () => void;
  onAction: (id: string, action: 'dispatch' | 'dismiss' | 'escalate') => void;
}

export default function EvidenceModal({ incident, onClose, onAction }: EvidenceModalProps) {
  if (!incident) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="relative w-full max-w-7xl mx-auto my-auto h-[85vh] bg-brand-dark/90 backdrop-blur-xl border border-brand-border/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="h-14 border-b border-white/5 flex items-center px-6 relative bg-white/[0.02]">
            <div className="flex gap-2 h-full items-center">
               <button className="text-xs font-semibold text-white px-4 py-1.5 bg-white/10 rounded-md">Overview</button>
               <button className="text-xs font-semibold text-white/40 hover:text-white/60 transition-colors">Logs</button>
               <button className="text-xs font-semibold text-white/40 hover:text-white/60 transition-colors">Devices</button>
            </div>
            
            <div className="flex-1 flex justify-center absolute inset-0 pointer-events-none items-center">
               <h2 className="text-sm font-bold uppercase tracking-widest text-white/90">Incident & Evidence Report</h2>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-6 gap-6 grid grid-cols-1 md:grid-cols-3">
            
            {/* Left Column */}
            <div className="flex flex-col gap-6">
               <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Incident Details</h3>
               
               <div className="glass-panel p-5 space-y-5">
                  <div className="flex items-center justify-between">
                     <p className="text-[11px] text-white/60">Incident ID</p>
                     <div className="w-4 h-4 rounded-[3px] bg-brand-green shadow-[0_0_8px_rgba(231,231,231,0.22)]" />
                  </div>
                  
                  <div>
                     <p className="text-[11px] text-white/60 mb-2">Reported By</p>
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                           <User className="w-3.5 h-3.5 text-white/60" />
                        </div>
                     <p className="text-xs font-semibold text-white/90">{incident.cameraId}</p>
                     </div>
                  </div>
                  
                  <div>
                     <p className="text-[11px] text-white/60 mb-2">Time & Date</p>
                     <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-white/60" />
                        <p className="text-xs text-white/90 font-mono">{incident.timestamp}</p>
                     </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5">
                     <p className="text-[11px] text-white/60 mb-2 flex justify-between">
                        Devices <MoreHorizontal className="w-4 h-4" />
                     </p>
                     <button className="w-full bg-brand-dark border border-white/10 rounded-lg p-2 flex items-center justify-between text-xs text-white/60 hover:border-white/20">
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-brand-green rounded-sm" /> {incident.location.address}
                        </div>
                        <ChevronDown className="w-4 h-4" />
                     </button>
                  </div>
                  
                  <div>
                     <p className="text-[11px] text-white/60 mb-2 flex justify-between">
                        Priority <MoreHorizontal className="w-4 h-4" />
                     </p>
                     <div className="flex gap-3">
                        <button className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60 hover:text-white transition-colors">{incident.alertLevel}</button>
                        <button className="flex-1 py-1.5 rounded-lg bg-brand-amber text-black text-xs font-medium shadow-[0_0_15px_rgba(231,231,231,0.24)]">{incident.status}</button>
                     </div>
                  </div>
               </div>
            </div>

            {/* Middle Column */}
            <div className="flex flex-col gap-6">
               <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Incident Details</h3>
               
               <div className="flex flex-col gap-4">
                  {/* Devices Involved List */}
                  <div className="glass-panel p-5">
                     <div className="flex justify-between items-center mb-4">
                        <p className="text-[11px] text-white/60">Device(s) Involved</p>
                        <MoreHorizontal className="w-4 h-4 text-white/40" />
                     </div>
                     <div className="space-y-3">
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-md bg-brand-green/20 border border-brand-green flex items-center justify-center shrink-0">
                              <Activity className="w-3.5 h-3.5 text-brand-green" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white/90 truncate">{incident.type}</p>
                              <p className="text-[10px] text-white/40">{incident.cameraId}</p>
                           </div>
                           <span className="px-2 py-0.5 rounded text-[10px] bg-brand-green/10 text-brand-green border border-brand-green/30">Confidence: {incident.confidence}%</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-md bg-brand-red/20 border border-brand-red flex items-center justify-center shrink-0">
                              <Activity className="w-3.5 h-3.5 text-brand-red" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white/90 truncate">{incident.location.address}</p>
                              <p className="text-[10px] text-white/40">Lat {incident.location.lat}, Lng {incident.location.lng}</p>
                           </div>
                           <span className="px-2 py-0.5 rounded text-[10px] bg-brand-red/10 text-brand-red border border-brand-red/30">Status: {incident.status}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <div className="w-6 h-6 rounded-md bg-brand-amber/20 border border-brand-amber flex items-center justify-center shrink-0">
                              <span className="text-brand-amber text-xs font-bold">+</span>
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white/90 truncate">Evidence</p>
                              <p className="text-[10px] text-white/40">{incident.evidenceUrl ? 'Frame attached' : 'No frame available'}</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Description */}
                  <div className="glass-panel p-5">
                     <p className="text-[11px] text-white/60 mb-2">Description</p>
                     <p className="text-xs text-white/80 leading-relaxed">
                        {incident.description || `${incident.type} detected with ${incident.confidence}% confidence near ${incident.location.address}.`}
                     </p>
                  </div>

                  {/* Status */}
                  <div className="glass-panel p-5">
                     <div className="flex justify-between items-center mb-3">
                        <p className="text-[11px] text-white/60">Status</p>
                        <MoreHorizontal className="w-4 h-4 text-white/40" />
                     </div>
                     <div className="flex gap-3">
                        <button className="flex-1 py-1.5 rounded-lg bg-brand-red text-white text-xs font-medium shadow-[0_0_15px_rgba(15,176,181,0.3)]">{incident.alertLevel}</button>
                        <button className="flex-1 py-1.5 rounded-lg bg-brand-amber text-black text-xs font-medium">{incident.status}</button>
                        <button className="flex-1 py-1.5 rounded-lg bg-brand-green text-white text-xs font-medium">{incident.cameraId}</button>
                     </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-auto pt-4">
                     <button onClick={onClose} className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60 hover:text-white">Cancel</button>
                     <button onClick={() => onAction(incident.id, 'dismiss')} className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60 hover:text-white">Dismiss</button>
                     <button onClick={() => onAction(incident.id, 'dispatch')} className="flex-1 py-2 rounded-lg bg-brand-green text-white text-xs font-bold shadow-[0_0_15px_rgba(231,231,231,0.16)]">Acknowledge</button>
                  </div>
               </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-6">
               <h3 className="text-xs font-bold uppercase tracking-widest text-white/90">Evidence & Logs</h3>
               
               {/* File Uploads */}
               <div className="glass-panel p-5 space-y-3">
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                     <FileText className="w-5 h-5 text-white/60" />
                     <div className="flex-1">
                        <p className="text-xs font-medium text-white/90">{incident.id}.json</p>
                        <p className="text-[10px] text-white/40 font-mono">Structured event payload</p>
                     </div>
                     <Download className="w-4 h-4 text-brand-green" />
                  </div>
                  
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                     <FileText className="w-5 h-5 text-white/60" />
                     <div className="flex-1">
                        <p className="text-xs font-medium text-white/90">{incident.cameraId}_snapshot.jpg</p>
                        <p className="text-[10px] text-white/40 font-mono">{incident.evidenceUrl ? 'Preview attached' : 'Frame unavailable'}</p>
                     </div>
                     <Download className="w-4 h-4 text-brand-green" />
                  </div>
                  
                  <button className="w-full py-2 rounded-lg border border-dashed border-white/20 text-xs text-white/50 hover:text-white/80 transition-colors mt-2">
                     Upload Evidence
                  </button>
               </div>

               {/* System Logs */}
               <div className="glass-panel p-5 flex-1 flex flex-col min-h-0">
                  <p className="text-[11px] text-white/60 mb-2">System Logs (Filtered)</p>
                  <p className="text-[10px] text-white/40 mb-2">Attached Logs (Filtered)</p>
                  <div className="flex-1 bg-brand-dark border border-white/5 rounded-lg p-3 overflow-y-auto custom-scrollbar font-mono text-[10px] text-white/70 space-y-1">
                     <p>{incident.timestamp}</p>
                     <p><span className="text-brand-green">[{incident.alertLevel}]</span> Incident type: {incident.type}</p>
                     <p className="text-white/40">Camera: {incident.cameraId}</p>
                     <p>Status: {incident.status}</p>
                     <p>Confidence: {incident.confidence}%</p>
                     <p>Location: {incident.location.address}</p>
                     <p className="text-brand-red">Source status: {incident.sourceStatus || 'open'}</p>
                     <p>{incident.description || 'Awaiting operator review.'}</p>
                  </div>
               </div>

               {/* Timeline View */}
               <div className="glass-panel p-5">
                  <p className="text-[11px] text-white/60 mb-6">Timeline View</p>
                  <div className="relative flex items-center justify-between px-2">
                     <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-white/10" />
                     <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-red shadow-[0_0_8px_rgba(15,176,181,0.65)]" />
                        <span className="text-[9px] text-white/40">14:36</span>
                     </div>
                     <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-red shadow-[0_0_8px_rgba(15,176,181,0.65)]" />
                        <span className="text-[9px] text-brand-red font-bold">14:37</span>
                     </div>
                     <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-green shadow-[0_0_8px_rgba(231,231,231,0.2)]" />
                     </div>
                     <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-green shadow-[0_0_8px_rgba(231,231,231,0.2)]" />
                     </div>
                  </div>
               </div>
            </div>

          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function MoreHorizontal(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>;
}
