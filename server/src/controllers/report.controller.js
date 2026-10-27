import {
    categoryReportSchema,
    monthlyReportSchema,
    exportReportSchema
} from "../validators/report.validator.js";

import {
    getMonthlyReport,
    getCategoryReport,
    exportTransactions
} from "../services/report.service.js";

function parseQuery(schema, query, res) {
    const parsed = schema.safeParse(query);

    if (!parsed.success) {
        res.status(400).json({
            success: false,
            message: "Parameter laporan tidak valid",
            errors: parsed.error.flatten()
        });
        return null;
    }

    return parsed.data;
}

export async function monthly(req, res, next) {
    try {
        const query = parseQuery(
            monthlyReportSchema,
            req.query,
            res
        );
        if (!query) return;

        const data = await getMonthlyReport(
            req.user.id,
            query.year
        );

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

export async function categories(req, res, next) {
    try {
        const query = parseQuery(
            categoryReportSchema,
            req.query,
            res
        );
        if (!query) return;

        const data = await getCategoryReport(
            req.user.id,
            query
        );

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

export async function exportCsv(req, res, next) {
    try {
        const query = parseQuery(
            exportReportSchema,
            req.query,
            res
        );
        if (!query) return;

        const result = await exportTransactions(
            req.user.id,
            query
        );

        res.setHeader(
            "Content-Type",
            "text/csv; charset=utf-8"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${result.filename}"`
        );
        res.setHeader("Cache-Control", "no-store");

        return res.send(result.content);
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
