// People to follow and circles to join for the Search (explore) screen.
// Photos are public placeholder portraits; nothing here is a real account.
const portrait = (kind: "women" | "men", n: number) => `https://randomuser.me/api/portraits/${kind}/${n}.jpg`;
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;

const people = [
  { id: "explore-marta", username: "martaruns", name: "Marta Sousa", picture: portrait("women", 44), plan: { goal: "Run a half marathon", emoji: "🏃‍♀️" } },
  { id: "explore-joao", username: "joaop", name: "João Pereira", picture: portrait("men", 32), plan: { goal: "Learn guitar", emoji: "🎸" } },
  { id: "explore-amelie", username: "amelie", name: "Amélie Laurent", picture: portrait("women", 68), plan: { goal: "Read 20 books", emoji: "📚" } },
  { id: "explore-kenji", username: "kenji", name: "Kenji Watanabe", picture: portrait("men", 75), plan: { goal: "Strength train", emoji: "🏋️" } },
  { id: "explore-sofia", username: "sofiab", name: "Sofia Bianchi", picture: portrait("women", 21), plan: { goal: "Meditate daily", emoji: "🧘" } },
  { id: "explore-daniel", username: "danielk", name: "Daniel Kim", picture: null, plan: { goal: "Ship a side project", emoji: "💻" } },
  { id: "explore-ines", username: "inesc", name: "Inês Costa", picture: portrait("women", 90), plan: { goal: "Swim twice a week", emoji: "🏊‍♀️" } },
  { id: "explore-tom", username: "tomh", name: "Tom Hughes", picture: portrait("men", 11), plan: { goal: "Cycle to work", emoji: "🚴" } },
];

export const recommendedUsersFixture = {
  recommendations: people.map((person, index) => ({ recommendationObjectId: person.id, score: 1 - index / 10 })),
  users: people.map(({ plan: _plan, ...user }) => user),
  plans: people.map((person, index) => ({
    id: `${person.id}-plan`,
    userId: person.id,
    goal: person.plan.goal,
    emoji: person.plan.emoji,
    sortOrder: 0,
    createdAt: new Date(Date.UTC(2026, 8, index + 1)).toISOString(),
    archivedAt: null,
  })),
};

const member = (name: string, goal: string, picture: string | null) => ({ name, goal, picture });

const circles = [
  {
    id: "explore-circle-runners", name: "Lisbon morning runners", emoji: "🏃", place: "Lisbon", paceLabel: "3–4 a week",
    memberCount: 4, logsThisWeek: 9, previews: [photo("run-river"), photo("run-bridge")], morePhotos: 6,
    members: [member("Rita", "Run 10k", portrait("women", 12)), member("Jonas", "Run a marathon", portrait("men", 41)), member("Ana", "Run 5k", portrait("women", 33)), member("Pedro", "Run twice a week", null)],
  },
  {
    id: "explore-circle-guitar", name: "Guitar every evening", emoji: "🎸", place: null, paceLabel: "5 a week",
    memberCount: 3, logsThisWeek: 7, previews: [photo("guitar-desk")], morePhotos: 2,
    members: [member("Leo", "Learn guitar", portrait("men", 22)), member("Maya", "Play 15 minutes a day", portrait("women", 56)), member("Sam", "Learn three songs", null)],
  },
  {
    id: "explore-circle-readers", name: "Slow readers club", emoji: "📚", place: "Porto", paceLabel: "4–5 a week",
    memberCount: 4, logsThisWeek: 11, previews: [], morePhotos: 0,
    members: [member("Clara", "Read 12 books", portrait("women", 5)), member("Hugo", "Read before bed", portrait("men", 64)), member("Noa", "Read 20 pages a day", portrait("women", 79)), member("Ivo", "Finish Dune", null)],
  },
  {
    id: "explore-circle-gym", name: "Lunchtime lifters", emoji: "🏋️", place: "Berlin", paceLabel: "3 a week",
    memberCount: 2, logsThisWeek: 4, previews: [photo("gym-weights")], morePhotos: 1,
    members: [member("Felix", "Strength train", portrait("men", 52)), member("Lena", "Deadlift 100kg", portrait("women", 47))],
  },
].map((circle) => ({ ...circle, status: "ACTIVE" as const, reasons: ["goal" as const] }));

export const circleSuggestionsFixture = [
  { plan: { id: "plan-run", goal: "Run a half marathon", emoji: "🏃" }, circles: [circles[0], circles[3]] },
  { plan: { id: "plan-read", goal: "Read more", emoji: "📚" }, circles: [circles[2], circles[1]] },
];

export const searchCirclesFixture = (query: string) => {
  const q = query.trim().toLowerCase();
  return circles.filter((circle) => [circle.name, ...circle.members.map((m) => m.goal)].some((text) => text.toLowerCase().includes(q)));
};
