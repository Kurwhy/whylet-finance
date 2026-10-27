import jwt from "jsonwebtoken";

export const COOKIE_NAME = "whylet_session";

const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000
};

export function createToken(userId) {
    return jwt.sign(
        { sub: userId },
        process.env.JWT_SECRET,
        {
            expiresIn: "1d",
            algorithm: "HS256"
        }
    );
}

export function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"]
    });
}

export function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt
    };
}
