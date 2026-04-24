import { Shield, LayoutDashboard, Database, Bell, Activity, FileText, Settings, HelpCircle, Info, Moon, Sun, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('argus-theme');
    if (saved === 'light') {
      setIsDark(false);
      document.documentElement.classList.add('light-mode');
    }
  }, []);

  function toggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.remove('light-mode');
        localStorage.setItem('argus-theme', 'dark');
      } else {
        document.documentElement.classList.add('light-mode');
        localStorage.setItem('argus-theme', 'light');
      }
      return next;
    });
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cameras', label: 'Live Feeds', icon: Camera },
    { id: 'devices', label: 'Devices', icon: Database },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'incidents', label: 'Incidents', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'reports', label: 'Reports', icon: Shield },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <aside 
      className={cn(
        "flex flex-col h-full bg-black transition-all duration-300 z-50 relative shadow-[12px_0_30px_rgba(0,0,0,0.35)]",
        isExpanded ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={cn("p-5 flex items-center justify-center mb-6 transition-all", isExpanded ? "mt-2" : "mt-1")}>
        <div className="flex items-center gap-3">
          <div className="w-[62px] h-[62px] rounded-full overflow-hidden flex items-center justify-center border border-white/10">
            <img src="/logo.jpeg" alt="Argus Logo" className="w-full h-full object-cover" />
          </div>
          {isExpanded && <h1 className="font-semibold tracking-wide text-lg text-white/90">Argus</h1>}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'incidents' && activeTab === 'incidents') || (item.id === 'analytics' && activeTab === 'analytics');
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-200 relative group",
                isActive 
                  ? "bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.12)]" 
                  : "text-white/45 hover:text-white hover:bg-white/7",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <Icon className={cn("w-[21px] h-[21px] transition-colors shrink-0", isActive ? "text-black" : "text-white/65 group-hover:text-white")} strokeWidth={1.7} />
              
              {isExpanded && (
                <span className="text-[15px] font-medium ml-4 tracking-wide">{item.label}</span>
              )}
              
              {isActive && isExpanded && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-8 bg-brand-red rounded-r-md"
                />
              )}
              {isActive && !isExpanded && (
                <div className="absolute left-0 w-1 h-8 bg-brand-red rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto flex flex-col items-center gap-4">
        <button
          onClick={() => setActiveTab('about')}
          className={cn(
            "flex items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors",
            activeTab === 'about' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white',
            isExpanded ? "w-full" : ""
          )}
          title={!isExpanded ? 'About' : undefined}
        >
          <Info className="w-5 h-5" />
          {isExpanded && <span className="ml-3 text-sm font-medium">About</span>}
        </button>
        
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white",
            isExpanded ? "w-full" : ""
          )}
          title={!isExpanded ? (isDark ? 'Light Mode' : 'Dark Mode') : undefined}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {isExpanded && <span className="ml-3 text-sm font-medium">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
      </div>
    </aside>
  );
}
