import AppKit
import Foundation

/// Ce que Praxis.app écrit à chaque changement dans ~/Library/Application Support/Praxis/next_session.json :
/// la séance du jour et les journées pratiquées (voir app/src/mac.js et launcher/macos/Praxis.swift).
struct PraxisPlan: Codable, Equatable {
    var title: String
    var subtitle: String
    var minutes: Int
    var jours: [String]?
    var serie: Int?
    var maj: String?

    static let fallback = PraxisPlan(title: "Séance Praxis", subtitle: "Ouvre Praxis pour voir le programme du jour", minutes: 20)
}

/// Tout ce qui touche à l'app Praxis elle-même.
@MainActor
enum PraxisBridge {
    nonisolated static let defaultBundleID = "io.github.ynsnait-lab.praxis"
    /// Praxis.app ouvre directement la séance du jour à cette adresse.
    static let sessionURL = URL(string: "praxis://seance")!

    // MARK: Lancer Praxis sur la séance du jour

    static func launch(bundleID: String) {
        let workspace = NSWorkspace.shared
        let config = NSWorkspace.OpenConfiguration()
        config.activates = true
        if workspace.urlForApplication(toOpen: sessionURL) != nil {
            workspace.open(sessionURL, configuration: config) { _, error in
                if let error { NSLog("Praxis Rappels : praxis://seance n'a pas abouti (\(error.localizedDescription))") }
            }
            return
        }
        // Un Praxis.app plus ancien, sans l'adresse praxis:// : on ouvre simplement l'app.
        let url = workspace.urlForApplication(withBundleIdentifier: bundleID)
            ?? URL(fileURLWithPath: "/Applications/Praxis.app")
        workspace.openApplication(at: url, configuration: config) { _, error in
            if let error { NSLog("Praxis Rappels : impossible d'ouvrir Praxis (\(error.localizedDescription))") }
        }
    }

    static func isInstalled(bundleID: String) -> Bool {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) != nil
    }

    // MARK: Séance du jour

    static var planURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Praxis/next_session.json")
    }

    static func plan() -> PraxisPlan {
        guard let data = try? Data(contentsOf: planURL),
              let plan = try? JSONDecoder().decode(PraxisPlan.self, from: data) else { return .fallback }
        return plan
    }

    static func planModificationDate() -> Date? {
        (try? FileManager.default.attributesOfItem(atPath: planURL.path))?[.modificationDate] as? Date
    }

    // MARK: Fin de séance

    /// Notification distribuée postée par Praxis.app quand une séance arrive au bilan.
    static let sessionCompleted = Notification.Name("io.github.ynsnait-lab.praxis.seanceTerminee")

    static func observeSessionCompleted(_ handler: @escaping @MainActor () -> Void) -> NSObjectProtocol {
        DistributedNotificationCenter.default().addObserver(
            forName: sessionCompleted, object: nil, queue: .main
        ) { _ in
            MainActor.assumeIsolated { handler() }
        }
    }
}
