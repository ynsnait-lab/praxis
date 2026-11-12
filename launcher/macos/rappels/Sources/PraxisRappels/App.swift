import AppKit
import ServiceManagement
import SwiftUI

// Praxis Rappels : un agent de barre des menus (pas d'icône dans le Dock) qui rappelle de pratiquer sur Praxis
// aux horaires choisis, avec une alerte qui monte en intensité si on l'ignore.
//
// L'agent ne s'arrête que par son menu (« Quitter Praxis Rappels ») ou sur demande du système : ⌘Q, tapé par réflexe
// devant la fenêtre des horaires ou une alerte, ferme la fenêtre mais laisse les rappels en route.
// Rouvrir l'app alors qu'elle tourne déjà affiche la fenêtre des horaires.
//
// Options de lancement (pour essayer) :
//   --tester 1|2|3        affiche tout de suite une alerte de ce niveau
//   --reglages            ouvre tout de suite la fenêtre des horaires et réglages
//   --apercu <dossier>    dessine les alertes en PNG dans ce dossier, puis quitte (aucune fenêtre)
//   --verifier            rejoue les règles de déclenchement sur des cas datés, puis quitte (aucune fenêtre)
//   --essai-cmdq          demande à l'agent en route de faire comme si l'on tapait ⌘Q : il doit rester en route

@main
struct PraxisRappelsApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel.shared

    var body: some Scene {
        MenuBarExtra {
            MenuContent()
                .environmentObject(model.store)
                .environmentObject(model.log)
                .environmentObject(model.scheduler)
        } label: {
            MenuBarIcon(scheduler: model.scheduler, log: model.log, store: model.store)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--apercu") {
            let dossier = i + 1 < args.count ? args[i + 1] : FileManager.default.currentDirectoryPath
            MainActor.assumeIsolated { Apercu.render(into: URL(fileURLWithPath: dossier)) }
            exit(0)
        }
        if args.contains("--verifier") { exit(Verification.run() ? 0 : 1) }
        if args.contains("--essai-cmdq") {
            DistributedNotificationCenter.default().postNotificationName(Lifecycle.tryCommandQ, object: nil, userInfo: nil,
                                                                         deliverImmediately: true)
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))   // le temps que la notification parte
            exit(0)
        }
    }

    /// Fermer la fenêtre des horaires ne doit jamais arrêter l'agent.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    /// Rouvrir l'app (Launchpad, Spotlight, Finder) alors qu'elle tourne : on montre la fenêtre des horaires.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        MainActor.assumeIsolated {
            guard Lifecycle.started else { return }
            Journal.note("app rouverte alors qu'elle tourne déjà : fenêtre des horaires")
            SettingsWindow.shared.show()
        }
        return false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Une seule instance : deux agents joueraient chaque rappel deux fois. Rouvrir l'app (Launchpad, Spotlight)
        // alors qu'elle tourne déjà fait apparaître la fenêtre des horaires de l'instance en route.
        if let id = Bundle.main.bundleIdentifier,
           NSRunningApplication.runningApplications(withBundleIdentifier: id).contains(where: { $0 != .current }) {
            DistributedNotificationCenter.default().postNotificationName(Lifecycle.showSettings, object: nil, userInfo: nil,
                                                                         deliverImmediately: true)
            MainActor.assumeIsolated { Lifecycle.quitRequested = true }
            NSApp.terminate(nil)
            return
        }
        // Agent de barre des menus : pas d'icône dans le Dock.
        NSApp.setActivationPolicy(.accessory)
        MainActor.assumeIsolated {
            AppModel.shared.start()
            Lifecycle.observeShowSettings()
            if CommandLine.arguments.contains("--reglages") { SettingsWindow.shared.show() }
            LoginItem.registerOnFirstLaunch()
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "--tester"), i + 1 < args.count,
               let n = Int(args[i + 1]), let level = AlertLevel(rawValue: n) {
                AppModel.shared.scheduler.test(level: level)
            }
        }
    }

    /// ⌘Q ne quitte pas l'agent : sans lui, plus aucun rappel, et rien ne le signale. Seuls le menu du triangle,
    /// le système (fermeture de session, extinction) et l'installation d'une mise à jour peuvent l'arrêter.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        MainActor.assumeIsolated { () -> NSApplication.TerminateReply in
            if Lifecycle.quitRequested { return .terminateNow }
            if let event = NSAppleEventManager.shared().currentAppleEvent,
               event.eventClass == AEEventClass(kCoreEventClass), event.eventID == AEEventID(kAEQuitApplication) {
                Lifecycle.reason = "demandé par le système ou par une mise à jour"
                return .terminateNow
            }
            Journal.note("⌘Q : fenêtre fermée, les rappels restent en route (pour arrêter : menu du triangle → Quitter)")
            SettingsWindow.shared.close()
            return .terminateCancel
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        MainActor.assumeIsolated {
            guard Lifecycle.started else { return }
            UserDefaults.standard.set(true, forKey: Lifecycle.cleanExitKey)
            Journal.note("arrêt · \(Lifecycle.reason)")
        }
    }
}

