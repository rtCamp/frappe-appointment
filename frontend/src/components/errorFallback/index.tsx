/**
 * External dependencies
 */
import { useRouteError } from "react-router-dom";
/**
 * Internal dependencies
 */
import { default as Typography } from "@/components/ui/typography";


const ErrorFallback = () => {
  const error = useRouteError();

  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <Typography variant="p" className="text-slate-600 font-medium">
        Something went wrong {error?.message}
      </Typography>
    </div>
  );
};

export default ErrorFallback;
