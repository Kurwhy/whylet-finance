import { z } from "zod";
import { createTransferSchema } from "../validators/transfer.validator.js";
import * as transferService from "../services/transfer.service.js";

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
            message: "Terjadi konflik transaksi. Silakan coba kembali."
        });
    }

    next(error);
}

export async function index(req, res, next) {
    try {
        const data = await transferService.getTransfers(
            req.user.id
        );

        res.json({
            success: true,
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function show(req, res, next) {
    try {
        const data = await transferService.getTransfer(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function store(req, res, next) {
    try {
        const result = createTransferSchema.safeParse(
            req.body
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Data transfer tidak valid",
                errors: result.error.flatten().fieldErrors
            });
        }

        const key = req.get("Idempotency-Key");
        if (key !== undefined && !z.uuid().safeParse(key).success) {
            return res.status(400).json({ success: false, message: "Kunci permintaan transfer tidak valid." });
        }
        const data = await transferService.createTransfer(
            req.user.id,
            result.data,
            key
        );

        res.status(201).json({
            success: true,
            message: "Transfer berhasil dicatat",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}
