import SwiftUI

@main
struct TrackingWatchApp: App {
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var connectivity = ConnectivityService.shared

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
    }
}
