import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Trash2, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminStudents() {
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentToDelete, setStudentToDelete] = useState<{id: string, name: string} | null>(null);

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

      if (error) throw error;
      setStudents(data || []);
    } catch (error: any) {
      toast.error('Failed to load students: ' + error.message);
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Students</h1>
        <p className="text-sm text-slate-500 mt-1">Manage global student profiles</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <p>No students found in the system.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{student.full_name}</td>
                  <td className="px-6 py-4 text-slate-600">{student.email}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <a 
                      href={`mailto:${student.email}`}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-bold transition-colors hover:bg-slate-100 hover:text-[#2563EB] h-9 px-3"
                      title="Email Student"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setStudentToDelete({id: student.id, name: student.full_name})} 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
