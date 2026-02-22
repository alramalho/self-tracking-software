import { useApiWithAuth } from "@/api";
import { useTheme } from "@/contexts/theme/useTheme";
import { useCurrentUser } from "@/contexts/users";
import { getAccountLevels } from "@/hooks/useAccountLevel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ChevronLeft, Flame, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/rankings")({
  component: RankingsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
  }),
});

type RankedUser = {
  rank: number;
  username: string;
  name: string | null;
  picture: string | null;
  totalPoints: number;
  bestStreak: number;
};

type RankingsResponse = {
  pointsRanking: RankedUser[];
  streaksRanking: RankedUser[];
  currentUser: {
    pointsRank: number | null;
    streaksRank: number | null;
    totalPoints: number;
    bestStreak: number;
  };
};

function RankingsPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const api = useApiWithAuth();
  const { currentUser } = useCurrentUser();
  const { isLightMode, isDarkMode } = useTheme();
  const levels = useMemo(() => getAccountLevels(isDarkMode), [isDarkMode]);

  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: ["rankings"],
    queryFn: async () => {
      const res = await api.get("/users/rankings");
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const getLevel = (points: number) => {
    let current = levels[0];
    for (const level of levels) {
      if (points >= level.threshold) current = level;
      else break;
    }
    return current;
  };

  const formatNumber = (n: number) => n.toLocaleString();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pointsRanking = data?.pointsRanking || [];
  const streaksRanking = data?.streaksRanking || [];
  const currentUserRank = data?.currentUser;

  const renderPodium = (ranked: RankedUser[], mode: "points" | "streaks") => {
    const podium = ranked.slice(0, 3);
    if (podium.length < 2) return null;

    const podiumDisplay =
      podium.length >= 3
        ? [podium[1], podium[0], podium[2]]
        : [podium[1], podium[0]];
    const podiumHeights =
      podium.length >= 3 ? [96, 128, 88] : [96, 128];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex items-end justify-center gap-3 mb-8"
      >
        {podiumDisplay.map((person, idx) => {
          const height = podiumHeights[idx];
          const mc = person.rank === 1 ? "#fbbf24" : person.rank === 2 ? "#94a3b8" : "#cd7f32";
          return (
            <motion.div
              key={person.username}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height, opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: 0.4 + idx * 0.15,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className="w-24 rounded-t-2xl flex flex-col items-center justify-start pt-2 ring-1 cursor-pointer"
              style={{
                backgroundColor: `${mc}15`,
                borderColor: `${mc}40`,
                // @ts-expect-error ring color via CSS var
                "--tw-ring-color": `${mc}40`,
              }}
              onClick={() =>
                navigate({
                  to: "/profile/$username",
                  params: { username: person.username },
                })
              }
            >
              {person.picture ? (
                <img
                  src={person.picture}
                  alt=""
                  className="w-10 h-10 rounded-full ring-2 mb-1"
                  style={{
                    borderColor: mc,
                    ["--tw-ring-color" as string]: mc,
                  }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full ring-2 mb-1 flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: `${mc}30`,
                    borderColor: mc,
                    ["--tw-ring-color" as string]: mc,
                    color: mc,
                  }}
                >
                  {(person.name || person.username)[0].toUpperCase()}
                </div>
              )}
              <span
                className={`text-[10px] font-medium truncate max-w-[80px] px-1 ${isLightMode ? "text-neutral-700" : "text-white/70"}`}
              >
                {person.username === currentUser?.username
                  ? "You"
                  : (person.name || person.username).split(" ")[0]}
              </span>
              <span
                className="text-[10px] font-mono font-bold"
                style={{
                  color:
                    person.rank === 1
                      ? "#fbbf24"
                      : person.rank === 2
                        ? "#94a3b8"
                        : "#cd7f32",
                }}
              >
                {person.rank}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    );
  };

  const medalColors = {
    1: { color: "#fbbf24", bg: isLightMode ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.1)", ring: "rgba(251,191,36,0.3)" },
    2: { color: "#94a3b8", bg: isLightMode ? "rgba(148,163,184,0.08)" : "rgba(148,163,184,0.1)", ring: "rgba(148,163,184,0.3)" },
    3: { color: "#cd7f32", bg: isLightMode ? "rgba(205,127,50,0.08)" : "rgba(205,127,50,0.1)", ring: "rgba(205,127,50,0.3)" },
  } as Record<number, { color: string; bg: string; ring: string }>;

  const renderList = (ranked: RankedUser[], mode: "points" | "streaks") => {
    return (
      <div className="space-y-2 pb-6">
        {ranked.map((person, idx) => {
          const level = getLevel(person.totalPoints);
          const isYou = person.username === currentUser?.username;
          const medal = medalColors[person.rank];
          const rowStyle: React.CSSProperties = medal
            ? { backgroundColor: medal.bg, boxShadow: `inset 0 0 0 1px ${medal.ring}` }
            : {};
          return (
            <motion.div
              key={person.username}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + idx * 0.05 }}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer ${
                medal
                  ? ""
                  : isYou
                    ? mode === "streaks"
                      ? isLightMode
                        ? "bg-orange-50/80 ring-1 ring-orange-200/50"
                        : "bg-white/8 ring-1 ring-white/15"
                      : isLightMode
                        ? "bg-violet-50/80 ring-1 ring-violet-200/50"
                        : "bg-white/8 ring-1 ring-white/15"
                    : isLightMode
                      ? "bg-neutral-50/60"
                      : "bg-white/5"
              }`}
              style={rowStyle}
              onClick={() =>
                navigate({
                  to: "/profile/$username",
                  params: { username: person.username },
                })
              }
            >
              <span
                className="text-sm font-mono w-6 text-center font-bold"
                style={{ color: medal?.color || level.color }}
              >
                {person.rank}
              </span>
              {person.picture ? (
                <img
                  src={person.picture}
                  alt=""
                  className="w-8 h-8 rounded-full ring-1"
                  style={{
                    ["--tw-ring-color" as string]: `${level.color}60`,
                  }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{
                    backgroundColor: `${level.color}20`,
                    color: level.color,
                  }}
                >
                  {(person.name || person.username)[0].toUpperCase()}
                </div>
              )}
              <div
                className={`flex-1 min-w-0 truncate text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}
              >
                {isYou ? "You" : person.name || person.username}
              </div>
              {mode === "points" ? (
                <div className="text-sm text-right shrink-0">
                  <span
                    className="font-mono font-semibold"
                    style={{ color: level.color }}
                  >
                    {formatNumber(person.totalPoints)}
                  </span>{" "}
                  <span
                    className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
                  >
                    pts
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-sm text-right shrink-0">
                  <Flame
                    size={14}
                    className={
                      isLightMode ? "text-orange-500" : "text-orange-400"
                    }
                  />
                  <span
                    className={`font-mono font-semibold ${isLightMode ? "text-orange-600" : "text-orange-400"}`}
                  >
                    {person.bestStreak}
                  </span>
                  <span
                    className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
                  >
                    wks
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Show current user if outside top 10 */}
        {mode === "points" &&
          currentUserRank &&
          currentUserRank.pointsRank &&
          currentUserRank.pointsRank > 10 &&
          currentUser && (
            <>
              <div
                className={`text-center text-xs py-1 ${isLightMode ? "text-neutral-400" : "text-white/30"}`}
              >
                ···
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  isLightMode
                    ? "bg-violet-50/80 ring-1 ring-violet-200/50"
                    : "bg-white/8 ring-1 ring-white/15"
                }`}
              >
                <span
                  className="text-sm font-mono w-6 text-center font-bold"
                  style={{
                    color: getLevel(currentUserRank.totalPoints).color,
                  }}
                >
                  {currentUserRank.pointsRank}
                </span>
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt=""
                    className="w-8 h-8 rounded-full ring-1"
                    style={{
                      ["--tw-ring-color" as string]: `${getLevel(currentUserRank.totalPoints).color}60`,
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: `${getLevel(currentUserRank.totalPoints).color}20`,
                      color: getLevel(currentUserRank.totalPoints).color,
                    }}
                  >
                    {(currentUser.name || currentUser.username || "U")[0].toUpperCase()}
                  </div>
                )}
                <div
                  className={`flex-1 min-w-0 truncate text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}
                >
                  You
                </div>
                <div className="text-sm text-right shrink-0">
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: getLevel(currentUserRank.totalPoints).color,
                    }}
                  >
                    {formatNumber(currentUserRank.totalPoints)}
                  </span>{" "}
                  <span
                    className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
                  >
                    pts
                  </span>
                </div>
              </motion.div>
            </>
          )}

        {mode === "streaks" &&
          currentUserRank &&
          currentUserRank.streaksRank &&
          currentUserRank.streaksRank > 10 &&
          currentUser && (
            <>
              <div
                className={`text-center text-xs py-1 ${isLightMode ? "text-neutral-400" : "text-white/30"}`}
              >
                ···
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.8 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  isLightMode
                    ? "bg-orange-50/80 ring-1 ring-orange-200/50"
                    : "bg-white/8 ring-1 ring-white/15"
                }`}
              >
                <span
                  className="text-sm font-mono w-6 text-center font-bold"
                  style={{
                    color: getLevel(currentUserRank.totalPoints).color,
                  }}
                >
                  {currentUserRank.streaksRank}
                </span>
                {currentUser.picture ? (
                  <img
                    src={currentUser.picture}
                    alt=""
                    className="w-8 h-8 rounded-full ring-1"
                    style={{
                      ["--tw-ring-color" as string]: `${getLevel(currentUserRank.totalPoints).color}60`,
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{
                      backgroundColor: `${getLevel(currentUserRank.totalPoints).color}20`,
                      color: getLevel(currentUserRank.totalPoints).color,
                    }}
                  >
                    {(currentUser.name || currentUser.username || "U")[0].toUpperCase()}
                  </div>
                )}
                <div
                  className={`flex-1 min-w-0 truncate text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}
                >
                  You
                </div>
                <div className="flex items-center gap-1.5 text-sm text-right shrink-0">
                  <Flame
                    size={14}
                    className={
                      isLightMode ? "text-orange-500" : "text-orange-400"
                    }
                  />
                  <span
                    className={`font-mono font-semibold ${isLightMode ? "text-orange-600" : "text-orange-400"}`}
                  >
                    {currentUserRank.bestStreak}
                  </span>
                  <span
                    className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}
                  >
                    wks
                  </span>
                </div>
              </motion.div>
            </>
          )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex flex-col relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
    >
      {/* Background */}
      <div className="absolute inset-0 opacity-[0.04]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${isLightMode ? "black" : "white"} 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />
      </div>
      <div
        className={`absolute top-[5%] left-[-10%] w-[50%] h-[50%] rounded-full blur-3xl ${isLightMode ? "bg-violet-200/30" : "bg-violet-900/15"}`}
      />
      <div
        className={`absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-fuchsia-200/25" : "bg-fuchsia-900/10"}`}
      />

      {/* Header */}
      <div className="p-4 pt-6 shrink-0 relative z-10 flex items-center gap-3">
        <button
          className={`p-2 rounded-full ${isLightMode ? "hover:bg-neutral-100" : "hover:bg-white/10"}`}
          onClick={() => navigate({ to: "/" })}
        >
          <ChevronLeft
            size={20}
            className={isLightMode ? "text-neutral-900" : "text-white"}
          />
        </button>
        <h1
          className={`text-2xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}
        >
          Rankings
        </h1>
      </div>

      {/* Tabs */}
      <div className="px-4 relative z-10 flex-1">
        <Tabs defaultValue={tab === "streaks" ? "streaks" : "points"} className="w-full">
          <TabsList className="grid w-full h-12 grid-cols-2 mb-4">
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="streaks">Streaks</TabsTrigger>
          </TabsList>

          <TabsContent value="points">
            {pointsRanking.length > 0 ? (
              <>
                {renderPodium(pointsRanking, "points")}
                {renderList(pointsRanking, "points")}
              </>
            ) : (
              <div
                className={`text-center py-12 ${isLightMode ? "text-neutral-400" : "text-white/40"}`}
              >
                No rankings data yet
              </div>
            )}
          </TabsContent>

          <TabsContent value="streaks">
            {streaksRanking.length > 0 ? (
              <>
                {renderPodium(streaksRanking, "streaks")}
                {renderList(streaksRanking, "streaks")}
              </>
            ) : (
              <div
                className={`text-center py-12 ${isLightMode ? "text-neutral-400" : "text-white/40"}`}
              >
                No streaks data yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
