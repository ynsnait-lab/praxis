import AppKit
import ServiceManagement
import SwiftUI

// Praxis Rappels : un agent de barre des menus (pas d'icône dans le Dock) qui rappelle de pratiquer sur Praxis
// aux horaires choisis, avec une alerte qui monte en intensité si on l'ignore.
//
// Options de lancement (pour essayer) :
//   --tester 1|2|3        affiche tout de suite une alerte de ce niveau
//   --apercu <dossier>    dessine les alertes en PNG dans ce dossier, puis quitte (aucune fenêtre)

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
            MenuBarIcon(scheduler: model.scheduler)
        }

        Settings {
            SettingsView()
                .environmentObject(model.store)
                .environmentObject(model.log)
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
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Agent de barre des menus : pas d'icône dans le Dock.
        NSApp.setActivationPolicy(.accessory)
        MainActor.assumeIsolated {
            AppModel.shared.start()
            LoginItem.registerOnFirstLaunch()
            let args = CommandLine.arguments
            if let i = args.firstIndex(of: "--tester"), i + 1 < args.count,
               let n = Int(args[i + 1]), let level = AlertLevel(rawValue: n) {
                AppModel.shared.scheduler.test(level: level)
            }
        }
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

/// Triangle vide au repos, plein quand une alerte est en cours ou reportée.
private struct MenuBarIcon: View {
    @ObservedObject var scheduler: Scheduler

    var body: some View {
        Image(systemName: scheduler.active == nil ? "triangle" : "exclamationmark.triangle.fill")
    }
}

private struct MenuContent: View {
    @EnvironmentObject private var store: ReminderStore
    @EnvironmentObject private var log: PracticeLog
    @EnvironmentObject private var scheduler: Scheduler

    var body: some View {
        if let next = store.nextFire() {
            Text("Prochain : \(next.date.formatted(.dateTime.weekday(.abbreviated).hour().minute())) · \(next.reminder.label)")
        } else {
            Text("Aucun rappel actif")
        }
        Text(log.practicedToday ? "Séance du jour faite · série \(log.streak) j" : "Pas encore pratiqué aujourd'hui")
        Text("Au programme : \(scheduler.plan.title) (\(scheduler.plan.minutes) min)")

        Divider()

        Button("Ouvrir Praxis sur la séance") { PraxisBridge.launch(bundleID: store.rules.praxisBundleID) }
        Menu("Tester l'alerte") {
            ForEach(AlertLevel.allCases) { level in
                Button("N\(level.rawValue) · \(level.title)") { scheduler.test(level: level) }
            }
        }
        Button("J'ai pratiqué aujourd'hui") { log.recordSession() }
            .disabled(log.practicedToday)

        Divider()

        SettingsLink { Text("Réglages…") }
            .keyboardShortcut(",")
        Button("Quitter Praxis Rappels") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}

// MARK: - Réglages

struct SettingsView: View {
    @EnvironmentObject private var store: ReminderStore
    @EnvironmentObject private var log: PracticeLog
    @StateObject private var login = LoginItem()

    var body: some View {
        Form {
            Section("Horaires") {
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
                Toggle("Son", isOn: $store.rules.soundEnabled)
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
                LabeledContent("Série en cours", value: "\(log.streak) jours")
                LabeledContent("Séances cette semaine", value: "\(log.sessionsThisWeek) / \(store.weeklyGoal)")
                ForEach(Array(log.skips.suffix(5).reversed()), id: \.self) { skip in
                    LabeledContent(skip.date.formatted(date: .abbreviated, time: .shortened), value: skip.reason)
                }
            }
        }
        .formStyle(.grouped)
        .frame(minWidth: 560, minHeight: 640)
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
            }
        }
        .opacity(reminder.isEnabled ? 1 : 0.5)
        .padding(.vertical, 4)
    }
}
