import SwiftUI
import WatchKit

struct VoiceLogView: View {
    private enum Phase {
        case ready
        case recording
        case processing
        case review
        case committed
    }

    private enum RecordingKind: Equatable {
        case initial
        case refinement
    }

    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceLogRecorder()
    @State private var phase: Phase = .ready
    @State private var preview: VoiceLogPreview?
    @State private var selectedActivityIDs = Set<String>()
    @State private var selectedMetricIDs = Set<String>()
    @State private var selectedPlanID: String?
    @State private var errorMessage: String?
    @State private var clientRequestId = UUID().uuidString.lowercased()
    @State private var recordingKind: RecordingKind = .initial

    private var timezone: String { TimeZone.current.identifier }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                switch phase {
                case .ready:
                    readyContent
                case .recording:
                    recordingContent
                case .processing:
                    processingContent
                case .review:
                    reviewContent
                case .committed:
                    committedContent
                }

                if let errorMessage, phase != .review, phase != .committed {
                    Text(errorMessage)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .navigationTitle("Voice note")
        .toolbar {
            if phase == .review {
                ToolbarItemGroup(placement: .bottomBar) {
                    Button(action: beginRefinement) {
                        Image(systemName: "mic.fill")
                    }
                    .accessibilityLabel("Make changes")
                    Spacer()
                    Button(action: commit) {
                        Image(systemName: "checkmark")
                    }
                    .controlSize(.large)
                    .tint(.green)
                    .accessibilityLabel("Save voice note")
                }
            }
        }
        .task {
            // Like tapping the mic: start listening straight away.
            if phase == .ready, preview == nil { startRecording() }
        }
        .onDisappear {
            if recorder.isRecording { recorder.cancel() }
        }
    }

    private var readyContent: some View {
        VStack(spacing: 10) {
            Text(isRefinement ? "Make changes" : "Tap to talk")
                .font(.headline)
            roundButton(systemImage: "mic.fill", tint: .accentColor, action: startRecording)
                .accessibilityLabel(isRefinement ? "Record changes" : "Start recording")
        }
    }

    private var recordingContent: some View {
        VStack(spacing: 10) {
            Text(isRefinement ? "Say what to change…" : "Listening…")
                .font(.headline)
            Text(formattedDuration(recorder.elapsedSeconds))
                .font(.caption.monospacedDigit())
                .foregroundColor(.secondary)
            roundButton(systemImage: "stop.fill", tint: .red, action: stopRecording)
                .accessibilityLabel("Stop and send")
        }
    }

