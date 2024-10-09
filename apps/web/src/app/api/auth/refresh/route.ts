import { UserDetails } from "@repo/types";
import { sign, verify } from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "";
const NODE_ENV = process.env.NODE_ENV === "production";

interface userJWT {
  userId: string;
  name: string;
  isGuest?: boolean;
}

export async function GET(req: NextRequest) {
  const guestCookie = cookies().get("guest")?.value;

  try {
    if (guestCookie) {
      const decoded = verify(guestCookie, JWT_SECRET) as userJWT;
      const token = sign(
        { userId: decoded.userId, name: decoded.name, isGuest: true },
        JWT_SECRET
      );

      let User: UserDetails = {
        id: decoded.userId,
        name: decoded.name,
        token: token,
        isGuest: true,
      };

      cookies().set("guest", token, {
        httpOnly: true,
        sameSite: NODE_ENV ? "none" : "strict",
        secure: NODE_ENV,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      });

      return NextResponse.json({ success: true, user: User });
    }

    cookies().delete("guest");
    return NextResponse.json({ success: false });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ success: false });
  }
}
