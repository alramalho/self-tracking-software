import { CHART_PADDING, CHART_WIDTH } from "./model";
import type { HeartRateChartSegment, HeartRateColoredSegment, HeartRateGradientStop } from "./types";

function offset(x: number) {
  return (x - CHART_PADDING) / (CHART_WIDTH - 2 * CHART_PADDING);
}

export function zoneStrokeStops(segments: HeartRateChartSegment[]): HeartRateGradientStop[] {
  const colored = segments.filter((segment): segment is HeartRateColoredSegment => segment.zone != null);
  if (colored.length === 0) return [];

  const stops: HeartRateGradientStop[] = [{ offset: offset(colored[0].from.x), zone: colored[0].zone }];
  for (let index = 1; index < colored.length; index++) {
    const previous = colored[index - 1];
    const current = colored[index];
    if (current.zone !== previous.zone) {
      const boundary = offset(current.from.x);
      stops.push({ offset: boundary, zone: previous.zone });
      stops.push({ offset: boundary, zone: current.zone });
    }
  }
  const last = colored[colored.length - 1];
  stops.push({ offset: offset(last.to.x), zone: last.zone });
  return stops;
}
