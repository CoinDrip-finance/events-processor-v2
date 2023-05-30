import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { getTokenData } from "./api";
import { EventStatus } from "./events";

export const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE as string);

const TABLE_PREFIX = process.env.TABLE_PREFIX || "";

export const insertCreateStreamEvents = async (eventsList) => {
  const eventsToInsert = [];
  for (let i = 0; i < eventsList.length; i++) {
    const event = eventsList[i];
    const tokenData = await getTokenData(event.decoded.payment_token);

    const toInsert = {
      ...event.decoded,
      ...tokenData,
      status: EventStatus.ACTIVE,
      tx_hash: event.hash,
    };
    eventsToInsert.push(toInsert);
  }

  await supabase.from(`${TABLE_PREFIX}streams`).upsert(eventsToInsert, { ignoreDuplicates: true });
};

export const insertCancelStreamEvents = async (eventsList) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.decoded.streamId,
      canceled_by: event.decoded.canceledBy,
      tx_hash: event.hash,
      claimed_amount: event.decoded.claimedAmount,
    };
  });

  await supabase.from(`${TABLE_PREFIX}canceled_streams`).upsert(eventsToInsert, { ignoreDuplicates: true });

  for (let i = 0; i < eventsToInsert.length; i++) {
    const event = eventsToInsert[i];

    await supabase.from(`${TABLE_PREFIX}streams`).update({ status: EventStatus.CANCELLED }).eq("id", event.id);
  }
};

export const insertClaimEvents = async (eventsList) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.decoded.streamId,
      amount: event.decoded.amount,
      tx_hash: event.hash,
    };
  });

  await supabase.from(`${TABLE_PREFIX}stream_claims`).upsert(eventsToInsert, { ignoreDuplicates: true });

  const finalizedClaims = eventsList.filter((e) => e.decoded.finalized).map((e) => e.decoded.streamId);
  for (let i = 0; i < finalizedClaims.length; i++) {
    const streamId = finalizedClaims[i];

    await supabase.from(`${TABLE_PREFIX}streams`).update({ status: EventStatus.FINALIZED }).eq("id", streamId);
  }
};