/// Ce qui touche à l'arrêt de l'agent et à ses relances.
@MainActor
enum Lifecycle {
    /// Vrai quand l'arrêt est voulu : menu « Quitter », ou seconde instance qui cède la place.
    static var quitRequested = false
    static var reason = "raison inconnue"
    static var started = false
    private static var observers: [NSObjectProtocol] = []
    nonisolated static let cleanExitKey = "cleanExit.v1"
    nonisolated static let lastAliveKey = "lastAlive.v1"

    /// Envoyée par une seconde instance qui démarre : l'instance en route montre la fenêtre des horaires.
    nonisolated static let showSettings = Notification.Name("io.github.ynsnait-lab.praxis.rappels.ouvrirReglages")
    /// Envoyée par --essai-cmdq : l'instance en route fait exactement ce que fait ⌘Q, pour vérifier qu'elle y résiste.
    nonisolated static let tryCommandQ = Notification.Name("io.github.ynsnait-lab.praxis.rappels.essaiCmdQ")

    static func observeShowSettings() {
        started = true
        noteUncleanExit()
        let center = DistributedNotificationCenter.default()
        observers.append(center.addObserver(forName: showSettings, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                Journal.note("app rouverte alors qu'elle tourne déjà : fenêtre des horaires")
                SettingsWindow.shared.show()
            }
        })
        observers.append(center.addObserver(forName: tryCommandQ, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated {
                Journal.note("essai : même demande d'arrêt que ⌘Q")
                NSApp.terminate(nil)
            }
        })
    }

    /// Si le lancement précédent ne s'est pas terminé proprement (plantage, arrêt forcé), le journal le dit :
    /// un agent qui disparaît sans prévenir, ce sont des rappels qui ne sonnent plus.
    private static func noteUncleanExit() {
        let defaults = UserDefaults.standard
        if defaults.object(forKey: cleanExitKey) != nil, !defaults.bool(forKey: cleanExitKey) {
            let last = (defaults.object(forKey: lastAliveKey) as? Date)?.formatted(date: .abbreviated, time: .shortened) ?? "date inconnue"
            Journal.note("le lancement précédent s'est arrêté sans prévenir (plantage, arrêt forcé ou extinction brutale) · vu en route pour la dernière fois : \(last)")
        }
        defaults.set(false, forKey: cleanExitKey)
        defaults.set(Date.now, forKey: lastAliveKey)
    }

    /// Appelé régulièrement par la minuterie : date à laquelle l'agent tournait encore.
    static func heartbeat(_ now: Date) {
        let defaults = UserDefaults.standard
        if let last = defaults.object(forKey: lastAliveKey) as? Date, now.timeIntervalSince(last) < 300 { return }
        defaults.set(now, forKey: lastAliveKey)
    }

    static func quit() {
        quitRequested = true
        reason = "menu « Quitter »"
        NSApp.terminate(nil)
    }
}

