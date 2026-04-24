import { AlertTriangle, Bell, ShieldAlert } from 'lucide-react';
import type { Incident } from '../../types';

interface AlertsPageProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
}

export default function AlertsPage({ incidents, onSelectIncident }: AlertsPageProps) {
  const critical = incidents.filter((incident) => incident.alertLevel === 'CRITICAL');
  const review = incidents.filter((incident) => incident.alertLevel === 'REVIEW');
  const monitor = incidents.filter((incident) => incident.alertLevel === 'MONITOR');

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-[#0d0e11] text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white/90">Alert Console</h2>
          <p className="text-white/40 mt-2">Severity-first queue for reviewing urgent alerts and dispatch-ready incidents.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Critical</p>
            <p className="text-3xl font-semibold mt-3 text-brand-red">{critical.length}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Review</p>
            <p className="text-3xl font-semibold mt-3 text-brand-amber">{review.length}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Monitor</p>
            <p className="text-3xl font-semibold mt-3 text-brand-green">{monitor.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="glass-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 text-sm font-medium text-white/80">Critical Queue</div>
            <div className="divide-y divide-white/5">
              {critical.map((incident) => (
                <button key={incident.id} onClick={() => onSelectIncident(incident)} className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-brand-red mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white/90">{incident.type}</p>
                      <p className="text-xs text-white/45 mt-1">{incident.location.address}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!critical.length && <div className="px-5 py-8 text-sm text-white/40">No critical alerts at the moment.</div>}
            </div>
          </section>

          <section className="glass-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 text-sm font-medium text-white/80">Review Queue</div>
            <div className="divide-y divide-white/5">
              {review.map((incident) => (
                <button key={incident.id} onClick={() => onSelectIncident(incident)} className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-brand-amber mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white/90">{incident.type}</p>
                      <p className="text-xs text-white/45 mt-1">{incident.location.address}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!review.length && <div className="px-5 py-8 text-sm text-white/40">No review alerts waiting.</div>}
            </div>
          </section>

          <section className="glass-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 text-sm font-medium text-white/80">Monitor Feed</div>
            <div className="divide-y divide-white/5">
              {monitor.map((incident) => (
                <button key={incident.id} onClick={() => onSelectIncident(incident)} className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-start gap-3">
                    <Bell className="w-4 h-4 text-brand-green mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white/90">{incident.type}</p>
                      <p className="text-xs text-white/45 mt-1">{incident.location.address}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!monitor.length && <div className="px-5 py-8 text-sm text-white/40">No monitor-level alerts available.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
