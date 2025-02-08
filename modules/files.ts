import * as fs from "fs";
import { ChatLog, KeysFile, DirectMessageChannel } from "../types";

const KEYS_FILE_PATH: string = __dirname + "/../storage/keys.json"
const CHAT_LOG_PATH: string = __dirname + "/../storage/chatlog.json"

export let directMessageChannels: DirectMessageChannel[] = [];

// Link to keys file (only for gray): https://docs.google.com/document/d/1cb7GLQKhSMh6cB11qgARVA7eCfubcvpuZVbKT0ABnkw/edit?usp=sharing

export const KEYS: KeysFile = JSON.parse(fs.readFileSync(KEYS_FILE_PATH).toString());

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