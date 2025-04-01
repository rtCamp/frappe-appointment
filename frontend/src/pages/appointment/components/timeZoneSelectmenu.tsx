/**
 * External dependencies
 */
import { useState } from "react";
import { ChevronDown, Globe, RefreshCcw } from "lucide-react";

/**
 * Internal dependencies
 */
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/popover";
import { Button } from "@/components/button";
import { getCurrentTime, getTimeZoneOffset } from "../utils";
import { getLocalTimezone } from "@/lib/utils";

interface TimeZoneSelectProps {
  timeZones: Array<string>;
  timeZone: string;
  setTimeZone: (tz: string) => void;
  disable: boolean;
}

export default function TimeZoneSelect({
  timeZones,
  timeZone,
  setTimeZone,
  disable = false,
}: TimeZoneSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger disabled={disable} asChild>
        <Button
          variant="outline"
          className="w-full md:w-fit md:border-none border-blue-100 dark:border-zinc-800 md:focus:ring-0 hover:bg-blue-50 dark:hover:bg-blue-800/20 hover:text-blue-500 md:focus:ring-offset-0 text-blue-500 dark:text-blue-400"
        >
          <div className="flex justify-center items-center gap-2">
            <Globe className="h-4 w-4" />
            {timeZone
              ? timeZone?.split("/").slice(1).join("/").replace(/_/g, " ")
              : "Select timezone"}
          </div>
          {/* Rotate the ChevronDown icon when popover is open */}
          <ChevronDown
            className={`h-4 w-4 mr-2 max-md:ml-auto transition-transform ${
              open ? "rotate-180" : "rotate-0"
            }`}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-full md:w-[300px]">
        <Command>
          <CommandInput placeholder="Search timezones..." />
          <CommandList>
            <CommandEmpty>No timezones found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setTimeZone(getLocalTimezone());
                  setOpen(false);
                }}
                className="cursor-pointer py-3 px-4 flex items-center gap-2 truncate data-[selected=true]:!bg-blue-50 dark:data-[selected=true]:!bg-blue-800/20 text-blue-500 dark:text-blue-400 data-[selected=true]:!text-blue-500 dark:data-[selected=true]:!text-blue-400"
              >
                <RefreshCcw className="h-4 w-4 text-blue-500" />
                <span>Reset to Default Timezone</span>
              </CommandItem>
              {timeZones.map((tz) => (
                <CommandItem
                  key={tz}
                  onSelect={() => {
                    setTimeZone(tz);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-3 px-4 data-[selected=true]:!bg-blue-50 dark:data-[selected=true]:!bg-blue-800/20 text-blue-500 dark:text-blue-400 data-[selected=true]:!text-blue-500 dark:data-[selected=true]:!text-blue-400"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="w-40 truncate">
                      <div className="font-medium truncate">
                        {tz?.split("/").slice(1).join("/").replace(/_/g, " ")}
                      </div>
                      <div className="text-sm text-muted-foreground truncate hover">
                        {getTimeZoneOffset(tz)}
                      </div>
                    </div>
                    <div className="w-20 text-sm text-muted-foreground text-right">
                      {getCurrentTime(tz)}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
