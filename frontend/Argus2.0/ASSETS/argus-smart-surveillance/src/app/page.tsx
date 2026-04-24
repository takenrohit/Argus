import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  ChevronRight,
  MapPin,
  MoreHorizontal,
  ShieldAlert,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import type { Incident } from '../types';
import { cn } from '../lib/utils';

interface DashboardPageProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
}

function severityColor(alertLevel: Incident['alertLevel']) {
  if (alertLevel === 'CRITICAL') {
    return 'text-brand-red';
  }
  if (alertLevel === 'REVIEW') {
    return 'text-brand-amber';
  }
  return 'text-brand-green';
}

export default function DashboardPage({ incidents, onSelectIncident }: DashboardPageProps) {
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [searchParams] = useSearchParams();
  const panel = searchParams.get('panel') || 'overview';

  const summary = useMemo(() => {
    const critical = incidents.filter((incident) => incident.alertLevel === 'CRITICAL');
    const review = incidents.filter((incident) => incident.alertLevel === 'REVIEW');
    const monitor = incidents.filter((incident) => incident.alertLevel === 'MONITOR');
    const open = incidents.filter((incident) => !['resolved', 'dismissed'].includes(incident.status));
    const resolved = incidents.filter((incident) => incident.status === 'resolved');
    const uniqueCameras = new Set(incidents.map((incident) => incident.cameraId));

    return {
      total: incidents.length,
      critical: critical.length,
      review: review.length,
      monitor: monitor.length,
      open: open.length,
      resolved: resolved.length,
      cameras: uniqueCameras.size,
      avgConfidence: incidents.length
        ? Math.round(incidents.reduce((sum, incident) => sum + incident.confidence, 0) / incidents.length)
        : 0,
      topIncident: incidents[0] || null,
      recentCritical: critical.slice(0, 5),
      recentIncidents: incidents.slice(0, 6),
      hotspots: [...incidents]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4),
    };
  }, [incidents]);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#0d0e11] text-white">
      {panel === 'logs' ? (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white/90">Live Incident Logs</h2>
                  <p className="text-sm text-white/40 mt-1">Chronological event stream from the backend and operator actions.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Events</p>
                  <p className="text-2xl font-semibold mt-2">{summary.total}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Critical</p>
                  <p className="text-2xl font-semibold mt-2">{summary.critical}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Review</p>
                  <p className="text-2xl font-semibold mt-2">{summary.review}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Monitor</p>
                  <p className="text-2xl font-semibold mt-2">{summary.monitor}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Open</p>
                  <p className="text-2xl font-semibold mt-2">{summary.open}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 text-sm font-medium text-white/80">Event Stream</div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1c1c1f]">
                    <tr className="border-b border-white/5">
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Incident</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Severity</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Camera</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Location</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Status</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Confidence</th>
                      <th className="px-5 py-4 text-[11px] font-medium text-white/50">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {incidents.map((incident) => (
                      <tr
                        key={incident.id}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                        onClick={() => onSelectIncident(incident)}
                      >
                        <td className="px-5 py-4 text-sm text-white/90">{incident.type}</td>
                        <td className={cn('px-5 py-4 text-sm font-medium', severityColor(incident.alertLevel))}>{incident.alertLevel}</td>
                        <td className="px-5 py-4 text-sm text-white/60">{incident.cameraId}</td>
                        <td className="px-5 py-4 text-sm text-white/60">{incident.location.address}</td>
                        <td className="px-5 py-4 text-sm text-white/60">{incident.status}</td>
                        <td className="px-5 py-4 text-sm text-white/60">{incident.confidence}%</td>
                        <td className="px-5 py-4 text-sm text-white/40">{incident.timestamp}</td>
                      </tr>
                    ))}
                    {!incidents.length && (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-white/40">
                          No logs yet. Incoming alerts will appear here automatically.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : panel === 'devices' ? (
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white/90">Connected Camera Devices</h2>
                  <p className="text-sm text-white/40 mt-1">Operational camera nodes inferred from the live incident stream.</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Devices</p>
                  <p className="text-2xl font-semibold mt-2">{summary.cameras}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from(new Map(incidents.map((incident) => [incident.cameraId, incident])).values()).map((incident) => (
                  <button
                    key={incident.cameraId}
                    onClick={() => onSelectIncident(incident)}
                    className="rounded-2xl border border-white/5 bg-black/20 p-5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-white/90 font-medium">{incident.cameraId}</p>
                        <p className="text-xs text-white/45 mt-1">{incident.location.address}</p>
                      </div>
                      <Camera className="w-4 h-4 text-white/35 mt-0.5" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Last Incident</p>
                        <p className="text-white/75 mt-2">{incident.type}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Severity</p>
                        <p className={cn('mt-2 font-medium', severityColor(incident.alertLevel))}>{incident.alertLevel}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {!incidents.length && (
                  <div className="rounded-2xl border border-white/5 bg-black/20 p-5 text-sm text-white/40">
                    No devices detected yet because no incidents have been received from the backend.
                  </div>
                )}
              </div>
            </div>

            <div className="h-[480px] overflow-hidden rounded-3xl border border-white/5">
              <MapComponent incidents={incidents} onSelectIncident={onSelectIncident} showHeatmap />
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="w-[340px] flex flex-col p-5 overflow-y-auto custom-scrollbar gap-5 z-10 bg-[#121214]/60 backdrop-blur-md border-r border-brand-border/50">
        <section className="glass-panel p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[13px] font-semibold text-white/90">System Snapshot</h3>
            <MoreHorizontal className="w-4 h-4 text-white/40" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Open</p>
              <p className="text-3xl font-semibold mt-3">{summary.open}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Resolved</p>
              <p className="text-3xl font-semibold mt-3">{summary.resolved}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Cameras</p>
              <p className="text-3xl font-semibold mt-3">{summary.cameras}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Avg Confidence</p>
              <p className="text-3xl font-semibold mt-3">{summary.avgConfidence}%</p>
            </div>
          </div>
        </section>

        <section className="glass-panel p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[13px] font-semibold text-white/90">Threat Breakdown</h3>
            <ShieldAlert className="w-4 h-4 text-white/40" />
          </div>

          <div className="space-y-4">
            {[
              { label: 'Critical', value: summary.critical, color: 'bg-brand-red' },
              { label: 'Review', value: summary.review, color: 'bg-brand-amber' },
              { label: 'Monitor', value: summary.monitor, color: 'bg-brand-green' },
            ].map((item) => {
              const width = summary.total ? Math.max(10, Math.round((item.value / summary.total) * 100)) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-[11px] mb-2">
                    <span className="text-white/70">{item.label}</span>
                    <span className="text-white/90 font-mono">{item.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className={cn('h-full rounded-full', item.color)} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="glass-panel p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[13px] font-semibold text-white/90">Primary Hotspots</h3>
            <MapPin className="w-4 h-4 text-white/40" />
          </div>

          <div className="space-y-3">
            {summary.hotspots.length ? (
              summary.hotspots.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => onSelectIncident(incident)}
                  className="w-full text-left rounded-2xl border border-white/5 bg-black/20 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] text-white/90 font-medium">{incident.location.address}</p>
                      <p className="text-[11px] text-white/45 mt-1">{incident.type}</p>
                    </div>
                    <div className={cn('text-[11px] font-semibold', severityColor(incident.alertLevel))}>
                      {incident.confidence}%
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-[12px] text-white/40">No live hotspots yet.</p>
            )}
          </div>
        </section>

        <section className="flex-1 min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-[13px] font-semibold text-white/90 flex items-center gap-2">
              Live Queue
              <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-white/60">{summary.recentIncidents.length}</span>
            </h3>
            <Activity className="w-4 h-4 text-white/40" />
          </div>

          <div className="space-y-2 overflow-y-auto pr-1">
            {summary.recentIncidents.length ? (
              summary.recentIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => onSelectIncident(incident)}
                  className="w-full glass-panel p-3 flex items-start gap-3 hover:bg-white/5 transition-all group cursor-pointer border border-transparent hover:border-white/5 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {incident.alertLevel === 'CRITICAL' ? (
                      <AlertTriangle className="w-4 h-4 text-brand-red" />
                    ) : incident.alertLevel === 'REVIEW' ? (
                      <ShieldAlert className="w-4 h-4 text-brand-amber" />
                    ) : (
                      <Camera className="w-4 h-4 text-brand-green" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/90 font-medium truncate">{incident.type}</p>
                    <p className="text-[11px] text-white/40 truncate">
                      {incident.cameraId} · {incident.location.address}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn('text-[10px] font-semibold', severityColor(incident.alertLevel))}>{incident.alertLevel}</p>
                    <p className="text-[10px] text-white/35 mt-1">{incident.confidence}%</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="glass-panel p-4 text-[12px] text-white/40">
                No incidents yet. Send a sample alert and the dashboard will populate with live data.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex-1 relative bg-[#090a0c]">
        <div className="absolute top-6 left-6 z-[1000]">
          <div className="flex p-1 bg-[#1c1c1f]/80 backdrop-blur-md rounded-lg border border-brand-border/50">
            <button
              onClick={() => setShowHeatmap(false)}
              className={cn('px-4 py-1.5 rounded-md text-xs font-medium transition-all', !showHeatmap ? 'bg-white/10 text-white' : 'text-white/40')}
            >
              Network
            </button>
            <button
              onClick={() => setShowHeatmap(true)}
              className={cn('px-4 py-1.5 rounded-md text-xs font-medium transition-all', showHeatmap ? 'bg-white/10 text-white' : 'text-white/40')}
            >
              Heatmap
            </button>
          </div>
        </div>

        <div className="absolute top-6 right-6 z-[1000] w-[320px] max-w-[calc(100%-3rem)]">
          <div className="glass-panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/35">Priority Feed</p>
                <p className="text-sm text-white/90 mt-2">
                  {summary.topIncident ? `${summary.topIncident.type} near ${summary.topIncident.location.address}` : 'No active incidents'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/40 mt-0.5" />
            </div>
            {summary.topIncident && (
              <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-white/35 uppercase">Severity</p>
                  <p className={cn('text-xs font-semibold mt-2', severityColor(summary.topIncident.alertLevel))}>
                    {summary.topIncident.alertLevel}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-white/35 uppercase">Confidence</p>
                  <p className="text-xs font-semibold mt-2 text-white/85">{summary.topIncident.confidence}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/35 uppercase">Camera</p>
                  <p className="text-xs font-semibold mt-2 text-white/85">{summary.topIncident.cameraId}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute inset-0 z-0">
          <MapComponent incidents={incidents} onSelectIncident={onSelectIncident} showHeatmap={showHeatmap} />
        </div>

        <div className="absolute left-6 bottom-6 z-[1000] w-[340px] max-w-[calc(100%-3rem)]">
          <div className="glass-panel p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-semibold text-white/90">Critical Review Queue</h3>
              <span className="text-[11px] text-white/40">{summary.recentCritical.length} items</span>
            </div>
            <div className="space-y-2">
              {summary.recentCritical.length ? (
                summary.recentCritical.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() => onSelectIncident(incident)}
                    className="w-full rounded-xl bg-black/20 border border-white/5 px-3 py-3 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="text-[12px] text-white/90">{incident.type}</p>
                        <p className="text-[11px] text-white/45 mt-1">{incident.location.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-brand-red font-semibold">{incident.status}</p>
                        <p className="text-[10px] text-white/35 mt-1">{incident.timestamp}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-[12px] text-white/40">No critical incidents currently waiting for review.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
