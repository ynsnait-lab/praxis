import AppKit
import SwiftUI

// MARK: - Modèle de vue

@MainActor
final class AlertViewModel: ObservableObject {
    enum Phase { case prompt, confirmSkip, launched }

    let reminder: Reminder
    let level: AlertLevel
    let session: PraxisPlan
    let streak: Int
    let week: [DayState]
    let sessionsThisWeek: Int
    let weeklyGoal: Int
    let lastSession: Date?
    let snoozesLeft: Int
    let snoozeMinutes: Int
    let escalationWindow: TimeInterval
    let deadline: Date

    @Published var phase: Phase = .prompt
    @Published var skipReason = ""

    var onLaunch: () -> Void = {}
    var onSnooze: () -> Void = {}
    var onSkip: (String) -> Void = { _ in }

    init(reminder: Reminder, level: AlertLevel, session: PraxisPlan, streak: Int,
         week: [DayState], sessionsThisWeek: Int, weeklyGoal: Int, lastSession: Date?, snoozesLeft: Int,
         snoozeMinutes: Int, escalationWindow: TimeInterval) {
        self.reminder = reminder
        self.level = level
        self.session = session
        self.streak = streak
        self.week = week
        self.sessionsThisWeek = sessionsThisWeek
        self.weeklyGoal = weeklyGoal
        self.lastSession = lastSession
        self.snoozesLeft = snoozesLeft
        self.snoozeMinutes = snoozeMinutes
        self.escalationWindow = escalationWindow
        self.deadline = Date.now.addingTimeInterval(escalationWindow)
    }

    var accent: Color { level == .urgence ? .pxRed : .pxAmber }
    var canSnooze: Bool { level < .urgence && snoozesLeft > 0 }

    func launch() {
        phase = .launched
        onLaunch()
    }
}

/// Petit état d'animation (« apparu », « affiché »). Remplace `@State`, qui est devenu une macro dans le SDK
/// de macOS 27 et ne compile pas avec les seuls outils en ligne de commande de Xcode.
final class Flag: ObservableObject {
    @Published var on: Bool
    init(_ on: Bool = false) { self.on = on }
}

/// Vrai pendant le rendu des aperçus (--apercu) : pas d'animation d'entrée, et un fond uni à la place du flou.
nonisolated(unsafe) var renderingSnapshot = false

// MARK: - Palette (identique à la maquette HTML : launcher/macos/rappels/maquette.html)

extension Color {
    static let pxAmber = Color(red: 1.00, green: 0.71, blue: 0.28)
    static let pxAmberDeep = Color(red: 0.72, green: 0.46, blue: 0.06)
    static let pxRed = Color(red: 1.00, green: 0.29, blue: 0.23)
    static let pxOK = Color(red: 0.31, green: 0.82, blue: 0.55)
    static let pxInk = Color(red: 0.10, green: 0.07, blue: 0.02)
    static let pxCard = Color(red: 0.08, green: 0.10, blue: 0.13)
    static let pxCell = Color(red: 0.08, green: 0.10, blue: 0.13)
    static let pxLine = Color(red: 0.17, green: 0.22, blue: 0.27)
    static let pxText = Color(red: 0.91, green: 0.92, blue: 0.94)
    static let pxMuted = Color(red: 0.55, green: 0.59, blue: 0.65)
}

// MARK: - Racine

struct AlertRootView: View {
    @ObservedObject var model: AlertViewModel

    var body: some View {
        Group {
            if model.level == .signal {
                BannerView(model: model).padding(10)
            } else {
                FullScreenAlertView(model: model)
            }
        }
        .environment(\.colorScheme, .dark)
        .foregroundStyle(Color.pxText)
    }
}

// MARK: - Niveau 1 : bannière

