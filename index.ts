import { setRankings } from "./modules/game";
import { openWebServer } from "./modules/routing";

let port: number = 8000;

// You can specify port on project run
// EX: node index.js port 9999
if (process.argv.indexOf("port") > -1) {
    port = parseInt(process.argv[process.argv.indexOf("port") + 1])
}

openWebServer(port)

// Set rankings on server startup
setRankings()

// FIXME: Not auto banking
// FIXME: Players always dead