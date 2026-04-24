import { Shield, LayoutDashboard, Database, Bell, Activity, FileText, Settings, HelpCircle, LogOut, Search, User, Moon, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { useState } from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'devices', label: 'Devices', icon: Database },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'incidents', label: 'Incidents', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'reports', label: 'Reports', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'help', label: 'Help', icon: HelpCircle },
  ];

  return (
    <aside 
      className={cn(
        "border-r border-brand-border/50 flex flex-col h-full bg-[#121214] transition-all duration-300 z-50 relative",
        isExpanded ? "w-64" : "w-20"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className={cn("p-6 flex items-center justify-center mb-4 transition-all", isExpanded ? "mt-4" : "mt-2")}>
        <div className="flex flex-col items-center gap-2">
          <img 
            src="/bat-logo.jpeg" 
            alt="Argus Logo" 
            className="w-[68px] h-[68px] object-contain filter invert brightness-[2] contrast-[2] mix-blend-screen" 
          />
          {isExpanded && <h1 className="font-semibold tracking-wide text-lg text-white/90">Argus</h1>}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-2 mt-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'incidents' && activeTab === 'incidents') || (item.id === 'analytics' && activeTab === 'analytics');
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 relative group",
                isActive 
                  ? "bg-brand-blue/20 text-brand-blue" 
                  : "text-white/40 hover:text-white/80 hover:bg-white/5",
                !isExpanded && "justify-center px-0"
              )}
              title={!isExpanded ? item.label : undefined}
            >
              <Icon className={cn("w-[22px] h-[22px] transition-colors shrink-0", isActive ? "text-brand-blue" : "text-white/50 group-hover:text-white/80")} strokeWidth={1.5} />
              
              {isExpanded && (
                <span className="text-[15px] font-medium ml-4 tracking-wide">{item.label}</span>
              )}
              
              {isActive && isExpanded && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-8 bg-brand-blue rounded-r-md"
                />
              )}
              {isActive && !isExpanded && (
                <div className="absolute left-0 w-1 h-8 bg-brand-blue rounded-r-md" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 mt-auto flex flex-col items-center gap-4">
        <button className={cn(
          "flex items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white",
          isExpanded ? "w-full" : ""
        )}>
          <User className="w-5 h-5" />
          {isExpanded && <span className="ml-3 text-sm font-medium">Profile</span>}
        </button>
        
        <button className={cn(
          "flex items-center justify-center p-3 rounded-xl hover:bg-white/5 transition-colors text-white/40 hover:text-white",
          isExpanded ? "w-full" : ""
        )}>
          <Moon className="w-5 h-5" />
          {isExpanded && <span className="ml-3 text-sm font-medium">Theme</span>}
        </button>
      </div>
    </aside>
  );
}
