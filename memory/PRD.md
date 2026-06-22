# Cargo Ops — Product Requirements Document

## Original Problem Statement
Cargo consolidation logistics PWA between Engineer Trading Center (Kinangop) and
Wakulima Market (Nairobi). Three users — admin (business owner), farm-end
coordinator, Nairobi-end coordinators. No login system; access via unique
WhatsApp-shared links per trip day. Admin inputs everything; coordinators check
in, tape with the matching color, and tick. Real-time sync via polling.

## Architecture
- **Frontend**: React 19 PWA (CRA + craco). Routes: `/`, `/settings`,
  `/trip/:id` (admin, PIN-gated), `/trip/:id/farm`, `/trip/:id/nairobi`.
  Polling every 10s via `usePolling` hook.
- **Backend**: FastAPI + Motor (async MongoDB). All endpoints under `/api`.
- **DB**: MongoDB collections — `trips`, `trucks`, `sellers`, `coordinators`.
- **PWA**: `manifest.json` + service worker (`sw.js`) registered in `index.html`.

## User Personas
1. **Admin (owner)** — creates trips, slots sellers, copies WhatsApp links,
   monitors live manifest, tracks coordinator earnings.
2. **Farm coordinator** — at Engineer Trading Center: check in sellers, mark
   goods with the seller's color tape, mark loaded, advance truck status.
3. **Nairobi coordinator** — at Wakulima Market: receive truck, extract loads
   by color, advance truck status to Complete, see real-time earnings.

## Core Requirements (static)
- 6-color chip system per truck (red/blue/yellow/green/orange/purple), auto-cycled.
- Two-stage progress per truck (checked-in, loaded) plus extracted at destination.
- KSH 1,000 earned per truck a Nairobi coordinator completes.
- Capacity warning at ≥80% of `max_units` (default 150).
- Max 10 trucks per trip.
- No modals/popups/sidebars — all forms inline.
- Color codes ALWAYS render as solid chips, never as text.

## What's been implemented (2026-02 / Iteration 1)
- Full backend CRUD: trips, trucks, sellers, coordinators + manifest aggregator.
- Admin Trip Dashboard (date, totals, status pill, copy 3 links).
- Admin Setup tab (add truck, add seller w/ auto-color, capacity bar + warning).
- Admin Manifest tab (status pills, 3 progress bars per truck, expandable rows).
- Admin Earnings tab (Nairobi coordinator totals).
- Farm view: kit info, tap-to-advance status, Check In then Loaded gating.
- Nairobi view: coordinator selector, earnings header, Extract gated on Loaded,
  Complete gated on all-extracted.
- Settings: coordinators CRUD + 5 WhatsApp Business templates with copy.
- 4-digit PIN gate on admin (default `1234`, stored in localStorage after unlock).
- PWA manifest + service worker (theme `#1D6B5A`, installable).
- Real-time polling every 10s, no manual refresh required.

## Test results
- Backend: 12/12 pytest tests passing.
- Frontend: all primary flows verified by testing subagent (Home, Admin tabs,
  Farm gating, Nairobi gating, Settings, PWA assets).

## Prioritized Backlog
### P1 (next)
- Allow editing sellers/trucks (currently delete-and-re-add only).
- Edit `admin_pin` from Settings.
- Confirmation toasts on extraction completion + truck complete celebration.

### P2 (later)
- Per-coordinator weekly/monthly earnings history.
- Seller-side WhatsApp deep-link from booking record.
- Offline-first cache of manifest in service worker.
- CSV export of completed trips.

### P3 (nice-to-have)
- Multi-language (Swahili) toggle.
- Push notifications when truck status advances.
