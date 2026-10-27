import { useCallback, useRef, useState } from "react";

import { notify } from "../utils/notify";
import { getPesanKesalahan } from "../utils/messages";

export default function useAsyncAction() {
    const [loading, setLoading] = useState(false);
    const activeRef = useRef(false);

    const execute = useCallback(async (action, options = {}) => {
        if (activeRef.current) {
            return { ok: false, skipped: true };
        }

        activeRef.current = true;
        setLoading(true);

        try {
            const result = await action();

            if (options.successMessage) {
                notify.success(options.successMessage);
            }

            return {
                ok: true,
                data: result
            };
        } catch (error) {
            const message = getPesanKesalahan(error);

            if (options.showError !== false) {
                notify.error(message);
            }

            return {
                ok: false,
                error,
                message
            };
        } finally {
            activeRef.current = false;
            setLoading(false);
        }
    }, []);

    return {
        execute,
        loading
    };
}
