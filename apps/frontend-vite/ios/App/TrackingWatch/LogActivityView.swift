import SwiftUI
import WatchKit

struct LogActivityView: View {
    let activity: Activity
    @Environment(\.dismiss) private var dismiss
    @State private var quantity: Double = 1
    @State private var isSubmitting = false
    @State private var showSuccess = false
    @State private var errorMessage: String?

    private var step: Double {
        let lower = activity.measure.lowercased()
        if lower.contains("hour") || lower.contains("km") || lower.contains("mile") {
            return 0.5
        }
        return 1
    }

    private var formattedQuantity: String {
        if quantity.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: "%.0f", quantity)
        }
        return String(format: "%.1f", quantity)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                Text("\(activity.emoji) \(activity.title)")
                    .font(.headline)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                VStack(spacing: 4) {
                    Text(formattedQuantity)
                        .font(.system(.largeTitle, design: .rounded))
                        .fontWeight(.bold)

                    Text(activity.measure)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                HStack(spacing: 20) {
                    Button(action: { if quantity > step { quantity -= step } }) {
                        Image(systemName: "minus.circle.fill")
                            .font(.title2)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(quantity > step ? .red : .gray)

                    Button(action: { quantity += step }) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title2)
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.green)
                }

                if showSuccess {
                    Label("Logged!", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.caption)
                } else if let error = errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                } else {
                    Button(action: { Task { await submit() } }) {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Log")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isSubmitting)
                }
            }
            .padding(.horizontal)
        }
    }

    private func submit() async {
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await APIService.shared.logActivity(activityId: activity.id, quantity: quantity)
            WKInterfaceDevice.current().play(.success)
            showSuccess = true
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            dismiss()
        } catch {
            WKInterfaceDevice.current().play(.failure)
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}
