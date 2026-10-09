import { z } from "zod";
import { infrai } from "./infrai.js";

const digestQueue = "payment-digests";

export const paymentEvent = z.object({ subscriber: z.string().email(), amount: z.number().nonnegative(), currency: z.string().length(3), risk: z.enum(["low", "high"]) });
export type PaymentEvent = z.infer<typeof paymentEvent>;

export function shouldNotify(event: PaymentEvent): boolean { return event.risk === "low" && event.amount > 0; }

export async function scheduleDigest(taskUrl: string): Promise<string> {
  const job = await infrai.cron.create({ cron_expr: "0 9 * * *", task: taskUrl });
  return job.job_id;
}

export async function publishAndSend(raw: unknown): Promise<string | null> {
  const event = paymentEvent.parse(raw);
  if (!shouldNotify(event)) return null;
  const published = await infrai.queue.publish({ queue: digestQueue, payload: JSON.stringify(event) });
  const batch = await infrai.queue.consume({ queue: digestQueue, max_messages: 1, visibility_timeout: 60 });
  const message = batch.messages?.find((item) => item.message_id === published.message_id) ?? batch.messages?.[0];
  if (!message) return null;
  const decoded = paymentEvent.parse(JSON.parse(message.payload));
  const sent = await infrai.email.batch.send({
    messages: [{
      to: [decoded.subscriber],
      subject: "Payment digest",
      text: `Payment: ${decoded.amount} ${decoded.currency}`
    }]
  });
  await infrai.queue.ack({ queue: digestQueue, message_id: message.message_id });
  return sent.message_id;
}

if (process.argv[1]?.endsWith("digest_service.ts")) {
  const taskUrl = process.env.DIGEST_TASK_URL ?? "https://example.com/fintech-digest";
  const jobId = await scheduleDigest(taskUrl);
  console.log(`scheduled ${jobId}`);
}
