package export

import (
	"fmt"
	"html/template"
	"math"
	"os"
	"strconv"
	"path/filepath"
	"strings"
	"time"

	"orgchart-mvp/pkg/models"
)

type Exporter struct {
	exportPath string
	tpl        *template.Template
}

type templateNode struct {
	models.Node
	TextColor string
}

type exportView struct {
	Company   string
	UpdatedAt string
	Width     float64
	Height    float64
	Nodes     []templateNode
	Links     []exportLink
}

type exportLink struct {
	ID        string
	Color     string
	Thickness float64
	Path      string
}

func NewExporter(exportPath string) *Exporter {
	tpl := template.Must(template.New("export").Parse(htmlTemplate))
	return &Exporter{exportPath: exportPath, tpl: tpl}
}

func (e *Exporter) GenerateHTML(chart models.OrgChart) error {
	if err := os.MkdirAll(filepath.Dir(e.exportPath), 0o755); err != nil {
		return err
	}

	view := buildExportView(chart)

	f, err := os.Create(e.exportPath)
	if err != nil {
		return err
	}
	defer f.Close()

	return e.tpl.Execute(f, view)
}

func buildExportView(chart models.OrgChart) exportView {
	nodes := make([]models.Node, 0, len(chart.Nodes))
	nodeMap := make(map[string]models.Node, len(chart.Nodes))

	for _, n := range chart.Nodes {
		if n.Width <= 0 {
			n.Width = 308
		}
		if n.Height <= 0 {
			n.Height = 148
		}
		nodes = append(nodes, n)
		nodeMap[n.ID] = n
	}

	// Bounds iniciales con nodos
	minX, minY := math.Inf(1), math.Inf(1)
	maxX, maxY := math.Inf(-1), math.Inf(-1)
	if len(nodes) == 0 {
		minX, minY, maxX, maxY = 0, 0, 800, 600
	} else {
		for _, n := range nodes {
			minX = math.Min(minX, n.X)
			minY = math.Min(minY, n.Y)
			maxX = math.Max(maxX, n.X+n.Width)
			maxY = math.Max(maxY, n.Y+n.Height)
		}
	}

	// Incluir puntos de conectores en el bounds
	for _, l := range chart.Links {
		for _, p := range l.Points {
			minX = math.Min(minX, p.X)
			minY = math.Min(minY, p.Y)
			maxX = math.Max(maxX, p.X)
			maxY = math.Max(maxY, p.Y)
		}
	}

	const pad = 48.0
	minX -= pad
	minY -= pad
	maxX += pad
	maxY += pad

	width := math.Max(1, maxX-minX)
	height := math.Max(1, maxY-minY)

	// Desplazar nodos al origen
	shiftedNodes := make([]templateNode, 0, len(nodes))
	shiftedMap := make(map[string]models.Node, len(nodes))
	for _, n := range nodes {
		n.X -= minX
		n.Y -= minY

		tn := templateNode{Node: n}
		if n.Color != "" {
			// Lógica de contraste simple para el color del texto
			hex := strings.TrimPrefix(n.Color, "#")
			if len(hex) == 6 {
				r, _ := strconv.ParseInt(hex[0:2], 16, 0)
				g, _ := strconv.ParseInt(hex[2:4], 16, 0)
				b, _ := strconv.ParseInt(hex[4:6], 16, 0)
				yiq := ((float64(r) * 299) + (float64(g) * 587) + (float64(b) * 114)) / 1000
				if yiq < 128 {
					tn.TextColor = "#ffffff"
				} else {
					tn.TextColor = "#102033"
				}
			}
		}

		shiftedNodes = append(shiftedNodes, tn)
		shiftedMap[n.ID] = n
	}

	links := make([]exportLink, 0, len(chart.Links))

	// 1) Enlaces manuales con ruta real
	for _, l := range chart.Links {
		from, okF := shiftedMap[l.FromID]
		to, okT := shiftedMap[l.ToID]
		if !okF || !okT {
			continue
		}

		color := l.Color
		if color == "" {
			color = "#111827"
		}
		th := l.Thickness
		if th <= 0 {
			th = 2
		}

		// Desplazar points
		pts := make([]models.Point, 0, len(l.Points))
		for _, p := range l.Points {
			pts = append(pts, models.Point{X: p.X - minX, Y: p.Y - minY})
		}

		path := buildLinkPath(from, to, l.FromSide, l.ToSide, pts)
		links = append(links, exportLink{
			ID:        l.ID,
			Color:     color,
			Thickness: th,
			Path:      path,
		})
	}

	updated := chart.UpdatedAt
	if updated.IsZero() {
		updated = time.Now()
	}

	company := chart.Company
	if company == "" {
		company = "Organigrama"
	}

	return exportView{
		Company:   company,
		UpdatedAt: updated.Format("2006-01-02 15:04:05"),
		Width:     width,
		Height:    height,
		Nodes:     shiftedNodes,
		Links:     links,
	}
}

func portPoint(n models.Node, side string) models.Point {
	switch side {
	case "left":
		return models.Point{X: n.X, Y: n.Y + n.Height/2}
	case "right":
		return models.Point{X: n.X + n.Width, Y: n.Y + n.Height/2}
	case "top":
		return models.Point{X: n.X + n.Width/2, Y: n.Y}
	default: // bottom
		return models.Point{X: n.X + n.Width/2, Y: n.Y + n.Height}
	}
}

