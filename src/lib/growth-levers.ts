// Kunden-Hub "Potenzialscore": ein Kunde soll nie rätseln müssen, was er
// noch tun könnte, um mehr aus einer bereits gebuchten Kampagne
// herauszuholen. Jeder Hebel prüft, ob der Kunde einen bestimmten Kanal
// aktiv nutzt (Organization.activeApplicantChannels/activeLeadChannels)
// oder ein bestimmtes Produkt gebucht hat (Organization.bookedProductTags).
// Nicht erfüllte Hebel senken den Score und werden als konkrete
// Handlungsempfehlung angezeigt - bewusst simpel und gleichgewichtet
// gehalten, statt eine komplexe, schwer nachvollziehbare Gewichtung zu
// erfinden.

export type GrowthLever = {
  id: string;
  label: string;
  /** "channel" prüft gegen activeChannels, "product" gegen bookedProductTags. */
  kind: "channel" | "product";
  tag: string;
  suggestion: string;
};

export const APPLICANT_GROWTH_LEVERS: GrowthLever[] = [
  {
    id: "social_media",
    label: "Social Media für Stellenanzeigen",
    kind: "channel",
    tag: "social_media",
    suggestion: "Nutze deine offenen Stellen auch auf Social Media, um mehr passende Kandidaten zu erreichen.",
  },
  {
    id: "stellenportale",
    label: "Stellenportale",
    kind: "channel",
    tag: "stellenportale",
    suggestion: "Schalte deine Stellen zusätzlich auf Stellenportalen, um deine Reichweite zu vergrößern.",
  },
  {
    id: "karriereseite",
    label: "Karriereseite",
    kind: "channel",
    tag: "karriereseite",
    suggestion: "Eine überzeugende Karriereseite erhöht die Bewerbungsquote spürbar.",
  },
  {
    id: "social_media_content",
    label: "Social Media Content",
    kind: "channel",
    tag: "social_media_content",
    suggestion: "Regelmäßiger Content zu Team und Arbeitsalltag stärkt deine Arbeitgebermarke und bringt mehr Bewerbungen.",
  },
  {
    id: "drehtag",
    label: "Drehtag / Reels",
    kind: "product",
    tag: "drehtag",
    suggestion:
      "Mit persönlichen, authentischen Reels von einem Drehtag kannst du deine Arbeitgebermarke extrem stärken.",
  },
];

export const LEAD_GROWTH_LEVERS: GrowthLever[] = [
  {
    id: "google_ads",
    label: "Google Ads",
    kind: "channel",
    tag: "google_ads",
    suggestion: "Google Ads erreicht Mandanten genau im Moment ihres Bedarfs.",
  },
  {
    id: "meta_ads",
    label: "Meta Ads (Facebook/Instagram)",
    kind: "channel",
    tag: "meta_ads",
    suggestion: "Mit Meta-Anzeigen (Facebook/Instagram) erreichst du zusätzliche Wunschmandanten.",
  },
  {
    id: "linkedin_ads",
    label: "LinkedIn Ads",
    kind: "channel",
    tag: "linkedin_ads",
    suggestion: "LinkedIn eignet sich besonders gut, um B2B-Mandate gezielt anzusprechen.",
  },
];

export type GrowthScore = {
  percent: number;
  metLevers: GrowthLever[];
  unmetLevers: GrowthLever[];
};

export function computeGrowthScore(
  levers: GrowthLever[],
  activeChannels: string[],
  bookedProductTags: string[],
): GrowthScore {
  const metLevers: GrowthLever[] = [];
  const unmetLevers: GrowthLever[] = [];

  for (const lever of levers) {
    const satisfied = lever.kind === "channel" ? activeChannels.includes(lever.tag) : bookedProductTags.includes(lever.tag);
    if (satisfied) metLevers.push(lever);
    else unmetLevers.push(lever);
  }

  const percent = levers.length === 0 ? 100 : Math.round((metLevers.length / levers.length) * 100);
  return { percent, metLevers, unmetLevers };
}
