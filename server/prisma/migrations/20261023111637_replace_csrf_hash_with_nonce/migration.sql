/*
  Warnings:

  - You are about to drop the column `csrf_hash` on the `auth_sessions` table. All the data in the column will be lost.
  - Added the required column `csrf_nonce` to the `auth_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `auth_sessions` DROP COLUMN `csrf_hash`,
    ADD COLUMN `csrf_nonce` CHAR(64) NOT NULL;
