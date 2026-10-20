import { MediaProvider } from '@syncnshare/shared';
import { logger } from '../utils/logger';

export interface ParsedMedia {
  provider: MediaProvider;
  mediaId: string;
  url: string;
  title: string;
  artist: string;
  durationSeconds: number;
  thumbnailUrl: string;
}

// IP / Host SSRF check
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  // Check private IP ranges
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const [_, a, b] = match.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link Local / Cloud Metadata)
  }
  return false;
}

export function parseYouTubeUrl(rawUrl: string): { videoId: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const validHosts = [
      'youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtube-nocookie.com',
      'youtu.be',
    ];

    if (!validHosts.includes(host)) {
      return null;
    }

    let videoId = '';
    if (host === 'youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (parsed.searchParams.get('v')) {
      videoId = parsed.searchParams.get('v') || '';
    } else {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) {
        videoId = parts[1] || '';
      }
    }

    if (/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return { videoId };
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveMediaMetadata(inputUrl: string): Promise<ParsedMedia> {
  const urlObj = new URL(inputUrl);

  if (isPrivateHost(urlObj.hostname)) {
    throw new Error('Invalid URL: local and private network addresses are prohibited.');
  }

  // 1. YouTube check
  const yt = parseYouTubeUrl(inputUrl);
  if (yt) {
    const videoId = yt.videoId;
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const defaultThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Attempt to fetch title and author via public YouTube oEmbed without requiring an API key
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
        canonicalUrl
      )}&format=json`;

      const response = await fetch(oEmbedUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SyncNShare/1.0' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        return {
          provider: 'youtube',
          mediaId: videoId,
          url: canonicalUrl,
          title: data.title || `YouTube Video (${videoId})`,
          artist: data.author_name || 'YouTube Creator',
          durationSeconds: 0, // YouTube IFrame Player reports exact duration on playback
          thumbnailUrl: data.thumbnail_url || defaultThumbnail,
        };
      }
    } catch (err) {
      logger.warn({ err, videoId }, 'oEmbed lookup failed, using fallback YouTube metadata');
    }

    return {
      provider: 'youtube',
      mediaId: videoId,
      url: canonicalUrl,
      title: `YouTube Video (${videoId})`,
      artist: 'YouTube',
      durationSeconds: 0,
      thumbnailUrl: defaultThumbnail,
    };
  }

  // 2. Direct Audio check (mp3, wav, ogg, m4a, aac)
  const pathname = urlObj.pathname.toLowerCase();
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
  const hasAudioExt = audioExtensions.some((ext) => pathname.endsWith(ext));

  if (hasAudioExt || urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
    const filename = pathname.split('/').filter(Boolean).pop() || 'Audio Track';
    const cleanTitle = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');

    return {
      provider: 'direct_audio',
      mediaId: Buffer.from(inputUrl).toString('base64url').slice(0, 32),
      url: inputUrl,
      title: cleanTitle || 'Direct Audio Stream',
      artist: urlObj.hostname,
      durationSeconds: 0,
      thumbnailUrl: '',
    };
  }

  throw new Error('Unsupported media URL. Please provide a valid YouTube video link or direct audio URL.');
}
