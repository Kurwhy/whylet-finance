import { toast } from "sonner";

export const notify = {
    success(message = "Berhasil menyimpan data.") {
        return toast.success(message);
    },

    error(message = "Terjadi kesalahan. Silakan coba lagi.") {
        return toast.error(message);
    },

    warning(message = "Periksa kembali data yang dimasukkan.") {
        return toast.warning(message);
    },

    info(message) {
        return toast.info(message);
    },

    loading(message = "Sedang memproses...") {
        return toast.loading(message);
    },

    dismiss(id) {
        toast.dismiss(id);
    }
};
