import { KeyboardEvent, useState } from "react";

/** Message input with a send button, sends on enter. */
function MessageBox({ onSend }: { onSend: (message: string) => void }) {
    const [text, setText] = useState("");

    function send() {
        if (!text) return;
        onSend(text);
        setText("");
    }

    return (
        <>
            <input className="msgText" type="text" maxLength={50} value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyUp={(e: KeyboardEvent) => { if (e.key == "Enter") send() }} />
            <button className="msg" onClick={send}>Send</button>
        </>
    );
}

export function ChatPanel({ lines, onSend }: { lines: string[]; onSend: (message: string) => void }) {
    return (
        <>
            <span className="chatText">{lines.join("\n")}</span>
            <MessageBox onSend={onSend} />
        </>
    );
}

export function DmPanel({ lines, onSend }: { lines: string[]; onSend: (message: string) => void }) {
    return (
        <>
            <span className="chatText dmText">{lines.join("\n")}</span>
            <MessageBox onSend={onSend} />
        </>
    );
}
