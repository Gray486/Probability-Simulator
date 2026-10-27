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

export function ChatPanel({ lines, highlight, onSend }: { lines: string[]; highlight: (line: string) => boolean; onSend: (message: string) => void }) {
    return (
        <>
            {/* Lines are wrapped in one div so the column-reverse layout keeps them in order */}
            <span className="chatText">
                <div>{lines.map((line, i) => <div key={i} className={highlight(line) ? "mention" : ""}>{line}</div>)}</div>
            </span>
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
