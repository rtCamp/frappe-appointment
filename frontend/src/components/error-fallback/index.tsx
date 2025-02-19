/**
 * External dependencies
 */
import { useRouteError } from "react-router-dom";
/**
 * Internal dependencies
 */
import { TriangleAlert } from "lucide-react";

const ErrorFallback = () => {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="w-screen h-screen flex justify-center items-center">
      <div className=" rounded-lg p-4 mb-6">
        <div className="flex flex-col items-start ">
          <div className="flex items-center mb-1">
            <TriangleAlert className="text-red-500 h-4 w-4 mr-2" />
            <h3 className="font-medium text-red-500">Something went wrong</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;
