/**
 * /schedule: where people set up their booking page. A gate card first decides whether they
 * can start; then the setup steps.
 */
import { useFrappeGetCall } from "frappe-react-sdk";

import MetaTags from "@/components/meta-tags";
import { ONBOARDING_STATUS, OnboardingStatus, SessionUser, getSessionUser } from "./api";
import { LoadErrorGate, LoginGate, NotReadyGate, WebsiteUserGate } from "./gate";
import Setup from "./setup";
import "@/styles/espresso.css";

const SignedIn = ({ user }: { user: SessionUser }) => {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: OnboardingStatus }>(ONBOARDING_STATUS);

  if (isLoading) return null;
  if (error || !data) return <LoadErrorGate onRetry={() => mutate()} />;

  const status = data.message;
  if (status.user_type !== "System User") return <WebsiteUserGate />;
  if (!status.google_ready) return <NotReadyGate />;
  return <Setup user={user} />;
};

const Onboarding = () => {
  const user = getSessionUser();
  return (
    <>
      <MetaTags title="Appointments" description="Set up your booking page" />
      {user ? <SignedIn user={user} /> : <LoginGate />}
    </>
  );
};

export default Onboarding;
