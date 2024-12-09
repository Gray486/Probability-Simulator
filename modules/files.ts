import * as fs from "fs";
import { ChatLog, KeysFile, User } from "./types";

const USER_DB_FILE_PATH: string = __dirname + "/../storage/accounts.json";
const KEYS_FILE_PATH: string = __dirname + "/../storage/keys.json"
const CHAT_LOG_PATH: string = __dirname + "/../storage/chatlog.json"
const SUBSCRIBERS_PATH: string = __dirname + "/../storage/subscribers.json"

// Link to keys file (only for gray): https://docs.google.com/document/d/1cb7GLQKhSMh6cB11qgARVA7eCfubcvpuZVbKT0ABnkw/edit?usp=sharing

export const KEYS: KeysFile = JSON.parse(fs.readFileSync(KEYS_FILE_PATH).toString());

export function getUserDBAsync(next: (userDB: User[]) => void) {
    return fs.readFile(USER_DB_FILE_PATH, (err, data) => {
        if (err) {
            console.log(err)
            return;
        }
        let userDB: User[] = JSON.parse(data.toString());
        next(userDB)
    });
}

export function getUserDBSync(): User[] {
    return JSON.parse(fs.readFileSync(USER_DB_FILE_PATH).toString())
}

export function setUserDB(userDB: User[]): void {
    fs.writeFile(USER_DB_FILE_PATH, JSON.stringify(userDB), () => {});
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
        if (err) {
            console.log(err)
            return;
        }
        let chatLog: ChatLog[] = JSON.parse(data.toString());
        next(chatLog)
    });
}

function setChatLog(chatLog: ChatLog[]): void {
    fs.writeFile(CHAT_LOG_PATH, JSON.stringify(chatLog), () => {});
}

/** Logs chat message. */
export function logChatMessage(username: string, realName: string, message: string) {
    getChatLogAsync((chatLog) => {
        chatLog.push({username: username, realName: realName, message: message})
        setChatLog(chatLog)
    })
}

// TODO: Replace "any" with subscriber type

export function getSubscriberDB(): any {
    return JSON.parse(fs.readFileSync(SUBSCRIBERS_PATH).toString());
}

function setSubscriberDB(subscribers: any) {
    fs.writeFileSync(CHAT_LOG_PATH, JSON.stringify(SUBSCRIBERS_PATH));
}

export function addToSubscriberDB(subscriber: any) {
    let currentSubscriberDB: any = getSubscriberDB();
    currentSubscriberDB.push(subscriber);
    setSubscriberDB(currentSubscriberDB);
}