@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()

    let store = ReminderStore()
    let log = PracticeLog()
    let panel = AlertPanelController()
    let scheduler: Scheduler

    private init() {
        scheduler = Scheduler(store: store, log: log, panel: panel)
    }

    func start() { scheduler.start() }
}

// MARK: - Ouverture au démarrage du Mac

@MainActor
final class LoginItem: ObservableObject {
    @Published var enabled = SMAppService.mainApp.status == .enabled

    /// Un vrai .app (pas `swift run`) s'inscrit tout seul la première fois : un rappel ne sert que s'il tourne.
    static func registerOnFirstLaunch() {
        let key = "loginItemDecided.v1"
        guard Bundle.main.bundleIdentifier != nil, Bundle.main.bundleURL.pathExtension == "app",
              !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        do {
            try SMAppService.mainApp.register()
        } catch {
            NSLog("Praxis Rappels : ouverture au démarrage impossible (\(error.localizedDescription))")
        }
    }

    func set(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            NSLog("Praxis Rappels : ouverture au démarrage impossible (\(error.localizedDescription))")
        }
        enabled = SMAppService.mainApp.status == .enabled
    }
}

// MARK: - Menu

/// L'état du jour d'un coup d'œil : triangle vide (séance à faire), coche (séance faite), triangle plein
/// (alerte en cours ou reportée), lune (rappels suspendus).
private struct MenuBarIcon: View {
    @ObservedObject var scheduler: Scheduler
    @ObservedObject var log: PracticeLog
    @ObservedObject var store: ReminderStore

    var body: some View {
        switch scheduler.status {
        case .alert: Image(systemName: "exclamationmark.triangle.fill")
        case .paused: Image(systemName: "moon.zzz")
        case .done: Image(systemName: "checkmark.circle")
        case .idle: Image(systemName: "triangle")
        }
    }
}

private struct MenuContent: View {
    @EnvironmentObject private var store: ReminderStore
    @EnvironmentObject private var log: PracticeLog
    @EnvironmentObject private var scheduler: Scheduler

    var body: some View {
        if let until = store.pausedUntil, store.isPaused {
            Text("Rappels suspendus jusqu'à \(until.formatted(.dateTime.weekday(.wide).day().month().hour().minute()))")
        } else if let next = store.nextFire() {
            Text("Prochain : \(next.date.formatted(.dateTime.weekday(.abbreviated).hour().minute())) · \(next.reminder.label)")
        } else {
            Text("Aucun rappel actif")
        }
        Text(log.practicedToday ? "Séance du jour faite · série \(scheduler.streak) j" : "Pas encore pratiqué aujourd'hui · série \(scheduler.streak) j")
        Text("Cette semaine : \(log.sessionsThisWeek)/\(store.weeklyGoal) séances")

        Divider()

        Button("Séance du jour · \(scheduler.plan.minutes) min") { scheduler.launchFromMenu(express: false) }
        if let express = scheduler.plan.express {
            Button("Séance express · \(express.minutes) min") { scheduler.launchFromMenu(express: true) }
        }
        Button("J'ai pratiqué aujourd'hui") { log.recordSession() }
            .disabled(log.practicedToday)

        Divider()

        Section("Rappels") {
            ForEach(store.reminders.filter(\.isEnabled)) { r in
                Text("\(r.timeString) · \(r.daysString) · \(r.label) (N\(r.startLevel.rawValue)\(r.ceiling > r.startLevel ? "→N\(r.ceiling.rawValue)" : ""))")
            }
            if !store.reminders.contains(where: \.isEnabled) { Text("Aucun rappel actif") }
            Button("Changer les horaires…") { SettingsWindow.shared.show() }
                .keyboardShortcut(",")
        }

        if store.isPaused {
            Button("Reprendre les rappels") { scheduler.resume() }
        } else {
            Menu("Suspendre les rappels") {
                Button("Jusqu'à demain") { scheduler.pause(days: 1) }
                Button("3 jours") { scheduler.pause(days: 3) }
                Button("Une semaine") { scheduler.pause(days: 7) }
            }
        }
        Menu("Tester l'alerte") {
            ForEach(AlertLevel.allCases) { level in
                Button("N\(level.rawValue) · \(level.title)") { scheduler.test(level: level) }
            }
        }

        Divider()

        Button("Journal des rappels") { NSWorkspace.shared.open(Journal.url) }
        Button("Quitter Praxis Rappels") { Lifecycle.quit() }
    }
}

