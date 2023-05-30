import BigNumber from "bignumber.js";

import { insertCancelStreamEvents, insertClaimEvents, insertCreateStreamEvents } from "./supabase";

const allowedFunctions = ["createStream", "claimFromStream", "cancelStream", "claimFromStreamAfterCancel"];
const allowedEvents = ["createStream", "claimFromStream", "cancelStream"];

export enum EventStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  FINALIZED = "finalized",
}

const parseEvents = (events) => {
  const eventsToParse = events.filter((e) => allowedFunctions.includes(e.identifier));

  return eventsToParse.map((e) => {
    e.eventName = Buffer.from(e.topics[0], "base64").toString("utf-8");
    return e;
  });
};

const decodeBase64Number = (base64Str) => parseInt(Buffer.from(base64Str, "base64").toString("hex"), 16);

const decodeCreateStreamEvent = (event) => {
  const [_eventName, _streamId, _sender, _recipient, _payment_token, _payment_nonce, _deposit, _start_time, _end_time] =
    event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    id: decodeBase64Number(_streamId),
    sender: Buffer.from(_sender, "base64").toString("hex"),
    recipient: Buffer.from(_recipient, "base64").toString("hex"),
    payment_token: Buffer.from(_payment_token, "base64").toString("utf-8"),
    deposit: BigNumber(Buffer.from(_deposit, "base64").toString("hex"), 16).toString(),
    start_time: new Date(decodeBase64Number(_start_time) * 1000),
    end_time: new Date(decodeBase64Number(_end_time) * 1000),
  };
};
const decodeClaimFromStreamEvent = (event) => {
  const [_eventName, _streamId, _amount, _finalized] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    amount: BigNumber(Buffer.from(_amount, "base64").toString("hex"), 16).toString(),
    finalized: _finalized ? Buffer.from(_finalized, "base64").toString("hex") === "01" : false,
  };
};
const decodeCancelStreamEvent = (event) => {
  const [_eventName, _streamId, _canceledBy, _claimedAmount] = event.topics;

  const eventName = Buffer.from(_eventName, "base64").toString("utf-8");
  if (!allowedEvents.includes(eventName)) return null;

  return {
    streamId: decodeBase64Number(_streamId),
    canceledBy: Buffer.from(_canceledBy, "base64").toString("hex"),
    claimedAmount: BigNumber(Buffer.from(_claimedAmount || "0", "base64").toString("hex"), 16).toString(),
  };
};

const decodeMethods = {
  createStream: decodeCreateStreamEvent,
  claimFromStream: decodeClaimFromStreamEvent,
  cancelStream: decodeCancelStreamEvent,
};

const processEvents = (_events) => {
  const parsedEvents = {
    createStream: [],
    claimFromStream: [],
    cancelStream: [],
  };

  const eventsToParse = parseEvents(_events);

  eventsToParse.forEach((e) => {
    e.decoded = decodeMethods[e.eventName](e);

    if (e.decoded) {
      parsedEvents[e.eventName]?.push({
        ...e,
        hash: e.txHash,
      });
    }
  });

  return parsedEvents;
};

export const run = async (_events) => {
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
  } catch (e) {
    console.log(e);
  }
};
