package server

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"orgchart-mvp/pkg/export"
	"orgchart-mvp/pkg/models"
	"orgchart-mvp/pkg/storage"
)

// Server encapsula las dependencias del servidor HTTP.
type Server struct {
	store    *storage.Store
	exporter *export.Exporter
	mux      *http.ServeMux
}

// New crea una nueva instancia del servidor.
func NewServer(store *storage.Store, exporter *export.Exporter) *Server {
	s := &Server{
		store:    store,
		exporter: exporter,
		mux:      http.NewServeMux(),
	}
	s.routes()
	return s
}

// Handler expone el router HTTP.
func (s *Server) Handler() http.Handler {
	return s.withCORS(s.mux)
}

func (s *Server) routes() {
	s.mux.HandleFunc("/api/orgchart", s.handleOrgChart)
	s.mux.HandleFunc("/api/export/html", s.handleExportHTML)
	s.mux.Handle("/", http.FileServer(http.Dir("./web")))
}

func (s *Server) withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleOrgChart(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.getOrgChart(w, r)
	case http.MethodPost:
		s.saveOrgChart(w, r)
	default:
		http.Error(w, "método no permitido", http.StatusMethodNotAllowed)
	}
}

func (s *Server) getOrgChart(w http.ResponseWriter, r *http.Request) {
	chart, err := s.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(chart)
}

func (s *Server) saveOrgChart(w http.ResponseWriter, r *http.Request) {
	var chart models.OrgChart
	if err := json.NewDecoder(r.Body).Decode(&chart); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if err := s.store.Save(chart); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := s.exporter.GenerateHTML(chart); err != nil {
		log.Printf("advertencia: no se pudo regenerar HTML: %v", err)
	}

	saved, err := s.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(saved)
}

func (s *Server) handleExportHTML(w http.ResponseWriter, r *http.Request) {
	chart, err := s.store.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := s.exporter.GenerateHTML(chart); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":    "ok",
		"updatedAt": time.Now().Format(time.RFC3339),
	})
}

