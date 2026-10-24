# Email / notifications

No SMTP is wired for the first release. All outbound mail is written to a log file **and**
mirrored into the admin portal inbox so you can review it without configuring a provider.

## Sinks

1. **File log** — `logs/outbound_mail.log` (gitignored). Each entry is a single JSON line:

   ```json
   {"ts":"2026-10-24T09:42:11Z","to":"ops@wuco.ie","subject":"New gym enquiry: Monarch Fight Academy","body":"...","category":"gym_enquiry"}
   ```

2. **Admin inbox** — `outbound_mail` table (migration `010_mail_log.sql`). The admin portal
   surfaces this as a "Notifications" tab, newest first, with search and category filter.

Both sinks are written in a single transaction by `wuco_mail.send(to, subject, body, category)`.
If the file write fails the DB row is still written (and vice versa) so no notification is lost.

## Categories

| Category          | Trigger                                              | Recipient (logical) |
|-------------------|------------------------------------------------------|---------------------|
| `fighter_signup`  | Fighter registers; awaiting admin approval           | WUCO admin          |
| `fighter_approved`| Admin approves a fighter application                 | Fighter             |
| `fighter_rejected`| Admin rejects a fighter application                  | Fighter             |
| `gym_enquiry`     | Public gym-join form submitted                       | WUCO admin          |
| `gym_onboarding`  | Admin sends one-time onboarding link to a gym        | Gym contact         |
| `gym_submitted`   | Gym finishes the onboarding form                     | WUCO admin          |
| `gym_approved`    | Admin approves the gym; coach account created        | Gym contact         |
| `gym_join_request`| Fighter requests to join a gym                       | Gym admin           |
| `class_booking`   | Fighter books a class or buys a pass                 | Gym admin           |

## Swapping in real SMTP later

Replace the body of `wuco_mail.send()` with an `smtplib` or provider API call. Keep the DB and
log writes in place — they double as an audit trail. Required env vars (not currently used):

- `WUCO_SMTP_HOST`
- `WUCO_SMTP_PORT`
- `WUCO_SMTP_USER`
- `WUCO_SMTP_PASS`
- `WUCO_SMTP_FROM`

If none are set, the sender stays in log-only mode.

## Testing

Tests should call `wuco_mail.collect()` which returns and clears the in-memory ring buffer
populated during a request. Do not read the log file in tests; the ring buffer is deterministic.
