import SwiftUI
import WidgetKit

enum WidgetPalette {
    static let green = Color(red: 0.13, green: 0.77, blue: 0.37)
    static let amber = Color(red: 1, green: 0.67, blue: 0.12)
    static let blue = Color(red: 0.23, green: 0.51, blue: 0.96)
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(white: 0.078) : Color(white: 0.98)
    }
    static func soft(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(white: 0.20) : Color(white: 0.90)
    }
}

struct ProgressDots: View {
    let value: Int
    let target: Int
    let color: Color
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        let count = min(9, max(0, target))
        HStack(spacing: count > 6 ? 2 : 4) {
            ForEach(0..<min(9, max(0, target)), id: \.self) { index in
                Circle().fill(index < value ? color : WidgetPalette.soft(scheme))
                    .frame(width: count > 6 ? 6 : count > 4 ? 8 : 12, height: count > 6 ? 6 : count > 4 ? 8 : 12).widgetAccentable(index < value)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(value) of \(target)")
    }
}

struct WidgetHeading: View {
    let title: String
    let symbol: String
    var body: some View {
        HStack {
            Text(title.uppercased()).font(.system(size: 10, weight: .semibold, design: .rounded)).tracking(1.4)
            Spacer(minLength: 2)
            Image(systemName: symbol).font(.system(size: 12, weight: .medium))
        }.foregroundStyle(.secondary)
    }
}

struct WidgetFootnote: View {
    let stale: Bool
    let action: String
    var body: some View {
        HStack(spacing: 4) {
            Text(stale ? "Open to refresh" : action).lineLimit(1).minimumScaleFactor(0.85)
            Spacer(minLength: 2)
            Image(systemName: "arrow.up.right").font(.system(size: 10, weight: .semibold))
        }.font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
    }
}

struct WidgetEmptyView: View {
    let symbol: String
    let title: String
    let message: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol).font(.system(size: 25, weight: .light)).foregroundStyle(WidgetPalette.blue).widgetAccentable()
            Spacer(minLength: 0)
            Text(title).font(.system(size: 19, weight: .semibold, design: .rounded)).lineLimit(2).minimumScaleFactor(0.8)
            Text(message).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(2)
        }.frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

struct PlanWidgetView: View {
    let snapshot: WidgetSnapshot?
    let planID: String?
    let date: Date
    let family: WidgetFamily
    private var plan: WidgetPlan? {
        if let planID { return snapshot?.plans.first { $0.id == planID } }
        return snapshot?.plans.first
    }
    var destination: URL { plan?.url ?? trackingLink("plans") }
    private var current: Bool { snapshot?.isCurrentWeek(at: date) == true }
    private var stale: Bool { snapshot?.isStale(at: date) != false }
    var body: some View {
        Group {
            if family == .accessoryInline {
                Text(plan.map { "\($0.emoji) \(current ? "\($0.completed)/\($0.target) this week" : "Open to refresh")" } ?? "tracking.so · Open your plans")
            } else if family == .accessoryCircular {
                Gauge(value: current ? Double(min(plan?.completed ?? 0, max(1, plan?.target ?? 1))) : 0, in: 0...Double(max(1, plan?.target ?? 1))) {
                    Image(systemName: "flame")
                } currentValueLabel: {
                    Text(current && plan != nil ? "\(plan!.completed)" : "–")
                }.gaugeStyle(.accessoryCircular).tint(WidgetPalette.green)
            } else if let plan {
                VStack(alignment: .leading, spacing: 6) {
                    WidgetHeading(title: "This week", symbol: "flame")
                    HStack(alignment: .center, spacing: 8) {
                            Text(plan.emoji).font(.system(size: 26))
                            Text(plan.title).font(.system(size: family == .systemSmall ? 16 : 20, weight: .semibold, design: .rounded))
                                .lineLimit(2).minimumScaleFactor(0.8)
                    }
                    Spacer(minLength: 0)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        Text(current ? "\(plan.completed)" : "–").font(.system(size: family == .systemSmall ? 27 : 34, weight: .semibold, design: .rounded)).monospacedDigit()
                        Text("/ \(plan.target)").font(.system(size: 14, weight: .medium)).foregroundStyle(.secondary)
                        Spacer(minLength: 4)
                        ProgressDots(value: current ? plan.completed : 0, target: plan.target, color: WidgetPalette.green)
                            .frame(maxWidth: family == .systemSmall ? 74 : 130, alignment: .trailing)
                            .minimumScaleFactor(0.65)
                    }
                    WidgetFootnote(stale: stale || !current, action: plan.paused ? "Plan paused" : plan.ended ? "Past end date" : family == .systemSmall ? "\(plan.streak) week streak" : "\(plan.streak) week streak · \(plan.stage == "Lifestyle" ? (plan.streak >= plan.stageTarget ? "Lifestyle formed" : "Habit formed") : "Building a habit")")
                }
            } else {
                WidgetEmptyView(symbol: "leaf", title: snapshot == nil ? "Your week, here." : "Choose a plan",
                    message: snapshot == nil ? "Open tracking.so to get started." : "Open the app, then edit this widget.")
            }
        }.widgetURL(destination).privacySensitive()
    }
}

