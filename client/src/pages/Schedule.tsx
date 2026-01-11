import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, Info, ShieldAlert, Zap, Coffee, Moon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const SESSIONS = [
  {
    name: "ASIAN SESSION",
    time: "07:00 - 12:00",
    description: "Best for JPY, AUD, NZD pairs. Stable trends.",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    name: "LONDON SESSION",
    time: "12:00 - 17:00",
    description: "High volatility. Best for EUR, GBP pairs.",
    icon: Zap,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    name: "LUNCH BREAK",
    time: "17:00 - 18:00",
    description: "Low liquidity. Recommended rest period.",
    icon: Coffee,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
  {
    name: "NEW YORK SESSION",
    time: "18:00 - 23:00",
    description: "Overlap with London. Institutional moves.",
    icon: Zap,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    name: "NIGHT BREAK",
    time: "23:00 - 07:00",
    description: "Low volume. Blocked for safety.",
    icon: Moon,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
];

export default function Schedule() {
  const { data: sessionData } = useQuery<{ session: string }>({
    queryKey: ["/api/session"],
    refetchInterval: 10000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 p-4 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">Trading Schedule</h1>
          <p className="text-muted-foreground mt-1">View forex trading sessions in EAT (East Africa Time)</p>
          <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg w-fit text-sm font-medium">
            <Clock className="w-4 h-4" />
            <span>Kenya Time (UTC+3)</span>
          </div>
        </header>

        <div className="grid gap-6">
          {SESSIONS.map((session) => {
            const isActive = sessionData?.session.toLowerCase() === session.name.toLowerCase() || 
                           (session.name === "ASIAN SESSION" && sessionData?.session === "Asian") ||
                           (session.name === "LONDON SESSION" && sessionData?.session === "London") ||
                           (session.name === "NEW YORK SESSION" && sessionData?.session === "New York");

            return (
              <Card key={session.name} className={`border-border/50 shadow-sm transition-all duration-300 ${isActive ? 'ring-2 ring-primary scale-[1.02]' : 'opacity-80'}`}>
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={`p-3 rounded-xl ${session.bgColor} ${session.color}`}>
                    <session.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold">{session.name}</CardTitle>
                      {isActive && (
                        <span className="flex items-center gap-1 text-xs font-bold text-primary animate-pulse">
                          <div className="w-2 h-2 bg-primary rounded-full" />
                          CURRENTLY ACTIVE
                        </span>
                      )}
                    </div>
                    <CardDescription className="text-lg font-mono font-medium text-foreground/80">
                      {session.time}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2 text-muted-foreground italic">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{session.description}</p>
                  </div>
                  {session.name === "NIGHT BREAK" && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-sm font-semibold">
                      <ShieldAlert className="w-4 h-4" />
                      Trading is automatically suspended during this period.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
