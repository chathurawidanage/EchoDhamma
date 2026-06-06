'use client';

import { usePathname } from 'next/navigation';
import Script from 'next/script';

// Map thero IDs to their respective Umami website_ids
// These are sourced from their respective thero configs
const THERO_WEBSITE_IDS: Record<string, string> = {
  bambalapitiye_gnanaloka_thero: '25970dec-065e-4740-ba91-7394ad1f613a',
  watagoda_maggavihari_thero: '7b8506b4-423f-4543-ae0a-ed46ba04cadd',
};

// Global default tracker ID for pages like homepage, ebooks, etc.
const GLOBAL_DEFAULT_ID = 'df2b4db1-d461-4690-b18c-3df69d85c490';

export default function UmamiTracker() {
  const pathname = usePathname();

  // Determine website ID based on the URL path
  let websiteId = GLOBAL_DEFAULT_ID;
  const match = pathname.match(/\/podcast\/([^/]+)/);
  if (match && match[1]) {
    const theroId = match[1];
    if (THERO_WEBSITE_IDS[theroId]) {
      websiteId = THERO_WEBSITE_IDS[theroId];
    }
  }

  // Using a key bound to websiteId forces React to unmount the old script
  // and load/initialize the new one with the correct data-website-id on thero route transitions.
  return (
    <Script
      key={websiteId}
      src="https://cloud.umami.is/script.js"
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}
