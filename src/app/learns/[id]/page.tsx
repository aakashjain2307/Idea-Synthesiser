import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type LearnPageProps = {
  params: Promise<{ id: string }>;
};

const sections = [
  ["Technology Map", "technologyMap"],
  ["Build Explanation", "buildExplanation"],
  ["Learning Path", "learningPath"],
  ["Hands-On Tasks", "handsOnTasks"],
  ["Interview Prep", "interviewPrep"],
  ["Concept Checks", "conceptChecks"]
] as const;

export async function generateMetadata({ params }: LearnPageProps): Promise<Metadata> {
  const { id } = await params;
  const learn = await prisma.learnArtifact.findUnique({
    where: { id },
    select: {
      opportunity: {
        select: {
          title: true
        }
      }
    }
  });

  return {
    title: learn ? `${learn.opportunity.title} Learning Plan` : "Learning Plan"
  };
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { id } = await params;
  const learn = await prisma.learnArtifact.findUnique({
    where: { id },
    select: {
      id: true,
      buildArtifactId: true,
      technologyMap: true,
      buildExplanation: true,
      learningPath: true,
      handsOnTasks: true,
      interviewPrep: true,
      conceptChecks: true,
      createdAt: true,
      opportunity: {
        select: {
          title: true,
          targetUser: true,
          productWedge: true
        }
      }
    }
  });

  if (!learn) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#f6f7f2] px-4 py-6 text-ink lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-lake">
                Learning plan
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-ink">
                {learn.opportunity.title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                {learn.opportunity.targetUser}
              </p>
              <p className="mt-3 text-sm leading-6 text-ink/70">
                {learn.opportunity.productWedge}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {learn.buildArtifactId ? (
                <Link className="icon-button" href={`/builds/${learn.buildArtifactId}`} target="_blank">
                  Open demo
                </Link>
              ) : null}
              <Link className="secondary-button" href="/">
                Back to dashboard
              </Link>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink/45">
            Created {learn.createdAt.toLocaleString()}
          </p>
        </header>

        <div className="grid gap-4">
          {sections.map(([label, key]) => (
            <section key={key} className="rounded-lg border border-ink/10 bg-white p-5 shadow-panel">
              <h2 className="text-lg font-semibold tracking-normal text-ink">{label}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink/70">
                {learn[key]}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
