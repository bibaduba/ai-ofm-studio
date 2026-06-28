import { NextResponse } from "next/server"
import { clearSessionCookie, deleteCurrentSession } from "@/app/lib/auth"

export async function POST() {
  deleteCurrentSession()
  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
