/**
 * External dependencies
 */
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
/**
 * Internal dependencies
 */
import { useTheme } from "..";

const ModeToggle = () => {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (!theme) {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setTheme(systemPrefersDark ? "dark" : "light");
    }
  }, [theme, setTheme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <>
      <div className="max-lg:hidden fixed z-50 top-4 right-4 flex items-center p-2 rounded-xl bg-background max-lg:bg-transparent lg:border border-border">
        <button
          onClick={toggleTheme}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-muted"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          <span
            className={`pointer-events-none flex items-center justify-center absolute h-5 w-5 rounded-full bg-background shadow-lg transform ring-0 transition-transform ${
              theme === "dark" ? "translate-x-5" : "translate-x-0"
            }`}
          >
            {theme === "dark" ? (
              <Moon className="h-3 w-3 text-foreground" />
            ) : (
              <Sun className="h-3 w-3 text-foreground" />
            )}
          </span>
        </button>
        <span className="max-lg:hidden ml-2 text-sm font-medium text-foreground">
          {theme === "dark" ? "Dark" : "Light"}
        </span>
      </div>
      <button
        onClick={toggleTheme}
        className="lg:hidden fixed bg-background z-50 top-4 right-4 flex items-center justify-center rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none "
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "dark" ? (
          <Moon className="h-5 w-5 text-gray-200" />
        ) : (
          <Sun className="h-5 w-5 text-amber-500" />
        )}
      </button>
    </>
  );
};

export default ModeToggle;
