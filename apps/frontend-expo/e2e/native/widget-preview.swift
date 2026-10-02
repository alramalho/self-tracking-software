import SwiftUI
import WidgetKit

// This simulator-only host renders the exact production widget views. It uses
// explicitly illustrative fixture data and never ships inside the app.
@main
struct WidgetPreviewApp: App {
    private let date = ISO8601DateFormatter().date(from: "2026-09-30T12:00:00Z")!
    private var dark: Bool { ProcessInfo.processInfo.arguments.contains("dark") }
    var body: some Scene {
        WindowGroup {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("tracking.so").font(.system(size: 15, weight: .semibold)).foregroundStyle(.secondary)
                        Text("A little closer.").font(.system(size: 32, weight: .semibold, design: .rounded))
                        Text("Native widget previews · illustrative data").font(.system(size: 12)).foregroundStyle(.secondary)
                    }.padding(.top, 10)
                    HStack(spacing: 16) {
                        tile(width: 170) { PlanWidgetView(snapshot: .sample(at: date), planID: nil, date: date, family: .systemSmall) }
                        tile(width: 170) { NextWidgetView(snapshot: .sample(at: date), date: date, family: .systemSmall) }
                    }
                    tile(width: 356) { PlanWidgetView(snapshot: .sample(at: date), planID: nil, date: date, family: .systemMedium) }
                    tile(width: 356) { MetricsWidgetView(snapshot: .sample(at: date), date: date, family: .systemMedium) }
                    tile(width: 356) { NextWidgetView(snapshot: .sample(at: date), date: date, family: .systemMedium) }
                }.padding(20)
            }
            .background(dark ? Color(white: 0.11) : Color(white: 0.94))
            .preferredColorScheme(dark ? .dark : .light)
            .task { export() }
        }
    }
    private func tile<Content: View>(width: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content().padding(16).frame(width: width, height: 170)
            .background(WidgetPalette.background(dark ? .dark : .light))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
    @MainActor private func export() {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let snapshot = WidgetSnapshot.sample(at: date)
        for family in [WidgetFamily.systemSmall, .systemMedium] {
            let size = family == .systemSmall ? "small" : "medium"
            let width: CGFloat = family == .systemSmall ? 170 : 356
            render(tile(width: width) { PlanWidgetView(snapshot: snapshot, planID: nil, date: date, family: family) }, name: "plan-\(size)", directory: directory)
            render(tile(width: width) { NextWidgetView(snapshot: snapshot, date: date, family: family) }, name: "next-\(size)", directory: directory)
            render(tile(width: width) { MetricsWidgetView(snapshot: snapshot, date: date, family: family) }, name: "metrics-\(size)", directory: directory)
        }
        render(tile(width: 170) { PlanWidgetView(snapshot: nil, planID: nil, date: date, family: .systemSmall) }, name: "signed-out", directory: directory)
        render(tile(width: 170) { PlanWidgetView(snapshot: snapshot, planID: "deleted", date: date, family: .systemSmall) }, name: "missing-plan", directory: directory)
        render(tile(width: 170) { PlanWidgetView(snapshot: snapshot, planID: nil, date: date.addingTimeInterval(7 * 86400), family: .systemSmall) }, name: "stale", directory: directory)
    }
    @MainActor private func render<Content: View>(_ content: Content, name: String, directory: URL) {
        let renderer = ImageRenderer(content: content.environment(\.colorScheme, dark ? .dark : .light))
        renderer.scale = 3
        if let data = renderer.uiImage?.pngData() {
            try? data.write(to: directory.appendingPathComponent("\(name)-\(dark ? "dark" : "light").png"))
        }
    }
}
