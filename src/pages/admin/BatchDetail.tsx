import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase';
import { Batch } from '../../types';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog } from '../../components/ui/dialog';
import { ArrowLeft, UserPlus, FileText, CheckSquare, Loader2, Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';

export default function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', college: '', branch: '', semester: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{email: string, password: string} | null>(null);

  useEffect(() => {
    fetchBatchDetails();
  }, [id]);

  const fetchBatchDetails = async () => {
    try {
      setLoading(true);
      const { data: batchData, error: batchError } = await supabase
        .from('batches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (batchError) throw batchError;
      setBatch(batchData);

      // Fetch enrolled students
      const { data: studentsData, error: studentsError } = await supabase
        .from('batch_students')
        .select(`
          id,
          enrolled_at,
          profiles:student_id (id, full_name, email)
        `)
        .eq('batch_id', id);

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);
    } catch (error: any) {
      toast.error('Failed to load batch: ' + error.message);
      navigate('/admin/batches');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      // 1. Check if user already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newStudent.email)
        .maybeSingle();

      let userId = '';

      if (existingProfile) {
        userId = existingProfile.id;

        // Check if they are already enrolled in THIS batch
        const { data: enrollments } = await supabase
          .from('batch_students')
          .select('batch_id')
          .eq('student_id', userId)
          .eq('batch_id', id);
        
        if (enrollments && enrollments.length > 0) {
          throw new Error("Student is already enrolled in this specific batch.");
        }
        
        // If we get here, they exist but all their batches have ended.
        // We can just enroll them in the new batch.
        const { error: enrollError } = await supabase.from('batch_students').insert([{
          batch_id: id,
          student_id: userId
        }]);

        if (enrollError) {
          if (enrollError.code === '23505') {
            throw new Error("Student is already enrolled in this specific batch.");
          }
          throw enrollError;
        }

        toast.success('Existing student added to the new batch successfully!');
        setNewStudent({ name: '', email: '', college: '', branch: '', semester: '', phone: '' });
        setIsAddStudentOpen(false); // Close the modal since we don't have new credentials
        fetchBatchDetails();
        return;
      }

      // If they don't exist, proceed with creating a new user
      const generatedPassword = `TGL@${Math.random().toString(36).slice(-6)}${new Date().getFullYear()}`;

      // Create a temporary client that doesn't persist the session
      // so it doesn't log the admin out out.
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        }
      });

      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: newStudent.email,
        password: generatedPassword,
        options: {
          data: {
            full_name: newStudent.name,
            role: 'student'
          }
        }
      });

      if (authError) throw authError;

      userId = authData.user?.id || '';
      if (!userId) throw new Error('User creation failed (no ID returned)');

      // Update the profile to include the new custom fields (since trigger might have already created it)
      const { error: profileUpsertError } = await supabase.from('profiles').upsert([{
        id: userId,
        full_name: newStudent.name,
        email: newStudent.email,
        role: 'student',
        college: newStudent.college || null,
        branch: newStudent.branch || null,
        semester: newStudent.semester || null,
        phone: newStudent.phone || null
      }]);

      if (profileUpsertError) {
        throw profileUpsertError;
      }

      // Now we enroll them in the batch
      const { error: enrollError } = await supabase.from('batch_students').insert([{
        batch_id: id,
        student_id: userId
      }]);

      if (enrollError) throw enrollError;

      setCredentials({ email: newStudent.email, password: generatedPassword });
      toast.success('Student account created successfully!');
      
      // Refresh list
      fetchBatchDetails();
    } catch (error: any) {
      toast.error('Failed to add student: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeRemoveStudent = async () => {
    if (!studentToRemove) return;
    try {
      // Find the profile ID for this enrollment
      const studentObj = students.find(s => s.id === studentToRemove);
      if (!studentObj || !studentObj.profiles) throw new Error('Student enrollment not found');
      
      // Completely delete the user from Auth, which cascades to everything
      const { error } = await supabase.rpc('delete_user', { user_id: studentObj.profiles.id });
      if (error) throw error;
      
      toast.success('Student removed from batch and access revoked');
      fetchBatchDetails();
      setStudentToRemove(null);
    } catch (error: any) {
      toast.error('Failed to remove student: ' + error.message);
      setStudentToRemove(null);
    }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (!batch) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/batches')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{batch.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{batch.description || 'No description provided.'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <Tabs defaultValue="students">
          <TabsList className="mb-6">
            <TabsTrigger value="students" className="px-6 py-2.5">Students</TabsTrigger>
            <TabsTrigger value="content" className="px-6 py-2.5">Content Posts</TabsTrigger>
            <TabsTrigger value="attendance" className="px-6 py-2.5">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
              <h2 className="font-semibold text-slate-900">Enrolled Students ({students.length})</h2>
              <Button onClick={() => setIsAddStudentOpen(true)} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Enrollment Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No students enrolled yet.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{student.profiles?.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{student.profiles?.email}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(student.enrolled_at)}</td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setStudentToRemove(student.id)} className="text-red-500 hover:text-red-600">
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="content">
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p>Content features will be completed via the Content Scheduler.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/content')}>Go to Content Scheduler</Button>
            </div>
          </TabsContent>

          <TabsContent value="attendance">
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
              <CheckSquare className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p>Attendance features will be accessible from the Attendance console.</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/attendance')}>Go to Attendance</Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog isOpen={isAddStudentOpen} onClose={() => {
        if (!isSubmitting) {
          setIsAddStudentOpen(false);
          setCredentials(null);
          setNewStudent({ name: '', email: '', college: '', branch: '', semester: '', phone: '' });
        }
      }} title="Add New Student">
        {!credentials ? (
          <form onSubmit={handleAddStudent} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s_name">Full Name</Label>
                <Input id="s_name" required value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s_email">Email Address</Label>
                <Input id="s_email" type="email" required value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} placeholder="john.doe@gmail.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s_phone">Phone Number (optional)</Label>
                <Input id="s_phone" value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} placeholder="+1 234 567 8900" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s_college">College / University (optional)</Label>
                <Input id="s_college" value={newStudent.college} onChange={e => setNewStudent({...newStudent, college: e.target.value})} placeholder="State University" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s_branch">Branch / Major (optional)</Label>
                <Input id="s_branch" value={newStudent.branch} onChange={e => setNewStudent({...newStudent, branch: e.target.value})} placeholder="Computer Science" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s_semester">Current Semester (optional)</Label>
                <Input id="s_semester" value={newStudent.semester} onChange={e => setNewStudent({...newStudent, semester: e.target.value})} placeholder="6th" />
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" isLoading={isSubmitting}>Create Account</Button>
            </div>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              Student account created! Please share these credentials immediately as the password cannot be recovered.
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <code className="block p-2 bg-slate-100 rounded text-slate-800">{credentials.email}</code>
              </div>
              <div className="space-y-1">
                <Label>Auto-Generated Password</Label>
                <code className="block p-2 bg-slate-100 rounded text-slate-800 font-bold">{credentials.password}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => {
                navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`);
                toast.success('Copied to clipboard');
              }} className="flex-1 gap-2" variant="outline">
                <Copy className="h-4 w-4 text-slate-500" />
                Copy
              </Button>
              <a 
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${credentials.email}&su=${encodeURIComponent('Your New App Credentials')}&body=${encodeURIComponent(`Hello ${newStudent.name},\n\nYour account has been created successfully. Here are your login credentials:\n\nEmail: ${credentials.email}\nPassword: ${credentials.password}\n\nPlease keep these safe and change your password upon logging in.\n\nRegards,\nTGL Tech Team`)}`}
                className="flex-1 inline-flex flex-row items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-colors bg-[#2563EB] hover:bg-blue-700 text-white h-10 px-4 py-2 gap-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Mail className="h-4 w-4" />
                Email Student
              </a>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={!!studentToRemove} onClose={() => setStudentToRemove(null)} title="Remove Student">
        <div className="space-y-4">
          <p className="text-slate-600">Are you sure you want to remove this student from the batch?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setStudentToRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeRemoveStudent}>Remove completely</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
