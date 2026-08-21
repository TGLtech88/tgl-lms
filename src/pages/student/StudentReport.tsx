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
  ExternalLink,
  Download,
  FileText
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { ReportBuilder } from "../../components/student/ReportBuilder";

export default function StudentReport() {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  const [generatingCert, setGeneratingCert] = useState(false);
  const [studentBatch, setStudentBatch] = useState<any>(null);
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

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
            .eq("student_id", profile.id);
            
        if (batchData && batchData.length > 0) {
            const today = new Date().toISOString().split("T")[0];
            let activeBatch = batchData.find((b: any) => {
              const batchInfo = b.batches as any;
              return !batchInfo?.end_date || batchInfo.end_date >= today;
            });
            
            if (!activeBatch) {
              activeBatch = batchData[batchData.length - 1]; // fallback
            }
            if (activeBatch?.batches) {
              setStudentBatch(activeBatch.batches);
            }
        }

        const { data: certFiles } = await supabase.storage.from('journals').list('certificates', {
            search: profile.id
        });
        
        if (certFiles && certFiles.some((f: any) => f.name === `${profile.id}.pdf`)) {
            const { data: urlData } = supabase.storage.from('journals').getPublicUrl(`certificates/${profile.id}.pdf`);
            if (urlData) {
                setCertificateUrl(urlData.publicUrl);
            }
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
                  batch_id: batchData?.[0]?.batch_id || null,
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
          description: report.description,
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
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!profile || !report?.id) return;
    if (!report.title || !report.description) {
      toast.error("Please fill in both title and provide a document link/upload");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("project_reports")
        .update({
          title: report.title,
          description: report.description,
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

  const downloadCertPdf = () => {
    if (!certificateUrl) {
        toast.error("Certificate not found");
        return;
    }
    window.open(certificateUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isReadOnly =
    report?.status === "Approved" || report?.status === "Completed" || report?.status === "Under Review";

  return (
    <div className="space-y-6 flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Project Report Submission
          </h1>
          {report?.status && (
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
          <p className="text-slate-500 mt-2">
            Submit your final project document (PDF) or Google Drive link for review.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
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
              className="gap-2 flex-1 sm:flex-none"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </Button>
          )}

          {report?.status !== "Approved" && report?.status !== "Completed" && (
            <Button
              onClick={handleSubmitForReview}
              className="flex-1 sm:flex-none gap-2 bg-[#2563EB] hover:bg-blue-700 text-white"
              disabled={saving || report?.status === "Under Review"}
            >
              <CheckCircle2 className="w-4 h-4" />
              {report?.status === "Under Review" ? "Submitted" : "Submit for Review"}
            </Button>
          )}
        </div>
      </div>

      {report?.admin_feedback && (report.status === "Draft" || report.status === "Rejected") && (
        <div className={`p-4 border rounded-xl flex gap-3 mb-6 shrink-0 ${report.status === "Rejected" ? "bg-red-50 border-red-200 text-red-800" : "bg-orange-50 border-orange-200 text-orange-800"}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${report.status === "Rejected" ? "text-red-500" : "text-orange-500"}`} />
          <div>
            <h4 className="font-bold">{report.status === "Rejected" ? "Report Rejected" : "Modifications Requested"}</h4>
            <p className="text-sm mt-1 whitespace-pre-wrap">{report.admin_feedback}</p>
          </div>
        </div>
      )}

      {/* Certificate Panel if Approved/Completed */}
      {(report?.status === 'Approved' || report?.status === 'Completed') && certificateUrl && (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-xl overflow-hidden mb-6 shrink-0">
          <div className="p-8 sm:p-12 text-center text-white flex flex-col items-center">
            <Award className="w-16 h-16 mb-4 text-indigo-100" />
            <h2 className="text-3xl font-bold mb-2">Congratulations!</h2>
            <p className="text-indigo-100 max-w-lg mb-8">
              Your project report has been approved and your certificate is ready. You have officially completed the program requirements.
            </p>
            <Button
              onClick={downloadCertPdf}
              className="bg-white text-indigo-600 hover:bg-slate-50 font-bold py-6 px-8 rounded-xl text-lg gap-3"
            >
              <Download className="w-6 h-6" />
              Download Certificate
            </Button>
          </div>
        </div>
      )}
      
      {(report?.status === 'Approved' || report?.status === 'Completed') && !certificateUrl && (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-xl overflow-hidden mb-6 shrink-0">
          <div className="p-8 sm:p-12 text-center text-white flex flex-col items-center">
            <Award className="w-16 h-16 mb-4 text-blue-100" />
            <h2 className="text-3xl font-bold mb-2">Project Approved!</h2>
            <p className="text-blue-100 max-w-lg mb-8">
              Your project report has been approved. Your certificate will be uploaded here by the admin soon.
            </p>
          </div>
        </div>
      )}

      {/* Main Submission Form */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6 flex-1 max-w-3xl">
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
              Upload your report to Google Drive and paste the public link below, or use the online builder to generate your PDF.
            </p>

            {showBuilder && !isReadOnly ? (
              <ReportBuilder 
                onComplete={() => setShowBuilder(false)} 
                onCancel={() => setShowBuilder(false)} 
                onDriveLinkGenerated={(link) => {
                  setReport({ ...report, description: link });
                  setUnsavedChanges(true);
                  setShowBuilder(false);
                }}
              />
            ) : (
              <div>
                {!isReadOnly && (
                  <div className="flex gap-4 mb-4">
                    <Button 
                      type="button" 
                      onClick={() => setShowBuilder(true)}
                      className="w-full h-12 gap-2 bg-slate-800 hover:bg-slate-900 text-white"
                    >
                      <FileText className="w-5 h-5" />
                      Build Report Online (Generates PDF)
                    </Button>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const FileIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
