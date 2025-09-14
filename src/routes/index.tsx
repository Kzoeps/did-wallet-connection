import { useBlueskyAuth } from "@/providers/oauth-provider";
import {
  addWalletAddress,
  getWalletAttestation,
  type PasskeyWalletRes,
} from "@/utils/passkey-actions";
import {
  useCreateWallet,
  useLoginWithPasskey,
  useSignupWithPasskey,
  useUser,
} from "@privy-io/react-auth";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { useAccount } from "wagmi";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { signIn, signOut, session, isReady, state } = useBlueskyAuth();

  // Create embedded wallet on signup success
  const { createWallet } = useCreateWallet({
    onSuccess: async ({ wallet }) => {
      if (wallet.address && session) {
        await addWalletAddress(session, { address: wallet.address });
        await fetchAttestation();
      }
    },
  });

  const { address, isConnected } = useAccount();
  const { user } = useUser();

  // --- Passkey hooks ---
  const { signupWithPasskey } = useSignupWithPasskey({
    onComplete: async ({ user: signedupUser }) => {
      if (
        signedupUser &&
        signedupUser?.linkedAccounts?.[0]?.type === "passkey" &&
        session
      ) {
        try {
          const wallet = await createWallet();
          await addWalletAddress(session, { address: wallet.address });
          await fetchAttestation();
        } catch (e) {
          console.log("failed while creating wallet", e);
        }
      }
    },
  });
  const { loginWithPasskey } = useLoginWithPasskey();

  // --- Local state ---
  const [handle, setHandle] = useState("");

  // Attestation state
  const [attestationRecord, setAttestationRecord] =
    useState<PasskeyWalletRes | null>(null);
  const [attestedAddress, setAttestedAddress] = useState<`0x${string}` | null>(
    null
  );
  const [attestationLoading, setAttestationLoading] = useState(false);

  // Verification state (now derived from address comparison)
  const [recordVerified, setRecordVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const canLogin = useMemo(() => handle.trim().length > 0, [handle]);

  // Privy authenticated wallet (what the user is logged in with)
  const privyWalletAddress = useMemo(
    () => (user?.wallet?.address ? (user.wallet.address as `0x${string}`) : null),
    [user?.wallet?.address]
  );

  // Compare record vs authenticated (Privy) wallet
  const addressesMatch = useMemo(() => {
    if (!attestedAddress || !privyWalletAddress) return false;
    try {
      return getAddress(attestedAddress) === getAddress(privyWalletAddress);
    } catch {
      return false;
    }
  }, [attestedAddress, privyWalletAddress]);

  useEffect(() => {
    setRecordVerified(addressesMatch);
  }, [addressesMatch]);

  useEffect(() => {
    if (user) console.log(user);
  }, [user]);

  // ---- Fetch attestation from repo (NO WebAuthn calls here) ----
  const fetchAttestation = useCallback(async () => {
    if (!session) {
      setAttestedAddress(null);
      setAttestationRecord(null);
      setRecordVerified(false);
      return;
    }
    setAttestationLoading(true);
    try {
      const rec = await getWalletAttestation(session);
      if (rec?.address) {
        setAttestationRecord(rec);
        setAttestedAddress(rec.address);
        // If there's a record, we can prompt login/verify to refresh the Privy session
        // (kept from your original flow)
        handleCreateOrVerifyPasskey();
      } else {
        setAttestationRecord(null);
        setAttestedAddress(null);
        setRecordVerified(false);
      }
    } catch {
      setAttestationRecord(null);
      setAttestedAddress(null);
      setRecordVerified(false);
    } finally {
      setAttestationLoading(false);
    }
  }, [session]);

  // Initial & on-session-change fetch
  useEffect(() => {
    void fetchAttestation();
  }, [fetchAttestation]);

  // ---- User-gesture handlers for WebAuthn ----
  const handleCreateOrVerifyPasskey = useCallback(async () => {
    if (!isReady || !session) return;
    setVerifyLoading(true);
    try {
      if (attestationRecord) {
        await loginWithPasskey();
      } else {
        await signupWithPasskey();
      }
      await fetchAttestation();
    } finally {
      setVerifyLoading(false);
    }
  }, [attestationRecord, loginWithPasskey, signupWithPasskey, fetchAttestation, isReady, session]);

  const handleReverify = useCallback(async () => {
    if (!isReady || !session) return;
    setVerifyLoading(true);
    try {
      await loginWithPasskey();
      await fetchAttestation();
    } finally {
      setVerifyLoading(false);
    }
  }, [loginWithPasskey, fetchAttestation, isReady, session]);

  // UI helpers (keep Wagmi hint)
  const connectedVsRecordNote =
    isConnected && attestedAddress
      ? getAddress(address as `0x${string}`) === getAddress(attestedAddress)
        ? "Connected wallet (Wagmi) matches record."
        : "Connected wallet (Wagmi) differs from record."
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 tracking-tight">
            Bluesky Login
          </h1>
          <h2>Embedded Wallets</h2>
        </header>

        <main className="relative">
          {/* glow */}
          <div className="pointer-events-none absolute inset-0 blur-3xl opacity-30 -z-10 bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 rounded-[2rem]" />
          <div className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-xl rounded-3xl p-6 sm:p-8">
            {!isReady ? (
              <p className="text-center text-gray-600">Loading…</p>
            ) : session ? (
              <div className="flex flex-col items-center gap-6 text-center">
                {/* Session pill */}
                <div className="flex flex-col items-center gap-2">
                  <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center text-lg font-semibold shadow-md">
                    {session.sub?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <p className="text-gray-700">
                      Signed in as{" "}
                      <span className="font-medium break-all">
                        {session.sub}
                      </span>
                    </p>
                    {state && (
                      <p className="text-xs text-gray-500 mt-1">state: {state}</p>
                    )}
                  </div>
                </div>

                {/* MATCH STATUS BADGE */}
                <div className="w-full flex justify-center">
                  {attestationLoading || verifyLoading ? (
                    <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Checking…
                    </span>
                  ) : attestedAddress && privyWalletAddress ? (
                    addressesMatch ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-7.071 7.07a1 1 0 01-1.414 0L3.293 9.848a1 1 0 111.414-1.415l3.1 3.101 6.364-6.364a1 1 0 011.536.123z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Authenticated wallet matches wallet on record
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5zM10 14a1 1 0 100 2 1 1 0 000-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Wallets do not match
                      </span>
                    )
                  ) : null}
                </div>

                {/* TWO-CARD LAYOUT */}
                <div className="grid w-full grid-cols-1 gap-4">
                  {/* Wallet on record */}
                  <div className="rounded-xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800">Wallet on record</p>
                      {recordVerified ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Unverified
                        </span>
                      )}
                    </div>

                    {attestationLoading ? (
                      <p className="text-sm text-gray-500 mt-2">Loading…</p>
                    ) : attestedAddress ? (
                      <>
                        <p className="text-sm text-gray-700 mt-2 break-all">{attestedAddress}</p>
                        {connectedVsRecordNote && (
                          <p className="text-xs mt-1 text-gray-500">{connectedVsRecordNote}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {!recordVerified && (
                            <button
                              onClick={handleReverify}
                              disabled={verifyLoading}
                              className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:opacity-95 border border-indigo-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                            >
                              Verify with Passkey
                            </button>
                          )}
                          <button
                            onClick={() => fetchAttestation()}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                          >
                            Refresh status
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 mt-2">None linked yet.</p>
                        <div className="mt-3">
                          <button
                            onClick={handleCreateOrVerifyPasskey}
                            disabled={verifyLoading || !isReady || attestationLoading}
                            className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:opacity-95 border border-emerald-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60"
                          >
                            Create Passkey & Link Wallet
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Authenticated wallet (Privy) */}
                  <div className="rounded-xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800">Authenticated wallet (Privy)</p>
                      {privyWalletAddress ? (
                        addressesMatch ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Matches record
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                            Differs from record
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                          Not available
                        </span>
                      )}
                    </div>

                    {privyWalletAddress ? (
                      <p className="text-sm text-gray-700 mt-2 break-all">{privyWalletAddress}</p>
                    ) : (
                      <p className="text-sm text-gray-500 mt-2">
                        Sign in with Privy or complete passkey verification to populate.
                      </p>
                    )}
                  </div>
                </div>

                {/* Wallet connection hint */}
                {!isConnected && (
                  <p className="text-xs text-gray-500">Connect your wallet first using the button above.</p>
                )}

                <button
                  onClick={signOut}
                  className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="bsky-handle"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Bluesky handle
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      @
                    </span>
                    <input
                      id="bsky-handle"
                      type="text"
                      inputMode="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      placeholder="yourname.bsky.social"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white/80 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Enter your full handle (e.g. <code>yourname.bsky.social</code>).
                  </p>
                </div>

                <button
                  disabled={!canLogin}
                  onClick={() => signIn(handle.trim(), { state: "from-login" })}
                  className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:opacity-95 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Login
                </button>

                <p className="text-xs text-gray-500 text-center">
                  We’ll redirect you to Bluesky to complete sign in.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default RouteComponent;

// import { useBlueskyAuth } from "@/providers/oauth-provider";
// import {
//   addWalletAddress,
//   getWalletAttestation,
//   type PasskeyWalletRes,
// } from "@/utils/passkey-actions";
// import {
//   useCreateWallet,
//   useLoginWithPasskey,
//   useSignupWithPasskey,
//   useUser,
// } from "@privy-io/react-auth";
// import { createFileRoute } from "@tanstack/react-router";
// import { useCallback, useEffect, useMemo, useState } from "react";
// import { getAddress } from "viem";
// import { useAccount } from "wagmi";

// export const Route = createFileRoute("/")({
//   component: RouteComponent,
// });

// function RouteComponent() {
//   const { signIn, signOut, session, isReady, state } = useBlueskyAuth();
//   // privy atuoamatci creation doesnt seemt o work might be cause react 19 or might not be couldf igureit out
//   const { createWallet } = useCreateWallet({
//     onSuccess: async ({ wallet }) => {
//       console.log("wallet created adding to add wallet address");
//       console.log(wallet);
//       if (wallet.address && session) {
//         console.log("adding to wallet address now", {
//           address: wallet.address,
//         });
//         await addWalletAddress(session, { address: wallet.address });
//         await fetchAttestation();
//       }
//     },
//   });
//   const { address, isConnected } = useAccount();
//   const { user } = useUser();

//   // --- Passkey hooks ---
//   const { signupWithPasskey } = useSignupWithPasskey({
//     onComplete: async ({ user: signedupUser }) => {
//       // After successful signup, persist wallet on record
//       console.log(signedupUser);
//       console.log(signedupUser, session);
//       console.log("successfully created user with passkey");
//       if (
//         signedupUser &&
//         signedupUser?.linkedAccounts?.[0]?.type === "passkey" &&
//         session
//       ) {
//         try {
//           console.log("createing wallted tnow");
//           // onsuccvess hook doesnt seem to work properoly with 19
//           const wallet = await createWallet();
//           console.log("created wallet", wallet);
//           console.log("adding wallte address");
//           const res = await addWalletAddress(session, {
//             address: wallet.address,
//           });
//           console.log("ADDED WALLET ADRESSS", res);
//           await fetchAttestation();
//         } catch (e) {
//           console.log("failed while creating wallet", e);
//         }
//       }
//     },
//   });
//   const { loginWithPasskey } = useLoginWithPasskey();

//   // --- Local state ---
//   const [handle, setHandle] = useState("");

//   // Attestation state
//   const [attestationRecord, setAttestationRecord] =
//     useState<PasskeyWalletRes | null>(null);
//   const [attestedAddress, setAttestedAddress] = useState<`0x${string}` | null>(
//     null
//   );
//   const [attestationLoading, setAttestationLoading] = useState(false);

//   // Verification state
//   const [recordVerified, setRecordVerified] = useState(false);
//   const [verifyLoading, setVerifyLoading] = useState(false);

//   const canLogin = useMemo(() => handle.trim().length > 0, [handle]);

//   useEffect(() => {
//     if (user) console.log(user);
//   }, [user]);

//   // ---- Fetch attestation from repo (NO WebAuthn calls here) ----
//   const fetchAttestation = useCallback(async () => {
//     if (!session) {
//       setAttestedAddress(null);
//       setAttestationRecord(null);
//       setRecordVerified(false);
//       return;
//     }
//     setAttestationLoading(true);
//     try {
//       const rec = await getWalletAttestation(session);
//       if (rec?.address) {
//         setAttestationRecord(rec);
//         setAttestedAddress(rec.address);
//         // if address on  record ask for connect with paskey
//         handleCreateOrVerifyPasskey();
//       } else {
//         // No record yet
//         setAttestationRecord(null);
//         setAttestedAddress(null);
//         setRecordVerified(false);
//       }
//     } catch (e) {
//       // Treat any error as no record/unknown state; surface via UI copy
//       setAttestationRecord(null);
//       setAttestedAddress(null);
//       setRecordVerified(false);
//     } finally {
//       setAttestationLoading(false);
//     }
//   }, [session, isConnected, address]);

//   // Initial & on-session-change fetch
//   useEffect(() => {
//     void fetchAttestation();
//   }, [fetchAttestation]);

//   // ---- User-gesture handlers for WebAuthn ----
//   const handleCreateOrVerifyPasskey = useCallback(async () => {
//     // Gate on readiness & session
//     if (!isReady || !session) return;
//     setVerifyLoading(true);
//     try {
//       if (attestationRecord) {
//         // Existing record → verify/login
//         await loginWithPasskey();
//       } else {
//         // No record → create/register
//         await signupWithPasskey();
//       }
//       // After success, re-fetch to update view
//       await fetchAttestation();
//     } finally {
//       setVerifyLoading(false);
//     }
//   }, [
//     attestationRecord,
//     loginWithPasskey,
//     signupWithPasskey,
//     fetchAttestation,
//     isReady,
//     session,
//   ]);

//   const handleReverify = useCallback(async () => {
//     if (!isReady || !session) return;
//     setVerifyLoading(true);
//     try {
//       await loginWithPasskey();
//       await fetchAttestation();
//     } finally {
//       setVerifyLoading(false);
//     }
//   }, [loginWithPasskey, fetchAttestation, isReady, session]);

//   // UI helpers
//   const connectedVsRecordNote =
//     isConnected && attestedAddress
//       ? getAddress(address as `0x${string}`) === getAddress(attestedAddress)
//         ? "Connected wallet matches record."
//         : "Connected wallet differs from record."
//       : null;

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
//       <div className="mx-auto max-w-2xl px-4 py-10">
//         <header className="flex items-center justify-between mb-8">
//           <h1 className="text-xl sm:text-2xl font-semibold text-gray-800 tracking-tight">
//             Bluesky Login
//           </h1>
//           <h2>Embedded Wallets</h2>
//         </header>

//         <main className="relative">
//           {/* glow */}
//           <div className="pointer-events-none absolute inset-0 blur-3xl opacity-30 -z-10 bg-gradient-to-br from-blue-200 via-indigo-200 to-purple-200 rounded-[2rem]" />
//           <div className="backdrop-blur-xl bg-white/70 border border-white/60 shadow-xl rounded-3xl p-6 sm:p-8">
//             {!isReady ? (
//               <p className="text-center text-gray-600">Loading…</p>
//             ) : session ? (
//               <div className="flex flex-col items-center gap-5 text-center">
//                 {/* Session pill */}
//                 <div className="flex flex-col items-center gap-2">
//                   <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white grid place-items-center text-lg font-semibold shadow-md">
//                     {session.sub?.[0]?.toUpperCase() ?? "U"}
//                   </div>
//                   <div>
//                     <p className="text-gray-700">
//                       Signed in as{" "}
//                       <span className="font-medium break-all">
//                         {session.sub}
//                       </span>
//                     </p>
//                     {state && (
//                       <p className="text-xs text-gray-500 mt-1">
//                         state: {state}
//                       </p>
//                     )}
//                   </div>
//                 </div>

//                 {/* Wallet on record + verification */}
//                 <div className="w-full rounded-xl border border-gray-200 bg-white/70 p-4 text-left shadow-sm">
//                   <div className="flex items-center justify-between gap-3">
//                     <p className="text-sm font-medium text-gray-800">
//                       Wallet on record
//                     </p>
//                     {/* Badge */}
//                     {attestationLoading || verifyLoading ? (
//                       <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
//                         <svg
//                           className="h-3.5 w-3.5 animate-spin"
//                           viewBox="0 0 24 24"
//                           fill="none"
//                         >
//                           <circle
//                             className="opacity-30"
//                             cx="12"
//                             cy="12"
//                             r="10"
//                             stroke="currentColor"
//                             strokeWidth="3"
//                           />
//                           <path
//                             d="M22 12a10 10 0 0 1-10 10"
//                             stroke="currentColor"
//                             strokeWidth="3"
//                             strokeLinecap="round"
//                           />
//                         </svg>
//                         Checking…
//                       </span>
//                     ) : attestedAddress ? (
//                       <div className="flex items-center gap-2">
//                         {recordVerified ? (
//                           <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 20 20"
//                               fill="currentColor"
//                             >
//                               <path
//                                 fillRule="evenodd"
//                                 d="M16.707 5.293a1 1 0 010 1.414l-7.071 7.07a1 1 0 01-1.414 0L3.293 9.848a1 1 0 111.414-1.415l3.1 3.101 6.364-6.364a1 1 0 011.536.123z"
//                                 clipRule="evenodd"
//                               />
//                             </svg>
//                             wallet ownership verified
//                           </span>
//                         ) : (
//                           <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
//                             <svg
//                               width="14"
//                               height="14"
//                               viewBox="0 0 20 20"
//                               fill="currentColor"
//                             >
//                               <path
//                                 fillRule="evenodd"
//                                 d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v5a.75.75 0 001.5 0v-5zM10 14a1 1 0 100 2 1 1 0 000-2z"
//                                 clipRule="evenodd"
//                               />
//                             </svg>
//                             Record unverified
//                           </span>
//                         )}
//                       </div>
//                     ) : null}
//                   </div>

//                   {attestationLoading ? (
//                     <p className="text-sm text-gray-500 mt-2">Loading…</p>
//                   ) : attestedAddress ? (
//                     <>
//                       <p className="text-sm text-gray-700 mt-2 break-all">
//                         {attestedAddress}
//                       </p>
//                       {connectedVsRecordNote && (
//                         <p className="text-xs mt-1 text-gray-500">
//                           {connectedVsRecordNote}
//                         </p>
//                       )}

//                       {/* Action row */}
//                       <div className="mt-3 flex flex-wrap items-center gap-2">
//                         {!recordVerified && (
//                           <button
//                             onClick={handleReverify}
//                             disabled={verifyLoading}
//                             className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:opacity-95 border border-indigo-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
//                           >
//                             Verify with Passkey
//                           </button>
//                         )}
//                         <button
//                           onClick={() => fetchAttestation()}
//                           className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
//                         >
//                           Refresh status
//                         </button>
//                       </div>
//                     </>
//                   ) : (
//                     <>
//                       <p className="text-sm text-gray-500 mt-2">
//                         None linked yet.
//                       </p>
//                       <div className="mt-3">
//                         <button
//                           onClick={handleCreateOrVerifyPasskey}
//                           disabled={
//                             verifyLoading || !isReady || attestationLoading
//                           }
//                           className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:opacity-95 border border-emerald-600 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-60"
//                         >
//                           Create Passkey & Link Wallet
//                         </button>
//                       </div>
//                     </>
//                   )}
//                 </div>

//                 <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

//                 {/* Wallet connection hint */}
//                 {!isConnected && (
//                   <p className="text-xs text-gray-500">
//                     Connect your wallet first using the button above.
//                   </p>
//                 )}

//                 <button
//                   onClick={signOut}
//                   className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
//                 >
//                   Sign out
//                 </button>
//               </div>
//             ) : (
//               <div className="space-y-5">
//                 <div className="space-y-2">
//                   <label
//                     htmlFor="bsky-handle"
//                     className="block text-sm font-medium text-gray-700"
//                   >
//                     Bluesky handle
//                   </label>
//                   <div className="relative">
//                     <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
//                       @
//                     </span>
//                     <input
//                       id="bsky-handle"
//                       type="text"
//                       inputMode="text"
//                       autoCapitalize="none"
//                       autoCorrect="off"
//                       placeholder="yourname.bsky.social"
//                       className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-300 bg-white/80 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
//                       value={handle}
//                       onChange={e =>
//                         setHandle(e.target.value.replace(/^@/, ""))
//                       }
//                     />
//                   </div>
//                   <p className="text-xs text-gray-500">
//                     Enter your full handle (e.g.{" "}
//                     <code>yourname.bsky.social</code>).
//                   </p>
//                 </div>

//                 <button
//                   disabled={!canLogin}
//                   onClick={() => signIn(handle.trim(), { state: "from-login" })}
//                   className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md hover:opacity-95 transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
//                 >
//                   Login
//                 </button>

//                 <p className="text-xs text-gray-500 text-center">
//                   We’ll redirect you to Bluesky to complete sign in.
//                 </p>
//               </div>
//             )}
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }

// export default RouteComponent;
