/**
 * 24/7 Telegram Travel Bot Runner
 * Uses native fetch (zero npm dependencies) and built-in HTTP server for Render free web service.
 */

import http from 'node:http';
import { parseUserQueryWithGemini } from './gemini_parser.mjs';
import { formatFlightDealHtml, formatSearchSummaryHtml } from './formatter.mjs';
import { orchestrateLieFlatSearch } from '../engine/search_orchestrator.mjs';

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
  return tgCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: options.disablePreview ?? false,
    ...options,
  });
}

async function sendChatAction(chatId, action = 'typing') {
  try {
    await tgCall('sendChatAction', { chat_id: chatId, action });
  } catch (_) {
    // Non-critical
  }
}

async function sendPhotos(chatId, { uprightUrl, bedUrl, title }) {
  const media = [];
  if (uprightUrl) {
    media.push({
      type: 'photo',
      media: uprightUrl,
      caption: `💺 <b>${title} — Upright Seat</b>`,
      parse_mode: 'HTML',
    });
  }
  if (bedUrl) {
    media.push({
      type: 'photo',
      media: bedUrl,
      caption: `🛏 <b>${title} — 180° Lie-Flat Bed</b>`,
      parse_mode: 'HTML',
    });
  }

  if (media.length > 0) {
    try {
      await tgCall('sendMediaGroup', { chat_id: chatId, media });
      return true;
    } catch (err) {
      console.warn('[Bot Warning] Could not send photo media group directly (might be hotlink protected):', err.message);
    }
  }
  return false;
}

// Check whitelist authorization
function isUserAuthorized(from) {
  if (ALLOWED_USERS.length === 0) return true; // Open if no whitelist specified
  const username = (from?.username || '').toLowerCase();
  return ALLOWED_USERS.includes(username);
}

// Main message dispatcher
async function handleTelegramMessage(message) {
  const chatId = message.chat?.id;
  const text = (message.text || '').trim();
  const from = message.from || {};

  if (!chatId || !text) return;

  if (!isUserAuthorized(from)) {
    await sendMessage(chatId, '⛔ <b>Unauthorized</b>: This bot is configured for private use. Ask the administrator to add your @username.');
    return;
  }

  if (text === '/start' || text === '/help') {
    const helpMsg = `👋 <b>Welcome to Lie-Flat Flight Hunter!</b>

I hunt down <b>true 180° lie-flat Business Class</b> flight deals under <b>£1,700 GBP</b> departing low-APD European hubs, calculate <b>LHR positioning flights</b> (with ≥2.5h buffers), verify aircraft cabins, and generate pre-selected direct booking links.

<b>How to search:</b>
Just send me a message like:
• <code>Seoul for 3 nights in Dec</code>
• <code>Tokyo 4 nights under £1600</code>
• <code>Rio de Janeiro 4 nights next month</code>
• <code>Bangkok 5 nights</code>

Or use command format:
<code>/search ICN 3 nights Dec 1600</code>

<i>Strict safety: Air India, IndiGo, Icelandair, and EgyptAir are unconditionally excluded.</i>`;
    await sendMessage(chatId, helpMsg);
    return;
  }

  // Handle search query
  const cleanQuery = text.replace(/^\/search\s*/i, '');
  if (!cleanQuery) {
    await sendMessage(chatId, 'Please specify where and when you would like to fly! E.g. <code>Seoul for 3 nights in Dec</code>');
    return;
  }

  await sendChatAction(chatId, 'typing');
  const ack = await sendMessage(
    chatId,
    `🔍 <b>Searching for lie-flat deals...</b>\nQuery: <i>"${cleanQuery}"</i>\nScanning low-APD hubs & return flights. This takes ~20–30s.`
  );

  try {
    const params = await parseUserQueryWithGemini(cleanQuery);
    console.log('[Bot Search] Parsed query:', params);

    const searchResult = await orchestrateLieFlatSearch({
      destinations: [params.destination],
      nights: params.nights || 4,
      targetMonth: params.targetMonth || null,
      maxPriceGbp: params.maxPriceGbp || 1700,
      preferLowApd: true,
      maxOriginHubs: 5,
      maxDatePairs: 2,
      includeLhrPositioning: true,
      includeCabinPhotos: true,
    });

    const matches = searchResult.matches || [];

    if (matches.length === 0) {
      await sendMessage(
        chatId,
        `❌ <b>No verified lie-flat flights found</b> under £${params.maxPriceGbp} GBP for <code>${params.destination}</code> (${params.nights} nights).\n\n💡 <i>Try increasing your budget ceiling (e.g. £1,800) or trying another month!</i>`
      );
      return;
    }

    // Send summary
    const summaryHtml = formatSearchSummaryHtml(searchResult.searchSummary);
    await sendMessage(chatId, summaryHtml);

    // Send up to top 3 matches
    for (let i = 0; i < Math.min(3, matches.length); i++) {
      const match = matches[i];
      const dealHtml = formatFlightDealHtml(match, i + 1);

      // Attempt to send photos first
      const uprightUrl = match.cabinPhotos?.uprightSeatPhoto?.imageUrl || match.cabinPhotos?.uprightSeatPhoto?.originalImageUrl;
      const bedUrl = match.cabinPhotos?.flatBedPhoto?.imageUrl || match.cabinPhotos?.flatBedPhoto?.originalImageUrl;

      if (uprightUrl || bedUrl) {
        await sendPhotos(chatId, {
          uprightUrl,
          bedUrl,
          title: `${match.airline} ${match.aircraft}`,
        });
      }

      await sendMessage(chatId, dealHtml, { disablePreview: true });
    }
  } catch (err) {
    console.error('[Bot Error] Search failed:', err);
    await sendMessage(chatId, `⚠️ <b>Search encountered an error:</b>\n<code>${err.message}</code>\nPlease try again in a minute.`);
  }
}

// Telegram Long Polling Loop
async function startTelegramPolling() {
  let offset = 0;
  console.log('[Bot Polling] Starting Telegram long polling loop...');

  // Get bot username for info
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
