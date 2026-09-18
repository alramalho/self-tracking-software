// Run over stdin inside the existing production backend container. No app imports.
// Only aggregate results leave the database. No notes, messages, names or emails.
const path = require('node:path');
const { PrismaClient } = require(path.resolve('../../packages/prisma/generated/prisma'));
const prisma = new PrismaClient({ log: [] });
const eligible = `u."deletedAt" IS NULL
  AND u.id !~* '^(benchmark|bench-|e2e|test-user|test_)'
  AND u.email !~* '(@example\\.(com|org|net)$|@[^@]*\\.test$)'`;
const base = `WITH eligible AS (SELECT u.* FROM users u WHERE ${eligible}),
  cohorts AS (
    SELECT 'new_90d' AS cohort, u.id FROM eligible u WHERE u."createdAt" >= now() - interval '90 days' AND u."createdAt" <= now()
    UNION ALL
    SELECT 'active_30d', u.id FROM eligible u WHERE (u."lastActiveAt" >= now() - interval '30 days' AND u."lastActiveAt" <= now())
      OR EXISTS (SELECT 1 FROM activity_entries e WHERE e."userId"=u.id AND e."deletedAt" IS NULL AND e.datetime >= now()-interval '30 days' AND e.datetime <= now())
    UNION ALL
    SELECT 'latest_50', u.id FROM (SELECT id FROM eligible ORDER BY "createdAt" DESC,id LIMIT 50) u
  )`;
const topic = `CASE
  WHEN lower(p.goal) ~ '(guitar|guitarra|songwrit|compos.*song|melod|piano|violin|saxophone|drum)' THEN 'music'
  WHEN lower(p.goal) ~ '(marathon|maratona|running|run |run$|corrid|correr|5k|10k|trail run)' THEN 'running'
  WHEN lower(p.goal) ~ '(read|reading|books?|livros?|leitura)' THEN 'reading'
  WHEN lower(p.goal) ~ '(language|italian|french|spanish|german|english|portuguese|japanese|korean|fluenc|idioma)' THEN 'languages'
  WHEN lower(p.goal) ~ '(meditat|mindful|breath|respira)' THEN 'meditation'
  WHEN lower(p.goal) ~ '(sleep|bedtime|dormir|sono)' THEN 'sleep'
  WHEN lower(p.goal) ~ '(diet|weight|nutrition|eat|calori|lose fat|perder peso|aliment)' THEN 'nutrition_or_weight'
  WHEN lower(p.goal) ~ '(gym|exercise|exercis|workout|train|fitness|strength|muscle|sport|trein|ginás|ginas|calisthen)' THEN 'exercise_or_strength'
  WHEN lower(p.goal) ~ '(chess|xadrez)' THEN 'chess'
  WHEN lower(p.goal) ~ '(study|learn|course|exam|study|estud|aprender|certif)' THEN 'study_or_learning'
  WHEN lower(p.goal) ~ '(writ|journal|escrev)' THEN 'writing_or_journaling'
  ELSE 'other_or_unclassified' END`;