private struct BannerView: View {
    @ObservedObject var model: AlertViewModel
    @StateObject private var appeared = Flag(renderingSnapshot)

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 9).fill(Color.pxAmber)
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 18, weight: .bold)).foregroundStyle(Color.pxInk)
                }
                .frame(width: 38, height: 38)
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text("Praxis").font(.system(size: 13, weight: .semibold))
                        Spacer()
                        Text("maintenant").font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Text("**\(model.reminder.label)** · \(model.reminder.timeString). \(model.session.title), \(model.session.minutes) min.")
                        .font(.system(size: 13)).foregroundStyle(Color.pxText.opacity(0.85))
                        .lineLimit(2)
                }
            }
            HStack(spacing: 8) {
                Button("Lancer") { model.launch() }
                    .buttonStyle(PxButtonStyle(kind: .primary, accent: .pxAmber, compact: true))
                    .keyboardShortcut(.defaultAction)
                Button("Dans \(model.snoozeMinutes) min") { model.onSnooze() }
                    .buttonStyle(PxButtonStyle(kind: .secondary, accent: .pxAmber, compact: true))
                    .disabled(!model.canSnooze)
            }
        }
        .padding(14)
        .background(Blur(material: .hudWindow))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(.white.opacity(0.1)))
        .offset(x: appeared.on ? 0 : 40)
        .opacity(appeared.on ? 1 : 0)
        .onAppear {
            if renderingSnapshot { appeared.on = true; return }
            withAnimation(.spring(response: 0.5, dampingFraction: 0.75)) { appeared.on = true }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
    }
}

// MARK: - Niveaux 2 et 3 : plein écran

private struct FullScreenAlertView: View {
    @ObservedObject var model: AlertViewModel
    @StateObject private var appeared = Flag(renderingSnapshot)

    var body: some View {
        ZStack {
            Blur(material: .fullScreenUI)
            (model.level == .urgence ? Color(red: 0.08, green: 0.02, blue: 0.02).opacity(0.62)
                                     : Color.black.opacity(0.40))
            if model.level == .urgence { RedVignette() }

            VStack(spacing: 0) {
                HazardStripes(color: model.accent, height: model.level == .urgence ? 20 : 14)
                    .scaleEffect(x: appeared.on ? 1 : 0, anchor: .leading)
                Spacer()
                HazardStripes(color: model.accent, height: model.level == .urgence ? 20 : 14)
                    .scaleEffect(x: appeared.on ? 1 : 0, anchor: .trailing)
            }

            AlertCard(model: model)
                .scaleEffect(appeared.on ? 1 : 0.94)
                .offset(y: appeared.on ? 0 : 28)
                .opacity(appeared.on ? 1 : 0)
        }
        .ignoresSafeArea()
        .onAppear {
            if renderingSnapshot { appeared.on = true; return }
            withAnimation(.spring(response: 0.6, dampingFraction: 0.72).delay(0.1)) { appeared.on = true }
        }
    }
}

