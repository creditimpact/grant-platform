# Server Test Notes

Integration tests hit the live services. The Eligibility Engine must expose a `POST /check` endpoint.
Set `ELIGIBILITY_ENGINE_URL` and `ELIGIBILITY_ENGINE_PATH` so the server posts to the correct route (defaults `http://localhost:4001` and `/check`).
