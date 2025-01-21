import * as webpush from "web-push";
import { getSubscriberDBAsync, KEYS } from "./files";
import { LastOnline, SubscriptionInformation } from "../types";

const { VAPID } = KEYS;

export let lastOnline: LastOnline = {};

webpush.setVapidDetails(VAPID.SUBJECT, VAPID.PUBLIC_KEY, VAPID.PRIVATE_KEY);

/**
 * Send a push notification to all subscribers.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export function blastPushNotifications(title: string, body: string): void {
        getSubscriberDBAsync(async (subscribers: SubscriptionInformation[]) => {
                for (let i = 0; i < subscribers.length; i++) {
                        const subscription: SubscriptionInformation = subscribers[i];
                        const payload = {
                                title: title,
                                body: body,
                                icon: "",
                        };

                        const { username, ...webPushSubscription } = subscription;

                        try {
                                await webpush.sendNotification(webPushSubscription, JSON.stringify(payload));
                        } catch (err) { }
                }
        })

}

/**
 * Send a push notification to specified user.
 * @param username The user to send a push to.
 * @param title Title of push notification.
 * @param body Body of push notification.
 */
export function sendPushNotification(username: string, title: string, body: string): void {
        console.log(lastOnline)

        if (lastOnline[username] && new Date().getTime() - lastOnline[username] < 5000) return;

        getSubscriberDBAsync(async (subscribers: SubscriptionInformation[]) => {
                subscribers = subscribers.filter((a) => a.username == username)

                for (let i = 0; i < subscribers.length; i++) {
                        const subscription = subscribers[i];
                        const payload = {
                                title: title,
                                body: body,
                                icon: "",
                        };

                        const { username, ...webPushSubscription } = subscription;

                        try {
                                await webpush.sendNotification(webPushSubscription, JSON.stringify(payload));
                        } catch (err) { }
                }
        })
}
