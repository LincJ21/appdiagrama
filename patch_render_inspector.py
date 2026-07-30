import re

with open("orgchart-mvp/web/render.js", "r") as f:
    content = f.read()

# Replace the "Diseño del Nodo" block with new shapes and background logic
new_design_block = """
      <label>
        <span>Color de Fondo y Opacidad</span>
        <div class="flex gap-2">
          <input
            type="color"
            value="${esc(node.bgColor || '#ffffff')}"
            data-node-field="bgColor"
            class="h-8 w-1/2 p-0 border-0 rounded cursor-pointer bg-transparent"
          >
          <select data-node-field="bgOpacity" class="w-1/2">
            <option value="1" ${(!node.bgOpacity || node.bgOpacity === '1') ? 'selected' : ''}>Sólido</option>
            <option value="0.75" ${node.bgOpacity === '0.75' ? 'selected' : ''}>Transparente (75%)</option>
            <option value="0.5" ${node.bgOpacity === '0.5' ? 'selected' : ''}>Cristal (50%)</option>
            <option value="0" ${node.bgOpacity === '0' ? 'selected' : ''}>Oculto (0%)</option>
          </select>
        </div>
      </label>

      <label>
        <span>Diseño del Nodo</span>
        <select data-node-field="style">
          <option value="classic" ${!node.style || node.style === 'classic' ? 'selected' : ''}>Rectángulo</option>
          <option value="circle" ${node.style === 'circle' ? 'selected' : ''}>Círculo</option>
          <option value="triangle" ${node.style === 'triangle' ? 'selected' : ''}>Triángulo</option>
          <option value="rhombus" ${node.style === 'rhombus' ? 'selected' : ''}>Rombo</option>
          <option value="hexagon" ${node.style === 'hexagon' ? 'selected' : ''}>Hexágono</option>
          <option value="default" ${node.style === 'default' ? 'selected' : ''}>Moderno</option>
          <option value="lined" ${node.style === 'lined' ? 'selected' : ''}>Clásico (Líneas)</option>
        </select>
      </label>
"""

content = re.sub(
    r'<label>\s*<span>Color de Fondo</span>.*?<select data-node-field="style">.*?<option value="lined"[^>]*>Clásico \(Líneas\)</option>\s*</select>\s*</label>',
    new_design_block.strip(),
    content,
    flags=re.DOTALL
)

with open("orgchart-mvp/web/render.js", "w") as f:
    f.write(content)
