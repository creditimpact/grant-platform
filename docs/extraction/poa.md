# Power of Attorney Extraction

This module detects and parses Power of Attorney (POA) documents from OCR text without relying on jurisdiction-specific layouts.

## Detector Signals
- Headers and titles such as Power of Attorney, Attorney-in-Fact, Designation of Agent, Grant of Authority, Revocation, Durable, Limited, Springing, Important Information for the Agent
- Role phrases including principal, agent, successor agent, witness, notary public
- Execution block phrases like STATE OF, COUNTY OF, subscribed and sworn, personally appeared
- Presence of a recognizable date

Confidence score = 0.6 + 0.1 per matched signal (max 0.95) and +0.05 if a notary block is found.

## Schema
See `server/services/extractors/poa.js` for field descriptions and normalization rules.
