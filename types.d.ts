export type DirectMessageChannel = {
        /** The username of the person that initiated the DM channel. */
        initiatedBy: string;
        /** The username of the user the DM channel is with. */
        receiver: string;
        /** The list of messages in the DM channel. */
        messages: Message[];
}

export type Message = {
        from: string;
        content: string;
        timestamp: number;
        read: boolean;
}

export type KeysFile = {
        G_CLIENT_ID: string;
        VAPID: {
                SUBJECT: string;
                PUBLIC_KEY: string;
                PRIVATE_KEY: string;
        };
        JWT_SECRET: string;
}

export type ChatLog = {
        username: string;
        realName: string;
        message: string;
}

export type UserLoginRes = {
        success: true;
        status: 200;
        token: string;
} | {
        success: false;
        status: number;
        message: string;
}

/** Player only used for single game. */
export type Player = {
        /** Name chosen at game start. */
        gameName: string;
        /** Name on google account. */
        realName: string;
        /** Username based on realName. */
        username: string;
        score: number;
        ready: boolean;
        freeSpin: boolean;
        alive: boolean;
        move: Move;
        lastMove: LastMove;
        /** Number of times a player has not made a move in the given time. */
        strikes: number;
        /** Number of times the player busted this game. */
        busts: number;
}

export type Move = "freeSpin" | "higher" | "lower" | "none" | "bank";
type LastMove = Move | "stillOut" | "";

export type PlayerKeys = {
        [key: string]: string;
}

export type Game = {
        numbersLeft: number[];
        thisSpin: number;
        lastSpin: number;
        started: boolean;
        spinNumber: number;
        /** Points accumulated this round. */
        points: number;
        result: "higher" | "lower" | "none";
        round: number;
        /** Wether or not players can join the game right now. */
        canJoin: boolean;
        /** Winner of last game. */
        lastWinner: string;
        /** Goes up by one every time a game ends. */
        gameNumber: number;
        /** Final standings of the last game, best first. */
        lastResults: GameResult[];
        /** Number of rounds the last game lasted. */
        lastRounds: number;
        /** Score a player needs to reach to win. */
        pointsToWin: number;
};

/** How a player did in a finished game. */
export type GameResult = {
        gameName: string;
        username: string;
        /** Score at the end of the game. */
        score: number;
        /** Points added to (or taken from) their account. */
        points: number;
        busts: number;
};

/** A user's lifetime statistics. */
export type UserStats = {
        score: number;
        wins: number;
        gamesPlayed: number;
        /** Highest score reached in a single game. */
        bestGame: number;
        busts: number;
};

/** Data about the game. */
export type GameData = {
        playerList: string[];
        players: Player[];
        game: Game;
};

/** A private lobby. Private games are unranked. */
export type LobbyInfo = {
        /** Code used to join, also in the lobby's link (`/game?lobby=CODE`). */
        code: string;
        /** Username of the user that can change the lobby's settings. */
        host: string;
};

/** Data that is sent to clients about the game plus extra information. */
export type SendData = GameData & {
        rankings: Ranking[];
        /** The private lobby the user is in, `null` for the public game. */
        lobby: LobbyInfo | null;
        /** In game chat */
        chat: string[];
        /** Whether game specific data is being live updated. (false when guessing is occuring) */
        live: boolean;
        /** Version */
        version: string;
        /** Information about the user. */
        me: {
                name: string;
                username: string
                friendRequests: string[];
                friends: string[];
                blockedUsers: string[];
                directMessageChannels: DirectMessageChannel[];
                silent: boolean;
                acceptingFriendRequests: boolean;
                stats: UserStats;
        };
}

export type Ranking = {
        name: string;
        score: number;
        wins: number;
}

/** Return value for joinGame function. */
export type JoinGameRes = {
        status: "error";
        msg: string;
} | {
        status: "success";
        key: string;
}

/** The object that is sent in a post request. */
export type PostObject = {
        action: "join";
        name: string;
} | {
        action: "chat";
        message: string;
} | {
        action: "handleFriend";
        /** The friend to handle. */
        username: string;
        accept: boolean;
} | {
        action: "silentToggle";
        mode: boolean;
} | {
        action: "acceptRequestsToggle";
        mode: boolean;
} | {
        action: "unblock";
        /** The friend to unblock. */
        username: string;
} | {
        action: "addFriend";
        /** The friend to add. */
        username: string;
} | {
        action: "messageFriend";
        username: string;
        message: string;
} | {
        action: "readMessages";
        /** The friend of the messages that are being read. */
        friend: string;
        /** Total number of messages minus the indices of the messages. */
        messageReverseIndices: number[];
} | {
        action: "createLobby";
} | {
        action: "lobbySettings";
        pointsToWin: number;
} | {
        action: "inviteFriend";
        username: string;
} | {
        action: "start";
        name: string;
} | {
        action: "play";
        name: string;
        move: Move;
} | {
        action: "chatInGame";
        name: string;
        message: string;
}