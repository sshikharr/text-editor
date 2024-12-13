import React, { useState, useRef, useEffect } from "react";
import { Editor } from "@tinymce/tinymce-react";
import html2pdf from 'html2pdf.js';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Numbering
} from "docx";


const TemplateEditor = () => {
  const [mode, setMode] = useState("admin");
  const [templates, setTemplates] = useState([]);
  const [processedTemplateText, setProcessedTemplateText] = useState("");
  const [newTemplateText, setNewTemplateText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");  
  const [editableFields, setEditableFields] = useState({});
  const editorRef = useRef(null);
  const previewRef = useRef(null);

  const insertVariable = () => {
    const variableName = prompt("Enter variable name:");
    if (variableName && editorRef.current) {
      const variable = `{{${variableName}}}`;
      editorRef.current.execCommand("mceInsertContent", false, variable);
    }
  };

  //partially editable

  const insertPartiallyEditable = () => {
    const content = prompt("Enter content for partially editable section:");
    if (content && editorRef.current) {
      const partiallyEditable = `[[${content}]]`;
      editorRef.current.execCommand(
        "mceInsertContent",
        false,
        partiallyEditable
      );
    }
  };

  const extractVariables = (text) => {
    const regex = /\{\{(.*?)\}\}/g;
    const matches = [...text.matchAll(regex)];
    const fields = {};
    matches.forEach((match) => {
      fields[match[1]] = "";
    });
    return fields;
  };

  const extractPartiallyEditableFields = (text) => {
    const regex = /\[\[(.*?)\]\]/g;
    const matches = [...text.matchAll(regex)];
    const fields = {};
    matches.forEach((match) => {
      fields[match[1]] = match[1];
    });
    return fields;
  };

  const createTemplate = () => {
    if (!newTemplateName) {
      alert("Please provide a name for the template.");
      return;
    }
    
    const fields = extractVariables(newTemplateText);
    const newTemplate = {
      id: Date.now(),
      name: newTemplateName,  // Store the name here
      text: newTemplateText,
      fields,
    };
    setTemplates([...templates, newTemplate]);
    setNewTemplateText("");
    setNewTemplateName("");
  }

  const processTemplate = (template) => {
    if (!template) return "";
    let processedText = template.text;
  
    // Replace fully editable fields
    Object.entries(editableFields).forEach(([field, value]) => {
      const regex = new RegExp(`\\{\\{${field}\\}\\}`, "g");
      processedText = processedText.replace(regex, value || `{{${field}}}`);
    });
  
    // Replace partially editable fields with contenteditable span tags
    Object.entries(editableFields).forEach(([field, value]) => {
      const regex = new RegExp(`\\[\\[${field}\\]\\]`, "g");
      processedText = processedText.replace(
        regex,
        `<span class="partially-editable" data-field="${field}">${value || field}</span>`
      );
    });
  
    // Wrap the entire processed text in a div with black background only if it's not already wrapped
    if (!processedText.startsWith('<div style="background-color:white; color:black; padding:10px;">')) {
      processedText = `<div style="background-color:white; color:black; padding:10px;">${processedText}</div>`;
    }
  
    return processedText;
  };

  useEffect(() => {
    const container = previewRef.current;
    if (container) {
      const handleEditableContentChange = (e) => {
        if (e.target.classList.contains('partially-editable')) {
          const field = e.target.getAttribute('data-field');
          const value = e.target.innerText;
          
          // Update editableFields state
          setEditableFields((prev) => ({
            ...prev,
            [field]: value,
          }));
        }
      };
  
      // Adding event listener for input event
      container.addEventListener('input', handleEditableContentChange, true);
  
      return () => {
        container.removeEventListener('input', handleEditableContentChange, true);
      };
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    console.log("templates",templates);
    console.log("newTemplateText",newTemplateText);
    console.log("selectedTemplateId",selectedTemplateId);
    console.log("editableFields",editableFields);
    console.log("processedTemplateText",processedTemplateText);
    
    // console.log("templates",templates);
  }, [newTemplateText])
  const makePartiallyEditableFieldsEditable = () => {
    if (editorRef.current) {
      editorRef.current.getBody().querySelectorAll('.partially-editable').forEach((el) => {
        el.setAttribute('contenteditable', 'true');
      });
    }
  };

  const handleTemplateSelect = (templateId) => {
    const template = templates.find((t) => t.id === parseInt(templateId));
    if (template) {
      setSelectedTemplateId(templateId);

      const initialEditableFields = { ...template.fields };
      const partiallyEditableFields = extractPartiallyEditableFields(
        template.text
      );

      // Merge both editable and partially editable fields
      setEditableFields({
        ...initialEditableFields,
        ...partiallyEditableFields,
      });
      makePartiallyEditableFieldsEditable();

    }
  };

  const handleFieldChange = (field, value) => {
    setEditableFields((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getHeadingSize = (level) => {
    // Font sizes in half-points (1/2 pt)
    switch (level) {
      case 1:
        return 48; // 24pt
      case 2:
        return 36; // 18pt
      case 3:
        return 32; // 16pt
      case 4:
        return 28; // 14pt
      case 5:
        return 26; // 13pt
      case 6:
        return 24; // 12pt
      default:
        return 24; // 12pt (default)
    }
  };

  

  const convertNodesToDocxParagraphs = (parentNode) => {
    const paragraphs = [];
    let currentRuns = [];
    let currentListType = null;
    let currentListLevel = 0;
  
    const convertPixelToHalfPoint = (pixelSize) => {
      // Convert pixel size to half points
      // Assume 1px = 0.75 points, so 1px = 1.5 half-points
      return Math.round(parseFloat(pixelSize) * 1.5);
    };
  
    const processNode = (node, listContext = null) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          let style = {
            text,
            size: 24, // Default size (12pt)
            color: "000000",
          };
  
          let parent = node.parentElement;
          while (parent) {
            // Text styling
            if (parent.tagName === "STRONG" || parent.tagName === "B")
              style.bold = true;
            if (parent.tagName === "EM" || parent.tagName === "I")
              style.italics = true;
            if (parent.tagName === "U") 
              style.underline = true;
  
            // Headings
            if (parent.tagName?.match(/^H[1-6]$/)) {
              const level = parseInt(parent.tagName[1]);
              style.size = getHeadingSize(level);
              style.bold = true;
            }
  
            // Inline font size
            if (parent.style && parent.style.fontSize) {
              const pixelSize = parent.style.fontSize;
              // Convert pixel size to half points
              const halfPointSize = convertPixelToHalfPoint(pixelSize);
              style.size = halfPointSize;
            }
  
            // Font family
            if (parent.style && parent.style.fontFamily) {
              style.font = parent.style.fontFamily;
            }
  
            parent = parent.parentElement;
          }
  
          currentRuns.push(new TextRun(style));
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        switch (node.tagName.toLowerCase()) {
          case "br":
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            break;
  
          case "p":
          case "div":
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            Array.from(node.childNodes).forEach(child => processNode(child));
            if (currentRuns.length > 0) {
              paragraphs.push(new Paragraph({ children: currentRuns }));
              currentRuns = [];
            }
            break;
  
          case "ul":
          case "ol": {
            const isBulletList = node.tagName.toLowerCase() === "ul";
            const listLevel = listContext ? listContext.level + 1 : 0;
  
            Array.from(node.children).forEach((li, index) => {
              // Reset runs for each list item
              currentRuns = [];
  
              // Process list item contents
              Array.from(li.childNodes).forEach(child => 
                processNode(child, { 
                  type: isBulletList ? 'bullet' : 'numbering', 
                  level: listLevel 
                })
              );
  
              // Create paragraph with list formatting
              if (currentRuns.length > 0) {
                const paragraphOptions = isBulletList 
                  ? { 
                      children: currentRuns,
                      bullet: {
                        level: listLevel
                      }
                    }
                  : { 
                      children: currentRuns,
                      numbering: {
                        level: listLevel,
                        reference: `list-${listLevel}-${index}`
                      }
                    };
  
                paragraphs.push(new Paragraph(paragraphOptions));
              }
            });
            break;
          }
  
          case "h1":
          case "h2":
          case "h3":
          case "h4":
          case "h5":
          case "h6": {
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
                  spacing: { before: 240, after: 120 },
                })
              );
              currentRuns = [];
            }
            break;
          }
  
          case "span":
            // Handle inline styles for spans, especially for partially editable sections
            const spanStyle = window.getComputedStyle(node);
            
            Array.from(node.childNodes).forEach(processNode);
            
            if (spanStyle.fontSize) {
              // Modify the size of existing runs
              currentRuns = currentRuns.map(run => {
                const runStyle = { ...run };
                runStyle.size = convertPixelToHalfPoint(spanStyle.fontSize);
                return new TextRun(runStyle);
              });
            }
            break;
  
          default:
            Array.from(node.childNodes).forEach(processNode);
        }
      }
    };
  
    processNode(parentNode);
  
    // Ensure any remaining runs are added as a paragraph
    if (currentRuns.length > 0) {
      paragraphs.push(new Paragraph({ children: currentRuns }));
    }
  
    return paragraphs;
  };
  

  const parseHTML = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return convertNodesToDocxParagraphs(doc.body);
  };
 
  const downloadAsPDF = () => {
    const options = {
      margin: 10,
      filename: 'output.pdf',
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
  
    // Create a temporary container to render the HTML
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = processedTemplateText;
  
    // Override styles to ensure white background and black text
    tempContainer.style.backgroundColor = 'white';
    tempContainer.style.color = 'black';
    tempContainer.style.padding = '20px';
    tempContainer.style.width = 'fit-content';
  
    // Find and reset the inner div's styles if it exists
    const innerDiv = tempContainer.querySelector('div[style*="background-color:white"]');
    if (innerDiv) {
      innerDiv.style.backgroundColor = 'white';
      innerDiv.style.color = 'black';
    }
  
    // Append to DOM to ensure styles and layout are rendered correctly
    document.body.appendChild(tempContainer);
  
    html2pdf()
      .set(options)
      .from(tempContainer)
      .save()
      .finally(() => {
        // Clean up the temporary container after PDF is generated
        document.body.removeChild(tempContainer);
      });
  };
  

  const downloadAsWord=()=>{
    const stylesFromDocument = Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules)
          .map(rule => rule.cssText)
          .join('\n');
      } catch(e) {
        return '';
      }
    })
    .join('\n');

  // Construct full HTML with inline styles
  const fullHtmlContent = `
    <html>
      <head>
        <style>
          ${stylesFromDocument}
        </style>
      </head>
      <body>
        ${processedTemplateText}
      </body>
    </html>
  `;

  // Create Blob
  const blob = new Blob([fullHtmlContent], {
    type: 'application/msword'
  });

  // Create download link
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'document.doc';
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  }
  

  const handleInit = (evt, editor) => {
    editorRef.current = editor;
  
    // Allow formatting in partially editable sections
    editor.on('NodeChange', (e) => {
      const node = e.element;
      
      if (node.classList && node.classList.contains('partially-editable')) {
        // Ensure the node can be fully edited
        node.setAttribute('contenteditable', 'true');
        
        // Allow all formatting within this section
        editor.dom.setAttrib(node, 'data-mce-contenteditable', 'true');
      }
    });
  
    // Remove restrictions on partially editable sections
    editor.on('KeyDown', (e) => {
      const node = editor.selection.getNode();
      if (node.classList && node.classList.contains('partially-editable')) {
        // Allow all key events in partially editable sections
        e.stopPropagation();
      }
    });
  };
  const handleEditorChange = (newContent) => {
    // Update template text
    setNewTemplateText(newContent);
   
    // Create a temporary div to parse the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newContent;
    
    // Find all partially editable sections
    const partiallyEditableSections = tempDiv.querySelectorAll('[data-field]');
    
    // Update editableFields based on data-field attributes
    const newEditableFields = {};
    partiallyEditableSections.forEach(section => {
     const field = section.getAttribute('data-field');
     const value = section.textContent || field;
      newEditableFields[field] = value;
    });

    // Merge new fields with existing field
    setEditableFields(prev => ({
      ...prev,
      ...newEditableFields
    }));
    
    // Update processed template text
    setProcessedTemplateText(newContent);
};
  
  useEffect(() => {
    const template = templates.find((t) => t.id === parseInt(selectedTemplateId));
    if (template) {
      // Process the template text with the current editable fields
      const updatedText = processTemplate(template);
      setProcessedTemplateText(updatedText);
    }
  }, [editableFields, selectedTemplateId, templates]);
  

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            mode === "admin" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setMode("admin")}
        >
          Admin Mode
        </button>
        <button
          className={`px-4 py-2 rounded ${
            mode === "user" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setMode("user")}
        >
          User Mode
        </button>
      </div>

      {mode === "admin" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Admin Mode</h2>
          <div className="mb-4">
            <label className="block font-medium mb-2">Template Name</label>
            <input
              className="border p-2 rounded w-full"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
            />
          </div>
          <div className="border rounded">
            <Editor
              onInit={(evt, editor) => (editorRef.current = editor)}
              apiKey="0aqfwn57ig438bbfpsi692d5sol53dnozld591jt2aakew1r"
              value={newTemplateText}
              onEditorChange={(content) => setNewTemplateText(content)}
              init={{
                height: 400,
                menubar: true,
                plugins: [
                  "advlist","autolink","lists","link","image","charmap","preview","anchor","searchreplace",
                  "visualblocks","code","fullscreen","insertdatetime","media","table","code","help","wordcount","fontsize","fontfamily"
                ],
                toolbar:
                  "undo redo | formatselect |fontselect fontsize |fontfamily " +
                  "bold italic backcolor | alignleft aligncenter " +
                  "alignright alignjustify | bullist numlist outdent indent | " +
                  "removeformat | insertVariable insertPartiallyEditable",
                setup: (editor) => {
                  editor.ui.registry.addButton("insertVariable", {
                    text: "Insert Variable",
                    onAction: insertVariable,
                  });
                  editor.ui.registry.addButton("insertPartiallyEditable", {
                    text: "Partially Editable",
                    onAction: insertPartiallyEditable,
                  });
                },
                content_style:
                  "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
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
              {templates.map((template) => (
                <div key={template.id} className="p-4 border rounded">
                                    <div className="font-semibold">{template.name}</div> {/* Display the template name */}
                  <div dangerouslySetInnerHTML={{ __html: template.text }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {mode === "user" && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">User Mode</h2>

          <select
            className="border p-2 rounded w-full"
            value={selectedTemplateId}
            onChange={(e) => handleTemplateSelect(e.target.value)}
          >
            <option value="">Select a Template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>

          {selectedTemplateId && (
            <div className="space-y-6">
              <div className="p-4 border rounded bg-gray-50">
                <h3 className="text-lg font-bold mb-4">Editable Fields</h3>
                <div className="space-y-4">
                  {Object.keys(editableFields).map((field) => (
                    <div key={field} className="mb-4">
                      <label className="block font-medium mb-2">{field}</label>
                      <input
                        className="border p-2 rounded w-full"
                        value={editableFields[field]}
                        onChange={(e) =>
                          handleFieldChange(field, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border rounded">
              <Editor
  onInit={handleInit}
  apiKey="0aqfwn57ig438bbfpsi692d5sol53dnozld591jt2aakew1r"
  value={processedTemplateText}
  onEditorChange={handleEditorChange}
  init={{
    selector: 'textarea',
    height: 400,
    menubar: false,
    setup: (editor) => {
      editor.on("init", () => {
        // Set contenteditable attribute for all partially-editable elements
        editor.getBody().querySelectorAll(".partially-editable").forEach((el) => {
          el.setAttribute("contenteditable", "true");
        });
      });
      
      editor.on("keydown", function (e) {
        if (e.key === "Enter") {
          const selection = editor.selection;
          const node = selection.getNode();
          
          // Check if the cursor is inside a span
          const spanNode = editor.dom.getParent(node, "span");
          if (spanNode) {
            e.preventDefault(); // Prevent the default behavior for Enter
      
            // Split the text at the current caret position
            const range = selection.getRng(); // Get the current range
            const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
            const textAfter = range.startContainer.textContent.slice(range.startOffset);
      
            // Update the original span with the text before the caret
            range.startContainer.textContent = textBefore;
      
            // Create a new span with the same attributes for the text after the caret
            const newSpan = editor.dom.create("span", spanNode.attributes);
            newSpan.textContent = textAfter;
      
            // Insert the new span after the current span
            editor.dom.insertAfter(newSpan, spanNode);
      
            // Place the caret inside the new span
            const newRange = editor.dom.createRng();
            newRange.setStart(newSpan.firstChild, 0);
            newRange.setEnd(newSpan.firstChild, 0);
            selection.setRng(newRange);
      
            // Ensure the editor updates properly
            editor.undoManager.add(); // Add this operation to the undo stack
          }
        }
      });
      
          
      editor.on("keydown", (e) => {
        const node = editor.selection.getNode();
    
        // Check if the current node is editable
        if (node.classList.contains("partially-editable")) {
          if (e.key === "Backspace" || e.key === "Delete") {
            // Allow backspace or delete in editable areas
            return;
          }
        } else {
          // Prevent editing outside partially-editable elements
          e.preventDefault();
          e.stopPropagation();
        }
      });
    },
    plugins: [
      "advlist", "autolink", "lists", "link", "image", "charmap", "preview",
      "anchor", "searchreplace", "visualblocks", "code", "fullscreen",
      "insertdatetime", "media", "table", "code", "help", "wordcount",
    ],
    toolbar:
      "undo redo | formatselect | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | insertVariable insertPartiallyEditable",
    content_style: "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
  }}
/>

          </div>
              

              <div className="p-4 border rounded">
                <div
                  className="flex items-center justify-between mb-4"
                  ref={previewRef}
                >
                  <h3 className="text-lg font-bold">Preview</h3>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: processTemplate(
                        templates.find(
                          (t) => t.id === parseInt(selectedTemplateId)
                        )
                      ),
                    }}
                  />
                </div>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  onClick={downloadAsWord}
                >
                  Download as Word
                </button>
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded"
                  onClick={downloadAsPDF}
                >
                  Download as PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplateEditor;
