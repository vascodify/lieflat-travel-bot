/**
 * 24/7 Telegram Travel Bot Runner
 * Uses native fetch (zero npm dependencies) and built-in HTTP server for Render free web service.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { parseUserQueryWithGemini, parseAudioWithGemini } from './gemini_parser.mjs';
import { formatFlightDealHtml, formatSearchSummaryHtml } from './formatter.mjs';
import { orchestrateLieFlatSearch } from '../engine/search_orchestrator.mjs';

// Auto-load .env file if present
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvFile();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const ALLOWED_USERS = (process.env.ALLOWED_USERNAMES || '')
  .split(',')
  .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

if (!TELEGRAM_TOKEN) {
  console.error('[Bot Error] TELEGRAM_BOT_TOKEN environment variable is missing.');
  console.error('Please get a bot token from @BotFather on Telegram and set TELEGRAM_BOT_TOKEN.');
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

async function tgCall(method, payload = {}) {
  const url = `${TELEGRAM_API_BASE}/${method}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!data.ok) {
    throw new Error(`Telegram API error [${method}]: ${data.description || 'Unknown error'}`);
  }
  return data.result;
}

async function sendMessage(chatId, text, options = {}) {
  try {
    return await tgCall('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disablePreview ?? true,
      ...options,
    });
  } catch (err) {
    if (String(err.message).toLowerCase().includes('too long') && text.includes('\n🇬🇧 ')) {
      const [part1, part2] = text.split('\n🇬🇧 ');
      await tgCall('sendMessage', {
        chat_id: chatId,
        text: part1,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return await tgCall('sendMessage', {
        chat_id: chatId,
        text: `🇬🇧 ${part2}`,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }
    throw err;
  }
}

async function sendChatAction(chatId, action = 'typing') {
  try {
    await tgCall('sendChatAction', { chat_id: chatId, action });
  } catch (_) {
    // Non-critical
  }
}

async function getTelegramFileBuffer(fileId) {
  const fileInfo = await tgCall('getFile', { file_id: fileId });
  const filePath = fileInfo.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  const resp = await fetch(downloadUrl);
  if (!resp.ok) throw new Error(`Failed to download audio file: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function fetchImageAsBlob(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength < 1000) return null;
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    return new Blob([arrayBuffer], { type: contentType });
  } catch (_) {
    return null;
  }
}

async function sendPhotos(chatId, { uprightUrl, uprightFallbackUrl, bedUrl, bedFallbackUrl, title }) {
  // Download image blobs directly so Telegram never fails on CDN hotlink blocks or proxy query strings
  const uprightBlob = (await fetchImageAsBlob(uprightUrl)) || (await fetchImageAsBlob(uprightFallbackUrl));
  const bedBlob = (await fetchImageAsBlob(bedUrl)) || (await fetchImageAsBlob(bedFallbackUrl));

  if (uprightBlob || bedBlob) {
    try {
      const form = new FormData();
      form.append('chat_id', String(chatId));
      const media = [];

      if (uprightBlob) {
        form.append('upright_photo', uprightBlob, 'upright_seat.jpg');
        media.push({
          type: 'photo',
          media: 'attach://upright_photo',
          caption: `💺 <b>${title} — Upright Seat Position</b>`,
          parse_mode: 'HTML',
        });
      }
      if (bedBlob) {
        form.append('bed_photo', bedBlob, 'lieflat_bed.jpg');
        media.push({
          type: 'photo',
          media: 'attach://bed_photo',
          caption: `🛏 <b>${title} — 180° Lie-Flat Bed Position</b>`,
          parse_mode: 'HTML',
        });
      }

      form.append('media', JSON.stringify(media));
      const resp = await fetch(`${TELEGRAM_API_BASE}/sendMediaGroup`, {
        method: 'POST',
        body: form,
      });
      const data = await resp.json();
      if (data.ok) return true;
      console.warn('[Bot Warning] Multipart sendMediaGroup returned error:', data.description);
    } catch (err) {
      console.warn('[Bot Warning] Multipart sendMediaGroup failed, trying direct URL fallback:', err.message);
    }
  }

  // Fallback: URL-based sendMediaGroup
  const urlMedia = [];
  if (uprightUrl) {
    urlMedia.push({
      type: 'photo',
      media: uprightUrl,
      caption: `💺 <b>${title} — Upright Seat Position</b>`,
      parse_mode: 'HTML',
    });
  }
  if (bedUrl) {
    urlMedia.push({
      type: 'photo',
      media: bedUrl,
      caption: `🛏 <b>${title} — 180° Lie-Flat Bed Position</b>`,
      parse_mode: 'HTML',
    });
  }

  if (urlMedia.length > 0) {
    try {
      await tgCall('sendMediaGroup', { chat_id: chatId, media: urlMedia });
      return true;
    } catch (err) {
      console.warn('[Bot Warning] Could not send URL photo media group:', err.message);
    }
  }
  return false;
}

// Check whitelist authorization
function isUserAuthorized(from) {
  if (ALLOWED_USERS.length === 0) return true;
  if (ALLOWED_USERS.includes('*') || ALLOWED_USERS.includes('all')) return true;
  const username = (from?.username || '').toLowerCase();
  const userId = String(from?.id || '');
  return ALLOWED_USERS.includes(username) || ALLOWED_USERS.includes(userId);
}

// Main message dispatcher
async function handleTelegramMessage(message) {
  const chatId = message.chat?.id;
  const text = (message.text || '').trim();
  const from = message.from || {};
  const voice = message.voice || message.audio;

  if (!chatId || (!text && !voice)) return;

  if (!isUserAuthorized(from)) {
    const userHandle = from?.username ? `@${from.username}` : `User ID: ${from?.id}`;
    console.log(`[Bot Auth Blocked] Unauthorized message from ${userHandle}`);
    await sendMessage(
      chatId,
      `⛔ <b>Private Bot</b>\n\nYour account is <code>${userHandle}</code>.\nTo authorize yourself, add this username to <code>ALLOWED_USERNAMES</code> in your <code>.env</code> file (or leave it blank to allow yourself).`
    );
    return;
  }

  // Handle voice / audio note input
  if (voice) {
    await sendChatAction(chatId, 'record_voice');
    await sendMessage(chatId, '🎙️ <i>Listening and transcribing your voice note with Gemini...</i>');
    try {
      const audioBuffer = await getTelegramFileBuffer(voice.file_id);
      const mime = voice.mime_type || 'audio/ogg';
      const params = await parseAudioWithGemini(audioBuffer, mime);

      let speechHeader = `🗣️ <b>Heard:</b> <i>"${params.transcription || params.summary}"</i>\n`;
      speechHeader += `🎯 <b>Extracted Search:</b> ${params.summary}`;
      await sendMessage(chatId, speechHeader);

      if (!params.destination) {
        await sendMessage(
          chatId,
          '✈️ <b>Where would you like to travel?</b>\n\nPlease specify your destination city, country, or 3-letter airport code (e.g. <code>Entebbe, Uganda</code>, <code>Tokyo</code>, <code>Buenos Aires</code>, <code>Rio</code>, <code>Bangkok</code>).'
        );
        return;
      }

      await executeSearchAndReply(chatId, params);
    } catch (err) {
      console.error('[Bot Error] Voice processing failed:', err);
      await sendMessage(
        chatId,
        `⚠️ <b>Could not process voice note:</b>\n<code>${err.message}</code>\n\n💡 <i>Try sending as a text message.</i>`
      );
    }
    return;
  }

  if (text === '/start' || text === '/help') {
    const helpMsg = `👋 <b>Welcome to Lie-Flat Flight Hunter!</b>

I hunt down <b>true 180° lie-flat Business Class</b> flight deals departing low-APD European hubs, calculate <b>2–3 LHR positioning options</b> (with ≥2.5h buffers & Economy booking links), verify upright & flat-bed aircraft photos, and generate pre-selected direct booking links.

<b>How to search:</b>
• <b>Send a voice note:</b> Hold the mic and say: <i>"Find me flights to Seoul for 3 nights in December"</i>
• <b>Or type a text message:</b>
  • <code>Seoul for 3 nights in Dec</code>
  • <code>Tokyo 4 nights in the next 3 months</code>
  • <code>Buenos Aires 4 nights in the next 6 months</code>
  • <code>Rio de Janeiro 4 nights next month</code>

<i>Strict safety: Air India, IndiGo, Icelandair, and EgyptAir are unconditionally excluded.</i>`;
    await sendMessage(chatId, helpMsg);
    return;
  }

  // Handle text search query
  const cleanQuery = text.replace(/^\/search\s*/i, '');
  if (!cleanQuery) {
    await sendMessage(
      chatId,
      'Please specify where and when you would like to fly! E.g. <code>Seoul for 3 nights in Dec</code> or send a voice note 🎙️'
    );
    return;
  }

  await sendChatAction(chatId, 'typing');
  const params = await parseUserQueryWithGemini(cleanQuery);
  console.log('[Bot Search] Parsed query:', params);

  if (!params.destination) {
    await sendMessage(
      chatId,
      '✈️ <b>Where would you like to travel?</b>\n\nPlease specify your destination city, country, or 3-letter airport code (e.g. <code>Entebbe, Uganda</code>, <code>Tokyo</code>, <code>Buenos Aires</code>, <code>Rio</code>, <code>Bangkok</code>).'
    );
    return;
  }

  await sendMessage(
    chatId,
    `🔍 <b>Searching for lie-flat deals...</b>\n• <b>Target:</b> <code>${params.summary}</code>\nScanning European hubs, return legs, cabin photos & LHR positioning flights (~20–35s).`
  );

  try {
    await executeSearchAndReply(chatId, params);
  } catch (err) {
    console.error('[Bot Error] Search failed:', err);
    await sendMessage(
      chatId,
      `⚠️ <b>Search encountered an error:</b>\n<code>${err.message}</code>\nPlease try again in a minute.`
    );
  }
}

