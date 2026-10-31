import AppKit
import SwiftUI

/// Panneau sans bordure capable de recevoir le clavier (Entrée / Échap).
final class KeyPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

/// Affiche l'alerte par-dessus tout : autres apps, Spaces, plein écran.
@MainActor
final class AlertPanelController {
    private var panel: KeyPanel?
    /// Incrémenté à chaque affichage, pour qu'un masquage en retard ne ferme pas une alerte plus récente.
    private var generation = 0

    func show(_ model: AlertViewModel) {
        generation += 1
        let screen = Self.activeScreen()
        let panel = self.panel ?? Self.makePanel()

        let frame: NSRect
        if model.level == .signal {
            let size = NSSize(width: 420, height: 180)
            let visible = screen.visibleFrame
            frame = NSRect(x: visible.maxX - size.width - 8, y: visible.maxY - size.height - 8,
                           width: size.width, height: size.height)
            panel.level = .statusBar
        } else {
            frame = screen.frame
            panel.level = .screenSaver
        }

        panel.contentView = NSHostingView(rootView: AlertRootView(model: model))
        panel.setFrame(frame, display: true)
        if !panel.isVisible { panel.alphaValue = 0 }
        panel.orderFrontRegardless()

        if model.level >= .alerte {
            NSApp.activate()
            panel.makeKey()
        }

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.25
            panel.animator().alphaValue = 1
        }
        self.panel = panel
    }

    func hide(after delay: TimeInterval = 0) {
        guard let panel else { return }
        let gen = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.generation == gen else { return }
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.35
                panel.animator().alphaValue = 0
            }, completionHandler: {
                MainActor.assumeIsolated {
                    guard self.generation == gen else { return }
                    panel.orderOut(nil)
                    panel.contentView = nil
                }
            })
        }
    }

    private static func makePanel() -> KeyPanel {
        let panel = KeyPanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel],
                             backing: .buffered, defer: false)
        panel.appearance = NSAppearance(named: .darkAqua)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isMovable = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        return panel
    }

    /// L'écran où se trouve la souris : c'est celui que l'utilisateur regarde.
    private static func activeScreen() -> NSScreen {
        let mouse = NSEvent.mouseLocation
        return NSScreen.screens.first { NSMouseInRect(mouse, $0.frame, false) }
            ?? NSScreen.main
            ?? NSScreen.screens[0]
    }
}
