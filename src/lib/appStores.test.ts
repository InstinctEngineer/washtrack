// @ts-ignore -- bun's built-in test runner; types not installed for the app typecheck
import { describe, expect, it } from 'bun:test';
import { APP_STORE_URL, PLAY_STORE_URL } from './appStores';

describe('app store links', () => {
  it('sends iPhone users to the WashTrack Fleet App Store page', () => {
    expect(APP_STORE_URL).toBe('https://apps.apple.com/us/app/washtrack-fleet/id6794078297');
  });

  it('sends Android users to the WashTrack Google Play page', () => {
    expect(PLAY_STORE_URL).toBe(
      'https://play.google.com/store/apps/details?id=com.washtracking.app&pcampaignid=web_share',
    );
  });
});
