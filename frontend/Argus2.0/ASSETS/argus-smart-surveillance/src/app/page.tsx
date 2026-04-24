import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  Database,
  FileText,
  MapPinned,
  ShieldAlert,
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
      avgConfidence: incidents.length
        ? Math.round(incidents.reduce((sum, incident) => sum + incident.confidence, 0) / incidents.length)
        : 0,
      topIncident: incidents[0] || null,
      recentIncidents: incidents.slice(0, 6),
      recentEvents: incidents.slice(0, 8),
    };
  }, [incidents]);

  if (panel === 'logs') {
    return (
      <div className="flex-1 overflow-y-auto bg-brand-dark p-6 text-white custom-scrollbar">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Live Incident Logs</h2>
                <p className="mt-1 text-sm text-white/42">Chronological event stream from the backend and operator actions.</p>
              </div>
              <FileText className="h-5 w-5 text-brand-red" />
            </div>
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="px-5 py-4 text-sm font-medium text-white/80">Event Stream</div>
            <table className="w-full text-left">
              <thead className="bg-white/[0.04]">
                <tr>
                  {['Incident', 'Severity', 'Camera', 'Location', 'Status', 'Confidence', 'Timestamp'].map((heading) => (
                    <th key={heading} className="px-5 py-4 text-[11px] font-medium text-white/48">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="cursor-pointer transition-colors hover:bg-white/[0.04]" onClick={() => onSelectIncident(incident)}>
                    <td className="px-5 py-4 text-sm text-white/90">{incident.type}</td>
                    <td className={cn('px-5 py-4 text-sm font-medium', severityColor(incident.alertLevel))}>{incident.alertLevel}</td>
                    <td className="px-5 py-4 text-sm text-white/62">{incident.cameraId}</td>
                    <td className="px-5 py-4 text-sm text-white/62">{incident.location.address}</td>
                    <td className="px-5 py-4 text-sm text-white/62">{incident.status}</td>
                    <td className="px-5 py-4 text-sm text-white/62">{incident.confidence}%</td>
                    <td className="px-5 py-4 text-sm text-white/42">{incident.timestamp}</td>
                  </tr>
                ))}
                {!incidents.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-white/42">No logs yet. Incoming alerts will appear here automatically.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (panel === 'devices') {
    const devices = Array.from(new Map(incidents.map((incident) => [incident.cameraId, incident])).values());
    return (
      <div className="flex-1 overflow-y-auto bg-brand-dark p-6 text-white custom-scrollbar">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Connected Camera Devices</h2>
                <p className="mt-1 text-sm text-white/42">Operational camera nodes inferred from the live incident stream.</p>
              </div>
              <Database className="h-5 w-5 text-brand-red" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {devices.map((device) => (
              <button key={device.cameraId} onClick={() => onSelectIncident(device)} className="glass-panel p-5 text-left transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white/92">{device.cameraId}</p>
                    <p className="mt-1 text-xs text-white/45">{device.location.address}</p>
                  </div>
                  <Camera className="mt-0.5 h-4 w-4 text-white/38" />
                </div>
                <p className={cn('mt-5 text-xs font-semibold', severityColor(device.alertLevel))}>{device.alertLevel}</p>
              </button>
            ))}
            {!devices.length && (
              <div className="glass-panel p-5 text-sm text-white/42">No devices detected yet because no incidents have been received from the backend.</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <MapComponent
          incidents={incidents}
          onSelectIncident={onSelectIncident}
          showHeatmap={showHeatmap}
          searchQuery={searchQuery || 'Bengaluru Electronic City'}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_43%_42%,rgba(0,0,0,0.05),rgba(0,0,0,0.72)_78%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/86 via-black/28 to-black/88" />

      <section className="absolute left-10 top-10 z-[700] max-w-xl">
        <p className="text-xs uppercase tracking-[0.32em] text-white/52">Live Sector</p>
        <h1 className="mt-3 text-5xl font-semibold leading-[0.95] tracking-[-0.04em] text-white">
          Argus Monitoring<br />Zone
        </h1>
        <p className="mt-4 text-sm text-white/42">Using in-memory incident store</p>
      </section>

      <div className="absolute left-10 top-[172px] z-[760] flex rounded-xl bg-black/55 p-1 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <button onClick={() => setShowHeatmap(false)} className={cn('rounded-lg px-4 py-1.5 text-xs font-medium transition-all', !showHeatmap ? 'bg-white text-black' : 'text-white/52')}>Network</button>
        <button onClick={() => setShowHeatmap(true)} className={cn('rounded-lg px-4 py-1.5 text-xs font-medium transition-all', showHeatmap ? 'bg-white text-black' : 'text-white/52')}>Heatmap</button>
      </div>

      <aside className="absolute bottom-5 right-5 top-5 z-[720] w-[255px] space-y-3 overflow-y-auto custom-scrollbar">
        {/* Incident Status — real data */}
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-white">Incident Status</h3>
            <AlertTriangle className={cn("h-4 w-4", summary.critical > 0 ? "text-brand-red" : "text-white/30")} />
          </div>
          <div className="relative mx-auto mt-5 h-32 w-32">
            {/* Dynamic donut based on severity distribution */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              {summary.total > 0 && (
                <>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#ff4444" strokeWidth="10"
                    strokeDasharray={`${(summary.critical / summary.total) * 264} 264`} strokeLinecap="round" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#ffaa33" strokeWidth="10"
                    strokeDasharray={`${(summary.review / summary.total) * 264} 264`}
                    strokeDashoffset={`-${(summary.critical / summary.total) * 264}`} strokeLinecap="round" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#44bb66" strokeWidth="10"
                    strokeDasharray={`${(summary.monitor / summary.total) * 264} 264`}
                    strokeDashoffset={`-${((summary.critical + summary.review) / summary.total) * 264}`} strokeLinecap="round" />
                </>
              )}
            </svg>
            <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-brand-surface">
              <span className="text-3xl font-semibold">{summary.total}</span>
              <span className={cn("mt-1 text-[10px]", summary.critical > 0 ? "text-brand-red" : "text-white/40")}>
                {summary.critical > 0 ? 'Critical Active' : 'All Clear'}
              </span>
            </div>
          </div>
          <div className="mt-3 text-center text-xs text-white/48">Critical: {summary.critical} · Open: {summary.open} · Resolved: {summary.resolved}</div>
        </div>

        {/* System Health — replaces fake "Network Readiness" */}
        <div className="glass-panel p-4">
          <h3 className="text-base font-medium text-white">System Health</h3>
          <div className="relative mx-auto mt-5 h-36 w-36 overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,#292929_0%,#111_66%)] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.15),0_12px_30px_rgba(0,0,0,0.35)]">
            {/* Fill level based on avg confidence */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-[55%] transition-all duration-1000"
              style={{
                height: `${Math.max(summary.avgConfidence, 10)}%`,
                background: summary.avgConfidence > 70
                  ? 'radial-gradient(ellipse at top, #ff9999 0%, #ff4444 48%, #cc2222 100%)'
                  : summary.avgConfidence > 40
                    ? 'radial-gradient(ellipse at top, #ffd08a 0%, #ffaa44 48%, #ff8800 100%)'
                    : 'radial-gradient(ellipse at top, #88ddaa 0%, #44bb66 48%, #228844 100%)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-semibold text-white">{summary.avgConfidence}</span>
              <span className="text-[10px] text-white/60 mt-0.5">Avg Confidence</span>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] text-white/58">
            Cameras Active: {summary.cameras}<br />
            Total Tracked: {summary.total} incidents
          </div>
        </div>

        {/* Threat Breakdown */}
        <div className="glass-panel p-4">
          <h3 className="text-sm font-medium text-white mb-3">Threat Breakdown</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ff4444]" />
                <span className="text-xs text-white/70">Critical</span>
              </div>
              <span className="text-xs font-semibold text-white/90">{summary.critical}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ffaa33]" />
                <span className="text-xs text-white/70">Review</span>
              </div>
              <span className="text-xs font-semibold text-white/90">{summary.review}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#44bb66]" />
                <span className="text-xs text-white/70">Monitor</span>
              </div>
              <span className="text-xs font-semibold text-white/90">{summary.monitor}</span>
            </div>
          </div>
          {/* Bar chart */}
          {summary.total > 0 && (
            <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-white/5">
              <div className="bg-[#ff4444] transition-all duration-700" style={{ width: `${(summary.critical / summary.total) * 100}%` }} />
              <div className="bg-[#ffaa33] transition-all duration-700" style={{ width: `${(summary.review / summary.total) * 100}%` }} />
              <div className="bg-[#44bb66] transition-all duration-700" style={{ width: `${(summary.monitor / summary.total) * 100}%` }} />
            </div>
          )}
        </div>

        {/* Active Cameras */}
        <div className="glass-panel flex w-full items-center justify-between px-4 py-3 text-sm text-white/70">
          <span>Active Cameras</span>
          <span className="text-white font-semibold">{summary.cameras}</span>
        </div>
      </aside>

      <section className="glass-panel absolute bottom-24 left-10 z-[730] w-[270px] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">{summary.topIncident ? 'Latest Alert' : 'Sector Clear'}</h3>
          {summary.topIncident && (
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
              summary.topIncident.alertLevel === 'CRITICAL' ? 'bg-brand-red/20 text-brand-red' :
              summary.topIncident.alertLevel === 'REVIEW' ? 'bg-brand-amber/20 text-brand-amber' :
              'bg-brand-green/20 text-brand-green'
            )}>{summary.topIncident.alertLevel}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-white/42">
          {summary.topIncident ? summary.topIncident.timestamp : 'No incidents available yet.'}
        </p>

        {summary.topIncident ? (
          <>
            <div className={cn(
              "mt-4 rounded-xl px-3 py-3",
              summary.topIncident.alertLevel === 'CRITICAL' ? 'bg-brand-red/12' :
              summary.topIncident.alertLevel === 'REVIEW' ? 'bg-brand-amber/10' : 'bg-brand-green/10'
            )}>
              <div className="flex gap-2">
                <Bell className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  summary.topIncident.alertLevel === 'CRITICAL' ? 'text-brand-red' :
                  summary.topIncident.alertLevel === 'REVIEW' ? 'text-brand-amber' : 'text-brand-green'
                )} />
                <div>
                  <p className={cn(
                    "text-xs font-semibold",
                    summary.topIncident.alertLevel === 'CRITICAL' ? 'text-brand-red' :
                    summary.topIncident.alertLevel === 'REVIEW' ? 'text-brand-amber' : 'text-brand-green'
                  )}>{summary.topIncident.type}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/52">
                    {summary.topIncident.location.address}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">Camera</span>
                <span className="text-white/80 font-mono">{summary.topIncident.cameraId}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">Confidence</span>
                <span className="text-white/80 font-mono">{summary.topIncident.confidence}%</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-white/40">Status</span>
                <span className="text-white/80 font-mono uppercase">{summary.topIncident.status}</span>
              </div>
            </div>

            <button
              onClick={() => onSelectIncident(summary.topIncident!)}
              className="mt-4 w-full rounded-lg bg-white/10 border border-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
            >View Details</button>
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-white/5 px-3 py-6 text-center">
            <p className="text-xs text-white/30">Incoming incidents will appear here.</p>
          </div>
        )}
      </section>

      <section className="glass-panel absolute bottom-5 right-[290px] z-[710] w-[520px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <MapPinned className="h-4 w-4 text-white/55" />
            Device Event Log
          </h3>
          <span className="text-xs text-white/38">Backend synced</span>
        </div>
        <div className="space-y-2 px-5 pb-4">
          {summary.recentEvents.length ? (
            summary.recentEvents.slice(0, 4).map((incident, index) => (
              <button
                key={incident.id}
                onClick={() => onSelectIncident(incident)}
                className={cn('w-full rounded-xl px-3 py-2 text-left transition-colors', index === 0 ? 'bg-white text-black' : 'bg-white/[0.06] text-white/72 hover:bg-white/[0.1]')}
              >
                <div className="grid grid-cols-[0.8fr_1.1fr_0.8fr] gap-3 text-xs">
                  <span>{incident.cameraId}</span>
                  <span className="truncate">{incident.type}</span>
                  <span className="text-right">{incident.status}</span>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl bg-white/[0.06] px-4 py-6 text-center text-sm text-white/46">
              No live incidents. Trigger an alert to populate the dashboard.
            </div>
          )}
        </div>
      </section>

      <p className="absolute bottom-8 left-10 z-[700] max-w-[340px] text-xs text-white/38">
        Emergency: The evacuation has not begun yet
      </p>
    </div>
  );
}
