import AppKit
import Foundation

/// Décide quand afficher une alerte, à quel niveau, et ce que font les boutons.
///
/// Trois règles évitent les alertes qui « s'additionnent » :
/// - une seule alerte à la fois : si plusieurs rappels sont dus en même temps (après une veille), seul le plus récent
///   s'affiche, les autres sont considérés comme passés ;
/// - rien ne se déclenche ni ne monte de niveau quand personne n'est devant l'écran (veille, capot fermé, session
///   verrouillée) : l'alerte attend le retour, au niveau où elle était, avec un compte à rebours neuf ;
/// - un rappel ne dépasse jamais son niveau plafond (par exemple N1 pour un rappel du matin).
@MainActor
final class Scheduler: ObservableObject {

    struct ActiveAlert: Equatable {
        var reminder: Reminder
        var level: AlertLevel
        var snoozesUsed = 0
        var snoozedUntil: Date?
    }

    @Published private(set) var active: ActiveAlert?
    /// Séance du jour annoncée par Praxis (relue avant chaque alerte et à chaque mise à jour du fichier).
    @Published private(set) var plan = PraxisBridge.plan()

    private let store: ReminderStore
    private let log: PracticeLog
    private let panel: AlertPanelController
    private let presence = Presence()
    private var tickTimer: Timer?
    private var escalationTimer: Timer?
    private var observers: [NSObjectProtocol] = []
    private var planDate: Date?

    /// Un rappel manqué (Mac en veille, capot fermé) s'affiche au retour s'il date de moins de trois heures :
    /// la séance de 18 h 30 attend qu'on rouvre le Mac en rentrant.
    private let catchUpWindow: TimeInterval = 3 * 60 * 60

    /// Rappels déjà déclenchés aujourd'hui, pour ne pas les rejouer après un redémarrage de l'agent.
    private var firedKeys: Set<String> {
        didSet { UserDefaults.standard.set(Array(firedKeys), forKey: "firedKeys.v1") }
    }

    init(store: ReminderStore, log: PracticeLog, panel: AlertPanelController) {
        self.store = store
        self.log = log
        self.panel = panel
        let saved = UserDefaults.standard.stringArray(forKey: "firedKeys.v1") ?? []
        let today = Self.dayStamp(.now)
        firedKeys = Set(saved.filter { $0.hasSuffix(today) })
    }

    func start() {
        presence.onChange = { [weak self] present in
            if present { self?.userReturned() } else { self?.userLeft() }
        }
        presence.start()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        observers.append(PraxisBridge.observeSessionCompleted { [weak self] in
            self?.sessionCompleted()
        })
        Journal.note("démarrage · \(store.reminders.filter(\.isEnabled).map { "\($0.timeString) \($0.daysString) N\($0.startLevel.rawValue)→N\($0.ceiling.rawValue)" }.joined(separator: " ; "))")
        tick()
    }

    // MARK: - Boucle principale

    func tick(now: Date = .now) {
        refreshPlan()
        let today = Self.dayStamp(now)
        if firedKeys.contains(where: { !$0.hasSuffix(today) }) {
            firedKeys = firedKeys.filter { $0.hasSuffix(today) }
        }
        // Personne devant l'écran (veille, réveil sombre de la nuit, session verrouillée) : on attend.
        guard presence.isPresent else { return }

        if var alert = active {
            if let until = alert.snoozedUntil, now >= until {
                alert.snoozedUntil = nil
                alert.level = min(max(alert.level, .alerte), alert.reminder.ceiling)
                active = alert
                Journal.note("fin du report · \(alert.reminder.label) · N\(alert.level.rawValue)")
                present(alert)
            }
            return
        }

        // Tous les rappels dus et pas encore joués : on les marque tous, on n'en affiche qu'un, le plus récent.
        var due: [(reminder: Reminder, fire: Date)] = []
        for reminder in store.reminders where reminder.isEnabled {
            guard let fire = reminder.fireDate(on: now),
                  now >= fire, now.timeIntervalSince(fire) < catchUpWindow,
                  !firedKeys.contains(key(reminder, fire)) else { continue }
            due.append((reminder, fire))
        }
        guard let latest = due.max(by: { $0.fire < $1.fire }) else { return }
        for item in due { firedKeys.insert(key(item.reminder, item.fire)) }
        if due.count > 1 {
            Journal.note("rappels regroupés : \(due.map { $0.reminder.timeString }.joined(separator: ", ")) → un seul affiché")
        }
        if store.rules.silenceIfPracticedToday && log.practicedToday {
            Journal.note("rappel \(latest.reminder.timeString) · silencieux, séance déjà faite")
            return
        }
        let late = Int(now.timeIntervalSince(latest.fire) / 60)
        Journal.note("rappel \(latest.reminder.timeString) · \(latest.reminder.label) · N\(latest.reminder.startLevel.rawValue)\(late > 1 ? " · \(late) min de retard" : "")")
        let alert = ActiveAlert(reminder: latest.reminder, level: latest.reminder.startLevel)
        active = alert
        present(alert)
    }

    private func key(_ reminder: Reminder, _ fire: Date) -> String {
        "\(reminder.id.uuidString)@\(Self.dayStamp(fire))"
    }

    /// Relit le fichier de Praxis s'il a changé : séance du jour et journées déjà pratiquées.
    private func refreshPlan() {
        let date = PraxisBridge.planModificationDate()
        guard date != planDate else { return }
        planDate = date
        plan = PraxisBridge.plan()
        if let days = plan.jours { log.sync(days: days) }
    }

