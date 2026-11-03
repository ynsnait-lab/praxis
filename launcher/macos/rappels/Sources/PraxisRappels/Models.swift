import Foundation
import SwiftUI

// MARK: - Niveaux d'escalade

enum AlertLevel: Int, Codable, CaseIterable, Identifiable, Comparable {
    case signal = 1   // bannière en haut à droite
    case alerte = 2   // écran flouté + carte centrale
    case urgence = 3  // rouge, plus de report possible

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .signal: "Signal"
        case .alerte: "Alerte"
        case .urgence: "Urgence"
        }
    }

    var next: AlertLevel? { AlertLevel(rawValue: rawValue + 1) }

    static func < (lhs: AlertLevel, rhs: AlertLevel) -> Bool { lhs.rawValue < rhs.rawValue }
}

// MARK: - Rappel planifié

struct Reminder: Codable, Identifiable, Hashable {
    var id = UUID()
    var hour: Int
    var minute: Int
    /// Jours actifs, au format `Calendar` : 1 = dimanche … 7 = samedi.
    var weekdays: Set<Int>
    var label: String
    var startLevel: AlertLevel
    /// Niveau à ne pas dépasser (nil : jusqu'à l'urgence). N1 pour un rappel qui ne doit jamais bloquer l'écran.
    var maxLevel: AlertLevel?
    var isEnabled = true

    var timeString: String { String(format: "%02d:%02d", hour, minute) }

    /// Le plus haut niveau que ce rappel peut atteindre.
    var ceiling: AlertLevel { max(maxLevel ?? .urgence, startLevel) }

    /// « L M M J V », dans l'ordre de la semaine.
    var daysString: String {
        let days = weekdayDisplayOrder.filter { weekdays.contains($0.weekday) }.map(\.letter)
        return days.count == 7 ? "tous les jours" : days.joined(separator: " ")
    }

    /// Date de déclenchement de ce rappel pour le jour qui contient `day`, ou nil si le jour n'est pas actif.
    func fireDate(on day: Date, calendar: Calendar = .current) -> Date? {
        let weekday = calendar.component(.weekday, from: day)
        guard weekdays.contains(weekday) else { return nil }
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day)
    }

    /// Rappels proposés au premier lancement, modifiables dans les réglages : en fin de journée,
    /// quand un écran bloqué est le bienvenu. Le rappel du matin est fourni éteint, et ne dépasse jamais la bannière.
    static let examples: [Reminder] = [
        Reminder(hour: 18, minute: 30, weekdays: [2, 3, 4, 5, 6], label: "Séance principale", startLevel: .alerte),
        Reminder(hour: 18, minute: 0, weekdays: [7], label: "Séance du week-end", startLevel: .alerte),
        Reminder(hour: 7, minute: 45, weekdays: [2, 3, 4, 5, 6], label: "Révision flash", startLevel: .signal,
                 maxLevel: .signal, isEnabled: false),
    ]

    /// Signature des premiers rappels par défaut (7 h 45 en semaine, 18 h 30, samedi 10 h en urgence).
    var legacySignature: String { "\(hour):\(minute):\(weekdays.sorted()):\(label):\(startLevel.rawValue):\(isEnabled)" }
    static let legacyDefaults: Set<String> = [
        "7:45:[2, 3, 4, 5, 6]:Révision flash:1:true",
        "18:30:[2, 3, 4, 5, 6]:Séance principale:2:true",
        "10:0:[7]:Projet long du week-end:3:true",
    ]
}

/// Ordre d'affichage lundi → dimanche, avec les initiales françaises.
let weekdayDisplayOrder: [(weekday: Int, letter: String)] = [
    (2, "L"), (3, "M"), (4, "M"), (5, "J"), (6, "V"), (7, "S"), (1, "D"),
]

// MARK: - Règles globales

struct ReminderRules: Codable, Equatable {
    var escalationMinutes = 15
    var snoozeMinutes = 10
    var maxSnoozes = 2
    var silenceIfPracticedToday = true
    /// Utile seulement avec un Praxis qui n'envoie pas de signal de fin de séance : le clic sur « Lancer » compte alors comme séance.
    var countLaunchAsSession = false
    var soundEnabled = true
    var praxisBundleID = PraxisBridge.defaultBundleID

    init() {}

    /// Décodage tolérant : un réglage ajouté dans une version plus récente prend sa valeur par défaut
    /// au lieu de faire perdre tous les autres.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = ReminderRules()
        escalationMinutes = try c.decodeIfPresent(Int.self, forKey: .escalationMinutes) ?? d.escalationMinutes
        snoozeMinutes = try c.decodeIfPresent(Int.self, forKey: .snoozeMinutes) ?? d.snoozeMinutes
        maxSnoozes = try c.decodeIfPresent(Int.self, forKey: .maxSnoozes) ?? d.maxSnoozes
        silenceIfPracticedToday = try c.decodeIfPresent(Bool.self, forKey: .silenceIfPracticedToday) ?? d.silenceIfPracticedToday
        countLaunchAsSession = try c.decodeIfPresent(Bool.self, forKey: .countLaunchAsSession) ?? d.countLaunchAsSession
        soundEnabled = try c.decodeIfPresent(Bool.self, forKey: .soundEnabled) ?? d.soundEnabled
        praxisBundleID = try c.decodeIfPresent(String.self, forKey: .praxisBundleID) ?? d.praxisBundleID
    }
}

// MARK: - Persistance des rappels

@MainActor
final class ReminderStore: ObservableObject {
    @Published var reminders: [Reminder] { didSet { save() } }
    @Published var rules: ReminderRules { didSet { save() } }

