import { createServer } from "node:net";
// Sink minimal khusus tes: loopback, tanpa relay, pesan hanya dalam memori.
export async function createSmtpSink() {
    const messages = [];
    const sockets = new Set();
    const server = createServer(socket => {
        sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.on("error", () => {});
        socket.write("220 localhost SMTP testing\r\n");
        let buffer = "", dataMode = false, message = [];
        socket.on("data", chunk => {
            buffer += chunk.toString();
            let boundary;
            while ((boundary = buffer.indexOf("\r\n")) >= 0) {
                const line = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
                if (dataMode) {
                    if (line === ".") { messages.push(message.join("\r\n")); message = []; dataMode = false; socket.write("250 accepted\r\n"); }
                    else message.push(line.startsWith("..") ? line.slice(1) : line);
                } else if (/^(EHLO|HELO)/i.test(line)) socket.write("250-localhost\r\n250 8BITMIME\r\n");
                else if (/^DATA$/i.test(line)) { dataMode = true; socket.write("354 End with dot\r\n"); }
                else if (/^QUIT$/i.test(line)) socket.end("221 bye\r\n");
                else if (/^(MAIL FROM:|RCPT TO:|RSET|NOOP)/i.test(line)) socket.write("250 ok\r\n");
                else socket.write("502 unsupported\r\n");
            }
        });
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    return { messages, port: server.address().port, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
