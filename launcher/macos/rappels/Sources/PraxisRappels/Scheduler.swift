import AppKit
import Foundation

/// Décide quand afficher une alerte, à quel niveau, et ce que font les boutons. Les règles elles-mêmes sont dans Regles.swift.
///
/// - Une seule alerte à la fois : si plusieurs rappels sont dus en même temps (après une veille), seul le plus récent
///   s'affiche, les autres sont considérés comme passés.
/// - Rien ne se déclenche ni ne monte de niveau quand personne n'est devant l'écran (veille, capot fermé, session
///   verrouillée) : l'alerte attend le retour, avec un compte à rebours neuf. Une alerte de la veille est abandonnée.
/// - Un rappel ne dépasse jamais son niveau plafond, et tard le soir plus rien ne bloque l'écran : une bannière.
/// - « Lancer » ne vaut pas séance : si elle n'est pas terminée une demi-heure plus tard, une bannière le rappelle une fois.
@MainActor
final class Scheduler: ObservableObject {

    struct ActiveAlert: Equatable {
        var reminder: Reminder
        var level: AlertLevel
        var snoozesUsed = 0
        var snoozedUntil: Date?
        /// Relance après un « Lancer » sans séance terminée : une bannière, une seule fois.
        var followUp = false
        /// Alerte d'essai (menu « Tester l'alerte ») : affichée telle quelle, quelle que soit l'heure.
        var isTest = false
        /// Jour de création : une alerte restée en attente toute la nuit ne revient pas le lendemain matin.
        var day = Regles.dayStamp(.now)
    }

