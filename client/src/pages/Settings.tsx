import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings } from "@shared/schema";
import Sidebar from "@/components/Sidebar";

export default function SettingsPage() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const mutation = useMutation({
    mutationFn: async (update: Partial<Settings>) => {
      const res = await apiRequest("PATCH", "/api/settings", update);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated" });
    },
  });

  if (isLoading || !settings) return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        <div className="grid gap-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Telegram Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Bot Token</Label>
                <Input 
                  defaultValue={settings.telegramToken || ""} 
                  onBlur={(e) => mutation.mutate({ telegramToken: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Group/Channel ID</Label>
                <Input 
                  defaultValue={settings.telegramGroupId || ""} 
                  onBlur={(e) => mutation.mutate({ telegramGroupId: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trading Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Minimum Confidence (%)</Label>
                <Input 
                  type="number"
                  className="w-24"
                  defaultValue={settings.minConfidence}
                  onBlur={(e) => mutation.mutate({ minConfidence: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-Trading Mode</Label>
                <Switch 
                  checked={settings.autoTrading}
                  onCheckedChange={(checked) => mutation.mutate({ autoTrading: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
