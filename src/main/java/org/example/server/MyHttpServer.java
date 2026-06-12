package org.example.server;

import com.sun.net.httpserver.HttpServer;
import org.example.handlers.GeminiHandler;
import org.example.handlers.PromptPageHandler;
import org.example.handlers.FileHandler;
import org.example.handlers.UrlHandler;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class MyHttpServer {

    private final int port;
    private HttpServer server;

    public MyHttpServer(int port) {
        this.port = port;
    }

    public void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        server.createContext("/prompt", new PromptPageHandler());
        server.createContext("/upload", new FileHandler());
        server.createContext("/fetch-url", new UrlHandler());
        server.createContext("/ask", exchange -> {
            if (exchange.getRequestMethod().equalsIgnoreCase("OPTIONS")) {
                exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
                exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
                exchange.sendResponseHeaders(204, -1);
                return;
            }
            new GeminiHandler().handle(exchange);
        });
        server.createContext("/health", exchange -> {
            String response = "{\"status\":\"ok\"}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.getResponseBody().close();
        });

        server.setExecutor(Executors.newFixedThreadPool(10));
        server.start();

        System.out.println("Server running on http://localhost:8080");
        System.out.println("Prompt page: http://localhost:8080/prompt");
    }

    public void stop() {
        if (server != null) server.stop(0);
    }
}