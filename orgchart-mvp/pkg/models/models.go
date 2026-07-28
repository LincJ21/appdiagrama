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
	Width    float64 `json:"width"`
	Height   float64 `json:"height"`
	Rotation float64 `json:"rotation"`
}

// Link representa una conexión manual entre dos nodos (tipo "cable").
type Link struct {
	ID        string  `json:"id"`
	FromID    string  `json:"fromId"`
	ToID      string  `json:"toId"`
	Style     string  `json:"style"`     // "straight" | "cable"
	Color     string  `json:"color"`     // hex color, por defecto negro
	Thickness float64 `json:"thickness"` // grosor de la línea
}

// OrgChart es la estructura principal del archivo JSON.
type OrgChart struct {
	Company   string    `json:"company"`
	UpdatedAt time.Time `json:"updatedAt"`
	Nodes     []Node    `json:"nodes"`
	Links     []Link    `json:"links"`
}

// ExportNode es una estructura enriquecida para la plantilla HTML.
type ExportNode struct {
	Node
	Initials string
	Level    int
	Children []ExportNode
}