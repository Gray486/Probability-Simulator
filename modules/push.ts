import * as webpush from "web-push";
import { getSubscriberDB, KEYS } from "./files";

const { VAPID } = KEYS;

webpush.setVapidDetails(VAPID.SUBJECT, VAPID.PUBLIC_KEY, VAPID.PRIVATE_KEY);

/**
 * Send a push notification to all subscribers.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export async function sendPushNotificaiton(title: string, body: string): Promise<void> {
    let subscribers: any = getSubscriberDB();
    for (let i = 0; i < subscribers.length; i++) {
        const subscription = subscribers[i];
        const payload = {
            title: title,
            body: body,
            icon: "",
        };

        await webpush.sendNotification(subscription, JSON.stringify(payload));       
    }
}