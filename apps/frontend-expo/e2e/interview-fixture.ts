import type { InterviewResult, InterviewState } from "@tsw/prisma/follow-through";
export function interviewFixture(state: InterviewState, answer: string): InterviewResult {
  const facts = { ...state.facts };
  const rejected = /asdf|ignore.*instructions|bullshit|be better|seven days/i.test(answer);
  const questions = {
    goal: { title: "Where are you starting with guitar?", purpose: "Your current practice will shape a first step you can actually use.", options: ["Complete beginner", "I know a few chords"] },
    baseline: { title: "What practice fits your week?", purpose: "Choose a weekly rhythm you can make room for.", options: [] },
    rhythm: { title: "Would guidance help with those chord changes?", purpose: "Coaching could help you narrow down practice. You can also follow your own routine and simply track it.", options: ["Help me shape a plan", "I know my plan — just tracking"] },
    support: { title: "Does this feel like your plan?", purpose: "Check what we’ve put together. Tell me if something needs changing.", options: [] },
    review: { title: "Ready to start?", purpose: "Choose coaching or free tracking.", options: [] },
  };
  if (!rejected) {
    if (state.stage === "goal") Object.assign(facts, { goal: "Write my own guitar songs", emoji: "🎸", goalReason: "Express myself through music" });
    if (state.stage === "baseline") facts.baseline = answer;
    if (state.stage === "rhythm") Object.assign(facts, { frequency: 3 });
    if (state.stage === "support") Object.assign(facts, { wantsCoaching: !answer.includes("just tracking"), recommendation: "coaching", recommendationReason: "You want help turning chord changes into songs.", activityTitle: "Guitar practice", measure: "minutes", nextStep: "Practise the chord change from your chosen exercise for 20 minutes." });
  }
  const question = rejected ? { title: state.stage === "rhythm" ? "Three sessions or seven — which fits?" : "What is one thing you actually want to practise?", purpose: "I need a concrete answer before building your plan.", options: [] } : questions[state.stage];
  return { accepted: !rejected, summary: rejected ? "That doesn’t give me a consistent, actionable answer yet. Let’s clarify it." : "We’ll build around your goal and the time you actually have.", checks: [{ label: rejected ? "Needs clarification" : "Concrete and consistent", passed: !rejected, detail: rejected ? "Please clarify your answer." : "This fits what you told me." }], facts, question, nextQuestion: question };
}
