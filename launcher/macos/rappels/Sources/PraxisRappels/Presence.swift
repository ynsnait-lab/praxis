import AppKit
import CoreGraphics

/// Sait si quelqu'un est devant l'écran : Mac réveillé, écran allumé, session ouverte et déverrouillée.
///
/// Sans cela, les « réveils sombres » de la nuit (Power Nap, maintenance : le Mac se réveille quelques secondes,
/// écran éteint) suffisaient à déclencher une alerte et à la faire monter de niveau pendant que le capot était fermé.
/// On la trouvait déjà au niveau 3 en ouvrant le Mac.
@MainActor
final class Presence {
    private var systemAsleep = false
    private var screensAsleep = false
    private var locked = Presence.sessionLocked()
    private var sessionInactive = false
    private var observers: [NSObjectProtocol] = []
    private var last = false

    /// Appelé quand on passe de présent à absent ou l'inverse.
    var onChange: (Bool) -> Void = { _ in }

    var isPresent: Bool {
        !systemAsleep && !screensAsleep && !locked && !sessionInactive && CGDisplayIsAsleep(CGMainDisplayID()) == 0
    }

    var reason: String {
        if systemAsleep { return "Mac en veille" }
        if screensAsleep || CGDisplayIsAsleep(CGMainDisplayID()) != 0 { return "écran éteint" }
        if locked { return "session verrouillée" }
        if sessionInactive { return "autre session active" }
        return "présent"
    }

    func start() {
        last = isPresent
        let workspace = NSWorkspace.shared.notificationCenter
        watch(workspace, NSWorkspace.willSleepNotification) { $0.systemAsleep = true }
        watch(workspace, NSWorkspace.didWakeNotification) { $0.systemAsleep = false }
        watch(workspace, NSWorkspace.screensDidSleepNotification) { $0.screensAsleep = true }
        watch(workspace, NSWorkspace.screensDidWakeNotification) { $0.screensAsleep = false }
        watch(workspace, NSWorkspace.sessionDidResignActiveNotification) { $0.sessionInactive = true }
        watch(workspace, NSWorkspace.sessionDidBecomeActiveNotification) { $0.sessionInactive = false }
        let distributed = DistributedNotificationCenter.default()
        watch(distributed, Notification.Name("com.apple.screenIsLocked")) { $0.locked = true }
        watch(distributed, Notification.Name("com.apple.screenIsUnlocked")) { $0.locked = false }
    }

    private func watch(_ center: NotificationCenter, _ name: Notification.Name, _ apply: @escaping @MainActor (Presence) -> Void) {
        observers.append(center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                apply(self)
                let now = self.isPresent
                Journal.note("système : \(name.rawValue) → \(self.reason)")
                if now != self.last {
                    self.last = now
                    self.onChange(now)
                }
            }
        })
    }

    /// État du verrouillage au lancement (ensuite, les notifications le tiennent à jour).
    static func sessionLocked() -> Bool {
        guard let session = CGSessionCopyCurrentDictionary() as? [String: Any] else { return false }
        return (session["CGSSessionScreenIsLocked"] as? Bool) ?? false
    }
}

/// Journal des rappels : ~/Library/Logs/Praxis/rappels.log (lisible aussi dans l'app Console).
/// Sert à comprendre après coup ce qui s'est passé : déclenchements, escalades, reports, absences.
enum Journal {
    static let url: URL = {
        let folder = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/Praxis")
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("rappels.log")
    }()

    static func note(_ text: String) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let line = formatter.string(from: Date()) + "  " + text + "\n"
        guard let data = line.data(using: .utf8) else { return }
        if let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attributes[.size] as? Int, size > 300_000,
           let old = try? Data(contentsOf: url) {
            try? old.suffix(150_000).write(to: url)          // on garde la fin
        }
        if let handle = try? FileHandle(forWritingTo: url) {
            handle.seekToEndOfFile()
            handle.write(data)
            try? handle.close()
        } else {
            try? data.write(to: url)
        }
    }
}
