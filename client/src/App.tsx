import { ReactElement, useEffect, useRef, useState } from "react";
import { Move, Player, SendData } from "../../types";
import { post, useGameData } from "./api";
import { WheelController } from "./wheel";
import { ChatPanel, DmPanel } from "./panels/ChatPanels";
import { RankingsPanel } from "./panels/RankingsPanel";
import { FriendsPanel, RequestsPanel, unreadFrom } from "./panels/FriendsPanels";
import { SettingsPanel } from "./panels/SettingsPanel";
import { music } from "./music";

type PanelId = "chat" | "rankings" | "friends" | "settings" | "requests" | "dm";

const moveIcons: Record<Player["lastMove"], ReactElement | null> = {
    "": null,
    none: null,
    higher: <i className="bi bi-arrow-up-square-fill" style={{ color: "#d9d93d" }}></i>,
    lower: <i className="bi bi-arrow-down-square-fill" style={{ color: "#863dd9" }}></i>,
    bank: <i className="bi bi-bank2" style={{ color: "#4266c9" }}></i>,
    freeSpin: <i className="bi bi-ticket-detailed-fill" style={{ color: "#1bc640" }}></i>,
    stillOut: <i className="bi bi-x-square-fill" style={{ color: "red" }}></i>
};

/** Seconds a player has to make a move, as shown to them. */
const MOVE_TIME = 20;
/** Seconds shown on the countdown before a game auto starts. */
const START_TIME = 15;

/** A countdown shown in the timer box. */
function useCountdown() {
    const [value, setValue] = useState<number | null>(null);
    const interval = useRef<ReturnType<typeof setInterval>>(undefined);

    function stop() {
        clearInterval(interval.current);
        setValue(null);
    }

    function start(from: number) {
        clearInterval(interval.current);
        let remaining = from;
        setValue(remaining);
        interval.current = setInterval(() => {
            remaining--;
            if (remaining < 0) stop();
            else setValue(remaining);
        }, 1000);
    }

    useEffect(() => stop, []);
    return { value, start, stop };
}

/** The big banner across the screen. */
function useBanner() {
    const [banner, setBanner] = useState({ text: "", visible: false });
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    function show(text: string, ms: number) {
        clearTimeout(timeout.current);
        setBanner({ text, visible: true });
        timeout.current = setTimeout(() => setBanner((b) => ({ ...b, visible: false })), ms);
    }

    return { banner, show };
}

export function App() {
    const data = useGameData();
    if (!data) return null;
    return <Game data={data} />;
}

