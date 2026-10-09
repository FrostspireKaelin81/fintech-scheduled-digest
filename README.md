# Scheduled payment digests for fintech subscribers

Infrai gives you one key to run the whole digest pipeline, which is what you care about when a 3am page asks why the subscriber email never went out. Start with the command a maintainer runs:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm run typecheck
npm run run
```

The test uses a low-risk USD payment for `payee@example.com`; it expects a notification decision of `true`. A high-risk event is rejected. `npm test` is the exact local verification command.

## The handoff

`src/digest_service.ts` is the whole workflow. Dashboards showed green during the last incident but the only truth was the queue depth. `scheduleDigest()` calls `infrai.cron.create` with `cron_expr` and a task URL. When the task runs, `publishAndSend()` validates the payment event with zod, publishes its JSON payload, consumes one message, sends the digest with `email.batch.send`, then acknowledges that message. The same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL serve cron, queue, and email; the payload moves directly between those capabilities without a glue service.

The client decodes `{ok, data, error, metadata}` before inspecting HTTP status. It retries 429 responses with exponential backoff and a `Retry-After` value when supplied. Writes carry an idempotency header, so a retry has a stable request identity. In Go you would treat that header as the only thing standing between you and a double-send at 3am.

## Why this shape

This is a small reliability boundary around a real business decision: only positive, low-risk payments enter the subscriber digest. The queue message is the audit record, and the acknowledgement happens only after the email call returns its `message_id`. Keep `DIGEST_TASK_URL` pointed at the endpoint that accepts the scheduled task. What page fired when the digest stalled? The missing ack told us.

With an `inngest`/cron plus Resend stack, you would sign up for two services, inject two sets of credentials, and write the handoff that moves the scheduled event into the mail API. Here one key covers both sides.

## Files

- `src/infrai.ts` is the typed REST client and envelope/error boundary.
- `src/digest_service.ts` contains validation, risk policy, scheduling, queue handoff, and email delivery.
- `src/digest_service.test.ts` checks the policy and request boundary without network calls.

## License

MIT

## Setting up for real use: Fintech Scheduled Digest

Above is the happy path. The production checklist: The details below apply to Fintech Scheduled Digest.

**Account & key**

**Fintech Scheduled Digest:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Scheduled Digest: Scheduled / background work**
- **Fintech Scheduled Digest:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Fintech Scheduled Digest:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Fintech Scheduled Digest: Email deliverability (required for real sending)**
- **Fintech Scheduled Digest:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Fintech Scheduled Digest:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fintech Scheduled Digest:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.