import { Response, Request } from "express";
import * as colyseus from "colyseus";
import { matchMaker } from "colyseus";
import cors from "cors";
import { playground } from "@colyseus/playground";
import { monitor } from "@colyseus/monitor";
import basicAuth from "express-basic-auth";
import { Mutex } from "async-mutex";
import { GameApi } from "../cyber/abstract/GameApi";
import { clearIdleTimeout } from "../timeout";
import { verify } from "./authMiddleware";
import { existsSync, readdirSync, statSync, writeFileSync } from "fs";
import { resolve, join } from "path";

const mutex = new Mutex();

const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
};

const isSingleton = process.env.SINGLE_ROOM === "true";

const ROOM_TYPE = "cyber-game";

export interface Asset {
	name: string;
	position: { x: number; y: number; z: number };
	[key: string]: any;
}

export function initializeExpress(app: any) {
  //

  app.use(cors(corsOptions));

  app.options("*", cors(corsOptions));

  if (process.env.NODE_ENV !== "production") {
    app.use("/", playground);
  }

  app.get("/", (req: Request, res: Response) => {
    res.send("Hello world from cyber!!");
  });

  // Ensure all responses include CORS headers
  app.use((req: Request, res: Response, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
  });

  app.get("/getRoom", async (req: Request, res: Response) => {
    try {
      const data = await colyseus.matchMaker.query({
        roomId: req.query.roomId as string,
      });

      res.json({ success: true, room: data[0] });
    } catch (err) {
      res.json({
        success: false,
      });
    }
  });

  app.get("/getRooms", async (req: Request, res: Response) => {
    try {
      const data = await colyseus.matchMaker.query();

      data.sort((a, b) => {
        return b.clients - a.clients;
      });

      res.json({ success: true, rooms: data });
    } catch (err) {
      res.json({
        success: false,
      });
    }
  });

  app.post("/join", async (req: Request, res: Response) => {
    //
    clearIdleTimeout();

    try {
      if (!req.body?.gameId || !req.body?.userId) {
        //
        return res.status(400).json({
          success: false,
          message: "Invalid request",
        });
      }

      let {
        roomId: croomId,
        gameId,
        userId,
        username,
        draft = true,
      } = req.body;

      croomId ??= gameId;

      if (false) {
        // token is in X-Auth-Token header
        const token = req.headers["x-auth-token"] as string;

        if (userId !== "anon") {
          //
          if (!token) {
            userId = "anon";
          } else {
            // verify token from cookie
            const decodedToken = verify(token);
            const uid = decodedToken?.uid;

            if (uid?.toLowerCase() !== userId?.toLowerCase()) {
              console.log("uid mismatch", uid, userId);
              userId = "anon";
            }
          }
        }
      }

      await mutex.runExclusive(async () => {
        //
        try {
          let rooms = await matchMaker.query({
            name: ROOM_TYPE,
          });

          if (!isSingleton) {
            rooms = rooms
              .filter(
                (room) =>
                  !room.private &&
                  !room.locked &&
                  room.metadata.croomId === croomId &&
                  room.clients < room.maxClients
              )
              .sort((a, b) => b.clients - a.clients);
          }

          let reservation: matchMaker.SeatReservation = null;

          if (rooms.length > 0) {
            //
            const room = rooms[0];

            if (isSingleton && room.metadata.croomId !== croomId) {
              return res.status(400).json({
                success: false,
                message: "Room is already in use",
              });
            }

            console.log("/join existing", room.roomId);

            reservation = await matchMaker.joinById(room.roomId, req.body, {});
            //
          } else {
            const roomOpts = {
              croomId,
              gameId,
              userId,
              username,
              roomType: ROOM_TYPE,
              gameData: null,
            };

            console.log("/join new", roomOpts.gameId, "/", roomOpts.croomId);

            const gameData = await GameApi.loadGameData({
              id: gameId,
              draft: draft ?? true,
            });

            roomOpts.gameData = gameData;

            reservation = await matchMaker.create(ROOM_TYPE, roomOpts, {});
          }

          res.json({
            success: true,
            reservation,
          });
        } catch (err) {
          //
          console.log("errr", err, ROOM_TYPE, req.body);

          res.status(500).json({
            success: false,
            message: err?.message ?? err ?? "Unexpected Server Error",
          });
        }
      });
    } catch (err) {
      console.log("err", err);
      res.status(500).json({
        success: false,
        message: err?.message ?? err ?? "Unexpected Server Error",
      });
    }
  });

  app.post("/create", async (req: Request, res: Response) => {
    //
    console.log("/create", req.body);

    clearIdleTimeout();

    try {
      if (!req.body?.gameId || !req.body?.roomId) {
        //
        return res.status(400).json({
          success: false,
          message: "Invalid request",
        });
      }

      let { roomId: croomId, gameId, draft = true } = req.body;

      croomId ??= gameId;

      let rooms = await matchMaker.query({
        name: ROOM_TYPE,
      });

      if (isSingleton && rooms.length > 0) {
        return res.status(403).json({
          success: false,
          message: "Singleton room already exists",
        });
      }

      if (rooms.some((room) => room.metadata.croomId === croomId)) {
        return res.status(400).json({
          success: false,
          message: "Room already exists",
        });
      }

      const roomOpts = {
        croomId,
        gameId,
        roomType: ROOM_TYPE as string,
        gameData: null,
      };

      const gameData = await GameApi.loadGameData({
        id: gameId,
        draft: draft ?? true,
      });

      roomOpts.gameData = gameData;

      await matchMaker.createRoom(ROOM_TYPE, roomOpts);

      res.json({
        success: true,
        machineId: process.env.FLY_MACHINE_ID,
      });
    } catch (err) {
      console.log("err", err);
      res.status(500).json({
        success: false,
        message: err?.message ?? err ?? "Unexpected Server Error",
      });
    }
  });

  app.post("/initialize/:roomId", (req: Request, res: Response) => {
    const { roomId } = req.params;
    const assets: Asset[] = req.body;

    console.log(`Initializing world for room ${roomId} with assets:`, assets);

    if (!Array.isArray(assets)) {
      res.status(400).json({ error: "Body must be an array of assets" });
      return;
    }

    
    // folder: __dirname/store
    const folderPath = resolve(__dirname, "../../store");
    if (!existsSync(folderPath)) {
      console.log("Creating store folder at", folderPath);
      return res.status(500).json({ error: "Store folder does not exist" });
    }

    writeFileSync(`${folderPath}/${roomId}.json`, JSON.stringify(assets, null, 2));
    console.log(`World stored for room ${roomId} with ${assets.length} assets`);
    res.json({ ok: true, count: assets.length });
  });

  const basicAuthMiddleware = basicAuth({
    users: {
      admin: process.env.MONITOR_PASSWORD,
    },
    challenge: true,
  });

  app.use(
    "/monitor",
    // basicAuthMiddleware,
    monitor({
      columns: [
        "roomId",
        "name",
        "clients",
        "maxClients",
        { metadata: "gameId" },
        { metadata: "name" },
        "locked",
        "elapsedTime",
      ],
    })
  );
}
