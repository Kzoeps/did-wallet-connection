import {
  Agent,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoListRecords,
} from "@atproto/api";
import type { SessionManager } from "@atproto/api/dist/session-manager";
import type { OAuthSession } from "@atproto/oauth-client-browser";

const formatListRecordsResponse = (
  response: ComAtprotoRepoListRecords.Response
) => {
  return response.data.records.map(record => ({
    ...record.value,
    uri: record.uri,
  }));
};

const formatGetRecordResponse = (
  response: ComAtprotoRepoGetRecord.Response
) => {
  return { ...response.data.value, uri: response.data.uri };
};

interface WalletAttestationPayload {
  address: `0x${string}`;
  attestation: `0x${string}`;
}

const WALLET_COLLECTION = "com.hypercert.walletAttestationTest";

export async function createWalletAttestation(
  session: OAuthSession,
  payload: WalletAttestationPayload
) {
  try {
    const collection = "com.hypercert.walletAttestationTest";
    const record = {
      $type: collection,
      ...payload,
    };
    const agent = new Agent(session);
    const res = await agent.com.atproto.repo.putRecord({
      repo: agent.assertDid,
      collection,
      rkey: "self",
      record,
      validate: false,
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
export type WalletAttestationTest = {
  $type: "com.hypercert.walletAttestationTest";
  address: string;
  attestation: string;
  uri: string;
};

export async function getWalletAttestation(
  session: OAuthSession
): Promise<WalletAttestationTest> {
  const agent = new Agent(session);
  const res = await agent.com.atproto.repo.getRecord({
    repo: agent.assertDid,
    collection: WALLET_COLLECTION,
    rkey: "self",
  });
  return formatGetRecordResponse(res) as WalletAttestationTest;
}