    enum Status { case idle, alert, done, paused }

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
    private var lastDay = ""

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
        let today = Regles.dayStamp(.now)
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
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "essai"
        Journal.note("démarrage (\(version)) · \(store.reminders.filter(\.isEnabled).map { "\($0.timeString) \($0.daysString) N\($0.startLevel.rawValue)→N\($0.ceiling.rawValue)" }.joined(separator: " ; "))")
        tick()
    }

    /// Ce que montre l'icône de la barre des menus.
    var status: Status {
        if let alert = active, !alert.followUp || alert.snoozedUntil == nil { return .alert }
        if store.isPaused { return .paused }
        return log.practicedToday ? .done : .idle
    }

    // MARK: - Boucle principale

    func tick(now: Date = .now) {
        Lifecycle.heartbeat(now)
        refreshPlan()
        let today = Regles.dayStamp(now)
        if today != lastDay {
            lastDay = today
            objectWillChange.send()   // « séance faite » redevient « à faire » dans la barre des menus
        }
        if firedKeys.contains(where: { !$0.hasSuffix(today) }) {
            firedKeys = firedKeys.filter { $0.hasSuffix(today) }
        }
        if let until = store.pausedUntil, now >= until {
            store.pausedUntil = nil
            Journal.note("fin de la suspension des rappels")
        }
        // Personne devant l'écran (veille, réveil sombre de la nuit, session verrouillée) : on attend.
        guard presence.isPresent else { return }

        if var alert = active {
            if dropIfStale(alert, today: today) { return }
            if let until = alert.snoozedUntil, now >= until {
                alert.snoozedUntil = nil
                if alert.followUp {
                    // La séance a peut-être été faite sans que Praxis le signale (page fermée avant le bilan).
                    if log.practicedToday { finish(hideAfter: 0); return }
                    Journal.note("séance lancée mais pas terminée : bannière de relance")
                } else {
                    alert.level = Regles.levelAfterSnooze(alert.reminder, current: alert.level, calm: isCalm(now))
                    Journal.note("fin du report · \(alert.reminder.label) · N\(alert.level.rawValue)")
                }
                active = alert
                present(alert)
            }
            return
        }
        guard !store.isPaused else { return }

        // Tous les rappels dus et pas encore joués : on les marque tous, on n'en affiche qu'un, le plus récent.
        let due = Regles.due(store.reminders, now: now, fired: firedKeys, window: catchUpWindow)
        guard let latest = due.max(by: { $0.fire < $1.fire }) else { return }
        for item in due { firedKeys.insert(Regles.key(item.reminder, item.fire)) }
        if due.count > 1 {
            Journal.note("rappels regroupés : \(due.map { $0.reminder.timeString }.joined(separator: ", ")) → un seul affiché")
        }
        if store.rules.silenceIfPracticedToday && log.practicedToday {
            Journal.note("rappel \(latest.reminder.timeString) · silencieux, séance déjà faite")
            return
        }
        let calm = isCalm(now)
        let level = Regles.startLevel(latest.reminder, calm: calm)
        let late = Int(now.timeIntervalSince(latest.fire) / 60)
        Journal.note("rappel \(latest.reminder.timeString) · \(latest.reminder.label) · N\(level.rawValue)"
                     + (late > 1 ? " · \(late) min de retard" : "") + (calm && level < latest.reminder.startLevel ? " · tard : bannière seulement" : ""))
        let alert = ActiveAlert(reminder: latest.reminder, level: level, day: today)
        active = alert
        present(alert)
    }

    private func isCalm(_ now: Date = .now) -> Bool {
        Regles.isCalm(now, calmAfter: store.rules.calmAfter)
    }

    /// Le niveau que cette alerte ne peut pas dépasser maintenant.
    private func ceiling(of alert: ActiveAlert) -> AlertLevel {
        if alert.followUp || alert.isTest { return alert.level }
        return Regles.ceiling(alert.reminder, current: alert.level, calm: isCalm())
    }

    /// Une alerte née un autre jour (capot fermé le soir, rouvert le lendemain) n'a plus lieu d'être.
    private func dropIfStale(_ alert: ActiveAlert, today: String) -> Bool {
        guard alert.day != today else { return false }
        Journal.note("alerte du \(alert.day) abandonnée : la journée est passée")
        finish(hideAfter: 0)
        return true
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
        guard let alert = active, alert.snoozedUntil == nil else { return }
        Journal.note("absent (\(presence.reason)) : alerte N\(alert.level.rawValue) mise en attente")
        panel.hide()
    }

    private func userReturned() {
        guard var alert = active, alert.snoozedUntil == nil else { tick(); return }
        if dropIfStale(alert, today: Regles.dayStamp(.now)) { tick(); return }
        if !alert.isTest, isCalm(), alert.level > .signal {
            alert.level = .signal
            active = alert
            Journal.note("retour tard le soir : l'alerte revient en bannière")
        } else {
            Journal.note("retour : alerte N\(alert.level.rawValue) réaffichée, compte à rebours remis à zéro")
        }
        present(alert)
    }

    // MARK: - Suspension

    func pause(days: Int) {
        store.pause(days: days)
        if let until = store.pausedUntil {
            Journal.note("rappels suspendus jusqu'au \(until.formatted(date: .abbreviated, time: .shortened))")
        }
        if active != nil { finish(hideAfter: 0) }
    }

    func resume() {
        store.pausedUntil = nil
        Journal.note("rappels repris")
        tick()
    }

    /// Déclenchement manuel (menu « Tester l'alerte », ou --tester N au lancement).
    func test(level: AlertLevel) {
        var reminder = store.nextFire()?.reminder ?? Reminder.examples[0]
        reminder.startLevel = level
        reminder.maxLevel = level
        let alert = ActiveAlert(reminder: reminder, level: level, isTest: true)
        Journal.note("test N\(level.rawValue)")
        active = alert
        present(alert)
    }

    /// Ouvre Praxis sur la séance, depuis le menu : même effet que le bouton de l'alerte.
    func launchFromMenu(express: Bool) {
        if active != nil {
            handleLaunch(express: express)
        } else {
            Journal.note(express ? "menu : séance express" : "menu : séance du jour")
            PraxisBridge.launch(bundleID: store.rules.praxisBundleID, express: express)
        }
    }

    // MARK: - Affichage

    private func present(_ alert: ActiveAlert) {
        refreshPlan()
        let rules = store.rules
        let escalates = alert.level < ceiling(of: alert) || alert.level == .urgence
        let model = AlertViewModel(
            reminder: alert.reminder,
            level: alert.level,
            session: plan,
            streak: streak,
            week: log.week,
            sessionsThisWeek: log.sessionsThisWeek,
            weeklyGoal: store.weeklyGoal,
            lastSession: log.lastSession,
            daysSinceLast: log.daysSinceLastSession,
            snoozesLeft: alert.level == .urgence ? 0 : max(0, rules.maxSnoozes - alert.snoozesUsed),
            snoozeMinutes: rules.snoozeMinutes,
            escalationWindow: TimeInterval(rules.escalationMinutes * 60),
            escalates: escalates,
            followUp: alert.followUp,
            late: !alert.isTest && !alert.followUp && isCalm()
        )
        model.onLaunch = { [weak self] express in self?.handleLaunch(express: express) }
        model.onSnooze = { [weak self] in self?.handleSnooze() }
        model.onSkip = { [weak self] reason in self?.handleSkip(reason: reason) }
        model.onDismiss = { [weak self] in self?.handleDismiss() }

        panel.show(model)
        if rules.soundEnabled { SoundPlayer.play(alert.level) }
        if escalates {
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
        if let next = alert.level.next, next <= ceiling(of: alert) {
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

    private func handleLaunch(express: Bool) {
        guard let alert = active else { return }
        Journal.note(express ? "lancer Praxis · séance express" : "lancer Praxis · séance du jour")
        PraxisBridge.launch(bundleID: store.rules.praxisBundleID, express: express)
        if store.rules.countLaunchAsSession { log.recordSession() }
        escalationTimer?.invalidate()
        let minutes = store.rules.followUpMinutes
        if minutes > 0, !alert.followUp, !alert.isTest, !store.rules.countLaunchAsSession {
            // On vérifiera que la séance est allée au bout : sinon, une bannière, une seule fois.
            active = ActiveAlert(reminder: alert.reminder, level: .signal,
                                 snoozedUntil: Date.now.addingTimeInterval(TimeInterval(minutes * 60)),
                                 followUp: true, day: alert.day)
        } else {
            active = nil
        }
        panel.hide(after: 1.6) // laisse le temps à l'écran « Série » de s'afficher
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

    nonisolated static func dayStamp(_ date: Date) -> String { Regles.dayStamp(date) }
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
