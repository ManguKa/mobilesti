import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "@roomfinder/themeMode";

const themes = {
  light: {
    mode: "light",
    background: "#f8fafc",
    safeArea: "#ffffff",
    card: "#ffffff",
    text: "#0f172a",
    subtext: "#475569",
    panel: "#e2e8f0",
    border: "#cbd5e1",
    accent: "#14b8a6",
    danger: "#ef4444",
    tabText: "#475569",
    tabActiveText: "#0f172a",
    placeholder: "#94a3b8",
  },
  dark: {
    mode: "dark",
    background: "#0f172a",
    safeArea: "#020617",
    card: "#111827",
    text: "#f8fafc",
    subtext: "#94a3b8",
    panel: "#0b1220",
    border: "#374151",
    accent: "#14b8a6",
    danger: "#ef4444",
    tabText: "#94a3b8",
    tabActiveText: "#0f172a",
    placeholder: "#64748b",
  },
};

const ThemeContext = createContext({
  theme: themes.dark,
  mode: "dark",
  setThemeMode: async () => {},
  isDark: true,
});

export function ThemeProvider({ children }) {
  const systemScheme = Appearance.getColorScheme();
  const [mode, setMode] = useState(systemScheme === "light" ? "light" : "dark");

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === "light" || savedMode === "dark") {
          setMode(savedMode);
        }
      } catch (error) {
        console.error("Failed to load theme mode:", error);
      }
    }

    loadTheme();
  }, []);

  const setThemeMode = useCallback(async (nextMode) => {
    setMode(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (error) {
      console.error("Failed to persist theme mode:", error);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme: themes[mode] || themes.dark,
        mode,
        isDark: mode === "dark",
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
