import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddLessonForm } from "./add-lesson-form";
import { CompleteToggle } from "./complete-toggle";
import { PublishToggle } from "../publish-toggle";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: { orderBy: { order: "asc" } },
      enrollments: { where: { userId: session.user.id }, include: { progress: true } },
    },
  });
  if (!course) notFound();

  const isAgency = session.user.role === "AGENCY_ADMIN";
  if (!isAgency && !course.published) notFound();

  const progressByLessonId = new Map(course.enrollments[0]?.progress.map((p) => [p.lessonId, !!p.completedAt]));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{course.title}</h1>
          {course.description && <p className="text-muted-foreground">{course.description}</p>}
        </div>
        {isAgency && <PublishToggle courseId={course.id} published={course.published} />}
      </div>

      {isAgency && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lektion hinzufügen</CardTitle>
          </CardHeader>
          <CardContent>
            <AddLessonForm courseId={course.id} />
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {course.lessons.map((lesson, index) => (
          <Card key={lesson.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {index + 1}. {lesson.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {lesson.videoUrl ? (
                <video src={lesson.videoUrl} controls className="w-full max-w-xl rounded-md" />
              ) : (
                <p className="text-sm text-muted-foreground">Noch kein Video hochgeladen.</p>
              )}
              {!isAgency && (
                <CompleteToggle
                  courseId={course.id}
                  lessonId={lesson.id}
                  completed={progressByLessonId.get(lesson.id) ?? false}
                />
              )}
            </CardContent>
          </Card>
        ))}
        {course.lessons.length === 0 && <p className="text-muted-foreground">Noch keine Lektionen.</p>}
      </div>
    </div>
  );
}
