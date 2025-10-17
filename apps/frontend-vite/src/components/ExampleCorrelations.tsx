import { CorrelationEntry } from "@/components/CorrelationEntry";
import { Card } from "@/components/ui/card";

export const ExampleCorrelations = () => {
  return (
    <Card className="p-6 bg-card opacity-70">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">
            Example correlations
          </h2>
          <p className="text-muted-foreground">
            Metric chosen: Happiness 😊
          </p>
        </div>

        <div className="space-y-4">
          <CorrelationEntry 
            title="🏃‍♂️ Exercise"
            pearsonValue={0.65}
          />

          <CorrelationEntry 
            title="🧘‍♂️ Meditation"
            pearsonValue={0.45}
          />
        </div>

        <p className="text-sm text-muted-foreground italic">
          These percentages show the Pearson correlation coefficient between your happiness and activities.
          A positive correlation means the activity tends to increase your happiness, while a negative correlation means it tends to decrease it.
          The stronger the correlation (closer to 100%), the stronger the relationship.
        </p>
      </div>
    </Card>
  );
}; 