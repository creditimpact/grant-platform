# Environment Variables

Secrets for all backend services are stored in Hashicorp Vault. Each service expects
`VAULT_ADDR` and a service specific `VAULT_SECRET_PATH` to be defined. `VAULT_TOKEN`
may be supplied for local development but should come from the runtime environment in
production. The keys listed below reside inside the Vault paths and are not read from
`.env` files.

## Common Variables
| Variable | Purpose | Required | Default |
| --- | --- | --- | --- |
| FRONTEND_URL | Allowed frontend origin | yes* | - |
| ADMIN_URL | Allowed admin origin | no | - |
| ALLOWED_ORIGINS | Comma-separated override for allowed CORS origins | no | - |
| DISABLE_VAULT | Skip Vault checks (set `true` in dev) | no | `true` |
| SECURITY_ENFORCEMENT_LEVEL | `dev` or `prod` readiness mode | no | `dev` |
| SKIP_DB | Skip database readiness checks | no | `false` |

`*` Required unless `ALLOWED_ORIGINS` is provided.

## Vault Configuration
| Variable | Purpose | Required |
| --- | --- | --- |
| VAULT_ADDR | Vault server URL | yes |
| VAULT_SECRET_PATH | KV v2 path containing service secrets | yes |
| VAULT_TOKEN | Token used for authentication | optional (use runtime secrets) |

### Secret rotation
Secrets can be rotated by updating the values stored at `VAULT_SECRET_PATH` and
restarting the consuming service. API keys continue to support the
`*_NEXT_API_KEY` convention for seamless rotation where both old and new keys are
valid during the transition period.

All Vault connections must use **HTTPS**; the platform will refuse to start if
`VAULT_ADDR` is configured with `http://`.

## Server (Node.js)
| Variable | Purpose | Example | Required | Default |
| --- | --- | --- | --- | --- |
| JWT_SECRET | JWT signing secret | `supersecret` | yes | - |
| AI_AGENT_API_KEY | API key for requests to AI Agent | `changeme` | yes | - |
| AI_AGENT_NEXT_API_KEY | Next key for AI Agent during rotation | - | optional | - |
| AI_ANALYZER_API_KEY | API key for requests to AI Analyzer | `changeme` | yes | - |
| AI_ANALYZER_NEXT_API_KEY | Next key for AI Analyzer during rotation | - | optional | - |
| ELIGIBILITY_ENGINE_API_KEY | API key for requests to Eligibility Engine | `changeme` | yes | - |
| ELIGIBILITY_ENGINE_NEXT_API_KEY | Next key for Eligibility Engine during rotation | - | optional | - |
| OPENAI_API_KEY | OpenAI API key | `sk-...` | yes | - |
| FRONTEND_URL | Allowed frontend origin | `https://localhost:3000` | yes | - |
| ELIGIBILITY_ENGINE_URL | Eligibility engine URL | `https://localhost:4001` | yes | - |
| AI_ANALYZER_URL | Analyzer URL | `http://localhost:8002` | yes | - |
| AI_AGENT_URL | Agent URL | `https://localhost:5001` | yes | - |
| MONGO_URI | MongoDB connection string | `mongodb://mongo:27017/grants?authSource=admin&tls=true` | yes | - |
| MONGO_USER | Mongo username | `user` | yes | - |
| MONGO_PASS | Mongo password | `pass` | yes | - |
| MONGO_CA_FILE | CA cert path | `./mongo-certs/ca.pem` | yes | - |
| TLS_KEY_PATH | TLS key | `./tls/server-key.pem` | yes | - |
| TLS_CERT_PATH | TLS cert | `./tls/server-cert.pem` | yes | - |
| TLS_CA_PATH | TLS CA cert | `./tls/ca.pem` | optional | - |
| CLIENT_CERT_PATH | mTLS client cert | `./tls/client-cert.pem` | optional | - |
| CLIENT_KEY_PATH | mTLS client key | `./tls/client-key.pem` | optional | - |
| CLIENT_CA_PATH | mTLS client CA | `./tls/client-ca.pem` | optional | - |
| PORT | Server port | `5000` | yes | 5000 |
| ENABLE_DEBUG | Enable debug logging | `false` | optional | false |
| SKIP_DB | Skip Mongo connection | `false` | optional | false |

## Frontend (Next.js)
| Variable | Purpose | Example | Required | Default |
| --- | --- | --- | --- | --- |
| NEXT_PUBLIC_API_BASE | API base URL | `https://localhost:5000` | yes | - |
| NODE_ENV | Build environment | `development` | yes | - |

## AI Agent (Python)
| Variable | Purpose | Example | Required | Default |
| --- | --- | --- | --- | --- |
| AI_AGENT_API_KEY | API key for this service | `changeme` | yes | - |
| AI_AGENT_NEXT_API_KEY | Next API key during rotation | - | optional | - |
| OPENAI_API_KEY | OpenAI API key | `sk-...` | yes | - |
| MONGO_URI | MongoDB URI | `mongodb://mongo:27017/grants` | yes | - |
| MONGO_USER | Mongo username | `user` | yes | - |
| MONGO_PASS | Mongo password | `pass` | yes | - |
| MONGO_CA_FILE | CA cert path | `./mongo-certs/ca.pem` | yes | - |
| MONGO_AUTH_DB | Auth DB | `admin` | optional | `admin` |
| TLS_CERT_PATH | TLS cert | `./tls/agent-cert.pem` | yes | - |
| TLS_KEY_PATH | TLS key | `./tls/agent-key.pem` | yes | - |
| TLS_CA_PATH | TLS CA | `./tls/ca.pem` | optional | - |
| ENABLE_DEBUG | Debug flag | `false` | optional | false |

## AI Analyzer (Python)
| Variable | Purpose | Example | Required | Default |
| --- | --- | --- | --- | --- |
| AI_ANALYZER_API_KEY | API key for this service | `changeme` | yes | - |
| AI_ANALYZER_NEXT_API_KEY | Next API key during rotation | - | optional | - |
| TLS_CERT_PATH | TLS cert | `./tls/analyzer-cert.pem` | yes | - |
| TLS_KEY_PATH | TLS key | `./tls/analyzer-key.pem` | yes | - |
| TLS_CA_PATH | TLS CA | `./tls/ca.pem` | optional | - |

## Eligibility Engine (Python)
| Variable | Purpose | Example | Required | Default |
| --- | --- | --- | --- | --- |
| ELIGIBILITY_ENGINE_API_KEY | API key for this service | `changeme` | yes | - |
| ELIGIBILITY_ENGINE_NEXT_API_KEY | Next API key during rotation | - | optional | - |
| TLS_CERT_PATH | TLS cert | `./tls/engine-cert.pem` | yes | - |
| TLS_KEY_PATH | TLS key | `./tls/engine-key.pem` | yes | - |
| TLS_CA_PATH | TLS CA | `./tls/ca.pem` | optional | - |

