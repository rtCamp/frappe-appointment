/**
 * External dependencies
 */
import { useState } from "react";
import { ChevronLeft, X } from "lucide-react";

/**
 * Internal dependencies
 */
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Label } from "@/components/label";
import Spinner from "@/components/spinner";
import Typography from "@/components/typography";

export interface GuestDetailsValue {
  fullName: string;
  email: string;
  guests: string[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who's booking: shown on a group's link when it doesn't already say (Careers and reschedule links do).
 */
const GuestDetails = ({
  dateLabel,
  loading,
  onBack,
  onSubmit,
}: {
  dateLabel: string;
  loading: boolean;
  onBack: () => void;
  onSubmit: (value: GuestDetailsValue) => void;
}) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [tried, setTried] = useState(false);

  const nameError = fullName.trim().length < 2 ? "Name must be at least 2 characters" : null;
  const emailError = !EMAIL.test(email.trim()) ? "Please enter a valid email address" : null;
  const guestError = guestInput.trim() && !EMAIL.test(guestInput.trim()) ? "Please enter a valid email address" : null;

  const addGuest = () => {
    const value = guestInput.trim().replace(/,$/, "");
    if (!value || !EMAIL.test(value)) return;
    if (!guests.includes(value) && value !== email.trim()) setGuests([...guests, value]);
    setGuestInput("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (nameError || emailError) return;
    onSubmit({ fullName: fullName.trim(), email: email.trim(), guests });
  };

  const inputClass = (error: string | null) =>
    `active:ring-blue-400 focus-visible:ring-blue-400 ${tried && error ? "active:ring-red-500 focus-visible:ring-red-500 border-red-500" : ""}`;

  return (
    <form onSubmit={submit} className="space-y-6 h-full flex justify-between flex-col">
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <Typography variant="p" className="text-2xl">
            Your contact info
          </Typography>
          <Typography className="text-sm text-blue-500 dark:text-blue-400">{dateLabel}</Typography>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guest-name" className={tried && nameError ? "text-red-500" : ""}>
            Full Name <span className="text-red-500 dark:text-red-600">*</span>
          </Label>
          <Input
            id="guest-name"
            autoComplete="name"
            disabled={loading}
            className={inputClass(nameError)}
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          {tried && nameError && <p className="text-sm text-red-500">{nameError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="guest-email" className={tried && emailError ? "text-red-500" : ""}>
            Email <span className="text-red-500 dark:text-red-600">*</span>
          </Label>
          <Input
            id="guest-email"
            type="email"
            autoComplete="email"
            disabled={loading}
            className={inputClass(emailError)}
            placeholder="john.doe@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {tried && emailError && <p className="text-sm text-red-500">{emailError}</p>}
          <p className="text-sm text-gray-500">The calendar invite with the meeting link goes here.</p>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            className="h-auto hover:bg-blue-50 dark:hover:bg-blue-800/10 text-blue-500 dark:text-blue-400 hover:text-blue-600"
            onClick={() => setGuestsOpen(!guestsOpen)}
            disabled={loading}
          >
            {guestsOpen ? "Hide Guests" : "+ Add Guests"}
          </Button>
          {guestsOpen && (
            <div className="space-y-2">
              <Input
                aria-label="Guest emails"
                placeholder="janedoe@hotmail.com, bob@gmail.com, etc."
                value={guestInput}
                className="active:ring-blue-400 focus-visible:ring-blue-400"
                onChange={(e) => setGuestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addGuest();
                  }
                }}
                onBlur={addGuest}
                disabled={loading}
              />
              {guestError && <p className="text-sm text-red-500">{guestError}</p>}
              <div className="flex flex-wrap gap-2">
                {guests.map((guest) => (
                  <div
                    key={guest}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 dark:bg-blue-400 text-white dark:text-background rounded-full text-sm"
                  >
                    <span>{guest}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${guest}`}
                      onClick={() => setGuests(guests.filter((g) => g !== guest))}
                      className="hover:text-blue-200"
                    >
                      <X className="h-3 w-3 dark:text-background" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between md:pt-4 max-md:h-14 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-screen max-md:border max-md:z-10 max-md:bg-background max-md:border-top max-md:items-center max-md:px-4">
        <Button
          type="button"
          className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400 md:hover:bg-blue-50 md:dark:hover:bg-blue-800/10 max-md:px-0 max-md:hover:underline max-md:hover:bg-transparent"
          onClick={onBack}
          variant="ghost"
          disabled={loading}
        >
          <ChevronLeft /> Back
        </Button>
        <Button disabled={loading} className="bg-blue-500 dark:bg-blue-400 hover:bg-blue-500 dark:hover:bg-blue-400" type="submit">
          {loading && <Spinner />} Schedule Meeting
        </Button>
      </div>
    </form>
  );
};

export default GuestDetails;
