// Theme system re-export shims (frontend/comps -> src/components).
export { ThemeProvider, useTheme } from "../../src/components/theme/ThemeProvider";
export { ThemeToggle } from "../../src/components/theme/ThemeToggle";
export {
  THEME_STORAGE_KEY,
  THEME_MODES,
  resolveTheme,
  applyThemeToDocument,
} from "../../src/lib/theme";
