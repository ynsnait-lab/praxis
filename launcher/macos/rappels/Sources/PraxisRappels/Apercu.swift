import AppKit
import SwiftUI

/// --apercu <dossier> : dessine chaque alerte en PNG, sans rien afficher à l'écran.
/// Sert à vérifier le rendu (et à le comparer à maquette.html) sans interrompre ce qu'on fait sur le Mac.
@MainActor
enum Apercu {
    static func render(into folder: URL) {
        renderingSnapshot = true
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let reminder = Reminder(hour: 18, minute: 30, weekdays: [2, 3, 4, 5, 6], label: "Séance principale", startLevel: .alerte)
        let plan = PraxisBridge.plan()
        let week: [DayState] = [.done, .done, .missed, .done, .today, .upcoming, .upcoming]
        let lastSession = Calendar.current.date(byAdding: .hour, value: -27, to: .now)

        func model(_ level: AlertLevel, _ phase: AlertViewModel.Phase = .prompt) -> AlertViewModel {
            let m = AlertViewModel(reminder: reminder, level: level, session: plan, streak: 4, week: week,
                                   sessionsThisWeek: 3, weeklyGoal: 6, lastSession: lastSession,
                                   snoozesLeft: level == .urgence ? 0 : 2, snoozeMinutes: 10,
                                   escalationWindow: 15 * 60)
            m.phase = phase
            if phase == .confirmSkip { m.skipReason = "Réunion tardive" }
            return m
        }

        let cases: [(String, AlertViewModel, CGSize)] = [
            ("n1-signal", model(.signal), CGSize(width: 420, height: 180)),
            ("n2-alerte", model(.alerte), CGSize(width: 1512, height: 982)),
            ("n2-pas-aujourdhui", model(.alerte, .confirmSkip), CGSize(width: 1512, height: 982)),
            ("n3-urgence", model(.urgence), CGSize(width: 1512, height: 982)),
            ("lance", model(.alerte, .launched), CGSize(width: 1512, height: 982)),
        ]
        for (name, m, size) in cases {
            let view = AlertRootView(model: m).frame(width: size.width, height: size.height)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else {
                print("✗ \(name) : rendu impossible")
                continue
            }
            let url = folder.appendingPathComponent("\(name).png")
            try? png.write(to: url)
            print("✓ \(url.path)")
        }
    }
}
