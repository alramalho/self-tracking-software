import { execFileSync } from "node:child_process";
import { randomUUID, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../utils/prisma";

// Fail closed: synthetic users in the isolated local database only.
const database = new URL(process.env.DATABASE_URL || "http://not-configured");
if (database.hostname !== "127.0.0.1" || database.port !== "55432")
  throw new Error("Apple billing tests require the isolated local database on port 55432.");

const { sendAlert, constructEvent, retrieve } = vi.hoisted(() => ({
  sendAlert: vi.fn(),
  constructEvent: vi.fn(),
  retrieve: vi.fn(),
}));
vi.mock("../../services/telegramService", () => ({
  TelegramService: vi.fn(() => ({ sendAlert, sendMessage: vi.fn() })),
}));
vi.mock("../../services/loopsService", () => ({
  loopsService: { sendPlusUpgradeEvent: vi.fn() },
}));
vi.mock("stripe", () => ({
  default: vi.fn(() => ({ webhooks: { constructEvent }, subscriptions: { retrieve } })),
}));
// Signed in as whoever the test says, without Clerk.
let current: any;
vi.mock("../../middleware/auth", () => ({
  requireAuth: [(req: any, _res: any, next: any) => ((req.user = current), next())],
}));

// A throwaway certificate chain shaped like Apple's (root → intermediate → leaf, with Apple's
// marker extensions), so the real SignedDataVerifier runs without Apple's certificates.
const dir = mkdtempSync(path.join(tmpdir(), "apple-billing-test-"));
const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
function makeChain() {
  writeFileSync(
    path.join(dir, "ext.cnf"),
    [
      "[req]",
      "distinguished_name = dn",
      "[dn]",
      "[root]",
      "basicConstraints = critical,CA:true",
      "keyUsage = critical,keyCertSign,cRLSign",
      "[intermediate]",
      "basicConstraints = critical,CA:true",
      "keyUsage = critical,keyCertSign,cRLSign",
      "1.2.840.113635.100.6.2.1 = ASN1:NULL",
      "[leaf]",
      "basicConstraints = critical,CA:false",
      "1.2.840.113635.100.6.11.1 = ASN1:NULL",
    ].join("\n")
  );
  for (const name of ["root", "intermediate", "leaf"])
    openssl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", `${name}.key`);
  openssl("req", "-x509", "-new", "-key", "root.key", "-subj", "/CN=Test Root", "-days", "2",
    "-config", "ext.cnf", "-extensions", "root", "-out", "root.pem");
  for (const [name, issuer] of [["intermediate", "root"], ["leaf", "intermediate"]]) {
    openssl("req", "-new", "-key", `${name}.key`, "-subj", `/CN=Test ${name}`, "-config", "ext.cnf", "-out", `${name}.csr`);
    openssl("x509", "-req", "-in", `${name}.csr`, "-CA", `${issuer}.pem`, "-CAkey", `${issuer}.key`,
      "-set_serial", String(Date.now()), "-days", "2", "-extfile", "ext.cnf", "-extensions", name, "-out", `${name}.pem`);
  }
  // The verifier trusts whatever root certificates are in APPLE_ROOT_CERTS_DIR.
  mkdirSync(path.join(dir, "trusted"));
  openssl("x509", "-in", "root.pem", "-outform", "der", "-out", "trusted/root.cer");
  const der = (name: string) =>
    openssl("x509", "-in", `${name}.pem`, "-outform", "der").toString("base64");
  return { x5c: ["leaf", "intermediate", "root"].map(der), key: readFileSync(path.join(dir, "leaf.key")) };
}
let chain: ReturnType<typeof makeChain>;

// An App Store style JWS: ES256, signed by the leaf, with the chain in x5c.
function jws(payload: object, key = chain.key) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "ES256", x5c: chain.x5c })}.${encode(payload)}`;
  const signature = sign("sha256", Buffer.from(body), { key, dsaEncoding: "ieee-p1363" });
  return `${body}.${signature.toString("base64url")}`;
}

const DAY = 24 * 60 * 60 * 1000;
function transaction(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: randomUUID(),
    originalTransactionId: randomUUID(),
    bundleId: "so.tracking.app",
    productId: "so.tracking.app.monthly",
    purchaseDate: Date.now() - DAY,
    expiresDate: Date.now() + 6 * DAY,
    type: "Auto-Renewable Subscription",
    inAppOwnershipType: "PURCHASED",
    environment: "Sandbox",
    signedDate: Date.now(),
    appAccountToken: current.appleAppAccountToken,
    ...overrides,
  };
}
function notification(notificationType: string, tx: object, extra: Record<string, unknown> = {}) {
  return jws({
    notificationType,
    notificationUUID: randomUUID(),
    version: "2.0",
    signedDate: Date.now(),
    data: { bundleId: "so.tracking.app", environment: "Sandbox", signedTransactionInfo: jws(tx), ...extra },
  });
}

const prefix = `apple-billing-test-${randomUUID()}`;
let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

beforeAll(async () => {
  chain = makeChain();
  process.env.APPLE_ROOT_CERTS_DIR = path.join(dir, "trusted");
  process.env.APPLE_JWS_ONLINE_CHECKS = "false";
  process.env.STRIPE_API_KEY = "sk_test_unused";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_unused";
  process.env.STRIPE_PLUS_PRODUCT_ID = "prod_plus";
  const { appleBillingRouter } = await import("../appleBilling");
  const { stripeRouter } = await import("../stripe");
  const app = express()
    .use(express.json())
    .use("/billing/apple", appleBillingRouter)
    .use("/stripe", stripeRouter);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
});

const newUser = (data: Record<string, unknown> = {}) =>
  prisma.user.create({
    data: {
      id: `${prefix}-${randomUUID()}`,
      email: `${randomUUID()}@example.invalid`,
      clerkId: `clerk_${randomUUID()}`,
      appleAppAccountToken: randomUUID(),
      ...data,
    },
  });
beforeEach(async () => {
  vi.clearAllMocks();
  current = await newUser();
});

const post = (url: string, body: object) =>
  fetch(`${baseUrl}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const sendTransactions = (...signedTransactions: string[]) =>
  post("/billing/apple/transactions", { signedTransactions });
