import React, { useState, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

const TemplateEditor = () => {
  const [mode, setMode] = useState('admin');
  const [templates, setTemplates] = useState([]);
  const [newTemplateText, setNewTemplateText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editableFields, setEditableFields] = useState({});
  const editorRef = useRef(null);

  const insertVariable = () => {
    const variableName = prompt('Enter variable name:');
    if (variableName && editorRef.current) {
      const variable = `{{${variableName}}}`;
      editorRef.current.execCommand('mceInsertContent', false, variable);
    }
  };

  const extractVariables = (text) => {
    const regex = /\{\{(.*?)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const fields = {};
    matches.forEach(match => {
      fields[match[1]] = '';
    });
    return fields;
  };

  const createTemplate = () => {
    const fields = extractVariables(newTemplateText);
    const newTemplate = {
      id: Date.now(),
      text: newTemplateText,
      fields
    };
    setTemplates([...templates, newTemplate]);
    setNewTemplateText('');
  };

  const processTemplate = (template) => {
    if (!template) return '';
    let processedText = template.text;
    Object.entries(editableFields).forEach(([field, value]) => {
      const regex = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
      processedText = processedText.replace(regex, value || `{{${field}}}`);
    });
    return processedText;
  };

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setSelectedTemplateId(templateId);
      const initialFields = {};
      Object.keys(template.fields).forEach(field => {
        initialFields[field] = editableFields[field] || '';
      });
      setEditableFields(initialFields);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditableFields(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getHeadingSize = (level) => {
    // Font sizes in half-points (1/2 pt)
    switch (level) {
      case 1: return 48; // 24pt
      case 2: return 36; // 18pt
      case 3: return 32; // 16pt
      case 4: return 28; // 14pt
      case 5: return 26; // 13pt
      case 6: return 24; // 12pt
      default: return 24; // 12pt (default)
    }
  };

  const parseHTML = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return convertNodesToDocxParagraphs(doc.body);
  };

  const convertNodesToDocxParagraphs = (parentNode) => {
    const paragraphs = [];
    let currentRuns = [];

    const processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          let style = { text, size: 24 }; // Default size

          let parent = node.parentElement;
          while (parent) {
            if (parent.tagName === 'STRONG' || parent.tagName === 'B') style.bold = true;
            if (parent.tagName === 'EM' || parent.tagName === 'I') style.italics = true;
            if (parent.tagName === 'U') style.underline = true;

            // Set size based on heading level
            if (parent.tagName?.match(/^H[1-6]$/)) {
              const level = parseInt(parent.tagName[1]);
              style.size = getHeadingSize(level);
              style.bold = true; // Make headings bold by default
            }

            parent = parent.parentElement;
          }

          currentRuns.push(new TextRun(style));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case 'p':
          case 'div':
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            Array.from(node.childNodes).forEach(processNode);
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            break;

          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6': {
            const level = parseInt(node.tagName[1]);
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            Array.from(node.childNodes).forEach(processNode);
            if (currentRuns.length > 0) {
              paragraphs.push(
                new Paragraph({
                  children: currentRuns,
                  heading: HeadingLevel[`HEADING_${level}`],
                  spacing: {
                    before: 240, // Add some spacing before headings (20pt)
                    after: 120   // Add some spacing after headings (10pt)
                  }
                })
              );
              currentRuns = [];
            }
            break;
          }
          default:
            Array.from(node.childNodes).forEach(processNode);
        }
      }
    };

    processNode(parentNode);

    if (currentRuns.length > 0) {
      paragraphs.push(new Paragraph({ children: currentRuns }));
    }

    return paragraphs;
  };

  const downloadAsWord = async () => {
    const template = templates.find(t => t.id === parseInt(selectedTemplateId));
    if (!template) return;

    const processedText = processTemplate(template);
    const paragraphs = parseHTML(processedText);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.docx';
    a.click();
    URL.revokeObjectURL(url);
  };

return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex gap-4 mb-6">
        <button 
          className={`px-4 py-2 rounded ${mode === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('admin')}
        >
          Admin Mode
        </button>
        <button 
          className={`px-4 py-2 rounded ${mode === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setMode('user')}
        >
          User Mode
        </button>
      </div>

      {mode === 'admin' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Admin Mode</h2>
          <div className="border rounded">
            <Editor
              onInit={(evt, editor) => editorRef.current = editor}
              apiKey='0aqfwn57ig438bbfpsi692d5sol53dnozld591jt2aakew1r'
              value={newTemplateText}
              onEditorChange={(content) => setNewTemplateText(content)}
              init={{
                height: 400,
                menubar: true,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | formatselect | ' +
                  'bold italic backcolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | insertVariable',
                setup: (editor) => {
                  editor.ui.registry.addButton('insertVariable', {
                    text: 'Insert Variable',
                    onAction: insertVariable
                  });
                },
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
              }}
            />
          </div>
          <button 
            className="px-4 py-2 bg-green-600 text-white rounded"
            onClick={createTemplate}
          >
            Create Template
          </button>

          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4">Created Templates:</h3>
            <div className="space-y-4">
              {templates.map(template => (
                <div key={template.id} className="p-4 border rounded">
                  <div dangerouslySetInnerHTML={{ __html: template.text }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'user' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">User Mode</h2>

          <select
            className="border p-2 rounded w-full"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
          >
            <option value="">Select a Template</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                {template.text.replace(/<[^>]+>/g, '').slice(0, 30)}...
              </option>
            ))}
          </select>

          {selectedTemplateId && (
            <div className="space-y-6">
              <div className="p-4 border rounded bg-gray-50">
                <h3 className="text-lg font-bold mb-4">Editable Fields</h3>
                <div className="space-y-4">
                  {Object.keys(editableFields).map(field => (
                    <div key={field} className="mb-4">
                      <label className="block font-medium mb-2">{field}</label>
                      <input
                        className="border p-2 rounded w-full"
                        value={editableFields[field]}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Preview</h3>
                  <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                    onClick={downloadAsWord}
                  >
                    Download as Word
                  </button>
                </div>
                <div className="prose max-w-none">
                  <div 
                    className="p-4 bg-white border rounded"
                    dangerouslySetInnerHTML={{ 
                      __html: processTemplate(templates.find(t => t.id === parseInt(selectedTemplateId))) 
                    }} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateEditor;
