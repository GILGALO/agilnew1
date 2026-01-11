import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trade } from "@shared/schema";
import Sidebar from "@/components/Sidebar";
import { format } from "date-fns";

export default function History() {
  const { data: history, isLoading } = useQuery<Trade[]>({
    queryKey: ["/api/history"],
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Trade History</h1>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history?.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>{format(new Date(trade.timestamp!), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="font-bold">{trade.pair}</TableCell>
                    <TableCell>
                      <Badge variant={trade.action === "BUY" ? "default" : "destructive"}>
                        {trade.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{trade.confidence}%</TableCell>
                    <TableCell>{trade.session}</TableCell>
                    <TableCell>
                      {trade.result ? (
                        <Badge variant={trade.result === "win" ? "outline" : "secondary"}>
                          {trade.result.toUpperCase()}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
