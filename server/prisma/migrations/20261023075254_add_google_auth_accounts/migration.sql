-- AlterTable
ALTER TABLE `users` MODIFY `password_hash` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `auth_accounts` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `provider` VARCHAR(30) NOT NULL,
    `provider_account_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auth_accounts_user_id_idx`(`user_id`),
    UNIQUE INDEX `auth_accounts_provider_provider_account_id_key`(`provider`, `provider_account_id`),
    UNIQUE INDEX `auth_accounts_user_id_provider_key`(`user_id`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auth_accounts` ADD CONSTRAINT `auth_accounts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
