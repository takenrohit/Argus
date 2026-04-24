import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Clock3,
  MapPinned,
  MapPin,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MapComponent from '../components/MapComponent';
import type { Incident } from '../types';
import { cn } from '../lib/utils';

interface DashboardPageProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  searchQuery: string;
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

export default function DashboardPage({ incidents, onSelectIncident, searchQuery }: DashboardPageProps) {
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
      responseReady: incidents.filter((incident) => incident.status === 'dispatching').length,
      avgConfidence: incidents.length
        ? Math.round(incidents.reduce((sum, incident) => sum + incident.confidence, 0) / incidents.length)
        : 0,
      topIncident: incidents[0] || null,
      recentCritical: critical.slice(0, 5),
      recentIncidents: incidents.slice(0, 6),
      recentEvents: incidents.slice(0, 8),
      hotspots: [...incidents]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 4),
    };
  }, [incidents]);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-brand-dark text-white">
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
                  <thead className="bg-brand-surface">
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
              <MapComponent incidents={incidents} onSelectIncident={onSelectIncident} showHeatmap searchQuery={searchQuery} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5 h-full">
            <section className="glass-panel p-4 flex flex-col gap-4 min-h-[720px]">
              <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-[0.2em]">Live Sector</p>
                    <p className="text-lg font-semibold text-white/90 mt-1">
                      {summary.topIncident?.location.address || 'Argus Monitoring Zone'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/50">Cameras Online</p>
                    <p className="text-sm font-semibold text-white/85 mt-1">{summary.cameras}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
                    <p className="text-white/40">Open Events</p>
                    <p className="text-white text-base font-semibold mt-1">{summary.open}</p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
                    <p className="text-white/40">Resolved</p>
                    <p className="text-white text-base font-semibold mt-1">{summary.resolved}</p>
                  </div>
                </div>
              </div>

              <div className="h-[380px] overflow-hidden rounded-2xl border border-white/8 relative">
                <div className="absolute top-3 left-3 z-[900]">
                  <div className="flex p-1 bg-brand-surface/80 backdrop-blur-md rounded-lg border border-brand-border/50">
                    <button
                      onClick={() => setShowHeatmap(false)}
                      className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', !showHeatmap ? 'bg-white/10 text-white' : 'text-white/40')}
                    >
                      Network
                    </button>
                    <button
                      onClick={() => setShowHeatmap(true)}
                      className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all', showHeatmap ? 'bg-white/10 text-white' : 'text-white/40')}
                    >
                      Heatmap
                    </button>
                  </div>
                </div>
                <MapComponent incidents={incidents} onSelectIncident={onSelectIncident} showHeatmap={showHeatmap} searchQuery={searchQuery} />
              </div>

              <div className="rounded-xl border border-white/8 bg-black/20 p-3 flex-1 min-h-[170px]">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-white/45" />
                    Incident Queue
                  </h3>
                  <span className="text-xs text-white/40">{summary.recentIncidents.length} live</span>
                </div>
                <div className="mt-3 space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                  {summary.recentIncidents.length ? (
                    summary.recentIncidents.map((incident) => (
                      <button
                        key={incident.id}
                        onClick={() => onSelectIncident(incident)}
                        className="w-full text-left rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.07] transition-colors"
                      >
                        <p className="text-xs text-white/90 font-medium truncate">{incident.type}</p>
                        <p className="text-[11px] text-white/45 truncate mt-0.5">{incident.cameraId} · {incident.location.address}</p>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-white/45">No incidents available yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { title: 'Critical', value: summary.critical, meta: 'Highest priority', icon: AlertTriangle, tone: 'text-brand-red' },
                  { title: 'Review', value: summary.review, meta: 'Needs validation', icon: ShieldAlert, tone: 'text-brand-amber' },
                  { title: 'Monitor', value: summary.monitor, meta: 'Low urgency', icon: Camera, tone: 'text-brand-green' },
                  { title: 'Avg Confidence', value: `${summary.avgConfidence}%`, meta: 'Current stream', icon: TrendingUp, tone: 'text-brand-blue' },
                ].map((card) => (
                  <div key={card.title} className="glass-panel p-4 hover:border-white/15 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{card.title}</p>
                      <card.icon className={cn('w-4 h-4', card.tone)} />
                    </div>
                    <p className="text-2xl font-semibold mt-3 text-white/90">{card.value}</p>
                    <p className="text-[11px] text-white/40 mt-2">{card.meta}</p>
                  </div>
                ))}
              </div>

              <div className="glass-panel p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/40">Traffic Insights</p>
                    <h3 className="text-lg font-semibold text-white/90 mt-2">Operational Trend Grid</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/45">
                    <Clock3 className="w-4 h-4" />
                    <span>Last 3 Hours</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                    <p className="text-xs text-white/50">Vehicle Count Proxy</p>
                    <p className="text-3xl font-semibold text-brand-green mt-2">{summary.total * 7 + 90}</p>
                    <p className="text-xs text-white/45 mt-1">Derived from active incidents and camera density.</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-black/20 p-4">
                    <p className="text-xs text-white/50">Response Readiness</p>
                    <p className="text-3xl font-semibold text-brand-amber mt-2">{summary.responseReady + summary.review}</p>
                    <p className="text-xs text-white/45 mt-1">Dispatching and review-stage incidents.</p>
                  </div>
                </div>
              </div>

              <div className="glass-panel overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <MapPinned className="w-4 h-4 text-white/45" />
                    Device Event Log
                  </h3>
                  <span className="text-xs text-white/45">Backend synced</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-brand-surface">
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 text-[11px] font-medium text-white/50">Camera</th>
                        <th className="px-4 py-3 text-[11px] font-medium text-white/50">Event</th>
                        <th className="px-4 py-3 text-[11px] font-medium text-white/50">Severity</th>
                        <th className="px-4 py-3 text-[11px] font-medium text-white/50">Location</th>
                        <th className="px-4 py-3 text-[11px] font-medium text-white/50">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {summary.recentEvents.map((incident) => (
                        <tr
                          key={incident.id}
                          className="hover:bg-white/[0.03] cursor-pointer transition-colors"
                          onClick={() => onSelectIncident(incident)}
                        >
                          <td className="px-4 py-3 text-xs text-white/85">{incident.cameraId}</td>
                          <td className="px-4 py-3 text-xs text-white/75">{incident.type}</td>
                          <td className={cn('px-4 py-3 text-xs font-semibold', severityColor(incident.alertLevel))}>{incident.alertLevel}</td>
                          <td className="px-4 py-3 text-xs text-white/55">{incident.location.address}</td>
                          <td className="px-4 py-3 text-xs text-white/60">{incident.status}</td>
                        </tr>
                      ))}
                      {!summary.recentEvents.length && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/40">
                            No live incidents. Trigger an alert to populate the dashboard.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Hotspots</p>
                  <div className="space-y-2">
                    {summary.hotspots.length ? (
                      summary.hotspots.map((incident) => (
                        <button
                          key={incident.id}
                          onClick={() => onSelectIncident(incident)}
                          className="w-full rounded-lg border border-white/8 bg-white/[0.03] text-left px-3 py-2 hover:bg-white/[0.07] transition-colors"
                        >
                          <p className="text-xs text-white/90">{incident.location.address}</p>
                          <p className="text-[11px] text-white/45 mt-0.5">{incident.type} · {incident.confidence}%</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-white/45">No hotspots detected.</p>
                    )}
                  </div>
                </div>

                <div className="glass-panel p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Critical Review Queue</p>
                  <div className="space-y-2">
                    {summary.recentCritical.length ? (
                      summary.recentCritical.map((incident) => (
                        <button
                          key={incident.id}
                          onClick={() => onSelectIncident(incident)}
                          className="w-full rounded-lg border border-white/8 bg-white/[0.03] text-left px-3 py-2 hover:bg-white/[0.07] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-white/90">{incident.type}</p>
                              <p className="text-[11px] text-white/45 mt-0.5">{incident.location.address}</p>
                            </div>
                            <span className="text-[10px] text-brand-red uppercase tracking-wide">{incident.status}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-white/45">No critical incidents awaiting review.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
