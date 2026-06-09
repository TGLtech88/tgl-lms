import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Upload, Download, Eye, Award, CheckCircle2, User, Building, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function AdminCertificates() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings form
  const [issuerName, setIssuerName] = useState('');
  const [issuerTitle, setIssuerTitle] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');
  
  // Students with completed/approved reports
  const [students, setStudents] = useState<any[]>([]);
  
  // Preview
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('certificate_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
        
      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }
      
      if (settingsData) {
        setSettings(settingsData);
        setIssuerName(settingsData.issuer_name || '');
        setIssuerTitle(settingsData.issuer_title || '');
        setTemplateUrl(settingsData.template_url || '');
      }

      // Load applicable students
      const { data: reportsData, error: reportsError } = await supabase
        .from('project_reports')
        .select(`
          id,
          status,
          updated_at,
          profiles:student_id (id, full_name, email),
          batches:batch_id (name, start_date, end_date)
        `)
        .in('status', ['Approved', 'Completed']);

      if (reportsError) throw reportsError;
      setStudents(reportsData || []);

    } catch (error: any) {
      toast.error('Failed to load certificates data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (settings?.id) {
        // Update
        const { error } = await supabase
          .from('certificate_settings')
          .update({
            issuer_name: issuerName,
            issuer_title: issuerTitle,
            template_url: templateUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('certificate_settings')
          .insert([{
            issuer_name: issuerName,
            issuer_title: issuerTitle,
            template_url: templateUrl
          }]);
        if (error) throw error;
      }
      
      toast.success('Certificate settings saved successfully');
      loadData();
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async (studentName: string) => {
    if (!certificateRef.current) return;
    
    setGeneratingPdf(true);
    try {
      const element = certificateRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Certificate_${studentName.replace(/\s+/g, '_')}.pdf`);
      toast.success('Certificate downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate PDF');
      console.error(error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
          <p className="text-slate-500">Manage certificate templates and generate certificates for students.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Settings Panel */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              Certificate Setup
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issuer Name</label>
                <input
                  type="text"
                  value={issuerName}
                  onChange={(e) => setIssuerName(e.target.value)}
                  placeholder="e.g. John Doe, Tech Academy"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Issuer Title</label>
                <input
                  type="text"
                  value={issuerTitle}
                  onChange={(e) => setIssuerTitle(e.target.value)}
                  placeholder="e.g. Director of Engineering"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Background Image</label>
                <div className="flex flex-col gap-2 mb-2">
                  <input
                    type="text"
                    value={templateUrl}
                    onChange={(e) => setTemplateUrl(e.target.value)}
                    placeholder="https://example.com/template.png"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <div className="relative w-full">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        try {
                          const fileExt = file.name.split('.').pop();
                          const fileName = `certificates/${Date.now()}.${fileExt}`;
                          
                          setSaving(true);
                          const { error: uploadError } = await supabase.storage
                            .from('journals') // using the existing journals bucket as default
                            .upload(fileName, file);
                            
                          if (uploadError) {
                            toast.error("Upload failed. Make sure the 'journals' bucket exists and is public.");
                            throw uploadError;
                          }
                          
                          const { data: urlData } = supabase.storage
                            .from('journals')
                            .getPublicUrl(fileName);
                            
                          setTemplateUrl(urlData.publicUrl);
                          toast.success("Template uploaded successfully!");
                        } catch (err: any) {
                          console.error("Upload error", err);
                        } finally {
                          setSaving(false);
                          // Reset input so the same file can be selected again
                          e.target.value = '';
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full gap-2 pointer-events-none border-dashed border-2"
                    >
                      <Upload className="w-4 h-4" />
                      Upload File
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Upload a 16:9 ratio image directly, or paste a direct public image URL. Google Drive links (e.g., drive.google.com/open?id=...) usually do not work due to Google's security (CORS) restrictions.
                </p>
              </div>

              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Template Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Generate Certificates Panel */}
        <div className="xl:col-span-2 flex min-w-0 h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col w-full">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Eligible Students</h2>
              <p className="text-sm text-slate-500">Students with Approved or Completed project reports.</p>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                  <User className="w-10 h-10 mb-3 text-slate-300" />
                  <p className="font-medium">No eligible students yet.</p>
                  <p className="text-sm">Approve project reports to generate certificates.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-white border-b border-slate-200">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Student</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Batch</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((report) => (
                      <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{report.profiles?.full_name}</div>
                          <div className="text-xs text-slate-500">{report.profiles?.email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.batches?.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center space-x-1 w-max">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{report.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            onClick={() => setPreviewStudent(report)}
                            variant="secondary"
                            size="sm"
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Preview
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white max-w-5xl w-full rounded-2xl shadow-xl flex flex-col max-h-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 shrink-0">
              <h2 className="text-xl font-bold text-slate-900">Certificate Preview</h2>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => downloadPdf(previewStudent.profiles?.full_name || 'Student')}
                  disabled={generatingPdf}
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                >
                  {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </Button>
                <Button 
                  onClick={() => setPreviewStudent(null)}
                  variant="ghost"
                  size="icon"
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div className="p-4 sm:p-8 bg-slate-100 overflow-auto flex justify-center">
              {/* Certificate Template Canvas */}
              {/* Using a fixed aspect ratio context for standard certificates (A4 Landscape roughly 1.414 ratio, or 16:9 1.77 ratio) */}
              <div 
                ref={certificateRef}
                className="relative shadow-lg overflow-hidden flex-shrink-0"
                style={{ 
                  width: '800px', 
                  height: '565px', // ~A4 Landscape
                  backgroundImage: settings?.template_url ? `url(${settings.template_url})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundColor: '#ffffff',
                  color: '#0f172a'
                }}
              >
                {/* Fallback styling if no template image is provided */}
                {!settings?.template_url && (
                  <div className="absolute inset-0 border-[10px] border-double m-4 flex flex-col items-center justify-center p-12 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                     <div className="w-full h-full border rounded-sm p-8 flex flex-col items-center" style={{ borderColor: '#f1f5f9' }}>
                        <Award className="w-16 h-16 mb-6" style={{ color: '#6366f1' }} />
                        <h1 className="text-4xl font-serif mb-2 uppercase tracking-widest" style={{ color: '#1e293b' }}>Certificate of Completion</h1>
                        <p className="italic mb-8" style={{ color: '#64748b' }}>This is to certify that</p>
                        
                        <h2 className="text-5xl font-serif mb-8 border-b pb-2 inline-block px-12" style={{ color: '#312e81', borderBottomColor: '#cbd5e1' }}>
                          {previewStudent?.profiles?.full_name}
                        </h2>
                        
                        <p className="text-lg max-w-2xl leading-relaxed mb-auto" style={{ color: '#475569' }}>
                          has successfully completed the <strong>{previewStudent?.batches?.name}</strong> program, 
                          demonstrating exceptional skills and continuous dedication to the field 
                          between {previewStudent?.batches?.start_date ? format(new Date(previewStudent.batches.start_date), 'MMM yyyy') : '...'} and {previewStudent?.batches?.end_date ? format(new Date(previewStudent.batches.end_date), 'MMM yyyy') : '...'}.
                        </p>

                        <div className="flex justify-between w-full px-12 mt-12">
                          <div className="text-center">
                            <p className="font-bold border-b pb-1 mb-1 w-48" style={{ color: '#1e293b', borderBottomColor: '#94a3b8' }}>
                              {format(new Date(), 'MMMM d, yyyy')}
                            </p>
                            <p className="text-sm" style={{ color: '#64748b' }}>Date of Issue</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="font-serif text-xl signature-font border-b pb-1 mb-1 w-48 truncate" style={{ color: '#1e293b', borderBottomColor: '#94a3b8' }}>
                              {settings?.issuer_name || 'Authorized Signatory'}
                            </p>
                            <p className="text-sm" style={{ color: '#64748b' }}>{settings?.issuer_title || 'Director'}</p>
                          </div>
                        </div>
                     </div>
                  </div>
                )}
                
                {/* If a template is uploaded, we might just want relatively positioned text, 
                    but for simplicity, we overlay standard text elements centrally if they are missing template */}
                {settings?.template_url && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center pt-24 text-center z-10">
                      {/* You can adjust positions with absolute positioning mapped to percentages later if required dynamically */}
                      <p className="text-xl mt-24 italic mb-4" style={{ color: '#475569' }}>This is to certify that</p>
                      
                      <h2 className="text-5xl font-serif mb-4" style={{ color: '#0f172a' }}>
                        {previewStudent?.profiles?.full_name}
                      </h2>
                      
                      <p className="text-lg max-w-[600px] leading-relaxed" style={{ color: '#334155' }}>
                        has successfully completed the <strong>{previewStudent?.batches?.name}</strong>.
                      </p>

                      <div className="absolute bottom-16 left-24 text-center">
                        <p className="font-bold text-lg" style={{ color: '#0f172a' }}>
                          {format(new Date(), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#64748b' }}>Date</p>
                      </div>

                      <div className="absolute bottom-16 right-24 text-center w-48">
                        <p className="font-serif text-2xl truncate" style={{ color: '#0f172a' }}>
                          {settings?.issuer_name}
                        </p>
                        <p className="text-xs uppercase tracking-wider mt-1 border-t pt-1" style={{ color: '#64748b', borderTopColor: '#94a3b8' }}>{settings?.issuer_title || 'Signatory'}</p>
                      </div>
                   </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-200 text-sm text-slate-500 flex justify-center">
              The layout adjusts based on whether a template background image is provided.
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
