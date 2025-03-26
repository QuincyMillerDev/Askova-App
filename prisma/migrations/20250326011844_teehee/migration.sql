/*
  Warnings:

  - A unique constraint covering the columns `[id,userId]` on the table `Quiz` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Quiz_id_userId_key" ON "Quiz"("id", "userId");
