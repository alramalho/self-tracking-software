ARG BASE_IMAGE=local/tracking-so-backend:circle-momentum-20261001
FROM ${BASE_IMAGE}
# Dictation languages and feedback, Whisper instead of Parakeet, and the streak rule in one place.
COPY apps/backend-node/src/routes/ai.ts /app/apps/backend-node/src/routes/ai.ts
COPY apps/backend-node/src/routes/users.ts /app/apps/backend-node/src/routes/users.ts
COPY apps/backend-node/src/services/aiService.ts /app/apps/backend-node/src/services/aiService.ts
COPY apps/backend-node/src/services/coach/agent.ts /app/apps/backend-node/src/services/coach/agent.ts
COPY apps/backend-node/src/services/plansService.ts /app/apps/backend-node/src/services/plansService.ts
COPY apps/backend-node/src/services/stt/config.ts /app/apps/backend-node/src/services/stt/config.ts
COPY apps/backend-node/src/services/stt/feedback.ts /app/apps/backend-node/src/services/stt/feedback.ts
COPY apps/backend-node/src/services/stt/languages.ts /app/apps/backend-node/src/services/stt/languages.ts
COPY apps/backend-node/src/services/stt/types.ts /app/apps/backend-node/src/services/stt/types.ts
COPY apps/backend-node/src/services/sttService.ts /app/apps/backend-node/src/services/sttService.ts
COPY apps/backend-node/src/services/voice-log/service.ts /app/apps/backend-node/src/services/voice-log/service.ts
COPY apps/backend-node/src/utils/userSelfUpdate.ts /app/apps/backend-node/src/utils/userSelfUpdate.ts
COPY packages/prisma/follow-through/streak.ts /app/packages/prisma/follow-through/streak.ts
COPY packages/prisma/types/index.ts /app/packages/prisma/types/index.ts
COPY packages/prisma/migrations/20261002120000_spoken_languages/migration.sql /app/packages/prisma/migrations/20261002120000_spoken_languages/migration.sql
# The image's own schema and package.json are patched in place rather than replaced, so nothing
# else that is live but not in this source can be lost.
RUN node -e "\
const fs=require('fs');\
const s='/app/packages/prisma/schema.prisma';let t=fs.readFileSync(s,'utf8');\
if(!t.includes('spokenLanguages')){\
  const a='  aiConsentDeclinedAt DateTime?\n';if(!t.includes(a))throw new Error('schema anchor: aiConsentDeclinedAt');\
  t=t.replace(a,a+'\n  // Languages the person speaks (ISO 639-1 codes, main one first). Speech to text listens for these.\n  spokenLanguages String[] @default([])\n');\
  const b='  TESTIMONIAL\n';if(!t.includes(b))throw new Error('schema anchor: TESTIMONIAL');\
  t=t.replace(b,b+'  TRANSCRIPTION_FEEDBACK\n');fs.writeFileSync(s,t);}\
const p='/app/packages/prisma/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));\
j.exports['./follow-through/streak']='./follow-through/streak.ts';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');"
RUN pnpm --dir /app/packages/prisma exec prisma generate
LABEL tracking.feature="voice-languages-20261002"
