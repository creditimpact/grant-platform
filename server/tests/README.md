# Server Test Notes

Integration tests hit the live services. The Eligibility Engine listens on the root path (`/`).
Older instructions referenced a `/check` route, but the engine now responds directly on `/`.
Ensure `ELIGIBILITY_ENGINE_URL` points to the base URL and the server POSTs to that root rather than appending `/check`.
