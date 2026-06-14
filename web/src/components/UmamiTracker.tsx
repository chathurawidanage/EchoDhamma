'use client';

import Script from 'next/script';

// Global default tracker ID
const GLOBAL_DEFAULT_ID = '46b0953c-57e3-4837-b333-30181342e0e8';

export default function UmamiTracker() {
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id={GLOBAL_DEFAULT_ID}
      strategy="afterInteractive"
    />
  );
}
