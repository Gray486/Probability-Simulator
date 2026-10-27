import { createRoot } from "react-dom/client";
import { App } from "./App";
import { inLobby } from "./api";
import { subscribeToPush } from "./push";

createRoot(document.getElementById("root")!).render(<App />);

subscribeToPush().catch(console.error);

// Leaves the game when the page is closed
window.addEventListener("pagehide", () => navigator.sendBeacon(inLobby("/leave")));
