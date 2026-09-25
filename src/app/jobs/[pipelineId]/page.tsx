import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { buildJobPostingJsonLd, employmentTypeLabel } from "@/lib/job-schema";

async function getPublishedJobPosting(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { organization: { select: { name: true } }, jobPosting: true },
  });
  if (!pipeline || pipeline.kind !== "APPLICANTS" || !pipeline.jobPosting?.isPublished) return null;
  return pipeline;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pipelineId: string }>;
}): Promise<Metadata> {
  const { pipelineId } = await params;
  const pipeline = await getPublishedJobPosting(pipelineId);
  if (!pipeline) return {};
  const employerName = pipeline.jobPosting!.employerName || pipeline.organization.name;
  const location = pipeline.jobPosting!.city ? ` in ${pipeline.jobPosting!.city}` : "";
  return {
    title: `${pipeline.name}${location} - ${employerName}`,
    description: pipeline.jobPosting!.aboutUs?.slice(0, 160) ?? `Stellenanzeige von ${employerName}`,
  };
}

export default async function PublicJobPage({ params }: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await params;
  const pipeline = await getPublishedJobPosting(pipelineId);
  if (!pipeline) notFound();

  const posting = pipeline.jobPosting!;
  const employerName = posting.employerName || pipeline.organization.name;
  const baseUrl = await getBaseUrl();
  const applicationUrl = posting.applicationUrl || `${baseUrl}/jobs/${pipeline.id}`;

  const descriptionHtml = [
    posting.aboutUs && `<h2>Über uns</h2><p>${posting.aboutUs}</p>`,
    posting.tasks && `<h2>Aufgaben</h2><p>${posting.tasks}</p>`,
    posting.profile && `<h2>Profil</h2><p>${posting.profile}</p>`,
    posting.benefitsList.length > 0 &&
      `<h2>Benefits</h2><ul>${posting.benefitsList.map((b) => `<li>${b}</li>`).join("")}</ul>`,
  ]
    .filter(Boolean)
    .join("\n");

  const jsonLd = buildJobPostingJsonLd({
    title: pipeline.name,
    descriptionHtml,
    datePosted: posting.publishedAt ?? posting.createdAt,
    validThrough: posting.validThrough,
    employmentType: posting.employmentType,
    employerName,
    employerLogoUrl: posting.employerLogoUrl,
    employerWebsite: posting.employerWebsite,
    street: posting.street,
    postalCode: posting.postalCode,
    city: posting.city,
    country: posting.country,
    applicationUrl,
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-4 py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {posting.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posting.heroImageUrl} alt="" className="aspect-video w-full rounded-lg object-cover" />
      )}

      <div className="flex items-center gap-3">
        {posting.employerLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posting.employerLogoUrl} alt={employerName} className="size-10 rounded object-contain" />
        )}
        <p className="text-sm font-medium text-muted-foreground">{employerName}</p>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{pipeline.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[posting.city, employmentTypeLabel(posting.employmentType)].filter(Boolean).join(" · ")}
        </p>
      </div>

      {posting.galleryUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {posting.galleryUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="aspect-square w-full rounded-md object-cover" />
          ))}
        </div>
      )}

      {posting.aboutUs && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Über uns</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{posting.aboutUs}</p>
        </section>
      )}

      {posting.tasks && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Aufgaben</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{posting.tasks}</p>
        </section>
      )}

      {posting.profile && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Profil</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{posting.profile}</p>
        </section>
      )}

      {posting.benefitsList.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Benefits</h2>
          <ul className="list-disc pl-5 text-sm text-muted-foreground">
            {posting.benefitsList.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Interesse geweckt?</p>
        {posting.applicationUrl ? (
          <a
            href={posting.applicationUrl}
            className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Jetzt bewerben
          </a>
        ) : posting.contactEmail ? (
          <a
            href={`mailto:${posting.contactEmail}`}
            className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Jetzt bewerben
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Bitte wende dich direkt an {employerName}.</p>
        )}
        {posting.contactName && <p className="text-xs text-muted-foreground">Ansprechpartner: {posting.contactName}</p>}
      </div>
    </div>
  );
}
