import re

with open("orgchart-mvp/web/events.js", "r") as f:
    content = f.read()

# Make sure 'change' event also works for selects (which it didn't in the original code fully, it was relying on input but skipping SELECT)
content = content.replace(
    "if (input.type === 'color' || input.tagName === 'SELECT') return;",
    "if (input.type === 'color' && e.type === 'input') return; // wait for change\n    if (input.tagName === 'SELECT' && e.type === 'input') return; // wait for change"
)

with open("orgchart-mvp/web/events.js", "w") as f:
    f.write(content)
