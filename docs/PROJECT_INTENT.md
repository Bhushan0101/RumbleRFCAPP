# Project intent and source brief

## Current W.U.C.O application, payment and event workflow

The displayed brand is W.U.C.O. New fighters submit a private application, complete the EUR 10
application fee, then require administrator approval before public listing, ranking publication or
event registration. The Render stakeholder demo uses explicitly labelled TEST payments and PDF
receipts; no real money is charged. Admin workspaces now include fighter approval/profile management
and finance/date-filtered CSV reporting with separate live/test totals. Event entry supports category,
capacity and deadline checks, confirmation references and safe withdrawal. Schema version is 6.
See [WUCO_APPLICATIONS_PAYMENTS.md](WUCO_APPLICATIONS_PAYMENTS.md) for the full walkthrough, demo
logins, receipt retention and the separate Stripe/durable-storage requirements for real charging.
This current guide supersedes older descriptions below of instant registration or absent payments.


## User request

The user supplied four UFC desktop page references and one RFC logo/brand image, first asking for a similar website structure using the logo's theme, then authorizing the website build. They subsequently requested all source code in a ZIP, databases and explicit context so Claude could continue development in their IDE.

## Audience and tasks

Fans should discover upcoming events, explore fighters and standings, read stories and find ticket information. RFC content owners should ultimately maintain verified content without editing presentation code. The handover prepares data structures for this, but an editing dashboard is future work.

## Reference analysis

- `image(20261020-145411).png`: News listing; oversized uppercase heading, white background and mixed editorial cards.
- `image(20261020-145418).png`: Feature story with overlapping copy panel, dark numbered Top Stories sidebar, matchup strip.
- `image(20261020-145425).png`: Rankings grouped into division columns, champion prominence and numbered contenders.
- `image(20261020-145432).png`: Four-column athlete directory with portraits, names, divisions and records.
- `image(20261020-145526).png`: RFC brand artwork and logo; green lettering, cream/white field and gold accents.

Copies are in `docs/references/`. These are design references, not a source of verified RFC content. Do not import UFC logos, names or records as RFC assets/data.

## Visual system

Primary green #123c2b. Gold #c7a461. Ink #111613. Paper #f4f4f0. Barlow Condensed for headings, Barlow for body. These palette values are visual interpretations of the supplied low-resolution logo, not official published brand specifications.

Use strong uppercase typography, generous white space, crisp grids, sharp corners and restrained gold accents. White navigation with the logo centred; active navigation underlined. Dark feature/event sections create contrast. Mobile stacks editorial sections, collapses navigation and reduces card columns.

## Scope delivered

Six linked views, local content database, local read-only API, static fallback data, bundled imagery, original references and technical handover. No user accounts, registrations, payments, actual ticket sales or outbound communication. Do not confuse demo ticket dialogs with a booking integration.
