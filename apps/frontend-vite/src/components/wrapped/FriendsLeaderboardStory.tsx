import { useTheme } from "@/contexts/theme/useTheme";
import {
  getAccountLevels,
  HABIT_BONUS_POINTS,
  LIFESTYLE_BONUS_POINTS,
} from "@/hooks/useAccountLevel";
import { motion } from "framer-motion";
import React, { useMemo } from "react";

export interface FriendScore {
  username: string;
  name: string | null;
  picture: string | null;
  totalPoints: number;
  bestStreak: number;
}

interface FriendsLeaderboardStoryProps {
  year: number;
  friends: FriendScore[];
  currentUser: FriendScore;
}

export const FriendsLeaderboardStory: React.FC<FriendsLeaderboardStoryProps> = ({
  year,
  friends,
  currentUser,
}) => {
  const { isLightMode, isDarkMode } = useTheme();
  const levels = useMemo(() => getAccountLevels(isDarkMode), [isDarkMode]);

  const ranked = useMemo(() => {
    const all = [currentUser, ...friends];
    return all.sort((a, b) => b.totalPoints - a.totalPoints);
  }, [friends, currentUser]);

  const getLevel = (points: number) => {
    let current = levels[0];
    for (const level of levels) {
      if (points >= level.threshold) current = level;
      else break;
    }
    return current;
  };

  if (ranked.length < 2) return null;

  const podium = ranked.slice(0, 3);
  // Visual order: [2nd, 1st, 3rd]
  const podiumDisplay = podium.length >= 3
    ? [podium[1], podium[0], podium[2]]
    : podium.length === 2
      ? [podium[1], podium[0]]
      : [podium[0]];
  const podiumHeights = podium.length >= 3
    ? [96, 128, 72]
    : podium.length === 2
      ? [96, 128]
      : [128];

  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div
      className={`min-h-full flex flex-col relative ${isLightMode ? "bg-white" : "bg-neutral-950"}`}
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
      <div className={`absolute top-[5%] left-[-10%] w-[50%] h-[50%] rounded-full blur-3xl ${isLightMode ? "bg-violet-200/30" : "bg-violet-900/15"}`} />
      <div className={`absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-3xl ${isLightMode ? "bg-fuchsia-200/25" : "bg-fuchsia-900/10"}`} />

      {/* Header */}
      <div className="p-6 pt-12 shrink-0 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="font-zalando-expanded-black font-black italic"
        >
          <h2 className={`text-3xl font-bold ${isLightMode ? "text-neutral-900" : "text-white"}`}>
            <span className="text-xl opacity-50 font-zalando-expanded-black font-black italic">tracking.so<span className="opacity-50">ftware</span></span><br/>
            {year}'s leaderboard
          </h2>
        </motion.div>
      </div>

      <div className="px-6 relative z-10 flex-1 flex flex-col">
        {/* Podium */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-end justify-center gap-3 mb-8"
        >
          {podiumDisplay.map((person, idx) => {
            const height = podiumHeights[idx];
            const isFirst = person === podium[0];
            const level = getLevel(person.totalPoints);
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
                className="w-24 rounded-t-2xl flex flex-col items-center justify-start pt-2 ring-1"
                style={{
                  backgroundColor: `${level.color}15`,
                  borderColor: `${level.color}40`,
                  // @ts-expect-error ring color via CSS var
                  "--tw-ring-color": `${level.color}40`,
                }}
              >
                {person.picture ? (
                  <img
                    src={person.picture}
                    alt=""
                    className="w-10 h-10 rounded-full ring-2 mb-1"
                    style={{ borderColor: level.color, ["--tw-ring-color" as string]: level.color }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full ring-2 mb-1 flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: `${level.color}30`,
                      borderColor: level.color,
                      ["--tw-ring-color" as string]: level.color,
                      color: level.color,
                    }}
                  >
                    {(person.name || person.username)[0].toUpperCase()}
                  </div>
                )}
                <span className={`text-[10px] font-medium truncate max-w-[80px] px-1 ${isLightMode ? "text-neutral-700" : "text-white/70"}`}>
                  {person.username === currentUser.username ? "You" : (person.name || person.username).split(" ")[0]}
                </span>
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: level.color }}
                >
                  {ranked.indexOf(person) + 1}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Full list */}
        <div className="space-y-2 pb-6">
          {ranked.map((person, idx) => {
            const level = getLevel(person.totalPoints);
            const isYou = person.username === currentUser.username;
            return (
              <motion.div
                key={person.username}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.7 + idx * 0.05 }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                  isYou
                    ? isLightMode ? "bg-violet-50/80 ring-1 ring-violet-200/50" : "bg-white/8 ring-1 ring-white/15"
                    : isLightMode ? "bg-neutral-50/60" : "bg-white/5"
                }`}
              >
                <span
                  className="text-sm font-mono w-6 text-center font-bold"
                  style={{ color: level.color }}
                >
                  {idx + 1}
                </span>
                {person.picture ? (
                  <img
                    src={person.picture}
                    alt=""
                    className="w-8 h-8 rounded-full ring-1"
                    style={{ ["--tw-ring-color" as string]: `${level.color}60` }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: `${level.color}20`, color: level.color }}
                  >
                    {(person.name || person.username)[0].toUpperCase()}
                  </div>
                )}
                <div className={`flex-1 min-w-0 truncate text-sm ${isLightMode ? "text-neutral-700" : "text-white/80"}`}>
                  {isYou ? "You" : (person.name || person.username)}
                </div>
                <div className="text-sm text-right shrink-0">
                  <span className="font-mono font-semibold" style={{ color: level.color }}>
                    {formatNumber(person.totalPoints)}
                  </span>
                  {" "}
                  <span className={`font-normal text-xs ${isLightMode ? "text-neutral-400" : "text-white/50"}`}>
                    pts
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

type PlanWithProgress = {
  deletedAt: Date | string | null;
  progress: {
    achievement?: { streak?: number };
    habitAchievement: { isAchieved: boolean };
    lifestyleAchievement: { isAchieved: boolean };
  };
};

export function computeFriendScore(
  activityEntries: { datetime: Date | string }[],
  plans: PlanWithProgress[],
): { totalPoints: number; bestStreak: number } {
  const totalActivitiesLogged = activityEntries.length;
  const activePlans = plans.filter((p) => !p.deletedAt);
  const habitBonus = activePlans.filter((p) => p.progress?.habitAchievement?.isAchieved).length * HABIT_BONUS_POINTS;
  const lifestyleBonus = activePlans.filter((p) => p.progress?.lifestyleAchievement?.isAchieved).length * LIFESTYLE_BONUS_POINTS;
  const totalPoints = totalActivitiesLogged + habitBonus + lifestyleBonus;
  const bestStreak = Math.max(0, ...activePlans.map((p) => p.progress?.achievement?.streak || 0));
  return { totalPoints, bestStreak };
}

export default FriendsLeaderboardStory;
