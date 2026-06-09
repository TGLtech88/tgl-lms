import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Lock, User, GraduationCap, Building2, Phone, CalendarDays, BookOpen, Clock, Eye, EyeOff } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export default function StudentProfile() {
  const { profile } = useAuthStore();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batchName, setBatchName] = useState<string>('Not assigned');

  useEffect(() => {
    async function fetchBatchName() {
      if (!profile) return;
      try {
        const { data, error } = await supabase
          .from('batch_students')
          .select('batches(name)')
          .eq('student_id', profile.id)
          .maybeSingle();

        if (error) {
           console.error("Error fetching batch name:", error);
           return;
        }
        
        // Handle type cast since it's a join
        const batchData = data?.batches as any;
        if (batchData && batchData.name) {
          setBatchName(batchData.name);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchBatchName();
  }, [profile]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your student account settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="h-5 w-5 text-blue-600" />
            Personal Details
          </CardTitle>
          <CardDescription>Your registered account information. Contact staff to change these details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4" /> Full Name
              </Label>
              <Input value={profile?.full_name || ''} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <User className="h-4 w-4 hidden" /> Email Address
              </Label>
              <Input value={profile?.email || ''} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-purple-500" /> Phone Number
              </Label>
              <Input value={profile?.phone || 'Not provided'} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-600">
                <CalendarDays className="h-4 w-4 text-orange-500" /> Joined Date
              </Label>
              <Input value={profile?.created_at ? formatDate(profile.created_at) : 'Not available'} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-600" /> Academic & Program Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <Building2 className="h-4 w-4 text-sky-500" /> College / University
                </Label>
                <Input value={profile?.college || 'Not provided'} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <BookOpen className="h-4 w-4 text-emerald-500" /> Branch / Major
                </Label>
                <Input value={profile?.branch || 'Not provided'} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <Clock className="h-4 w-4 text-amber-500" /> Current Semester
                </Label>
                <Input value={profile?.semester || 'Not provided'} readOnly className="bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-600">
                  <User className="h-4 w-4 text-blue-500 hidden" /> Assigned Batch
                </Label>
                <div className="flex h-10 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  <span className={batchName === 'Not assigned' ? 'text-slate-400 italic' : 'font-medium text-slate-700'}>
                    {batchName}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Lock className="h-5 w-5 text-slate-600" />
            Security Settings
          </CardTitle>
          <CardDescription>Update your login password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password (optional)</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  id="current" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <div className="relative">
                <Input 
                  type={showNewPassword ? "text" : "password"} 
                  id="new" 
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" isLoading={loading}>Change Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