async function executeSearchAndReply(chatId, params) {
  await sendChatAction(chatId, 'typing');

  // Select top hubs including LHR (London direct/feeder) + low-APD European origins
  const latamDestinations = ['GIG', 'GRU', 'EZE', 'BOG', 'LIM', 'SCL', 'MEX', 'CUN'];
  let searchOrigins = ['LHR', 'MAD', 'LIS', 'DUB', 'FRA', 'OSL', 'ARN', 'MXP', 'MUC', 'VIE'];
  if (latamDestinations.includes(params.destination)) {
    searchOrigins = ['LHR', 'MAD', 'LIS', 'BCN', 'MXP', 'FCO', 'FRA', 'CDG'];
  }

  const budgetCeiling = params.maxPriceGbp || 2400;
  const monthsWindow = params.monthsAhead || 2;
  const maxDatePairs = monthsWindow > 2 ? Math.min(monthsWindow + 1, 5) : 3;

  const searchResult = await orchestrateLieFlatSearch({
    origins: searchOrigins,
    destinations: [params.destination],
    departureDayOfWeek: params.departureDayOfWeek || null,
    returnDayOfWeek: params.returnDayOfWeek || null,
    nights: params.nights || 4,
    monthsAhead: monthsWindow,
    targetMonth: params.targetMonth || null,
    maxPriceGbp: budgetCeiling,
    maxDatePairs,
    minConnectingLongLegHours: 6.5,
    includeLhrPositioning: true,
    includeCabinPhotos: true,
  });

  const matches = searchResult.matches || [];

  if (matches.length === 0) {
    let msg = `❌ <b>No verified lie-flat flights found</b> under <b>£${budgetCeiling} GBP</b> for <code>${params.destination}</code> (${params.nights} nights`;
    if (params.targetMonth) msg += ` in ${params.targetMonth}`;
    else msg += ` over the next ${monthsWindow} months`;
    msg += `).\n\n💡 <i>Try widening your month window (e.g. "in the next 6 months") or raising your budget ceiling!</i>`;
    await sendMessage(chatId, msg);
    return;
  }

  // Send summary
  const summaryHtml = formatSearchSummaryHtml(searchResult.searchSummary);
  await sendMessage(chatId, summaryHtml);

  // Send up to top 3 matches
  for (let i = 0; i < Math.min(3, matches.length); i++) {
    const match = matches[i];
    const dealHtml = formatFlightDealHtml(match, i + 1);

    // Extract both cabinPhoto (upright) and bedPhoto (flat bed) from cabin_photos.mjs
    const cabinObj = match.cabinPhotos?.cabinPhoto || match.cabinPhotos?.uprightSeatPhoto || {};
    const bedObj = match.cabinPhotos?.bedPhoto || match.cabinPhotos?.flatBedPhoto || {};

    const uprightUrl = cabinObj.imageUrl || cabinObj.originalImageUrl;
    const uprightFallbackUrl = cabinObj.originalImageUrl || cabinObj.imageUrl;
    const bedUrl = bedObj.imageUrl || bedObj.originalImageUrl;
    const bedFallbackUrl = bedObj.originalImageUrl || bedObj.imageUrl;

    const airlineName =
      match.cabinPhotos?.airlineNormalized ||
      (Array.isArray(match.primaryCarriers) ? match.primaryCarriers.join(' / ') : '') ||
      match.airline ||
      'Business Class';
    const aircraftName =
      match.cabinPhotos?.aircraftNormalized ||
      match.outbound?.qualifyingLongLegs?.[0]?.aircraft ||
      match.aircraft ||
      'Lie-Flat Widebody';

    if (uprightUrl || bedUrl) {
      await sendChatAction(chatId, 'upload_photo');
      await sendPhotos(chatId, {
        uprightUrl,
        uprightFallbackUrl,
        bedUrl,
        bedFallbackUrl,
        title: `${airlineName} — ${aircraftName}`,
      });
    }

    await sendMessage(chatId, dealHtml, { disablePreview: true });
  }
}

// Telegram Long Polling Loop
async function startTelegramPolling() {
  let offset = 0;
  console.log('[Bot Polling] Starting Telegram long polling loop...');

  try {
    const me = await tgCall('getMe');
    console.log(`[Bot Polling] Connected as @${me.username} (${me.first_name})`);
  } catch (err) {
    console.error('[Bot Warning] Could not connect to Telegram getMe:', err.message);
  }

  while (true) {
    try {
      const updates = await tgCall('getUpdates', {
        offset,
        timeout: 25,
        allowed_updates: ['message'],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message) {
          handleTelegramMessage(update.message).catch((err) => {
            console.error('[Bot Message Handler Error]:', err);
          });
        }
      }
    } catch (err) {
      console.warn('[Bot Polling Warning] Connection pause (retrying in 3s):', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// HTTP Health Check Server for Render Free Web Service
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health' || req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'lieflat-travel-telegram-bot',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Health Server] Listening on 0.0.0.0:${PORT} for Render health checks.`);
  if (TELEGRAM_TOKEN) {
    startTelegramPolling();
  } else {
    console.log('[Bot Polling] Waiting for TELEGRAM_BOT_TOKEN to be set before starting polling.');
  }
});
