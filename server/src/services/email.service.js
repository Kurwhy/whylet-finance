import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    requireTLS: process.env.NODE_ENV === "production",
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

export async function sendVerificationEmail(email, token) {
    const link = new URL("/verify-email", process.env.CLIENT_URL);
    link.searchParams.set("token", token);

    await transport.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Verifikasi email Whylet",
        text:
            `Halo! Verifikasi email Whylet melalui tautan berikut:\n\n` +
            `${link.toString()}\n\n` +
            "Tautan berlaku selama 30 menit. Jika kamu tidak mendaftar, abaikan email ini."
    });
}

export async function sendPasswordResetEmail(email, token) {
    const link = new URL("/reset-password", process.env.CLIENT_URL);
    link.searchParams.set("token", token);
    await transport.sendMail({ from: process.env.MAIL_FROM, to: email,
        subject: "Reset kata sandi Whylet",
        text: `Gunakan tautan berikut untuk mereset kata sandi: ${link.toString()}\nTautan berlaku 30 menit dan hanya sekali pakai. Abaikan jika bukan permintaan Anda.` });
}
