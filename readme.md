# Probability Simulator
## How to setup
In the root directory of the project you need to create a "keys" folder in the root of the project with the following files and contents:
 - cert.pem: HTTPS Certificate
 - key.pem: HTTPS Private Key
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
In the root directory of the project you need to create a "storage" folder in the root of the project with the following files and contents:
 - chatlog.json: `[]`
## Running
To specify the port to run the server on, simply type "port ####" when running the index file.
Ex: "node index.js port 9999"