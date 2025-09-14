import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { PrivyProvider } from "@privy-io/react-auth";
import { arbitrum, base, mainnet, optimism, polygon } from "wagmi/chains";
import { BlueskyAuthProvider } from "./oauth-provider";
const config = getDefaultConfig({
  appName: "test rainbokwi",
  projectId: "RainBowClient",
  chains: [mainnet, polygon, optimism, arbitrum, base],
  ssr: true, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BlueskyAuthProvider>
            <PrivyProvider
              appId="cmfgrvs5i00e8ie0c1sdga175"
              clientId="client-WY6QhUSpN3KxhqYQ85qPTAD4RD1yvgPbTK7Dqo583z11A"
              config={{
                embeddedWallets: {
                  ethereum: {
                    createOnLogin: "all-users",
                  },
                },
              }}
            >
              {children}
            </PrivyProvider>
          </BlueskyAuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
