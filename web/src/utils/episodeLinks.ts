/**
 * Utility to resolve direct episode links on platforms like Apple Podcasts, 
 * Pocket Casts, and Spotify by parsing their public feeds/pages.
 */

/**
 * Resolves Apple Podcasts episode links by querying the iTunes lookup API.
 * Maps GUIDs and MP3 filenames to the direct Apple Podcasts episode URL.
 */
export async function getAppleEpisodeLinks(appleShowUrl: string): Promise<Record<string, string>> {
  const match = appleShowUrl.match(/\/id(\d+)/);
  if (!match) return {};
  const showId = match[1];

  const lookupUrl = `https://itunes.apple.com/lookup?id=${showId}&entity=podcastEpisode&limit=200`;
  try {
    const res = await fetch(lookupUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const mapping: Record<string, string> = {};

    for (const item of data.results || []) {
      if (item.kind === 'podcast-episode') {
        const guid = item.episodeGuid;
        const trackViewUrl = item.trackViewUrl;
        
        if (guid && trackViewUrl) {
          mapping[guid] = trackViewUrl;
        }
        
        if (item.episodeUrl) {
          const filename = item.episodeUrl.split('/').pop();
          if (filename) {
            mapping[filename] = trackViewUrl;
          }
        }
      }
    }
    return mapping;
  } catch (e) {
    console.error('Failed to fetch Apple Podcast episodes:', e);
    return {};
  }
}

/**
 * Resolves Pocket Casts episode links by crawling the public show page.
 * Maps MP3 filenames to the direct Pocket Casts episode URLs.
 */
export async function getPocketCastsEpisodeLinks(pocketCastsUrl: string): Promise<Record<string, string>> {
  try {
    // 1. Follow the redirect to get the target URL (with slug and podcast UUID)
    const redirectRes = await fetch(pocketCastsUrl, {
      method: 'HEAD',
      redirect: 'manual',
      next: { revalidate: 86400 } // Redirects are stable, cache for 24h
    });
    
    let targetUrl = redirectRes.headers.get('location') || '';
    if (!targetUrl) {
      const textRes = await fetch(pocketCastsUrl, { next: { revalidate: 86400 } });
      const text = await textRes.text();
      const uuidMatch = text.match(/podcast\/[^/]+\/([a-f0-9-]{36})/);
      if (uuidMatch) {
        targetUrl = `https://pocketcasts.com/podcast/show/${uuidMatch[1]}`;
      } else {
        targetUrl = pocketCastsUrl;
      }
    }

    if (targetUrl.startsWith('/')) {
      targetUrl = `https://pocketcasts.com${targetUrl}`;
    }

    // Extract podcast UUID
    const uuidMatch = targetUrl.match(/([a-f0-9-]{36})/);
    if (!uuidMatch) return {};
    const podcastUuid = uuidMatch[1];

    // 2. Fetch the show detail page
    const showPageUrl = `https://pocketcasts.com/podcast/show/${podcastUuid}`;
    const pageRes = await fetch(showPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      next: { revalidate: 3600 } // Cache pages for 1 hour
    });
    
    if (!pageRes.ok) return {};
    const html = await pageRes.text();

    const mapping: Record<string, string> = {};

    // 3. Find all .mp3 URLs in the HTML state and match with nearby episode UUIDs
    const mp3Regex = /https:\/\/[^\s"']+\.mp3/g;
    let match;
    
    while ((match = mp3Regex.exec(html)) !== null) {
      const mp3Url = match[0];
      const filename = mp3Url.split('/').pop();
      if (!filename) continue;

      // Extract a window of 300 characters around the MP3 match
      const start = Math.max(0, match.index - 300);
      const end = Math.min(html.length, match.index + 300);
      const windowText = html.substring(start, end);

      const uuids = windowText.match(/[a-f0-9-]{36}/g) || [];
      const episodeUuids = uuids.filter(u => u !== podcastUuid);

      if (episodeUuids.length > 0) {
        // Find the one closest to the match index (offset 300)
        let closestUuid = episodeUuids[0];
        let minDistance = 99999;
        for (const uuid of episodeUuids) {
          const pos = windowText.indexOf(uuid);
          if (pos !== -1) {
            const distance = Math.abs(pos - 300);
            if (distance < minDistance) {
              minDistance = distance;
              closestUuid = uuid;
            }
          }
        }
        
        mapping[filename] = `https://pocketcasts.com/podcast/show/${podcastUuid}/episode/${closestUuid}`;
      }
    }
    return mapping;
  } catch (e) {
    console.error('Failed to fetch Pocket Casts episodes:', e);
    return {};
  }
}

/**
 * Resolves Spotify episode links using the Web API.
 * Requires client credentials to run. If missing, returns empty mapping.
 */
export async function getSpotifyEpisodeLinks(spotifyShowUrl: string): Promise<Record<string, string>> {
  const showIdMatch = spotifyShowUrl.match(/show\/([a-zA-Z0-9]+)/);
  if (!showIdMatch) return {};
  const showId = showIdMatch[1];

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {};
  }

  try {
    // 1. Get access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials',
      next: { revalidate: 3000 } // Token is valid for 1h, cache for 50 minutes
    });
    
    if (!tokenRes.ok) return {};
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    // 2. Fetch episodes
    const apiUrl = `https://api.spotify.com/v1/shows/${showId}/episodes?limit=50`;
    const episodesRes = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      next: { revalidate: 3600 }
    });
    
    if (!episodesRes.ok) return {};
    const episodesData = await episodesRes.json();

    const mapping: Record<string, string> = {};
    for (const item of episodesData.items || []) {
      const spotifyUrl = item.external_urls?.spotify;
      const title = item.name;
      if (spotifyUrl && title) {
        mapping[title.trim().toLowerCase()] = spotifyUrl;
      }
    }
    return mapping;
  } catch (e) {
    console.error('Failed to fetch Spotify episodes:', e);
    return {};
  }
}
