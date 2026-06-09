/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

import Login from './pages/auth/Login';
import { AdminLayout } from './components/admin/AdminLayout';
import { StudentLayout } from './components/student/StudentLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import Batches from './pages/admin/Batches';
import BatchDetail from './pages/admin/BatchDetail';
import ContentScheduler from './pages/admin/ContentScheduler';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminStudents from './pages/admin/AdminStudents';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentAttendance from './pages/student/StudentAttendance';
import MyContent from './pages/student/MyContent';
import Settings from './pages/admin/Settings';
import AdminReports from './pages/admin/AdminReports';
import AdminCertificates from './pages/admin/AdminCertificates';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import StudentProfile from './pages/student/StudentProfile';
import StudentReport from './pages/student/StudentReport';
import StudentJournals from './pages/student/StudentJournals';

function AutoLogout() {
  const { user, signOut } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const logout = async () => {
      await signOut();
    };

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Automatically logout after 15 minutes of inactivity
      timeoutRef.current = setTimeout(logout, 15 * 60 * 1000);
    };

    resetTimer();

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user, signOut]);

  return null;
}

// Placeholder Pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
    <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
    <p className="text-slate-500 mt-2">This page is under construction.</p>
  </div>
);

export default function App() {
  const { setUser, fetchProfile, loading } = useAuthStore();

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        useAuthStore.setState({ loading: false });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        useAuthStore.setState({ profile: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, fetchProfile]);

  return (
    <Router>
      <AutoLogout />
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="batches" element={<Batches />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="content" element={<ContentScheduler />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="certificates" element={<AdminCertificates />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        
        {/* Student Routes */}
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<Navigate to="/student/dashboard" replace />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="content" element={<MyContent />} />
          <Route path="attendance" element={<StudentAttendance />} />
          <Route path="report" element={<StudentReport />} />
          <Route path="journals" element={<StudentJournals />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>
      </Routes>
    </Router>
  );
}
