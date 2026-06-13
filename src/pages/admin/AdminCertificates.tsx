import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Upload, Award, CheckCircle2, User, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

export default function AdminCertificates() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load applicable students
      const { data: reportsData, error: reportsError } = await supabase
        .from('project_reports')
        .select(`
          id,
          status,
          student_id,
          profiles:student_id (id, full_name, email),
          batches:batch_id (name, start_date, end_date)
        `)
        .in('status', ['Approved', 'Completed']);

      if (reportsError) throw reportsError;
      setStudents(reportsData || []);

      // Load uploaded certificates list
      const { data: filesData, error: filesError } = await supabase
        .storage
        .from('journals')
        .list('certificates');
        
      if (!filesError && filesData) {
         setUploadedFiles(filesData.map(f => f.name));
      }

    } catch (error: any) {
      toast.error('Failed to load certificates data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, studentId: string) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
          toast.error("Please upload a PDF file");
          return;
      }
      
      try {
        setUploadingFor(studentId);
        const fileName = `certificates/${studentId}.pdf`;
        
        const { error: uploadError } = await supabase.storage
          .from('journals')
          .upload(fileName, file, { upsert: true });
          
        if (uploadError) throw uploadError;
        
        toast.success("Certificate uploaded successfully!");
        loadData();
      } catch (err: any) {
        toast.error("Upload failed: " + err.message);
      } finally {
        setUploadingFor(null);
        e.target.value = '';
      }
  };

  const handleSendEmail = (student: any) => {
     const studentId = student.student_id;
     
     const { data: urlData } = supabase.storage
        .from('journals')
        .getPublicUrl(`certificates/${studentId}.pdf`);
     
     const subject = encodeURIComponent(`Your Certificate of Completion - ${student.batches?.name}`);
     const body = encodeURIComponent(`Dear ${student.profiles?.full_name},

Congratulations on successfully completing the ${student.batches?.name} program!

You can download your certificate of completion using the link below:
${urlData.publicUrl}

Best regards,
Admin Team`);

     const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${student.profiles?.email}&su=${subject}&body=${body}`;
     window.open(gmailUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificate Issuance</h1>
          <p className="text-slate-500">Upload PDF certificates for eligible students.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col w-full">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Eligible Students</h2>
            <p className="text-sm text-slate-500">Students with Approved or Completed project reports.</p>
          </div>
          <Award className="w-8 h-8 text-indigo-500/20" />
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
              <p className="text-sm">Approve project reports to see students here.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-white border-b border-slate-200">
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Student</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Batch</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((report) => {
                  const hasCertificate = uploadedFiles.includes(`${report.student_id}.pdf`);
                  return (
                    <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{report.profiles?.full_name}</div>
                        <div className="text-xs text-slate-500">{report.profiles?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {report.batches?.name}
                      </td>
                      <td className="px-6 py-4">
                        {hasCertificate ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center space-x-1 w-max">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Uploaded</span>
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full flex items-center space-x-1 w-max">
                            <Award className="w-3 h-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {uploadingFor === report.student_id ? (
                          <Button variant="outline" size="sm" disabled>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...
                          </Button>
                        ) : (
                          <div className="inline-block relative">
                            <input 
                              type="file" 
                              accept="application/pdf"
                              key={Date.now()}
                              onChange={(e) => handleUpload(e, report.student_id)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              title="Upload PDF Certificate"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 pointer-events-none"
                            >
                              <Upload className="w-4 h-4" />
                              {hasCertificate ? 'Replace PDF' : 'Upload PDF'}
                            </Button>
                          </div>
                        )}
                        
                        {hasCertificate && (
                          <Button 
                            variant="secondary"
                            onClick={() => handleSendEmail(report)}
                            size="sm"
                            className="gap-2 ml-2"
                          >
                            <Mail className="w-4 h-4" />
                            Email Link
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