function Game({ data }: { data: SendData }) {
    /** Name chosen at game start, empty if not in the game. */
    const [myName, setMyName] = useState("");
    const [spectator, setSpectator] = useState(!data.game.canJoin);
    const [joinName, setJoinName] = useState("");
    const [canMove, setCanMove] = useState(false);
    const [usedFreeSpin, setUsedFreeSpin] = useState(false);
    /** The last spin whose animation has finished, until then busted players still show their guess. */
    const [settledSpin, setSettledSpin] = useState(data.game.spinNumber);
    const [pot, setPot] = useState(data.game.points);
    const [panel, setPanel] = useState<PanelId>("chat");
    const [dmFriend, setDmFriend] = useState("");
    const [musicOn, setMusicOn] = useState(true);

    const timer = useCountdown();
    const { banner, show: showBanner } = useBanner();

    const wheelDiv = useRef<HTMLDivElement>(null);
    const wheel = useRef<WheelController>(null);
    /** Always the newest data, for use after animations finish. */
    const latest = useRef(data);
    const prev = useRef<SendData | null>(null);
    /** The next spin number to animate. */
    const nextSpin = useRef(data.game.spinNumber + 1);
    /** Bumped every round, so spins from an old round don't act once they finish. */
    const roundId = useRef(0);

    /** The spin callback outlives renders, so it reads the name through a ref. */
    const myNameRef = useRef(myName);
    myNameRef.current = myName;

    const joined = myName != "";
    const mine: Player | undefined = data.players.find((p) => p.gameName == myName);
    latest.current = data;

    // Creates the wheel, showing the numbers left if the game is already going
    useEffect(() => {
        if (!wheelDiv.current) return;
        wheel.current = new WheelController(wheelDiv.current);
        wheel.current.reset(data.game.numbersLeft, data.game.thisSpin);
        return () => wheel.current?.remove();
    }, []);

    // Reacts to changes in the game
    useEffect(() => {
        const last = prev.current;
        prev.current = data;
        if (!last) return;
        const { game } = data;

        // Removed from the game (e.g. struck out, or the connection dropped in the lobby)
        if (joined && !data.players.some((p) => p.gameName == myName)) {
            setMyName("");
            setCanMove(false);
        }

        // Game started without us, so we watch. Game ended, so we can join again.
        if (last.game.canJoin && !game.canJoin && !joined) setSpectator(true);
        if (!last.game.canJoin && game.canJoin) setSpectator(false);

        // Countdown until the game auto starts
        const ready = data.players.filter((p) => p.ready).length;
        if (!game.started && ready > 0 && ready != last.players.filter((p) => p.ready).length) {
            timer.start(START_TIME);
        }
        if (game.started && !last.game.started) timer.stop();

        if (game.round != last.game.round) {
            roundId.current++;
            setUsedFreeSpin(false);
            setCanMove(false);
            timer.stop();
            wheel.current?.reset();
            setPot(game.points);

            if (game.round == 0) {
                nextSpin.current = 1;
                if (joined) {
                    setTimeout(() => showBanner(game.lastWinner ? `${game.lastWinner} has won the game!` : "Game Over!", 2250), 750);
                }
            } else if (game.started && joined) {
                showBanner("New Round Starting!", 3000);
            }
        }

        if (game.started && game.spinNumber == nextSpin.current) {
            nextSpin.current++;
            spin(game.thisSpin, game.spinNumber);
        }
    }, [data]);

    async function spin(number: number, spinNumber: number) {
        const round = roundId.current;
        timer.stop();
        setCanMove(false);
        setUsedFreeSpin(false);

        await wheel.current?.spin(number);
        if (round != roundId.current) return;

        const now = latest.current;
        const me = now.players.find((p) => p.gameName == myNameRef.current);
        setSettledSpin(spinNumber);
        setPot(now.game.points);

        if (me?.alive) {
            setCanMove(true);
        } else if (me && (me.lastMove == "higher" || me.lastMove == "lower")) {
            showBanner("You busted!!", 1500);
        }

        timer.start(MOVE_TIME);
    }

    // Marks DMs read while the DM panel is open
    useEffect(() => {
        if (panel != "dm" || !dmFriend) return;
        const channel = data.me.directMessageChannels.find((c) => c.initiatedBy == dmFriend || c.receiver == dmFriend);
        if (!channel) return;

        const unread: number[] = [];
        channel.messages.forEach((m, i) => {
            if (!m.read && m.from == dmFriend) unread.push(channel.messages.length - i);
        });
        if (unread.length > 0) post({ action: "readMessages", friend: dmFriend, messageReverseIndices: unread });
    }, [data, panel, dmFriend]);

    async function join() {
        const name = joinName || data.me.username.slice(0, 7);
        const res = await post({ action: "join", name });
        if (res == "OK") {
            setMyName(name);
            setCanMove(false);
        } else {
            alert("ERROR: " + res.msg);
        }
    }

    async function play(move: Move) {
        setCanMove(false);
        const res = await post({ action: "play", move, name: myName });
        if (res !== "OK") {
            alert(res);
            setCanMove(true);
        } else if (move == "freeSpin") {
            setUsedFreeSpin(true);
        }
    }

    function sendChat(message: string) {
        if (joined) post({ action: "chatInGame", name: myName, message });
        else post({ action: "chat", message });
    }

    function toggleMusic(on: boolean) {
        setMusicOn(on);
        music.volume = on ? 0.1 : 0;
    }

    const hasUnreadDms = data.me.friends.some((f) => unreadFrom(data.me, f) > 0);
    const showJoin = !joined && !spectator;
    const ready = data.players.filter((p) => p.ready).length;
    const dmLines = data.me.directMessageChannels
        .find((c) => c.initiatedBy == dmFriend || c.receiver == dmFriend)
        ?.messages.map((m) => `${m.from}: ${m.content}`) ?? [];

    const panels: Record<PanelId, ReactElement> = {
        chat: <ChatPanel lines={data.chat} onSend={sendChat} />,
        rankings: <RankingsPanel rankings={data.rankings} />,
        friends: <FriendsPanel me={data.me} onOpenDm={(f) => { setDmFriend(f); setPanel("dm") }} onViewRequests={() => setPanel("requests")} />,
        requests: <RequestsPanel me={data.me} />,
        dm: <DmPanel lines={dmLines} onSend={(message) => post({ action: "messageFriend", username: dmFriend, message })} />,
        settings: <SettingsPanel me={data.me} version={data.version} musicOn={musicOn} onMusicToggle={toggleMusic} />
    };

    return (
        <>
            <div id="home">
                {showJoin && (
                    <div id="joinDiv">
                        <div className="joinBox">
                            <label htmlFor="name">Game Name:</label>{" "}
                            <input type="text" maxLength={7} id="name" placeholder={data.me.username} value={joinName}
                                onChange={(e) => setJoinName(e.target.value)}
                                onKeyUp={(e) => { if (e.key == "Enter") join() }} />{" "}
                            <button onClick={join}>Join Game</button>
                        </div>
                    </div>
                )}
                {joined && !data.game.started && (
                    <div id="start">
                        <b>{ready} / {data.playerList.length} players have voted to start the match!</b>&nbsp;&nbsp;
                        <button disabled={mine?.ready} onClick={() => post({ action: "start", name: myName })}>Start!</button>
                    </div>
                )}
                <div id="panel">
                    <div id="rankingsSwitch" className="switch" onClick={() => setPanel("rankings")}><i className="bi bi-list-ol"></i></div>
                    <div id="chatSwitch" className="switch" onClick={() => setPanel("chat")}><i className="bi bi-chat-left-dots-fill"></i></div>
                    <div id="friendsSwitch" className="switch" onClick={() => setPanel("friends")}>
                        <i className="bi bi-person-fill" style={{ color: hasUnreadDms ? "red" : "black" }}></i>
                    </div>
                    <div id="settingsSwitch" className="switch" onClick={() => setPanel("settings")}><i className="bi bi-gear-fill"></i></div>
                    <div id={`${panel}Div`} className="panelDiv" key={panel}>{panels[panel]}</div>
                </div>
            </div>
            <div id="players">
                {[...data.players].sort((a, b) => b.score - a.score).map((p) => {
                    const busted = !p.alive && p.lastMove != "bank" && settledSpin >= data.game.spinNumber;
                    return (
                        <div className="player" key={p.gameName}>
                            {p.freeSpin && <i className="bi bi-ticket-detailed-fill ticket-indicator"></i>}
                            <h2 title={p.username}>{p.gameName}</h2>
                            <span className="points">{p.score}</span>
                            <span className="play">{busted ? moveIcons.stillOut : moveIcons[p.lastMove]}</span>
                            <span style={{ color: "#0e1131" }}>.</span>
                        </div>
                    );
                })}
            </div>
            <div id="game">
                {joined && (
                    <div id="controls">
                        <button disabled={!canMove} onClick={() => play("bank")} style={{ backgroundColor: "#4266c9" }}>Bank <i className="bi bi-bank"></i></button>
                        <button disabled={!canMove} onClick={() => play("higher")} style={{ backgroundColor: "#d9d93d" }}>Higher <i className="bi bi-arrow-up-square-fill"></i></button>
                        <button disabled={!canMove} onClick={() => play("lower")} style={{ backgroundColor: "#863dd9" }}>Lower <i className="bi bi-arrow-down-square-fill"></i></button>
                        {mine?.freeSpin && !usedFreeSpin && (
                            <button disabled={!canMove} onClick={() => play("freeSpin")} style={{ backgroundColor: "#1bc640" }}>Free Spin <i className="bi bi-ticket-detailed"></i></button>
                        )}
                    </div>
                )}
                {spectator && <div id="spectator">You are currently in spectator mode. Please wait until the game is over to join.</div>}
                <div id="pot">{pot}</div>
                {timer.value != null && <div id="timer">{timer.value}</div>}
                <div id="wheel" ref={wheelDiv} style={{ visibility: showJoin ? "hidden" : "visible" }}></div>
                <div id="newRound" className={banner.visible ? "visible" : ""}>{banner.text}</div>
            </div>
            {location.host !== "prob.grayjn.com" && (
                <span id="dev">This is a dev server. Features are not finalized. Data may NOT save.</span>
            )}
        </>
    );
}
