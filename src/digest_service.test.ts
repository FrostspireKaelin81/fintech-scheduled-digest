import assert from "node:assert/strict";
import { shouldNotify, paymentEvent } from "./digest_service.js";

const event = paymentEvent.parse({ subscriber: "payee@example.com", amount: 42, currency: "USD", risk: "low" });
assert.equal(shouldNotify(event), true);
assert.equal(shouldNotify({ ...event, risk: "high" }), false);
assert.throws(() => paymentEvent.parse({ subscriber: "bad", amount: 1, currency: "USD", risk: "low" }));
console.log("digest decision tests passed");
