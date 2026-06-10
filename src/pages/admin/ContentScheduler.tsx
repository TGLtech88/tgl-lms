import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Plus, Calendar as CalendarIcon, FileUp, Loader2, Edit, Trash2, Eye, FileText, Link, ExternalLink } from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import { formatDate } from '../../lib/utils';

export default function ContentScheduler() {
  const [posts, setPosts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<any>(null);
  
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
                    <td className="px-6 py-4 text-slate-600">{formatDate(post.release_date)}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => togglePublished(post)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {post.is_published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700" onClick={() => setPreviewPost(post)} title="Preview Content">
                        <Eye className="h-4 w-4" />
                      </Button>
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

      <Dialog isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title={editingPostId ? "Edit Content" : "Schedule Content"} className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea 
                id="description" 
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="Optional description of this module" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="release">Release Date</Label>
              <Input id="release" type="date" required value={formData.release_date} onChange={e => setFormData({...formData, release_date: e.target.value})} />
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2 h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg w-full">
                <input 
                  type="checkbox" 
                  id="publish" 
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={formData.is_published}
                  onChange={e => setFormData({...formData, is_published: e.target.checked})}
                />
                <Label htmlFor="publish" className="text-sm font-medium cursor-pointer flex-1">Publish immediately upon release</Label>
              </div>
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t border-slate-200">
             <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
               <Label className="px-2 font-bold text-slate-700">Attachments / Links</Label>
               <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => {
                 setFormData(prev => ({
                   ...prev,
                   attachments: [...prev.attachments, { type: 'link', url: '', title: '' }]
                 }));
               }}>
                 <Plus className="h-4 w-4 mr-1" /> Add Attachment
               </Button>
             </div>
             <div className="space-y-3 max-h-[30vh] overflow-y-auto px-1 pb-1">
               {formData.attachments.length === 0 && (
                 <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                   No attachments yet. Click "Add Attachment" to include resources.
                 </div>
               )}
               {formData.attachments.map((att, i) => (
                 <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden">
                   <div className="flex flex-col sm:flex-row w-full gap-3">
                     <select 
                       className="rounded-md border border-slate-200 text-sm px-2 h-10 w-full sm:w-1/4 min-w-[120px]"
                       value={att.type}
                       onChange={e => {
                         const newAtts = [...formData.attachments];
                         newAtts[i].type = e.target.value;
                         setFormData({...formData, attachments: newAtts});
                       }}
                     >
                       <option value="link">Web Link</option>
                       <option value="youtube">YouTube Video</option>
                       <option value="upload">File/Archive (Upload)</option>
                     </select>
                     <Input className="flex-1 w-full" placeholder="Resource Title" value={att.title} onChange={e => {
                         const newAtts = [...formData.attachments];
                         newAtts[i].title = e.target.value;
                         setFormData({...formData, attachments: newAtts});
                     }} />
                     
                     {att.type === 'upload' ? (
                       <div className="flex-1 w-full flex flex-col sm:flex-row items-start sm:items-center gap-2">
                         {att.url ? (
                           <div className="flex items-center gap-2 w-full">
                             <div className="text-xs text-blue-700 font-medium truncate flex-1 p-2.5 bg-blue-50 rounded-md border border-blue-100 flex items-center gap-2">
                               <FileUp className="h-3.5 w-3.5" />
                               {att.title || 'Uploaded File'}
                             </div>
                             <Button type="button" variant="outline" size="sm" onClick={() => {
                               const newAtts = [...formData.attachments];
                               newAtts[i].url = '';
                               setFormData({...formData, attachments: newAtts});
                             }}>Replace</Button>
                           </div>
                         ) : (
                           <label className="flex h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer overflow-hidden group">
                             <div className="flex items-center gap-2 whitespace-nowrap">
                               <FileUp className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                               <span>Choose file...</span>
                             </div>
                             <input 
                               type="file" 
                               className="hidden" 
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
                           </label>
                         )}
                       </div>
                     ) : (
                       <Input className="flex-1 w-full" placeholder="https://..." value={att.url} onChange={e => {
                           const newAtts = [...formData.attachments];
                           newAtts[i].url = e.target.value;
                           setFormData({...formData, attachments: newAtts});
                       }} />
                     )}
                   </div>
                   
                   <div className="w-full sm:w-auto flex justify-end">
                     <Button type="button" variant="outline" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto" onClick={() => {
                        const newAtts = formData.attachments.filter((_, idx) => idx !== i);
                        setFormData({...formData, attachments: newAtts});
                     }}>
                       <Trash2 className="h-4 w-4 mr-2 sm:mr-0 inline sm:hidden" />
                       <span className="sm:hidden">Remove Attachment</span>
                       <Trash2 className="h-4 w-4 hidden sm:block" />
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
          <div className="flex justify-end pt-4 mt-2 border-t border-slate-200">
            <Button type="submit" isLoading={isSubmitting} size="lg" className="w-full sm:w-auto">{editingPostId ? "Save Changes" : "Schedule Content"}</Button>
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
      <Dialog isOpen={!!previewPost} onClose={() => setPreviewPost(null)} title="Preview Content">
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">{previewPost?.title}</h3>
            {previewPost?.description && <p className="text-sm text-slate-600 mt-2">{previewPost?.description}</p>}
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700">Attachments</h4>
            {previewPost?.attachments && previewPost.attachments.length > 0 ? (
              <div className="space-y-2">
                {previewPost.attachments.map((att: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {att.type === 'upload' ? <FileText className="h-5 w-5 text-blue-500" /> : <Link className="h-5 w-5 text-blue-500" />}
                      <span className="font-medium text-slate-800 truncate">{att.title || 'Attachment'}</span>
                    </div>
                    <a
                      href={
                        att.type === 'upload' && att.url && (att.url.toLowerCase().includes('.ppt') || att.url.toLowerCase().includes('.doc') || att.url.toLowerCase().includes('.xls'))
                          ? `https://docs.google.com/viewer?url=${encodeURIComponent(att.url)}`
                          : att.url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap ml-4"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 italic text-sm">No attachments available.</p>
            )}
          </div>
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <Button onClick={() => setPreviewPost(null)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
