import { Search, SlidersHorizontal, Settings2, Command } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import type { IncidentSeverity, IncidentStatus } from '../types';

const dashboardTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'logs', label: 'Logs' },
  { key: 'devices', label: 'Devices' },
];

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  onClearAll: () => void;
  onSetupView: () => void;
  selectedSeverities: IncidentSeverity[];
  selectedStatuses: IncidentStatus[];
  onToggleSeverity: (severity: IncidentSeverity) => void;
  onToggleStatus: (status: IncidentStatus) => void;
}

const severityOptions: IncidentSeverity[] = ['CRITICAL', 'REVIEW', 'MONITOR', 'SYSTEM'];
const statusOptions: IncidentStatus[] = ['active', 'reviewing', 'dispatching', 'resolved', 'dismissed'];

export default function TopBar({
  searchQuery,
  onSearchChange,
  filtersOpen,
  onToggleFilters,
  onClearAll,
  onSetupView,
  selectedSeverities,
  selectedStatuses,
  onToggleSeverity,
  onToggleStatus,
}: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filtersContainerRef = useRef<HTMLDivElement | null>(null);

  const isDashboard = location.pathname === '/dashboard';
  const activeDashboardTab = searchParams.get('panel') || 'overview';

  function handleDashboardTabChange(tab: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'overview') {
      nextParams.delete('panel');
    } else {
      nextParams.set('panel', tab);
    }
    navigate(`/dashboard${nextParams.toString() ? `?${nextParams.toString()}` : ''}`);
  }

  const titleByRoute: Record<string, string> = {
    '/dashboard': 'Operational Overview',
    '/devices': 'Device Registry',
    '/alerts': 'Alert Console',
    '/incidents': 'Incident History',
    '/analytics': 'Geospatial Analytics',
    '/reports': 'Reports',
    '/settings': 'Settings',
    '/help': 'Operator Help',
  };

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (!filtersContainerRef.current?.contains(target)) {
        onToggleFilters();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onToggleFilters();
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [filtersOpen, onToggleFilters]);

  return (
    <header className="h-16 border-b border-brand-border/50 bg-brand-dark/80 backdrop-blur-md flex items-center justify-between px-6 z-40 sticky top-0 gap-6">
      <div className="flex items-center min-w-[220px]">
        {isDashboard ? (
          <div className="flex bg-white/5 rounded-lg p-1">
            {dashboardTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleDashboardTabChange(tab.key)}
                className={cn(
                  'px-6 py-1.5 rounded-md text-sm font-medium transition-all',
                  activeDashboardTab === tab.key
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-sm text-white/90 font-medium">{titleByRoute[location.pathname] || 'Argus Console'}</p>
            <p className="text-[11px] text-white/35 mt-1">Live backend-connected workspace</p>
          </div>
        )}
      </div>

      <div className="flex-1 max-w-2xl relative group">
        <Search className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by location, camera ID, or incident type"
          className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-11 pr-16 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/50 focus:border-brand-blue/50 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/30 text-xs font-mono">
          <Command className="w-3 h-3" />
          <span>Space</span>
        </div>
      </div>

      <div ref={filtersContainerRef} className="flex items-center gap-6 shrink-0 relative">
        <button
          onClick={onToggleFilters}
          className={cn(
            'flex items-center gap-2 text-sm transition-colors',
            filtersOpen ? 'text-white' : 'text-white/60 hover:text-white'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </button>

        <button onClick={onClearAll} className="text-sm text-brand-amber font-medium hover:text-brand-amber/80 transition-colors">
          Clear all
        </button>

        <button onClick={onSetupView} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <Settings2 className="w-4 h-4" />
          <span>Set up view</span>
        </button>

        {filtersOpen && (
          <div className="absolute right-0 top-full mt-4 w-80 rounded-2xl border border-white/10 bg-[#17181c] shadow-2xl p-4 z-50">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Severity</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {severityOptions.map((severity) => {
                const selected = selectedSeverities.includes(severity);
                return (
                  <button
                    key={severity}
                    onClick={() => onToggleSeverity(severity)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                      selected
                        ? 'border-brand-blue/70 bg-brand-blue/20 text-white'
                        : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                    )}
                  >
                    {severity}
                  </button>
                );
              })}
            </div>

            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-3">Status</p>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => {
                const selected = selectedStatuses.includes(status);
                return (
                  <button
                    key={status}
                    onClick={() => onToggleStatus(status)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                      selected
                        ? 'border-brand-blue/70 bg-brand-blue/20 text-white'
                        : 'border-white/10 text-white/60 hover:text-white hover:border-white/30'
                    )}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
