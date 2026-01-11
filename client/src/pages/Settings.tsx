import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Send, Shield, Zap, Bell } from "lucide-react";
import { Settings } from "@shared/schema";
import { Sidebar } from "@/components/Sidebar";
import { Separator } from "@/components/ui/separator";

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
      toast({ title: "Settings updated successfully" });
    },
  });

  if (isLoading || !settings) return null;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 ml-0 lg:ml-64">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
            <p className="text-muted-foreground mt-1">Configure your AI trading parameters and integrations</p>
          </header>
          
          <div className="grid gap-8">
            {/* Telegram Configuration */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Telegram Notification Bot</CardTitle>
                    <CardDescription>Receive real-time signals directly on Telegram</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Bot API Token</Label>
                    <Input 
                      placeholder="Paste your bot token here"
                      className="font-mono bg-muted/30"
                      defaultValue={settings.telegramToken || ""} 
                      onBlur={(e) => mutation.mutate({ telegramToken: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">Obtained from @BotFather on Telegram</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Chat/Group ID</Label>
                    <Input 
                      placeholder="-100..."
                      className="font-mono bg-muted/30"
                      defaultValue={settings.telegramGroupId || ""} 
                      onBlur={(e) => mutation.mutate({ telegramGroupId: e.target.value })}
                    />
                    <p className="text-[11px] text-muted-foreground">The unique ID for your alert channel</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Engine Parameters */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Trading Engine Configuration</CardTitle>
                    <CardDescription>Fine-tune the AI signal filtering logic</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/40">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold">Automation Engine</Label>
                    <p className="text-xs text-muted-foreground">Enable automatic signal generation and execution</p>
                  </div>
                  <Switch 
                    checked={settings.autoTrading}
                    onCheckedChange={(checked) => mutation.mutate({ autoTrading: checked })}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <Separator className="opacity-50" />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">Minimum Confidence Threshold</Label>
                      <p className="text-xs text-muted-foreground">Only signals above this score will be processed</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input 
                        type="number"
                        min="70"
                        max="100"
                        className="w-20 text-center font-bold bg-muted/30"
                        defaultValue={settings.minConfidence}
                        onBlur={(e) => mutation.mutate({ minConfidence: parseInt(e.target.value) })}
                      />
                      <span className="text-sm font-medium">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Notifications */}
            <Card className="border-border/50 shadow-sm opacity-60">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Global Alerts</CardTitle>
                    <CardDescription>System-wide notification preferences</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label>Browser Audio Alerts</Label>
                  <Switch disabled checked={true} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
