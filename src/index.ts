import { WebSocket } from "ws";

import { run } from "./events";

const ws = new WebSocket(process.env.WS_URL as string);

ws.on("open", function open() {
  console.log("CoinDrip event listener started");

  ws.send(
    JSON.stringify({
      subscriptionEntries: [
        {
          address: process.env.SC_ADDRESS,
        },
      ],
    })
  );
}).on("error", function (e) {
  console.log("connection error", e);
});

ws.on("message", function message(data) {
  const events = JSON.parse(data.toString("utf-8")).data;

  if (events?.length) {
    run(events);
  }
});
