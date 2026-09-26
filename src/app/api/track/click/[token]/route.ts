import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: trackingToken } = await params;
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  try {
    const send = await prisma.funnelStepSend.findUnique({ where: { trackingToken }, select: { clickedAt: true } });
    if (send) {
      await prisma.funnelStepSend.update({
        where: { trackingToken },
        data: { clickCount: { increment: 1 }, clickedAt: send.clickedAt ?? new Date() },
      });
    } else {
      const marketingSend = await prisma.marketingFunnelSend.findUnique({ where: { trackingToken }, select: { clickedAt: true } });
      if (marketingSend) {
        await prisma.marketingFunnelSend.update({
          where: { trackingToken },
          data: { clickCount: { increment: 1 }, clickedAt: marketingSend.clickedAt ?? new Date() },
        });
      }
    }
  } catch (error) {
    console.error("[track/click] failed to record click", error);
  }

  return NextResponse.redirect(target, { status: 307 });
}
