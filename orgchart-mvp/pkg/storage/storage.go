package storage

import (
    "encoding/json"
    "os"
    "path/filepath"
    "sync"
    "time"

    "orgchart-mvp/pkg/export"
    "orgchart-mvp/pkg/models"
)

type Store struct {
    dataFile string
    mu       sync.Mutex
}

func NewStore(dataFile string) (*Store, error) {
    if err := os.MkdirAll(filepath.Dir(dataFile), 0o755); err != nil {
        return nil, err
    }
    return &Store{dataFile: dataFile}, nil
}

func (s *Store) Load() (models.OrgChart, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    var chart models.OrgChart
    b, err := os.ReadFile(s.dataFile)
    if err != nil {
        if os.IsNotExist(err) {
            return models.OrgChart{}, nil
        }
        return models.OrgChart{}, err
    }
    if len(b) == 0 {
        return models.OrgChart{}, nil
    }
    err = json.Unmarshal(b, &chart)
    return chart, err
}

func (s *Store) Save(chart models.OrgChart) error {
    s.mu.Lock()
    defer s.mu.Unlock()

    chart.UpdatedAt = time.Now()
    b, err := json.MarshalIndent(chart, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(s.dataFile, b, 0o644)
}

func (s *Store) EnsureSeedData(exporter *export.Exporter) error {
    if _, err := os.Stat(s.dataFile); err == nil {
        return nil
    }

    sample := models.OrgChart{
        Company:   "Empresa Demo S.A.S.",
        UpdatedAt: time.Now(),
        Nodes: []models.Node{
            {ID: "1", ParentID: "", Name: "Laura Gómez", Title: "Gerente General", Area: "Dirección", Email: "laura@empresa.com", Phone: "+57 300000001", X: 400, Y: 50, Width: 308, Height: 148},
            {ID: "2", ParentID: "1", Name: "Carlos Ruiz", Title: "Director Financiero", Area: "Finanzas", Email: "carlos@empresa.com", Phone: "+57 300000002", X: 100, Y: 250, Width: 308, Height: 148},
            {ID: "3", ParentID: "1", Name: "Ana Pérez", Title: "Directora de Tecnología", Area: "TI", Email: "ana@empresa.com", Phone: "+57 300000003", X: 400, Y: 250, Width: 308, Height: 148},
            {ID: "4", ParentID: "1", Name: "Miguel Torres", Title: "Director Comercial", Area: "Ventas", Email: "miguel@empresa.com", Phone: "+57 300000004", X: 700, Y: 250, Width: 308, Height: 148},
        },
        Links: []models.Link{},
    }

    if err := s.Save(sample); err != nil {
        return err
    }
    return exporter.GenerateHTML(sample)
}
