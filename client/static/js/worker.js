self.addEventListener("push", e => {

        // Data from service
        const data = e.data.json();
        console.log("Push Recieved...");
        self.registration.showNotification(data.title, {
                body: data.body,
                icon: data.icon,
        });
});

self.addEventListener('notificationclick', function (event) {
        let url = 'https://game.grayjn.com/';
        event.notification.close(); // Android needs explicit close.
        if (clients.openWindow) {
                return clients.openWindow(url);
        }
});
