const publicVapidKey = "BEagjSu_2TEC8gi4sG278VkcPYcYxUm8n2sEH_O5B95Kk3N8_ndDLTWpn3mqY8cCWQo3Hbh_8Z1ejSUN-LVtQKE";

/** Registers the service worker and subscribes to push notifications. */
export async function subscribeToPush(): Promise<void> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const register = await navigator.serviceWorker.getRegistration("/")
        ?? await navigator.serviceWorker.register("/worker.js", { scope: "/" });

    if (await register.pushManager.getSubscription()) return;

    const subscription: PushSubscription = await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
    });

    await fetch("/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: { "Content-Type": "application/json" }
    });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding: string = "=".repeat((4 - base64String.length % 4) % 4);
    const base64: string = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData: string = window.atob(base64);
    return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}
