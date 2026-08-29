-- CreateEnum
CREATE TYPE "StagingStatus" AS ENUM ('PENDING', 'VALID', 'ERROR', 'PROMOTED');

-- CreateTable
CREATE TABLE "departments" (
    "code" TEXT NOT NULL,
    "name" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "equipment" (
    "eqnum" TEXT NOT NULL,
    "egi" TEXT NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("eqnum")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_codes" (
    "code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "activity_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "daywork_records" (
    "id" TEXT NOT NULL,
    "eqnum" TEXT NOT NULL,
    "aktivitas" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "wh" DECIMAL(10,2) NOT NULL,
    "costUsd" DECIMAL(14,2) NOT NULL,
    "sourceMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daywork_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daywork_staging" (
    "id" TEXT NOT NULL,
    "egi" TEXT,
    "eqnum" TEXT,
    "aktivitas" TEXT,
    "kode" TEXT,
    "dept" TEXT,
    "tanggal" DATE,
    "wh" DECIMAL(10,2),
    "costUsd" DECIMAL(14,2),
    "sourceFile" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sourceMonth" TEXT NOT NULL,
    "status" "StagingStatus" NOT NULL DEFAULT 'PENDING',
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daywork_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "menuKey" TEXT NOT NULL DEFAULT 'daywork',
    "widgetKey" TEXT NOT NULL,
    "chartType" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL,
    "positionY" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "filterConfig" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "daywork_records_tanggal_idx" ON "daywork_records"("tanggal");

-- CreateIndex
CREATE INDEX "daywork_records_dept_idx" ON "daywork_records"("dept");

-- CreateIndex
CREATE INDEX "daywork_records_kode_idx" ON "daywork_records"("kode");

-- CreateIndex
CREATE INDEX "daywork_records_eqnum_idx" ON "daywork_records"("eqnum");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_widgets_userId_menuKey_widgetKey_key" ON "dashboard_widgets"("userId", "menuKey", "widgetKey");

-- AddForeignKey
ALTER TABLE "daywork_records" ADD CONSTRAINT "daywork_records_eqnum_fkey" FOREIGN KEY ("eqnum") REFERENCES "equipment"("eqnum") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daywork_records" ADD CONSTRAINT "daywork_records_kode_fkey" FOREIGN KEY ("kode") REFERENCES "activity_codes"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daywork_records" ADD CONSTRAINT "daywork_records_dept_fkey" FOREIGN KEY ("dept") REFERENCES "departments"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
