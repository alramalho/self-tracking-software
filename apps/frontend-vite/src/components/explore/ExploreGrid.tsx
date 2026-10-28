import { cn } from "@/lib/utils";
import { CircleTileView, PersonTileView } from "./tiles";
import type { ExploreGridProps, ExploreTile } from "./types";

// Two columns; a circle can take two rows of height beside two people.
export function ExploreGrid({ rows, onOpenCircle, onOpenPerson }: ExploreGridProps) {
  const tile = (item: ExploreTile, size: "tall" | "square") =>
    item.kind === "circle" ? (
      <CircleTileView key={item.key} tile={item} size={size} onPress={() => onOpenCircle(item.circle)} />
    ) : (
      <PersonTileView key={item.key} tile={item} size={size} onPress={() => onOpenPerson(item.person)} />
    );
  return (
    <div data-testid="explore-grid" className="flex flex-col gap-2">
      {rows.map((row) =>
        row.kind === "feature" ? (
          <div key={row.key} className="grid grid-cols-2 grid-rows-2 gap-2">
            <div className={cn("row-span-2", row.side === "right" && "col-start-2 row-start-1")}>{tile(row.circle, "tall")}</div>
            {row.people.map((person) => (
              <div key={person.key} className={cn(row.side === "right" && "col-start-1")}>{tile(person, "square")}</div>
            ))}
          </div>
        ) : (
          <div key={row.key} className="grid grid-cols-2 gap-2">
            {row.tiles.map((item) => tile(item, "square"))}
          </div>
        ),
      )}
    </div>
  );
}
