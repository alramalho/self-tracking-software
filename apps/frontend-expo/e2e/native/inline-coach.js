var response = http.post("http://127.0.0.1:4319/__inline-coach", {headers: {"Content-Type": "application/json"}, body: "{}"});
if (response.status !== 200) throw new Error("Could not seed inline coach");
