import * as fs from "fs";
import { ChatLogFile, KeysFile, User } from "./types";

const USER_DB_FILE_PATH: string = __dirname + "/../storage/accounts.json";
const KEYS_FILE_PATH: string = __dirname + "/../storage/keys.json"
const CHAT_LOG_PATH: string = __dirname + "/../storage/chatlog.json"
const SUBSCRIBERS_PATH: string = __dirname + "/../storage/subscribers.json"

// Note to gray:
// Link to keys file: https://docs.google.com/document/d/1cb7GLQKhSMh6cB11qgARVA7eCfubcvpuZVbKT0ABnkw/edit?usp=sharing

export const KEYS: KeysFile = JSON.parse(fs.readFileSync(KEYS_FILE_PATH).toString());

export function getUserDB(): User[] {
    return JSON.parse(fs.readFileSync(USER_DB_FILE_PATH).toString());
}

export function setUserDB(userDB: User[]): void {
    fs.writeFileSync(USER_DB_FILE_PATH, JSON.stringify(userDB));
}

/** Adds user to userDB. */
export function addUser(user: User): void {
    let currentDB: User[] = getUserDB();
    currentDB.push(user);
    setUserDB(currentDB);
}

function getChatLog(): ChatLogFile[] {
    return JSON.parse(fs.readFileSync(CHAT_LOG_PATH).toString());
}

function setChatLog(chatLog: ChatLogFile[]): void {
    fs.writeFileSync(CHAT_LOG_PATH, JSON.stringify(chatLog));
}

/** Logs chat message. */
export function logChatMessage(username: string, realName: string, message: string) {
    let chatLog: ChatLogFile[] = getChatLog()
    chatLog.push({username: username, realName: realName, message: message})
    setChatLog(chatLog)
}

// TODO: Replace any with new type

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