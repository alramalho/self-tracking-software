import Foundation
import Security

/// What the keychain answered for a saved token.
enum KeychainRead {
    case found(String)
    case missing
    /// The item exists but cannot be read yet, e.g. before the watch is first unlocked.
    case unavailable
}

/// Stores the watch's login tokens.
///
/// Items are readable after the first unlock, so a background launch while the
/// watch is off the wrist (and therefore locked) still finds the saved login.
struct TokenKeychain {
    let service: String

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "token",
        ]
    }

    func save(_ value: String) {
        guard let data = value.data(using: .utf8) else { return }
        delete()
        var item = baseQuery
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    func read() -> KeychainRead {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        switch SecItemCopyMatching(query as CFDictionary, &result) {
        case errSecSuccess:
            guard let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
                return .missing
            }
            return .found(value)
        case errSecItemNotFound:
            return .missing
        default:
            return .unavailable
        }
    }

    /// Older builds saved tokens readable only while the watch is unlocked.
    func relaxAccessibility() {
        let change = [kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        SecItemUpdate(baseQuery as CFDictionary, change as CFDictionary)
    }

    func delete() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}
