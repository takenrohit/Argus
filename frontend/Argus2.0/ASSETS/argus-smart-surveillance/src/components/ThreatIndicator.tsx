import { Activity, AlertCircle, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface ThreatIndicatorProps {
  confidence: number;
  type: string;
}

export default function ThreatIndicator({ confidence, type }: ThreatIndicatorProps) {
  const isCritical = confidence > 80;
  const isReview = confidence >= 60 && confidence <= 80;

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border animate-in fade-in slide-in-from-right-4 duration-500",
      isCritical 
        ? "bg-brand-red/10 border-brand-red/50 text-brand-red shadow-[0_0_15px_rgba(15,176,181,0.24)]" 
        : isReview 
          ? "bg-brand-amber/10 border-brand-amber/50 text-brand-amber"
          : "bg-brand-green/10 border-brand-green/50 text-brand-green"
    )}>
      <div className={cn(
        "p-2 rounded-lg",
        isCritical ? "bg-brand-red text-white" : isReview ? "bg-brand-amber text-black" : "bg-brand-green text-white"
      )}>
        {isCritical ? <ShieldAlert className="w-4 h-4" /> : isReview ? <AlertCircle className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
      </div>
      
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
            {isCritical ? 'Critical Threat' : isReview ? 'Review Required' : 'Standard Monitor'}
          </span>
          {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />}
        </div>
        <div className="flex items-baseline gap-2">
          <h4 className="font-bold text-sm leading-tight">{type}</h4>
          <span className="text-xs font-mono opacity-80">{confidence}% CONF</span>
        </div>
      </div>
    </div>
  );
}
