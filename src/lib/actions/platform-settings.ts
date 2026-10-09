import { prisma } from "@/lib/prisma";

/**
 * Agentur-weite Einstellungen (siehe PlatformSettings-Modell) - eine einzige
 * Zeile, id fest "singleton". Zentral an einer Stelle angelegt (nicht separat
 * in fireflies.ts UND close-calls.ts), damit der Erstanlage-Zustand für alle
 * Automations-Schalter an einer Stelle steht, unabhängig davon, welcher Sync
 * zuerst läuft und die Zeile anlegt.
 */
export async function getPlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {},
    // Beide Live-Schaltungen (Fireflies- und Close-Call-Sync) wurden vor dem
    // jeweiligen Bau explizit mit dem Nutzer abgestimmt (siehe CLAUDE.md-
    // Automationsregel) - deshalb hier bewusst abweichend vom sonst üblichen
    // AUS-Default bereits bei Erstanlage an. dataForSeoEnabled bleibt dagegen
    // bewusst auf dem Schema-Default (aus) - siehe seo-dataforseo.ts.
    create: {
      id: "singleton",
      firefliesSyncEnabled: true,
      closeCallsSyncEnabled: true,
      dataForSeoTargetDomain: "kanzlei-brands.de",
      geoTargetBrandName: "Kanzlei Brands",
    },
  });
}
