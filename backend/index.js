// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory storage (replace with database in production)
const templates = new Map();

// Save template
app.post('/api/templates', (req, res) => {
  const { content, editableFields } = req.body;
  const templateId = Date.now().toString();
  
  templates.set(templateId, {
    content,
    editableFields,
    createdAt: new Date()
  });
  
  res.json({ templateId });
});

// Get template
app.get('/api/templates/:id', (req, res) => {
  const template = templates.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

// List templates
app.get('/api/templates', (req, res) => {
  const templateList = Array.from(templates.entries()).map(([id, template]) => ({
    id,
    createdAt: template.createdAt
  }));
  res.json(templateList);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});