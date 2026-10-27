import { z } from "zod";
import {
    periodSchema
} from "../validators/report.validator.js";

import {
    getDashboardSummary,
    getRecentTransactions
} from "../services/dashboard.service.js";

const recentSchema = z.object({
    limit: z.coerce.number().int().min(1).max(20)
        .default(5)
}).strict();

export async function summary(req, res, next) {
    try {
        const parsed = periodSchema.safeParse(req.query);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Periode tidak valid"
            });
        }

        const data = await getDashboardSummary(
            req.user.id,
            parsed.data.month
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function recentTransactions(req, res, next) {
    try {
        const parsed = recentSchema.safeParse(req.query);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Parameter limit tidak valid"
            });
        }

        const data = await getRecentTransactions(
            req.user.id,
            parsed.data.limit
        );

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        next(error);
    }
}
