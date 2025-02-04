/**
 * External dependencies
 */
import { Clock, Video } from "lucide-react";

/**
 * Internal dependencies
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Typography from "@/components/ui/typography";
import { useAppContext } from "@/context/app";

interface MeetingCardProps {
  title: string;
  duration: string;
  onClick: VoidFunction;
}

const MeetingCard = ({ title, duration, onClick }: MeetingCardProps) => {
  const { userInfo } = useAppContext();
  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl py-2">{title}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <Typography>{duration} min</Typography>
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
          className="w-full bg-blue-400 hover:bg-blue-500"
        >
          Schedule Meeting
        </Button>
      </CardContent>
    </Card>
  );
};

export default MeetingCard;
