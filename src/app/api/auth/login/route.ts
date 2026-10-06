import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, setSessionCookie } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Input tidak valid" },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;
    const authResult = await authenticateUser(username, password);

    if (!authResult.success || !authResult.token || !authResult.session) {
      return NextResponse.json(
        { error: authResult.error || "Login gagal" },
        { status: 401 }
      );
    }

    await setSessionCookie(authResult.token);

    return NextResponse.json({
      success: true,
      message: "Login berhasil",
      user: authResult.session,
    });
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server" },
      { status: 500 }
    );
  }
}
