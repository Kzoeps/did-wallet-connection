// src/routes/__root.tsx
/// <reference types="vite/client" />
import appCss from "../styles/app.css?url";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanstackDevtools } from "@tanstack/react-devtools";
import Providers from "@/providers/client-providers";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      // your meta tags and site config
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    // other head config
  }),
  component: () => (
    <>
      <Providers>
        <Outlet />
        <TanstackDevtools
          config={{
            position: "bottom-left",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </Providers>
    </>
  ),
});
