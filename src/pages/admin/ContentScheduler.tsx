import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Plus, Calendar as CalendarIcon, FileUp, Loader2, Edit, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';

export default function ContentScheduler() {
  const [posts, setPosts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    batch_id: '',
    description: '',
    release_date: '',
    is_published: false,
    attachments: [] as any[]
  });

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkData, setBulkData] = useState({
    batch_id: '',
    start_date: '',
    interval_days: 1,
    json_content: 'Module 1: Getting Started\nModule 2: Core Concepts\nModule 3: Advanced Topics'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [postsRes, batchesRes] = await Promise.all([
        supabase.from('content_posts').select('*, batches(name)').order('release_date', { ascending: true }),
        supabase.from('batches').select('id, name')
      ]);

      if (postsRes.error) throw postsRes.error;
      if (batchesRes.error) throw batchesRes.error;

      setPosts(postsRes.data || []);
      setBatches(batchesRes.data || []);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batch_id) return toast.error("Please select a batch");
    
    try {
      setIsSubmitting(true);
      const { data: user } = await supabase.auth.getUser();
      
      if (editingPostId) {
        const { error } = await supabase.from('content_posts').update({
          title: formData.title,
          batch_id: formData.batch_id,
          description: formData.description,
          release_date: formData.release_date,
          is_published: formData.is_published,
          attachments: formData.attachments
        }).eq('id', editingPostId);
        
        if (error) throw error;
        toast.success('Content updated successfully');
      } else {
        const { error } = await supabase.from('content_posts').insert([{
          ...formData,
          created_by: user.user?.id
        }]);
        
        if (error) throw error;
        toast.success('Content scheduled successfully');
      }

      setIsModalOpen(false);
      setEditingPostId(null);
      setFormData({ title: '', batch_id: '', description: '', release_date: '', is_published: false, attachments: [] });
      fetchData();
    } catch (err: any) {
      toast.error('Failed to save content: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (post: any) => {
    setEditingPostId(post.id);
    setFormData({
      title: post.title,
      batch_id: post.batch_id,
      description: post.description || '',
      release_date: post.release_date,
      is_published: post.is_published,
      attachments: post.attachments || []
    });
    setIsModalOpen(true);
  };

  const executeDelete = async () => {
    if (!postToDelete) return;
    try {
      const { error } = await supabase.from('content_posts').delete().eq('id', postToDelete);
      if (error) throw error;
      toast.success('Deleted successfully');
      fetchData();
      setPostToDelete(null);
    } catch(err: any) {
      toast.error('Failed to delete: ' + err.message);
      setPostToDelete(null);
    }
  };

  const togglePublished = async (post: any) => {
    try {
      const { error } = await supabase.from('content_posts').update({ is_published: !post.is_published }).eq('id', post.id);
      if (error) throw error;
      fetchData();
    } catch(err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkData.batch_id) return toast.error("Please select a batch");
    if (!bulkData.start_date) return toast.error("Please select a start date");
    
    try {
      setIsSubmitting(true);
      let parsedContent;
      try {
        parsedContent = JSON.parse(bulkData.json_content);
        if (!Array.isArray(parsedContent)) throw new Error("JSON must be an array of objects");
      } catch (e) {
        // Fallback: treat as plain text line-by-line titles
        parsedContent = bulkData.json_content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(title => ({ title, description: '' }));
      }

      if (parsedContent.length === 0) {
        return toast.error("No valid content found to schedule.");
      }

      const { data: user } = await supabase.auth.getUser();
      const startDate = new Date(bulkData.start_date);

      const inserts = parsedContent.map((item: any, index: number) => {
        const releaseDate = new Date(startDate);
        releaseDate.setDate(releaseDate.getDate() + (index * bulkData.interval_days));

        const attachments = item.url ? [{ type: 'link', url: item.url, title: 'Resource Link' }] : [];

        return {
          title: item.title,
          description: item.description || '',
          batch_id: bulkData.batch_id,
          release_date: releaseDate.toISOString(),
          is_published: false,
          attachments: attachments,
          created_by: user.user?.id
        };
      });

      const { error } = await supabase.from('content_posts').insert(inserts);
      if (error) throw error;
      
      toast.success(`Successfully scheduled ${inserts.length} pieces of content`);
      setIsBulkModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to parse or save bulk content: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Content Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">Schedule and manage learning materials</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setIsBulkModalOpen(true)}>
            <FileUp className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={() => {
            setEditingPostId(null);
            setFormData({ title: '', batch_id: '', description: '', release_date: '', is_published: false, attachments: [] });
            setIsModalOpen(true);
          }} className="gap-2">
            <Plus className="h-4 w-4" />
            New Post
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left line-height-tight">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Release Date</th>
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
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No scheduled content found.
                  </td>
                </tr>
              ) : (
                posts.map(post => (
                  <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{post.title}</td>
                    <td className="px-6 py-4 text-slate-600">{post.batches?.name}</td>
                    <td className="px-6 py-4 text-slate-600">{new Date(post.release_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => togglePublished(post)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {post.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="ghost" size="icon" className="text-blue-500 hover:text-blue-600" onClick={() => handleOpenEdit(post)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => setPostToDelete(post.id)}>
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

      <Dialog isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title={editingPostId ? "Edit Content" : "Schedule Content"}>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Day 1: HTML Basics" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch">Batch</Label>
            <select 
              id="batch" 
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              value={formData.batch_id}
              onChange={e => setFormData({...formData, batch_id: e.target.value})}
              required
            >
              <option value="">Select a batch...</option>
              {batches.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="release">Release Date</Label>
            <Input id="release" type="date" required value={formData.release_date} onChange={e => setFormData({...formData, release_date: e.target.value})} />
          </div>
          <div className="space-y-4 pt-2 border-t border-slate-200">
             <div className="flex justify-between items-center">
               <Label>Attachments / Links</Label>
               <Button type="button" variant="outline" size="sm" onClick={() => {
                 setFormData(prev => ({
                   ...prev,
                   attachments: [...prev.attachments, { type: 'link', url: '', title: '' }]
                 }));
               }}>Add Attachment
               </Button>
             </div>
             {formData.attachments.map((att, i) => (
               <div key={i} className="flex gap-2">
                 <select 
                   className="rounded-md border border-slate-200 text-sm px-2"
                   value={att.type}
                   onChange={e => {
                     const newAtts = [...formData.attachments];
                     newAtts[i].type = e.target.value;
                     setFormData({...formData, attachments: newAtts});
                   }}
                 >
                   <option value="link">Web Link</option>
                   <option value="youtube">YouTube Video</option>
                   <option value="upload">File Upload (PDF, PPT, Doc, etc)</option>
                 </select>
                 <Input className="flex-1" placeholder="Title" value={att.title} onChange={e => {
                     const newAtts = [...formData.attachments];
                     newAtts[i].title = e.target.value;
                     setFormData({...formData, attachments: newAtts});
                 }} />
                 
                 {att.type === 'upload' ? (
                   <div className="flex-1 flex items-center gap-2">
                     {att.url ? (
                       <span className="text-xs text-green-600 font-medium truncate max-w-[150px]">Uploaded: {att.title || 'File'}</span>
                     ) : (
                       <Input 
                         type="file" 
                         className="flex-1 text-xs" 
                         onChange={async (e) => {
                           const file = e.target.files?.[0];
                           if (!file) return;
                           
                           toast.info("Uploading file...");
                           const fileExt = file.name.split('.').pop();
                           const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                           const filePath = `attachments/${fileName}`;
                           
                           const { error: uploadError } = await supabase.storage
                             .from('content_files')
                             .upload(filePath, file);
                             
                           if (uploadError) {
                             toast.error("Upload failed: " + uploadError.message);
                             return;
                           }
                           
                           const { data } = supabase.storage.from('content_files').getPublicUrl(filePath);
                           
                           const newAtts = [...formData.attachments];
                           newAtts[i].url = data.publicUrl;
                           if (!newAtts[i].title) newAtts[i].title = file.name;
                           setFormData({...formData, attachments: newAtts});
                           toast.success("File uploaded successfully");
                         }} 
                       />
                     )}
                     {att.url && (
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          const newAtts = [...formData.attachments];
                          newAtts[i].url = '';
                          setFormData({...formData, attachments: newAtts});
                        }}>Replace</Button>
                     )}
                   </div>
                 ) : (
                   <Input className="flex-1" placeholder="URL" value={att.url} onChange={e => {
                       const newAtts = [...formData.attachments];
                       newAtts[i].url = e.target.value;
                       setFormData({...formData, attachments: newAtts});
                   }} />
                 )}

                 <Button type="button" variant="ghost" size="icon" className="text-red-500" onClick={() => {
                    const newAtts = formData.attachments.filter((_, idx) => idx !== i);
                    setFormData({...formData, attachments: newAtts});
                 }}>
                   <Trash2 className="h-4 w-4" />
                 </Button>
               </div>
             ))}
          </div>
          <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-slate-200">
            <input 
              type="checkbox" 
              id="publish" 
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={formData.is_published}
              onChange={e => setFormData({...formData, is_published: e.target.checked})}
            />
            <Label htmlFor="publish">Publish immediately upon release</Label>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" isLoading={isSubmitting}>{editingPostId ? "Update Post" : "Schedule Post"}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!postToDelete} onClose={() => setPostToDelete(null)} title="Delete Content">
        <div className="space-y-4">
          <p className="text-slate-600">Are you sure you want to delete this scheduled content?</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setPostToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={executeDelete}>Delete Content</Button>
          </div>
        </div>
      </Dialog>

      <Dialog isOpen={isBulkModalOpen} onClose={() => !isSubmitting && setIsBulkModalOpen(false)} title="Bulk Schedule Content" className="max-w-[700px]">
        <form onSubmit={handleBulkSubmit} className="space-y-4 mt-4">
          <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-sm border border-blue-100">
            Paste a flat JSON array of objects (with "title", "description", "url") OR simply paste a list of titles (one per line). The system will automatically space out the release dates based on your interval below.
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bulk_batch">Batch</Label>
              <select 
                id="bulk_batch" 
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                value={bulkData.batch_id}
                onChange={e => setBulkData({...bulkData, batch_id: e.target.value})}
                required
              >
                <option value="">Select a batch...</option>
                {batches.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Release Date</Label>
              <Input 
                id="start_date" 
                type="date" 
                required 
                value={bulkData.start_date} 
                onChange={e => setBulkData({...bulkData, start_date: e.target.value})} 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="interval">Days Between Releases</Label>
            <Input 
              id="interval" 
              type="number" 
              min="0"
              required 
              value={bulkData.interval_days} 
              onChange={e => setBulkData({...bulkData, interval_days: parseInt(e.target.value, 10)})} 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="json_content">Content Array or List of Titles</Label>
            <textarea
              id="json_content"
              rows={8}
              required
              className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 font-mono"
              value={bulkData.json_content}
              onChange={e => setBulkData({...bulkData, json_content: e.target.value})}
            />
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="outline" onClick={() => setIsBulkModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>Upload & Schedule</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
