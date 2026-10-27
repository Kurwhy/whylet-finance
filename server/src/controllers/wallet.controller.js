import {
    createWalletSchema,
    updateWalletSchema
} from "../validators/wallet.validator.js";

import * as walletService from "../services/wallet.service.js";

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
            message: "Terjadi konflik data. Silakan coba lagi."
        });
    }

    next(error);
}

export async function index(req, res, next) {
    try {
        const wallets = await walletService.getWallets(req.user.id);

        res.json({
            success: true,
            data: wallets
        });
    } catch (error) {
        next(error);
    }
}

export async function show(req, res, next) {
    try {
        const wallet = await walletService.getWallet(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function store(req, res, next) {
    try {
        const result = createWalletSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Data dompet tidak valid",
                errors: result.error.flatten().fieldErrors
            });
        }

        const wallet = await walletService.createWallet(
            req.user.id,
            result.data
        );

        res.status(201).json({
            success: true,
            message: "Dompet berhasil dibuat",
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function update(req, res, next) {
    try {
        const result = updateWalletSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Data dompet tidak valid",
                errors: result.error.flatten().fieldErrors
            });
        }

        const wallet = await walletService.updateWallet(
            req.user.id,
            req.params.id,
            result.data
        );

        res.json({
            success: true,
            message: "Dompet berhasil diperbarui",
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function setDefault(req, res, next) {
    try {
        const wallet = await walletService.setDefaultWallet(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            message: "Dompet utama berhasil diubah",
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function archive(req, res, next) {
    try {
        const wallet = await walletService.archiveWallet(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            message: "Dompet berhasil diarsipkan",
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function unarchive(req, res, next) {
    try {
        const wallet = await walletService.unarchiveWallet(
            req.user.id,
            req.params.id
        );

        return res.json({
            success: true,
            message: "Dompet berhasil diaktifkan kembali",
            data: wallet
        });
    } catch (error) {
        handleError(error, res, next);
    }
}