Place `mongo.pem` (server certificate and key) and `ca.pem` (certificate authority)
files in this directory before starting the stack. These files are mounted into
the MongoDB container and used to enforce TLS.
