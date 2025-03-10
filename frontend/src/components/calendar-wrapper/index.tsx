/**
 * Internal dependencies.
 */
import { Calendar } from "@/components/calendar";
import { cn, disabledDays } from "@/lib/utils";

type CalendarWrapperProps = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  displayMonth: Date;
  setDisplayMonth: (date: Date) => void;
  meetingData: {
    valid_start_date: string;
    valid_end_date: string;
    available_days: string[];
  };
  loading: boolean;
  onDayClick: (date: Date) => void;
  className?: string;
};

export const CalendarWrapper = ({
  selectedDate,
  displayMonth,
  setDisplayMonth,
  meetingData,
  loading,
  className,
  onDayClick,
}: CalendarWrapperProps) => {
  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      month={displayMonth}
      onMonthChange={setDisplayMonth}
      weekStartsOn={1}
      fromMonth={new Date(meetingData.valid_start_date)}
      toMonth={new Date(meetingData.valid_end_date)}
      disableNavigation={loading}
      disabled={(date) => {
        if (loading) return true;
        const disabledDaysList = disabledDays(meetingData.available_days);
        const isPastDate =
          date.getTime() <
          new Date(meetingData.valid_start_date).setHours(0, 0, 0, 0);
        const isNextDate =
          date.getTime() >
          new Date(meetingData.valid_end_date).setHours(0, 0, 0, 0);
        return (
          isPastDate || disabledDaysList.includes(date.getDay()) || isNextDate
        );
      }}
      onDayClick={onDayClick}
      className={cn("[&_*_table]:flex-1 [&_*_table]:h-fit",className)}
      classNames={{
        months:
          "flex w-full flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 flex-1",
        month: "space-y-4 w-full flex flex-col",
        table: "w-full h-full border-collapse space-y-1",
        head_row: "",
        row: "w-full mt-2",
        caption_label: "md:text-xl text-sm",
      }}
    />
  );
};
