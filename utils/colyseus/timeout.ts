export const isSingletonRoom = process.env.SINGLE_ROOM === "true";

const IDLE_TIMEOUT = (+process.env.ROOM_IDLE_TIMEOUT_SEC || 30 * 60) * 1000;

let idleTimeout: NodeJS.Timeout;

export function startIdleTimeout() {
  if (!isSingletonRoom) return;

  console.log(
    "Singleton room. Process will exit in",
    IDLE_TIMEOUT / 1000,
    "seconds"
  );

  idleTimeout = setTimeout(() => {
    process.exit(0);
  }, IDLE_TIMEOUT);
}

export function clearIdleTimeout() {
  if (!isSingletonRoom) return;
  console.log("Clearing idle timeout");
  clearTimeout(idleTimeout);
}
