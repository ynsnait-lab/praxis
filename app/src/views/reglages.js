// Réglages : séances, lecture, affichage, exécution de code, données.
import { h, clear } from "../dom.js";
import { C, TRACKS, TRACK_LONG } from "../content.js";
import { getState, setSettings, exportJSON, importJSON, resetAll, today } from "../store.js";
import { syncStatus, saveFile, flush } from "../sync.js";
import { python, PYODIDE_VERSION } from "../runners.js";
import { sw, toast, copyText, go } from "../ui.js";
import { applyTheme } from "../theme.js";

export function reglagesView() {
  const s = getState().settings;
  const page = h("div.page.narrow");
  page.append(h("div.page-head", {}, h("div", {}, h("span.eyebrow", {}, "Préférences"), h("h1", {}, "Réglages"))));

  const range = (id, min, max, step, val, fmt, onset) => {
    const out = h("span.num.small", {}, fmt(val));
    const r = h("input", { type: "range", id, min, max, step, value: val, oninput: (e) => { out.textContent = fmt(+e.target.value); }, onchange: (e) => onset(+e.target.value) });
    return h("div.row.nowrap", {}, r, out);
  };
  const setting = (title, desc, control) => h("div.setting", {}, h("div.stack.g4", {}, h("strong.small", {}, title), desc ? h("span.d", {}, desc) : null), control);

  page.append(h("div.panel", {}, h("div.panel-head", {}, h("h3", {}, "Séances")),
    setting("Durée visée", "Le nombre d'exercices par séance est calculé pour tenir dans ce temps.",
      range("r-duree", 5, 60, 5, s.sessionMin, (v) => `${v} min`, (v) => setSettings({ sessionMin: v }))),
    setting("Nouveaux exercices par séance", "Plus tu en ajoutes, plus les révisions des jours suivants seront nombreuses.",
      range("r-new", 0, 30, 1, s.newPerSession, (v) => String(v), (v) => setSettings({ newPerSession: v }))),
    setting("Taux de rappel visé", "90 % est un bon équilibre. Plus haut : révisions plus fréquentes.",
      range("r-ret", 0.8, 0.95, 0.01, s.retention, (v) => `${Math.round(v * 100)} %`, (v) => setSettings({ retention: v }))),
    setting("Entrelacer les pistes", "Mélanger Python, C++ et Ingé dans une même séance : c'est plus dur, et c'est ce qui fait retenir.",
      sw("s-inter", s.interleave, (v) => setSettings({ interleave: v }), "Entrelacer")),
    ...TRACKS.map((t) => setting(`Piste ${TRACK_LONG[t]}`, null, sw(`s-tr-${t}`, s.tracks[t] !== false, (v) => setSettings({ tracks: { ...getState().settings.tracks, [t]: v } }), TRACK_LONG[t])))));

  const seg = (id, opts, val, onset) => h("div.seg", { id }, opts.map(([k, l]) =>
    h(`button${k === val ? ".on" : ""}`, { onclick: (e) => { onset(k); [...e.currentTarget.parentNode.children].forEach((b) => b.classList.toggle("on", b === e.currentTarget)); } }, l)));

  page.append(h("div.panel", { style: { marginTop: "16px" } }, h("div.panel-head", {}, h("h3", {}, "Lecture et affichage")),
    setting("Cours", "Progressif : une étape à la fois, du plus intuitif au plus pointu. Les cours déjà lus s'affichent en entier.",
      seg("seg-reveal", [["progressif", "Progressif"], ["tout", "Tout afficher"]], s.reveal, (v) => setSettings({ reveal: v }))),
    setting("Thème", null, seg("seg-theme", [["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]], s.theme, (v) => { setSettings({ theme: v }); applyTheme(v); })),
    setting("Prénom", "Facultatif : pour que l'accueil te salue par ton prénom.",
      h("input.field", { type: "text", id: "r-prenom", maxlength: 40, autocomplete: "given-name", placeholder: C.owner || "ton prénom",
        value: s.prenom || "", style: { maxWidth: "200px" }, onchange: (e) => setSettings({ prenom: e.target.value.trim() }) }))));

  const pyOut = h("span.small.muted", {}, python.state === "ready" ? `Python ${python.version} prêt` : "");
  page.append(h("div.panel", { style: { marginTop: "16px" } }, h("div.panel-head", {}, h("h3", {}, "Exécution du code")),
    setting("Python dans le navigateur", `Pyodide ${PYODIDE_VERSION}, chargé au premier exercice de code (~12 Mo, une seule fois).`,
      h("div.row", {}, pyOut, h("button.btn.sm", {
        onclick: async (e) => {
          const btn = e.currentTarget;          // après un await, e.currentTarget vaut null
          btn.disabled = true;
          pyOut.textContent = "chargement…";
          const r = await python.run('import sys; print("Python", sys.version.split()[0], "prêt")');
          btn.disabled = false;
          pyOut.textContent = r.ok ? r.out.trim() : `indisponible ici : ${r.err}`;
        },
      }, "Tester"))),
    setting("Exécuter le C++", "Les exercices C++ se vérifient en local dans les labs. Ici, tu peux compiler via Compiler Explorer (godbolt.org) : ton code y est envoyé. Désactivé : tu compares avec la solution.",
      seg("seg-cpp", [["off", "Désactivé"], ["godbolt", "Compiler Explorer"]], s.cppRunner, (v) => setSettings({ cppRunner: v })))));

  // données
  const st = syncStatus();
  const confirmBox = h("div");
  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true, id: "import-file" });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try {
      importJSON(await f.text());
      toast("Progression importée et fusionnée.");
      go("#/stats");
    } catch (err) {
      toast(`Import impossible : ${err.message}`, 5000);
    }
    fileIn.value = "";
  });
  page.append(h("div.panel", { style: { marginTop: "16px" } }, h("div.panel-head", {}, h("h3", {}, "Mes données")),
    setting("Sauvegarde", st === "sync" ? "Synchronisée entre tes appareils via ta page Claude." : st === "error" ? "Synchronisation en erreur : ta progression reste enregistrée dans ce navigateur." : "Enregistrée dans ce navigateur. Exporte-la pour la transférer.",
      h(`span.pill.${st === "sync" ? "ok" : st === "error" ? "bad" : "x"}`, {}, st === "sync" ? "synchronisée" : st === "error" ? "erreur" : "locale")),
    setting("Exporter", "Un fichier JSON avec toute ta progression (réimportable ici ou sur une autre version de Praxis).",
      h("div.row.tight", {},
        h("button.btn.sm", { onclick: async () => { await flush(); const r = await saveFile(`praxis-${today()}.json`, exportJSON()); toast(r === "saved" ? "Fichier prêt." : r === "declined" ? "Export annulé." : "Téléchargement impossible ici : utilise « Copier »."); } }, "Télécharger"),
        h("button.btn.ghost.sm", { onclick: async () => toast((await copyText(exportJSON())) ? "Progression copiée dans le presse-papiers." : "Copie refusée par cette vue.") }, "Copier"))),
    setting("Importer", "Fusionne un export (y compris un export de Praxis v1) avec ta progression actuelle.",
      h("div", {}, fileIn, h("button.btn.sm", { onclick: () => fileIn.click() }, "Choisir un fichier"))),
    setting("Tout effacer", "Remet Praxis à zéro sur cet appareil (et sur la synchro).",
      h("button.btn.danger.sm", {
        onclick: () => {
          clear(confirmBox).append(h("div.confirm-box", {},
            h("strong.small", {}, "Effacer toute ta progression ? Exporte-la avant si tu veux pouvoir revenir en arrière."),
            h("div.row.tight", {},
              h("button.btn.danger.sm", { onclick: () => { resetAll(); toast("Progression effacée."); go("#/"); } }, "Oui, tout effacer"),
              h("button.btn.ghost.sm", { onclick: () => clear(confirmBox) }, "Annuler"))));
        },
      }, "Effacer…")),
    confirmBox));

  page.append(h("p.xs.faint", { style: { marginTop: "18px" } },
    `Praxis ${C.v} · contenu du ${C.built} · ${Object.keys(C.modules).length} modules et notions · ${Object.keys(C.ex).length} exercices · ${Object.keys(C.pieges).length} pièges. `,
    C.repo && C.repo.url ? h("a", { href: C.repo.url, target: "_blank", rel: "noopener" }, "Code source") : null,
    C.repo && C.repo.pages ? [" · ", h("a", { href: C.repo.pages, target: "_blank", rel: "noopener" }, "Version en ligne")] : null));
  return page;
}
