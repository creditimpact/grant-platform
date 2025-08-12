# Role-Based Access Control

The backend implements simple role-based access control (RBAC) with two roles:

- `user` – default role for all newly registered accounts
- `admin` – elevated role with access to administrative endpoints

## User Roles

Each user document includes a `role` field stored in MongoDB and embedded in JWTs. Tokens issued during login, registration or refresh include the user's id, email and role. The authentication middleware reads these values and exposes them on `req.user`.

To promote a user to an administrator, update the `role` field in the database:

```js
// using Mongo shell or driver
db.users.updateOne({ _id: ObjectId("<userId>") }, { $set: { role: 'admin' } });
```

## Authorization Middleware

Use `requireRole(role)` middleware to protect routes. It checks `req.user.role` and returns `403 Forbidden` if the role does not match.

Example:

```js
const auth = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

router.post('/form-template', auth, requireRole('admin'), handler);
```

## Protected Routes

Currently the following routes require an `admin` role:

- `POST /api/form-template` – create new form templates

Additional routes can be protected by applying `requireRole('admin')` as needed.
