package models

import "time"

// Point es un punto de la ruta de un conector.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Node representa un nodo en el organigrama.
type Node struct {
	ID       string  `json:"id"`
	ParentID string  `json:"parentId"`
	Name     string  `json:"name"`
	Title    string  `json:"title"`
	Area     string  `json:"area"`
	Email    string  `json:"email"`
	Phone    string  `json:"phone"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
	Rotation float64 `json:"rotation"`
	Collapsed bool   `json:"collapsed"`
	Style     string `json:"style"`
	Color     string `json:"color,omitempty"`
}

// Link representa una conexión entre dos nodos (ruta editable).
type Link struct {
	ID         string  `json:"id"`
	FromID     string  `json:"fromId"`
	ToID       string  `json:"toId"`
	Style      string  `json:"style"`
	Color      string  `json:"color"`
	Thickness  float64 `json:"thickness"`
	Points     []Point `json:"points"`
	FromSide   string  `json:"fromSide"`
	ToSide     string  `json:"toSide"`
	FromOffset float64 `json:"fromOffset"`
	ToOffset   float64 `json:"toOffset"`
	Manual     bool    `json:"manual"`
}

// OrgChart es la estructura principal del archivo JSON.
type OrgChart struct {
	Company   string    `json:"company"`
	UpdatedAt time.Time `json:"updatedAt"`
	Nodes     []Node    `json:"nodes"`
	Links     []Link    `json:"links"`
}

// ExportNode es una estructura enriquecida para plantillas.
type ExportNode struct {
	Node
	Initials string
	Level    int
	Children []ExportNode
}