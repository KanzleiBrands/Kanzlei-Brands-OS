"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession, assertPipelineAccess } from "@/lib/access";
import { encryptToken, decryptToken } from "@/lib/auth-encryption";
import { readPendingConnection, clearPendingConnection } from "@/lib/meta/pending-connection";
import {
  listMetaPages,
  listMetaLeadForms,
  subscribePageToLeadgenWebhook,
  unsubscribePageFromLeadgenWebhook,
  type MetaPage,
} from "@/lib/meta/graph";

/** Re-derives a specific Page's access token from the pending user token cookie, rather than trusting a client-supplied token. */
async function resolvePendingPage(pipelineId: string, pageId: string): Promise<MetaPage> {
  const pending = await readPendingConnection();
  if (!pending || pending.pipelineId !== pipelineId) {
    throw new Error("Verbindung abgelaufen. Bitte erneut mit Facebook verbinden.");
  }
  const pages = await listMetaPages(pending.userAccessToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new Error("Seite nicht gefunden oder keine Berechtigung mehr dafür.");
  return page;
}

export async function listMetaLeadFormsForPage(
  pipelineId: string,
  pageId: string,
): Promise<{ id: string; name: string }[]> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
  await assertPipelineAccess(session, pipelineId);

  const page = await resolvePendingPage(pipelineId, pageId);
  const forms = await listMetaLeadForms(page.id, page.access_token);
  return forms.map((f) => ({ id: f.id, name: f.name }));
}

export async function finalizeMetaConnection(
  pipelineId: string,
  pageId: string,
  formId: string,
  formName: string,
): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");
  await assertPipelineAccess(session, pipelineId);

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } });
  if (!pipeline) throw new Error("Kampagne nicht gefunden.");

  const existing = await prisma.metaLeadFormConnection.findFirst({ where: { pipelineId, formId } });
  if (existing) throw new Error("Dieses Formular ist bereits mit dieser Kampagne verbunden.");

  const page = await resolvePendingPage(pipelineId, pageId);
  await subscribePageToLeadgenWebhook(page.id, page.access_token);

  await prisma.metaLeadFormConnection.create({
    data: {
      pageId: page.id,
      pageName: page.name,
      pageAccessTokenEnc: encryptToken(page.access_token),
      formId,
      formName,
      organizationId: pipeline.organizationId,
      pipelineId,
      connectedByUserId: session.user.id,
    },
  });

  await clearPendingConnection();
  revalidatePath(`/dashboard/pipelines/${pipelineId}`);
}

export async function disconnectMetaLeadForm(connectionId: string): Promise<void> {
  const session = await requireSession();
  if (session.user.role !== "AGENCY_ADMIN") throw new Error("Keine Berechtigung.");

  const connection = await prisma.metaLeadFormConnection.findUnique({ where: { id: connectionId } });
  if (!connection) return;
  await assertPipelineAccess(session, connection.pipelineId);

  try {
    await unsubscribePageFromLeadgenWebhook(connection.pageId, decryptToken(connection.pageAccessTokenEnc));
  } catch (error) {
    // Best-effort: the token may already be invalid, in which case Meta
    // has nothing left to unsubscribe from anyway - never block the local
    // disconnect on this.
    console.error("Failed to unsubscribe Meta page from leadgen webhook (continuing with local delete):", error);
  }

  await prisma.metaLeadFormConnection.delete({ where: { id: connectionId } });
  revalidatePath(`/dashboard/pipelines/${connection.pipelineId}`);
}
