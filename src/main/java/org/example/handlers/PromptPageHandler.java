package org.example.handlers;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import org.example.gemini.GeminiClient;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public class PromptPageHandler implements HttpHandler {

    private final GeminiClient geminiClient = new GeminiClient();
    private final Gson gson = new Gson();

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String query = exchange.getRequestURI().getQuery();
        String prompt = getParam(query, "prompt");

        if (prompt != null) {
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");

            try {
                String answer = geminiClient.ask(prompt);
                JsonObject json = new JsonObject();
                json.addProperty("response", answer);
                json.addProperty("prompt", prompt);
                sendResponse(exchange, 200, gson.toJson(json));
            } catch (Exception e) {
                sendResponse(exchange, 500, "{\"error\":\"" + e.getMessage() + "\"}");
            }
            return;
        }

        sendHtml(exchange, buildFormPage());
    }

    private String getParam(String query, String key) {
        if (query == null) return null;
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=", 2);
            if (parts.length == 2 && parts[0].equalsIgnoreCase(key)) {
                return URLDecoder.decode(parts[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private String buildFormPage() {
        return """
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>Gemini AI</title>
                <style>
                    body { font-family: sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
                    textarea { width: 100%; height: 100px; margin-bottom: 10px; }
                    #output { white-space: pre-wrap; background: #f4f4f4; padding: 15px; border-radius: 5px; display: none; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1>Gemini AI - Text & Docx</h1>
                <textarea id="prompt" placeholder="הכנס את השאלה שלך כאן..."></textarea>
                <br>
                <button onclick="sendPrompt()">שלח שאלה</button>
                <hr>
                <h3>העלאת קובץ .docx</h3>
                <input type="file" id="docxFile" accept=".docx">
                <button onclick="uploadFile()">העלה ונתח</button>
                
                <p id="status"></p>
                <div id="output"></div>

                <script>
                    async function sendPrompt() {
                        const prompt = document.getElementById('prompt').value;
                        const status = document.getElementById('status');
                        const output = document.getElementById('output');
                        if (!prompt.trim()) return;

                        status.innerText = 'חושב...';
                        try {
                            const response = await fetch('/prompt?prompt=' + encodeURIComponent(prompt));
                            const data = await response.json();
                            display(data);
                        } catch (e) {
                            status.innerText = 'שגיאה: ' + e.message;
                        }
                    }

                    async function uploadFile() {
                        const fileInput = document.getElementById('docxFile');
                        const status = document.getElementById('status');
                        if (fileInput.files.length === 0) return;

                        status.innerText = 'מעלה ומנתח קובץ...';
                        try {
                            const response = await fetch('/upload', {
                                method: 'POST',
                                body: fileInput.files[0]
                            });
                            const data = await response.json();
                            display(data);
                        } catch (e) {
                            status.innerText = 'שגיאה: ' + e.message;
                        }
                    }

                    function display(data) {
                        const status = document.getElementById('status');
                        const output = document.getElementById('output');
                        if (data.error) {
                            status.innerText = 'שגיאה: ' + data.error;
                        } else {
                            status.innerText = 'הושלם:';
                            output.style.display = 'block';
                            output.innerText = data.response;
                        }
                    }
                </script>
            </body>
            </html>
            """;
    }

    private void sendResponse(HttpExchange exchange, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(code, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }

    private void sendHtml(HttpExchange exchange, String html) throws IOException {
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
        exchange.sendResponseHeaders(200, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.getResponseBody().close();
    }
}