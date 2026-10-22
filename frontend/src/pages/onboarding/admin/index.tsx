/**
 * What a System Manager sees at /schedule while Google isn't set up on the site:
 * the Google Cloud guide, then the credentials screen. Afterwards they carry on with their own setup.
 */
import { useState } from "react";
import { useFrappeGetCall } from "frappe-react-sdk";

import { GOOGLE_SETUP, GoogleSetup, SessionUser } from "../api";
import { Frame } from "../frame";
import { LoadErrorGate } from "../gate";
import Guide from "./guide";
import Credentials from "./credentials";

const AdminSetup = ({ user, onDone }: { user: SessionUser; onDone: () => void }) => {
  const { data, error, isLoading, mutate } = useFrappeGetCall<{ message: GoogleSetup }>(GOOGLE_SETUP);
  const setup = data?.message;
  // Credentials already saved (say, for Gmail) but Google turned off: go straight to them.
  const [view, setView] = useState<"guide" | "credentials" | null>(null);

  if (isLoading) return null;
  if (error || !setup) return <LoadErrorGate onRetry={() => mutate()} />;

  const current = view ?? (setup.client_id && setup.has_client_secret ? "credentials" : "guide");

  return (
    <Frame user={user} title="Set up Appointments for your site" wide={current === "guide"}>
      {current === "guide" ? (
        <Guide setup={setup} onCredentials={() => setView("credentials")} />
      ) : (
        <Credentials setup={setup} onBack={() => setView("guide")} onContinue={onDone} />
      )}
    </Frame>
  );
};

export default AdminSetup;
