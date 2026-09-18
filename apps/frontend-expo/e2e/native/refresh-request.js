var state = json(http.get("http://127.0.0.1:4319/__state").body);
var count = state.requests.filter((request) => request.path === "/users/timeline").length;
if (output.refreshBefore === undefined) {
  output.refreshBefore = count;
} else if (count <= output.refreshBefore) {
  throw new Error("The native pull-to-refresh gesture did not refetch the timeline.");
}
