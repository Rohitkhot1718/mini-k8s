-- CreateEnum
CREATE TYPE "Status" AS ENUM ('PENDING', 'WAITING', 'RUNNABLE', 'RUNNING', 'STOPPED', 'FAILED');

-- CreateTable
CREATE TABLE "JobContainers" (
    "id" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'PENDING',
    "containerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobContainers_pkey" PRIMARY KEY ("id")
);
