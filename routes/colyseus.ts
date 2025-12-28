import { FastifyPluginAsync } from "fastify";
import { matchMaker } from "colyseus";
import { Mutex } from "async-mutex";
import { ROOM_TYPE } from "../utils/colyseus/constants";
import { verify } from "../utils/colyseus/auth";
import { GameApi } from "../lib/colyseus/cyber/abstract/GameApi";

const mutex = new Mutex();
const IS_SINGLETON = process.env.SINGLE_ROOM === "true";

interface JoinBody {
  roomId?: string;
  gameId: string;
  userId: string;
  username?: string;
  draft?: boolean;
}

interface CreateBody {
  roomId: string;
  gameId: string;
  draft?: boolean;
}

const colyseusRoutes: FastifyPluginAsync = async (fastify) => {

  fastify.get("/getRoom", async (request, reply) => {
    try {
      const { roomId } = request.query as any;
      const data = await matchMaker.query({ roomId });
      return { success: true, room: data[0] };
    } catch (err) {
      return { success: false };
    }
  });

  fastify.get("/getRooms", async (request, reply) => {
    try {
      const data = await matchMaker.query();
      data.sort((a, b) => b.clients - a.clients);
      return { success: true, rooms: data };
    } catch (err) {
      return { success: false };
    }
  });

  fastify.post<{ Body: JoinBody }>("/join", async (request, reply) => {
    try {
      const { gameId, userId: requestUserId } = request.body;

      if (!gameId || !requestUserId) {
        return reply.status(400).send({
          success: false,
          message: "Invalid request",
        });
      }

      let { roomId: croomId, userId, username, draft = true } = request.body;
      croomId ??= gameId;

      const token = request.headers["x-auth-token"] as string;

      if (userId !== "anon" && token) {
        const decodedToken = verify(token);
        const uid = decodedToken?.uid;

        if (uid?.toLowerCase() !== userId?.toLowerCase()) {
          console.log("uid mismatch", uid, userId);
          userId = "anon";
        }
      }

      return await mutex.runExclusive(async () => {
        try {
          let rooms = await matchMaker.query({ name: ROOM_TYPE });

          if (!IS_SINGLETON) {
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

          let reservation: matchMaker.SeatReservation | null = null;

          if (rooms.length > 0) {
            const room = rooms[0];

            if (IS_SINGLETON && room.metadata.croomId !== croomId) {
              return reply.status(400).send({
                success: false,
                message: "Room is already in use",
              });
            }

            console.log("/join existing", room.roomId);
            reservation = await matchMaker.joinById(room.roomId, request.body, {});
          } else {
            const gameData = await GameApi.loadGameData({
              id: gameId,
              draft: draft ?? true,
            });

            const roomOpts = {
              croomId,
              gameId,
              userId,
              username,
              roomType: ROOM_TYPE,
              gameData,
            };

            console.log("/join new", roomOpts.gameId, "/", roomOpts.croomId);
            reservation = await matchMaker.create(ROOM_TYPE, roomOpts, {});
          }

          return { success: true, reservation };
        } catch (err: any) {
          console.log("errr", err, ROOM_TYPE, request.body);
          return reply.status(500).send({
            success: false,
            message: err?.message ?? err ?? "Unexpected Server Error",
          });
        }
      });
    } catch (err: any) {
      console.log("err", err);
      return reply.status(500).send({
        success: false,
        message: err?.message ?? err ?? "Unexpected Server Error",
      });
    }
  });

  fastify.post<{ Body: CreateBody }>("/create", async (request, reply) => {
    console.log("/create", request.body);

    try {
      const { gameId, roomId } = request.body;

      if (!gameId || !roomId) {
        return reply.status(400).send({
          success: false,
          message: "Invalid request",
        });
      }

      let { roomId: croomId, draft = true } = request.body;
      croomId ??= gameId;

      let rooms = await matchMaker.query({ name: ROOM_TYPE });

      if (IS_SINGLETON && rooms.length > 0) {
        return reply.status(403).send({
          success: false,
          message: "Singleton room already exists",
        });
      }

      if (rooms.some((room) => room.metadata.croomId === croomId)) {
        return reply.status(400).send({
          success: false,
          message: "Room already exists",
        });
      }

      const gameData = await GameApi.loadGameData({
        id: gameId,
        draft: draft ?? true,
      });

      const roomOpts = {
        croomId,
        gameId,
        roomType: ROOM_TYPE,
        gameData,
      };

      await matchMaker.createRoom(ROOM_TYPE, roomOpts);

      return {
        success: true,
        machineId: process.env.FLY_MACHINE_ID,
      };
    } catch (err: any) {
      console.log("err", err);
      return reply.status(500).send({
        success: false,
        message: err?.message ?? err ?? "Unexpected Server Error",
      });
    }
  });
};

export default colyseusRoutes;
