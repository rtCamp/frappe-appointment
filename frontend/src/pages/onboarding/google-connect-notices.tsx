/**
 * What's happening with a Google sign-in: waiting for the popup, a sign-in that didn't finish, or an error.
 */
import { LoaderCircle } from "lucide-react";

import { Button, Notice } from "./ui";
import { GoogleConnect } from "./use-google-connect";

const GoogleConnectNotices = ({ user, google }: { user: string; google: GoogleConnect }) => (
  <>
    {google.waiting && (
      <Notice
        tone="blue"
        icon={<LoaderCircle className="w-4 h-4 shrink-0 mt-px text-ink-blue-5 animate-spin" aria-hidden="true" />}
        title="Finish signing in with Google"
        actions={
          <>
            {google.manualUrl && (
              <a
                href={google.manualUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center h-7 px-2 rounded-lg bg-surface-gray-3 text-es-base text-ink-gray-8 no-underline"
              >
                Open sign-in
              </a>
            )}
            <Button variant="ghost" onClick={google.cancel}>
              Cancel
            </Button>
          </>
        }
      >
        {google.manualUrl ? "Your browser blocked the sign-in window, so open it here. " : "A Google window is open. "}
        Sign in as {user} and allow access. This page updates by itself.
      </Notice>
    )}

    {google.didNotFinish && (
      <Notice tone="red" title="Google didn't connect your calendar">
        The sign-in closed before Google finished. If Google showed an error, the site's Google setup isn't finished: ask
        your admin to check that the redirect URI in Google Cloud matches this site exactly. Otherwise, try again.
      </Notice>
    )}

    {google.error && (
      <Notice tone="red" title="Couldn't connect your calendar">
        {google.error}
      </Notice>
    )}
  </>
);

export default GoogleConnectNotices;
