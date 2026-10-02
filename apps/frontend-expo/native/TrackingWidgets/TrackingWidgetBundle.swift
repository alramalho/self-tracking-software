import AppIntents
import SwiftUI
import WidgetKit

struct PlanEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Plan"
    static var defaultQuery = PlanQuery()
    var id: String
    var title: String
    var emoji: String
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(emoji) \(title)") }
}
struct PlanQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [PlanEntity] {
        try await suggestedEntities().filter { identifiers.contains($0.id) }
    }
    func suggestedEntities() async throws -> [PlanEntity] {
        WidgetSnapshot.read()?.plans.map { PlanEntity(id: $0.id, title: $0.title, emoji: $0.emoji) } ?? []
    }
    func defaultResult() async -> PlanEntity? { try? await suggestedEntities().first }
}
struct ChoosePlan: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Choose a plan"
    static var description = IntentDescription("Keep one of your plans close.")
    @Parameter(title: "Plan") var plan: PlanEntity?
}
struct TrackingEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
    var planID: String? = nil
}

// Daily entries roll dates forward even when the app stays closed. No credentials
// or network calls are required in the extension; iOS controls the refresh budget.
func widgetTimeline(snapshot: WidgetSnapshot?, planID: String? = nil, now: Date = .now) -> Timeline<TrackingEntry> {
    var entries = [TrackingEntry(date: now, snapshot: snapshot, planID: planID)]
    for offset in 1...7 {
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: offset, to: now)!)
        entries.append(TrackingEntry(date: midnight, snapshot: snapshot, planID: planID))
    }
    return Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800)))
}
struct SummaryProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrackingEntry { TrackingEntry(date: .now, snapshot: .sample()) }
    func getSnapshot(in context: Context, completion: @escaping (TrackingEntry) -> Void) {
        completion(TrackingEntry(date: .now, snapshot: context.isPreview ? .sample() : .read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<TrackingEntry>) -> Void) {
        completion(widgetTimeline(snapshot: .read()))
    }
}
struct PlanProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> TrackingEntry { TrackingEntry(date: .now, snapshot: .sample()) }
    func snapshot(for configuration: ChoosePlan, in context: Context) async -> TrackingEntry {
        TrackingEntry(date: .now, snapshot: context.isPreview ? .sample() : .read(), planID: configuration.plan?.id)
    }
    func timeline(for configuration: ChoosePlan, in context: Context) async -> Timeline<TrackingEntry> {
        widgetTimeline(snapshot: .read(), planID: configuration.plan?.id)
    }
}

struct PlanWidget: Widget {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "TrackingPlan", intent: ChoosePlan.self, provider: PlanProvider()) { entry in
            PlanWidgetContent(entry: entry)
        }
        .configurationDisplayName("Plan progress")
        .description("Your week and your streak. Touch and hold to choose a plan.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryInline])
    }
}
struct PlanWidgetContent: View {
    let entry: TrackingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        PlanWidgetView(snapshot: entry.snapshot, planID: entry.planID, date: entry.date, family: family)
            .containerBackground(for: .widget) { WidgetPalette.background(scheme) }
    }
}
struct NextWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TrackingNext", provider: SummaryProvider()) { entry in
            NextWidgetContent(entry: entry)
        }.configurationDisplayName("Up next")
            .description("Make a little room for your next session.")
            .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
struct NextWidgetContent: View {
    let entry: TrackingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        NextWidgetView(snapshot: entry.snapshot, date: entry.date, family: family)
            .containerBackground(for: .widget) { WidgetPalette.background(scheme) }
    }
}
struct MetricsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "TrackingMetrics", provider: SummaryProvider()) { entry in
            MetricsWidgetContent(entry: entry)
        }.configurationDisplayName("Daily check-in")
            .description("A small moment to notice how you feel.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}
struct MetricsWidgetContent: View {
    let entry: TrackingEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    var body: some View {
        MetricsWidgetView(snapshot: entry.snapshot, date: entry.date, family: family)
            .containerBackground(for: .widget) { WidgetPalette.background(scheme) }
    }
}

@main
struct TrackingWidgets: WidgetBundle {
    var body: some Widget {
        PlanWidget()
        NextWidget()
        MetricsWidget()
    }
}
