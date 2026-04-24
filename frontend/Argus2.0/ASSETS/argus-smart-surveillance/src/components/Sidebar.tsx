import { Shield, LayoutDashboard, Database, Bell, Activity, FileText, Settings, HelpCircle, User, Moon } from 'lucide-react';
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
    { id: 'map', label: 'Map', icon: Activity },
    { id: 'reports', label: 'Reports', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
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
          <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" strokeWidth={1.8} />
          </div>
          {isExpanded && <h1 className="font-semibold tracking-wide text-lg text-white/90">Argus</h1>}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'map' && activeTab === 'analytics');
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
          {isExpanded && <span className="ml-3 text-sm font