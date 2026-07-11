import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useContentStore } from "../../stores/contentStore";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import {
  BookOpen,
  CheckSquare,
  Layers,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Circle,
  Bell,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../lib/utils";

export default function StudentDashboard() {
  const { profile } = useAuthStore();
  const { completedModules, toggleModuleCompletion } = useContentStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    activeSession: null,
    upcomingPosts: [],
    availablePosts: [],
    allAvailablePosts: [],
    announcements: [],
    attendanceStats: { present: 0, total: 0 },
    batchName: "Unknown Batch",
    isBatchEnded: false,
  });

  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;
      try {
        setLoading(true);
        // Find student batch
        const { data: batchQuery } = await supabase
          .from("batch_students")
          .select("batch_id, batches(name, start_date, end_date)")
          .eq("student_id", profile.id)
          .single();

        if (batchQuery) {
          const batchId = batchQuery.batch_id;
          const batchInfo = batchQuery.batches as any;
          const today = new Date().toISOString().split("T")[0];

          let isBatchEnded = false;
          if (batchInfo?.end_date && batchInfo.end_date < today) {
            isBatchEnded = true;
          }

          let upcomingPosts: any[] = [];
          let allAvailablePosts: any[] = [];
          
          if (!isBatchEnded) {
            // Get available contents
            const { data: upcomingPostsRes } = await supabase
              .from("content_posts")
              .select("id, title, release_date")
              .eq("batch_id", batchId)
              .eq("is_published", true)
              .gt("release_date", today)
              .order("release_date", { ascending: true })
              .limit(3);
              
            upcomingPosts = upcomingPostsRes || [];

            // Get All available posts to show progress
            const { data: allAvailablePostsRes } = await supabase
              .from("content_posts")
              .select("id, title, release_date, description")
              .eq("batch_id", batchId)
              .eq("is_published", true)
              .lte("release_date", today)
              .order("release_date", { ascending: true });
              
            allAvailablePosts = allAvailablePostsRes || [];
          }

          // Get announcements
          const { data: announcements } = await supabase
             .from("announcements")
             .select("*")
             .or(`batch_id.eq.${batchId},batch_id.is.null`)
             .order("created_at", { ascending: false })
             .limit(5);

          // Find if there's an open attendance session for today
          const { data: activeSessionQuery } = await supabase
            .from("attendance_sessions")
            .select("*, content_posts(title)")
            .eq("batch_id", batchId)
            .eq("session_date", today)
            .eq("is_open", true)
            .maybeSingle();

          // Get attendance stats
          const [presentRes, totalRes] = await Promise.all([
            supabase
              .from("attendance_records")
              .select("id", { count: "exact" })
              .eq("student_id", profile.id)
              .eq("is_approved", true),
            supabase
              .from("attendance_sessions")
              .select("id", { count: "exact" })
              .eq("batch_id", batchId),
          ]);

          // Fetch progress separately to prevent "Failed to fetch" CORS error on missing table from breaking the dashboard
          let progressRes: any = { data: null };
          try {
            progressRes = await supabase
              .from("content_progress")
              .select("post_id")
              .eq("student_id", profile.id);
          } catch (e) {
            console.warn(
              "Could not fetch content_progress (table might be missing)",
            );
          }

          if (progressRes?.data) {
            useContentStore
              .getState()
              .setCompletedModules(progressRes.data.map((p: { post_id: any; }) => p.post_id));
          }

          setData({
            batchName: (batchQuery.batches as any)?.name || "Unknown Batch",
            isBatchEnded,
            activeSession: activeSessionQuery,
            upcomingPosts: upcomingPosts || [],
            announcements: announcements || [],
            availablePosts: allAvailablePosts
              ? [...allAvailablePosts].reverse().slice(0, 3)
              : [],
            allAvailablePosts: allAvailablePosts || [],
            attendanceStats: {
              present: presentRes.count || 0,
              total: totalRes.count || 0,
            },
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const attendancePercent =
    data.attendanceStats.total > 0
      ? Math.round(
          (data.attendanceStats.present / data.attendanceStats.total) * 100,
        )
      : 0;

  // Calculate Progress
  const totalModules = data.allAvailablePosts.length;
  // Only count completed modules that are actually available in the current batch
  const completedCount = data.allAvailablePosts.filter((m: any) =>
    completedModules.includes(m.id),
  ).length;
  const progressPercent =
    totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const pendingCount = totalModules - completedCount;

  const handleToggleModule = async (postId: string) => {
    if (!profile) return;

    // Optimistic update
    toggleModuleCompletion(postId);

    try {
      const isCompleted = completedModules.includes(postId);
      if (isCompleted) {
        // Was complete, now we are un-completing it
        await supabase
          .from("content_progress")
          .delete()
          .eq("student_id", profile.id)
          .eq("post_id", postId);
      } else {
        // Was incomplete, now we are completing it
        await supabase.from("content_progress").insert([
          {
            student_id: profile.id,
            post_id: postId,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to sync progress:", err);
      // Revert upon failure
      toggleModuleCompletion(postId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {profile?.full_name || "Student"}
          </h1>
          <p className="text-slate-500 mt-1">
            Batch:{" "}
            <span className="font-semibold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-md ml-1">
              {data.batchName}
            </span>
          </p>
        </div>
      </div>

      {data.isBatchEnded && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 px-6 py-4 rounded-2xl flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-orange-600" />
          <p className="font-medium text-sm">
            Your batch has ended. Course materials are no longer accessible, but you can still view your certificates and reports.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Action */}
        <div className="lg:col-span-2 space-y-6">
          {data.activeSession && (
            <div className="bg-[#2563EB] rounded-3xl p-8 text-white flex justify-between items-center relative overflow-hidden shadow-sm">
              <div className="relative z-10 space-y-4">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                  Live Now
                </span>
                <h3 className="text-3xl font-bold leading-tight">
                  Attendance is Open
                </h3>
                <p className="text-blue-100 max-w-md">
                  Mark your attendance for "
                  {data.activeSession?.content_posts?.title}"
                </p>
                <button
                  onClick={() => navigate("/student/attendance")}
                  className="bg-white text-[#2563EB] px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-50 transition-colors"
                >
                  Mark Attendance
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-blue-500 rounded-full opacity-30"></div>
              <div className="absolute right-10 top-10 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Available Content
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/student/content")}
                  className="text-blue-600"
                >
                  View All
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.availablePosts.length === 0 ? (
                  <div className="col-span-full text-center py-6 text-slate-500 bg-slate-50 rounded-lg">
                    No content available yet.
                  </div>
                ) : (
                  data.availablePosts.map((post: any) => (
                    <div
                      key={post.id}
                      className="bg-white border rounded-2xl p-5 flex flex-col hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => navigate("/student/content")}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                          {formatDate(post.release_date)}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                        {post.description || "No description"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 col-span-1 sm:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Upcoming Content
                </h2>
              </div>

              <div className="space-y-3">
                {data.upcomingPosts.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    No upcoming posts scheduled.
                  </div>
                ) : (
                  data.upcomingPosts.map((post: any) => (
                    <div
                      key={post.id}
                      className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex sm:items-center justify-between flex-col sm:flex-row gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center text-slate-500">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-700">
                            {post.title}
                          </h3>
                          <div className="flex items-center text-xs font-medium text-slate-500 mt-1">
                            <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100 uppercase tracking-wider text-[10px]">
                              Upcoming
                            </span>
                            <span className="ml-2">
                              Releases{" "}
                              {formatDate(post.release_date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-6">
          {/* Announcements */}
          <section className="bg-white border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="h-5 w-5 text-blue-600" />
              <h4 className="text-slate-900 font-bold tracking-tight">Announcements</h4>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {data.announcements.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No new announcements</p>
              ) : (
                data.announcements.map((announcement: any) => (
                  <div 
                     key={announcement.id} 
                     onClick={() => setSelectedAnnouncement(announcement)}
                     className="p-3 bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition-colors"
                  >
                    {announcement.type === 'deadline' && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
                    {announcement.type === 'assignment' && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>}
                    {announcement.type === 'update' && <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>}
                    {announcement.type === 'notice' && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
                    
                    <div className="flex justify-between items-start mb-1 gap-2 pl-2">
                      <h5 className="text-sm font-bold text-slate-800 line-clamp-1">{announcement.title}</h5>
                      <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                        {formatDate(announcement.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 pl-2">
                      {announcement.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Circular Progress for Curriculum */}
          <section className="bg-white border rounded-3xl p-8 shadow-sm flex flex-col items-center">
            <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">
              Curriculum Progress
            </h4>
            <p className="text-slate-400 text-xs font-medium mb-6">
              Current: Day {totalModules}
            </p>
            <div className="relative w-40 h-40 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * (progressPercent || 0)) / 100}
                  className="text-green-500"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-slate-900">
                  {progressPercent}%
                </span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 text-center border-t border-slate-100 pt-6">
              <div className="border-r border-slate-100">
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Completed
                </p>
                <p className="text-xl font-bold text-green-600">
                  {completedCount}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Pending
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {pendingCount}
                </p>
              </div>
            </div>
          </section>

          {/* Training Days List */}
          <section className="bg-white border rounded-3xl p-6 shadow-sm">
            <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-4">
              Training Days
            </h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {data.allAvailablePosts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center">
                  No training days yet.
                </p>
              ) : (
                data.allAvailablePosts.map((post: any, index: number) => {
                  const isCompleted = completedModules.includes(post.id);
                  return (
                    <div
                      key={post.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleModule(post.id)}
                          className={`flex-shrink-0 transition-colors ${isCompleted ? "text-green-500" : "text-slate-300 hover:text-slate-400"}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <Circle className="h-6 w-6" />
                          )}
                        </button>
                        <div>
                          <p className="text-sm font-bold text-slate-800 line-clamp-1">
                            Day {index + 1}: {post.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {isCompleted ? "Completed ✓" : "In Progress"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Attendance Overview */}
          <section className="bg-white border rounded-3xl p-8 shadow-sm flex flex-col items-center">
            <h4 className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-6">
              Attendance Overview
            </h4>
            <div className="relative w-40 h-40 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx="80"
                  cy="80"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray="440"
                  strokeDashoffset={440 - (440 * (attendancePercent || 0)) / 100}
                  className="text-[#2563EB]"
                  style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-slate-900">
                  {attendancePercent}%
                </span>
              </div>
            </div>
            <div className="w-full grid grid-cols-2 text-center border-t border-slate-100 pt-6">
              <div className="border-r border-slate-100">
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Sessions
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {data.attendanceStats.total}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase">
                  Present
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {data.attendanceStats.present}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Dialog 
        isOpen={!!selectedAnnouncement} 
        onClose={() => setSelectedAnnouncement(null)} 
        title={selectedAnnouncement?.title || "Announcement"}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide
              ${selectedAnnouncement?.type === 'notice' ? 'bg-blue-100 text-blue-800' : ''}
              ${selectedAnnouncement?.type === 'update' ? 'bg-purple-100 text-purple-800' : ''}
              ${selectedAnnouncement?.type === 'assignment' ? 'bg-orange-100 text-orange-800' : ''}
              ${selectedAnnouncement?.type === 'deadline' ? 'bg-red-100 text-red-800' : ''}
            `}>
              {selectedAnnouncement?.type}
            </span>
            <span className="text-sm text-slate-500">
              {selectedAnnouncement && formatDate(selectedAnnouncement.created_at)}
            </span>
          </div>
          <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {selectedAnnouncement?.content}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setSelectedAnnouncement(null)}>Close</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
