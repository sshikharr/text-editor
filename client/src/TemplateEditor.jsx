import React, { useState, useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const TemplateEditor = () => {
  const [mode, setMode] = useState('admin');
  const [templates, setTemplates] = useState([]);
  const [newTemplateText, setNewTemplateText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editableFields, setEditableFields] = useState({});
  const editorRef = useRef(null);

  // Custom format for variables using {{variable}}
  const insertVariable = () => {
    const variableName = prompt('Enter variable name:');
    if (variableName && editorRef.current) {
      const variable = `{{${variableName}}}`;
      editorRef.current.execCommand('mceInsertContent', false, variable);
    }
  };

  // Extract variables using the new format
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
      // Initialize fields with empty values if not already set
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

  const downloadAsWord = async () => {
    const template = templates.find(t => t.id === parseInt(selectedTemplateId));
    if (!template) return;

    const processedText = processTemplate(template);

    // Strip HTML tags for Word document
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedText;
    const plainText = tempDiv.textContent || tempDiv.innerText;

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: plainText,
                size: 24,
              }),
            ],
          }),
        ],
      }],
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
            className="w-full p-2 border rounded"
            value={selectedTemplateId} 
            onChange={(e) => handleTemplateSelect(e.target.value)}
          >
            <option value="">Select a template</option>
            {templates.map(template => (
              <option key={template.id} value={template.id}>
                Template {template.id}
              </option>
            ))}
          </select>

          {selectedTemplateId && (
            <div className="space-y-6">
              <div className="grid gap-4">
                {Object.entries(editableFields).map(([field, value]) => (
                  <div key={field} className="flex items-center gap-4">
                    <label className="min-w-[120px] font-medium">{field}:</label>
                    <input
                      className="flex-1 p-2 border rounded"
                      value={value}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="border rounded p-4">
                <h3 className="text-lg font-bold mb-4">Preview:</h3>
                <div dangerouslySetInnerHTML={{ 
                  __html: processTemplate(templates.find(t => t.id === parseInt(selectedTemplateId))) 
                }} />
              </div>

              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={downloadAsWord}
              >
                Download as Word
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateEditor