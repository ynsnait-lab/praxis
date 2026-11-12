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

        func model(_ level: AlertLevel, _ phase: AlertViewModel.Phase = .prompt, pause: Int? = nil,
                   followUp: Bool = false, late: Bool = false) -> AlertViewModel {
            // pause : nombre de jours sans séance (reprise à partir de quatre)
            let last = pause.map { Calendar.current.date(byAdding: .day, value: -$0, to: .now) ?? .now } ?? lastSession
            let m = AlertViewModel(reminder: reminder, level: level, session: plan, streak: pause == nil ? 4 : 0,
                                   week: pause == nil ? week : [.missed, .missed, .missed, .today, .upcoming, .upcoming, .upcoming],
                                   sessionsThisWeek: pause == nil ? 3 : 0, weeklyGoal: 6, lastSession: last,
                                   daysSinceLast: pause ?? 1,
                                   snoozesLeft: level == .urgence ? 0 : 2, snoozeMinutes: 10,
                                   escalationWindow: 15 * 60, followUp: followUp, late: late)
            m.phase = phase
            if phase == .confirmSkip { m.skipReason = "Réunion tardive" }
            return m
        }

        let banner = CGSize(width: 470, height: 196)
        let screen = CGSize(width: 1512, height: 982)
        let cases: [(String, AlertViewModel, CGSize)] = [
            ("n1-signal", model(.signal), banner),
            ("n1-tard", model(.signal, late: true), banner),
            ("n1-relance", model(.signal, followUp: true), banner),
            ("n1-reprise", model(.signal, pause: 43), banner),
            ("n2-alerte", model(.alerte), screen),
            ("n2-reprise", model(.alerte, pause: 43), screen),
            ("n2-pas-aujourdhui", model(.alerte, .confirmSkip), screen),
            ("n3-urgence", model(.urgence), screen),
            ("lance", model(.alerte, .launched), screen),
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
