import { useState } from "react";
import { useGenerateSignal } from "@/hooks/use-signals";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Wand2 } from "lucide-react";

const TRADING_PAIRS = [
  "AUD/JPY", "EUR/USD", "GBP/USD", "USD/JPY", 
  "USD/CHF", "AUD/USD", "NZD/USD", "EUR/JPY"
];

export function GenerateSignalDialog() {
  const [open, setOpen] = useState(false);
  const [selectedPair, setSelectedPair] = useState<string>("");
  const generateSignal = useGenerateSignal();

  const handleGenerate = async () => {
    if (!selectedPair) return;
    try {
      await generateSignal.mutateAsync(selectedPair);
      setOpen(false);
      setSelectedPair("");
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Generate Signal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">New AI Analysis</DialogTitle>
          <DialogDescription>
            Select a currency pair to run the M5 prediction model.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Currency Pair
            </label>
            <Select onValueChange={setSelectedPair} value={selectedPair}>
              <SelectTrigger className="w-full bg-background border-input">
                <SelectValue placeholder="Select pair..." />
              </SelectTrigger>
              <SelectContent>
                {TRADING_PAIRS.map((pair) => (
                  <SelectItem key={pair} value={pair}>
                    {pair}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!selectedPair || generateSignal.isPending}
            className="bg-primary text-primary-foreground"
          >
            {generateSignal.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Generate Signal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