const reload = (id = current.id) => prisma.user.findUniqueOrThrow({ where: { id } });

describe("GET /billing/apple/account-token", () => {
  it("creates the token once and then keeps it", async () => {
    current = await newUser({ appleAppAccountToken: null });
    const first = await (await fetch(`${baseUrl}/billing/apple/account-token`)).json();
    const second = await (await fetch(`${baseUrl}/billing/apple/account-token`)).json();
    expect(first.appAccountToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(second.appAccountToken).toBe(first.appAccountToken);
    expect((await reload()).appleAppAccountToken).toBe(first.appAccountToken);
  });
});

describe("POST /billing/apple/transactions", () => {
  it("gives PLUS for this user's purchase", async () => {
    const tx = transaction();
    const response = await sendTransactions(jws(tx));
    expect(response.status).toBe(200);
    expect((await response.json()).planType).toBe("PLUS");
    const user = await reload();
    expect(user).toMatchObject({
      planType: "PLUS",
      appleOriginalTransactionId: tx.originalTransactionId,
      appleProductId: "so.tracking.app.monthly",
      appleSubscriptionStatus: "active",
    });
    expect(user.appleSubscriptionExpiresAt?.getTime()).toBe(tx.expiresDate);
    expect(sendAlert).toHaveBeenCalledTimes(1);

    // Sending it again (restore, app restart) changes nothing and doesn't announce twice.
    expect((await sendTransactions(jws(tx))).status).toBe(200);
    expect(sendAlert).toHaveBeenCalledTimes(1);
  });

  it("rejects a subscription that belongs to another account", async () => {
    const other = await newUser({ appleOriginalTransactionId: randomUUID() });
    const tx = transaction({ originalTransactionId: other.appleOriginalTransactionId });
    const response = await sendTransactions(jws(tx));
    expect(response.status).toBe(403);
    expect((await reload()).planType).toBe("FREE");
  });

  it("rejects a purchase made with someone else's account token", async () => {
    const response = await sendTransactions(jws(transaction({ appAccountToken: randomUUID() })));
    expect(response.status).toBe(403);
    expect((await reload()).planType).toBe("FREE");
  });

  it("doesn't give PLUS for an expired subscription", async () => {
    const tx = transaction({ purchaseDate: Date.now() - 9 * DAY, expiresDate: Date.now() - 2 * DAY });
    expect((await sendTransactions(jws(tx))).status).toBe(200);
    expect(await reload()).toMatchObject({ planType: "FREE", appleSubscriptionStatus: "expired" });
  });

  it("rejects an unknown product", async () => {
    const response = await sendTransactions(jws(transaction({ productId: "so.tracking.app.lifetime" })));
    expect(response.status).toBe(400);
    expect((await reload()).planType).toBe("FREE");
  });

  it("rejects a transaction Apple didn't sign", async () => {
    const forged = jws(transaction(), readFileSync(path.join(dir, "root.key")));
    expect((await sendTransactions(forged)).status).toBe(400);
    expect((await reload()).planType).toBe("FREE");
  });
});

describe("POST /billing/apple/notifications", () => {
  const subscribed = async () => {
    const tx = transaction();
    await sendTransactions(jws(tx));
    return tx;
  };
  // Apple sends EXPIRED (or DID_FAIL_TO_RENEW) once the last paid period has ended.
  const ended = async () => {
    const tx = transaction({ purchaseDate: Date.now() - 8 * DAY, expiresDate: Date.now() - 1000 });
    await prisma.user.update({
      where: { id: current.id },
      data: {
        planType: "PLUS",
        appleOriginalTransactionId: tx.originalTransactionId,
        appleProductId: tx.productId,
        appleSubscriptionExpiresAt: new Date(tx.expiresDate),
        appleSubscriptionStatus: "active",
      },
    });
    return tx;
  };
  const notify = (type: string, tx: object, extra?: Record<string, unknown>) =>
    post("/billing/apple/notifications", { signedPayload: notification(type, tx, extra) });

  it("EXPIRED turns coaching off", async () => {
    const response = await notify("EXPIRED", await ended());
    expect(response.status).toBe(200);
    expect(await reload()).toMatchObject({ planType: "FREE", appleSubscriptionStatus: "expired" });
  });

  it("EXPIRED keeps coaching for someone who also pays through Stripe", async () => {
    current = await newUser({ stripeSubscriptionStatus: "active" });
    await notify("EXPIRED", await ended());
    expect(await reload()).toMatchObject({ planType: "PLUS", appleSubscriptionStatus: "expired" });
  });

  it("a late EXPIRED about an older period doesn't undo a newer one", async () => {
    const tx = await subscribed();
    await notify("EXPIRED", { ...tx, transactionId: randomUUID(), expiresDate: Date.now() - DAY });
    expect(await reload()).toMatchObject({ planType: "PLUS", appleSubscriptionStatus: "active" });
  });

  it("DID_RENEW finds the user by account token and gives PLUS", async () => {
    const tx = transaction();
    await notify("DID_RENEW", tx);
    expect(await reload()).toMatchObject({ planType: "PLUS", appleOriginalTransactionId: tx.originalTransactionId });
  });

  it("a failed renewal with a grace period keeps PLUS until the grace period ends", async () => {
    const tx = await ended();
    const graceUntil = Date.now() + 3 * DAY;
    const renewal = jws({
      originalTransactionId: tx.originalTransactionId,
      productId: tx.productId,
      autoRenewProductId: tx.productId,
      autoRenewStatus: 1,
      isInBillingRetryPeriod: true,
      gracePeriodExpiresDate: graceUntil,
      environment: "Sandbox",
      signedDate: Date.now(),
    });
    await notify("DID_FAIL_TO_RENEW", tx, { signedRenewalInfo: renewal });
    const user = await reload();
    expect(user).toMatchObject({ planType: "PLUS", appleSubscriptionStatus: "grace" });
    expect(user.appleSubscriptionExpiresAt?.getTime()).toBe(graceUntil);
  });

  it("refuses a notification Apple didn't sign", async () => {
    const tx = await subscribed();
    const forged = notification("EXPIRED", tx).split(".");
    forged[2] = jws({}, readFileSync(path.join(dir, "root.key"))).split(".")[2];
    const response = await post("/billing/apple/notifications", { signedPayload: forged.join(".") });
    expect(response.status).toBe(400);
    expect((await reload()).planType).toBe("PLUS");
  });
});

describe("Stripe webhook", () => {
  it("doesn't take coaching away from someone with an active Apple subscription", async () => {
    current = await newUser({ stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionStatus: "active" });
    await sendTransactions(jws(transaction()));
    const subscription = {
      id: "sub_test",
      status: "canceled",
      customer: { id: current.stripeCustomerId },
      items: { data: [{ price: { product: "prod_plus" } }] },
    };
    constructEvent.mockReturnValue({ type: "customer.subscription.deleted", data: { object: subscription } });
    retrieve.mockResolvedValue(subscription);
    expect((await post("/stripe/webhook", {})).status).toBe(200);
    expect(await reload()).toMatchObject({ planType: "PLUS", stripeSubscriptionStatus: "canceled" });
  });
});
