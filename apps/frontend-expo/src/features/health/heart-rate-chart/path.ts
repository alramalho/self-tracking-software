import type { HeartRateChartPoint } from "./types";

function coordinate(value: number) {
  return value.toFixed(2);
}

// Monotone cubic interpolation passes through every reading without adding false peaks.
export function smoothRunPath(points: HeartRateChartPoint[]) {
  if (points.length < 2) return "";
  const widths = points.slice(1).map((point, index) => point.x - points[index].x);
  const slopes = widths.map((width, index) => (points[index + 1].y - points[index].y) / width);
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes[slopes.length - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before * after <= 0) return 0;
    const beforeWidth = widths[index - 1];
    const afterWidth = widths[index];
    const beforeWeight = 2 * afterWidth + beforeWidth;
    const afterWeight = afterWidth + 2 * beforeWidth;
    return (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
  });
  const commands = [`M ${coordinate(points[0].x)} ${coordinate(points[0].y)}`];
  for (let index = 0; index < widths.length; index++) {
    const from = points[index];
    const to = points[index + 1];
    const controlWidth = widths[index] / 3;
    commands.push(
      `C ${coordinate(from.x + controlWidth)} ${coordinate(from.y + tangents[index] * controlWidth)}` +
      ` ${coordinate(to.x - controlWidth)} ${coordinate(to.y - tangents[index + 1] * controlWidth)}` +
      ` ${coordinate(to.x)} ${coordinate(to.y)}`,
    );
  }
  return commands.join(" ");
}

export function smoothAreaPath(points: HeartRateChartPoint[], baseline: number) {
  const line = smoothRunPath(points);
  if (!line) return "";
  return `${line} L ${coordinate(points[points.length - 1].x)} ${coordinate(baseline)}` +
    ` L ${coordinate(points[0].x)} ${coordinate(baseline)} Z`;
}
