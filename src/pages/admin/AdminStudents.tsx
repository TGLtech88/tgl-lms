import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Trash2, Loader2, Mail, Edit, Phone, Building2, BookOpen, GraduationCap, KeyRound, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export default function AdminStudents() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentToDelete, setStudentToDelete] = useState<{id: string, name: string} | null>(null);
  
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    college: '',
    branch: '',
    semester: '',
    phone: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [passwordResetData, setPasswordResetData] = useState<{id: string, name: string, email: string, newPassword?: string} | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      // @ts-ignore - ignore the case where columns don't exist yet but no error thrown
      if (error && error.code !== 'PGRST204') throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (student: Profile) => {
    setEditingStudent(student);
    setEditForm({
      college: student.college || '',
      branch: student.branch || '',
      semester: student.semester || '',
      phone: student.phone || ''
    });
  };

  const handleSaveStudent = async () => {
    if (!editingStudent) return;
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          college: editForm.college,
          branch: editForm.branch,
          semester: editForm.semester,
          phone: editForm.phone
        })
        .eq('id', editingStudent.id);

      if (error) {
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          toast.error('Database columns missing. Please ask to run the SQL to add these columns first.');
          return;
        }
        throw error;
      }
      
      toast.success(`Details for ${editingStudent.full_name} updated.`);
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      toast.error('Failed to update student: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!studentToDelete) return;
    try {
      // Call the secure RPC function to eliminate the auth user, profile, and enrollments
      const { error } = await supabase.rpc('delete_user', { user_id: studentToDelete.id });
      
      if (error) throw error;
      
      toast.success(`Student ${studentToDelete.name} deleted successfully.`);
      fetchStudents();
      setStudentToDelete(null);
    } catch (error: any) {
      toast.error('Failed to delete student: ' + error.message);
      setStudentToDelete(null);
    }
  };

  const handleResetPassword = async () => {
    if (!passwordResetData) return;
    try {
      setIsResetting(true);
      const newPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10); // Generate simple secure password
      
      const { error } = await supabase.rpc('admin_update_user_password', { 
        target_user_id: passwordResetData.id,
        new_password: newPassword
      });
      
      if (error) throw error;
      
      setPasswordResetData({ ...passwordResetData, newPassword });
      toast.success('Password successfully regenerated.');
    } catch (error: any) {
      toast.error('Failed to reset password: ' + (error.message || 'Unknown error'));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Students</h1>
        <p className="text-sm text-slate-500 mt-1">Manage global student profiles</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <p>No students found in the system.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left whitespace-nowrap min-w-[800px]">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Name & Email</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Academic Info</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{student.full_name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{student.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-slate-700">
                      <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                      {student.phone || <span className="text-slate-400 italic">No phone</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-slate-700 text-xs">
                        <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        {student.college || <span className="text-slate-400 italic">No college</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs mt-1">
                        <span className="flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {student.branch || '?'}
                        </span>
                        <span className="flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          <GraduationCap className="w-3 h-3 mr-1" />
                          Sem: {student.semester || '?'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-500">Joined</div>
                    <div className="font-medium text-slate-700">
                      {student.created_at ? formatDate(student.created_at) : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <a 
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${student.email}`}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold transition-colors hover:bg-slate-100 hover:text-blue-600 h-9 w-9"
                      title="Email Student"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEditClick(student)} 
                      className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit Details"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setPasswordResetData({id: student.id, name: student.full_name, email: student.email})} 
                      className="text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setStudentToDelete({id: student.id, name: student.full_name})} 
                      className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                      title="Delete Student"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog isOpen={!!passwordResetData} onClose={() => !isResetting && setPasswordResetData(null)} title="Reset Student Password">
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-4">
            <h3 className="font-bold text-slate-800">{passwordResetData?.name}</h3>
            <p className="text-sm text-slate-500">{passwordResetData?.email}</p>
          </div>
          
          {!passwordResetData?.newPassword ? (
             <>
               <p className="text-slate-600 text-sm">
                 You are about to regenerate the password for this student. They will be logged out of all active sessions and will need to use the new password to log back in.
               </p>
               <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                 <Button variant="outline" onClick={() => setPasswordResetData(null)} disabled={isResetting}>Cancel</Button>
                 <Button onClick={handleResetPassword} isLoading={isResetting}>Generate New Password</Button>
               </div>
             </>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200">
                <p className="font-medium mb-2 text-sm text-green-800">Password successfully reset!</p>
                <div className="flex items-center justify-between bg-white p-3 rounded border border-green-100">
                  <code className="text-green-900 font-bold tracking-wider">{passwordResetData.newPassword}</code>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white"
                    onClick={() => {
                       navigator.clipboard.writeText(`Your new password is: ${passwordResetData.newPassword}`);
                       toast.success('Password copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2 text-slate-500" />
                    Copy
                  </Button>
                </div>
              </div>
              <div className="pt-2">
                <Button className="w-full" onClick={() => setPasswordResetData(null)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>

      <Dialog isOpen={!!editingStudent} onClose={() => !isSubmitting && setEditingStudent(null)} title="Edit Student Details">
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
            <h3 className="font-bold text-slate-800">{editingStudent?.full_name}</h3>
            <p className="text-sm text-slate-500">{editingStudent?.email}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input 
                id="phone" 
                value={editForm.phone} 
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})} 
                placeholder="+1 234 567 8900"
              />
            </div>
            
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="college">College / University</Label>
              <Input 
                id="college" 
                value={editForm.college} 
                onChange={(e) => setEditForm({...editForm, college: e.target.value})} 
                placeholder="e.g. State University"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="branch">Branch / Major</Label>
              <Input 
                id="branch" 
                value={editForm.branch} 
                onChange={(e) => setEditForm({...editForm, branch: e.target.value})} 
                placeholder="e.g. Computer Science"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="semester">Current Semester</Label>
              <Input 
                id="semester" 
                value={editForm.semester} 
                onChange={(e) => setEditForm({...editForm, semester: e.target.value})} 
                placeholder="e.g. 6th"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditingStudent(null)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSaveStudent} isLoading={isSubmitting}>Save Details</Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={!!studentToDelete} onClose={() => setStudentToDelete(null)} title="Delete Student">
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to permanently delete student "{studentToDelete?.name}"?
          </p>
          <p className="text-sm text-slate-500">
            This will remove their profile and all associated enrollments and attendance records. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setStudentToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete Student</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
