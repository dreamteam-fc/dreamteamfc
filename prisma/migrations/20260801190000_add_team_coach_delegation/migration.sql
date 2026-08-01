-- CreateEnum
CREATE TYPE "TeamCoachInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TeamCoachInvite" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeUserId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "TeamCoachInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamCoachInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamCoach" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "inviteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TeamCoach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamCoachInvite_tokenHash_key" ON "TeamCoachInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "TeamCoachInvite_fantasyTeamId_status_idx" ON "TeamCoachInvite"("fantasyTeamId", "status");

-- CreateIndex
CREATE INDEX "TeamCoachInvite_inviteeEmail_status_idx" ON "TeamCoachInvite"("inviteeEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCoach_inviteId_key" ON "TeamCoach"("inviteId");

-- CreateIndex
CREATE INDEX "TeamCoach_userId_idx" ON "TeamCoach"("userId");

-- CreateIndex
CREATE INDEX "TeamCoach_fantasyTeamId_revokedAt_idx" ON "TeamCoach"("fantasyTeamId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamCoach_fantasyTeamId_userId_key" ON "TeamCoach"("fantasyTeamId", "userId");

-- AddForeignKey
ALTER TABLE "TeamCoachInvite" ADD CONSTRAINT "TeamCoachInvite_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoachInvite" ADD CONSTRAINT "TeamCoachInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoachInvite" ADD CONSTRAINT "TeamCoachInvite_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoach" ADD CONSTRAINT "TeamCoach_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoach" ADD CONSTRAINT "TeamCoach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoach" ADD CONSTRAINT "TeamCoach_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamCoach" ADD CONSTRAINT "TeamCoach_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "TeamCoachInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
