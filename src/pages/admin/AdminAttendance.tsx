import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Card, CardContent } from '../../components/ui/card';
import { Loader2, PlusCircle, UserCheck, XCircle, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';
import { Label } from '../../components/ui/label';

export default function AdminAttendance() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSessionData, setNewSessionData] = useState({
    batch_id: '',
    post_id: ''
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [isRecordsOpen, setIsRecordsOpen] = useState(false);

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportBatchId, setExportBatchId] = useState('');

  useEffect(() => {
    fetchData();

    // Auto-close sessions after 5 minutes (when code_expires_at is reached)
    const interval = setInterval(() => {
      setSessions((prevSessions) => {
        let hasChanges = false;
        const now = new Date();
        
        const nextSessions = prevSessions.map(session => {
          if (session.is_open && new Date(session.code_expires_at) <= now) {
            hasChanges = true;
            // Update in DB silently
            supabase.from('attendance_sessions').update({ is_open: false }).eq('id', session.id).then();
            return { ...session, is_open: false };
          }
          return session;
        });

        return hasChanges ? nextSessions : prevSessions;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sessionsRes, batchesRes, postsRes] = await Promise.all([
        supabase.from('attendance_sessions').select('*, batches(name), content_posts(title)').order('created_at', { ascending: false }),
        supabase.from('batches').select('id, name'),
        supabase.from('content_posts').select('id, title, batch_id')
      ]);

      setSessions(sessionsRes.data || []);
      setBatches(batchesRes.data || []);
      setPosts(postsRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionData.batch_id || !newSessionData.post_id) {
      return toast.error('Check all fields');
    }

    try {
      setIsSubmitting(true);
      const { data: userData } = await supabase.auth.getUser();
      
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

      const { error } = await supabase.from('attendance_sessions').insert([{
        batch_id: newSessionData.batch_id,
        post_id: newSessionData.post_id,
        session_date: new Date().toISOString().split('T')[0],
        attendance_code: code,
        code_expires_at: expiresAt,
        is_open: true,
        created_by: userData.user?.id
      }]);

      if (error) throw error;
      toast.success('Attendance session opened');
      setIsNewOpen(false);
      setNewSessionData({ batch_id: '', post_id: '' });
      fetchData();
    } catch(err: any) {
      toast.error('Failed to open session: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSession = async (id: string) => {
    try {
       const { error } = await supabase.from('attendance_sessions').update({ is_open: false }).eq('id', id);
       if (error) throw error;
       toast.success("Session closed");
       fetchData();
    } catch(err: any) {
       toast.error(err.message);
    }
  };

  const viewRecords = async (sessionId: string) => {
    try {
      setActiveSessionId(sessionId);
      setIsRecordsOpen(true);
      
      const { data: sessionData } = await supabase.from('attendance_sessions').select('batch_id').eq('id', sessionId).single();
      if (!sessionData) return;

      const [studentsRes, recordsRes] = await Promise.all([
        supabase.from('batch_students').select('student_id, profiles(full_name, email)').eq('batch_id', sessionData.batch_id),
        supabase.from('attendance_records').select('*').eq('session_id', sessionId)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (recordsRes.error) throw recordsRes.error;

      const mergedRecords = (studentsRes.data || []).map((bs: any) => {
        const record = recordsRes.data?.find(r => r.student_id === bs.student_id);
        return {
          id: record ? record.id : `absent-${bs.student_id}`,
          student_id: bs.student_id,
          profiles: bs.profiles,
          marked_at: record ? record.marked_at : null,
          is_approved: record ? record.is_approved : false,
          is_present: !!record
        };
      });

      setRecords(mergedRecords || []);
    } catch(err: any) {
      toast.error(err.message);
    }
  };

  const handleApprove = async (recordId: string) => {
     try {
       const { data: user } = await supabase.auth.getUser();
       const { error } = await supabase.from('attendance_records').update({
         is_approved: true,
         approved_by: user.user?.id,
         approved_at: new Date().toISOString()
       }).eq('id', recordId);
       
       if (error) throw error;
       toast.success("Approved");
       viewRecords(activeSessionId!);
     } catch (err: any) {
       toast.error(err.message);
     }
  };

  const handleReject = async (recordId: string) => {
    try {
      const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
      if (error) throw error;
      toast.success("Record rejected/removed");
      viewRecords(activeSessionId!);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleManualMarkPresent = async (studentId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('attendance_records').insert({
        session_id: activeSessionId!,
        student_id: studentId,
        is_approved: true,
        approved_by: user.user?.id,
        approved_at: new Date().toISOString()
      });
      if (error) throw error;
      toast.success("Student marked present manually");
      viewRecords(activeSessionId!);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const downloadBatchSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exportBatchId) return toast.error("Please select a batch");

    try {
      const selectedBatch = batches.find(b => b.id === exportBatchId);
      if (!selectedBatch) return;

      const { data: students } = await supabase.from('batch_students').select('student_id, profiles(full_name, email)').eq('batch_id', exportBatchId);
      const { data: sessions } = await supabase.from('attendance_sessions').select('id, session_date, content_posts(title)').eq('batch_id', exportBatchId).order('session_date', { ascending: true });
      
      if (!students || students.length === 0) {
        toast.warning("No students found in this batch.");
        return;
      }
      
      const sessionIds = sessions ? sessions.map(s => s.id) : [];
      let records: any[] = [];
      if (sessionIds.length > 0) {
        const { data: recs } = await supabase.from('attendance_records').select('*').in('session_id', sessionIds).eq('is_approved', true);
        records = recs || [];
      }

      const rows = students.map(student => {
        const bs = student as any;
        const studentInfo: any = {
           Name: bs.profiles?.full_name || 'N/A',
           Email: bs.profiles?.email || 'N/A'
        };

        let attended = 0;
        
        sessions?.forEach(session => {
           const hasAttended = records.some(r => r.session_id === session.id && r.student_id === bs.student_id);
           if (hasAttended) attended++;
           studentInfo[session.session_date] = hasAttended ? 'Present' : 'Absent';
        });

        const totalSessions = sessions?.length || 0;
        studentInfo['Total Sessions'] = totalSessions;
        studentInfo['Sessions Attended'] = attended;
        studentInfo['Attendance Percentage'] = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) + '%' : '0%';
        
        return studentInfo;
      });

      if (rows.length === 0) return;
      
      const headers = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row => 
        Object.values(row).map(val => `"${val}"`).join(',')
      );
      const csv = [headers, ...csvRows].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `${selectedBatch.name}_Attendance_Summary_${dateStr}.csv`.replace(/[^a-z0-9_.-]/gi, '_');
      a.click();
      window.URL.revokeObjectURL(url);
      
      setIsExportOpen(false);
      setExportBatchId('');
    } catch(err: any) {
      toast.error("Failed to export summary: " + err.message);
    }
  };

  const downloadSessionCSV = async (sessionId: string, sessionDate: string) => {
    try {
      const { data: sessionData } = await supabase.from('attendance_sessions').select('batch_id, content_posts(title)').eq('id', sessionId).single();
      if (!sessionData) return;

      const [studentsRes, recordsRes] = await Promise.all([
        supabase.from('batch_students').select('student_id, profiles(full_name, email)').eq('batch_id', sessionData.batch_id),
        supabase.from('attendance_records').select('*').eq('session_id', sessionId)
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (recordsRes.error) throw recordsRes.error;

      const mergedRecords = (studentsRes.data || []).map((bs: any) => {
        const record = recordsRes.data?.find(r => r.student_id === bs.student_id);
        return {
          Name: bs.profiles?.full_name || 'N/A',
          Email: bs.profiles?.email || 'N/A',
          Status: record ? (record.is_approved ? 'Present' : 'Pending') : 'Absent',
          MarkedAt: record && record.marked_at ? new Date(record.marked_at).toLocaleString() : 'N/A'
        };
      });

      if (mergedRecords.length === 0) {
        return toast.warning("No students in this batch");
      }

      const headers = Object.keys(mergedRecords[0]).join(',');
      const csvRows = mergedRecords.map(row => 
        Object.values(row).map(val => `"${val}"`).join(',')
      );
      const csv = [headers, ...csvRows].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attendance_${sessionDate}_${(sessionData as any).content_posts?.title || 'Session'}.csv`.replace(/[^a-z0-9_.-]/gi, '_');
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(err: any) {
      toast.error("Failed to export: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and approve attendance sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsExportOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Export Batch Summary
          </Button>
          <Button onClick={() => setIsNewOpen(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Open New Session
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Content Topic</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No sessions found.
                  </td>
                </tr>
              ) : (
                sessions.map(session => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{formatDate(session.session_date)}</td>
                    <td className="px-6 py-4 text-slate-600">{session.batches?.name}</td>
                    <td className="px-6 py-4 text-slate-600 line-clamp-1">{session.content_posts?.title}</td>
                    <td className="px-6 py-4">
                      {session.is_open ? (
                         <div className="flex items-center gap-3">
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 animate-pulse">
                             <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> Live
                           </span>
                           <span className="font-mono font-bold text-base tracking-wider text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                             {session.attendance_code}
                           </span>
                         </div>
                      ) : (
                         <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                           Closed
                         </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 mr-1" onClick={() => downloadSessionCSV(session.id, session.session_date)} title="Download Report">
                         <Download className="h-4 w-4" />
                       </Button>
                       {session.is_open ? (
                         <Button variant="outline" size="sm" onClick={() => closeSession(session.id)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                           Close Session
                         </Button>
                       ) : (
                         <Button variant="outline" size="sm" onClick={() => viewRecords(session.id)}>
                           Review Approvals
                         </Button>
                       )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog isOpen={isNewOpen} onClose={() => !isSubmitting && setIsNewOpen(false)} title="Open Attendance Session" description="Creates a live 5-minute code for students to enter.">
        <form onSubmit={handleOpenSession} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="batch">Select Batch</Label>
            <select 
              id="batch"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={newSessionData.batch_id}
              onChange={e => setNewSessionData({...newSessionData, batch_id: e.target.value, post_id: ''})}
              required
            >
              <option value="">Select a batch...</option>
              {batches.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post">Content Topic (Topic of the day)</Label>
            <select 
              id="post"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              value={newSessionData.post_id}
              onChange={e => setNewSessionData({...newSessionData, post_id: e.target.value})}
              required
              disabled={!newSessionData.batch_id}
            >
              <option value="">Select a topic...</option>
              {posts.filter(p => p.batch_id === newSessionData.batch_id).map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsNewOpen(false)} className="mr-2">Cancel</Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-red-500 hover:bg-red-600">Start 5-Minute Session</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={isRecordsOpen} onClose={() => setIsRecordsOpen(false)} title="Attendance Approvals" className="max-w-2xl">
        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {records.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">No records found for this session.</div>
          ) : (
            <div className="space-y-3">
              {records.map(record => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div>
                    <h4 className="font-medium text-slate-900">{record.profiles?.full_name}</h4>
                    <p className="text-sm text-slate-500">{record.profiles?.email}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {record.is_present && record.marked_at ? `Submitted at ${new Date(record.marked_at).toLocaleTimeString()}` : 'Not submitted'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.is_present ? (
                      record.is_approved ? (
                        <>
                          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-200">
                            <UserCheck className="h-4 w-4" /> Present
                          </span>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2" onClick={() => handleReject(record.id)} title="Mark Absent / Remove">
                            Undo
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(record.id)}>
                             <XCircle className="h-4 w-4 mr-1.5" /> Reject
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleApprove(record.id)}>
                             <UserCheck className="h-4 w-4 mr-1.5" /> Approve
                          </Button>
                        </>
                      )
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 text-sm font-medium rounded-md border border-red-200">
                          <XCircle className="h-4 w-4" /> Absent
                        </span>
                        <Button variant="outline" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200" onClick={() => handleManualMarkPresent(record.student_id)}>
                           Override
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
      <Dialog isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} title="Export Batch Summary">
        <form onSubmit={downloadBatchSummary} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="export_batch">Select Batch</Label>
            <select 
              id="export_batch"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={exportBatchId}
              onChange={e => setExportBatchId(e.target.value)}
              required
            >
              <option value="">Select a batch...</option>
              {batches.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-2">This will download a CSV containing the attendance summary for all students in this batch across all sessions.</p>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsExportOpen(false)} className="mr-2">Cancel</Button>
            <Button type="submit" className="gap-2"><Download className="w-4 h-4"/> Download CSV</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
