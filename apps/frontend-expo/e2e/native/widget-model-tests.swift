import Foundation

@main
struct WidgetModelTests {
    static func main() throws {
        NSTimeZone.default = TimeZone(identifier: "Europe/Lisbon")!
        let now = ISO8601DateFormatter().date(from: "2026-09-30T12:00:00Z")!
        let sample = WidgetSnapshot.sample(at: now)
        let decoded = try JSONDecoder().decode(WidgetSnapshot.self, from: JSONEncoder().encode(sample))
        precondition(decoded.plans.first?.completed == 2)
        precondition(!decoded.isStale(at: now))
        precondition(decoded.isStale(at: now.addingTimeInterval(86401)))
        precondition(decoded.isCurrentWeek(at: now))
        precondition(!decoded.isCurrentWeek(at: now.addingTimeInterval(7 * 86400)))
        precondition(decoded.nextSession(at: now) != nil)
        precondition(decoded.nextSession(at: now.addingTimeInterval(86400)) == nil)
        precondition(decoded.plans[0].url.absoluteString == "trackingso:///plans?selectedPlan=sample")
        let tricky = WidgetSession(id: "one/two?three", planId: "p", title: "Read", emoji: "📖",
            date: "2026-09-30", time: nil, timezone: "Europe/Lisbon", durationMinutes: 20)
        precondition(tricky.url.absoluteString.contains("one%2Ftwo%3Fthree"))
        precondition(tricky.label(at: now) == "Today · Any time")
        let legacy = WidgetSession(id: "existing:slot", planId: "reading", title: "Read", emoji: "📖",
            date: "2026-09-30", time: nil, timezone: "Europe/Lisbon", durationMinutes: 20)
        precondition(legacy.url.absoluteString == "trackingso:///plans?selectedPlan=reading")
        let western = WidgetSession(id: "west", planId: "p", title: "Read", emoji: "📖",
            date: "2026-09-29", time: nil, timezone: "America/Los_Angeles", durationMinutes: 20)
        let shortlyAfterMidnight = ISO8601DateFormatter().date(from: "2026-09-30T00:30:00Z")!
        let snapshot = WidgetSnapshot(version: 1, updatedAt: sample.updatedAt, weekStart: sample.weekStart,
            plans: [], sessions: [western], metrics: [])
        precondition(snapshot.nextSession(at: shortlyAfterMidnight)?.id == "west")
        precondition(western.label(at: shortlyAfterMidnight) == "Today · Any time")
        precondition(decoded.metrics.filter { $0.loggedDays.contains(WidgetSnapshot.day(now)) }.count == 1)
        precondition(decoded.metrics.filter { $0.loggedDays.contains(WidgetSnapshot.day(now.addingTimeInterval(86400))) }.isEmpty)
        print("Native model checks passed: JSON, freshness, week/day rollover, timezone, check-ins and deep links.")
    }
}
