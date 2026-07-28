package server

import (
	"encoding/json"
	"log"
	"net/http"

	"orgchart-mvp/pkg/export"
	"orgchart-mvp/pkg/models"
	"orgchart-mvp/pkg/storage"
)

// Server contiene las dependencias y la configuración del servidor.
type Server struct {
	store    *storage.Store
	exporter *export.Exporter
	router   *http.ServeMux
}

// NewServer crea e inicializa una nueva instancia del servidor.
func NewServer(store *storage.Store, exporter *export.Exporter) *Server {
	srv := &Server{
		store:    store,
		exporter: exporter,
		router:   http.NewServeMux(),
	}
	srv.routes()
	return srv
}

// Run inicia el servidor HTTP en la dirección especificada.
func (s *Server) Run(addr string) error {
	return http.ListenAndServe(addr, s.cors(s.router))
}

// routes registra todas las rutas de la aplicación.
func (s *Server) routes() {
	s.router.Handle("/", http.FileServer(http.Dir("web")))
	s.router.HandleFunc("/api/orgchart", s.handleOrgChart())
	s.router.HandleFunc("/api/export/html", s.handleExportHTML())
}

func (s *Server) handleOrgChart() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			chart, err := s.store.Load()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			writeJSON(w, chart)

		case http.MethodPost:
			var chart models.OrgChart
			if err := json.NewDecoder(r.Body).Decode(&chart); err != nil {
				http.Error(w, "JSON inválido", http.StatusBadRequest)
				return
			}

			if err := s.store.Save(chart); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			// Recarga el organigrama para obtener la fecha de actualización correcta.
			updatedChart, err := s.store.Load()
			if err != nil {
				http.Error(w, "Error al recargar los datos después de guardar: "+err.Error(), http.StatusInternalServerError)
				return
			}


			if err = s.exporter.GenerateHTML(updatedChart); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			writeJSON(w, map[string]any{
				"ok":        true,
				"updatedAt": updatedChart.UpdatedAt,
				"htmlPath":  "exports/orgchart.html",
			})

		default:
			http.Error(w, "Método no permitido", http.StatusMethodNotAllowed)
		}
	}
}

func (s *Server) handleExportHTML() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		chart, err := s.store.Load()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if err := s.exporter.GenerateHTML(chart); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		writeJSON(w, map[string]any{"ok": true, "htmlPath": "exports/orgchart.html"})
	}
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("Error escribiendo respuesta JSON: %v", err)
	}
}