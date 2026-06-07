import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

type BuildPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: BuildPageProps): Promise<Metadata> {
  const { id } = await params;
  const build = await prisma.buildArtifact.findUnique({
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
    title: build ? `${build.opportunity.title} Demo` : "Build Demo"
  };
}

export default async function BuildDemoPage({ params }: BuildPageProps) {
  const { id } = await params;
  const build = await prisma.buildArtifact.findUnique({
    where: { id },
    select: {
      demoHtml: true,
      opportunity: {
        select: {
          title: true
        }
      }
    }
  });

  if (!build) {
    notFound();
  }

  return (
    <main>
      <iframe
        title={`${build.opportunity.title} demo`}
        style={{
          background: "white",
          border: 0,
          height: "100vh",
          inset: 0,
          position: "fixed",
          width: "100vw"
        }}
        sandbox="allow-forms allow-scripts"
        srcDoc={build.demoHtml}
      />
    </main>
  );
}
