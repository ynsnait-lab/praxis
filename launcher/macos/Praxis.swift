// Praxis.app : une vraie fenêtre macOS pour Praxis.
//
// Au lancement, l'app démarre le serveur local du projet (./praxis app --no-open), qui reconstruit
// l'app web seulement si le contenu a changé, puis l'affiche dans une WKWebView. Fermer la fenêtre
// ou quitter (Cmd+Q) arrête le serveur. La progression est gardée par la WKWebView, d'un lancement
// à l'autre (adresse fixe : http://127.0.0.1:47821).
//
// Construite par launcher/macos/build.sh, via ./praxis launcher.
import AppKit
import WebKit

let PORT = 47821
let ADRESSE = URL(string: "http://127.0.0.1:\(PORT)/")!
let CLE_DOSSIER = "dossierPraxis"
let AUTOTEST = ProcessInfo.processInfo.environment["PRAXIS_AUTOTEST"] != nil

// Journal du lanceur (~/Library/Logs/Praxis/lanceur.log, lisible dans l'app Console) : utile si l'app ne démarre pas.
let FICHIER_JOURNAL: URL = {
    let dossier = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/Praxis")
    try? FileManager.default.createDirectory(at: dossier, withIntermediateDirectories: true)
    return dossier.appendingPathComponent("lanceur.log")
}()

func noter(_ texte: String) {
    let ligne = ISO8601DateFormatter().string(from: Date()) + "  " + texte + "\n"
    guard let donnees = ligne.data(using: .utf8) else { return }
    if let h = try? FileHandle(forWritingTo: FICHIER_JOURNAL) {
        h.seekToEndOfFile()
        h.write(donnees)
        try? h.close()
    } else {
        try? donnees.write(to: FICHIER_JOURNAL)
    }
}

