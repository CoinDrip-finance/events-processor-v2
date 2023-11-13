import { EventsParser } from "./EventsParser";
import {
  insertCancelStreamEvents,
  insertClaimEvents,
  insertCreateStreamEvents,
  insertFinishedEvents,
} from "./supabase";

export enum EventStatus {
  ACTIVE = "active",
  CANCELLED = "cancelled",
  FINALIZED = "finalized",
}

// const parseEvents = (events: any[]) => {
//   const eventsToParse = events.filter(
//     (e) => e.address === process.env.SC_ADDRESS && allowedFunctions.includes(e.identifier)
//   );

//   return eventsToParse.map((e) => {
//     e.eventName = Buffer.from(e.topics[0], "base64").toString("utf-8");
//     return e;
//   });
// };

const processEvents = (_events: any[]) => {
  const parsedEvents: any = {
    createStream: [],
    claimFromStream: [],
    cancelStream: [],
    finishedStream: [],
  };

  const eventsParser = new EventsParser(process.env.SC_ADDRESS as string);
  const eventsToParse = eventsParser.parseEvents(_events);

  if (eventsToParse.length) console.log(`Processing ${eventsToParse.length} event(s)`);

  eventsToParse.forEach((e) => {
    if (e.decoded) {
      parsedEvents[e.eventName]?.push({
        ...e.decoded,
        hash: e.hash,
      });
    }
  });

  return parsedEvents;
};

export const run = async (_events: any[]) => {
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