private struct AlertCard: View {
    @ObservedObject var model: AlertViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            switch model.phase {
            case .launched:
                LaunchedView(streak: model.streak + 1, minutes: model.session.minutes)
            case .prompt, .confirmSkip:
                header
                sessionBox
                stats
                countdown
                if model.phase == .prompt { actions } else { confirmSkip }
            }
        }
        .padding(.horizontal, 30).padding(.top, 28).padding(.bottom, 24)
        .frame(width: model.level == .urgence ? 680 : 600)
        .background(
            LinearGradient(colors: [Color(red: 0.09, green: 0.12, blue: 0.15), Color(red: 0.07, green: 0.09, blue: 0.11)],
                           startPoint: .top, endPoint: .bottom)
        )
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(model.accent.opacity(model.level == .urgence ? 0.45 : 0.25), lineWidth: 1))
        .shadow(color: model.accent.opacity(0.28), radius: 50)
        .shadow(color: .black.opacity(0.7), radius: 60, y: 30)
        .animation(.spring(response: 0.45, dampingFraction: 0.8), value: model.phase)
    }

    private var header: some View {
        HStack(spacing: 20) {
            PulsingLamp(color: model.accent, fast: model.level == .urgence)
            VStack(alignment: .leading, spacing: 6) {
                Text("PRAXIS · \(model.reminder.timeString) · \(model.level == .urgence ? "DERNIER RAPPEL" : model.reminder.label.uppercased())")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .tracking(1.4)
                    .foregroundStyle(model.accent)
                Text(model.level == .urgence ? "MAINTENANT.\nPAS PLUS TARD." : "C'EST L'HEURE\nDE PRATIQUER.")
                    .font(.system(size: 46, weight: .heavy))
                    .fontWidth(.condensed)
                    .lineSpacing(-6)
                    .foregroundStyle(Color.pxText)
            }
        }
    }

    private var sessionBox: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("SÉANCE DU JOUR")
                    .font(.system(size: 11, design: .monospaced)).tracking(1.2)
                    .foregroundStyle(Color.pxMuted)
                Text(model.session.title).font(.system(size: 20, weight: .semibold))
                Text(model.session.subtitle).font(.system(size: 14)).foregroundStyle(Color.pxText.opacity(0.75))
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(model.session.minutes)").font(.system(size: 26, weight: .medium, design: .monospaced))
                Text("MIN").font(.system(size: 11, design: .monospaced)).foregroundStyle(Color.pxMuted)
            }
        }
        .padding(.vertical, 16).padding(.horizontal, 18)
        .background(Color.white.opacity(0.03))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.pxLine))
    }

    private var stats: some View {
        HStack(spacing: 1) {
            StatCell(value: "\(model.streak) j", label: "Série en cours", highlight: true) {
                WeekStrip(week: model.week).padding(.top, 6)
            }
            StatCell(value: "\(model.sessionsThisWeek)/\(model.weeklyGoal)", label: "Séances cette semaine")
            StatCell(value: model.lastSession.map { $0.formatted(date: .omitted, time: .shortened) } ?? "—",
                     label: lastSessionLabel)
        }
        .fixedSize(horizontal: false, vertical: true)
        .background(Color.pxLine)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.pxLine))
    }

    private var lastSessionLabel: String {
        guard let last = model.lastSession else { return "Aucune séance" }
        if Calendar.current.isDateInToday(last) { return "Dernière séance, aujourd'hui" }
        if Calendar.current.isDateInYesterday(last) { return "Dernière séance, hier" }
        return "Dernière séance, " + last.formatted(.dateTime.weekday(.wide))
    }

    private var countdown: some View {
        TimelineView(.periodic(from: .now, by: 1)) { ctx in
            let left = max(0, model.deadline.timeIntervalSince(ctx.date))
            VStack(spacing: 7) {
                HStack {
                    Text(model.level == .urgence ? "Série perdue dans" : "Escalade au niveau \(model.level.rawValue + 1) dans")
                        .font(.system(size: 13)).foregroundStyle(Color.pxMuted)
                    Spacer()
                    Text(String(format: "%d:%02d", Int(left) / 60, Int(left) % 60))
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .monospacedDigit()
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.pxLine.opacity(0.7))
                        Capsule().fill(model.accent)
                            .frame(width: geo.size.width * left / max(model.escalationWindow, 1))
                            .animation(.linear(duration: 1), value: left)
                    }
                }
                .frame(height: 6)
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button { model.launch() } label: {
                HStack(spacing: 10) {
                    Text("Lancer Praxis")
                    Text("⏎").font(.system(size: 12, design: .monospaced))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.black.opacity(0.14)).clipShape(RoundedRectangle(cornerRadius: 5))
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(PxButtonStyle(kind: .primary, accent: model.accent))
            .keyboardShortcut(.defaultAction)

            Button(snoozeTitle) { model.onSnooze() }
                .buttonStyle(PxButtonStyle(kind: .secondary, accent: model.accent))
                .keyboardShortcut(.cancelAction)
                .disabled(!model.canSnooze)

            Button("Pas aujourd'hui") { model.phase = .confirmSkip }
                .buttonStyle(PxButtonStyle(kind: .link, accent: model.accent))
        }
    }

    private var snoozeTitle: String {
        if model.level == .urgence { return "Report impossible" }
        let s = model.snoozesLeft > 1 ? "s" : ""
        return "Dans \(model.snoozeMinutes) min · \(model.snoozesLeft) restant\(s)"
    }

    private var confirmSkip: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Ta série de \(model.streak) jours repartira à zéro. Écris pourquoi, pour t'en souvenir dimanche.")
                .font(.system(size: 14))
            TextField("Ex. : réunion tardive, retour à 23 h", text: $model.skipReason)
                .textFieldStyle(.roundedBorder)
            HStack {
                Button("Confirmer, pas aujourd'hui") { model.onSkip(model.skipReason) }
                    .buttonStyle(PxButtonStyle(kind: .danger, accent: .pxRed, compact: true))
                    .disabled(model.skipReason.trimmingCharacters(in: .whitespaces).count < 6)
                Button("Retour") { model.phase = .prompt; model.skipReason = "" }
                    .buttonStyle(PxButtonStyle(kind: .link, accent: model.accent))
                    .keyboardShortcut(.cancelAction)
            }
        }
        .padding(14)
        .background(Color.pxRed.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.pxRed.opacity(0.4)))
    }
}

