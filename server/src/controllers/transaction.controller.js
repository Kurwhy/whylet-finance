import { z } from "zod";
import {
    createTransactionSchema,
    updateTransactionSchema
} from "../validators/transaction.validator.js";

import * as service from "../services/transaction.service.js";

const listSchema = z.object({
    type: z.enum(["INCOME", "EXPENSE"]).optional(),
    walletId: z.uuid().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
}).strict().refine(
    data => !data.startDate || !data.endDate ||
        data.startDate <= data.endDate,
    "Rentang tanggal tidak valid"
);

function handleError(error, res, next) {
    if (error.status) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === "P2034") {
        return res.status(409).json({
            success: false,
            message: "Terjadi konflik transaksi. Silakan coba lagi."
        });
    }

    next(error);
}

function validate(schema, input, res) {
    const result = schema.safeParse(input);

    if (!result.success) {
        res.status(400).json({
            success: false,
            message: "Data tidak valid",
            errors: result.error.flatten()
        });
        return null;
    }

    return result.data;
}

export async function index(req, res, next) {
    try {
        const filters = validate(listSchema, req.query, res);
        if (!filters) return;

        const data = await service.getTransactions(
            req.user.id,
            filters
        );

        res.json({ success: true, data });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function show(req, res, next) {
    try {
        const data = await service.getTransaction(
            req.user.id,
            req.params.id
        );

        res.json({ success: true, data });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function store(req, res, next) {
    try {
        const input = validate(
            createTransactionSchema,
            req.body,
            res
        );

        if (!input) return;

        const data = await service.createTransaction(
            req.user.id,
            input
        );

        res.status(201).json({
            success: true,
            message: "Transaksi berhasil ditambahkan",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function update(req, res, next) {
    try {
        const input = validate(
            updateTransactionSchema,
            req.body,
            res
        );

        if (!input) return;

        const data = await service.updateTransaction(
            req.user.id,
            req.params.id,
            input
        );

        res.json({
            success: true,
            message: "Transaksi berhasil diperbarui",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function destroy(req, res, next) {
    try {
        const data = await service.deleteTransaction(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            message: data.message
        });
    } catch (error) {
        handleError(error, res, next);
    }
}
