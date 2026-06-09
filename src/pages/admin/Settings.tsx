import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Lock, User } from 'lucide-react';

export default function Settings() {
  const { profile } = useAuthStore();
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="space-y-6 max-w-3xl border-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and system preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 border-slate-200">
            <User className="h-5 w-5 text-blue-600" />
            Profile Information
          </CardTitle>
          <CardDescription>Your personal account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile?.full_name || ''} readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div>
              <span className="inline-flex px-3 py-1 rounded bg-blue-50 text-blue-700 text-sm font-medium uppercase tracking-wide">
                {profile?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 border-slate-200">
            <Lock className="h-5 w-5 text-blue-600" />
            Security
          </CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm border-slate-200">
            <div className="space-y-2">
              <Label htmlFor="current">Current Password (optional for demonstration)</Label>
              <Input type="password" id="current" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <Input type="password" id="new" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <Button type="submit" isLoading={loading}>Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