@MainActor
final class Lanceur: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var fenetre: NSWindow!
    var vue: WKWebView!
    var serveur: Process?
    var journal = ""
    var pret = false
    var enFermeture = false
    var observationTitre: NSKeyValueObservation?
    var telechargements: [ObjectIdentifier: URL] = [:]

    // MARK: cycle de vie

    func applicationDidFinishLaunching(_ notification: Notification) {
        try? Data().write(to: FICHIER_JOURNAL)                  // un journal par lancement
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        noter("Praxis.app \(version) : lancement")
        construireMenus()
        construireFenetre()
        demarrer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        enFermeture = true
        guard pret else { return .terminateNow }
        // Laisse la page enregistrer la progression (même événement qu'à la fermeture d'un onglet).
        vue.evaluateJavaScript("window.dispatchEvent(new Event('pagehide'))") { [weak self] _, _ in
            self?.autoriserFermeture()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in self?.autoriserFermeture() }
        return .terminateLater
    }

    var fermetureAutorisee = false
    func autoriserFermeture() {
        guard !fermetureAutorisee else { return }
        fermetureAutorisee = true
        NSApp.reply(toApplicationShouldTerminate: true)
    }

    func applicationWillTerminate(_ notification: Notification) {
        enFermeture = true
        serveur?.terminate()
        serveur = nil
    }

    // MARK: dossier du projet et serveur

    func dossierProjet() -> URL? {
        var candidats: [String] = []
        if let d = UserDefaults.standard.string(forKey: CLE_DOSSIER) { candidats.append(d) }
        if let d = Bundle.main.object(forInfoDictionaryKey: "PraxisDossier") as? String, !d.isEmpty { candidats.append(d) }
        for c in candidats where FileManager.default.fileExists(atPath: c + "/praxis") {
            return URL(fileURLWithPath: c)
        }
        return nil
    }

    func python(dans dossier: URL) -> String {
        let possibles = [dossier.path + "/.venv/bin/python", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3"]
        return possibles.first { FileManager.default.isExecutableFile(atPath: $0) } ?? "/usr/bin/python3"
    }

    func demarrer() {
        pret = false
        journal = ""
        afficherChargement("Démarrage…")
        guard let dossier = dossierProjet() else {
            afficherErreur("Je ne trouve pas le dossier Praxis.",
                           details: "Il a peut-être été déplacé ou renommé. Indique-moi où il est.",
                           actions: [("Choisir le dossier…", "choisir-dossier")])
            return
        }
        noter("dossier du projet : \(dossier.path)")
        Task {
            // Un serveur Praxis tourne déjà à cette adresse (une autre instance) : on le réutilise.
            if await serveurRepond() { noter("serveur déjà en marche : réutilisé"); ouvrirApp(); return }
            lancerServeur(dossier)
        }
    }

    func serveurRepond() async -> Bool {
        var requete = URLRequest(url: ADRESSE)
        requete.timeoutInterval = 1
        requete.cachePolicy = .reloadIgnoringLocalCacheData
        guard let (donnees, reponse) = try? await URLSession.shared.data(for: requete),
              (reponse as? HTTPURLResponse)?.statusCode == 200 else { return false }
        return String(decoding: donnees.prefix(8192), as: UTF8.self).contains("Praxis")
    }

    func lancerServeur(_ dossier: URL) {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: python(dans: dossier))
        p.arguments = [dossier.path + "/praxis", "app", "--no-open", "--port", "\(PORT)",
                       "--parent-pid", "\(ProcessInfo.processInfo.processIdentifier)"]
        p.currentDirectoryURL = dossier
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + (env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin")
        env["NO_COLOR"] = "1"
        p.environment = env
        let tube = Pipe()
        p.standardOutput = tube
        p.standardError = tube
        tube.fileHandleForReading.readabilityHandler = { [weak self] h in
            let d = h.availableData
            guard !d.isEmpty else { return }
            let texte = String(decoding: d, as: UTF8.self)
            Task { @MainActor in self?.recevoir(texte) }
        }
        p.terminationHandler = { [weak self] proc in
            let code = proc.terminationStatus
            Task { @MainActor in self?.serveurArrete(code) }
        }
        do {
            try p.run()
        } catch {
            afficherErreur("Impossible de lancer le serveur de Praxis.", details: error.localizedDescription,
                           actions: [("Réessayer", "reessayer"), ("Choisir le dossier…", "choisir-dossier")])
            return
        }
        serveur = p
        noter("serveur lancé : \(p.executableURL?.path ?? "?") \((p.arguments ?? []).joined(separator: " "))")
        Task { await attendreServeur() }
    }

    func attendreServeur() async {
        let debut = Date()
        while Date().timeIntervalSince(debut) < 600 {
            if await serveurRepond() { ouvrirApp(); return }
            if serveur == nil { return }            // arrêté : serveurArrete affiche l'erreur
            try? await Task.sleep(nanoseconds: 300_000_000)
        }
        afficherErreur("Le serveur de Praxis ne répond pas.", details: journal, actions: [("Réessayer", "reessayer")])
    }

    func recevoir(_ texte: String) {
        journal = String((journal + texte).suffix(12_000))
        texte.split(whereSeparator: \.isNewline).forEach { noter("serveur │ \($0)") }
        guard !pret else { return }
        let lignes = texte.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }
        if let derniere = lignes.last(where: { !$0.isEmpty }) {
            let json = (try? String(data: JSONEncoder().encode(String(derniere)), encoding: .utf8)) ?? "\"\""
            vue.evaluateJavaScript("typeof statut === 'function' && statut(\(json))")
        }
    }

    func serveurArrete(_ code: Int32) {
        serveur = nil
        noter("serveur arrêté (code \(code))")
        guard !enFermeture else { return }
        afficherErreur(pret ? "Le serveur de Praxis s'est arrêté." : "Praxis n'a pas pu démarrer.",
                       details: journal.isEmpty ? "code de sortie \(code)" : journal,
                       actions: [("Réessayer", "reessayer"), ("Choisir le dossier…", "choisir-dossier")])
        pret = false
    }

    func ouvrirApp() {
        pret = true
        vue.load(URLRequest(url: ADRESSE))
    }

    // MARK: pages de chargement et d'erreur

    static let style = """
    <meta charset="utf-8"><style>
    :root{color-scheme:light dark;--bg:#EEF1EF;--ink:#121C1B;--muted:#5A6865;--acc:#0E4F4C;--acc-ink:#fff;--mark:#F2C230;--code:rgba(18,28,27,.06)}
    @media (prefers-color-scheme:dark){:root{--bg:#0C1312;--ink:#E6ECEA;--muted:#8FA09C;--acc:#5CC9BF;--acc-ink:#062120;--code:rgba(230,236,234,.07)}}
    html,body{height:100%;margin:0;background:var(--bg);color:var(--ink);font:15px -apple-system,system-ui,sans-serif}
    .c{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px 20px;box-sizing:border-box;text-align:center}
    .l{width:20px;height:20px;background:var(--mark);border-radius:4px;animation:p 1.2s ease-in-out infinite}
    @keyframes p{0%,100%{transform:rotate(45deg) scale(.72);opacity:.55}50%{transform:rotate(225deg) scale(1);opacity:1}}
    .t{font-weight:600;font-size:17px}.s{color:var(--muted);font:12px ui-monospace,Menlo,monospace;max-width:560px}
    pre{max-width:760px;width:100%;max-height:45vh;overflow:auto;text-align:left;background:var(--code);padding:12px 14px;border-radius:10px;
        font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;box-sizing:border-box;margin:0}
    a.b{display:inline-block;margin:0 4px;padding:8px 16px;border-radius:8px;background:var(--acc);color:var(--acc-ink);text-decoration:none;font-weight:600}
    </style>
    """

    func afficherChargement(_ statut: String) {
        let html = Lanceur.style + """
        <div class="c"><div class="l"></div><div class="t">Praxis se prépare…</div><div class="s" id="s">\(echapper(statut))</div></div>
        <script>function statut(t){document.getElementById('s').textContent=t}</script>
        """
        vue.loadHTMLString(html, baseURL: nil)
    }

    func afficherErreur(_ titre: String, details: String, actions: [(String, String)] = []) {
        noter("erreur affichée : \(titre)")
        let boutons = actions.map { "<a class=\"b\" href=\"praxis-action://\($0.1)\">\(echapper($0.0))</a>" }.joined()
        let html = Lanceur.style + """
        <div class="c"><div class="t">\(echapper(titre))</div><pre>\(echapper(details))</pre><div>\(boutons)</div></div>
        """
        vue.loadHTMLString(html, baseURL: nil)
    }

    func echapper(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
    }

    // MARK: fenêtre

    func construireFenetre() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.javaScriptCanOpenWindowsAutomatically = false
        vue = WKWebView(frame: .zero, configuration: config)
        vue.navigationDelegate = self
        vue.uiDelegate = self
        vue.allowsBackForwardNavigationGestures = true
        vue.allowsMagnification = true
        if #available(macOS 13.3, *) { vue.isInspectable = true }
        let fond = NSColor(name: nil) { apparence in
            apparence.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
                ? NSColor(srgbRed: 0.047, green: 0.075, blue: 0.071, alpha: 1)
                : NSColor(srgbRed: 0.933, green: 0.945, blue: 0.937, alpha: 1)
        }
        vue.underPageBackgroundColor = fond
        fenetre = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
                           styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        fenetre.title = "Praxis"
        fenetre.minSize = NSSize(width: 380, height: 520)
        fenetre.backgroundColor = fond
        fenetre.contentView = vue
        fenetre.isReleasedWhenClosed = false
        fenetre.delegate = self
        fenetre.center()
        fenetre.setFrameAutosaveName("PraxisFenetre")
        fenetre.makeKeyAndOrderFront(nil)
        observationTitre = vue.observe(\.title, options: [.new]) { [weak self] v, _ in
            let titre = v.title ?? ""
            Task { @MainActor in self?.fenetre.title = titre.isEmpty ? "Praxis" : titre }
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: menus

    func element(_ titre: String, _ action: Selector?, _ touche: String = "", _ mods: NSEvent.ModifierFlags = [.command]) -> NSMenuItem {
        let i = NSMenuItem(title: titre, action: action, keyEquivalent: touche)
        i.keyEquivalentModifierMask = mods
        return i
    }

    func sousMenu(_ titre: String, _ elements: [NSMenuItem]) -> NSMenuItem {
        let porteur = NSMenuItem()
        let menu = NSMenu(title: titre)
        elements.forEach { menu.addItem($0) }
        porteur.submenu = menu
        return porteur
    }

    func construireMenus() {
        let principal = NSMenu()
        principal.addItem(sousMenu("Praxis", [
            element("À propos de Praxis", #selector(NSApplication.orderFrontStandardAboutPanel(_:))),
            .separator(),
            element("Ouvrir dans le navigateur", #selector(ouvrirDansNavigateur), "b", [.command, .shift]),
            element("Afficher le dossier du projet", #selector(afficherDossier)),
            element("Choisir le dossier du projet…", #selector(choisirDossierMenu)),
            .separator(),
            element("Masquer Praxis", #selector(NSApplication.hide(_:)), "h"),
            element("Masquer les autres", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]),
            element("Tout afficher", #selector(NSApplication.unhideAllApplications(_:))),
            .separator(),
            element("Quitter Praxis", #selector(NSApplication.terminate(_:)), "q"),
        ]))
        principal.addItem(sousMenu("Édition", [
            element("Annuler", Selector(("undo:")), "z"),
            element("Rétablir", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            element("Couper", #selector(NSText.cut(_:)), "x"),
            element("Copier", #selector(NSText.copy(_:)), "c"),
            element("Coller", #selector(NSText.paste(_:)), "v"),
            element("Tout sélectionner", #selector(NSText.selectAll(_:)), "a"),
        ]))
        let routes: [(String, String, String)] = [
            ("Aujourd'hui", "", "1"), ("Parcours", "parcours", "2"), ("Pièges", "pieges", "3"), ("Labs", "labs", "4"),
            ("Fiches", "fiches", "5"), ("Progression", "stats", "6"), ("Séance du jour", "session", "j"), ("Réglages", "reglages", ","),
        ]
        principal.addItem(sousMenu("Aller", routes.map { titre, route, touche in
            let i = element(titre, #selector(aller(_:)), touche)
            i.representedObject = route
            return i
        }))
        principal.addItem(sousMenu("Présentation", [
            element("Recharger", #selector(recharger), "r"),
            .separator(),
            element("Taille réelle", #selector(tailleReelle), "0"),
            element("Agrandir", #selector(agrandir), "+"),
            element("Réduire", #selector(reduire), "-"),
            .separator(),
            element("Plein écran", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ]))
        let fenetres = sousMenu("Fenêtre", [
            element("Placer dans le Dock", #selector(NSWindow.performMiniaturize(_:)), "m"),
            element("Réduire/agrandir", #selector(NSWindow.performZoom(_:))),
            element("Fermer", #selector(NSWindow.performClose(_:)), "w"),
        ])
        principal.addItem(fenetres)
        NSApp.mainMenu = principal
        NSApp.windowsMenu = fenetres.submenu
    }

    @objc func aller(_ sender: NSMenuItem) {
        guard pret, let route = sender.representedObject as? String else { return }
        vue.evaluateJavaScript("location.hash = '#/\(route)'")
    }

    @objc func recharger() {
        if pret { vue.reload() } else { demarrer() }
    }
    @objc func tailleReelle() { vue.pageZoom = 1 }
    @objc func agrandir() { vue.pageZoom = min(vue.pageZoom + 0.1, 2.5) }
    @objc func reduire() { vue.pageZoom = max(vue.pageZoom - 0.1, 0.5) }

    @objc func ouvrirDansNavigateur() { NSWorkspace.shared.open(ADRESSE) }

    @objc func afficherDossier() {
        if let d = dossierProjet() { NSWorkspace.shared.activateFileViewerSelecting([d]) }
    }

    @objc func choisirDossierMenu() { choisirDossier() }

    func choisirDossier() {
        let panneau = NSOpenPanel()
        panneau.message = "Où est le dossier Praxis (celui qui contient la commande praxis) ?"
        panneau.prompt = "Choisir"
        panneau.canChooseDirectories = true
        panneau.canChooseFiles = false
        panneau.beginSheetModal(for: fenetre) { [weak self] reponse in
            guard reponse == .OK, let url = panneau.url else { return }
            Task { @MainActor in
                guard let self else { return }
                if FileManager.default.fileExists(atPath: url.path + "/praxis") {
                    UserDefaults.standard.set(url.path, forKey: CLE_DOSSIER)
                    self.serveur?.terminate()
                    self.serveur = nil
                    self.demarrer()
                } else {
                    self.afficherErreur("Ce dossier ne contient pas la commande praxis.", details: url.path,
                                        actions: [("Choisir un autre dossier…", "choisir-dossier")])
                }
            }
        }
    }

    // MARK: navigation : liens externes, actions des pages d'erreur, téléchargements

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = action.request.url else { return .allow }
        if url.scheme == "praxis-action" {
            switch url.host ?? "" {
            case "choisir-dossier": choisirDossier()
            default: serveur?.terminate(); serveur = nil; demarrer()
            }
            return .cancel
        }
        if action.shouldPerformDownload { return .download }
        if ["about", "blob", "data"].contains(url.scheme ?? "") { return .allow }
        if url.host == "127.0.0.1" && url.port == PORT { return .allow }
        if ["http", "https", "mailto"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
            return .cancel
        }
        return .allow
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        response.canShowMIMEType ? .allow : .download
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard pret, !enFermeture else { return }
        afficherErreur("La page de Praxis ne répond plus.", details: error.localizedDescription, actions: [("Réessayer", "reessayer")])
        pret = false
    }

    var autotestLance = false

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard pret, webView.url?.host == "127.0.0.1" else { return }
        noter("page chargée : \(webView.url?.absoluteString ?? "")")
        if AUTOTEST && !autotestLance {
            autotestLance = true
            Task { await autotest() }
        }
    }

    /// PRAXIS_AUTOTEST=1 : vérifie Python et l'export dans la fenêtre, écrit le résultat au journal, puis quitte.
    func autotest() async {
        let python = """
        location.hash = '#/reglages';
        await new Promise(r => setTimeout(r, 800));
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Tester');
        if (!b) return 'bouton Tester introuvable';
        b.click();
        const t0 = Date.now();
        while (Date.now() - t0 < 120000) {
          await new Promise(r => setTimeout(r, 500));
          const t = b.parentElement.textContent.replace('Tester', '').trim();
          if (t && !t.startsWith('chargement')) return t;
        }
        return 'délai dépassé';
        """
        do {
            let r = try await vue.callAsyncJavaScript(python, contentWorld: .page)
            noter("autotest python : \(r.map { "\($0)" } ?? "rien")")
        } catch {
            noter("autotest python : erreur \(error.localizedDescription)")
        }
        let export = """
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Télécharger');
        if (!b) return 'bouton Télécharger introuvable';
        b.click();
        return 'clic';
        """
        _ = try? await vue.callAsyncJavaScript(export, contentWorld: .page)
        for _ in 0..<40 where !autotestExportFini { try? await Task.sleep(nanoseconds: 250_000_000) }
        noter("autotest export : \(autotestExportFini ? "fichier reçu" : "aucun fichier")")
        noter("autotest titre : \(vue.title ?? "")")
        NSApp.terminate(nil)
    }
    var autotestExportFini = false

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if pret { webView.reload() }
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
        let dossier = AUTOTEST ? FileManager.default.temporaryDirectory
            : FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser
        let nom = suggestedFilename.isEmpty ? "praxis.json" : suggestedFilename
        var cible = dossier.appendingPathComponent(nom)
        let base = cible.deletingPathExtension().lastPathComponent, ext = cible.pathExtension
        var n = 2
        while FileManager.default.fileExists(atPath: cible.path) {
            cible = dossier.appendingPathComponent(ext.isEmpty ? "\(base) \(n)" : "\(base) \(n).\(ext)")
            n += 1
        }
        telechargements[ObjectIdentifier(download)] = cible
        return cible
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let url = telechargements.removeValue(forKey: ObjectIdentifier(download)) else { return }
        let taille = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        noter("téléchargement : \(url.path) (\(taille) octets)")
        if AUTOTEST {
            autotestExportFini = true
            try? FileManager.default.removeItem(at: url)
        } else {
            NSWorkspace.shared.activateFileViewerSelecting([url])
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        telechargements.removeValue(forKey: ObjectIdentifier(download))
        noter("téléchargement échoué : \(error.localizedDescription)")
    }

    // MARK: fenêtres demandées par la page, sélection de fichiers

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo) async -> [URL]? {
        let panneau = NSOpenPanel()
        panneau.canChooseFiles = true
        panneau.canChooseDirectories = false
        panneau.allowsMultipleSelection = parameters.allowsMultipleSelection
        return await panneau.beginSheetModal(for: fenetre) == .OK ? panneau.urls : nil
    }
}

@main
struct PraxisApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        let lanceur = Lanceur()
        app.delegate = lanceur
        app.setActivationPolicy(.regular)
        app.run()
    }
}
