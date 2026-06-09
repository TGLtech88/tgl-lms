import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'sonner';
import { Bell, Plus, Trash2, Edit } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatDate } from '../../lib/utils';

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { user, profile } = useAuthStore();
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'notice',
    batch_id: 'global' // 'global' means null in db
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [announcementsRes, batchesRes] = await Promise.all([
        supabase.from('announcements').select('*, batches(name)').order('created_at', { ascending: false }),
        supabase.from('batches').select('id, name').order('name')
      ]);

      if (announcementsRes.error) throw announcementsRes.error;
      if (batchesRes.error) throw batchesRes.error;

      setAnnouncements(announcementsRes.data || []);
      setBatches(batchesRes.data || []);
    } catch (err: any) {
      toast.error('Failed to fetch data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('announcements').insert([{
        title: formData.title,
        content: formData.content,
        type: formData.type,
        batch_id: formData.batch_id === 'global' ? null : formData.batch_id,
        created_by: user.id
      }]);

      if (error) throw error;
      toast.success('Announcement published successfully');
      setIsModalOpen(false);
      setFormData({ title: '', content: '', type: 'notice', batch_id: 'global' });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to publish announcement: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    const announcement = announcements.find(a => a.id === id);
    if (announcement?.type === 'assignment' && profile?.role !== 'super_admin') {
      toast.error('Only super admins can delete assignments.');
      return;
    }
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success('Announcement deleted');
      setDeleteId(null);
      fetchData();
    } catch (err: any) {
      toast.error('Error deleting announcement: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'notice': return 'bg-blue-100 text-blue-800';
      case 'update': return 'bg-purple-100 text-purple-800';
      case 'assignment': return 'bg-orange-100 text-orange-800';
      case 'deadline': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
          <p className="text-sm text-slate-500 mt-1">Publish notices, updates, assignments, and deadlines</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Announcement
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full text-center text-slate-500 py-10">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-10 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Bell className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No announcements yet</h3>
            <p className="text-slate-500 mt-1">Create an announcement to notify students.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getBadgeColor(announcement.type)}`}>
                  {announcement.type}
                </span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  {announcement.batch_id ? announcement.batches?.name : 'Global (All)'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{announcement.title}</h3>
              <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap flex-1">{announcement.content}</p>
              <div className="pt-4 mt-auto border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {formatDate(announcement.created_at)}
                </span>
                {(profile?.role === 'super_admin' || announcement.type !== 'assignment') && (
                  <button
                    onClick={() => handleDeleteClick(announcement.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title="Create Announcement">
        <form onSubmit={handleCreate} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="e.g. Important Notice: Final Exam Date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
              required
            >
              <option value="notice">Notice</option>
              <option value="update">Training Update</option>
              <option value="assignment">Assignment</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch">Target Audience</Label>
            <select
              id="batch"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={formData.batch_id}
              onChange={e => setFormData({...formData, batch_id: e.target.value})}
              required
            >
              <option value="global">All Students (Global)</option>
              {batches.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content Details</Label>
            <textarea
              id="content"
              rows={4}
              required
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              placeholder="Enter announcement details..."
            />
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Publish</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteId} onClose={() => !isSubmitting && setDeleteId(null)} title="Delete Announcement">
        <div className="space-y-4">
          <p className="text-slate-600">Are you sure you want to permanently delete this announcement?</p>
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button onClick={confirmDelete} isLoading={isSubmitting} className="bg-red-500 hover:bg-red-600">Delete</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
