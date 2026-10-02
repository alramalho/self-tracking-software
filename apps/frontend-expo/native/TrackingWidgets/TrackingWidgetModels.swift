import Foundation

struct WidgetPlan: Codable, Identifiable {
    let id: String
    let title: String
    let emoji: String
    let completed: Int
    let target: Int
    let streak: Int
    let stage: String
    let stageTarget: Int
    let paused: Bool
    let ended: Bool
    var url: URL { trackingLink("plans", query: [URLQueryItem(name: "selectedPlan", value: id)]) }
}

struct WidgetSession: Codable, Identifiable {
    let id: String
    let planId: String
    let title: String
    let emoji: String
    let date: String
    let time: String?
    let timezone: String
    let durationMinutes: Int
    var url: URL {
        // Legacy plan slots are not follow-through session records. Their plan
        // contains the available logging controls; a session URL would be dead.
        if id.hasPrefix("existing:") {
            return trackingLink("plans", query: [URLQueryItem(name: "selectedPlan", value: planId)])
        }
        return trackingLink("session/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/?#"))) ?? id)")
    }
    func label(at now: Date) -> String {
        let zone = TimeZone(identifier: timezone) ?? .current
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let day = WidgetSnapshot.day(now, zone: zone)
        let tomorrow = WidgetSnapshot.day(calendar.date(byAdding: .day, value: 1, to: now)!, zone: zone)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = zone
        let scheduled = formatter.date(from: date) ?? now
        formatter.dateFormat = "EEE, d MMM"
        let dateLabel = date == day ? "Today" : date == tomorrow ? "Tomorrow" : formatter.string(from: scheduled)
        guard let time else { return "\(dateLabel) · Any time" }
        let clock = DateFormatter()
        clock.dateFormat = "yyyy-MM-dd HH:mm"
        clock.timeZone = zone
        guard let start = clock.date(from: "\(date) \(time)") else { return dateLabel }
        clock.dateStyle = .none
        clock.timeStyle = .short
        clock.timeZone = .current
        // Timed sessions are displayed in the device's timezone, including their day.
        formatter.timeZone = .current
        let localDate = WidgetSnapshot.day(start)
        let localToday = WidgetSnapshot.day(now)
        let localTomorrow = WidgetSnapshot.day(Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let localLabel = localDate == localToday ? "Today" : localDate == localTomorrow ? "Tomorrow" : formatter.string(from: start)
        return "\(localLabel) · \(clock.string(from: start))"
    }
}

struct WidgetMetric: Codable, Identifiable {
    let id: String
    let title: String
    let emoji: String
    let loggedDays: [String]
}

struct WidgetSnapshot: Codable {
    let version: Int
    let updatedAt: String
    let weekStart: String
    let plans: [WidgetPlan]
    let sessions: [WidgetSession]
    let metrics: [WidgetMetric]
    static let empty = WidgetSnapshot(version: 1, updatedAt: "", weekStart: "", plans: [], sessions: [], metrics: [])
    static func read() -> WidgetSnapshot? {
        let defaults = UserDefaults(suiteName: "group.so.tracking.app")
        guard defaults?.string(forKey: "widgets.account") != nil,
              let string = defaults?.string(forKey: "widgets.snapshot"),
              let data = string.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(Self.self, from: data),
              snapshot.version == 1 else { return nil }
        return snapshot
    }
    static func day(_ date: Date, zone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = zone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    func isCurrentWeek(at now: Date) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 1
        return weekStart == Self.day(calendar.dateInterval(of: .weekOfYear, for: now)!.start)
    }
    func isStale(at now: Date) -> Bool {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let updated = formatter.date(from: updatedAt) else { return true }
        return now.timeIntervalSince(updated) > 86_400
    }
    func nextSession(at now: Date) -> WidgetSession? {
        sessions.first { $0.date >= Self.day(now, zone: TimeZone(identifier: $0.timezone) ?? .current) }
    }
    static func sample(at now: Date = .now) -> WidgetSnapshot {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 1
        let days = (0..<4).map { Self.day(calendar.date(byAdding: .day, value: -3 + $0, to: now)!) }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return WidgetSnapshot(version: 1, updatedAt: formatter.string(from: now),
            weekStart: Self.day(calendar.dateInterval(of: .weekOfYear, for: now)!.start),
            plans: [WidgetPlan(id: "sample", title: "Exercise regularly", emoji: "🏃", completed: 2, target: 3,
                streak: 4, stage: "Lifestyle", stageTarget: 9, paused: false, ended: false)],
            sessions: [WidgetSession(id: "sample", planId: "sample", title: "Read every day", emoji: "📖",
                date: Self.day(now), time: "18:30", timezone: TimeZone.current.identifier, durationMinutes: 20)],
            metrics: [WidgetMetric(id: "energy", title: "Energy", emoji: "⚡️", loggedDays: days),
                WidgetMetric(id: "mood", title: "Mood", emoji: "😊", loggedDays: Array(days.prefix(3))),
                WidgetMetric(id: "focus", title: "Focus", emoji: "🎯", loggedDays: [days[0], days[2]])])
    }
}

func trackingLink(_ path: String, query: [URLQueryItem] = []) -> URL {
    var components = URLComponents(string: "trackingso:///\(path)")!
    components.queryItems = query.isEmpty ? nil : query
    return components.url!
}
