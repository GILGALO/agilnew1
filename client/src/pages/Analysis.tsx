import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BrainCircuit, TrendingUp, BarChart3, Lock } from "lucide-react";

export default function Analysis() {
  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Market Intelligence</h1>
          <p className="text-muted-foreground mt-1">Deep dive AI analysis on market trends</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Market Sentiment</CardTitle>
              <BrainCircuit className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Bullish</div>
              <p className="text-xs text-muted-foreground">
                +14.2% confidence vs last session
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Volatility Index</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">High</div>
              <p className="text-xs text-muted-foreground">
                Expect rapid M5 movements
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">87.5%</div>
              <p className="text-xs text-muted-foreground">
                Based on last 50 signals
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle>AI Reasoning Logs</CardTitle>
              <CardDescription>Real-time decision making process</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="p-2 bg-primary/10 rounded-md">
                    <BrainCircuit className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-sm">Pattern Recognition: Double Bottom</h4>
                      <span className="text-xs font-mono text-muted-foreground">10:4{i} AM</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Detected strong support level at 154.20 on AUD/JPY. RSI divergence suggests upward momentum. 
                      Volume profile confirms accumulation phase. Preparing BUY signal for next M5 candle.
                    </p>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center justify-center p-8 border-t border-border/50 mt-4">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <Lock className="w-8 h-8 opacity-50" />
                  <p className="text-sm">Upgrade to Pro to see full analysis depth</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
