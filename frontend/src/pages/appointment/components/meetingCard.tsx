/**
 * External dependencies
 */
import { Clock, Video } from "lucide-react";

/**
 * Internal dependencies
 */
import { Button } from "@/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card";
import Typography from "@/components/typography";
import { useAppContext } from "@/context/app";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/tooltip";
import { convertMinutesToTimeFormat } from "../utils";

interface MeetingCardProps {
  title: string;
  duration: number;
  onClick: VoidFunction;
}

const MeetingCard = ({ title, duration, onClick }: MeetingCardProps) => {
  const { userInfo } = useAppContext();
  return (
    <Card className="group transform hover:-translate-y-1 hover:border-blue-300 duration-300 relative overflow-hidden rounded-2xl transition-all hover:shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl py-2">
          <Tooltip>
            <TooltipTrigger>{title}</TooltipTrigger>
            <TooltipContent>{title}</TooltipContent>
          </Tooltip>
        </CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Clock className="w-4 h-4 text-blue-500" />
          <Typography>{convertMinutesToTimeFormat(duration,true)}</Typography>
          <span className="mx-1">•</span>
          <Video className="w-4 h-4 text-blue-400" />
          <Typography className="text-blue-400">
            {userInfo.meetingProvider}
          </Typography>
        </CardDescription>
      </CardHeader>
      <CardContent className="cursor-pointer">
        <Button
          onClick={onClick}
          className="w-full bg-blue-500 hover:bg-blue-500 rounded-2xl"
        >
          Schedule Meeting
        </Button>
      </CardContent>
    </Card>
  );
};

export default MeetingCard;
