import { useCallback, useEffect, useRef, useState } from "react";

const ERROR_MESSAGES = {
    "not-allowed": "Izin mikrofon ditolak. Izinkan akses mikrofon melalui pengaturan browser.",
    "service-not-allowed": "Layanan pengenalan suara tidak diizinkan.",
    "audio-capture": "Mikrofon tidak ditemukan atau tidak dapat digunakan.",
    "no-speech": "Tidak ada suara yang terdeteksi. Silakan coba lagi.",
    "network": "Layanan pengenalan suara mengalami masalah jaringan.",
    "language-not-supported": "Bahasa Indonesia tidak didukung oleh layanan pengenalan suara ini.",
    "language-unavailable": "Pengenalan bahasa Indonesia belum tersedia.",
    "aborted": "Perekaman dibatalkan.",
};

export function useSpeechRecognition(onTranscript) {
    const recognitionRef = useRef(null);
    const callbackRef = useRef(onTranscript);

    const [listening, setListening] = useState(false);
    const [error, setError] = useState("");

    const [supported] = useState(() => {
        if (typeof window === "undefined") return false;

        return Boolean(
            window.SpeechRecognition ||
            window.webkitSpeechRecognition
        );
    });

    useEffect(() => {
        callbackRef.current = onTranscript;
    }, [onTranscript]);

    const cancelListening = useCallback(() => {
        const recognition = recognitionRef.current;

        recognitionRef.current = null;

        if (recognition) {
            recognition.abort();
        }

        setListening(false);
    }, []);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const startListening = useCallback(() => {
        if (!supported) {
            setError("Browser ini belum mendukung input suara.");
            return;
        }

        if (recognitionRef.current) return;

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        const recognition = new SpeechRecognition();

        recognition.lang = "id-ID";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognitionRef.current = recognition;

        setError("");

        recognition.onstart = () => {
            setListening(true);
        };

        recognition.onresult = (event) => {
            if (recognitionRef.current !== recognition) return;

            const transcript = Array.from(event.results)
                .filter((result) => result.isFinal)
                .map((result) => result[0]?.transcript || "")
                .join(" ")
                .trim();

            if (transcript) {
                callbackRef.current?.(transcript);
            }
        };

        recognition.onerror = (event) => {
            if (recognitionRef.current !== recognition) return;

            if (event.error !== "aborted") {
                setError(
                    ERROR_MESSAGES[event.error] ||
                    `Pengenalan suara gagal: ${event.error}`
                );
            }
        };

        recognition.onend = () => {
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null;
                setListening(false);
            }
        };

        try {
            recognition.start();
        } catch {
            recognitionRef.current = null;
            setListening(false);
            setError("Gagal memulai mikrofon. Silakan coba lagi.");
        }
    }, [supported]);

    useEffect(() => {
        return () => {
            const recognition = recognitionRef.current;
            recognitionRef.current = null;
            recognition?.abort();
        };
    }, []);

    return {
        supported,
        listening,
        error,
        startListening,
        stopListening,
        cancelListening,
    };
}
