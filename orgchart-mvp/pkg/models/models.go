package models

import "time"

// Node representa un nodo en el organigrama dentro del archivo JSON.
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
	Rotation float64 `json:"rotation"`
}

// OrgChart es la estructura principal del archivo JSON.
type OrgChart struct {
	Company   string    `json:"company"`
	UpdatedAt time.Time `json:"updatedAt"`
	Nodes     []Node    `json:"nodes"`
}

// ExportNode es una estructura enriquecida para la plantilla HTML.
type ExportNode struct {
	Node
	Initials string
	Level    int
	Children []ExportNode
}