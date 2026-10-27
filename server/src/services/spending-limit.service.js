import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";

import {
    getUserPeriod,
    monthRange
} from "./dashboard.service.js";

const D = (value) => new Prisma.Decimal(value);

export class SpendingLimitError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

export async function getSpendingLimit(userId, requestedMonth) {
    const { month, timezone } = await getUserPeriod(
        userId,
        requestedMonth
    );

    const [config, spendingResult] = await Promise.all([
        prisma.spendingLimit.findUnique({
            where: { userId }
        }),

        prisma.transaction.aggregate({
            where: {
                userId,
                type: "EXPENSE",
                transactionDate: monthRange(month)
            },
            _sum: {
                amount: true
            }
        })
    ]);

    const spent = D(spendingResult._sum.amount ?? 0);
    const limit = D(config?.amount ?? 0);

    const enabled = Boolean(config?.isEnabled);

    let percentage = null;
    let status = "NOT_CONFIGURED";
    let remaining = null;

    if (config && !enabled) {
        status = "DISABLED";
    } else if (config && enabled) {
        const ratio = spent.div(limit).times(100);

        percentage = Number(ratio.toFixed(2));
        remaining = Prisma.Decimal.max(
            limit.minus(spent),
            D(0)
        ).toFixed(2);

        if (ratio.greaterThanOrEqualTo(100)) {
            status = "EXCEEDED";
        } else if (ratio.greaterThanOrEqualTo(80)) {
            status = "WARNING";
        } else {
            status = "SAFE";
        }
    }

    return {
        period: month,
        timezone,
        isConfigured: Boolean(config),
        isEnabled: enabled,
        amount: config?.amount.toFixed(2) ?? null,
        spent: spent.toFixed(2),
        remaining,
        percentage,
        status
    };
}

export async function updateSpendingLimit(userId, data) {
    await prisma.spendingLimit.upsert({
        where: { userId },
        create: {
            userId,
            amount: data.amount,
            isEnabled: data.isEnabled,
            emailNotification: false
        },
        update: {
            amount: data.amount,
            isEnabled: data.isEnabled
        }
    });

    return getSpendingLimit(userId);
}

export async function toggleSpendingLimit(userId, isEnabled) {
    const config = await prisma.spendingLimit.findUnique({
        where: { userId }
    });

    if (!config) {
        throw new SpendingLimitError(
            "Atur nominal spending limit terlebih dahulu",
            404
        );
    }

    await prisma.spendingLimit.update({
        where: { userId },
        data: { isEnabled }
    });

    return getSpendingLimit(userId);
}
