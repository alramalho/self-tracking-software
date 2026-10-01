import { createGateway } from "ai";
async function main() {
  const gw = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
  const re = new RegExp(process.argv[2] || "sol|mimo|deepseek|luna", "i");
  for (const m of (await gw.getAvailableModels()).models.filter((m) => re.test(m.id)))
    console.log(m.id, "in $/M", Number(m.pricing?.input) * 1e6, "out $/M", Number(m.pricing?.output) * 1e6);
}
main();
