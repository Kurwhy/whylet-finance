import {
    createCategorySchema,
    updateCategorySchema
} from "../validators/category.validator.js";

import * as service from "../services/category.service.js";

function handleError(error, res, next) {
    if (error.status || error.code === "P2002") {
        return res.status(error.status || 409).json({
            success: false,
            message: error.code === "P2002"
                ? "Kategori dengan nama tersebut sudah ada"
                : error.message
        });
    }

    next(error);
}

export async function index(req, res, next) {
    try {
        const data = await service.getCategories(req.user.id);

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

export async function store(req, res, next) {
    try {
        const parsed = createCategorySchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Data kategori tidak valid",
                errors: parsed.error.flatten().fieldErrors
            });
        }

        const data = await service.createCategory(
            req.user.id,
            parsed.data
        );

        res.status(201).json({
            success: true,
            message: "Kategori berhasil dibuat",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function update(req, res, next) {
    try {
        const parsed = updateCategorySchema.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: "Data kategori tidak valid",
                errors: parsed.error.flatten().fieldErrors
            });
        }

        const data = await service.updateCategory(
            req.user.id,
            req.params.id,
            parsed.data
        );

        res.json({
            success: true,
            message: "Kategori berhasil diperbarui",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}

export async function archive(req, res, next) {
    try {
        const data = await service.archiveCategory(
            req.user.id,
            req.params.id
        );

        res.json({
            success: true,
            message: "Kategori berhasil diarsipkan",
            data
        });
    } catch (error) {
        handleError(error, res, next);
    }
}
