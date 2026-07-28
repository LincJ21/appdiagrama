package export

import (
	"html/template"
	"os"
	"path/filepath"
	"strings"

	"orgchart-mvp/pkg/models"
)

// Exporter maneja la generación de archivos HTML.
type Exporter struct {
	exportPath string
	tpl        *template.Template
}

// NewExporter crea una nueva instancia de Exporter.
func NewExporter(exportPath string) *Exporter {
	tpl := template.Must(template.New("export").Funcs(template.FuncMap{
		"add": func(a, b float64) float64 { return a + b },
		"div": func(a, b float64) float64 { return a / b },
	}).Parse(htmlTemplate))
	return &Exporter{exportPath: exportPath, tpl: tpl}
}

// GenerateHTML crea el archivo HTML a partir de un organigrama.
func (e *Exporter) GenerateHTML(chart models.OrgChart) error {
	if err := os.MkdirAll(filepath.Dir(e.exportPath), 0755); err != nil {
		return err
	}

	f, err := os.Create(e.exportPath)
	if err != nil {
		return err
	}
	defer f.Close()

	nodeMap := make(map[string]models.Node)
	for _, node := range chart.Nodes {
		if node.Width == 0 {
			node.Width = 280
		}
		if node.Height == 0 {
			node.Height = 136
		}
		nodeMap[node.ID] = node
	}

	data := map[string]interface{}{
		"Company":   chart.Company,
		"UpdatedAt": chart.UpdatedAt,
		"Roots":     buildTree(chart.Nodes),
		"Nodes":     chart.Nodes,
		"NodeMap":   nodeMap,
		"Links":     chart.Links,
	}

	return e.tpl.Execute(f, data)
}

func buildTree(nodes []models.Node) []models.ExportNode {
	byParent := make(map[string][]models.Node)
	nodeIndex := make(map[string]models.Node)

	for _, node := range nodes {
		nodeIndex[node.ID] = node
		byParent[node.ParentID] = append(byParent[node.ParentID], node)
	}

	var walk func(models.Node, int) models.ExportNode
	walk = func(node models.Node, level int) models.ExportNode {
		if node.Width == 0 {
			node.Width = 280
		}
		if node.Height == 0 {
			node.Height = 136
		}
		exportNode := models.ExportNode{Node: node, Initials: initials(node.Name), Level: level}
		for _, child := range byParent[node.ID] {
			exportNode.Children = append(exportNode.Children, walk(child, level+1))
		}
		return exportNode
	}

	var roots []models.ExportNode
	for _, node := range nodes {
		if node.ParentID == "" {
			roots = append(roots, walk(node, 1))
			continue
		}
		if _, ok := nodeIndex[node.ParentID]; !ok {
			roots = append(roots, walk(node, 1))
		}
	}

	return roots
}

func initials(name string) string {
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) == 0 {
		return "ND"
	}
	if len(parts) == 1 {
		return strings.ToUpper(string([]rune(parts[0])[0]))
	}
	a := string([]rune(parts[0])[0])
	b := string([]rune(parts[1])[0])
	return strings.ToUpper(a + b)
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Organigrama exportado</title>
  <style>
    :root {
      --brand-900: #022D69; --brand-700: #004AAD; --brand-500: #2578CA; --brand-100: #C4DBFA;
      --gray-900: #111827; --gray-700: #374151; --gray-500: #6B7280; --gray-300: #D1D5DB; --gray-100: #F3F4F6; --white: #ffffff;
      --shadow: 0 10px 15px -3px rgba(0,0,0,.07), 0 4px 6px -2px rgba(0,0,0,.05);
      --shadow-lg: 0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04);
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: var(--gray-900); background: linear-gradient(180deg, #EEF4FC 0%, #F9FAFB 100%); }
    .page { padding: 28px; }
    .hero { padding: 22px 24px; border-radius: 26px; background: linear-gradient(135deg, var(--brand-900), var(--brand-700)); color: #fff; box-shadow: var(--shadow-lg); margin-bottom: 24px; }
    .hero h1 { margin: 0; font-size: 32px; }
    .hero p { margin: 8px 0 0; color: rgba(255,255,255,.85); }
    .board { position: relative; overflow: auto; padding: 22px; border-radius: 28px; background: var(--white); border: 1px solid var(--gray-300); box-shadow: var(--shadow-lg); }
    .connector-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible; z-index: 0; }
    .connector-layer .tree-link { stroke: #9ca3af; stroke-width: 2; fill: none; }
    .connector-layer .manual-link { stroke: #111827; stroke-width: 2.5; fill: none; stroke-linecap: round; }
    .node { border-radius: 22px; background: white; border: 1px solid var(--gray-300); box-shadow: var(--shadow); padding: 18px; position: absolute; z-index: 1; top: var(--y, 0); left: var(--x, 0); width: var(--w, 280px); min-height: var(--h, 136px); transform: rotate(var(--rotation, 0deg)); transform-origin: center center; }
    .node.root { color: #fff; background: linear-gradient(135deg, var(--brand-900), var(--brand-700)); }
    .node.root .title, .node.root .meta, .node.root .sub { color: rgba(255,255,255,.85); }
    .top { display: flex; gap: 14px; align-items: flex-start; }
    .avatar { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; font-weight: 700; background: var(--brand-100); color: var(--brand-700); flex-shrink: 0; }
    .node.root .avatar { background: rgba(255,255,255,.1); color: var(--white); }
    .name { margin: 0; font-size: 18px; font-weight: 800; }
    .title { margin-top: 6px; font-weight: 700; color: var(--brand-700); }
    .sub { margin-top: 4px; color: var(--gray-700); font-size: 13px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; font-size: 12px; color: var(--gray-700); }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>{{.Company}}</h1>
      <p>Actualizado: {{.UpdatedAt.Format "2006-01-02 15:04:05"}}</p>
    </section>
    <section class="board">
      <svg class="connector-layer">
        {{$nodeMap := .NodeMap}}
        {{range .Nodes}}
          {{$child := .}}
          {{if $child.ParentID}}
            {{with index $nodeMap $child.ParentID}}
              <line class="tree-link"
                x1="{{add .X (div .Width 2)}}" y1="{{add .Y .Height}}"
                x2="{{add $child.X (div $child.Width 2)}}" y2="{{$child.Y}}" />
            {{end}}
          {{end}}
        {{end}}
        {{range .Links}}
          {{$from := index $nodeMap .FromID}}
          {{$to := index $nodeMap .ToID}}
          <line class="manual-link"
            x1="{{add $from.X (div $from.Width 2)}}" y1="{{add $from.Y (div $from.Height 2)}}"
            x2="{{add $to.X (div $to.Width 2)}}" y2="{{add $to.Y (div $to.Height 2)}}" />
        {{end}}
      </svg>
      {{range .Roots}}{{template "node" .}}{{end}}
    </section>
  </div>
</body>
</html>
{{define "node"}}
<div class="node {{if eq .Level 1}}root{{end}}" style="--x: {{.X}}px; --y: {{.Y}}px; --w: {{.Width}}px; --h: {{.Height}}px; --rotation: {{.Rotation}}deg;">
  <div class="top">
    <div class="avatar">{{.Initials}}</div>
    <div>
      <div class="name">{{.Name}}</div>
      <div class="title">{{.Title}}</div>
      <div class="sub">{{.Area}}</div>
      <div class="meta">
        {{if .Email}}<span>{{.Email}}</span>{{end}}
        {{if .Phone}}<span>{{.Phone}}</span>{{end}}
      </div>
    </div>
  </div>
</div>
{{range .Children}}{{template "node" .}}{{end}}
{{end}}`