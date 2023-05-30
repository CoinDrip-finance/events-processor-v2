import "dotenv/config";

import axios from "axios";

export const getTokenData = async (tokenIdentifier: string) => {
  if (tokenIdentifier === "EGLD") {
    return {
      decimals: 18,
      payment_token_label: "EGLD",
    };
  }
  const {
    data: { name, decimals },
  } = await axios.get(`${process.env.API_URL}/tokens/${tokenIdentifier}`);

  return {
    decimals,
    payment_token_label: name,
  };
};
