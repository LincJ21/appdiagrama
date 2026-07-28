package main

import (
	"log"

	"orgchart-mvp/pkg/export"
	"orgchart-mvp/pkg/server"
	"orgchart-mvp/pkg/storage"
)

func main() {
	// Inicializa el componente de almacenamiento
	store, err := storage.NewStore("data/orgchart.json")
	if err != nil {
		log.Fatalf("Error al inicializar el almacenamiento: %v", err)
	}

	// Inicializa el componente de exportación
	htmlExporter := export.NewExporter("exports/orgchart.html")

	// Asegura que existan datos iniciales si la base de datos está vacía
	if err := store.EnsureSeedData(htmlExporter); err != nil {
		log.Fatalf("Error al crear datos de prueba: %v", err)
	}

	// Crea y ejecuta el servidor, inyectando las dependencias
	srv := server.NewServer(store, htmlExporter)
	log.Println("Servidor en http://localhost:8081")
	log.Fatal(srv.Run(":8081"))
}