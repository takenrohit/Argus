import { BookOpen, Keyboard, LifeBuoy, RadioTower, ShieldCheck } from 'lucide-react';
import type { Incident } from '../../types';

interface HelpPageProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
}

export default function HelpPage({ incidents, onSelectIncident }: HelpPageProps) {
  const featuredIncident = incidents[0] || null;

  return (
    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-[#0d0e11] text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-white/90">Operator Help Center</h2>
          <p className="text-white/40 mt-2">Quick-response guidance, navigation help, and incident review workflow for the Argus console.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <LifeBuoy className="w-5 h-5 text-brand-blue" />
              <h3 className="text-lg font-medium text-white/90">How To Use The Console</h3>
            </div>
            <div className="space-y-4 text-sm text-white/70">
              <p>Use `Dashboard` for live situational awareness and `Incidents` for the full case log.</p>
              <p>Open any incident card to review evidence and acknowledge or dismiss it from the modal.</p>
              <p>Use `Alerts` when you want a severity-first queue and `Devices` when you want camera-level context.</p>
            </div>
          </section>

          <section className="glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-brand-green" />
              <h3 className="text-lg font-medium text-white/90">Response Flow</h3>
            </div>
            <div className="space-y-3 text-sm text-white/70">
              <p>1. Review severity and confidence.</p>
              <p>2. Check camera and location context.</p>
              <p>3. Open evidence details.</p>
              <p>4. Mark as acknowledged or false positive.</p>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="w-5 h-5 text-white/60" />
              <h3 className="text-base font-medium text-white/90">Navigation</h3>
            </div>
            <div className="space-y-2 text-sm text-white/65">
              <p>`Dashboard` for overview, logs, and device subviews.</p>
              <p>`Alerts` for severity-based review.</p>
              <p>`Analytics` for map-first investigation.</p>
            </div>
          </section>

          <section className="glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <RadioTower className="w-5 h-5 text-white/60" />
              <h3 className="text-base font-medium text-white/90">Live Data</h3>
            </div>
            <div className="space-y-2 text-sm text-white/65">
              <p>The frontend reads `/api/incidents` and `/api/stats` on load.</p>
              <p>Live alerts arrive through `/ws/alerts` and appear automatically.</p>
            </div>
          </section>

          <section className="glass-panel p-5">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-5 h-5 text-white/60" />
              <h3 className="text-base font-medium text-white/90">Quick Inspect</h3>
            </div>
            {featuredIncident ? (
              <button onClick={() => onSelectIncident(featuredIncident)} className="text-left w-full rounded-2xl bg-black/20 border border-white/5 px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <p className="text-sm text-white/90">{featuredIncident.type}</p>
                <p className="text-xs text-white/45 mt-1">{featuredIncident.location.address}</p>
              </button>
            ) : (
              <p className="text-sm text-white/45">No incident available to inspect yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
