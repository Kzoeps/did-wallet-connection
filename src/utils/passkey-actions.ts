import {
  Agent,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoListRecords,
} from "@atproto/api";
import type { OAuthSession } from "@atproto/oauth-client-browser";

export const formatListRecordsResponse = (
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

export interface PasskeyWalletTest {
  address: string;
}

const WALLET_COLLECTION = "com.hypercert.walletPasskeyTest";

export async function addWalletAddress(
  session: OAuthSession,
  payload: PasskeyWalletTest
) {
  try {
    const collection = WALLET_COLLECTION;
    const record = {
      $type: WALLET_COLLECTION,
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
export type PasskeyWalletRes = {
  $type: string;
  address: `0x${string}`;
  uri: string;
};

export async function getWalletAttestation(
  session: OAuthSession
): Promise<PasskeyWalletRes> {
  const agent = new Agent(session);
  const res = await agent.com.atproto.repo.getRecord({
    repo: agent.assertDid,
    collection: WALLET_COLLECTION,
    rkey: "self",
  });
  return formatGetRecordResponse(res) as PasskeyWalletRes;
}
