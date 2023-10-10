import converter from 'bech32-converting';
import BigNumber from 'bignumber.js';

import { insertCancelStreamEvents, insertClaimEvents, insertCreateStreamEvents, insertFinishedEvents } from './supabase';

const allowedFunctions = [
  "createStream",
  "createStreamDuration",
  "claimFromStream",
  "cancelStream",
  "claimFromStreamAfterCancel",
];
const allowedEvents = ["createStream", "claimFromStream", "cancelStream", "finishedStream"];

export enum EventStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  FINALIZED = "finalized",
}

const parseEvents = (events: any[]) => {
  const eventsToParse = events.filter((e) => allowedFunctions.includes(e.identifier));

  return eventsToParse.map((e) => {
    e.eventName = Buffer.from(e.topics[0], "base64").toString("utf-8");
    return e;
  });
};

const decodeBase64Number = (base64Str: string) =>
  base64Str ? parseInt(Buffer.from(base64Str, "base64").toString("hex"), 16) : 0;

const decodeCreateStreamEvent = (event: any) => {
  const [
    _eventName,
    _sender,
    _recipient,
    _stream_nft_token_identifier,
    _stream_nft_token_nonce,
    _payment_token,
    _payment_nonce,
    _deposit,
    _deposit_with_fees,
    _start_time,
    _end_time,
    _can_cancel,
    _cliff,
  ] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    id: decodeBase64Number(_stream_nft_token_nonce),
    sender: converter("erd").toBech32(Buffer.from(_sender, "base64").toString("hex")),
    recipient: converter("erd").toBech32(Buffer.from(_recipient, "base64").toString("hex")),
    stream_nft_identifier: Buffer.from(_stream_nft_token_identifier, "base64").toString("utf-8"),
    stream_nft_nonce: decodeBase64Number(_stream_nft_token_nonce),
    payment_token: Buffer.from(_payment_token, "base64").toString("utf-8"),
    payment_nonce: decodeBase64Number(_payment_nonce),
    deposit: BigNumber(Buffer.from(_deposit, "base64").toString("hex"), 16).toString(),
    deposit_with_fees: BigNumber(Buffer.from(_deposit_with_fees, "base64").toString("hex"), 16).toString(),
    start_time: new Date(decodeBase64Number(_start_time) * 1000),
    end_time: new Date(decodeBase64Number(_end_time) * 1000),
    can_cancel: _can_cancel ? Buffer.from(_can_cancel, "base64").toString("hex") === "01" : false,
    cliff: decodeBase64Number(_cliff),
  };
};
const decodeClaimFromStreamEvent = (event: any) => {
  const [_eventName, _streamId, _amount, _recipient] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    amount: BigNumber(Buffer.from(_amount, "base64").toString("hex"), 16).toString(),
    recipient: converter("erd").toBech32(Buffer.from(_recipient, "base64").toString("hex")),
  };
};
const decodeCancelStreamEvent = (event: any) => {
  const [_eventName, _streamId, _canceledBy, _claimedAmount] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    canceledBy: converter("erd").toBech32(Buffer.from(_canceledBy, "base64").toString("hex")),
    claimedAmount: BigNumber(Buffer.from(_claimedAmount || "0", "base64").toString("hex"), 16).toString(),
  };
};

const decodeFinishedStreamEvent = (event: any) => {
  const [_eventName, _streamId] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
  };
};

const decodeMethods = {
  createStream: decodeCreateStreamEvent,
  claimFromStream: decodeClaimFromStreamEvent,
  cancelStream: decodeCancelStreamEvent,
  finishedStream: decodeFinishedStreamEvent,
};

const processEvents = (_events: any[]) => {
  const parsedEvents: any = {
    createStream: [],
    claimFromStream: [],
    cancelStream: [],
    finishedStream: [],
  };

  const eventsToParse = parseEvents(_events);

  eventsToParse.forEach((e) => {
    // @ts-ignore
    e.decoded = decodeMethods[e.eventName](e);

    if (e.decoded) {
      // @ts-ignore
      parsedEvents[e.eventName]?.push({
        ...e,
        hash: e.txHash,
      });
    }
  });

  return parsedEvents;
};

export const run = async (_events: any[]) => {
  console.log(`Processing ${_events.length} event(s)`);

  const events = processEvents(_events);

  try {
    if (events?.createStream?.length) {
      await insertCreateStreamEvents(events.createStream);
    }
    if (events?.cancelStream?.length) {
      await insertCancelStreamEvents(events.cancelStream);
    }
    if (events?.claimFromStream?.length) {
      await insertClaimEvents(events.claimFromStream);
    }
    if (events?.finishedStream?.length) {
      await insertFinishedEvents(events.finishedStream);
    }
  } catch (e) {
    console.log(e);
  }
};
