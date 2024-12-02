# Casino Simulator
## How to setup
In the root directory of the project you need to create a "storage" folder in the root of the project with the following files and contents:
 - accounts.json: `[]`
 - chatlog.json: `[]`
 - subscribers.json: `[]`
 - keys.json:
```
{
    G_CLIENT_ID: YOUR_GOOGLE_APP_CLIENT_ID,
    VAPID: {
        SUBJECT: YOUR_MAILTO_URL,
        PUBLIC_KEY: YOUR_VAPID_PUBLIC_KEY,
        PRIVATE_KEY: YOUR_VAPID_PRIVATE_KEY
    },
	JWT_SECRET: YOUR_JWT_SECRET
}
   ```