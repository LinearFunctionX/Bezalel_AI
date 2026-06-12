package org.example;

import org.example.server.MyHttpServer;

public class Main {
    public static void main(String[] args) throws Exception {
        MyHttpServer server = new MyHttpServer(8080);
        server.start();
    }
}