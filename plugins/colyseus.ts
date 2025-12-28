import { FastifyPluginAsync } from "fastify";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ColyseusGameRoom } from "../lib/colyseus/rooms/ColyseusGameRoom";

const colyseusPlugin: FastifyPluginAsync = async (fastify) => {
  const gameServer = new Server({
    transport: new WebSocketTransport({
      server: fastify.server,
    }),
  });

  gameServer.define("cyber-game", ColyseusGameRoom);

  fastify.decorate("colyseus", gameServer);

  console.log("Colyseus game server initialized");
};

declare module "fastify" {
  interface FastifyInstance {
    colyseus: Server;
  }
}

export default colyseusPlugin;
