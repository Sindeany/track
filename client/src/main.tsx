import { safeSessionStorage } from "./lib/safeStorage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const demoRole = safeSessionStorage.getItem("field-visits-demo-role");
        return demoRole ? { "x-field-visits-demo-role": demoRole } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    }),
  ],
});

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>,
  );
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(registration => {
          registration.update().catch(() => {});
        })
        .catch(err => {
          console.warn("[SW] Registration error ignored on this browser:", err);
        });
    } catch {
      // Ignore service worker registration failure on restricted environments
    }
  });
}
