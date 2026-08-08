import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Plus, Trash2, FileText, Image as ImageIcon, Loader2, Upload } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { toast } from 'sonner';

export interface ProjectEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  workingExplanation: string;
  outputExplanation: string;
  images: string[];
}

interface ReportBuilderProps {
  onComplete: () => void;
  onDriveLinkGenerated: (link: string) => void;
  onCancel: () => void;
}

import { saveAs } from "file-saver";
import { useGoogleLogin } from "@react-oauth/google";

export function ReportBuilder({ onComplete, onCancel, onDriveLinkGenerated }: ReportBuilderProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>(() => {
    const saved = localStorage.getItem('draft_report_projects');
    return saved ? JSON.parse(saved) : [{
      id: Math.random().toString(),
      date: new Date().toISOString().split('T')[0],
      title: '',
      description: '',
      workingExplanation: '',
      outputExplanation: '',
      images: []
    }];
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      await uploadToDrive(tokenResponse.access_token);
    },
    onError: () => toast.error('Google Login failed'),
    scope: 'https://www.googleapis.com/auth/drive.file'
  });

  const uploadToDrive = async (accessToken: string) => {
    if (!pdfRef.current) return;
    setIsUploading(true);
    try {
      const element = pdfRef.current;
      const opt = {
        margin: 15,
        filename: 'project_report.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      
      const metadata = {
        name: 'Project_Report_' + new Date().getTime() + '.pdf',
        mimeType: 'application/pdf',
      };
      
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', pdfBlob as Blob);
      
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
        },
        body: form,
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      // Make public
      await fetch('https://www.googleapis.com/drive/v3/files/' + data.id + '/permissions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });

      toast.success('Successfully uploaded to Google Drive!');
      onDriveLinkGenerated(data.webViewLink);
      onComplete();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload to Google Drive');
    } finally {
      setIsUploading(false);
    }
  };

  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('draft_report_projects', JSON.stringify(projects));
  }, [projects]);

  const addProject = () => {
    setProjects([
      ...projects,
      {
        id: Math.random().toString(),
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        workingExplanation: '',
        outputExplanation: '',
        images: []
      }
    ]);
  };

  const removeProject = (id: string) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  const updateProject = (id: string, field: keyof ProjectEntry, value: any) => {
    setProjects(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    Array.from(e.target.files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProjects(prev => prev.map(p => 
            p.id === id 
              ? { ...p, images: [...p.images, event.target!.result as string] } 
              : p
          ));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (projectId: string, index: number) => {
    setProjects(projects.map(p => {
      if (p.id === projectId) {
        const newImages = [...p.images];
        newImages.splice(index, 1);
        return { ...p, images: newImages };
      }
      return p;
    }));
  };

  const generatePdf = async () => {
    if (!pdfRef.current) return;
    
    // validate
    if (projects.some(p => !p.title.trim())) {
      toast.error('Please enter a title for all projects');
      return;
    }
    
    setIsGenerating(true);
    try {
      const element = pdfRef.current;
      const opt = {
        margin: 15,
        filename: 'project_report.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
      saveAs(pdfBlob as Blob, "project_report.pdf");
      toast.success("PDF downloaded successfully! Please upload it to Google Drive and paste the share link.");
      onComplete();
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Project Report Builder
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>Close</Button>
      </div>

      <div className="space-y-8">
        {projects.map((project, index) => (
          <div key={project.id} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm relative">
            {projects.length > 1 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => removeProject(project.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            
            <h4 className="text-lg font-bold mb-4">Project {index + 1}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  type="date" 
                  value={project.date} 
                  onChange={(e) => updateProject(project.id, 'date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Title</label>
                <input 
                  type="text" 
                  value={project.title} 
                  onChange={(e) => updateProject(project.id, 'title', e.target.value)}
                  placeholder="E.g., Smart Home Automation"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  value={project.description} 
                  onChange={(e) => updateProject(project.id, 'description', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Working Explanation</label>
                <textarea 
                  value={project.workingExplanation} 
                  onChange={(e) => updateProject(project.id, 'workingExplanation', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Output Explanation</label>
                <textarea 
                  value={project.outputExplanation} 
                  onChange={(e) => updateProject(project.id, 'outputExplanation', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Images</label>
                <div className="flex flex-wrap gap-4 mb-2">
                  {project.images.map((img, i) => (
                    <div key={i} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Trash2 
                          className="w-5 h-5 text-white cursor-pointer hover:text-red-400" 
                          onClick={() => removeImage(project.id, i)}
                        />
                      </div>
                    </div>
                  ))}
                  <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-500 transition-colors">
                    <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500">Add</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={(e) => handleImageUpload(project.id, e)}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <Button variant="outline" onClick={addProject} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Add Another Project
        </Button>
        <div className="flex gap-4">
          <Button onClick={generatePdf} disabled={isGenerating || isUploading} variant="outline" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button onClick={() => googleLogin()} disabled={isGenerating || isUploading} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload to Google Drive
          </Button>
        </div>
      </div>

      {/* Hidden PDF Template */}
      <div style={{ display: 'none' }}>
        <div ref={pdfRef} style={{ padding: '32px', maxWidth: '896px', margin: '0 auto', backgroundColor: '#ffffff', color: '#000000', fontFamily: 'sans-serif' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px', borderBottom: '1px solid #e5e7eb', paddingBottom: '24px' }}>
            <h1 style={{ fontSize: '30px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Project Report</h1>
            <p style={{ color: '#4b5563', margin: '0' }}>Generated on {new Date().toLocaleDateString()}</p>
          </div>
          
          {projects.map((project, idx) => (
            <div key={project.id} style={{ marginBottom: '40px', pageBreakInside: 'avoid' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', paddingBottom: '8px', borderBottom: '1px solid #e5e7eb' }}>
                {idx + 1}. {project.title || 'Untitled Project'}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 16px 0', fontWeight: '500' }}>Date: {project.date}</p>
              
              {project.description && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>Description</h3>
                  <p style={{ color: '#374151', margin: '0', whiteSpace: 'pre-wrap' }}>{project.description}</p>
                </div>
              )}
              
              {project.workingExplanation && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>Working Explanation</h3>
                  <p style={{ color: '#374151', margin: '0', whiteSpace: 'pre-wrap' }}>{project.workingExplanation}</p>
                </div>
              )}
              
              {project.outputExplanation && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>Output Explanation</h3>
                  <p style={{ color: '#374151', margin: '0', whiteSpace: 'pre-wrap' }}>{project.outputExplanation}</p>
                </div>
              )}
              
              {project.images.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0', color: '#1f2937' }}>Outputs / Diagrams</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {project.images.map((img, i) => (
                      <div key={i} style={{ maxWidth: '45%', borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                        <img src={img} style={{ width: '100%', height: 'auto', maxHeight: '300px', objectFit: 'contain' }} alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
