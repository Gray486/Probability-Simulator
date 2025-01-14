import * as webpush from "web-push";
import { getSubscriberDBAsync, KEYS } from "./files";
import { SubscriptionInformation } from "./types";

const { VAPID } = KEYS;

webpush.setVapidDetails(VAPID.SUBJECT, VAPID.PUBLIC_KEY, VAPID.PRIVATE_KEY);

/**
 * Send a push notification to all subscribers.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export function blastPushNotifications(title: string, body: string): void {
    getSubscriberDBAsync((subscribers: SubscriptionInformation[]) => {
        for (let i = 0; i < subscribers.length; i++) {
            const subscription: SubscriptionInformation = subscribers[i];
            const payload = {
                title: title,
                body: body,
                icon: "",
            };

            const { username, ...webPushSubscription } = subscription;

            webpush.sendNotification(webPushSubscription, JSON.stringify(payload));       
        }
    })

}

/**
 * Send a push notification to specified user.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export function sendPushNotification(username: string, title: string, body: string): void {
    getSubscriberDBAsync((subscribers: SubscriptionInformation[]) => {
        subscribers.filter((a) => a.username == username)

        for (let i = 0; i < subscribers.length; i++) {
            const subscription = subscribers[i];
            const payload = {
                title: title,
                body: body,
                icon: "",
            };

            const { username, ...webPushSubscription } = subscription;

            webpush.sendNotification(webPushSubscription, JSON.stringify(payload));       
        }
    })
}