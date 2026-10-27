self.addEventListener("push", e => {

    // Data from service
    const data = e.data.json();
    console.log("Push Recieved...");
    self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon,
        data: { url: data.url },
    });
});

self.addEventListener('notificationclick', function (event) {
    // Invites to private lobbies open the lobby, everything else opens the home page
    let url = new URL(event.notification.data?.url ?? '/', self.location.origin).href;
    event.notification.close(); // Android needs explicit close.
    if (clients.openWindow) {
        return clients.openWindow(url);
    }
});
