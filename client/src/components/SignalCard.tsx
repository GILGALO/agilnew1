import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Activity, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Signal } from "@shared/schema";

interface SignalCardProps {
  signal: Signal;
  className?: string;
}

export function SignalCard({ signal, className }: SignalCardProps) {
  const isBuy = signal.action === "BUY" || signal.action === "CALL";
  const isNoTrade = signal.action === "NO_TRADE";
  const now = new Date();
  const startTime = new Date(signal.startTime);
  const endTime = new Date(signal.endTime);
  const isActive = now >= startTime && now <= endTime;
  const isExpired = now > endTime;
  
  // Calculate progress for the timer bar
  const totalDuration = endTime.getTime() - startTime.getTime();
  const elapsed = now.getTime() - startTime.getTime();
  const progress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);

  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      const nowTime = new Date().getTime();
      const remaining = endTime.getTime() - nowTime;
      
      if (remaining <= 0) {
        setTimeLeft("0:00");
        clearInterval(timer);
      } else {
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isActive, endTime]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 glass-panel transition-all duration-300",
        isActive ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border/50 opacity-75 grayscale-[0.3]",
        className
      )}
    >
      {/* Background Glow */}
      <div 
        className={cn(
          "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-[80px] opacity-20 pointer-events-none",
          isNoTrade ? "bg-muted" : (isBuy ? "bg-green-500" : "bg-red-500")
        )} 
      />

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {signal.pair}
            </span>
            {isActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground animate-pulse">
                Live
              </span>
            )}
            {isExpired && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                Ended
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            M5 INTERVAL • {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1">
            <Activity className="w-4 h-4" />
            <span>Confidence</span>
          </div>
          <span className={cn(
            "text-2xl font-bold",
            signal.confidence >= 80 ? "text-green-400" : 
            signal.confidence >= 50 ? "text-yellow-400" : "text-red-400"
          )}>
            {signal.confidence}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div className="flex-1">
          <div className="text-sm font-medium text-muted-foreground mb-2">ACTION</div>
          <div className={cn(
            "flex items-center gap-3 text-4xl font-black tracking-tighter",
            isNoTrade ? "text-muted-foreground" : (isBuy ? "text-green-500 text-glow-green" : "text-red-500 text-glow-red")
          )}>
            {isNoTrade ? <Activity className="w-10 h-10" /> : (isBuy ? <TrendingUp className="w-10 h-10" /> : <TrendingDown className="w-10 h-10" />)}
            {signal.action}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm font-medium text-muted-foreground mb-2">TARGET</div>
          <div className="flex items-center justify-end gap-2 text-xl font-bold text-foreground">
            <Target className="w-5 h-5 text-primary" />
            <span>{isNoTrade ? "WAIT" : "AI Analysis"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time Remaining {isActive && timeLeft && <span className="font-bold ml-1">({timeLeft})</span>}
          </span>
          <span>{isActive ? "Active Now" : isExpired ? "Session Closed" : "Starting Soon"}</span>
        </div>
        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all duration-1000 ease-linear",
              isNoTrade ? "bg-muted-foreground" : (isBuy ? "bg-green-500" : "bg-red-500")
            )}
            style={{ width: `${isActive ? 100 - progress : isExpired ? 0 : 100}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}
