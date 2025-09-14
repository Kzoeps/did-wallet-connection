import { useContext } from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import {
  BrowserOAuthClient,
  type OAuthSession,
} from "@atproto/oauth-client-browser";
import { METADATA } from "@/utils/constants";
import { usePrivy } from "@privy-io/react-auth";

/**
 * Context shape
 */
export type BlueskyAuthContextValue = {
  client: BrowserOAuthClient | null;
  session: OAuthSession | null;
  state?: string;
  isReady: boolean;
  error?: unknown;

  // helpers
  signIn: (
    handleOrDidOrPds: string,
    opts?: { state?: string }
  ) => Promise<never>; // redirects
  signOut: () => Promise<void>;
};

export const BlueskyAuthContext = createContext<BlueskyAuthContextValue>({
  client: null,
  session: null,
  isReady: false,
  signIn: async () => {
    // This never resolves because it redirects
    throw new Error("BlueskyAuthProvider not mounted yet.");
  },
  signOut: async () => {
    throw new Error("BlueskyAuthProvider not mounted yet.");
  },
});

/**
 * Provider
 *
 * Usage:
 * <BlueskyAuthProvider>
 *   <App />
 * </BlueskyAuthProvider>
 */
export function BlueskyAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [state, setState] = useState<string | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isReady, setIsReady] = useState(false);
  const { logout } = usePrivy();

  // Keep a stable client instance
  const clientRef = useRef<BrowserOAuthClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        clientRef.current = new BrowserOAuthClient({
          clientMetadata: METADATA,
          handleResolver: "https://bsky.social",
        });

        const result = await clientRef.current.init();
        if (!cancelled && result?.session) {
          setSession(result.session);
          //@ts-expect-error state is transient and only when the user has authorized
          setState(result.state);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helpers
  const signIn = useCallback<BlueskyAuthContextValue["signIn"]>(
    async (handleOrDidOrPds: string, opts) => {
      const c = clientRef.current;
      if (!c) throw new Error("OAuth client not ready");
      // NOTE: This redirects away and the Promise never resolves (by design).
      return c.signIn(handleOrDidOrPds, {
        state: opts?.state,
      });
    },
    []
  );

  const signOut = useCallback(async () => {
    await logout();
    const browserClient = clientRef.current;
    if (!browserClient) return;
    if (session) {
      localStorage.clear();
      sessionStorage.clear();
    }
    setSession(null);
    setState(undefined);
  }, [session]);

  const value = useMemo<BlueskyAuthContextValue>(
    () => ({
      client: clientRef.current,
      session,
      state,
      isReady,
      error,
      signIn,
      signOut,
    }),
    [session, state, isReady, error, signIn, signOut]
  );

  return (
    <BlueskyAuthContext.Provider value={value}>
      {children}
    </BlueskyAuthContext.Provider>
  );
}

export function useBlueskyAuth() {
  return useContext(BlueskyAuthContext);
}
