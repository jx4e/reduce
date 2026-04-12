-- CreateTable
CREATE TABLE "StudyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "type" TEXT NOT NULL,
    "guideId" TEXT,
    "gcalEventId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyEvent_userId_idx" ON "StudyEvent"("userId");

-- CreateIndex
CREATE INDEX "StudyEvent_date_idx" ON "StudyEvent"("date");

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE SET NULL ON UPDATE CASCADE;
