var result = http.post("http://127.0.0.1:4319/__profile-design", { headers: { "Content-Type": "application/json" }, body: "{}" });
if (result.status !== 200) throw new Error("Could not seed profile design");
