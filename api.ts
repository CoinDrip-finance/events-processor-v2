import 'dotenv/config';

import axios from 'axios';

export const getTokenData = async (tokenIdentifier: string) => {
  const { data } = await axios.get(`${process.env.API_URL}/tokens/${tokenIdentifier}`);

  return {
    decimals: data.decimals,
    payment_token_label: data.name,
  };
};
