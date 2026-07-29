package main

import (
    "log"
    "net/http"

    "orgchart-mvp/pkg/export"
    "orgchart-mvp/pkg/server"
    "orgchart-mvp/pkg/storage"
)

func main() {
    store, err := storage.NewStore("data/orgchart.json")
    if err != nil {
        log.Fatalf("error al inicializar el almacenamiento: %v", err)
    }

    htmlExporter := export.NewExporter("exports/orgchart.html")

    if err := store.EnsureSeedData(htmlExporter); err != nil {
        log.Fatalf("error al crear datos de prueba: %v", err)
    }

    srv := server.NewServer(store, htmlExporter)
    log.Println("Servidor escuchando en http://localhost:8081")
    log.Fatal(http.ListenAndServe(":8081", srv.Handler()))
}
