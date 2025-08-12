# Load Testing

## k6
```
export K6_BASE_URL=https://localhost:5000
npm run k6:smoke
npm run k6:baseline
```

## Locust
```
locust -f load/locust/locustfile.py --host https://localhost:5000
```
