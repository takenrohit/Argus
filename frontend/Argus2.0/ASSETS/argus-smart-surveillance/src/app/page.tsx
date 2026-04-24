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
import LiveFeedGrid from '../components/LiveFeed';

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
    return (
      <div className="flex-1 overflow-y-auto bg-brand-dark p-6 text-white custom-scrollbar">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="glass-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Live Camera Feeds</h2>
                <p className="mt-1 text-sm text-white/42">
                  Real-time MJPEG streams with AI-powered fight cluster detection overlays.
                </p>
              </div>
              <Camera className="h-5 w-5 text-brand-red" />
            </div>
          </div>
          <LiveFeedGrid />
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

      <aside className="absolute bottom-5 right-5 top-5 z-[720] w-[255px] space-y-3">
        <div className="glass-panel p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-white">Incident Status</h3>
            <AlertTriangle className="h-4 w-4 text-brand-red" />
          </div>
          <div className="relative mx-auto mt-5 h-32 w-32">
            <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_220deg,#ff6b3d_0deg,#ffb36b_116deg,rgba(255,255,255,0.12)_117deg,rgba(255,255,255,0.12)_270deg,transparent_271deg)]" />
            <div className="absolute inset-[13px] flex flex-col items-center justify-center rounded-full bg-brand-surface">
              <span className="text-3xl font-semibold">{summary.total}</span>
              <span className="mt-1 text-[10px] text-brand-red">Critical High</span>
            </div>
          </div>
          <div className="mt-3 text-center text-xs text-white/48">Critical: {summary.critical} · Resolved: {summary.resolved}</div>
        </div>

        <div className="glass-panel overflow-hidden p-4">
          <h3 className="text-base font-medium text-white">Network Readiness</h3>
          <div className="relative mx-auto mt-5 h-36 w-36 overflow-hidden rounded-full bg-[radial-gradient(circle_at_center,#292929_0%,#111_66%)] shadow-[inset_0_0_0_2px_rgba(255,107,61,0.65),0_12px_30px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-0 bottom-0 h-[48%] rounded-t-[55%] bg-[radial-gradient(ellipse_at_top,#ffd08a_0%,#ff8b4c_48%,#ff6b3d_100%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-semibold text-white">90</span>
            </div>
            <span className="absolute left-8 top-12 text-[10px] text-white/58">NO2</span>
            <span className="absolute right-8 top-12 text-[10px] text-white/58">CO</span>
          </div>
          <div className="mt-4 rounded-xl bg-white/[0.06] px-3 py-2 text-[11px] text-white/58">
            Avg Confidence: {summary.avgConfidence}%<br />
            Current Stream
          </div>
        </div>

        <button className="glass-panel flex w-full items-center justify-between px-4 py-3 text-sm text-white/70">
          <span>Smart monitoring</span>
          <span className="relative h-5 w-9 rounded-full bg-white/14"><span className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white" /></span>
        </button>
        <button className="glass-panel flex w-full items-center justify-between px-4 py-3 text-sm text-white/70">
          <span>Incident report</span>
          <span>›</span>
        </button>
      </aside>

      <section className="glass-panel absolute bottom-24 left-10 z-[730] w-[270px] p-4">
        <h3 className="text-lg font-medium text-white">{summary.topIncident ? 'Incident detected!' : 'Sector clear'}</h3>
        <p className="mt-1 text-xs text-white/42">{summary.topIncident ? 'Code red' : 'No incidents available yet.'}</p>
        <div className="mt-4 rounded-xl bg-brand-red/12 px-3 py-3">
          <div className="flex gap-2">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" />
            <div>
              <p className="text-xs font-semibold text-brand-red">{summary.topIncident ? 'Warning' : 'Standby'}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/52">
                {summary.topIncident ? `${summary.topIncident.type} near ${summary.topIncident.location.address}` : 'Incoming incidents will appear in this alarm card.'}
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1 text-center text-[10px] text-white/30">
          {['U1', 'U2', 'U3', 'L1', 'L2', 'L3'].map((zone, index) => (
            <div key={zone} className={cn('rounded-md bg-white/[0.05] py-2', index === 2 && 'bg-brand-red/20 text-white ring-1 ring-brand-red/50')}>{zone}</div>
          ))}
        </div>
        <button className="mt-4 w-full rounded-lg bg-white py-2 text-xs font-semibold text-black">Alarm</button>
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
