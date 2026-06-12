package org.example.gemini;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.FileInputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.Properties;

public class GeminiClient {

    private String apiKey;
    private String url;
    private String model;
    private final HttpClient client;

    public GeminiClient() {
        loadConfig();
        this.client = HttpClient.newHttpClient();
    }

    private void loadConfig() {
        Properties props = new Properties();
        try {
            try (InputStream input = new FileInputStream("application.properties")) {
                props.load(input);
            } catch (Exception e) {
                try (InputStream input = getClass().getClassLoader().getResourceAsStream("application.properties")) {
                    if (input != null) props.load(input);
                }
            }
            this.apiKey = props.getProperty("gemini.api.key", "").trim();
            this.model = props.getProperty("gemini.model", "models/gemini-2.5-flash-lite").trim();
            String baseUrl = props.getProperty("gemini.url", "https://generativelanguage.googleapis.com/v1beta/").trim();
            
            if (!baseUrl.endsWith("/")) baseUrl += "/";
            this.url = baseUrl + model + ":generateContent?key=" + apiKey;
        } catch (Exception ex) {
            System.err.println("Error loading config: " + ex.getMessage());
        }
    }

    public String ask(String prompt) throws Exception {
        return askWithImages(prompt, null);
    }

    public String askWithImages(String prompt, java.util.List<String> base64Images) throws Exception {
        int maxRetries = 5;
        long delay = 3000; 
        Exception lastEx = null;

        for (int i = 0; i < maxRetries; i++) {
            try {
                return executeRequest(prompt, base64Images);
            } catch (RuntimeException e) {
                String msg = e.getMessage().toLowerCase();
                if (msg.contains("high demand") || msg.contains("quota") || msg.contains("rate limit") || msg.contains("429") || msg.contains("busy")) {
                    System.out.println("Gemini busy. Retrying in " + (delay/1000) + "s... (Attempt " + (i + 1) + ")");
                    Thread.sleep(delay);
                    delay *= 2;
                    lastEx = e;
                    continue;
                }
                throw e;
            }
        }
        throw lastEx;
    }

    private String executeRequest(String prompt, java.util.List<String> base64Images) throws Exception {
        JsonObject content = new JsonObject();
        JsonArray parts = new JsonArray();

        JsonObject textPart = new JsonObject();
        textPart.addProperty("text", prompt);
        parts.add(textPart);

        if (base64Images != null) {
            for (String b64 : base64Images) {
                if (b64.contains(",")) b64 = b64.split(",")[1];
                JsonObject imgPart = new JsonObject();
                JsonObject inlineData = new JsonObject();
                inlineData.addProperty("mime_type", "image/png");
                inlineData.addProperty("data", b64);
                imgPart.add("inline_data", inlineData);
                parts.add(imgPart);
            }
        }

        content.add("parts", parts);
        JsonArray contents = new JsonArray();
        contents.add(content);
        JsonObject requestBody = new JsonObject();
        requestBody.add("contents", contents);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody.toString(), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        return parseResponse(response.body());
    }

    private String parseResponse(String responseBody) {
        JsonObject json = JsonParser.parseString(responseBody).getAsJsonObject();
        if (json.has("error")) {
            throw new RuntimeException("Gemini API: " + json.getAsJsonObject("error").get("message").getAsString());
        }
        try {
            return json.getAsJsonArray("candidates")
                    .get(0).getAsJsonObject()
                    .getAsJsonObject("content")
                    .getAsJsonArray("parts")
                    .get(0).getAsJsonObject()
                    .get("text").getAsString();
        } catch (Exception e) {
            return "No text response. Body: " + responseBody;
        }
    }
}