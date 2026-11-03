# Lie-Flat Business Class Travel MCP (`lieflat-travel-mcp`)

An MCP server purpose-built for discovering **long-haul, true 180° lie-flat Business Class flights** from European hubs (prioritizing low-APD / low-luxury-tax airports) with strict leg-by-leg aircraft, seat configuration, duration, and carrier blocklist verification, plus 1-click deep links to OTA aggregators.

---

## Key Features

### 1. Strict Leg-by-Leg Equipment & Cabin Verification
- **Approved Widebodies**: `Airbus A330` (`-200`, `-300`, `-800neo`, `-900neo`), `Airbus A340` (`-300`, `-600`), `Airbus A350` (`-900`, `-1000`), `Airbus A380`, `Boeing 747` (`-400`, `-8I`), `Boeing 767` (`-300ER`, `-400ER`), `Boeing 777` (`-200ER`, `-200LR`, `-300ER`), and `Boeing 787 Dreamliner` (`-8`, `-9`, `-10`). *(Also automatically normalizes `"A360"` prompts to Airbus widebody families).*
- **True Lie-Flat Narrowbody Exception Registry**:
  - **JetBlue (`B6`)**: `Airbus A321neo` / `A321LR` / `A321` (**JetBlue Mint** 1-1 private suites with doors)
  - **TAP Air Portugal (`TP`)**: `Airbus A321LR` / `A321neo` (**Executive Class** 2-2 / 1-1 staggered Thompson Vantage 180° lie-flat beds; automatically distinguished from short-haul Euro-business A321neos via Google Flights `seatTypeCode` `5`/`6` and leg duration)
  - **Aer Lingus (`EI`)**: `Airbus A321LR` / `A321XLR` (180° lie-flat staggered seats & throne seats)
  - **SAS (`SK`)**: `Airbus A321LR` (180° lie-flat Business)
  - **Iberia (`IB`)**: `Airbus A321XLR` (1-1 Thompson Vantage SOLO herringbone 180° lie-flat suites)
  - **La Compagnie (`B0`)**: `Airbus A321neo` (76-seat all-Business Class 180° lie-flat cabin)
  - **ITA Airways (`AZ`)**: `Airbus A321neo` (Long-haul 1-1 Stelia Opera reverse-herringbone 180° lie-flat pods)
  - **Etihad Airways (`EY`)**: `Airbus A321LR` (1-1 reverse-herringbone 180° lie-flat suites)
  - **United Airlines (`UA`)**: `Boeing 757-200` / `A321XLR` (**United Polaris** 180° lie-flat beds)
  - **Delta Air Lines (`DL`)**: `Boeing 757-200` (`75S` **Delta One** subfleet verified via `seatTypeCode = 5`)
  - **American Airlines (`AA`)**: `Airbus A321T` / `A321XLR` (**Flagship Business** verified via `seatTypeCode = 5/6`)
  - **Gulf Air (`GF`) / Saudia (`SV`) / Qatar Airways (`QR`) / flydubai (`FZ`)**: Long-haul `A320/A321neo` and `737 MAX` subfleets when confirmed with `seatTypeCode = 5/6`.
- **Short Feeder Legs Permitted on Narrowbodies**: Connecting itineraries allow short regional legs ($< 7\text{h}$) on standard narrowbody aircraft (`A320`, `B737`, `A220`, `E190`) as long as the primary long-haul leg ($\ge 7\text{h}$) is on a verified lie-flat widebody or approved lie-flat narrowbody exception.
- **Widebody Non-Lie-Flat Pitfall Protection**: Automatically rejects widebodies equipped with recliners or angled-flat seats (e.g., Icelandair 767 Saga Class, Norse 787 Premium, French bee A350 Premium, Scoot 787 ScootPlus, AirAsia X A330).

### 2. Strict Long-Haul Duration Rule
- **Nonstop (0 stops)**: Single flight duration must be $\ge 8\text{ hours}$ ($480\text{ mins}$).
- **Connecting (1+ stops)**: At least one leg must be $\ge 7\text{ hours}$ ($420\text{ mins}$), and every leg $\ge 7\text{ hours}$ must meet the widebody / lie-flat narrowbody exception rule.

### 3. Unconditional Airline Blocklist (Marketing + Operating Carriers)
- **Built-in Exclusions**: **Air India (`AI`)**, **IndiGo (`6E` / `"IndoGo"`)**, **Icelandair (`FI`)**, and **EgyptAir (`MS`)** are unconditionally blocked whether they appear as the marketing airline or hidden in a codeshare (`"Operated by..."`).

### 4. Aggregator & OTA Deep Links
Every matching round-trip itinerary includes pre-populated GBP Business Class links for:
- **Google Flights** (exact GBP itinerary page displaying live 1-click OTA links for Gotogate, Lastminute.com, Booking.com, Trip.com, and the airline)
- **Skyscanner UK** (side-by-side comparison of Gotogate, Lastminute.com, Booking.com, Trip.com, eDreams, Mytrip)
- **Trip.com UK**
- **Kayak UK**
- **Momondo UK**
- **Lastminute.com UK**

---

## MCP Tools Exposed

1. `discover_lieflat_deals` — Multi-hub, multi-destination, flexible-date Business Class lie-flat discovery engine.
2. `search_specific_route` — Focused leg-by-leg route search with full rejection diagnostics.
3. `verify_aircraft_and_cabin` — Check any airline + aircraft combination against the widebody & narrowbody lie-flat ruleset.
4. `list_european_hubs_and_exceptions` — View European hubs ranked by APD/departure taxes, the Lie-Flat Narrowbody Exception Registry, and blocked airlines.
