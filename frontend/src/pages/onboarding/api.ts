export const ONBOARDING_STATUS = "frappe_appointment.api.onboarding.get_onboarding_status";

/** google_ready is only sent to desk (System) users. */
export interface OnboardingStatus {
  user_type: string;
  google_ready?: boolean;
}

interface Boot {
  user?: { name?: string };
}

/** The logged-in user's ID from the boot data Frappe renders into the page, or null for guests. */
export const getSessionUser = (): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const boot: Boot = (window as any).frappe?.boot ?? {};
  const name = boot.user?.name;
  return name && name !== "Guest" ? name : null;
};
