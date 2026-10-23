# Problem 3: Debugging Issues Within the System

Every call to `/api/users` failed with 502. Also, a small Postgres or Redis problem could crash or freeze the API.

## How I found the problems

- Followed one request: `curl` through nginx, then the nginx log, the API log and `docker inspect`.
- Broke one thing at a time: killed database connections, stopped Redis, timed start and stop.

## Problems and fixes

| # | Problem | Proof | Fix |
| --- | --- | --- | --- |
| 1 | nginx sends traffic to port 3001, but the API uses 3000 | 502, `Connection refused ... :3001` | Use port 3000 |
| 2 | A lost database connection crashes the API | `Unhandled 'error' event` | Handle the error |
| 3 | A crashed API never restarts | `restarts=0 policy=no` | `restart: unless-stopped`; nginx gives up after 2s |
| 4 | Database connections are not returned, then requests freeze | `total=10 idle=0` | `pool.query()` and 5s time limits |
| 5 | If Redis is down, requests wait 21s, then fail | `MaxRetriesPerRequestError` | Don't wait for Redis; fail fast |
| 6 | The API starts before the database is ready | `ECONNREFUSED` at start | Health checks; start the API when the database is ready |
| 7 | Stopping the API takes 10 seconds | exit 137 after 10.34s | `init: true` so the stop signal reaches node |

Config files that were never used:

- `postgres/init.sql` (limit of 20 connections) was not mounted, so Postgres used 100. Now it is mounted.
  One API (10 connections) fits; 3 API copies would need 30 and fail with `too many clients`.
- `nginx/nginx.conf` is empty and not mounted. Mounted as it is, nginx will not start, so it stays unmounted.
- The old `version` line in `docker-compose.yml` is ignored by Compose v2, so I removed it.

## Tests after the fix

| Test | Result |
| --- | --- |
| Start everything, call `/api/users` | 200 OK |
| 400 requests, 60 at a time, with the 20-connection limit | All 200 OK, at most 10 connections used |
| Kill database connections under load | 119-120 of 120 OK, no crash |
| Stop Redis | Still 200, in 2-3ms |
| Kill the API process | Restarts by itself in 7s |
| Stop the API | Stops in 0.38s; nginx answers 504 in 2s instead of freezing |

## Monitoring

- Call `/api/users` through nginx every minute. Alert after 2 failures or slow answers (over 1s).
- Alert on many 5xx errors, container restarts, and requests waiting for a database connection.

## Prevent it in production

- Every network call has a time limit. Connections are always returned. Redis can never block a request.
- CI checks the config files (`compose config`, `nginx -t`) and runs the tests above.
- Not changed, because they did not cause this problem: running as non-root, a lockfile, a secret store, memory limits.