func autoSide(a, b models.Node) string {
	acx := a.X + a.Width/2
	acy := a.Y + a.Height/2
	bcx := b.X + b.Width/2
	bcy := b.Y + b.Height/2
	dx := bcx - acx
	dy := bcy - acy
	if math.Abs(dx) > math.Abs(dy) {
		if dx > 0 {
			return "right"
		}
		return "left"
	}
	if dy > 0 {
		return "bottom"
	}
	return "top"
}

func moveFromSide(p models.Point, side string, dist float64) models.Point {
	switch side {
	case "left":
		return models.Point{X: p.X - dist, Y: p.Y}
	case "right":
		return models.Point{X: p.X + dist, Y: p.Y}
	case "top":
		return models.Point{X: p.X, Y: p.Y - dist}
	default:
		return models.Point{X: p.X, Y: p.Y + dist}
	}
}

func defaultInterior(from, to models.Node, fromSide, toSide string) []models.Point {
	start := portPoint(from, fromSide)
	end := portPoint(to, toSide)
	const margin = 36.0
	stubStart := moveFromSide(start, fromSide, margin)
	stubEnd := moveFromSide(end, toSide, margin)

	horizontalFirst := fromSide == "left" || fromSide == "right"
	if horizontalFirst {
		midX := stubStart.X + (stubEnd.X-stubStart.X)/2
		return []models.Point{
			stubStart,
			{X: midX, Y: stubStart.Y},
			{X: midX, Y: stubEnd.Y},
			stubEnd,
		}
	}
	midY := stubStart.Y + (stubEnd.Y-stubStart.Y)/2
	return []models.Point{
		stubStart,
		{X: stubStart.X, Y: midY},
		{X: stubEnd.X, Y: midY},
		stubEnd,
	}
}

func buildLinkPath(from, to models.Node, fromSide, toSide string, interior []models.Point) string {
	if fromSide == "" {
		fromSide = autoSide(from, to)
	}
	if toSide == "" {
		toSide = autoSide(to, from)
	}

	start := portPoint(from, fromSide)
	end := portPoint(to, toSide)

	pts := interior
	if len(pts) == 0 {
		pts = defaultInterior(from, to, fromSide, toSide)
	}

	// full route: start + interior + end
	all := make([]models.Point, 0, len(pts)+2)
	all = append(all, start)
	all = append(all, pts...)
	all = append(all, end)

	var b strings.Builder
	for i, p := range all {
		if i == 0 {
			fmt.Fprintf(&b, "M %.2f %.2f", p.X, p.Y)
		} else {
			fmt.Fprintf(&b, " L %.2f %.2f", p.X, p.Y)
		}
	}
	return b.String()
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{.Company}} — Organigrama</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: #f5f7fb;
      color: #111827;
      padding: 24px;
    }
    .board-wrap {
      display: inline-block;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
      overflow: hidden;
    }
    .board {
      position: relative;
      width: {{printf "%.0f" .Width}}px;
      height: {{printf "%.0f" .Height}}px;
      background: #ffffff;
    }
    .connectors {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    }
    .node {
      position: absolute;      
      padding: 14px 16px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .node-style-default {
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 3px solid #dbe3f0;
      border-radius: 14px;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
    }
    .node-style-classic {
      border-radius: 4px;
      border: 3px solid #102033;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      background: #ffffff;
    }
    .node-style-lined {
      border-radius: 8px;
      border: 4px dashed #102033;
      box-shadow: none;
      background: #f8fbff;
    }
    .node-content { width: 100%; }
    .node-name { font-size: 1.4rem; margin-bottom: 4px; }
    @media print {
      body { background: #fff; padding: 0; }
      .board-wrap { border: none; box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="board-wrap">
    <div class="board">
      <svg class="connectors" viewBox="0 0 {{printf "%.0f" .Width}} {{printf "%.0f" .Height}}" xmlns="http://www.w3.org/2000/svg">
        {{range .Links}}
        <path d="{{.Path}}" fill="none" stroke="{{.Color}}" stroke-width="{{.Thickness}}" stroke-linecap="round" stroke-linejoin="round"/>
        {{end}}
      </svg>
      {{range .Nodes}}
      <div class="node node-style-{{if .Style}}{{.Style}}{{else}}classic{{end}}" style="left:{{printf "%.2f" .X}}px;top:{{printf "%.2f" .Y}}px;width:{{printf "%.2f" .Width}}px;min-height:{{printf "%.2f" .Height}}px;{{if .Color}}background-color:{{.Color}};color:{{.TextColor}};{{end}}">
        <div class="node-content" style="text-align: {{if .TextAlign}}{{.TextAlign}}{{else}}left{{end}};">
          <div class="node-name" style="color:{{if .TextColor}}{{.TextColor}}{{else}}#0f172a{{end}}; font-weight: {{if eq .FontWeight "bold"}}700{{else}}600{{end}}; font-style: {{if .FontStyle}}{{.FontStyle}}{{else}}normal{{end}}; text-decoration: {{if .TextDecoration}}{{.TextDecoration}}{{else}}none{{end}};">{{.Name}}</div>
        </div>
      </div>
      {{end}}
    </div>
  </div>
</body>
</html>
`