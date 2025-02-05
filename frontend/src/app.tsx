/**
 * External dependencies.
 */
import { Suspense } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
} from "react-router-dom";
import { FrappeProvider } from "frappe-react-sdk";

/**
 * Internal dependencies.
 */
import Router from "./route";
import { BASE_ROUTE } from "./lib/constant";
import { getSiteName } from "./lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorFallback from "@/components/errorFallback";
import { AppProvider } from "./context/app";
import { Toaster } from "./components/ui/sonner";

const App = () => {
  const router = createBrowserRouter(createRoutesFromElements(Router()), {
    basename: BASE_ROUTE,
  });
  return (
    <>
      <ErrorFallback>
        <AppProvider>
          <FrappeProvider
            url={import.meta.env.VITE_BASE_URL ?? ""}
            socketPort={import.meta.env.VITE_SOCKET_PORT}
            enableSocket={
              import.meta.env.VITE_ENABLE_SOCKET === "true" ? true : false
            }
            siteName={getSiteName()}
          >
            <TooltipProvider>
              <Suspense fallback={<></>}>
                <RouterProvider router={router} />
                <Toaster />
              </Suspense>
            </TooltipProvider>
          </FrappeProvider>
        </AppProvider>
      </ErrorFallback>
    </>
  );
};

export default App;
