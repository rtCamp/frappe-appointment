/**
 * External dependencies
 */
import { useEffect, useState } from "react";
import {
  Copy,
  CheckCircle2,
  CircleCheck,
  Calendar,
  MapPin,
  SquareArrowOutUpRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { format } from "date-fns";

/**
 * Internal dependencies
 */
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { slotType } from "@/context/app";
import Typography from "@/components/ui/typography";

interface SuccessAlertProps {
  open: boolean;
  setOpen: (opem: boolean) => void;
  selectedSlot: slotType;
  meetingProvider: string;
  meetLink: string;
  rescheduleLink: string;
  calendarString: string;
  onClose?: VoidFunction;
}

const SuccessAlert = ({
  open,
  setOpen,
  selectedSlot,
  meetingProvider,
  meetLink,
  rescheduleLink,
  calendarString,
  onClose,
}: SuccessAlertProps) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (open && selectedSlot.start_time) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [open, selectedSlot]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(calendarString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        onClose?.();
      }}
    >
      <DialogContent className="md:max-w-lg max-md:max-w-full !max-sm:w-full max-md:h-full max-md:place-content-center max-md:[&>button:last-child]:hidden focus-visible:ring-0">
        <DialogHeader>
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <CircleCheck className="text-blue-500 h-7 w-7" />
            </div>
          </div>
          <DialogTitle>
            <Typography
              variant="p"
              className="text-center text-gray-600 text-lg mb-7"
            >
              Your Appointment has been scheduled
            </Typography>
          </DialogTitle>
        </DialogHeader>

        <div>
          <div className="flex items-center justify-between p-4 py-2 bg-gray-50 rounded-lg mb-4">
            <div className="flex items-center">
              <Calendar className="text-blue-500 transition-colors cursor-pointer h-5 w-5 mr-3" />
              <div>
                <p className="font-medium text-sm">
                  {format(new Date(selectedSlot.start_time), "MMMM d, yyyy")}
                </p>
                <p className="text-xs text-gray-600">
                  {format(new Date(selectedSlot.start_time), "EEEE, hh:mm a")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 py-2 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <MapPin className="text-blue-500 transition-colors cursor-pointer h-5 w-5 mr-3" />
              <div>
                <p className="font-medium text-sm">Virtual Meeting</p>
                <p className="text-xs text-gray-600">{meetingProvider}</p>
              </div>
            </div>
            {meetLink && (
              <a href={meetLink} target="_blank">
                <SquareArrowOutUpRight className="text-blue-500 transition-colors cursor-pointer h-4 w-4 " />
              </a>
            )}
          </div>
        </div>

        {calendarString && (
          <div className="w-full overflow-hidden flex mt-4 px-3 py-1  bg-blue-50 items-center gap-2 max-md:h-14 rounded-full">
            <span className="w-full text-sm text-gray-500  truncate">
              {calendarString}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="flex gap-2 shrink-0 hover:bg-transparent text-blue-400 hover:text-blue-500 focus-visible:ring-0 focus-visible:ring-offset-0"
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
        )}

        <DialogFooter className="flex max-md:flex-col w-full sm:justify-start gap-4 md:mt-6 ">
          {rescheduleLink && (
            <a href={rescheduleLink} target="_blank">
              <Button
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
                size="sm"
                className="border border-blue-400 hover:text-blue-500 text-blue-500 w-full hover:bg-blue-50 p-4 rounded-full text-sm"
              >
                Reschedule
              </Button>
            </a>
          )}
          <Button
            onClick={() => setOpen(false)}
            size="sm"
            className="bg-blue-500 w-full hover:bg-blue-600 p-4 rounded-full text-sm"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SuccessAlert;
