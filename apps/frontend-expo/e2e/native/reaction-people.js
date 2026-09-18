var seed = http.post("http://127.0.0.1:4319/__timeline-design", { headers: { "Content-Type": "application/json" }, body: "{}" });
if (seed.status !== 200) throw new Error("Could not seed timeline");
var result = http.post("http://127.0.0.1:4319/__reaction-people", { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: KIND }) });
if (result.status !== 200) throw new Error("Could not seed reaction people");
