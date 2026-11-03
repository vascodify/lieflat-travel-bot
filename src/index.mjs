import { orchestrateLieFlatSearch } from './engine/search_orchestrator.mjs';
import {
  WIDEBODY_FAMILIES,
  LIEFLAT_NARROWBODY_EXCEPTIONS,
  WIDEBODY_PITFALLS,
  classifySegmentEquipment,
} from './data/aircraft_db.mjs';
import { EUROPEAN_HUB_TIERS, LONG_HAUL_DESTINATIONS } from './data/hubs_and_routes.mjs';
import { DEFAULT_BLOCKED_AIRLINES } from './data/airlines_db.mjs';
import { fetchCabinAndBedPhotos } from './scraper/cabin_photos.mjs';
import { findLhrPositioningFlights } from './engine/positioning_engine.mjs';

const SERVER_INFO = {
  name: 'lieflat-travel-mcp',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'discover_lieflat_deals',
    description:
      'Discover round-trip true 180° lie-flat Business Class flights across European hubs (prioritizing low-APD hubs like DUB, ARN, OSL, MAD, LIS, ATH, WAW, BUD) to long-haul destinations. Strictly enforces: (1) direct flight >= 8h OR connecting flight with at least one leg >= 7h; (2) long leg on a verified Widebody (A330, A340, A350, A380, B747, B767, B777, B787) OR approved True Lie-Flat Narrowbody Exception (JetBlue Mint A321neo/LR, TAP Air Portugal A321LR, Aer Lingus A321LR/XLR, SAS A321LR, Iberia A321XLR, La Compagnie A321neo, ITA A321neo, Etihad A321LR, United Polaris 757-200); (3) short connecting feeder legs (<7h) permitted on narrowbodies; (4) unconditional blocklist of Air India, IndiGo, Icelandair, and EgyptAir across both marketing and operating carriers; (5) total round-trip budget cap in GBP with clickable OTA deep links (Google Flights, Skyscanner/Gotogate/Lastminute/Booking.com, Trip.com, Kayak, Momondo).',
    inputSchema: {
      type: 'object',
      properties: {
        origins: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of origin IATA codes (e.g. ["DUB", "MAD", "ARN", "OSL", "LIS"]). Omit to automatically scan top low-APD European hubs.',
        },
        preferLowApd: {
          type: 'boolean',
          description:
            'When true (default), prioritizes low-APD European hubs (DUB, ARN, OSL, MAD, LIS, ATH, WAW, BUD) and excludes high-APD hubs like LHR/CDG/FRA unless explicitly listed in origins.',
          default: true,
        },
        maxOriginHubs: {
          type: 'number',
          description: 'Number of origin hubs to scan when origins is omitted (default 5).',
          default: 5,
        },
        destinations: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional list of long-haul destination IATA codes (e.g. ["JFK", "BOS", "BOG", "BKK", "SIN", "HKG"]). Omit to scan top long-haul deal hubs.',
        },
        regions: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional region filters: "north_america", "latin_america", "asia", "east_asia", "middle_east", "africa".',
        },
        maxDestinations: {
          type: 'number',
          description: 'Max destinations to scan per sweep (default 6).',
          default: 6,
        },
        outboundDate: {
          type: 'string',
          description: 'Specific outbound date YYYY-MM-DD (optional; omit to use flexible day-of-week expansion).',
        },
        returnDate: {
          type: 'string',
          description: 'Specific return date YYYY-MM-DD (optional; omit to use flexible day-of-week expansion).',
        },
        departureDayOfWeek: {
          type: 'string',
          description: 'Flexible outbound day of week, e.g. "Friday" (default "Friday").',
          default: 'Friday',
        },
        returnDayOfWeek: {
          type: 'string',
          description: 'Flexible return day of week, e.g. "Tuesday" (default "Tuesday").',
          default: 'Tuesday',
        },
        nights: {
          type: 'number',
          description: 'Number of nights for flexible searches (e.g. 4 for Friday to Tuesday).',
          default: 4,
        },
        monthsAhead: {
          type: 'number',
          description: 'How many months ahead to scan for flexible dates (default 2).',
          default: 2,
        },
        targetMonth: {
          type: 'string',
          description: 'Optional specific month name or YYYY-MM (e.g. "November", "December", "2026-12").',
        },
        maxDatePairs: {
          type: 'number',
          description: 'Max (outbound, return) date pairs to scan across the window (default 2).',
          default: 2,
        },
        maxPriceGbp: {
          type: 'number',
          description: 'Maximum round-trip total budget in GBP (£). Default 1700.',
          default: 1700,
        },
        minDirectHours: {
          type: 'number',
          description: 'Minimum flight duration in hours for a nonstop (0-stop) flight. Default 8.',
          default: 8,
        },
        minConnectingLongLegHours: {
          type: 'number',
          description:
            'Minimum flight duration in hours for at least one leg of a connecting flight. Default 7.',
          default: 7,
        },
        allowLieFlatNarrowbodyExceptions: {
          type: 'boolean',
          description:
            'When true (default), allows verified true 180° lie-flat narrowbodies (JetBlue Mint A321neo/LR, TAP Air Portugal A321LR, Aer Lingus A321LR/XLR, SAS A321LR, Iberia A321XLR, La Compagnie A321neo, ITA A321neo, Etihad A321LR, United Polaris 757-200) on the long leg.',
          default: true,
        },
        allowedAircraftFamilies: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional filter for specific widebody families, e.g. ["A350", "A330", "B787", "B777"]. Automatically normalizes "A360" to Airbus widebodies.',
        },
        customBlockedAirlines: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Additional airlines to exclude on top of the built-in blocklist (Air India, IndiGo, Icelandair, EgyptAir).',
        },
        verifyReturnLeg: {
          type: 'boolean',
          description:
            'When true (default), also queries the inbound return leg to confirm it meets the same widebody/lie-flat, duration, and blocklist rules.',
          default: true,
        },
        includeCabinPhotos: {
          type: 'boolean',
          description:
            'When true (default), fetches 2 photos for each option using "[Airline] [Aircraft] business class" and "[Airline] [Aircraft] business class bed".',
          default: true,
        },
        photoDownloadDir: {
          type: 'string',
          description: 'Optional local directory path to download the 2 cabin/bed photos per option.',
        },
        includeLhrPositioning: {
          type: 'boolean',
          description:
            'When true (default), automatically finds the best 2-3 separate-booking Return Economy flights from LHR to the European hub with >= 2.5h buffer each way.',
          default: true,
        },
        homeAirport: {
          type: 'string',
          description: 'Home positioning airport (default "LHR").',
          default: 'LHR',
        },
        minPositioningBufferHours: {
          type: 'number',
          description: 'Minimum transfer buffer in hours between LHR positioning flights and the Business Class flights (default 2.5).',
          default: 2.5,
        },
        maxResults: {
          type: 'number',
          description: 'Maximum verified round-trip matches to return (default 10).',
          default: 10,
        },
      },
    },
  },
  {
    name: 'search_specific_route',
    description:
      'Perform a focused leg-by-leg Business Class search on a specific origin and destination (e.g. DUB to JFK, MAD to BOG, OSL to BKK) for exact or flexible dates, returning all verified widebody / lie-flat narrowbody itineraries, OTA booking links, and diagnostic reasons for any rejected flights.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin airport IATA code (e.g. "DUB", "MAD", "LIS", "ARN").',
        },
        destination: {
          type: 'string',
          description: 'Destination airport IATA code (e.g. "JFK", "BOS", "BOG", "BKK", "SIN").',
        },
        outboundDate: {
          type: 'string',
          description: 'Outbound date YYYY-MM-DD (or omit to use departureDayOfWeek + nights).',
        },
        returnDate: {
          type: 'string',
          description: 'Return date YYYY-MM-DD (or omit to use departureDayOfWeek + nights).',
        },
        departureDayOfWeek: {
          type: 'string',
          default: 'Friday',
        },
        nights: {
          type: 'number',
          default: 4,
        },
        monthsAhead: {
          type: 'number',
          default: 2,
        },
        maxDatePairs: {
          type: 'number',
          default: 4,
        },
        maxPriceGbp: {
          type: 'number',
          default: 1700,
        },
        minDirectHours: {
          type: 'number',
          default: 8,
        },
        minConnectingLongLegHours: {
          type: 'number',
          default: 7,
        },
        allowLieFlatNarrowbodyExceptions: {
          type: 'boolean',
          default: true,
        },
        allowedAircraftFamilies: {
          type: 'array',
          items: { type: 'string' },
        },
        customBlockedAirlines: {
          type: 'array',
          items: { type: 'string' },
        },
        includeCabinPhotos: {
          type: 'boolean',
          default: true,
        },
        photoDownloadDir: {
          type: 'string',
        },
        includeLhrPositioning: {
          type: 'boolean',
          default: true,
        },
        homeAirport: {
          type: 'string',
          default: 'LHR',
        },
        minPositioningBufferHours: {
          type: 'number',
          default: 2.5,
        },
      },
      required: ['origin', 'destination'],
    },
  },
  {
    name: 'find_lhr_positioning_flights',
    description:
      'Find the best 2-3 separate-booking Return Economy positioning flights from LHR (or another home airport) to a European Business Class departure hub, enforcing a minimum 2.5h buffer before the outbound Business leg and >= 2.5h buffer after the return Business leg lands (accounting for overnight long-haul returns and prioritizing convenient daytime timings).',
    inputSchema: {
      type: 'object',
      properties: {
        homeAirport: {
          type: 'string',
          default: 'LHR',
          description: 'Home positioning airport IATA code (default "LHR").',
        },
        hubIata: {
          type: 'string',
          description: 'European hub IATA code where the Business Class flight departs/arrives (e.g. "BRU", "CPH", "DUB", "MAD").',
        },
        businessOutboundDate: {
          type: 'string',
          description: 'YYYY-MM-DD date of the Business Class outbound departure from the hub.',
        },
        businessOutboundDepTime: {
          type: 'string',
          description: 'HH:MM local departure time of the Business Class outbound flight from the hub (e.g. "12:20").',
        },
        businessReturnHubArrivalDate: {
          type: 'string',
          description: 'YYYY-MM-DD actual arrival date when the return Business Class flight lands back at the European hub (often +1 day for overnight flights).',
        },
        businessReturnHubArrivalTime: {
          type: 'string',
          description: 'HH:MM local arrival time when the return Business Class flight lands back at the European hub (e.g. "05:45").',
        },
        minBufferHours: {
          type: 'number',
          default: 2.5,
          description: 'Minimum required self-transfer buffer in hours (default 2.5).',
        },
      },
      required: [
        'hubIata',
        'businessOutboundDate',
        'businessOutboundDepTime',
        'businessReturnHubArrivalDate',
        'businessReturnHubArrivalTime',
      ],
    },
  },
  {
    name: 'verify_aircraft_and_cabin',
    description:
      'Verify whether a specific airline + aircraft combination (e.g. TAP Air Portugal A321neo, JetBlue A321neo, Airbus A350-900, Icelandair Boeing 767) qualifies as a true 180° lie-flat Business Class cabin, inspect its seat layout and pitfalls, and optionally fetch its 2 cabin & lie-flat bed photos.',
    inputSchema: {
      type: 'object',
      properties: {
        aircraftName: {
          type: 'string',
          description: 'Aircraft name or code, e.g. "Airbus A350-900", "Airbus A321neo", "Boeing 787-9".',
        },
        carrierCode: {
          type: 'string',
          description: 'Airline 2-letter IATA code, e.g. "TP", "B6", "QR", "AY", "FI".',
        },
        carrierName: {
          type: 'string',
          description: 'Airline name, e.g. "TAP Air Portugal", "JetBlue", "Qatar Airways".',
        },
        seatTypeCode: {
          type: 'number',
          description:
            'Optional Google Flights seatTypeCode (5 = 180° Lie-flat, 6 = Individual Suite, 7 = Angled flat, 4/8 = Recliner, 1 = Standard pitch).',
          default: 5,
        },
        durationMins: {
          type: 'number',
          description: 'Leg duration in minutes (default 450).',
          default: 450,
        },
        includeCabinPhotos: {
          type: 'boolean',
          description: 'When true, fetches 2 photos ("[Airline] [Aircraft] business class" and "[Airline] [Aircraft] business class bed").',
          default: false,
        },
      },
      required: ['aircraftName'],
    },
  },
  {
    name: 'list_european_hubs_and_exceptions',
    description:
      'List all curated European hubs ranked by Business Class APD / departure taxes, the complete Lie-Flat Narrowbody Exception Registry (JetBlue Mint, TAP A321LR, Aer Lingus, SAS, Iberia, La Compagnie, ITA, Etihad, United 757), Widebody families, and Unconditional Blocked Airlines.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

async function handleToolCall(name, args = {}) {
  switch (name) {
    case 'discover_lieflat_deals': {
      const result = await orchestrateLieFlatSearch(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'search_specific_route': {
      const result = await orchestrateLieFlatSearch({
        ...args,
        origins: [args.origin],
        destinations: [args.destination],
        maxOriginHubs: 1,
        maxDestinations: 1,
        maxDatePairs: args.maxDatePairs || 4,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'find_lhr_positioning_flights': {
      const result = await findLhrPositioningFlights(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'verify_aircraft_and_cabin': {
      const classification = classifySegmentEquipment({
        aircraftName: args.aircraftName,
        carrierCode: args.carrierCode,
        carrierName: args.carrierName,
        seatTypeCode: args.seatTypeCode ?? 5,
        durationMins: args.durationMins ?? 450,
        allowLieFlatNarrowbodyExceptions: true,
      });
      if (args.includeCabinPhotos && (args.carrierName || args.carrierCode)) {
        classification.cabinPhotos = await fetchCabinAndBedPhotos({
          airlineName: args.carrierName || args.carrierCode,
          aircraftName: args.aircraftName,
        });
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(classification, null, 2),
          },
        ],
      };
    }

    case 'list_european_hubs_and_exceptions': {
      const payload = {
        europeanHubsByApdTier: EUROPEAN_HUB_TIERS,
        widebodyFamilies: WIDEBODY_FAMILIES.map((w) => ({
          family: w.family,
          manufacturer: w.manufacturer,
          displayName: w.displayName,
          notes: w.notes,
        })),
        lieFlatNarrowbodyExceptions: LIEFLAT_NARROWBODY_EXCEPTIONS.map((e) => ({
          id: e.id,
          carrierCodes: e.carrierCodes,
          productName: e.productName,
          layout: e.layout,
          notes: e.notes,
        })),
        widebodyNonLieFlatPitfalls: WIDEBODY_PITFALLS.map((p) => ({
          carrierCode: p.carrierCode,
          reason: p.reason,
        })),
        unconditionalBlockedAirlines: DEFAULT_BLOCKED_AIRLINES,
        longHaulDestinationClusters: LONG_HAUL_DESTINATIONS,
      };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function processJsonRpcMessage(msg, useContentLengthFraming = false) {
  if (!msg || typeof msg !== 'object') return;

  // Notifications have no `id`
  if (msg.id === undefined || msg.id === null) {
    return;
  }

  let responsePayload;
  try {
    if (msg.method === 'initialize') {
      const clientProtocol = msg.params?.protocolVersion || '2024-11-05';
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: clientProtocol,
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        },
      };
    } else if (msg.method === 'ping') {
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {},
      };
    } else if (msg.method === 'tools/list') {
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: TOOLS,
        },
      };
    } else if (msg.method === 'tools/call') {
      const toolName = msg.params?.name;
      const toolArgs = msg.params?.arguments || {};
      const toolResult = await handleToolCall(toolName, toolArgs);
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: toolResult,
      };
    } else if (msg.method === 'resources/list') {
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: { resources: [] },
      };
    } else if (msg.method === 'prompts/list') {
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        result: { prompts: [] },
      };
    } else {
      responsePayload = {
        jsonrpc: '2.0',
        id: msg.id,
        error: {
          code: -32601,
          message: `Method not found: ${msg.method}`,
        },
      };
    }
  } catch (err) {
    responsePayload = {
      jsonrpc: '2.0',
      id: msg.id,
      error: {
        code: -32000,
        message: err?.message || String(err),
      },
    };
  }

  const serialized = JSON.stringify(responsePayload);
  if (useContentLengthFraming) {
    const byteLen = Buffer.byteLength(serialized, 'utf8');
    process.stdout.write(`Content-Length: ${byteLen}\r\n\r\n${serialized}`);
  } else {
    process.stdout.write(`${serialized}\n`);
  }
}

// Dual-mode Stdio Reader (supports both standard MCP newline-delimited JSON and LSP Content-Length framing)
let buffer = Buffer.alloc(0);
let detectedContentLengthMode = false;

process.stdin.on('data', async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (buffer.length > 0) {
    const preview = buffer.subarray(0, Math.min(buffer.length, 64)).toString('utf8');
    if (preview.startsWith('Content-Length:') || detectedContentLengthMode) {
      detectedContentLengthMode = true;
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const headerStr = buffer.subarray(0, headerEnd).toString('utf8');
      const lenMatch = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!lenMatch) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLen = parseInt(lenMatch[1], 10);
      const totalNeeded = headerEnd + 4 + contentLen;
      if (buffer.length < totalNeeded) break;

      const bodyStr = buffer.subarray(headerEnd + 4, totalNeeded).toString('utf8');
      buffer = buffer.subarray(totalNeeded);

      try {
        const parsed = JSON.parse(bodyStr);
        await processJsonRpcMessage(parsed, true);
      } catch (e) {
        process.stderr.write(`JSON parse error: ${e.message}\n`);
      }
    } else {
      const newlineIdx = buffer.indexOf('\n');
      if (newlineIdx === -1) break;

      const lineStr = buffer.subarray(0, newlineIdx).toString('utf8').trim();
      buffer = buffer.subarray(newlineIdx + 1);
      if (!lineStr) continue;

      try {
        const parsed = JSON.parse(lineStr);
        await processJsonRpcMessage(parsed, false);
      } catch (e) {
        process.stderr.write(`JSON line parse error: ${e.message}\n`);
      }
    }
  }
});
