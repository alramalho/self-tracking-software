import { useWindowDimensions, View } from "react-native";
import { CircleTileView, PersonTileView } from "./tiles";
import type { ExploreGridProps, ExploreTile } from "./types";

const GAP = 8;
const SIDE = 16;

// Two columns; a circle can take two rows of height beside two people.
export function ExploreGrid({ rows, onOpenCircle, onOpenPerson }: ExploreGridProps) {
  const { width } = useWindowDimensions();
  const square = (width - SIDE * 2 - GAP) / 2;
  const tile = (item: ExploreTile, size: "tall" | "square") =>
    item.kind === "circle" ? (
      <CircleTileView key={item.key} tile={item} size={size} onPress={() => onOpenCircle(item.circle)} />
    ) : (
      <PersonTileView key={item.key} tile={item} size={size} onPress={() => onOpenPerson(item.person)} />
    );
  return (
    <View testID="explore-grid" style={{ gap: GAP, paddingHorizontal: SIDE }}>
      {rows.map((row) =>
        row.kind === "feature" ? (
          <View key={row.key} style={{ flexDirection: row.side === "left" ? "row" : "row-reverse", gap: GAP, height: square * 2 + GAP }}>
            <View style={{ width: square }}>{tile(row.circle, "tall")}</View>
            <View style={{ width: square, gap: GAP }}>{row.people.map((person) => tile(person, "square"))}</View>
          </View>
        ) : (
          <View key={row.key} style={{ flexDirection: "row", gap: GAP, height: square }}>
            {row.tiles.map((item) => <View key={item.key} style={{ width: square }}>{tile(item, "square")}</View>)}
          </View>
        ),
      )}
    </View>
  );
}
