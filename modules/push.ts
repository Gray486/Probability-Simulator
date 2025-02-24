import * as webpush from "web-push";
import { KEYS } from "./files";
import { LastOnline } from "../types";
import SubscriptionModel, { SubscriptionInformation } from "./database/SubscriptionModel";

const { VAPID } = KEYS;

/** Key value par of usernames to when they were last online. */
export let lastOnline: LastOnline = {};

webpush.setVapidDetails(VAPID.SUBJECT, VAPID.PUBLIC_KEY, VAPID.PRIVATE_KEY);

/**
 * Send a push notification to all subscribers.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export async function blastPushNotifications(title: string, body: string): Promise<void> {
    const subscriptionModels = (await SubscriptionModel.findAll())
    let subscribers: SubscriptionInformation[] = subscriptionModels.map((m) => m.fullSubcription)

    for (let i = 0; i < subscribers.length; i++) {
        const payload = {
            title: title,
            body: body,
            icon: "",
        };

        try {
            await webpush.sendNotification(subscribers[i], JSON.stringify(payload));
        } catch (err) { }
    }
}

/**
 * Send a push notification to specified user.
 * @param username The user to send a push to.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export async function sendPushNotification(subscriptions: SubscriptionInformation[], title: string, body: string): Promise<void> {
    for (let i = 0; i < subscriptions.length; i++) {
        const subscription = subscriptions[i];
        const payload = {
            title: title,
            body: body,
            icon: "",
        };

        try {
            await webpush.sendNotification(subscriptions[i], JSON.stringify(payload));
        } catch (err) { }
    }
}
