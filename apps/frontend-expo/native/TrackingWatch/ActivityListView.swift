import SwiftUI

struct ActivityListView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var activities: [Activity] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink(destination: VoiceLogView()) {
                        Label("Log voice note", systemImage: "mic.fill")
                            .font(.headline)
                    }
                    .accessibilityLabel("Log voice note")
                }

                if isLoading {
                    Section {
                        ProgressView("Loading...")
                    }
                } else if let error = errorMessage {
                    Section {
                        VStack(spacing: 8) {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                            Button("Retry") { Task { await loadActivities() } }
                        }
                    }
                } else if activities.isEmpty {
                    Section {
                        Text("No activities yet.\nAdd some in the app!")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                } else {
                    Section("Activities") {
                        ForEach(activities) { activity in
                        NavigationLink(destination: LogActivityView(activity: activity)) {
                            HStack(spacing: 8) {
                                Text(activity.emoji)
                                    .font(.title3)
                                Text(activity.title)
                                    .font(.body)
                                    .lineLimit(1)
                            }
                        }
                        }
                    }
                }
            }
            .listStyle(.automatic)
            .navigationTitle("Activities")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { authManager.clearTokens() }) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.caption)
                    }
                }
            }
        }
        .task { await loadActivities() }
    }

    private func loadActivities() async {
        isLoading = true
        errorMessage = nil
        do {
            activities = try await APIService.shared.fetchActivities()
        } catch APIError.unauthorized {
            errorMessage = "Please sign in again"
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}
