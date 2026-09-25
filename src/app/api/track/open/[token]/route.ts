import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent PNG, served regardless of whether the token matches so a
// blocked-image client or a dead link never surfaces an error to the reader.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const trackingToken = rawToken.replace(/\.png$/i, "");

  try {
    const send = await prisma.funnelStepSend.findUnique({ where: { trackingToken }, select: { openedAt: true } });
    if (send) {
      await prisma.funnelStepSend.update({
        where: { trackingToken },
        data: { openCount: { increment: 1 }, openedAt: send.openedAt ?? new Date() },
      });
    }
  } catch (error) {
    console.error("[track/open] failed to record open", error);
  }

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
