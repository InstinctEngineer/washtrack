// Where WashTrack is published in the device app stores.
export const APP_STORE_URL = 'https://apps.apple.com/us/app/washtrack-fleet/id6794078297';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.washtracking.app&pcampaignid=web_share';

/** Opens a store page in a new tab. */
export function openStore(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
