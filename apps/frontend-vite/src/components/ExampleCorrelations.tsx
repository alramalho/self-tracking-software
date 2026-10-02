import { FindingRow } from "@/components/metrics/FindingRow";
import { Card } from "@/components/ui/card";
import { CAVEAT } from "@/lib/metricWords";

// Made-up rows, in the same format as the insights card on the Metrics page.
export const ExampleCorrelations = () => {
  return (
    <Card className="p-6 bg-card opacity-70">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Example</h2>
          <p className="text-muted-foreground">
            Metric chosen: Happiness 😊
          </p>
        </div>

        <div className="space-y-4 pointer-events-none">
          <FindingRow
            label="🏃‍♂️ Exercise"
            difference={0.18}
            signal={3}
            waiting=""
          />

          <FindingRow
            label="🧘‍♂️ Meditation"
            difference={0.12}
            signal={2}
            waiting=""
          />
        </div>

        <p className="text-sm text-muted-foreground italic">
          The number is how much higher or lower your happiness averages on the
          days you logged the activity. A longer bar is a bigger difference.{" "}
          {CAVEAT}
        </p>
      </div>
    </Card>
  );
};
