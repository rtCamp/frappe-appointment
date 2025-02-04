/**
 * External dependencies.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";

/**
 * Lazy load components.
 */
const Appointment = lazy(() => import("@/pages/appointment"));
const NotFound = lazy(() => import("@/pages/notFound"));

const Router = () => {
  return (
    <>
      <Route path="/:meetId" element={<Appointment />}>
      </Route>
      <Route path="*" element={<NotFound />} />
    </>
  );
};

export default Router;
