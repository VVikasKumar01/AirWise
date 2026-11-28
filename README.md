# AirWise – Urban Air Quality Assistant

**Breathe better, live smarter.**

AirWise is a consumer-friendly web application that helps everyday people understand local outdoor air quality, reduce exposure to harmful pollutants, improve indoor air, and build low-emission daily habits—without complex charts or technical jargon.

---

## Purpose of This Project

Urban air pollution changes hour by hour, yet most air quality tools only show raw numbers without explaining what they mean for daily life. AirWise bridges that gap by turning **real-time public air quality measurements** into clear, explainable, and household-specific actions.

Every recommendation pairs **what to do** with **why it helps**—so users can make informed decisions about outdoor play, commuting, indoor air care, and cleaner neighborhood travel.

---

## Key Features

### 1. Real-Time Outdoor Air Quality & Dual AQI Scales
- **Live Public Measurements:** Fetches real-time `PM2.5`, `PM10`, `NO₂`, `O₃`, `SO₂`, and `CO` concentrations along with upcoming hourly outlooks from the **Open-Meteo Air Quality API** (never generated or guessed by an AI model).
- **India National AQI & US EPA AQI:** Computes official **CPCB India NAQI** sub-indices and **US EPA AQI** scores server-side so users can switch scales anytime.
- **Transparent Data Freshness:** Clearly displays the data source (`Open-Meteo Air Quality`), active standard (`CPCB NAQI` or `US EPA`), and measurement timestamp, plus a clearly labeled **Demo Mode (Sample Data)** for offline exploration.
- **Location Tracing & Search:** Supports browser geolocation (reverse-geocoded via OpenStreetMap Nominatim), global city search, and quick-select cities across India (New Delhi, Noida, Mumbai, Kolkata, Hyderabad, Bengaluru, Chennai, Pune) and worldwide.

### 2. Explainable, Context-Aware Daily Guidance
- **Household Profile Personalization:** Tailors recommendations for **Working professionals**, **Young children playing outdoors**, **Senior citizens**, **My family**, **Someone sensitive to air pollution**, and **Just me**, combined with usual commute mode (`Walking or cycling`, `Public transport`, `Private vehicle`, or `Mixed transport`).
- **"Why It Helps" Explanations:** Powered by the **Google Gemini API** on the server (with a verified deterministic safety baseline fallback), each **Outdoor Activity**, **Indoor Air**, and **Travel Choice** card explains both the recommended step and its health or environmental impact.
- **Cleaner Window Detection:** Highlights the cleanest upcoming time slot in the hourly outlook to help time outdoor errands and exercise.

### 3. Conversational AI Assistant (`Ask AirWise`)
- Grounded strictly in the user's live city readings, active AQI scale, household profile, and recently logged clean-air actions.
- Explains *why* recommendations matter, recommends cost-conscious indoor improvements and low-emission commutes, never invents AQI numbers, and enforces urgent medical care guidance for severe respiratory symptoms.

### 4. Adaptive Routine & Indoor Air Quality Hacks (`Daily Tips`)
- **Morning, Afternoon & Evening Planner:** A 9-item daily checklist that adapts to prevailing AQI severity and household sensitivity, automatically resetting each local calendar day.
- **Indoor Air Quality Hacks:** Dedicated practical tips covering optimal **HEPA air purifier** placement and fan speed, **indoor air-purifying plants** (Areca palm, Snake plant, Peace lily, Spider plant) paired realistically with filtration, **cooking/combustion source control**, and **timed cross-ventilation**.

### 5. Positive Impact & CO₂e Tracker (`My Impact`)
- Logs daily habits, clean-air actions, and low-emission trips (walking/cycling, public transit, carpooling).
- Estimates `CO₂e` emissions avoided using a transparent, user-configurable formula:  
  `(replaced_factor − chosen_factor) × distance_km`

---

## How AirWise Helps Everyday Users

- **Parents & Young Children:** Know when playground time is safe, when to shift active games indoors, and why avoiding idling outside school gates protects developing lungs.
- **Senior Citizens & Sensitive Individuals:** Spot moderate pollution spikes early, pace gentle walks away from traffic corridors, and keep indoor dust and smoke low.
- **Working Professionals & Daily Commuters:** Time commutes around cleaner hourly windows, choose lower-exposure side routes, combine errands, or switch to metro/bus/carpooling with visible CO₂e savings.
- **Households & Families:** Use practical, affordable indoor hacks—like running kitchen exhaust fans while frying, damp-mopping instead of dry sweeping, and running purifiers effectively—without ever sealing a home unsafely during cooking.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend:** Node.js (v22.18+), Express (`server.ts`, `server/*`)
- **AI & Data APIs:** `@google/genai` (server-side Gemini API), Open-Meteo Air Quality & Geocoding APIs, OpenStreetMap Nominatim
- **Storage & Accessibility:** Browser `localStorage` (no account required), WCAG 2.2 AA focus-trapped modals, `>= 44px` touch targets, `aria-live` status announcements, and `prefers-reduced-motion` support

---

## Project Structure

```text
├── server.ts                  # Server entry point (Vite dev middleware / production dist)
├── server/
│   ├── app.ts                 # Express app, routes, JSON bounds, rate limiting
│   ├── aqiService.ts          # Open-Meteo AQI, geocoding & Nominatim reverse geocoding
│   ├── geminiService.ts       # Server-side Gemini advice & chat with timeouts/retries
│   ├── validation.ts          # Input sanitization & coordinate/payload validation
│   ├── security.ts            # Security headers & sliding-window rate limiter
│   └── cache.ts               # Bounded LRU/TTL in-memory cache
├── src/
│   ├── App.tsx                # Root state, navigation, AbortController request handling
│   ├── components/            # HomePage, AssistantPage, DailyTipsPage, ImpactPage, Modals
│   ├── hooks/                 # Accessible modal focus-trap hook
│   ├── shared/                # AQI formulas (CPCB NAQI & US EPA), constants, shared types
│   └── utils/                 # Adaptive daily habits, indoor hacks & localStorage helpers
└── tests/                     # Unit & Express integration tests (node:test via tsx)
```

---

## Getting Started

### Prerequisites
- **Node.js 22.18+** (needed to run `node server.ts` directly without flags; on Render, set `NODE_VERSION=22`)
- A **Google Gemini API key** (for AI-personalized advice and `Ask AirWise` chat; without it, AirWise runs using the verified deterministic safety baseline).

### Installation & Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**  
   Create a `.env` file (see `.env.example`):
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The app and API will be available at `http://localhost:3000`.

### Production Build & Run

```bash
npm run build
NODE_ENV=production npm start
```

### Verification & Tests

```bash
npm run lint   # TypeScript type check
npm test       # Run unit & API integration tests
```

---

## Privacy & Safety Design

- **No Accounts or Tracking Required:** Preferences, daily checklists, chat history, and logged actions stay locally in your browser's `localStorage`.
- **Server-Only API Keys:** `GEMINI_API_KEY` is read exclusively on the server and never exposed to client bundles.
- **No Fabricated Readings & Not Medical Advice:** Live AQI metrics come only from public air quality APIs; Demo Mode is explicitly labeled. AirWise provides everyday lifestyle guidance and instructs users to seek urgent medical attention for severe breathing symptoms.
