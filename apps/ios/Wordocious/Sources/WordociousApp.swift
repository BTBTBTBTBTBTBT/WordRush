import SwiftUI

@main
struct WordociousApp: App {
    @StateObject private var auth = AuthService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
                .task {
                    await auth.bootstrap()
                    StoreManager.shared.start()
                }
        }
    }
}
