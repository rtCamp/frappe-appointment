/**
 * External dependencies.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import ErrorFallback from "./components/error-fallback";
import PublicLayout from "./layouts/public";

/**
 * Lazy load components.
 */
const Appointment = lazy(() => import("@/pages/appointment"));
const GroupAppointment = lazy(() => import("@/pages/group-appointment"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const NotFound = lazy(() => import("@/pages/notFound"));

const Router = () => {
  return (
    <>
      <Route element={<PublicLayout />}>
        <Route path="/in/:meetId" element={<Appointment />} errorElement={<ErrorFallback />}></Route>
        <Route path="/gr/:groupId" element={<GroupAppointment />} errorElement={<ErrorFallback />}></Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/" element={<Onboarding />} errorElement={<ErrorFallback />}></Route>
    </>
  );
};

export default Router;