// MARK: - Composants

private struct StatCell<Extra: View>: View {
    let value: String
    let label: String
    var highlight = false
    @ViewBuilder var extra: Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.system(size: 22, weight: .semibold, design: .monospaced))
                .foregroundStyle(highlight ? Color.pxAmber : Color.pxText)
            Text(label).font(.system(size: 12)).foregroundStyle(Color.pxMuted)
            extra
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(.vertical, 12).padding(.horizontal, 14)
        .background(Color.pxCell)
    }
}

extension StatCell where Extra == EmptyView {
    init(value: String, label: String, highlight: Bool = false) {
        self.init(value: value, label: label, highlight: highlight) { EmptyView() }
    }
}

private struct WeekStrip: View {
    let week: [DayState]

    var body: some View {
        HStack(spacing: 5) {
            ForEach(Array(week.enumerated()), id: \.offset) { index, state in
                Text(weekdayDisplayOrder[index].letter)
                    .font(.system(size: 10, design: .monospaced))
                    .frame(width: 18, height: 18)
                    .foregroundStyle(foreground(state))
                    .background(RoundedRectangle(cornerRadius: 5).fill(fill(state)))
                    .overlay(RoundedRectangle(cornerRadius: 5)
                        .stroke(state == .today ? Color.pxAmber : .clear, lineWidth: 1.5))
                    .modifier(Blink(active: state == .today))
            }
        }
    }

    private func fill(_ s: DayState) -> Color {
        switch s {
        case .done: .pxOK
        case .missed: .pxRed.opacity(0.25)
        case .today: .clear
        case .upcoming: Color.white.opacity(0.06)
        }
    }

    private func foreground(_ s: DayState) -> Color {
        switch s {
        case .done: Color(red: 0.02, green: 0.13, blue: 0.06)
        case .today: .pxAmber
        default: .pxMuted
        }
    }
}

private struct Blink: ViewModifier {
    let active: Bool
    func body(content: Content) -> some View {
        if active {
            TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
                content.opacity(Int(ctx.date.timeIntervalSinceReferenceDate * 2) % 2 == 0 ? 1 : 0.35)
            }
        } else {
            content
        }
    }
}

/// Lampe d'annonciateur : cœur lumineux + trois ondes qui s'éloignent.
private struct PulsingLamp: View {
    let color: Color
    let fast: Bool

    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            let period = fast ? 1.4 : 2.4
            let glow = (sin(t * (fast ? 12 : 5)) + 1) / 2
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    let p = (t + Double(i) * period / 3).truncatingRemainder(dividingBy: period) / period
                    Circle().stroke(color, lineWidth: 2)
                        .scaleEffect(0.7 + 1.2 * p)
                        .opacity(0.7 * (1 - p))
                }
                Circle()
                    .fill(RadialGradient(colors: [.white.opacity(0.75), color, color.opacity(0.6)],
                                         center: UnitPoint(x: 0.4, y: 0.35), startRadius: 1, endRadius: 30))
                    .frame(width: 52, height: 52)
                    .shadow(color: color.opacity(0.4 + 0.3 * glow), radius: 10 + 14 * glow)
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Color.pxInk)
            }
        }
        .frame(width: 74, height: 74)
    }
}

/// Bandes de danger jaune/noir qui défilent.
private struct HazardStripes: View {
    let color: Color
    let height: CGFloat

