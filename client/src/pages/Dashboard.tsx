import { useState, useEffect } from "react";
// Removed incompatible widget import
import { useSignals } from "@/hooks/use-signals";
import { Sidebar } from "@/components/Sidebar";
import { SignalCard } from "@/components/SignalCard";
import { GenerateSignalDialog } from "@/components/GenerateSignalDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, RefreshCw, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Dashboard() {
  const { data: signals, isLoading, error, refetch } = useSignals();
  const { data: sessionData } = useQuery<{ session: string }>({
    queryKey: ["/api/session"],
    refetchInterval: 60000,
  });
  const { data: newsEvents } = useQuery<any[]>({
    queryKey: ["/api/news"],
    refetchInterval: 300000,
  });
  const [autoMode, setAutoMode] = useState(false);
  const [selectedPair, setSelectedPair] = useState("AUDJPY");

  const highImpactNews = newsEvents?.filter(n => n.impact === "High") || [];

  // Sort signals by start time descending
  const sortedSignals = signals?.sort((a, b) => 
    new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  ) || [];

  const activeSignal = sortedSignals.find(s => {
    const now = new Date();
    const end = new Date(s.endTime);
    return now <= end;
  });

  const signalHistory = sortedSignals.filter(s => s.id !== activeSignal?.id);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-destructive">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12" />
          <h2 className="text-xl font-bold">Failed to load dashboard</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button onClick={() => refetch()} variant="outline">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      
      <main className="flex-1 ml-0 lg:ml-64 p-4 md:p-8">
        {highImpactNews.length > 0 && (
          <Alert variant="destructive" className="mb-6 border-red-500/50 bg-red-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>High Impact News Warning</AlertTitle>
            <AlertDescription>
              {highImpactNews.map(n => `${n.currency}: ${n.title}`).join(", ")}. 
              Trading during high impact news is extremely risky!
            </AlertDescription>
          </Alert>
        )}

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Market Overview</h1>
            <div className="flex items-center gap-2 text-muted-foreground mt-1">
              <p>Real-time M5 AI Trading Signals</p>
              {sessionData && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                  <Clock className="w-3 h-3" />
                  <span>{sessionData.session} Session</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg">
              <span className="text-sm font-medium">Auto-Trading</span>
              <Switch 
                checked={autoMode}
                onCheckedChange={setAutoMode}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <GenerateSignalDialog />
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Chart Section */}
          <div className="col-span-12 lg:col-span-8 h-[500px] bg-card rounded-2xl border border-border overflow-hidden relative shadow-xl">
            {/* TradingView Widget Wrapper */}
            <div className="absolute inset-0">
               <iframe
                 src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_76d87&symbol=${selectedPair}&interval=5&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=["RSI@tv-basicstudies","MASimple@tv-basicstudies","MACD@tv-basicstudies"]&theme=Dark&style=1&timezone=Etc%2FUTC`}
                 style={{ width: "100%", height: "100%", border: "none" }}
                 title="TradingView Chart"
               />
            </div>
          </div>

          {/* Signal Panel */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Active Signal</h3>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>

            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-2xl bg-card" />
            ) : activeSignal ? (
              <SignalCard signal={activeSignal} className="flex-1" />
            ) : (
              <div className="flex-1 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center p-8 text-center bg-card/50">
                <RefreshCw className="w-10 h-10 text-muted-foreground mb-4 opacity-50" />
                <h4 className="text-lg font-medium mb-2">No Active Signals</h4>
                <p className="text-sm text-muted-foreground mb-6">
                  Waiting for market opportunities...
                </p>
                <GenerateSignalDialog />
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <section className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">Signal History</h3>
            <span className="text-xs font-mono text-muted-foreground">LAST 24 HOURS</span>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[100px]">Time</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : signalHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No history available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  signalHistory.map((signal) => {
                    const isBuy = signal.action === "BUY" || signal.action === "CALL";
                    return (
                      <TableRow key={signal.id} className="border-border hover:bg-muted/50 transition-colors">
                        <TableCell className="font-mono text-muted-foreground">
                          {format(new Date(signal.startTime), "HH:mm")}
                        </TableCell>
                        <TableCell className="font-bold">{signal.pair}</TableCell>
                        <TableCell>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-bold",
                            isBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {signal.action}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 bg-secondary rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full rounded-full", signal.confidence >= 80 ? "bg-green-500" : "bg-yellow-500")} 
                                style={{ width: `${signal.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono">{signal.confidence}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {format(new Date(signal.startTime), "HH:mm")} - {format(new Date(signal.endTime), "HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-mono text-muted-foreground">Closed</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
}
