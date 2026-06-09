import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Batch } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog } from '../../components/ui/dialog';
import { Plus, Loader2, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
  
  const [newBatch, setNewBatch] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: ''
  });

  const navigate = useNavigate();

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBatches(data || []);
    } catch (error: any) {
      toast.error('Failed to load batches: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase.from('batches').insert([{
        name: newBatch.name,
        description: newBatch.description,
        start_date: newBatch.start_date || null,
        end_date: newBatch.end_date || null,
        created_by: userData.user.id
      }]);

      if (error) throw error;

      toast.success('Batch created successfully');
      setIsCreateOpen(false);
      setNewBatch({ name: '', description: '', start_date: '', end_date: '' });
      fetchBatches();
    } catch (error: any) {
      toast.error('Failed to create batch: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    if (!batchToDelete) return;
    try {
      // First, get all students enrolled in this batch
      const { data: enrolled } = await supabase.from('batch_students').select('student_id').eq('batch_id', batchToDelete);
      
      // Manually delete dependent records because of potential missing CASCADE in existing DB setup
      await supabase.from('attendance_sessions').delete().eq('batch_id', batchToDelete);
      await supabase.from('content_posts').delete().eq('batch_id', batchToDelete);
      await supabase.from('batch_students').delete().eq('batch_id', batchToDelete);

      const { error } = await supabase.from('batches').delete().eq('id', batchToDelete);
      if (error) throw error;
      
      // Delete their profiles to completely remove auth access
      if (enrolled && enrolled.length > 0) {
        // We call the RPC delete_user for each to ensure full cascade cleanup
        for (const enrollment of enrolled) {
          const { error: profileError } = await supabase.rpc('delete_user', { user_id: enrollment.student_id });
          if (profileError) {
            console.error('Failed to remove student auth access for', enrollment.student_id, profileError);
          }
        }
      }

      toast.success('Batch and associated students deleted');
      fetchBatches();
      setBatchToDelete(null);
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
      setBatchToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Batches</h1>
          <p className="text-sm text-slate-500 mt-1">Manage training batches and student enrollments</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Batch
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Batch Name</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">End Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No batches found. Create one to get started.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{batch.name}</td>
                    <td className="px-6 py-4 text-slate-600">{batch.start_date ? formatDate(batch.start_date) : '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{batch.end_date ? formatDate(batch.end_date) : '-'}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/batches/${batch.id}`)} title="View Detail">
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setBatchToDelete(batch.id)} className="text-red-500 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog isOpen={isCreateOpen} onClose={() => !isSubmitting && setIsCreateOpen(false)} title="Create New Batch" description="Enter the details for the new training batch.">
        <form onSubmit={handleCreateBatch} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Batch Name</Label>
            <Input id="name" required value={newBatch.name} onChange={e => setNewBatch({...newBatch, name: e.target.value})} placeholder="e.g. Full Stack Web Dev - 2024" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" value={newBatch.description} onChange={e => setNewBatch({...newBatch, description: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input id="start_date" type="date" value={newBatch.start_date} onChange={e => setNewBatch({...newBatch, start_date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input id="end_date" type="date" value={newBatch.end_date} onChange={e => setNewBatch({...newBatch, end_date: e.target.value})} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Create Batch</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!batchToDelete} onClose={() => setBatchToDelete(null)} title="Delete Batch">
        <div className="space-y-4">
          <p className="text-slate-600">Are you sure you want to delete this batch?</p>
          <p className="text-sm text-slate-500">All associated enrollments, content, and attendance will be deleted. This action cannot be undone.</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setBatchToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete Batch</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