const queries = {
  population: `SELECT now() AS "snapshotAt", current_setting('transaction_read_only') AS "readOnly", count(*)::int AS "allUsers", count(*) FILTER(WHERE ${eligible})::int AS "eligibleUsers", count(*) FILTER(WHERE u."deletedAt" IS NOT NULL)::int AS "deletedUsers", count(*) FILTER(WHERE u."deletedAt" IS NULL AND NOT (${eligible}))::int AS "excludedSyntheticUsers" FROM users u`,
  cohorts: `${base} SELECT c.cohort,count(*)::int AS users,count(*) FILTER(WHERE u."onboardingCompletedAt" IS NOT NULL)::int AS "onboardingCompleted", count(*) FILTER(WHERE EXISTS(SELECT 1 FROM plans p WHERE p."userId"=u.id AND p."deletedAt" IS NULL))::int AS "withPlans",count(*) FILTER(WHERE EXISTS(SELECT 1 FROM activity_entries e WHERE e."userId"=u.id AND e."deletedAt" IS NULL AND e.datetime>=now()-interval '30 days' AND e.datetime<=now()))::int AS "loggedIn30d" FROM cohorts c JOIN eligible u ON u.id=c.id GROUP BY c.cohort`,
  cohortDates: `${base} SELECT c.cohort,min(u."createdAt") AS "earliestSignup",max(u."createdAt") AS "latestSignup",count(*) FILTER(WHERE u."onboardingProgress" IS NOT NULL)::int AS "withOnboardingProgress" FROM cohorts c JOIN eligible u ON u.id=c.id GROUP BY c.cohort`,
  activities30d: `${base} SELECT c.cohort,lower(trim(a.title)) AS activity,a.kind,count(DISTINCT e."userId")::int AS users,count(*)::int AS logs FROM cohorts c JOIN activity_entries e ON e."userId"=c.id JOIN activities a ON a.id=e."activityId" WHERE e."deletedAt" IS NULL AND a."deletedAt" IS NULL AND e.datetime>=now()-interval '30 days' AND e.datetime<=now() GROUP BY c.cohort,lower(trim(a.title)),a.kind HAVING count(DISTINCT e."userId")>=2 ORDER BY c.cohort,users DESC,logs DESC LIMIT 50`,
  activities90d: `${base} SELECT c.cohort,lower(trim(a.title)) AS activity,a.kind,count(DISTINCT e."userId")::int AS users,count(*)::int AS logs FROM cohorts c JOIN activity_entries e ON e."userId"=c.id JOIN activities a ON a.id=e."activityId" WHERE e."deletedAt" IS NULL AND a."deletedAt" IS NULL AND e.datetime>=now()-interval '90 days' AND e.datetime<=now() GROUP BY c.cohort,lower(trim(a.title)),a.kind HAVING count(DISTINCT e."userId")>=2 ORDER BY c.cohort,users DESC,logs DESC LIMIT 50`,
  planTopics: `${base} SELECT c.cohort,${topic} AS topic,count(DISTINCT p."userId")::int AS users,count(*)::int AS plans FROM cohorts c JOIN plans p ON p."userId"=c.id WHERE p."deletedAt" IS NULL GROUP BY c.cohort,${topic} ORDER BY c.cohort,users DESC,plans DESC`,
  recentPlanTopics: `${base} SELECT ${topic} AS topic,count(DISTINCT p."userId")::int AS users,count(*)::int AS plans FROM plans p JOIN eligible u ON u.id=p."userId" WHERE p."deletedAt" IS NULL AND p."createdAt">=now()-interval '90 days' AND p."createdAt"<=now() GROUP BY ${topic} ORDER BY users DESC,plans DESC`,
  planCategories: `${base} SELECT c.cohort,coalesce(p.category,'(none)') AS category,count(DISTINCT p."userId")::int AS users,count(*)::int AS plans FROM cohorts c JOIN plans p ON p."userId"=c.id WHERE p."deletedAt" IS NULL GROUP BY c.cohort,p.category ORDER BY c.cohort,users DESC LIMIT 40`,
  planModes: `${base} SELECT c.cohort,p."outlineType"::text AS mode,count(DISTINCT p."userId")::int AS users,count(*)::int AS plans,count(*) FILTER(WHERE p."archivedAt" IS NULL AND NOT p."isPaused")::int AS "unarchivedUnpausedPlans" FROM cohorts c JOIN plans p ON p."userId"=c.id WHERE p."deletedAt" IS NULL GROUP BY c.cohort,p."outlineType" ORDER BY c.cohort,plans DESC`,
  planCounts: `${base}, counts AS (SELECT c.cohort,c.id,count(p.id) FILTER(WHERE p."archivedAt" IS NULL AND NOT p."isPaused")::int AS n FROM cohorts c LEFT JOIN plans p ON p."userId"=c.id AND p."deletedAt" IS NULL GROUP BY c.cohort,c.id) SELECT cohort,count(*) FILTER(WHERE n=0)::int AS "zeroCurrentPlans",count(*) FILTER(WHERE n=1)::int AS "oneCurrentPlan",count(*) FILTER(WHERE n>=2)::int AS "multipleCurrentPlans",max(n)::int AS "maxCurrentPlans" FROM counts GROUP BY cohort`,
};
(async()=>{
  try {
    const snapshot=await prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '12s'");
      const result={};
      for(const [name,query] of Object.entries(queries)) result[name]=await tx.$queryRawUnsafe(query);
      return result;
    },{timeout:120000,isolationLevel:'RepeatableRead'});
    console.log(JSON.stringify(snapshot,null,2));
  } catch(error) {
    console.error(JSON.stringify({error:'Snapshot failed',code:error.code||error.name,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted connection]').slice(0,450)}));process.exitCode=1;
  } finally {await prisma.$disconnect();}
})();
