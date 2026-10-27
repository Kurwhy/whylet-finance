const HTTP_MESSAGES = {
    400: "Data yang dimasukkan tidak valid.",
    401: "Email atau kata sandi salah, atau sesi telah berakhir.",
    403: "Kamu tidak memiliki izin untuk melakukan tindakan ini.",
    404: "Data yang diminta tidak ditemukan.",
    409: "Data sudah digunakan atau terjadi konflik.",
    422: "Periksa kembali data yang dimasukkan.",
    429: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
    500: "Terjadi gangguan pada server. Silakan coba lagi.",
    502: "Layanan sedang tidak tersedia.",
    503: "Layanan sedang dalam pemeliharaan."
};

const ENGLISH_MESSAGES = new Map([
    ["Invalid credentials", "Email atau kata sandi salah."],
    ["Unauthorized", "Silakan masuk terlebih dahulu."],
    ["Forbidden", "Kamu tidak memiliki izin."],
    ["Validation failed", "Periksa kembali data formulir."],
    ["Internal server error", "Terjadi gangguan pada server."],
    ["Network Error", "Tidak dapat terhubung ke server."]
]);

export function getPesanKesalahan(error) {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;

    if (!error?.response) {
        return "Tidak dapat terhubung ke server. Periksa koneksi internet atau coba lagi.";
    }

    // Pesan backend yang sudah berbahasa Indonesia
    // dapat ditampilkan secara langsung.
    if (typeof message === "string" && message.trim()) {
        if (ENGLISH_MESSAGES.has(message)) {
            return ENGLISH_MESSAGES.get(message);
        }

        // Jangan tampilkan exception mentah dari server
        // pada halaman yang dilihat pengguna.
        if (status >= 500) {
            return HTTP_MESSAGES[status] || HTTP_MESSAGES[500];
        }

        return message;
    }

    return (
        HTTP_MESSAGES[status] ||
        "Terjadi kesalahan. Silakan coba lagi."
    );
}
