const publicVapidKey = "BEORef-fuEOyljiEmeRuLSf17uqmGGKNN0Y4kNF3XbGYr6KfukGSbCj5AkSGsBpT8vUB6GV0cLoZsv9g3MG_XSg";

async function subscribeToPush() {
    const workers: readonly ServiceWorkerRegistration[] = await navigator.serviceWorker.getRegistrations()

    let register: ServiceWorkerRegistration;

    if (workers.length > 0) {
        console.log("Service worker already registered.")
        register = workers[0]
    } else {
        console.log("Registering service worker...");
        register = await navigator.serviceWorker.register("/worker.js", {
            scope: "/"
        });
    }

    if (!(await register.pushManager.getSubscription())) {
        console.log("Registering Push...");
        const subscription: PushSubscription = await register.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        console.log("Subscribing for Push ...");
        await fetch("/subscribe", {
            method: "POST",
            body: JSON.stringify(subscription),
            headers: {
                "Content-Type": "application/json"
            }
        });
    } else {
        console.log("Push already registerd.");
    }

}

function urlBase64ToUint8Array(base64String: string) {
    const padding: string = "=".repeat((4 - base64String.length % 4) % 4);
    const base64: string = (base64String + padding)
        .replace(/\-/g, "+")
        .replace(/_/g, "/");

    const rawData: string = window.atob(base64);
    const outputArray: Uint8Array = new Uint8Array(rawData.length);

    for (let i: number = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

if ('serviceWorker' in navigator) {
    subscribeToPush();
}