struct NextWidgetView: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    let family: WidgetFamily
    private var session: WidgetSession? { snapshot?.nextSession(at: date) }
    var destination: URL { session?.url ?? trackingLink("plans", query: [URLQueryItem(name: "view", value: "week")]) }
    var body: some View {
        Group {
            if family == .accessoryRectangular {
                VStack(alignment: .leading, spacing: 2) {
                    Label("Up next", systemImage: "calendar").font(.headline)
                    Text(session.map { "\($0.emoji) \($0.title)" } ?? "Open your week").font(.subheadline).lineLimit(1)
                    if let session { Text(session.label(at: date)).font(.caption).foregroundStyle(.secondary) }
                }
            } else if let session {
                VStack(alignment: .leading, spacing: 9) {
                    WidgetHeading(title: "Up next", symbol: "calendar")
                    Spacer(minLength: 0)
                    HStack(alignment: .center, spacing: 14) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(spacing: 8) {
                                Text(session.emoji).font(.system(size: 27))
                                Text(session.title).font(.system(size: family == .systemSmall ? 18 : 22, weight: .semibold, design: .rounded))
                                    .lineLimit(2).minimumScaleFactor(0.8)
                            }
                            Text(session.label(at: date)).font(.system(size: 12, weight: .medium)).foregroundStyle(WidgetPalette.blue).widgetAccentable()
                        }
                        if family == .systemMedium {
                            Spacer(minLength: 0)
                            VStack(spacing: 3) {
                                Text("\(session.durationMinutes)").font(.system(size: 37, weight: .light, design: .rounded))
                                Text("MINUTES").font(.system(size: 9, weight: .semibold)).tracking(1.4).foregroundStyle(.secondary)
                            }.padding(.trailing, 8)
                        }
                    }
                    Spacer(minLength: 0)
                    WidgetFootnote(stale: snapshot?.isStale(at: date) != false, action: session.id.hasPrefix("existing:") ? "View your plan" : "View session")
                }
            } else {
                WidgetEmptyView(symbol: "calendar", title: snapshot == nil ? "Make room for you." : "A little room to choose.",
                    message: snapshot == nil ? "Open tracking.so to get started." : "Open your week to plan a session.")
            }
        }.widgetURL(destination).privacySensitive()
    }
}

struct MetricsWidgetView: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    let family: WidgetFamily
    @Environment(\.colorScheme) private var scheme
    private var metrics: [WidgetMetric] { snapshot?.metrics ?? [] }
    private var today: String { WidgetSnapshot.day(date) }
    private var done: Int { metrics.filter { $0.loggedDays.contains(today) }.count }
    private var days: [Date] { (0..<4).map { Calendar.current.date(byAdding: .day, value: -3 + $0, to: date)! } }
    var destination: URL { trackingLink("metrics", query: [URLQueryItem(name: "checkin", value: "1")]) }
    var body: some View {
        Group {
            if metrics.isEmpty {
                WidgetEmptyView(symbol: "heart", title: "How are you today?", message: snapshot == nil ? "Open tracking.so to get started." : "Choose your metrics in the app.")
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    WidgetHeading(title: "Daily check-in", symbol: "heart")
                    if family == .systemSmall {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text("\(done)").font(.system(size: 32, weight: .semibold, design: .rounded))
                            Text("/ \(metrics.count) today").font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                        ForEach(Array(metrics.prefix(2))) { metric in
                            HStack(spacing: 9) {
                                Text(metric.emoji).font(.system(size: 17))
                                ForEach(days, id: \.self) { day in
                                    Circle().fill(metric.loggedDays.contains(WidgetSnapshot.day(day)) ? WidgetPalette.green : WidgetPalette.soft(scheme))
                                        .frame(width: 12, height: 12).widgetAccentable(metric.loggedDays.contains(WidgetSnapshot.day(day)))
                                }
                            }.accessibilityLabel("\(metric.title), \(metric.loggedDays.contains(today) ? "logged today" : "not logged today")")
                        }
                    } else {
                        HStack(alignment: .top, spacing: 18) {
                            VStack(alignment: .leading, spacing: 5) {
                                Text("A moment\nfor yourself.").font(.system(size: 20, weight: .semibold, design: .rounded)).fixedSize(horizontal: false, vertical: true)
                                Text("\(done) of \(metrics.count) today").font(.system(size: 11)).foregroundStyle(.secondary)
                            }.frame(maxWidth: .infinity, alignment: .leading)
                            VStack(spacing: 4) {
                                HStack(spacing: 9) {
                                    Color.clear.frame(width: 19, height: 10)
                                    ForEach(days, id: \.self) { day in
                                        Text(day, format: .dateTime.weekday(.narrow)).font(.system(size: 9, weight: WidgetSnapshot.day(day) == today ? .bold : .regular))
                                            .foregroundStyle(.secondary).frame(width: 13)
                                    }
                                }
                                ForEach(Array(metrics.prefix(4))) { metric in
                                    HStack(spacing: 9) {
                                        Text(metric.emoji).font(.system(size: 16)).frame(width: 19)
                                        ForEach(days, id: \.self) { day in
                                            Circle().fill(metric.loggedDays.contains(WidgetSnapshot.day(day)) ? WidgetPalette.green : WidgetPalette.soft(scheme))
                                                .frame(width: 13, height: 13).widgetAccentable(metric.loggedDays.contains(WidgetSnapshot.day(day)))
                                        }
                                    }.accessibilityLabel("\(metric.title), \(metric.loggedDays.contains(today) ? "logged today" : "not logged today")")
                                }
                            }
                        }
                    }
                    Spacer(minLength: 0)
                    WidgetFootnote(stale: snapshot?.isStale(at: date) != false, action: done == metrics.count ? "Check-in complete" : "Log how you feel")
                }
            }
        }.widgetURL(destination).privacySensitive()
    }
}