    /// La série montrée à l'utilisateur : celle de Praxis quand elle est plus longue que celle des séances terminées.
    var streak: Int { max(log.streak, plan.liveStreak) }

    private func sessionCompleted() {
        Journal.note("séance terminée dans Praxis")
        log.recordSession()
        if active != nil { finish(hideAfter: 0) }
    }

    // MARK: - Absence et retour

    private func userLeft() {
        escalationTimer?.invalidate()
        guard let alert = active else { return }
        Journal.note("absent (\(presence.reason)) : alerte N\(alert.level.rawValue) mise en attente")
        panel.hide()
    }

    private func userReturned() {
        if let alert = active, alert.snoozedUntil == nil {
            Journal.note("retour : alerte N\(alert.level.rawValue) réaffichée, compte à rebours remis à zéro")
            present(alert)
        } else {
            tick()
        }
    }

    /// Déclenchement manuel (menu « Tester l'alerte », ou --tester N au lancement).
    func test(level: AlertLevel) {
        var reminder = store.nextFire()?.reminder ?? Reminder.examples[0]
        reminder.startLevel = level
        reminder.maxLevel = level
        let alert = ActiveAlert(reminder: reminder, level: level)
        Journal.note("test N\(level.rawValue)")
        active = alert
        present(alert)
    }

    // MARK: - Affichage

    private func present(_ alert: ActiveAlert) {
        refreshPlan()
        let rules = store.rules
        let model = AlertViewModel(
            reminder: alert.reminder,
            level: alert.level,
            session: plan,
            streak: streak,
            week: log.week,
            sessionsThisWeek: log.sessionsThisWeek,
            weeklyGoal: store.weeklyGoal,
            lastSession: log.lastSession,
            snoozesLeft: alert.level == .urgence ? 0 : max(0, rules.maxSnoozes - alert.snoozesUsed),
            snoozeMinutes: rules.snoozeMinutes,
            escalationWindow: TimeInterval(rules.escalationMinutes * 60),
            escalates: alert.level < alert.reminder.ceiling || alert.level == .urgence
        )
        model.onLaunch = { [weak self] in self?.handleLaunch() }
        model.onSnooze = { [weak self] in self?.handleSnooze() }
        model.onSkip = { [weak self] reason in self?.handleSkip(reason: reason) }
        model.onDismiss = { [weak self] in self?.handleDismiss() }

        panel.show(model)
        if rules.soundEnabled { SoundPlayer.play(alert.level) }
        if alert.level < alert.reminder.ceiling || alert.level == .urgence {
            scheduleEscalation(after: TimeInterval(rules.escalationMinutes * 60))
        } else {
            escalationTimer?.invalidate()
        }
    }

    private func scheduleEscalation(after interval: TimeInterval) {
        escalationTimer?.invalidate()
        escalationTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated { self?.escalate() }
        }
    }

    private func escalate() {
        // Pas d'escalade sans personne pour la voir : le retour réaffichera l'alerte à son niveau actuel.
        guard presence.isPresent, var alert = active, alert.snoozedUntil == nil else { return }
        if let next = alert.level.next, next <= alert.reminder.ceiling {
            alert.level = next
            active = alert
            Journal.note("escalade · N\(next.rawValue)")
            present(alert)
        } else if alert.level == .urgence {
            // En urgence : on relance le son à chaque fenêtre tant que rien n'est fait.
            if store.rules.soundEnabled { SoundPlayer.play(.urgence) }
            scheduleEscalation(after: TimeInterval(store.rules.escalationMinutes * 60))
        }
    }

    // MARK: - Actions

    private func handleLaunch() {
        guard active != nil else { return }
        Journal.note("lancer Praxis")
        PraxisBridge.launch(bundleID: store.rules.praxisBundleID)
        if store.rules.countLaunchAsSession { log.recordSession() }
        finish(hideAfter: 1.6) // laisse le temps à l'écran « Série » de s'afficher
    }

    private func handleSnooze() {
        guard var alert = active, alert.level < .urgence, alert.snoozesUsed < store.rules.maxSnoozes else { return }
        alert.snoozesUsed += 1
        alert.snoozedUntil = Date.now.addingTimeInterval(TimeInterval(store.rules.snoozeMinutes * 60))
        active = alert
        Journal.note("report de \(store.rules.snoozeMinutes) min (\(alert.snoozesUsed)/\(store.rules.maxSnoozes))")
        escalationTimer?.invalidate()
        panel.hide()
    }

    private func handleSkip(reason: String) {
        guard let alert = active else { return }
        Journal.note("pas aujourd'hui : \(reason)")
        log.recordSkip(reason: reason, reminder: alert.reminder)
        finish(hideAfter: 0)
    }

    /// Bannière (N1) fermée sans lancer : pas de raison demandée, c'est un rappel discret.
    private func handleDismiss() {
        guard active != nil else { return }
        Journal.note("bannière fermée")
        finish(hideAfter: 0)
    }

    private func finish(hideAfter delay: TimeInterval) {
        escalationTimer?.invalidate()
        active = nil
        panel.hide(after: delay)
    }

    nonisolated static func dayStamp(_ date: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
}

enum SoundPlayer {
    static func play(_ level: AlertLevel) {
        let name: String = switch level {
        case .signal: "Glass"
        case .alerte: "Submarine"
        case .urgence: "Sosumi"
        }
        NSSound(named: NSSound.Name(name))?.play()
    }
}
