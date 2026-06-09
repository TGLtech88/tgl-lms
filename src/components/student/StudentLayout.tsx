import React from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LayoutDashboard, BookOpen, CheckSquare, User, LogOut, GraduationCap, Menu, X, FileText } from 'lucide-react';
import { Button } from '../ui/button';

export function StudentLayout() {
  const { user, profile, loading, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user || !profile || profile.role !== 'student') {
    return <Navigate to="/" replace />;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const navItems = [
    { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/student/content', icon: BookOpen, label: 'My Content' },
    { to: '/student/attendance', icon: CheckSquare, label: 'Attendance' },
    { to: '/student/journals', icon: FileText, label: 'Daily Journal' },
    { to: '/student/report', icon: BookOpen, label: 'Project Report' },
    { to: '/student/profile', icon: User, label: 'Profile' },
  ];

  const SidebarContent = () => (
    <>
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 mb-5">
          <div className="-mx-8 mb-6">
  <img
    src="/logo.jpg"
    alt="TGL Technologies"
    className="w-full h-auto object-contain px-4"
  />
</div>
        </div>

        <nav className="space-y-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 transition-colors ${
                  isActive
                    ? 'text-[#2563EB] font-medium'
                    : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-8 border-t border-slate-800 shrink-0">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full text-slate-400 hover:text-white transition-colors text-left"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0F172A] text-white fixed h-full z-10 transition-colors">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header & Menu */}
        <div className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center font-bold text-lg text-white">T</div>
            <span className="font-bold text-slate-900">TGL Tech</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Desktop Top Header */}
        <header className="hidden lg:flex h-20 bg-white border-b items-center justify-between px-10 shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Welcome back, {profile.full_name?.split(' ')[0]}! 👋</h2>
            <p className="text-sm text-slate-500 font-medium">Student Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <User className="w-5 h-5" />
            </div>
            <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold uppercase">
              {profile.full_name?.substring(0, 2) || 'T'}
            </div>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-10 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="absolute top-16 left-0 right-0 bg-[#0F172A] text-white flex flex-col h-[calc(100vh-4rem)]" onClick={e => e.stopPropagation()}>
              <SidebarContent />
            </div>
          </div>
        )}

        <div className="p-4 md:p-10 flex-1 overflow-y-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
