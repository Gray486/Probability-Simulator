import * as fs from "fs";
import { ChatLogFile, KeysFile, User } from "./types";

const USER_DB_FILE_PATH: string = __dirname + "/storage/accounts.json";
const KEYS_FILE_PATH: string = __dirname + "/storage/keys.json"
const CHAT_LOG_PATH: string = __dirname + "/storage/chatlog.json"

export const KEYS: KeysFile = JSON.parse(fs.readFileSync(KEYS_FILE_PATH).toString());

export function getUserDB(): User[] {
    return JSON.parse(fs.readFileSync(USER_DB_FILE_PATH).toString());
}

function setUserDB(userDB: User[]): void {
    fs.writeFileSync(USER_DB_FILE_PATH, JSON.stringify(userDB));
}

export function addUser(user: User): void {
    let currentDB: User[] = getUserDB();
    currentDB.push();
    setUserDB(currentDB);
}

function getChatLog(): ChatLogFile[] {
    return JSON.parse(fs.readFileSync(CHAT_LOG_PATH).toString());
}

function setChatLog(chatLog: ChatLogFile[]): void {
    fs.writeFileSync(CHAT_LOG_PATH, JSON.stringify(chatLog));
}

export function logChatMessage(username: string, realName: string, message: string) {
    let chatLog: ChatLogFile[] = getChatLog()
    chatLog.push({username: username, realName: realName, message: message})
    setChatLog(chatLog)
}