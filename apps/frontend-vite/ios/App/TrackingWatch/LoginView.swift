import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var isSigningIn = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                Text("tracking.so")
                    .font(.headline)
                    .padding(.top, 8)

                SignInWithAppleButton(.signIn) { request in
                    request.requestedScopes = [.email, .fullName]
                } onCompletion: { result in
                    handleAppleSignIn(result)
                }
                .frame(height: 44)
                .signInWithAppleButtonStyle(.white)

                if isSigningIn {
                    ProgressView()
                }

                if let error = errorMessage {
                    Text(error)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                }

                Text("Or log in on your iPhone")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8) else {
                errorMessage = "Could not get Apple credentials"
                return
            }

            isSigningIn = true
            errorMessage = nil

            Task {
                let success = await authManager.handleAppleSignIn(identityToken: identityToken)
                isSigningIn = false
                if !success {
                    errorMessage = "Sign in failed. Try again."
                }
            }

        case .failure(let error):
            if (error as NSError).code == ASAuthorizationError.canceled.rawValue {
                return
            }
            errorMessage = "Apple Sign In failed"
        }
    }
}
