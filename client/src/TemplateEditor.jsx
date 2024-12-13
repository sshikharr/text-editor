import React, { useState, useRef,useEffect} from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
// import 

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

  //partially editable 

  const insertPartiallyEditable = () => {
    const content = prompt('Enter content for partially editable section:');
    if (content && editorRef.current) {
      const partiallyEditable = `[[${content}]]`;
      editorRef.current.execCommand('mceInsertContent', false, partiallyEditable);
    }
  };
  

  // Extract variables using the new format
  const extractVariablesEditable = (text) => {
    const regex = /\{\{(.*?)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const fields = {};
    matches.forEach(match => {
      fields[match[1]] = '';
    });
    return fields;
  };

  
  const createTemplate = () => {
    const fields = extractVariablesEditable(newTemplateText);
    const newTemplate = {
      id: Date.now(),
      text: newTemplateText,
      fields
    };
    setTemplates([...templates, newTemplate]);
    setNewTemplateText('');
  };

  
    
    const extractPartiallyEditableFields = (text) => {
      const regex = /\[\[(.*?)\]\]/g;
      const matches = [...text.matchAll(regex)];
      const fields = {};
      matches.forEach(match => {
        fields[match[1]] = match[1]; // Initialize with the same value as the placeholder
      });
      return fields;
    };

    const processTemplate = (template) => {
      if (!template) return '';
      let processedText = template.text;
    
      // Replace fully editable fields
      Object.entries(editableFields).forEach(([field, value]) => {
        const regex = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
        processedText = processedText.replace(regex, value || `{{${field}}}`);
      });
    
      // Replace partially editable fields with contenteditable spans
      Object.entries(editableFields).forEach(([field, value]) => {
        const regex = new RegExp(`\\[\\[${field}\\]\\]`, 'g');
        processedText = processedText.replace(
          regex,
          `<span contenteditable="true" data-field="${field}" class="partially-editable">${value}</span>`
        );
      });
    
      return processedText;
    };
    
    const handleEditableContentChange = (e) => {
      const field = e.target.getAttribute('data-field');
      if (field) {
        const value = e.target.innerText;
        setEditableFields((prev) => ({
          ...prev,
          [field]: value,
        }));
      }
    };
    
    useEffect(() => {
      const container = document.querySelector('.preview-container');
      if (container) {
        container.addEventListener('input', handleEditableContentChange);
      }
    
      return () => {
        if (container) {
          container.removeEventListener('input', handleEditableContentChange);
        }
      };
    }, []);
    
    

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setSelectedTemplateId(templateId);
  
      const initialEditableFields = { ...template.fields };
      const partiallyEditableFields = extractPartiallyEditableFields(template.text);
  
      // Merge both editable and partially editable fields
      setEditableFields({
        ...initialEditableFields,
        ...partiallyEditableFields,
      });
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
  
    // Strip HTML tags and clean up partially editable placeholders
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processedText;
    const plainText = tempDiv.textContent || tempDiv.innerText;
  
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: plainText, size: 24 })],
            }),
          ],
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
  //parsing the
  const parseHtmlToDocx = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
  
    const parseNode = (node) => {
      const children = [];
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          children.push(new TextRun({ text: child.textContent }));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const style = {};
          if (child.tagName === 'B' || child.tagName === 'STRONG') {
            style.bold = true;
          }
          if (child.tagName === 'I' || child.tagName === 'EM') {
            style.italic = true;
          }
          if (child.tagName === 'U') {
            style.underline = {};
          }
          if (child.tagName === 'BR') {
            children.push(new TextRun({ text: '\n' }));
            return;
          }
          const childNodes = parseNode(child);
          children.push(...childNodes.map((ch) => new TextRun({ ...style, ...ch })));
        }
      });
      return children;
    };
  
    return tempDiv.childNodes.length
      ? tempDiv.childNodes.flatMap(parseNode)
      : [new TextRun({ text: '' })];
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
                setup: (editor) => {
                  editor.ui.registry.addButton('insertVariable', {
                    text: 'Insert Variable',
                    onAction: insertVariable,
                  });
                  editor.ui.registry.addButton('insertPartiallyEditable', {
                    text: 'Partially Editable',
                    onAction: insertPartiallyEditable,
                  });
                },
                toolbar: 'undo redo | formatselect | bold italic backcolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | removeformat | insertVariable insertPartiallyEditable',                
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


<div className="border rounded p-4 preview-container">
  <h3 className="text-lg font-bold mb-4">Preview:</h3>
  <div
    dangerouslySetInnerHTML={{
      __html: processTemplate(templates.find((t) => t.id === parseInt(selectedTemplateId))),
    }}
  />
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

export default TemplateEditor;

