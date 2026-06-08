import Foundation

// In-memory TTL cache. Mirrors the web frontend's timed API cache pattern.
@MainActor
final class CacheStore {
    static let shared = CacheStore()
    private init() {}

    private struct Entry {
        let value: Any
        let expiresAt: Date
    }

    private var store: [String: Entry] = [:]

    func set<T>(_ value: T, forKey key: String, ttl: TimeInterval) {
        store[key] = Entry(value: value, expiresAt: Date().addingTimeInterval(ttl))
    }

    func get<T>(_ type: T.Type, forKey key: String) -> T? {
        guard let entry = store[key], entry.expiresAt > Date() else {
            store.removeValue(forKey: key)
            return nil
        }
        return entry.value as? T
    }

    func invalidate(_ key: String) {
        store.removeValue(forKey: key)
    }

    func invalidateAll() {
        store.removeAll()
    }

    func invalidatePrefix(_ prefix: String) {
        store = store.filter { !$0.key.hasPrefix(prefix) }
    }
}