    var body: some View {
        TimelineView(.animation) { ctx in
            Canvas { gc, size in
                let period: CGFloat = 32
                let phase = CGFloat(ctx.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.2) / 1.2) * period
                gc.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(white: 0.07)))
                var x = -size.height - period + phase
                while x < size.width + size.height {
                    var p = Path()
                    p.move(to: CGPoint(x: x, y: size.height))
                    p.addLine(to: CGPoint(x: x + period / 2, y: size.height))
                    p.addLine(to: CGPoint(x: x + period / 2 + size.height, y: 0))
                    p.addLine(to: CGPoint(x: x + size.height, y: 0))
                    p.closeSubpath()
                    gc.fill(p, with: .color(color))
                    x += period
                }
            }
        }
        .frame(height: height)
    }
}

private struct RedVignette: View {
    var body: some View {
        TimelineView(.animation) { ctx in
            let breathe = (sin(ctx.date.timeIntervalSinceReferenceDate * 2.6) + 1) / 2
            RadialGradient(colors: [.clear, Color.pxRed.opacity(0.18 + 0.2 * breathe)],
                           center: .center, startRadius: 300, endRadius: 1100)
        }
        .allowsHitTesting(false)
    }
}

private struct LaunchedView: View {
    let streak: Int
    let minutes: Int
    @StateObject private var popped = Flag(renderingSnapshot)

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(Color.pxOK)
                Image(systemName: "checkmark").font(.system(size: 34, weight: .bold))
                    .foregroundStyle(Color(red: 0.02, green: 0.13, blue: 0.06))
            }
            .frame(width: 72, height: 72)
            .scaleEffect(popped.on ? 1 : 0.4)
            .opacity(popped.on ? 1 : 0)
            Text("SÉRIE : \(streak) JOURS")
                .font(.system(size: 40, weight: .heavy)).fontWidth(.condensed)
            Text("Praxis s'ouvre sur ta séance. \(minutes) minutes, concentré.")
                .foregroundStyle(Color.pxMuted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .onAppear {
            if renderingSnapshot { popped.on = true; return }
            withAnimation(.spring(response: 0.45, dampingFraction: 0.55)) { popped.on = true }
        }
    }
}

struct PxButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, link, danger }
    let kind: Kind
    let accent: Color
    var compact = false
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: kind == .primary && !compact ? 17 : (compact ? 13 : 14),
                          weight: kind == .primary ? .semibold : .regular))
            .underline(kind == .link)
            .foregroundStyle(foreground)
            .padding(.vertical, kind == .link ? 6 : (compact ? 7 : 14))
            .padding(.horizontal, kind == .link ? 4 : (compact ? 12 : 16))
            .background(background(pressed: configuration.isPressed))
            .clipShape(RoundedRectangle(cornerRadius: compact ? 8 : 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: compact ? 8 : 12, style: .continuous)
                .stroke(border, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .opacity(isEnabled ? 1 : 0.35)
            .contentShape(Rectangle())
    }

    private var foreground: Color {
        switch kind {
        case .primary: accent == .pxRed ? .white : .pxInk
        case .secondary: .pxText
        case .link: .pxMuted
        case .danger: .pxRed
        }
    }

    private func background(pressed: Bool) -> Color {
        switch kind {
        case .primary: accent.opacity(pressed ? 0.85 : 1)
        case .secondary: Color.white.opacity(pressed ? 0.08 : 0.0)
        case .link, .danger: .clear
        }
    }

    private var border: Color {
        switch kind {
        case .secondary: Color(red: 0.2, green: 0.25, blue: 0.31)
        case .danger: .pxRed
        default: .clear
        }
    }
}

/// Flou du bureau derrière l'alerte ; un fond uni pendant le rendu des aperçus.
struct Blur: View {
    let material: NSVisualEffectView.Material

    var body: some View {
        if renderingSnapshot {
            LinearGradient(colors: [Color(red: 0.16, green: 0.20, blue: 0.24), Color(red: 0.05, green: 0.07, blue: 0.09)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        } else {
            VisualEffectBlur(material: material, blending: .behindWindow)
        }
    }
}

struct VisualEffectBlur: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blending: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blending
        view.state = .active
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {
        view.material = material
        view.blendingMode = blending
    }
}
