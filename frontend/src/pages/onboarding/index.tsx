/**
 * /schedule: where people set up their booking page. For now it shows the gate card
 * that decides whether they can start.
 */
import { useFrappeGetCall } from "frappe-react-sdk";

import MetaTags from "@/components/meta-tags";
import { ONBOARDING_STATUS, OnboardingStatus, getSessionUser } from "./api";
import { LoadErrorGate, LoginGate, NotReadyGate, ReadyGate, WebsiteUserGate } from "./gate";
import "@/styles/espresso.css";

const SignedIn = () => {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: OnboardingStatus }>(ONBOARDING_STATUS);

  if (isLoading) return null;
  if (error || !data) return <LoadErrorGate onRetry={() => mutate()} />;

  const status = data.message;
  if (status.user_type !== "System User") return <WebsiteUserGate />;
  if (!status.google_ready) return <NotReadyGate />;
  return <ReadyGate />;
};

const Onboarding = () => (
  <>
    <MetaTags title="Appointments" description="Set up your booking page" />
    {getSessionUser() ? <SignedIn /> : <LoginGate />}
  </>
);

export default Onboarding;
