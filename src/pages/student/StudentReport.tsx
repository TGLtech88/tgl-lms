import React, { useEffect, useState, useRef } from "react";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../lib/supabase";
import {
  Loader2,
  Save,
  CheckCircle2,
  Upload,
  AlertCircle,
  Award,
  Link as LinkIcon,
  ExternalLink
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

export default function StudentReport() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  const [generatingCert, setGeneratingCert] = useState(false);
  const [certSettings, setCertSettings] = useState<any>(null);
  const [studentBatch, setStudentBatch] = useState<any>(null);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadReport() {
      if (!profile?.id) return;

      try {
        setLoading(true);
        let { data, error: fetchError } = await supabase
          .from("project_reports")
          .select("*")
          .eq("student_id", profile.id)
          .maybeSingle();

        if (fetchError && fetchError.code === "42P01") {
          console.warn("Table project_reports doesn't exist yet");
          setReport({});
          setLoading(false);
          return;
        }

        const { data: batchData } = await supabase
            .from("batch_students")
            .select("batch_id, batches (name, start_date, end_date)")
            .eq("student_id", profile.id)
            .maybeSingle();
            
        if (batchData?.batches) {
            setStudentBatch(batchData.batches);
        }

        const { data: certData } = await supabase
            .from('certificate_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
            
        if (certData) {
            setCertSettings(certData);
        }

        if (data) {
          setReport(data);
        } else {
          try {
            const { data: inserted, error: insertError } = await supabase
              .from("project_reports")
              .insert([
                {
                  student_id: profile.id,
                  batch_id: batchData?.batch_id || null,
                  status: "Draft",
                },
              ])
              .select()
              .single();

            if (insertError) throw insertError;
            setReport(inserted);
          } catch (e) {
            setReport({});
          }
        }
      } catch (error: any) {
        toast.error("Error loading report");
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile || !report?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("project_reports")
        .update({
          title: report.title,
          description: report.description, // using description field to store document URL
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", profile.id)
        .select()
        .single();

      if (!error && data) {
        setLastSaved(new Date());
        setUnsavedChanges(false);
        toast.success("Saved successfully");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save. Ensure columns exist on Supabase.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!profile || !report?.title || !report?.description) {
      toast.error("Please provide both Title and a Document Link/File to submit.");
      return;
    }
    
    if (unsavedChanges) {
      await handleSave();
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("project_reports")
        .update({
          status: 'Under Review',
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", profile.id);

      if (error) throw error;
      
      setReport((prev: any) => ({ ...prev, status: 'Under Review' }));
      toast.success("Report submitted for review successfully");
    } catch (err: any) {
      toast.error("Failed to submit report: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check size limit (max 10MB approx)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Please upload < 10MB or provide a Drive link.");
      return;
    }

    try {
      setSaving(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `reports/${profile?.id}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('journals') // using the existing journals bucket
        .upload(fileName, file);

      if (uploadError) {
        toast.error("Upload failed. Make sure the 'journals' bucket exists and is public.");
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('journals')
        .getPublicUrl(fileName);

      setReport((prev: any) => ({ ...prev, description: urlData.publicUrl }));
      setUnsavedChanges(true);
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error("Upload error", error);
    } finally {
      setSaving(false);
      event.target.value = ''; // Reset input
    }
  };

  const downloadCertPdf = async () => {
    if (!certRef.current) return;
    
    setGeneratingCert(true);
    try {
      const canvas = await html2canvas(certRef.current, {
        scale: 2,
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
      const fileName = `Certificate_${profile?.full_name?.replace(/\s+/g, '_') || 'Student'}.pdf`;
      pdf.save(fileName);
      toast.success('Certificate downloaded successfully');
    } catch (error) {
      toast.error('Failed to generate certificate PDF');
      console.error(error);
    } finally {
      setGeneratingCert(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );

  if (!report)
    return (
      <div className="text-center py-12 text-slate-500">
        Could not initialize report editor.
      </div>
    );

  const isReadOnly =
    report?.status === "Approved" || report?.status === "Completed" || report?.status === "Under Review";

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Project Report Submission
            </h1>
            {report.status && (
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-md ${
                  report.status === "Approved" || report.status === "Completed"
                    ? "bg-green-100 text-green-700"
                    : report.status === "Under Review"
                      ? "bg-blue-100 text-blue-700"
                      : report.status === "Rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                {report.status}
              </span>
            )}
          </div>
          <p className="text-slate-500">
            Submit your final project document (PDF) or Google Drive link for review.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unsavedChanges && (
            <span className="text-sm font-medium text-orange-500 hidden sm:inline-block">
              Unsaved changes
            </span>
          )}
          {lastSaved && !unsavedChanges && (
            <span className="text-sm text-slate-400 hidden sm:inline-block">
              Saved {format(lastSaved, "HH:mm")}
            </span>
          )}
          {!isReadOnly && (
            <Button
              onClick={handleSave}
              disabled={!unsavedChanges || saving}
              variant="outline"
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </Button>
          )}

          {report.status !== "Approved" && report.status !== "Completed" && (
            <Button
              onClick={handleSubmitForReview}
              disabled={saving || report.status === "Under Review"}
              className="gap-2 bg-[#2563EB] hover:bg-blue-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              {report.status === "Under Review" ? "Submitted" : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>

      {report.admin_feedback && (report.status === "Draft" || report.status === "Rejected") && (
        <div className={`p-4 border rounded-xl flex gap-3 mb-6 shrink-0 ${report.status === "Rejected" ? "bg-red-50 border-red-200 text-red-800" : "bg-orange-50 border-orange-200 text-orange-800"}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${report.status === "Rejected" ? "text-red-500" : "text-orange-500"}`} />
          <div>
            <h4 className="font-bold">{report.status === "Rejected" ? "Report Rejected" : "Modifications Requested"}</h4>
            <p className="text-sm mt-1 whitespace-pre-wrap">{report.admin_feedback}</p>
          </div>
        </div>
      )}

      {/* Certificate Panel if Approved/Completed */}
      {(report.status === 'Approved' || report.status === 'Completed') && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl overflow-hidden mb-6 shrink-0">
          <div className="p-8 sm:p-12 text-center text-white flex flex-col items-center">
            <Award className="w-16 h-16 mb-4 text-indigo-100" />
            <h2 className="text-3xl font-bold mb-2">Congratulations!</h2>
            <p className="text-indigo-100 max-w-lg mb-8">
              Your project report has been approved. You have officially completed the program requirements. Your certificate is now available.
            </p>
            <Button
              onClick={downloadCertPdf}
              disabled={generatingCert}
              className="bg-white text-indigo-600 hover:bg-slate-50 font-bold py-6 px-8 rounded-xl text-lg gap-3"
            >
              {generatingCert ? <Loader2 className="w-6 h-6 animate-spin" /> : <Award className="w-6 h-6" />}
              {generatingCert ? 'Generating PDF...' : 'Download Certificate'}
            </Button>
          </div>
        </div>
      )}

      {/* Main Submission Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-1 max-w-3xl">
        <div className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Title
            </label>
            <input
              type="text"
              value={report?.title || ''}
              onChange={(e) => {
                setReport({ ...report, title: e.target.value });
                setUnsavedChanges(true);
              }}
              disabled={isReadOnly}
              placeholder="Enter the title of your project"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none disabled:opacity-70"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Report Document
            </label>
            <p className="text-sm text-slate-500 mb-4">
              Upload your report as a PDF file, or paste a public Google Drive link to your document.
            </p>

            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="relative flex-1">
                  <input 
                    type="file" 
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    disabled={saving || isReadOnly}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full h-12 gap-2 border-dashed border-2 hover:bg-slate-50 pointer-events-none"
                  >
                     <Upload className="w-5 h-5 text-slate-400" />
                     Upload PDF Report (Max 10MB)
                  </Button>
                </div>
                <div className="flex items-center justify-center text-slate-400 font-medium">
                  OR
                </div>
              </div>
            )}

            <div>
              <div className="relative">
                 <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                 <input
                   type="text"
                   value={report?.description || ''}
                   onChange={(e) => {
                     setReport({ ...report, description: e.target.value });
                     setUnsavedChanges(true);
                   }}
                   disabled={isReadOnly}
                   placeholder="https://drive.google.com/file/d/..."
                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none disabled:opacity-70"
                 />
              </div>
              
              {report?.description && (
                <div className="mt-3 p-4 bg-blue-50 rounded-lg flex items-center justify-between border border-blue-100">
                  <div className="flex items-center gap-3 truncate pr-4">
                    <FileIcon className="w-5 h-5 text-blue-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-700 truncate">Document Link Attached</span>
                  </div>
                  <a 
                    href={report.description} 
                    target="_blank" 
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open Link <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* Hidden Certificate Element for Generation */}
      {(report.status === 'Approved' || report.status === 'Completed') && (
        <div style={{ position: 'absolute', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }}>
           <div 
              ref={certRef}
              className="relative font-sans overflow-hidden"
              style={{ 
                width: '800px', 
                height: '565px',
                backgroundImage: certSettings?.template_url ? `url(${certSettings.template_url})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                color: '#0f172a',
                backgroundColor: '#ffffff'
              }}
           >
              {!certSettings?.template_url && (
                <div className="absolute inset-0 border-[10px] border-double m-4 flex flex-col items-center justify-center p-12 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0' }}>
                   <div className="w-full h-full border rounded-sm p-8 flex flex-col items-center" style={{ borderColor: '#f1f5f9' }}>
                      <Award className="w-16 h-16 mb-6" style={{ color: '#6366f1' }} />
                      <h1 className="text-4xl font-serif mb-2 uppercase tracking-widest" style={{ color: '#1e293b' }}>Certificate of Completion</h1>
                      <p className="italic mb-8" style={{ color: '#64748b' }}>This is to certify that</p>
                      
                      <h2 className="text-5xl font-serif mb-8 border-b pb-2 inline-block px-12" style={{ color: '#312e81', borderBottomColor: '#cbd5e1' }}>
                        {profile?.full_name}
                      </h2>
                      
                      <p className="text-lg max-w-2xl leading-relaxed mb-auto" style={{ color: '#475569' }}>
                        has successfully completed the <strong>{studentBatch?.name || 'Internship Program'}</strong>, 
                        demonstrating exceptional skills and continuous dedication to the field 
                        between {studentBatch?.start_date ? format(new Date(studentBatch.start_date), 'MMM yyyy') : '...'} and {studentBatch?.end_date ? format(new Date(studentBatch.end_date), 'MMM yyyy') : '...'}.
                      </p>

                      <div className="flex justify-between w-full px-12 mt-12">
                        <div className="text-center">
                          <p className="font-bold border-b pb-1 mb-1 w-48" style={{ color: '#1e293b', borderBottomColor: '#94a3b8' }}>
                            {format(new Date(), 'MMMM d, yyyy')}
                          </p>
                          <p className="text-sm" style={{ color: '#64748b' }}>Date of Issue</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="font-serif text-xl border-b pb-1 mb-1 w-48 truncate" style={{ color: '#1e293b', borderBottomColor: '#94a3b8' }}>
                            {certSettings?.issuer_name || 'Authorized Signatory'}
                          </p>
                          <p className="text-sm" style={{ color: '#64748b' }}>{certSettings?.issuer_title || 'Director'}</p>
                        </div>
                      </div>
                   </div>
                </div>
              )}
              
              {certSettings?.template_url && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center pt-24 text-center z-10">
                    <p className="text-xl mt-24 italic mb-4" style={{ color: '#475569' }}>This is to certify that</p>
                    <h2 className="text-5xl font-serif mb-4" style={{ color: '#0f172a' }}>{profile?.full_name}</h2>
                    <p className="text-lg max-w-[600px] leading-relaxed" style={{ color: '#334155' }}>
                      has successfully completed the <strong>{studentBatch?.name || 'Internship Program'}</strong>.
                    </p>
                    <div className="absolute bottom-16 left-24 text-center">
                      <p className="font-bold text-lg" style={{ color: '#0f172a' }}>{format(new Date(), 'MMM d, yyyy')}</p>
                      <p className="text-xs uppercase tracking-wider mt-1" style={{ color: '#64748b' }}>Date</p>
                    </div>
                    <div className="absolute bottom-16 right-24 text-center w-48">
                      <p className="font-serif text-2xl truncate" style={{ color: '#0f172a' }}>{certSettings?.issuer_name}</p>
                      <p className="text-xs uppercase tracking-wider mt-1 border-t pt-1" style={{ color: '#64748b', borderTopColor: '#94a3b8' }}>
                        {certSettings?.issuer_title || 'Signatory'}
                      </p>
                    </div>
                 </div>
              )}
           </div>
        </div>
      )}

    </div>
  );
}

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
