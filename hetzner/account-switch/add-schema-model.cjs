// Adds the AccountSwitchToken model to the schema already inside the production
// image, so the overlay never replaces that schema with a newer working copy.
const fs = require("fs");

const path = process.argv[2];
let schema = fs.readFileSync(path, "utf8");
if (schema.includes("model AccountSwitchToken")) process.exit(0);

const relation = /^(\s*)apiKeys(\s+)ApiKey\[\]\s*$/m;
if (!relation.test(schema)) throw new Error("User.apiKeys relation not found in schema");
schema = schema.replace(relation, (line, indent) => `${line}\n${indent}accountSwitchTokens AccountSwitchToken[]`);

schema += `
// Lets a device sign back into an account it remembers, without Clerk multi-session.
model AccountSwitchToken {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique
  createdAt  DateTime @default(now())
  lastUsedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("account_switch_tokens")
  @@schema("public")
}
`;
fs.writeFileSync(path, schema);
