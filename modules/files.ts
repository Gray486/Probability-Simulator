import * as fs from "fs";
import { ChatLog, KeysFile, SubscriptionInformation, User, DirectMessageChannel } from "../types";

const USER_DB_FILE_PATH: string = __dirname + "/../storage/accounts.json";
const KEYS_FILE_PATH: string = __dirname + "/../storage/keys.json"
const CHAT_LOG_PATH: string = __dirname + "/../storage/chatlog.json"
const SUBSCRIBERS_PATH: string = __dirname + "/../storage/subscribers.json"

// Link to keys file (only for gray): https://docs.google.com/document/d/1cb7GLQKhSMh6cB11qgARVA7eCfubcvpuZVbKT0ABnkw/edit?usp=sharing

export const KEYS: KeysFile = JSON.parse(fs.readFileSync(KEYS_FILE_PATH).toString());

export function getUserDBAsync(next: (userDB: User[]) => void) {
        fs.readFile(USER_DB_FILE_PATH, (err, data) => {
                if (err) return;
                let userDB: User[] = JSON.parse(data.toString());
                next(userDB)
        });
}

export function setUserDB(userDB: User[]): void {
        fs.writeFile(USER_DB_FILE_PATH, JSON.stringify(userDB), () => { });
}

/** Adds user to userDB. */
export function addUser(user: User): void {
        getUserDBAsync((userDB) => {
                userDB.push(user);
                setUserDB(userDB);
        })
}

function getChatLogAsync(next: (data: ChatLog[]) => void): void {
        fs.readFile(CHAT_LOG_PATH, (err, data) => {
                if (err) return;
                let chatLog: ChatLog[] = JSON.parse(data.toString());
                next(chatLog)
        });
}

function setChatLog(chatLog: ChatLog[]): void {
        fs.writeFile(CHAT_LOG_PATH, JSON.stringify(chatLog), () => { });
}

/** Logs chat message. */
export function logChatMessage(username: string, realName: string, message: string) {
        getChatLogAsync((chatLog) => {
                chatLog.push({ username: username, realName: realName, message: message })
                setChatLog(chatLog)
        })
}

export function getSubscriberDBAsync(next: (database: SubscriptionInformation[]) => void) {
        fs.readFile(SUBSCRIBERS_PATH, (err, data) => {
                if (err) return;
                let database: SubscriptionInformation[] = JSON.parse(data.toString());
                next(database)
        })
}

function setSubscriberDB(subscribers: SubscriptionInformation[]) {
        fs.writeFile(SUBSCRIBERS_PATH, JSON.stringify(subscribers), () => { });
}

/**
 * Adds a subscriber to the subscriber database.
 * @param subscriber The subscriber to add to the database.
 * @returns The subscriber ID
 */
export function addToSubscriberDB(subscriber: SubscriptionInformation) {
        getSubscriberDBAsync((currentSubscriberDB) => {
                currentSubscriberDB.push(subscriber);
                setSubscriberDB(currentSubscriberDB);
        })
}

// FIXME: Maybe temparary, need to decide if I want to make this save in a file.

let directMessageChannels: DirectMessageChannel[] = [];

export function getDirectMessageChannels(next: (directMessageChannels: DirectMessageChannel[]) => void) {
        next(directMessageChannels)
}

export function setDirectMessageChannels(newDirectMessageChannels: DirectMessageChannel[]) {
        directMessageChannels = newDirectMessageChannels;
}
