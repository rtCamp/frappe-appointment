/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import {
  Copy,
  Briefcase,
  MessageSquare,
  CheckCircle2,
  CircleCheck,
  CalendarCheck2,
} from "lucide-react";
import confetti from "canvas-confetti";
import { format } from "date-fns";

/**
 * Internal dependencies
 */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { slotType } from "@/context/app";

const ActionCard = ({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="p-4 hover:scale-[1.01] transition-all rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md cursor-pointer">
    <div className="flex gap-3">
      <Icon className="w-6 h-6 text-blue-400" />
      <div>
        <h3 className="font-medium mb-1 text-blue-400">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  </div>
);

interface SuccessAlertProps {
  open: boolean;
  setOpen: (opem: boolean) => void;
  selectedSlot: slotType;
}

const SuccessAlert = ({ open, setOpen, selectedSlot }: SuccessAlertProps) => {
  const [copied, setCopied] = useState(false);
  const [calendarString, setCalendarString] = useState("");
  useEffect(() => {
    if (open && selectedSlot.start_time) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setCalendarString(
        `https://calendar.google.com/calendar/u/0/r/day/${format(
          new Date(selectedSlot.start_time),
          "yyyy/MM/dd"
        )}`
      );
    }
  }, [open, selectedSlot]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(calendarString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="md:max-w-[600px] max-md:max-w-full !max-sm:w-full max-md:h-full [&>button:last-child]:hidden max-md:place-content-center"
      >
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="flex justify-center items-center rounded-full overflow-hidden">
              <CircleCheck className="text-blue-500 h-14 w-14" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Appointment has been scheduled
          </DialogTitle>
        </DialogHeader>

        <div className="w-full overflow-hidden flex mt-4 p-3 max-md:p-2  bg-blue-50 rounded-lg items-center gap-2 max-md:h-14">
          <span className="w-full text-sm text-blue-500 truncate">
            {calendarString}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="flex gap-2 shrink-0 hover:bg-transparent text-blue-400 hover:text-blue-500"
            onClick={copyToClipboard}
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:mt-6 ">
          <ActionCard
            icon={Briefcase}
            title="Explore opportunities"
            description="Discover new job opportunities and projects"
          />
          <ActionCard
            icon={MessageSquare}
            title="Start conversations"
            description="Message and collaborate with other members"
          />
        </div>

        <div className="flex justify-center gap-4 md:mt-6">
          <Button
            onClick={() => setOpen(false)}
            size="sm"
            className="bg-blue-400 hover:bg-blue-500 p-5"
          >
            <CalendarCheck2 className="w-4 h-4 " />
            Book another slot
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessAlert;
