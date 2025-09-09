# Bank Statement Extraction

This module detects and parses bank statements from generic text.

## Detector Signals
- Keywords: Statement Period, Ending/Closing Balance, Beginning Balance, Account Number, Deposits, Withdrawals, Checks
- Date range: `MMM d, yyyy through MMM d, yyyy`
- Vendor hints: major US bank names or "Member FDIC"

Confidence score = 0.6 + 0.1 per signal (max 0.95) +0.05 if vendor detected.

## Schema
See server/services/extractors/bankStatement.js for field descriptions.

## Vendor Patches
Optional synonyms and headings can be configured via `config/bank_patches.yaml`.
