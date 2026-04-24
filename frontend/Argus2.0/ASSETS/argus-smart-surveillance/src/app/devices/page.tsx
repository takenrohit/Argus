import { Camera, MapPin, Radio, ShieldAlert } from 'lucide-react';
import type { Incident } from '../../types';
import MapComponent from '../../components/MapComponent';

interface DevicesPageProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
}

export default function DevicesPage({ incidents, onSelectIncident }: DevicesPageProps) {
  const devices = Array.from(new Map(incidents.map((incident) => [incident.cameraId, incident])).values());

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-[#0d0e11] text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white/90">Device Network</h2>
          <p className="text-white/40 mt-2">Registered camera nodes inferred from the live alert feed and their last reported activity.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Cameras</p>
            <p className="text-3xl font-semibold mt-3">{devices.length}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Critical Nodes</p>
            <p className="text-3xl font-semibold mt-3">{devices.filter((device) => device.alertLevel === 'CRITICAL').length}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-white/35">Active Streams</p>
            <p className="text-3xl font-semibold mt-3">{devices.filter((device) => device.status !== 'dismissed').length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="glass-panel overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 text-sm font-medium text-white/80">Camera Registry</div>
            <div className="divide-y divide-white/5">
              {devices.map((device) => (
                <button
                  key={device.cameraId}
                  onClick={() => onSelectIncident(device)}
                  className="w-full text-left px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4 text-white/60" />
                      </div>
                      <div>
                        <p className="text-sm text-white/90">{device.cameraId}</p>
                        <p className="text-xs text-white/45 mt-1 flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          {device.location.address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/60 flex items-center gap-2 justify-end">
                        <Radio className="w-3 h-3" />
                        {device.status}
                      </p>
                      <p className="text-xs text-white/35 mt-1">{device.type}</p>
                    </div>
                  </div>
                </button>
              ))}
              {!devices.length && (
                <div className="px-5 py-10 text-sm text-white/40">No camera devices are visible yet because no incidents have been received.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/85">Device Health</h3>
                <ShieldAlert className="w-4 h-4 text-white/35" />
              </div>
              <div className="space-y-3">
                {devices.slice(0, 5).map((device) => (
                  <div key={device.cameraId} className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/85">{device.cameraId}</span>
                      <span className="text-xs text-white/45">{device.confidence}% confidence</span>
                    </div>
                    <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.max(device.confidence, 10)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-[320px] overflow-hidden rounded-3xl border border-white/5">
              <MapComponent incidents={incidents} onSelectIncident={onSelectIncident} showHeatmap={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
