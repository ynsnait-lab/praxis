import Foundation

/// Les règles de décision, sans horloge ni écran : faciles à relire et à vérifier (`--verifier`).
enum Regles {
    /// À partir de quatre jours sans séance, l'alerte propose une reprise courte plutôt que la séance complète.
    static let repriseDays = 4

    /// Clé d'un déclenchement : un rappel ne joue qu'une fois par jour.
    static func key(_ reminder: Reminder, _ fire: Date, calendar: Calendar = .current) -> String {
        "\(reminder.id.uuidString)@\(dayStamp(fire, calendar: calendar))"
    }

    static func dayStamp(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    /// Les rappels dus à `now` : actifs, dont l'heure est passée depuis moins de `window`, et pas encore joués aujourd'hui.
    static func due(_ reminders: [Reminder], now: Date, fired: Set<String>, window: TimeInterval,
                    calendar: Calendar = .current) -> [(reminder: Reminder, fire: Date)] {
        reminders.compactMap { reminder in
            guard reminder.isEnabled, let fire = reminder.fireDate(on: now, calendar: calendar),
                  now >= fire, now.timeIntervalSince(fire) < window,
                  !fired.contains(key(reminder, fire, calendar: calendar)) else { return nil }
            return (reminder, fire)
        }
    }

    /// Vrai tard le soir et la nuit : de `calmAfter` (minutes depuis minuit) jusqu'à 5 h. Jamais si `calmAfter` vaut 0.
    static func isCalm(_ now: Date, calmAfter: Int, calendar: Calendar = .current) -> Bool {
        guard calmAfter > 0 else { return false }
        let c = calendar.dateComponents([.hour, .minute], from: now)
        let minutes = (c.hour ?? 0) * 60 + (c.minute ?? 0)
        return minutes >= calmAfter || minutes < 5 * 60
    }

    /// Niveau auquel un rappel s'affiche : son niveau de départ, ou une bannière s'il est tard.
    static func startLevel(_ reminder: Reminder, calm: Bool) -> AlertLevel {
        calm ? .signal : reminder.startLevel
    }

    /// Niveau qu'une alerte en cours ne peut pas dépasser maintenant : le plafond du rappel, ou son niveau actuel s'il est tard.
    static func ceiling(_ reminder: Reminder, current: AlertLevel, calm: Bool) -> AlertLevel {
        calm ? current : max(reminder.ceiling, current)
    }

    /// Niveau au retour d'un report : au moins N2 (un report ne ramène pas à la bannière), sauf rappel plafonné ou heure tardive.
    static func levelAfterSnooze(_ reminder: Reminder, current: AlertLevel, calm: Bool) -> AlertLevel {
        calm ? .signal : min(max(current, .alerte), max(reminder.ceiling, current))
    }

    /// Reprise : la dernière séance connue date d'au moins `repriseDays` jours.
    static func reprise(daysSinceLast: Int?) -> Bool {
        (daysSinceLast ?? 0) >= repriseDays
    }
}

// MARK: - Vérification (--verifier)

/// `PraxisRappels --verifier` : rejoue les règles sur des cas datés et affiche le résultat. Aucune fenêtre, rien n'est enregistré.
enum Verification {
    static func run() -> Bool {
        var failures = 0
        func check(_ name: String, _ ok: Bool) {
            print(ok ? "✓ \(name)" : "✗ \(name)")
            if !ok { failures += 1 }
        }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "Europe/Paris") ?? .current
        func at(_ y: Int, _ mo: Int, _ d: Int, _ h: Int, _ mi: Int) -> Date {
            cal.date(from: DateComponents(year: y, month: mo, day: d, hour: h, minute: mi)) ?? .distantPast
        }
        let window: TimeInterval = 3 * 60 * 60
        let soir = Reminder(hour: 20, minute: 30, weekdays: [2, 3, 4, 5, 6], label: "Soir", startLevel: .alerte)
        let samedi = Reminder(hour: 15, minute: 0, weekdays: [7], label: "Samedi", startLevel: .alerte)
        let matin = Reminder(hour: 7, minute: 45, weekdays: [2, 3, 4, 5, 6], label: "Matin", startLevel: .signal, maxLevel: .signal)
        var eteint = soir
        eteint.id = UUID()
        eteint.isEnabled = false
        let tous = [soir, samedi, matin, eteint]
        func labels(_ now: Date, fired: Set<String> = []) -> [String] {
            Regles.due(tous, now: now, fired: fired, window: window, calendar: cal).map(\.reminder.label).sorted()
        }

