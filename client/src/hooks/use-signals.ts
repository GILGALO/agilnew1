import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type SignalInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useSignals() {
  return useQuery({
    queryKey: [api.signals.list.path],
    queryFn: async () => {
      const res = await fetch(api.signals.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch signals");
      return api.signals.list.responses[200].parse(await res.json());
    },
    refetchInterval: 5000, // Poll every 5s for new signals
  });
}

export function useSignal(id: number) {
  return useQuery({
    queryKey: [api.signals.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.signals.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch signal");
      return api.signals.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateSignal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SignalInput) => {
      const validated = api.signals.create.input.parse(data);
      const res = await fetch(api.signals.create.path, {
        method: api.signals.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.signals.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create signal");
      }
      return api.signals.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.signals.list.path] });
      toast({
        title: "Signal Created",
        description: "New trading signal has been published.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useGenerateSignal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (pair: string) => {
      const res = await fetch(api.signals.generate.path, {
        method: api.signals.generate.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to generate AI signal");
      return api.signals.generate.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.signals.list.path] });
      toast({
        title: "AI Analysis Complete",
        description: "New signal generated based on market analysis.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
