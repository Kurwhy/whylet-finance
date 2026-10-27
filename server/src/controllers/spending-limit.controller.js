import {
    updateSpendingLimitSchema,
    toggleSpendingLimitSchema,
    spendingLimitQuerySchema
} from "../validators/spending-limit.validator.js";

import * as spendingService from "../services/spending-limit.service.js";

function validationError(res, error) {
    return res.status(400).json({
        success: false,
        message: "Data spending limit tidak valid",
        errors: error.flatten().fieldErrors
    });
}

export async function show(req, res, next) {
    try {
        const parsed = spendingLimitQuerySchema.safeParse(req.query);

        if (!parsed.success) {
            return validationError(res, parsed.error);
        }

        const data = await spendingService.getSpendingLimit(
            req.user.id,
            parsed.data.month
        );

        return res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

export async function update(req, res, next) {
    try {
        const parsed = updateSpendingLimitSchema.safeParse(req.body);

        if (!parsed.success) {
            return validationError(res, parsed.error);
        }

        const data = await spendingService.updateSpendingLimit(
            req.user.id,
            parsed.data
        );

        return res.json({
            success: true,
            message: "Spending limit berhasil disimpan",
            data
        });
    } catch (error) {
        next(error);
    }
}

export async function toggle(req, res, next) {
    try {
        const parsed = toggleSpendingLimitSchema.safeParse(req.body);

        if (!parsed.success) {
            return validationError(res, parsed.error);
        }

        const data = await spendingService.toggleSpendingLimit(
            req.user.id,
            parsed.data.isEnabled
        );

        return res.json({
            success: true,
            message: parsed.data.isEnabled
                ? "Spending limit diaktifkan"
                : "Spending limit dinonaktifkan",
            data
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                message: error.message
            });
        }

        next(error);
    }
}
