import SwiftUI

@main
struct TrackingWatchApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var connectivity = ConnectivityService.shared
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            if authManager.isAuthenticated {
                ActivityListView()
                    .id(authManager.accountID)
                    .environmentObject(authManager)
            } else {
                LoginView()
                    .environmentObject(authManager)
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // A launch while the watch was locked could not read the saved login yet.
            if phase == .active { authManager.loadTokens() }
        }
    }
}
