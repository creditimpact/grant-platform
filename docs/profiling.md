# Profiling

Set `PROFILING_ENABLED=true` and run:

```
npm run profile:flame --prefix server
pyinstrument -r html -o profile.html -m eligibility-engine.api
```

Profiling is intended for local development only.
