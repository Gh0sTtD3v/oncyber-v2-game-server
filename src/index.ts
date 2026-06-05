import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import https from "https";
import fs from "fs";
import express from "express";
import config from "./app.config";
import fetch from 'node-fetch';

globalThis.fetch = fetch;

const app = express();

app.use(express.json());

// Initialize express routes
config.initializeExpress(app);

const httpsServer = https.createServer({
    key: fs.readFileSync('/var/ssl/www.naturalmystic.shop.key'),
    cert: fs.readFileSync('/var/ssl/naturalmystic.shop.crt')
}, app);

const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpsServer })
});

// Initialize game server (define rooms)
config.initializeGameServer(gameServer);

config.beforeListen();

const port = Number(process.env.PORT) || 443;
httpsServer.listen(port, () => {
    console.log(`⚔️  Listening on https://localhost:${port}`);
});


// /**
//  * IMPORTANT:
//  * ---------
//  * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
//  *
//  * If you're self-hosting (without Colyseus Cloud), you can manually
//  * instantiate a Colyseus Server as documented here:
//  *
//  * See: https://docs.colyseus.io/server/api/#constructor-options
//  */
// import { listen } from "@colyseus/tools";
// import fetch from 'node-fetch';
// import fs from 'fs';

// // Import Colyseus config
// import app from "./app.config";

// /**
//  * IMPORTANT:
//  * ---------
//  * Somebody is overriding the global fetch function.
//  * Causing the calls from ai sdk to fail.
//  */
// globalThis.$$ofetch = fetch;

// // Create and listen on 2567 (or PORT environment variable.)
// listen(app);

