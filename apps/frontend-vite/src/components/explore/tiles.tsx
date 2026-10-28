import { PersonAvatar } from "@/components/circles/components";
import { cn } from "@/lib/utils";
import { circleLine, planLine } from "./words";
import type { CircleTile, FacesProps, PersonTile, TileProps } from "./types";

const tileClass = "relative flex overflow-hidden rounded-[18px] bg-card text-left transition-opacity active:opacity-80";

// Photo tiles keep white text readable with a dark fade at the bottom.
function Scrim() {
  return <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-b from-black/0 to-black/70" />;
}

export function PersonTileView({ tile, onPress }: TileProps<PersonTile>) {
  const { person } = tile;
  const name = person.name || person.username;
  const photo = !!person.picture;
  return (
    <button
      type="button"
      data-testid={`explore-${tile.key}`}
      aria-label={`${name}, ${planLine(person)}`}
      onClick={onPress}
      className={cn(tileClass, "aspect-square w-full")}
    >
      {photo ? (
        <>
          <img src={person.picture!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <Scrim />
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center pb-9">
          <PersonAvatar name={name} size={64} />
        </div>
      )}
      <div className="absolute inset-x-3 bottom-3 flex flex-col gap-0.5">
        <span className={cn("truncate text-[15px] font-bold", photo ? "text-white" : "text-foreground")}>{name}</span>
        <span className={cn("truncate text-[13px]", photo ? "text-white/85" : "text-muted-foreground")}>{planLine(person)}</span>
      </div>
    </button>
  );
}

export function CircleTileView({ tile, size, onPress }: TileProps<CircleTile>) {
  const { card } = tile.circle;
  const photo = card.previews[0];
  const tall = size === "tall";
  return (
    <button
      type="button"
      data-testid={`explore-${tile.key}`}
      aria-label={`${card.name}, ${circleLine(card)}`}
      onClick={onPress}
      className={cn(tileClass, "h-full w-full flex-col justify-between p-3.5", !tall && "aspect-square")}
    >
      {photo && (
        <>
          <img src={photo} alt="" className={cn("absolute inset-0 h-full w-full scale-110 object-cover", tall ? "blur-[10px]" : "blur-[8px]")} />
          <div className="absolute inset-0 bg-black/20" />
          <Scrim />
        </>
      )}
      <span className={cn("relative", tall ? "text-[44px] leading-[52px]" : "text-[30px] leading-9")}>{card.emoji}</span>
      <div className={cn("relative flex flex-col", tall ? "gap-2" : "gap-1.5")}>
        <div className="flex flex-col gap-0.5">
          <span className={cn("line-clamp-2 font-bold leading-tight", tall ? "text-lg" : "text-[15px]", photo ? "text-white" : "text-foreground")}>{card.name}</span>
          <span className={cn("truncate text-[13px]", photo ? "text-white/85" : "text-muted-foreground")}>{circleLine(card)}</span>
        </div>
        <Faces circle={tile.circle} onPhoto={!!photo} />
      </div>
    </button>
  );
}

function Faces({ circle, onPhoto }: FacesProps) {
  const { card, joined } = circle;
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {card.members.slice(0, 4).map((member, index) => (
          <div key={index} className={cn("rounded-full border-2", onPhoto ? "border-white/90" : "border-card", index > 0 && "-ml-2")}>
            <PersonAvatar name={member.name} picture={member.picture} size={22} />
          </div>
        ))}
      </div>
      <span className={cn("truncate text-xs font-semibold", onPhoto ? "text-white/85" : "text-muted-foreground")}>
        {joined ? "You're in" : `${card.memberCount} of 5`}
      </span>
    </div>
  );
}
