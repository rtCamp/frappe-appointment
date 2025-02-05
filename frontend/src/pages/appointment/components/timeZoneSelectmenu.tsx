import { useState } from "react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronDown, Globe } from "lucide-react";
import { getCurrentTime, getTimeZoneOffset } from "../utils";

export default function TimeZoneSelect({ timeZones, timeZone, setTimeZone }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full md:w-fit md:border-none md:focus:ring-0 text-gray-600 md:focus:ring-offset-0 "
        >
          <div className="flex justify-center items-center gap-2">
            <Globe className="h-4 w-4" />
            {timeZone
              ? timeZone.split("/")[1]?.replace("_", " ")
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
              {timeZones.map((tz) => (
                <CommandItem
                  key={tz}
                  onSelect={() => {
                    setTimeZone(tz);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-3 px-4"
                >
                  <div className="flex w-full items-center gap-4">
                    <div className="w-40 truncate">
                      <div className="font-medium truncate">
                        {tz.split("/")[1].replace("_", " ")}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
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
