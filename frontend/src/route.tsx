/**
 * External dependencies.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import ErrorFallback from "./components/errorFallback";

/**
 * Lazy load components.
 */
const Appointment = lazy(() => import("@/pages/appointment"));
const GroupAppointment = lazy(() => import("@/pages/group-appointment"));
const NotFound = lazy(() => import("@/pages/notFound"));

const Router = () => {
  return (
    <>
      <Route path="/in/:meetId" element={<Appointment />} errorElement={<ErrorFallback/>}></Route>
      <Route path="/gr/:groupId" element={<GroupAppointment />} errorElement={<ErrorFallback/>}></Route>
      <Route path="*" element={<NotFound />} />
    </>
  );
};

export default Router;
