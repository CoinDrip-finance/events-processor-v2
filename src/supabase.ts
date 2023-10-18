import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { getTokenData } from "./api";
import { EventStatus } from "./events";

export const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE as string);

const TABLE_PREFIX = process.env.TABLE_PREFIX || "";

export const insertCreateStreamEvents = async (eventsList: any[]) => {
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

export const insertCancelStreamEvents = async (eventsList: any[]) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.decoded.streamId,
      canceled_by: event.decoded.canceledBy,
      tx_hash: event.hash,
      streamed_until_cancel: event.decoded.claimedAmount,
    };
  });

  await supabase.from(`${TABLE_PREFIX}canceled_streams`).upsert(eventsToInsert, { ignoreDuplicates: true });

  await supabase
    .from(`${TABLE_PREFIX}streams`)
    .update({ status: EventStatus.CANCELLED })
    .in(
      "id",
      eventsToInsert.map((e) => e.id)
    );
};

export const insertClaimEvents = async (eventsList: any[]) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.decoded.streamId,
      amount: event.decoded.amount,
      recipient: event.decoded.recipient,
      tx_hash: event.hash,
    };
  });

  await supabase.from(`${TABLE_PREFIX}stream_claims`).upsert(eventsToInsert, { ignoreDuplicates: true });
};

export const insertFinishedEvents = async (eventsList: any[]) => {
  const streamIds = eventsList.map((event) => {
    return event.decoded.streamId;
  });

  await supabase.from(`${TABLE_PREFIX}streams`).update({ status: EventStatus.FINALIZED }).in("id", streamIds);
};
