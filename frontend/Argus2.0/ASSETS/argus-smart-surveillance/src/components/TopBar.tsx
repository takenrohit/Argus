import { Search, SlidersHorizontal, Settings2, Command } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';

const dashboardTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'logs', label: 'Logs' },
  { key: 'devices', label: 'Devices' },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  return (
    <header className="h-16 border-b border-brand-border/50 bg-[#121214]/80 backdrop-blur-md flex items-center justify-between px-6 z-40 sticky top-0 gap-6">
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
          placeholder="Search by location, camera ID, or incident type"
          className="w-full bg-white/5 border border-white/5 rounded-xl py-2 pl-11 pr-16 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-brand-blue/50 focus:border-brand-blue/50 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-white/30 text-xs font-mono">
          <Command className="w-3 h-3" />
          <span>Space</span>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0">
        <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
        </button>

        <button className="text-sm text-brand-amber font-medium hover:text-brand-amber/80 transition-colors">
          Clear all
        </button>

        <button className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
          <Settings2 className="w-4 h-4" />
          <span>Set up view</span>
        </button>
      </div>
    </header>
  );
}
