/**
 * External dependencies
 */
import { WifiOff } from "lucide-react";

const NetworkDisconnect = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-8 flex flex-col items-center max-md:h-full max-md:w-full max-md:justify-center max-md:items-center">
        <WifiOff className="text-gray-200 w-16 h-16  mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Internet Disconnected
        </h2>
        <p className="text-gray-600 text-center">
          Please check your internet connection and try again.
        </p>
      </div>
    </div>
  );
};

export default NetworkDisconnect;
