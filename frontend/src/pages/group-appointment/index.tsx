/**
 * External dependencies
 */
import { useParams } from "react-router-dom";

const GroupAppointment = () => {
  const { groupId } = useParams();
  return (
    <>
      <div className="w-full flex justify-center items-center">
        <div className="container p-6 px-4">
          <div className="h-96 flex w-full max-lg:flex-col lg:border lg:rounded-lg lg:p-6 lg:px-4">
            {/* Group Meet Details */}
            <div className="flex flex-col w-full"></div>
            {/* Calendar View */}
            <div className="w-full lg:max-w-80"></div>
            {/* Available Slots */}
            <div className="w-full "></div>
          </div>
        </div>
      </div>
    </>
  );
};

export default GroupAppointment;
