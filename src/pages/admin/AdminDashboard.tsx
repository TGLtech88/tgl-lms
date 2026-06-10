import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, BookOpen, CheckSquare, Layers, ArrowLeft, Activity, FileText, CheckCircle2, ChevronRight, User, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  // States for Batch Level Stats
  const [batchStats, setBatchStats] = useState({
    totalStudents: 0,
    reportsSubmitted: 0,
    reportsPending: 0,
  });
  const [batchStudents, setBatchStudents] = useState<any[]>([]);

  // States for Student Level Stats
  const [studentStats, setStudentStats] = useState<any>({
    attendancePresent: 0,
    attendanceTotal: 0,
    reportsSubmitted: 0,
    reports: [],
    completionPercentage: 0
  });

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch && !selectedStudent) {
      loadBatchDetails(selectedBatch.id);
    }
  }, [selectedBatch, selectedStudent]);

  useEffect(() => {
    if (selectedStudent) {
      loadStudentDetails(selectedStudent.id);
    }
  }, [selectedStudent]);

  async function fetchBatches() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBatches(data || []);
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadBatchDetails(batchId: string) {
    setLoading(true);
    try {
      // 1. Get batch students
      const { data: stdData, error: stdErr } = await supabase
        .from('batch_students')
        .select(`
          student_id,
          profiles:student_id (id, full_name, email)
        `)
        .eq('batch_id', batchId);
      
      if (stdErr) throw stdErr;
      const students = stdData || [];
      setBatchStudents(students);

      // 2. Get reports for this batch
      const { data: repData, error: repErr } = await supabase
        .from('project_reports')
        .select('id, status')
        .eq('batch_id', batchId)
        .neq('status', 'Draft');

      if (repErr) throw repErr;

      const reports = repData || [];
      const submittedCount = reports.length;
      const pendingCount = reports.filter(r => r.status === 'Pending' || r.status === 'Under Review').length;

      // 3. Mock Active students (could be recent logins, here we just say total for now or calculate based on attendance)
      // To get real active students we might count those who have >0 attendance or journals in last 7 days.
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      const { data: activeData } = await supabase
        .from('daily_journals')
        .select('student_id')
        .gte('created_at', lastWeek.toISOString())
        .eq('batch_id', batchId);

      const uniqueActive = new Set((activeData || []).map(r => r.student_id)).size;

      setBatchStats({
        totalStudents: students.length,
        //activeStudents: uniqueActive, // those who submitted journals recently
        reportsSubmitted: submittedCount,
        reportsPending: pendingCount
      });

    } catch (err: any) {
      toast.error('Error loading batch data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudentDetails(studentId: string) {
    setLoading(true);
    try {
      const [allSessionsRes, attendRes, repRes, journalRes, contentTotalRes, contentProgressRes] = await Promise.all([
        supabase.from('attendance_sessions').select('id, session_date, content_posts(title), is_open, code_expires_at').eq('batch_id', selectedBatch.id).order('session_date', { ascending: false }),
        supabase.from('attendance_records').select('session_id, is_approved, marked_at').eq('student_id', studentId),
        supabase.from('project_reports').select('*').eq('student_id', studentId).eq('batch_id', selectedBatch.id).order('updated_at', { ascending: false }),
        supabase.from('daily_journals').select('*').eq('student_id', studentId).eq('batch_id', selectedBatch.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('batch_id', selectedBatch.id),
        supabase.from('content_progress').select('post_id, content_posts!inner(batch_id)').eq('student_id', studentId).eq('content_posts.batch_id', selectedBatch.id)
      ]);

      const allSessions = allSessionsRes.data || [];
      const records = attendRes.data || [];
      
      const attendanceBreakdown = allSessions.map(session => {
        const record = records.find(r => r.session_id === session.id);
        const isPast = new Date(session.code_expires_at) < new Date();
        return {
           id: session.id,
           date: session.session_date,
           topic: (session as any).content_posts?.title || (Array.isArray(session.content_posts) ? session.content_posts[0]?.title : 'General Session') || 'General Session',
           isPresent: record ? record.is_approved : false,
           isPending: record ? !record.is_approved : false,
           isAbsent: !record && isPast,
           isOpen: session.is_open,
           record
        };
      });

      const present = attendanceBreakdown.filter(a => a.isPresent).length;
      const totalSessions = allSessions.length;

      // Calculate total completion percentage based on content read
      let completionValue = 0;
      const totalContents = contentTotalRes.count || 0;
      const completedContents = contentProgressRes.data?.length || 0;
      if (totalContents > 0) {
        completionValue = Math.round((completedContents / totalContents) * 100);
      }

      setStudentStats({
        attendancePresent: present,
        attendanceTotal: totalSessions,
        attendanceBreakdown,
        reportsSubmitted: (repRes.data || []).length,
        reports: repRes.data || [],
        completionPercentage: completionValue
      });

    } catch (err: any) {
      toast.error("Error loading student details");
    } finally {
      setLoading(false);
    }
  }

  const downloadStudentAttendanceCSV = () => {
    if (!studentStats || !studentStats.attendanceBreakdown || !selectedStudent) return;
    
    const rows = studentStats.attendanceBreakdown.map((s: any) => {
      const status = s.isPresent ? 'Present' : s.isPending ? 'Pending' : s.isAbsent ? 'Absent' : s.isOpen ? 'Open' : 'Not Marked';
      return {
        Date: s.date,
        Topic: s.topic,
        Status: status
      };
    });

    if (rows.length === 0) {
      return toast.warning("No attendance data to download");
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvRows = rows.map((row: any) => Object.values(row).map(val => `"${val}"`).join(','));
    const csv = [headers, ...csvRows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedStudent.full_name || selectedStudent.profiles?.full_name || 'Student'}_attendance_history_${selectedBatch.name}.csv`.replace(/[^a-z0-9_.-]/gi, '_');
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // View: Batch List
  if (!selectedBatch) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Track Progress</h1>
          <p className="text-sm text-slate-500 mt-1">Select a batch to monitor student activity and progress</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {batches.map(batch => (
              <Card 
                key={batch.id} 
                className="cursor-pointer hover:border-blue-500 transition-colors shadow-sm"
                onClick={() => setSelectedBatch(batch)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold text-slate-900">{batch.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">{batch.description || "No description"}</p>
                  <div className="flex items-center text-sm font-medium text-blue-600">
                    View Progress <ChevronRight className="h-4 w-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
            {batches.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
                No active batches found.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // View: Batch Progress
  if (selectedBatch && !selectedStudent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedBatch(null)} className="h-8 md:h-10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedBatch.name} Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Overall batch metrics and student progress</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>)}
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Total Students</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{batchStats.totalStudents}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Reports Submitted</CardTitle>
                  <FileText className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{batchStats.reportsSubmitted}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Reports Pending</CardTitle>
                  <CheckSquare className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{batchStats.reportsPending}</div>
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">Student List</h3>
                <p className="text-sm text-slate-500">Select a student to view their detailed progress</p>
              </div>
              {batchStudents.length === 0 ? (
                <div className="p-10 text-center text-slate-500">No students enrolled in this batch.</div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Student Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {batchStudents.map(({ profiles: student }) => (
                      <tr key={student.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedStudent(student)}>
                        <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                          <User className="h-4 w-4 text-slate-400" />
                          {student.full_name}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{student.email}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" className="text-blue-600">Track Progress <ChevronRight className="h-4 w-4 ml-1" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // View: Student Progress Tracker
  if (selectedStudent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)} className="h-8 md:h-10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{selectedStudent.full_name}'s Progress</h1>
            <p className="text-sm text-slate-500 mt-1">{selectedStudent.email} • {selectedBatch.name}</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>)}
            </div>
            <div className="h-64 bg-slate-200 rounded-xl"></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Attendance Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {studentStats.attendanceTotal > 0 
                      ? Math.round((studentStats.attendancePresent / studentStats.attendanceTotal) * 100) 
                      : 0}%
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Present: {studentStats.attendancePresent} / {studentStats.attendanceTotal}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Reports Submitted</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{studentStats.reportsSubmitted}</div>
                  <p className="text-sm text-slate-500 mt-1">Total project reports</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-500">Course Completion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" className="stroke-slate-100" />
                        <circle 
                          cx="50" cy="50" r="45" fill="none" strokeWidth="8" 
                          className="stroke-blue-600 transition-all duration-1000 ease-in-out"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (283 * (studentStats.completionPercentage || 0)) / 100}
                          strokeLinecap="round" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-slate-900">{studentStats.completionPercentage}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Overall Progress</p>
                      <p className="text-xs text-slate-500 mt-0.5">Based on content viewed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Recent Project Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  {studentStats.reports.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No reports submitted.</p>
                  ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {studentStats.reports.map((report: any) => (
                        <div key={report.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-slate-800 text-sm">{report.title || "Untitled Report"}</h4>
                            <span className="text-xs text-slate-500">{formatDate(report.updated_at)}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-md text-xs font-medium 
                            ${report.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                              report.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 
                              report.status === 'Draft' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {report.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Attendance History</CardTitle>
                  <Button variant="ghost" size="sm" className="text-blue-600 h-8" onClick={downloadStudentAttendanceCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </CardHeader>
                <CardContent>
                  {!studentStats.attendanceBreakdown || studentStats.attendanceBreakdown.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No attendance sessions found.</p>
                  ) : (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {studentStats.attendanceBreakdown.map((session: any) => (
                        <div key={session.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-slate-800 text-sm">{formatDate(session.date)}</h4>
                            <span className="text-xs text-slate-500 truncate max-w-[200px] block">{session.topic}</span>
                          </div>
                          <div>
                            {session.isPresent ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 block text-center min-w-[80px]">
                                Present
                              </span>
                            ) : session.isPending ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 block text-center min-w-[80px]">
                                Pending
                              </span>
                            ) : session.isAbsent ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 block text-center min-w-[80px]">
                                Absent
                              </span>
                            ) : session.isOpen ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 block text-center min-w-[80px]">
                                Open
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 block text-center min-w-[80px]">
                                Not Marked
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}