    private let defaults: UserDefaults
    private enum Key { static let reminders = "reminders.v1", rules = "rules.v1" }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let decoder = JSONDecoder()
        var stored = defaults.data(forKey: Key.reminders)
            .flatMap { try? decoder.decode([Reminder].self, from: $0) } ?? Reminder.examples
        // Les premiers rappels par défaut bloquaient l'écran le matin : s'ils n'ont jamais été modifiés,
        // on passe aux nouveaux (fin de journée). Des rappels personnalisés ne sont jamais touchés.
        if Set(stored.map(\.legacySignature)) == Reminder.legacyDefaults && stored.count == 3 {
            stored = Reminder.examples
            Journal.note("rappels par défaut mis à jour : fin de journée, matin éteint")
        }
        reminders = stored
        rules = defaults.data(forKey: Key.rules)
            .flatMap { try? decoder.decode(ReminderRules.self, from: $0) } ?? ReminderRules()
        save()
    }

    private func save() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(reminders) { defaults.set(data, forKey: Key.reminders) }
        if let data = try? encoder.encode(rules) { defaults.set(data, forKey: Key.rules) }
    }

    /// Prochain déclenchement après `date`, sur les 8 prochains jours.
    func nextFire(after date: Date = .now, calendar: Calendar = .current) -> (reminder: Reminder, date: Date)? {
        var best: (Reminder, Date)?
        for offset in 0...7 {
            guard let day = calendar.date(byAdding: .day, value: offset, to: date) else { continue }
            for reminder in reminders where reminder.isEnabled {
                guard let fire = reminder.fireDate(on: day, calendar: calendar), fire > date else { continue }
                if best == nil || fire < best!.1 { best = (reminder, fire) }
            }
            if best != nil { break }
        }
        return best.map { (reminder: $0.0, date: $0.1) }
    }

    /// Objectif de la semaine : un jour de pratique par jour qui a au moins un rappel actif.
    var weeklyGoal: Int {
        max(1, Set(reminders.filter(\.isEnabled).flatMap(\.weekdays)).count)
    }
}

// MARK: - Journal de pratique

struct SkipEntry: Codable, Hashable {
    var date: Date
    var reason: String
    var reminderLabel: String
}

enum DayState { case done, today, missed, upcoming }

@MainActor
final class PracticeLog: ObservableObject {
    @Published private(set) var sessions: [Date] { didSet { save() } }
    @Published private(set) var skips: [SkipEntry] { didSet { save() } }

    private let defaults: UserDefaults
    private let calendar = Calendar.current
    private enum Key { static let sessions = "sessions.v1", skips = "skips.v1" }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let decoder = JSONDecoder()
        sessions = defaults.data(forKey: Key.sessions).flatMap { try? decoder.decode([Date].self, from: $0) } ?? []
        skips = defaults.data(forKey: Key.skips).flatMap { try? decoder.decode([SkipEntry].self, from: $0) } ?? []
    }

    private func save() {
        let encoder = JSONEncoder()
        if let data = try? encoder.encode(sessions) { defaults.set(data, forKey: Key.sessions) }
        if let data = try? encoder.encode(skips) { defaults.set(data, forKey: Key.skips) }
    }

    func recordSession(at date: Date = .now) {
        guard !sessions.contains(where: { calendar.isDate($0, inSameDayAs: date) }) else { return }
        sessions.append(date)
    }

    /// Reprend les journées pratiquées annoncées par Praxis (« 2026-10-31 »), y compris celles d'avant l'installation.
    func sync(days stamps: [String]) {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        var added: [Date] = []
        for stamp in stamps {
            guard let day = formatter.date(from: stamp),
                  let noon = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: day),
                  noon <= .now || calendar.isDateInToday(noon),
                  !sessions.contains(where: { calendar.isDate($0, inSameDayAs: noon) }),
                  !added.contains(where: { calendar.isDate($0, inSameDayAs: noon) }) else { continue }
            added.append(min(noon, .now))
        }
        if !added.isEmpty { sessions.append(contentsOf: added) }
    }

    func recordSkip(reason: String, reminder: Reminder, at date: Date = .now) {
        skips.append(SkipEntry(date: date, reason: reason, reminderLabel: reminder.label))
    }

    var practicedToday: Bool { sessions.contains { calendar.isDateInToday($0) } }

    var lastSession: Date? { sessions.max() }

    /// Jours consécutifs avec séance, en partant d'aujourd'hui (ou d'hier si aujourd'hui n'est pas encore fait).
    var streak: Int {
        var day = calendar.startOfDay(for: .now)
        if !practicedToday { day = calendar.date(byAdding: .day, value: -1, to: day)! }
        var count = 0
        while sessions.contains(where: { calendar.isDate($0, inSameDayAs: day) }) {
            count += 1
            day = calendar.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }

    /// État de chaque jour de la semaine en cours, lundi → dimanche.
    var week: [DayState] {
        var iso = Calendar(identifier: .iso8601)
        iso.timeZone = calendar.timeZone
        guard let monday = iso.dateInterval(of: .weekOfYear, for: .now)?.start else { return [] }
        return (0..<7).map { offset in
            let day = iso.date(byAdding: .day, value: offset, to: monday)!
            if sessions.contains(where: { iso.isDate($0, inSameDayAs: day) }) { return .done }
            if iso.isDateInToday(day) { return .today }
            return day < .now ? .missed : .upcoming
        }
    }

    var sessionsThisWeek: Int { week.filter { $0 == .done }.count }
}
