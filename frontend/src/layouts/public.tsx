/**
 * External dependencies.
 */
import { Outlet } from "react-router-dom";

/**
 * Internal dependencies.
 */
import ModeToggle from "@/components/theme-provider/components/modeToggle";

/**
 * Layout for the public booking pages. Guests have no app menu, so the theme toggle floats here;
 * the signed-in app pages put it in the sidebar menu instead.
 */
const PublicLayout = () => (
  <>
    <Outlet />
    <ModeToggle />
  </>
);

export default PublicLayout;
