const STORAGE_KEY = "daily-todo-theme";

export const THEMES = Object.freeze([
  { id: "white", nameKey: "themes.white", preview: "linear-gradient(135deg, #fff 55%, #edf0f2)" },
  { id: "mint", nameKey: "themes.mint", preview: "linear-gradient(135deg, #e5f3eb, #b5d6c4)" },
  { id: "sky", nameKey: "themes.sky", preview: "linear-gradient(135deg, #eaf3fb, #b6d4ef)" },
  { id: "lavender", nameKey: "themes.lavender", preview: "linear-gradient(135deg, #f2edfa, #d0bde9)" },
  { id: "peach", nameKey: "themes.peach", preview: "linear-gradient(135deg, #fff2e9, #edc5aa)" },
  { id: "glass", nameKey: "themes.glass", preview: "linear-gradient(125deg, #a8d8e9, #ecf6ff 45%, #dcc5f4)" },
  { id: "aurora", nameKey: "themes.aurora", preview: "linear-gradient(135deg, #bfe5d3, #cadcf1 55%, #dfcef2)" },
  { id: "sunset", nameKey: "themes.sunset", preview: "linear-gradient(135deg, #f8d5bb, #f0c3cc 55%, #dcd0f1)" },
  { id: "ocean", nameKey: "themes.ocean", preview: "linear-gradient(135deg, #a9d9db, #bfd9ef 55%, #d6e9f1)" },
  { id: "twilight", nameKey: "themes.twilight", preview: "linear-gradient(135deg, #cccef0, #e0c5e4 55%, #f2d4d1)" },
]);

const colors = {
  white: "#f7f8fa", mint: "#eef6f1", sky: "#eff5fb", lavender: "#f5f1fa",
  peach: "#fff5ee", glass: "#dcecf4", aurora: "#dcece6", sunset: "#f4ddd6",
  ocean: "#d5e9ee", twilight: "#e0dced",
};
let activeTheme;
const normalize = (id) => THEMES.some((theme) => theme.id === id) ? id : "white";

export function getTheme() {
  if (activeTheme) return activeTheme;
  try { return normalize(localStorage.getItem(STORAGE_KEY)); }
  catch { return "white"; }
}

export function applyTheme(id = getTheme()) {
  activeTheme = normalize(id);
  document.documentElement.dataset.theme = activeTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", colors[activeTheme]);
  return activeTheme;
}

export function setTheme(id) {
  const selected = applyTheme(id);
  try { localStorage.setItem(STORAGE_KEY, selected); } catch { /* Keep the theme for this page when storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: selected } }));
  return selected;
}
