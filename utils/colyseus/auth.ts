import jwt from "jsonwebtoken";

const SECRET_JWT_KEY = process.env.SECRET_JWT_KEY;

export function verify(token: string): { uid: string; privyId: string } | null {
  try {
    const decodedToken = jwt.verify(token, SECRET_JWT_KEY!) as any;
    return decodedToken;
  } catch (e) {
    console.error("verify token error", e);
    return null;
  }
}
