// Thème : « auto » laisse la page suivre le système (ou le choix de l'hôte), sinon on force.
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
  else if (root.dataset.praxisTheme) root.removeAttribute("data-theme");
  if (theme === "light" || theme === "dark") root.dataset.praxisTheme = "1";
  else delete root.dataset.praxisTheme;
}
