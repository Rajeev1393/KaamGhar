const { createHmac, timingSafeEqual } = require("node:crypto");
const SupportMessage = require("../models/SupportMessage");

function settings() {
  const { WHATSAPP_PHONE_NUMBER_ID: phoneId, WHATSAPP_SUPPORT_NUMBER: recipient,
    WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_APP_SECRET: secret, WHATSAPP_WEBHOOK_VERIFY_TOKEN: verifyToken,
    WHATSAPP_SUPPORT_TEMPLATE: template, WHATSAPP_TEMPLATE_LANGUAGE: language = "en_US",
    WHATSAPP_GRAPH_VERSION: version = "v25.0" } = process.env;
  if (!/^\d+$/.test(phoneId || "") || !/^[1-9]\d{7,14}$/.test(recipient || "") ||
      !/^v\d+\.\d+$/.test(version) || !token || !secret || !verifyToken || !template) return null;
  return { phoneId, recipient, token, secret, verifyToken, template, language, version };
}

function queuedDelivery() {
  return settings() ? { whatsappAttempts: 0, whatsappNextAttempt: new Date() } : {};
}

async function deliver(message, config) {
  const preview = message.text || "Document attached. Open the website support inbox to download it.";
  const response = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: config.recipient,
      type: "template",
      template: {
        name: config.template,
        language: { code: config.language },
        components: [{ type: "body", parameters: [{ type: "text", text: preview.replace(/\s+/g, " ").slice(0, 700) }] }]
      }
    })
  });
  const payload = await response.json();
  const id = payload.messages?.[0]?.id;
  if (!response.ok || typeof id !== "string" || !id) {
    throw new Error(`WhatsApp send failed (HTTP ${response.status}, Graph code ${Number(payload.error?.code) || "unknown"}).`);
  }
  return id;
}

function startDelivery() {
  const config = settings();
  if (!config) return;
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const message = await SupportMessage.findOneAndUpdate(
        { whatsappNextAttempt: { $lte: new Date() }, whatsappAttempts: { $lt: 6 } },
        { $inc: { whatsappAttempts: 1 }, $set: { whatsappNextAttempt: new Date(Date.now() + 60000) } },
        { sort: { whatsappNextAttempt: 1 }, new: true }
      ).lean();
      if (!message) return;
      const claim = { _id: message._id, whatsappAttempts: message.whatsappAttempts };
      let id;
      try {
        id = await deliver(message, config);
      } catch (error) {
        console.error("Support WhatsApp delivery failed:", error.message);
        if (message.whatsappAttempts < 6) {
          await SupportMessage.updateOne(claim, {
            $set: { whatsappNextAttempt: new Date(Date.now() + 30000 * 2 ** (message.whatsappAttempts - 1)) }
          });
        } else {
          await SupportMessage.updateOne(claim, { $unset: { whatsappNextAttempt: "" } });
        }
        return;
      }
      await SupportMessage.updateOne(claim, {
        $set: { whatsappMessageId: id },
        $unset: { whatsappNextAttempt: "" }
      });
    } catch (error) {
      console.error("Support WhatsApp queue failed:", error.name);
    } finally {
      running = false;
    }
  }
  const timer = setInterval(tick, 2000);
  timer.unref();
  void tick();
}

function matches(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyWebhook(req, res) {
  const config = settings();
  if (!config || req.query["hub.mode"] !== "subscribe" ||
      !matches(req.query["hub.verify_token"], config.verifyToken)) return res.sendStatus(403);
  const challenge = req.query["hub.challenge"];
  if (typeof challenge !== "string" || !/^\d+$/.test(challenge)) return res.sendStatus(400);
  res.type("text/plain").send(challenge);
}

async function receiveWebhook(req, res) {
  const config = settings();
  if (!config || !Buffer.isBuffer(req.body)) return res.sendStatus(403);
  const signature = "sha256=" + createHmac("sha256", config.secret).update(req.body).digest("hex");
  if (!matches(req.get("x-hub-signature-256"), signature)) return res.sendStatus(403);

  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }
  if (payload?.object !== "whatsapp_business_account") return res.sendStatus(200);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || change.value?.metadata?.phone_number_id !== config.phoneId) continue;
      for (const message of change.value.messages ?? []) {
        const text = typeof message.text?.body === "string" ? message.text.body.trim() : "";
        const quotedId = message.context?.id;
        if (message.from !== config.recipient || message.type !== "text" || !text ||
            typeof quotedId !== "string" || typeof message.id !== "string" || !message.id) continue;
        const original = await SupportMessage.findOne({ whatsappMessageId: quotedId, sender: "customer" }).select("customer").lean();
        if (!original) continue;
        try {
          await SupportMessage.updateOne({ whatsappMessageId: message.id }, {
            $setOnInsert: { customer: original.customer, sender: "support", text: text.slice(0, 1000) }
          }, { upsert: true });
        } catch (error) {
          if (error.code !== 11000) throw error;
        }
      }
    }
  }
  res.sendStatus(200);
}

module.exports = { queuedDelivery, startDelivery, verifyWebhook, receiveWebhook };
