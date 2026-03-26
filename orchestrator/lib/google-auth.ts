import { OAuth2Client } from "google-auth-library";

export function getGoogleOAuth2Client(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): OAuth2Client {
  const client = new OAuth2Client(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function getAdsOAuth2Client(): OAuth2Client {
  return getGoogleOAuth2Client(
    process.env.GOOGLE_ADS_CLIENT_ID!,
    process.env.GOOGLE_ADS_CLIENT_SECRET!,
    process.env.GOOGLE_ADS_REFRESH_TOKEN!
  );
}

export function getGSCOAuth2Client(): OAuth2Client {
  return getGoogleOAuth2Client(
    process.env.GOOGLE_GSC_CLIENT_ID!,
    process.env.GOOGLE_GSC_CLIENT_SECRET!,
    process.env.GOOGLE_GSC_REFRESH_TOKEN!
  );
}
