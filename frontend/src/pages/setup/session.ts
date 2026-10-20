/**
 * The signed-in user, read from the boot data Frappe renders into the page.
 */
interface Boot {
  user?: { name?: string; user_type?: string; roles?: string[] };
  user_info?: Record<string, { fullname?: string; image?: string | null; time_zone?: string | null }>;
  time_zone?: { system?: string; user?: string };
}

export interface SessionUser {
  name: string;
  userType: string;
  fullName: string;
  image: string | null;
  timeZone: string;
  roles: string[];
}

export const readSessionUser = (): SessionUser | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boot: Boot = (window as any).frappe?.boot ?? {};
  const name = boot.user?.name;
  if (!name || name === "Guest") return null;
  const info = boot.user_info?.[name] ?? {};
  return {
    name,
    userType: boot.user?.user_type ?? "System User",
    fullName: info.fullname || name,
    image: info.image ?? null,
    timeZone:
      boot.time_zone?.user || info.time_zone || boot.time_zone?.system || Intl.DateTimeFormat().resolvedOptions().timeZone,
    roles: boot.user?.roles ?? [],
  };
};