    private var processingContent: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(isRefinement ? "Updating…" : "Understanding…")
                .foregroundColor(.secondary)
        }
    }

    @ViewBuilder
    private var reviewContent: some View {
        if let preview {
            VStack(alignment: .leading, spacing: 12) {
                Text("I heard")
                    .font(.headline)
                Text(preview.transcript)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Log these")
                    .font(.headline)

                ForEach(preview.activities) { activity in
                    suggestionButton(
                        isSelected: selectedActivityIDs.contains(activity.id),
                        title: "\(activity.emoji) \(activity.title)",
                        detail: "\(activity.amountText) · \(activity.date)",
                        action: { toggleActivity(activity.id) }
                    )
                }

                if let example = preview.activities.first(where: { $0.estimatedFrom != nil })
                    ?? preview.activities.first {
                    Label {
                        Text(voiceFixHint(for: example))
                    } icon: {
                        Image(systemName: "mic.fill")
                    }
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                }

                ForEach(preview.metrics) { metric in
                    suggestionButton(
                        isSelected: selectedMetricIDs.contains(metric.id),
                        title: "\(metric.emoji) \(metric.title)",
                        detail: "Rating \(metric.rating)/5 · \(metric.date)",
                        action: { toggleMetric(metric.id) }
                    )
                }

                if let planMatch = preview.planMatches.first {
                    planContextSection(planMatch)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Label("Note", systemImage: "note.text")
                        .font(.subheadline.weight(.semibold))
                    Text(preview.note.text)
                        .font(.caption)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(8)
                .background(Color.secondary.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                if !preview.unresolved.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Couldn’t place")
                            .font(.subheadline.weight(.semibold))
                        ForEach(preview.unresolved) { item in
                            Text("• \(item.text)")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }

                Button("Start over", action: startOver)
                .font(.caption)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func voiceFixHint(for activity: VoiceLogActivity) -> String {
        let lead = activity.estimatedFrom == nil ? "Wrong amount?" : "≈ is an estimate."
        return "\(lead) Tap the mic and say \(activity.voiceFixExample)."
    }

    private var committedContent: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 46))
                .foregroundColor(.green)
            Text("Saved")
                .font(.headline)
            Button("Done") { dismiss() }
        }
    }

    private func roundButton(
        systemImage: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title2)
                .frame(width: 64, height: 64)
        }
        .buttonStyle(.borderedProminent)
        .clipShape(Circle())
        .tint(tint)
    }

    private func suggestionButton(
        isSelected: Bool,
        title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .lineLimit(2)
                    Text(detail)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private func planContextSection(_ planMatch: VoiceLogPlanMatch) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Coach context", systemImage: "scope")
                .font(.subheadline.weight(.semibold))

            Text("Where should this cue live?")
                .font(.caption2)
                .foregroundColor(.secondary)

            planContextOption(
                isSelected: selectedPlanID == planMatch.planId,
                title: "Save to \(planMatch.planGoal)",
                detail: "Strong match for \(planMatch.activityTitle)",
                icon: planMatch.planEmoji ?? "🧭",
                action: { selectedPlanID = planMatch.planId }
            )

            planContextOption(
                isSelected: selectedPlanID == nil,
                title: "Personal note",
                detail: "Keep it in your general coach context",
                systemImage: "lock.fill",
                action: { selectedPlanID = nil }
            )

            Text("\u{201C}\(planMatch.contextText)\u{201D}")
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(3)

            Text("Nothing changes in the plan until you save this note.")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(Color.accentColor.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func planContextOption(
        isSelected: Bool,
        title: String,
        detail: String,
        icon: String? = nil,
        systemImage: String? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .accentColor : .secondary)
                if let icon {
                    Text(icon)
                        .font(.caption)
                } else if let systemImage {
                    Image(systemName: systemImage)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .lineLimit(2)
                    Text(detail)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
        }
        .buttonStyle(.plain)
    }

    private func startRecording() {
        errorMessage = nil
        recorder.onMaximumDurationReached = { url in
            Task { @MainActor in
                await processRecording(url)
            }
        }
        Task {
            do {
                try await recorder.start()
                phase = .recording
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func beginRefinement() {
        guard preview != nil else { return }
        recordingKind = .refinement
        errorMessage = nil
        startRecording()
    }

    private func startOver() {
        preview = nil
        errorMessage = nil
        selectedPlanID = nil
        clientRequestId = UUID().uuidString.lowercased()
        recordingKind = .initial
        phase = .ready
    }

    private func stopRecording() {
        do {
            let url = try recorder.stop()
            Task { await processRecording(url) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func processRecording(_ url: URL) async {
        let isRefinement = recordingKind == .refinement
        let refinementContext = isRefinement ? makeRefinementContext() : nil
        phase = .processing
        errorMessage = nil
        defer { try? FileManager.default.removeItem(at: url) }
        do {
            let result = try await APIService.shared.previewVoiceLog(
                audioURL: url,
                timezone: timezone,
                clientRequestId: clientRequestId,
                refinementContext: refinementContext
            )
            preview = result
            selectedActivityIDs = Set(result.activities.map(\.id))
            selectedMetricIDs = Set(result.metrics.map(\.id))
            selectedPlanID = result.planMatches.first?.planId
            phase = .review
        } catch {
            phase = isRefinement ? .review : .ready
            errorMessage = error.localizedDescription
        }
    }

    private func makeRefinementContext() -> VoiceLogRefinementContext? {
        guard let preview else { return nil }
        let currentDraft = VoiceLogPreview(
            clientRequestId: preview.clientRequestId,
            transcript: preview.transcript,
            activities: preview.activities.filter { selectedActivityIDs.contains($0.id) },
            metrics: preview.metrics.filter { selectedMetricIDs.contains($0.id) },
            note: preview.note,
            unresolved: preview.unresolved,
            planMatches: []
        )
        return VoiceLogRefinementContext(
            originalTranscript: preview.transcript,
            currentDraft: currentDraft
        )
    }

    private func commit() {
        guard let preview else { return }
        phase = .processing
        errorMessage = nil
        let activities = preview.activities
            .filter { selectedActivityIDs.contains($0.id) }
            .map {
                VoiceLogCommitActivity(
                    activityId: $0.activityId,
                    quantity: $0.quantity,
                    date: $0.date,
                    time: $0.time,
                    description: $0.description,
                    privateNotes: $0.privateNotes,
                    difficulty: $0.difficulty,
                    estimatedFrom: $0.estimatedFrom
                )
            }
        let metrics = preview.metrics
            .filter { selectedMetricIDs.contains($0.id) }
            .map {
                VoiceLogCommitMetric(
                    metricId: $0.metricId,
                    rating: $0.rating,
                    date: $0.date,
                    description: $0.description
                )
            }
        let selectedPlanMatch = preview.planMatches.first { $0.planId == selectedPlanID }
        let payload = VoiceLogCommitRequest(
            clientRequestId: clientRequestId,
            transcript: preview.transcript,
            timezone: timezone,
            activities: activities,
            metrics: metrics,
            note: preview.note,
            planContextPlanId: selectedPlanMatch?.planId,
            planContextActivityId: selectedPlanMatch?.activityId,
            planContextText: selectedPlanMatch?.contextText
        )

        Task {
            do {
                _ = try await APIService.shared.commitVoiceLog(payload)
                WKInterfaceDevice.current().play(.success)
                phase = .committed
            } catch {
                WKInterfaceDevice.current().play(.failure)
                phase = .review
                errorMessage = error.localizedDescription
            }
        }
    }

    private func toggleActivity(_ id: String) {
        if selectedActivityIDs.contains(id) {
            selectedActivityIDs.remove(id)
        } else {
            selectedActivityIDs.insert(id)
        }
    }

    private func toggleMetric(_ id: String) {
        if selectedMetricIDs.contains(id) {
            selectedMetricIDs.remove(id)
        } else {
            selectedMetricIDs.insert(id)
        }
    }

    private func formattedDuration(_ seconds: TimeInterval) -> String {
        String(format: "%02d:%02d", Int(seconds) / 60, Int(seconds) % 60)
    }

    private var isRefinement: Bool {
        recordingKind == .refinement
    }
}