        // jeudi 12 novembre 2026
        check("avant l'heure : rien", labels(at(2026, 11, 12, 20, 29)) == [])
        check("à l'heure : le rappel du soir, pas celui qui est éteint", labels(at(2026, 11, 12, 20, 30)) == ["Soir"])
        check("le rappel du matin, vieux de plus de 3 h, n'est pas rejoué", !labels(at(2026, 11, 12, 20, 30)).contains("Matin"))
        check("deux rappels dus ensemble sont rendus ensemble (un seul sera affiché)", labels(at(2026, 11, 12, 9, 0)) == ["Matin"]
              && Regles.due([matin, Reminder(hour: 8, minute: 30, weekdays: [5], label: "Bis", startLevel: .signal)],
                            now: at(2026, 11, 12, 9, 0), fired: [], window: window, calendar: cal).count == 2)
        check("1 h 42 de retard : encore dû", labels(at(2026, 11, 12, 22, 12)) == ["Soir"])
        check("3 h de retard : abandonné", labels(at(2026, 11, 12, 23, 30)) == [])
        let joue: Set<String> = [Regles.key(soir, at(2026, 11, 12, 20, 30), calendar: cal)]
        check("déjà joué aujourd'hui : rien", labels(at(2026, 11, 12, 20, 45), fired: joue) == [])
        check("joué hier : rejoué aujourd'hui", labels(at(2026, 11, 13, 20, 30), fired: joue) == ["Soir"])
        check("samedi : le rappel du samedi seulement", labels(at(2026, 11, 14, 15, 5)) == ["Samedi"])
        check("dimanche : rien", labels(at(2026, 11, 15, 20, 30)) == [])

        let calmAfter = 22 * 60 + 30
        check("22 h 29 : pas encore tard", !Regles.isCalm(at(2026, 11, 12, 22, 29), calmAfter: calmAfter, calendar: cal))
        check("22 h 30 : tard", Regles.isCalm(at(2026, 11, 12, 22, 30), calmAfter: calmAfter, calendar: cal))
        check("3 h du matin : tard", Regles.isCalm(at(2026, 11, 13, 3, 0), calmAfter: calmAfter, calendar: cal))
        check("8 h : pas tard", !Regles.isCalm(at(2026, 11, 13, 8, 0), calmAfter: calmAfter, calendar: cal))
        check("limite désactivée : jamais tard", !Regles.isCalm(at(2026, 11, 12, 23, 59), calmAfter: 0, calendar: cal))

        check("tard : le rappel du soir s'affiche en bannière", Regles.startLevel(soir, calm: true) == .signal)
        check("à l'heure : le rappel du soir s'affiche en N2", Regles.startLevel(soir, calm: false) == .alerte)
        check("tard : une alerte N2 déjà affichée ne monte pas en N3", Regles.ceiling(soir, current: .alerte, calm: true) == .alerte)
        check("à l'heure : le rappel du soir peut monter en N3", Regles.ceiling(soir, current: .alerte, calm: false) == .urgence)
        check("le rappel du matin ne dépasse jamais la bannière", Regles.ceiling(matin, current: .signal, calm: false) == .signal)
        check("après un report : au moins N2", Regles.levelAfterSnooze(soir, current: .alerte, calm: false) == .alerte)
        check("après un report, rappel plafonné à N1 : bannière", Regles.levelAfterSnooze(matin, current: .signal, calm: false) == .signal)
        check("après un report, tard : bannière", Regles.levelAfterSnooze(soir, current: .alerte, calm: true) == .signal)

        check("3 jours sans séance : pas une reprise", !Regles.reprise(daysSinceLast: 3))
        check("4 jours sans séance : reprise", Regles.reprise(daysSinceLast: 4))
        check("aucune séance connue : pas une reprise", !Regles.reprise(daysSinceLast: nil))

        // la suspension s'arrête à 5 h : le rappel du soir du dernier jour est sauté, celui du lendemain sonne
        let jeudiSoir = at(2026, 11, 12, 19, 0)
        let demain = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: jeudiSoir)) ?? jeudiSoir
        let fin = cal.date(bySettingHour: 5, minute: 0, second: 0, of: demain) ?? demain
        check("suspendu jusqu'à demain : le rappel de ce soir est sauté", at(2026, 11, 12, 20, 30) < fin)
        check("suspendu jusqu'à demain : le rappel de demain soir sonne", at(2026, 11, 13, 20, 30) >= fin)

        let plan = PraxisPlan(title: "25 exercices", subtitle: "", minutes: 19)
        check("ancien fichier de Praxis, sans séance express : express proposée par défaut (6 exercices, 5 min)",
              plan.express?.minutes == 5 && plan.express?.n == 6)
        var court = plan
        court.minutes = 4
        court.expressN = 5
        court.expressMin = 4
        check("séance du jour déjà courte : pas de bouton express", court.express == nil)

        print(failures == 0 ? "Tout est bon." : "\(failures) vérification(s) en échec.")
        return failures == 0
    }
}
