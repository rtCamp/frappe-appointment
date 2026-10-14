/**
 * Share section: the booking link and per-meeting-type links.
 */
import { useState } from "react";
import { Check, Copy, ExternalLink, Video } from "lucide-react";

import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import { AvailabilityDoc } from "../api";
import { Box, Notice, Section, blueButton, blueGhostButton, blueOutlineButton, panel } from "../ui";

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  }
};

const CopyButton = ({ text, label = "Copy", primary = false }: { text: string; label?: string; primary?: boolean }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant={primary ? "default" : "outline"}
      className={cn(primary ? blueButton : blueOutlineButton, primary && "rounded-full px-4")}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
};

const minutesLabel = (seconds: number) => {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} hr` : `${Math.floor(m / 60)} hr ${m % 60} min`;
};

const DoneStep = ({
  availability,
  onGoTo,
}: {
  availability: AvailabilityDoc;
  onGoTo: (section: number) => void;
}) => {
  const link = `${window.location.origin}/schedule/in/${availability.slug}`;
  const provider =
    availability.meeting_provider && availability.meeting_provider !== "None"
      ? availability.meeting_provider === "Custom"
        ? "Your meeting link"
        : availability.meeting_provider
      : null;

  if (!availability.enable_scheduling || !availability.slug) {
    return (
      <Section title="Share" description="Your booking link shows up here once your booking page is on.">
        <Notice
          tone="blue"
          title="Your booking page is turned off"
          actions={
            <Button className={blueButton} size="sm" onClick={() => onGoTo(2)}>
              Set up booking page
            </Button>
          }
        >
          Your hours are saved, so you can still be added to team meetings. Turn on your booking page to get a
          link people can use to book you directly.
        </Notice>
      </Section>
    );
  }

  return (
    <Section
      title="Share"
      description="Send this link to anyone. They pick a time that works for both of you, and it lands on your Google Calendar."
    >
      <Box className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-600/20 rounded-full flex items-center justify-center shrink-0">
            <Check className="text-blue-500 dark:text-blue-400 h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold">You're ready to take bookings</p>
            <p className="text-sm text-muted-foreground">Your booking page is live.</p>
          </div>
        </div>
        <div className="w-full overflow-hidden flex px-4 py-1.5 bg-blue-50 dark:bg-zinc-800 items-center gap-2 rounded-full">
          <span className="w-full text-sm text-gray-600 dark:text-blue-400 truncate" title={link}>
            {link}
          </span>
          <Button asChild size="sm" variant="ghost" className={cn(blueGhostButton, "rounded-full shrink-0")}>
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink /> Open
            </a>
          </Button>
          <CopyButton text={link} label="Copy link" primary />
        </div>
      </Box>

      {availability.available_durations?.length > 0 && (
        <Box className="flex flex-col gap-1">
          <p className="font-medium">Links for one meeting type</p>
          <p className="text-sm text-muted-foreground mb-2">Skips the choice and goes straight to picking a time.</p>
          <ul className="flex flex-col gap-2">
            {availability.available_durations.map((d) => {
              const typeLink = `${link}?type=${encodeURIComponent(d.name ?? "")}`;
              return (
                <li key={d.name} className={cn(panel, "flex items-center gap-3 px-4 py-3")}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{d.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {minutesLabel(Number(d.duration))}
                      {provider && (
                        <>
                          <span className="mx-1">•</span>
                          <Video className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-blue-400">{provider}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <CopyButton text={typeLink} />
                </li>
              );
            })}
          </ul>
        </Box>
      )}

      <Notice tone="blue" title="Try it yourself">
        Open your link in a private window to see exactly what people see when they book you.
      </Notice>
    </Section>
  );
};

export default DoneStep;
