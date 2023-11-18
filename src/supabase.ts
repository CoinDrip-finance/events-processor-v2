import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

import { getTokenData } from "./api";
import { EventStatus } from "./events";
import { CancelStreamEvent, ClaimStreamEvent, CreateStreamEvent, FinishedStreamEvent } from "./EventsParser";

export const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE as string);

const TABLE_PREFIX = process.env.TABLE_PREFIX || "";

export const insertCreateStreamEvents = async (eventsList: CreateStreamEvent[]) => {
  const eventsToInsert = [];
  for (let i = 0; i < eventsList.length; i++) {
    const event = eventsList[i];
    const tokenData = await getTokenData(event.payment_token);

    const segments = event.segments.map((s) => {
      return {
        amount: s.amount.toString(),
        exponent: s.exponent.toNumber(),
        duration: s.duration.toNumber(),
      };
    });

    const toInsert = {
      ...tokenData,
      id: event.stream_token_nonce.toNumber(),
      sender: event.sender.bech32(),
      recipient: event.recipient.bech32(),
      stream_nft_identifier: event.stream_token_identifier,
      stream_nft_nonce: event.stream_token_nonce.toNumber(),
      payment_token: event.payment_token,
      payment_nonce: event.payment_nonce.toNumber(),
      deposit: event.deposit.toString(),
      deposit_with_fees: event.deposit_with_fees.toString(),
      start_time: new Date(event.start_time.toNumber() * 1000),
      end_time: new Date(event.end_time.toNumber() * 1000),
      can_cancel: event.can_cancel,
      cliff: event.cliff.toNumber(),
      segments: JSON.stringify(segments),
      status: EventStatus.ACTIVE,
      tx_hash: event.hash,
    };

    eventsToInsert.push(toInsert);
  }

  await supabase.from(`${TABLE_PREFIX}streams`).upsert(eventsToInsert, { ignoreDuplicates: true });
};

export const insertCancelStreamEvents = async (eventsList: CancelStreamEvent[]) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.stream_id.toNumber(),
      canceled_by: event.canceled_by.bech32(),
      tx_hash: event.hash,
      streamed_until_cancel: event.claimed_amount.toString(),
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

export const insertClaimEvents = async (eventsList: ClaimStreamEvent[]) => {
  const eventsToInsert = eventsList.map((event) => {
    return {
      id: event.stream_id.toNumber(),
      amount: event.amount.toString(),
      recipient: event.recipient.bech32(),
      tx_hash: event.hash,
    };
  });

  await supabase.from(`${TABLE_PREFIX}stream_claims`).upsert(eventsToInsert, { ignoreDuplicates: true });
};

export const insertFinishedEvents = async (eventsList: FinishedStreamEvent[]) => {
  const streamIds = eventsList.map((event) => {
    return event.stream_id.toNumber();
  });

  await supabase.from(`${TABLE_PREFIX}streams`).update({ status: EventStatus.FINALIZED }).in("id", streamIds);
};
