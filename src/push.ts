import { buildPushPayload } from "@block65/webcrypto-web-push";
import { Env } from "./env";
import { removeSubscription, SubscriptionInformation } from "./db";

/**
 * Send a push notification to the given subscriptions.
 * @param title Title of push notification.
 * @param body Body of push notification.
 * @param url Page opened when the notification is clicked, the home page if not given.
 */
export async function sendPushNotification(env: Env, subscriptions: SubscriptionInformation[], title: string, body: string, url?: string): Promise<void> {
    if (!env.VAPID_PRIVATE_KEY) return;

    const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
    const message = { data: { title: title, body: body, icon: "", url: url ?? "/" }, options: { ttl: 60 * 60 } };

    await Promise.all(subscriptions.map(async (subscription) => {
        try {
            const payload = await buildPushPayload(message, { ...subscription, expirationTime: subscription.expirationTime ?? null }, vapid);
            const res = await fetch(subscription.endpoint, payload);
            // Subscription is no longer valid
            if (res.status == 404 || res.status == 410) {
                await removeSubscription(env.DB, subscription.endpoint);
            }
        } catch (err) {
            console.error(err);
        }
    }));
}
