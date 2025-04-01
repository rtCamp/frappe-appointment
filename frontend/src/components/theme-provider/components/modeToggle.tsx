/**
 * External dependencies
 */
import { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
      <motion.button
      onClick={toggleTheme}
      className="fixed bg-background dark:hover:bg-zinc-800 z-50 max-md:top-4 max-md:right-4 top-10 right-5 lg:top-4 lg:right-4  flex gap-2 items-center justify-center rounded-full p-2 lg:px-3 hover:bg-gray-100 focus:outline-none overflow-hidden"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      whileTap={{ scale: 0.9 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={theme + "-icon"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4 text-blue-500 fill-blue-500" />
          ) : (
            <Sun className="h-4 w-4 text-amber-500 fill-amber-500" />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.span
          key={theme + "-text"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="max-lg:hidden text-sm font-medium text-blue-500 dark:text-amber-500"
        >
          {theme === "light" ? "Dark" : "Light"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
    </>
  );
};

export default ModeToggle;
