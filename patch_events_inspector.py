import re

with open("orgchart-mvp/web/events.js", "r") as f:
    content = f.read()

# Add handling for bgColor and bgOpacity
events_add = """
    if (input.dataset.nodeField === 'bgColor' || input.dataset.nodeField === 'bgOpacity') {
      updateNode(state.selectedNodeId, input.dataset.nodeField, input.value);
      renderCanvas();
      return;
    }
"""

content = content.replace(
    "if (!input.dataset.nodeField || !state.selectedNodeId) return;",
    "if (!input.dataset.nodeField || !state.selectedNodeId) return;\n" + events_add
)

with open("orgchart-mvp/web/events.js", "w") as f:
    f.write(content)