// MARK: - Réglages

/// Fenêtre des horaires et réglages, ouverte au premier plan même si une autre app est active
/// (la fenêtre Réglages standard de SwiftUI s'ouvre souvent derrière, pour un agent sans icône dans le Dock).
@MainActor
final class SettingsWindow: NSObject, NSWindowDelegate {
    static let shared = SettingsWindow()
    private var window: NSWindow?

    func show() {
        if window == nil {
            let model = AppModel.shared
            let view = SettingsView()
                .environmentObject(model.store)
                .environmentObject(model.log)
            let w = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 680, height: 720),
                             styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            w.title = "Praxis Rappels · horaires et réglages"
            w.contentView = NSHostingView(rootView: view)
            w.isReleasedWhenClosed = false
            w.delegate = self
            w.center()
            w.setFrameAutosaveName("PraxisRappelsReglages")
            window = w
        }
        NSApp.activate()
        window?.makeKeyAndOrderFront(nil)
        window?.orderFrontRegardless()
    }

    func close() { window?.close() }
}

struct SettingsView: View {
    @EnvironmentObject private var store: ReminderStore
    @EnvironmentObject private var log: PracticeLog
    @StateObject private var login = LoginItem()

    var body: some View {
        Form {
            Section {
                ForEach($store.reminders) { $reminder in
                    ReminderRow(reminder: $reminder) {
                        let id = reminder.id
                        // Supprimer après le passage de SwiftUI : retirer l'élément pendant que sa ligne se dessine plante.
                        DispatchQueue.main.async { store.reminders.removeAll { $0.id == id } }
                    }
                }
                Button {
                    store.reminders.append(Reminder(hour: 21, minute: 0, weekdays: Set(1...7),
                                                    label: "Nouveau rappel", startLevel: .alerte))
                } label: {
                    Label("Ajouter un rappel", systemImage: "plus")
                }
            } header: {
                Text("Horaires")
            } footer: {
                Text("Clique sur l'heure pour la changer, et sur les lettres pour choisir les jours. N1 : une bannière discrète, sans bloquer. N2 : l'écran se floute. N3 : urgence rouge, sans report. « Départ » est le premier niveau, « Au plus » le niveau à ne jamais dépasser : mets N1 aux deux pour un rappel qui ne bloque jamais l'écran.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Règles") {
                Picker("Fenêtre avant escalade", selection: $store.rules.escalationMinutes) {
                    ForEach([5, 10, 15, 30], id: \.self) { Text("\($0) min").tag($0) }
                }
                Picker("Durée d'un report", selection: $store.rules.snoozeMinutes) {
                    ForEach([5, 10, 15], id: \.self) { Text("\($0) min").tag($0) }
                }
                Stepper("Reports autorisés : \(store.rules.maxSnoozes)", value: $store.rules.maxSnoozes, in: 0...3)
                Toggle("Silence si la séance du jour est déjà faite", isOn: $store.rules.silenceIfPracticedToday)
                Picker("Plus d'écran bloqué après", selection: $store.rules.calmAfter) {
                    Text("Pas de limite").tag(0)
                    ForEach([21 * 60 + 30, 22 * 60, 22 * 60 + 30, 23 * 60, 23 * 60 + 30], id: \.self) { m in
                        Text(String(format: "%d h %02d", m / 60, m % 60)).tag(m)
                    }
                }
                Picker("Relance si la séance lancée n'est pas terminée", selection: $store.rules.followUpMinutes) {
                    Text("Jamais").tag(0)
                    ForEach([20, 30, 45, 60], id: \.self) { Text("après \($0) min").tag($0) }
                }
                Toggle("Son", isOn: $store.rules.soundEnabled)
                Text("Passé l'heure limite, un rappel en retard n'est plus qu'une bannière qui propose la séance express, et ne monte plus de niveau. La relance est une bannière, une seule fois : « Lancer » ne vaut pas séance.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Praxis") {
                LabeledContent("App", value: PraxisBridge.isInstalled(bundleID: store.rules.praxisBundleID)
                               ? "Praxis.app trouvée" : "Praxis.app introuvable : lance ./praxis launcher")
                Toggle("Compter « Lancer Praxis » comme une séance", isOn: $store.rules.countLaunchAsSession)
                Text("Inutile avec Praxis.app : elle signale elle-même chaque séance terminée.")
                    .font(.caption).foregroundStyle(.secondary)
            }

            Section("Système") {
                Toggle("Ouvrir au démarrage du Mac", isOn: Binding(get: { login.enabled }, set: { login.set($0) }))
            }

            Section("Journal") {
                LabeledContent("Séances terminées d'affilée", value: "\(log.streak) jours")
                LabeledContent("Séances cette semaine", value: "\(log.sessionsThisWeek) / \(store.weeklyGoal)")
                ForEach(Array(log.skips.suffix(5).reversed()), id: \.self) { skip in
                    LabeledContent(skip.date.formatted(date: .abbreviated, time: .shortened), value: skip.reason)
                }
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 640, minHeight: 640)
        .onAppear { NSApp.activate() }
    }
}

private struct ReminderRow: View {
    @Binding var reminder: Reminder
    let onDelete: () -> Void

    private var time: Binding<Date> {
        Binding {
            Calendar.current.date(bySettingHour: reminder.hour, minute: reminder.minute, second: 0, of: .now) ?? .now
        } set: { date in
            let c = Calendar.current.dateComponents([.hour, .minute], from: date)
            reminder.hour = c.hour ?? reminder.hour
            reminder.minute = c.minute ?? reminder.minute
        }
    }

    /// « Au plus » : jamais sous le niveau de départ.
    private var ceiling: Binding<AlertLevel> {
        Binding {
            reminder.ceiling
        } set: { level in
            reminder.maxLevel = level
            if reminder.startLevel > level { reminder.startLevel = level }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                DatePicker("", selection: time, displayedComponents: .hourAndMinute)
                    .labelsHidden()
                TextField("Nom", text: $reminder.label)
                Toggle("", isOn: $reminder.isEnabled).labelsHidden().toggleStyle(.switch)
                Button(role: .destructive, action: onDelete) { Image(systemName: "trash") }
                    .buttonStyle(.borderless)
            }
            HStack(spacing: 4) {
                ForEach(weekdayDisplayOrder, id: \.weekday) { day in
                    let on = reminder.weekdays.contains(day.weekday)
                    Button(day.letter) {
                        if on { reminder.weekdays.remove(day.weekday) } else { reminder.weekdays.insert(day.weekday) }
                    }
                    .buttonStyle(.borderless)
                    .frame(width: 26, height: 26)
                    .background(RoundedRectangle(cornerRadius: 6).fill(on ? Color.primary : Color.clear))
                    .foregroundStyle(on ? Color(nsColor: .windowBackgroundColor) : Color.secondary)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.4)))
                }
                Spacer()
                Picker("Départ", selection: $reminder.startLevel) {
                    ForEach(AlertLevel.allCases) { Text("N\($0.rawValue) · \($0.title)").tag($0) }
                }
                .fixedSize()
                Picker("Au plus", selection: ceiling) {
                    ForEach(AlertLevel.allCases) { Text("N\($0.rawValue)").tag($0) }
                }
                .fixedSize()
            }
        }
        .opacity(reminder.isEnabled ? 1 : 0.5)
        .padding(.vertical, 4)
    }
}
