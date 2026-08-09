import React from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LayoutDashboard, BookOpen, CheckSquare, User, LogOut, GraduationCap, Menu, X, FileText , ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

export function StudentLayout() {
  const { user, profile, loading, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

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

  const SidebarContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      <div className="p-6 flex-1 overflow-y-auto">
  <div className="flex items-center mb-10 pl-2">
    <img
      src="/logot.png"
      alt="TGL Tech"
      className="h-20 w-100 object-contain"
    />
  </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 transition-colors px-3 py-2.5 rounded-lg group ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200 shrink-0">
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-3 w-full text-slate-600 hover:text-red-600 transition-colors px-3 py-2.5 rounded-lg hover:bg-red-50 ${collapsed ? 'justify-center' : 'text-left'}`}
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans text-slate-900">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-slate-200 fixed h-full z-20 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
        <SidebarContent collapsed={isSidebarCollapsed} />
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-24 bg-white border border-slate-200 rounded-full p-1 text-slate-500 hover:text-blue-600 shadow-sm z-30 flex items-center justify-center"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
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
        <header className="hidden lg:flex h-24 bg-gradient-to-r from-blue-600 to-blue-800 border-b border-blue-700 items-center justify-between px-10 shrink-0 text-white shadow-md">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome back, {profile.full_name?.split(' ')[0]}! 👋</h2>
            <p className="text-sm text-blue-100 font-medium">Student Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white backdrop-blur-sm">
              <User className="w-5 h-5" />
            </div>
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-blue-700 font-bold uppercase shadow-sm">
              {profile.full_name?.substring(0, 2) || 'T'}
            </div>
          </div>
        </header>

        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-10 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="absolute top-16 left-0 right-0 bg-white border-b border-slate-200 flex flex-col h-[calc(100vh-4rem)]" onClick={e => e.stopPropagation()}>
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
