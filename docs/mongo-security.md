# MongoDB Security Configuration

This project requires MongoDB authentication and TLS for all services.

## Server configuration

1. Generate a certificate authority and server certificate (see `mongo-certs/README.md`).
2. Start MongoDB with authentication and TLS. The provided `docker-compose.yml`
   uses `mongod --auth --tlsMode requireTLS` and mounts the certificate files.
3. Create dedicated users for each service with the least privileges needed. For
   example:
   ```js
   use grants;
   db.createUser({
     user: "serverUser",
     pwd:  "strongPassword",
     roles: [{ role: "readWrite", db: "grants" }]
   });
   use ai_agent;
   db.createUser({
     user: "agentUser",
     pwd:  "strongPassword",
     roles: [{ role: "readWrite", db: "ai_agent" }]
   });
   ```

## Application configuration

Each service expects the following environment variables:

```bash
MONGO_URI=mongodb://mongo:27017/<db>?authSource=admin&tls=true
MONGO_USER=<serviceUser>
MONGO_PASS=<servicePassword>
MONGO_CA_FILE=/path/to/ca.pem
```

The CA file is used to verify the TLS certificate presented by MongoDB. `MONGO_URI`
should include `tls=true` to enforce encrypted connections.

## Validation

Run `npm run verify:mongo` from the `server` directory to confirm that the
application can connect using TLS. The script will fail if authentication or
encryption is misconfigured. Additionally, try connecting without a password or
with `tls=false` and confirm that the connection is rejected. Users created for
one service should not be able to access databases belonging to another.
