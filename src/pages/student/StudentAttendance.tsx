import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  CheckSquare,
  XCircle,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../../lib/utils";

export default function StudentAttendance() {
  const { profile } = useAuthStore();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<any>({
    activeSession: null,
    history: [],
  });

  useEffect(() => {
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile) return;
    try {
      setLoading(true);

      const { data: batchQuery } = await supabase
        .from("batch_students")
        .select("batch_id")
        .eq("student_id", profile.id)
        .single();

      if (batchQuery) {
        const batchId = batchQuery.batch_id;
        const today = new Date().toISOString().split("T")[0];

        const [activeRes, sessionsRes, recordsRes] = await Promise.all([
          supabase
            .from("attendance_sessions")
            .select("*, content_posts(title)")
            .eq("batch_id", batchId)
            .eq("session_date", today)
            .eq("is_open", true)
            .maybeSingle(),
          supabase
            .from("attendance_sessions")
            .select("*, content_posts(title)")
            .eq("batch_id", batchId)
            .order("created_at", { ascending: false }),
          supabase
            .from("attendance_records")
            .select("*")
            .eq("student_id", profile.id)
        ]);

        const history = sessionsRes.data?.map(session => {
          const record = recordsRes.data?.find(r => r.session_id === session.id);
          return {
            id: session.id,
            session_date: session.session_date,
            content_posts: session.content_posts,
            is_open: session.is_open,
            code_expires_at: session.code_expires_at,
            record: record || null
          };
        }) || [];

        setData({
          activeSession: activeRes.data,
          history: history,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.activeSession) return toast.error("No active session");

    // Check if code matches (MOCK: typically would happen server side to prevent cheating)
    // Edge function would be ideal here to securely check the code.
    if (code.toUpperCase() !== data.activeSession.attendance_code) {
      return toast.error("Invalid attendance code");
    }

    if (new Date() > new Date(data.activeSession.code_expires_at)) {
      return toast.error("Invalid or expired code for attendance");
    }

    try {
      setIsSubmitting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("attendance_records").insert([
        {
          session_id: data.activeSession.id,
          student_id: user.id,
          is_approved: true, // Auto approve
          approved_at: new Date().toISOString(),
          marked_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        if (error.code === "23505")
          toast.error("You have already submitted for this session");
        else throw error;
      } else {
        toast.success(
          "Attendance marked successfully!",
        );
        setCode("");
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );

  const totalSessions = data.history.length;
  const presentCount = data.history.filter((h: any) => h.record && h.record.is_approved).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track your presence across all modules
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-slate-200 rounded-xl bg-white p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="flex items-center justify-center h-16 w-16 bg-blue-50 text-blue-600 rounded-full mb-4">
            <CheckSquare className="h-8 w-8" />
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-1">
            Total Attendance
          </h3>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {presentCount} / {totalSessions}
          </div>
        </div>

        <div className="md:col-span-2">
          {data.activeSession ? (
            <section className="bg-white border rounded-3xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-6">
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-slate-900">
                  Mark Attendance
                </h4>
                <p className="text-slate-500 max-w-sm">
                  Session is currently active for{" "}
                  {data.activeSession.content_posts?.title}
                </p>
              </div>
              <form
                onSubmit={handleMarkAttendance}
                className="flex items-center gap-4"
              >
                <input
                  type="text"
                  placeholder="CODE"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                  className="w-32 bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-center font-mono text-xl uppercase font-bold text-[#2563EB] focus:border-[#2563EB] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0F172A] text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Submit Code
                </button>
              </form>
            </section>
          ) : (
            <section className="bg-white border rounded-3xl p-8 flex flex-col items-center justify-center shadow-sm">
              <Clock className="h-10 w-10 text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-900">
                No active session
              </h3>
              <p className="text-slate-500 text-center max-w-sm mt-2">
                There is no attendance session currently open for your batch.
                The instructor will open it during the session.
              </p>
            </section>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-900 text-lg">
            Attendance History
          </h2>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Session</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.history.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                data.history.map((session: any) => (
                  <tr key={session.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {formatDate(session.session_date)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {session.content_posts?.title ||
                        "Unknown Session"}
                    </td>
                    <td className="px-6 py-4">
                      {session.record ? (
                        session.record.is_approved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock className="h-3.5 w-3.5" /> Pending Approval
                          </span>
                        )
                      ) : (
                        !session.is_open && new Date(session.code_expires_at) < new Date() ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <XCircle className="h-3.5 w-3.5" /> Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <Clock className="h-3.5 w-3.5" /> Not Marked Yet
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
