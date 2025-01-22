import { setRankings } from "./modules/game";
import { openWebServer } from "./modules/router";

// Default port to run the server on
let port: number = 8000;

// Version number that shows up on settings page
export const version = "2.1"

// You can specify port on project run
// EX: node index.js port 9999
if (process.argv.indexOf("port") > -1) {
    port = parseInt(process.argv[process.argv.indexOf("port") + 1])
}

openWebServer(port)

// Set rankings on server startup
setRankings()
