import AppKit
import Foundation

/// Décide quand afficher une alerte, à quel niveau, et ce que font les boutons.
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
    private var tickTimer: Timer?
    private var escalationTimer: Timer?
    private var observers: [NSObjectProtocol] = []
    private var planDate: Date?

    /// Un rappel manqué (Mac en veille, capot fermé) est encore affiché s'il date de moins d'une heure.
    private let catchUpWindow: TimeInterval = 60 * 60

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
        tickTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
        observers.append(NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        })
        observers.append(PraxisBridge.observeSessionCompleted { [weak self] in
            self?.sessionCompleted()
        })
        tick()
    }

    // MARK: - Boucle principale

    func tick(now: Date = .now) {
        refreshPlan()
        let today = Self.dayStamp(now)
        if firedKeys.contains(where: { !$0.hasSuffix(today) }) {
            firedKeys = firedKeys.filter { $0.hasSuffix(today) }
        }

        if var alert = active {
            if let until = alert.snoozedUntil, now >= until {
                alert.snoozedUntil = nil
                alert.level = max(alert.level, .alerte)
                active = alert
                present(alert)
            }
            return
        }

        for reminder in store.reminders where reminder.isEnabled {
            guard let fire = reminder.fireDate(on: now),
                  now >= fire, now.timeIntervalSince(fire) < catchUpWindow else { continue }
            let key = "\(reminder.id.uuidString)@\(Self.dayStamp(fire))"
            guard !firedKeys.contains(key) else { continue }
            firedKeys.insert(key)
            if store.rules.silenceIfPracticedToday && log.practicedToday { continue }

            let alert = ActiveAlert(reminder: reminder, level: reminder.startLevel)
            active = alert
            present(alert)
            return
        }
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
        log.recordSession()
        if active != nil { finish(hideAfter: 0) }
    }

    /// Déclenchement manuel (menu « Tester l'alerte », ou --tester N au lancement).
    func test(level: AlertLevel) {
        let reminder = store.nextFire()?.reminder ?? Reminder.examples[1]
        let alert = ActiveAlert(reminder: reminder, level: level)
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
            escalationWindow: TimeInterval(rules.escalationMinutes * 60)
        )
        model.onLaunch = { [weak self] in self?.handleLaunch() }
        model.onSnooze = { [weak self] in self?.handleSnooze() }
        model.onSkip = { [weak self] reason in self?.handleSkip(reason: reason) }

        panel.show(model)
        if rules.soundEnabled { SoundPlayer.play(alert.level) }
        scheduleEscalation(after: TimeInterval(rules.escalationMinutes * 60))
    }

    private func scheduleEscalation(after interval: TimeInterval) {
        escalationTimer?.invalidate()
        escalationTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated { self?.escalate() }
        }
    }

    private func escalate() {
        guard var alert = active, alert.snoozedUntil == nil else { return }
        if let next = alert.level.next {
            alert.level = next
            active = alert
            present(alert)
        } else {
            // Déjà en urgence : on relance le son à chaque fenêtre tant que rien n'est fait.
            if store.rules.soundEnabled { SoundPlayer.play(.urgence) }
            scheduleEscalation(after: TimeInterval(store.rules.escalationMinutes * 60))
        }
    }

    // MARK: - Actions

    private func handleLaunch() {
        PraxisBridge.launch(bundleID: store.rules.praxisBundleID)
        if store.rules.countLaunchAsSession { log.recordSession() }
        finish(hideAfter: 1.6) // laisse le temps à l'écran « Série » de s'afficher
    }

    private func handleSnooze() {
        guard var alert = active, alert.level < .urgence, alert.snoozesUsed < store.rules.maxSnoozes else { return }
        alert.snoozesUsed += 1
        alert.snoozedUntil = Date.now.addingTimeInterval(TimeInterval(store.rules.snoozeMinutes * 60))
        active = alert
        escalationTimer?.invalidate()
        panel.hide()
    }

    private func handleSkip(reason: String) {
        if let alert = active { log.recordSkip(reason: reason, reminder: alert.reminder) }
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
