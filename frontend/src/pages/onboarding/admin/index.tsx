/**
 * What a System Manager sees at /schedule while Google isn't set up on the site:
 * the Google Cloud guide, then the credentials screen. Afterwards they carry on with their own setup.
 * Each has its own address: /schedule/admin/guide/<step> and /schedule/admin/credentials.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useFrappeGetCall } from "frappe-react-sdk";

import { GOOGLE_SETUP, GoogleSetup, SessionUser } from "../api";
import { Frame, FrameNav } from "../frame";
import { LoadErrorGate } from "../gate";
import { parsePath, paths } from "../routes";
import Guide from "./guide";
import { STEPS } from "./guide-steps";
import Credentials from "./credentials";

const AdminSetup = ({ user, onDone, nav }: { user: SessionUser; onDone: () => void; nav?: FrameNav }) => {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: GoogleSetup }>(GOOGLE_SETUP);
  const setup = data?.message;
  const route = parsePath(useLocation().pathname);
  const navigate = useNavigate();

  if (isLoading) return null;
  if (error || !setup) return <LoadErrorGate onRetry={() => mutate()} />;

  // The address decides; anywhere else, credentials already saved (say, for Gmail) but Google turned off go straight
  // to them.
  const current =
    route?.screen === "guide" || route?.screen === "credentials"
      ? route.screen
      : setup.client_id && setup.has_client_secret
        ? "credentials"
        : "guide";
  const step = route?.screen === "guide" ? Math.min(route.step, STEPS.length - 1) : 0;

  return (
    <Frame user={user} title="Set up Appointments for your site" width={current === "guide" ? "wide" : "narrow"} {...nav}>
      {current === "guide" ? (
        <Guide setup={setup} step={step} onStep={(n) => navigate(paths.guide(n))} onCredentials={() => navigate(paths.credentials)} />
      ) : (
        <Credentials setup={setup} onBack={() => navigate(paths.guide(STEPS.length - 1))} onContinue={onDone} />
      )}
    </Frame>
  );
};

export default AdminSetup;
