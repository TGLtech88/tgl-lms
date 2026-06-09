import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Loader2,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("project_reports")
        .select(
          `
          *,
          profiles:student_id (full_name, email),
          batches:batch_id (name)
        `,
        )
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      toast.error("Failed to load reports: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title?.toLowerCase().includes(search.toLowerCase()) ||
      r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.profiles?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {status}
          </span>
        );
      case "Draft":
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <FileText className="w-3 h-3" /> {status}
          </span>
        );
      case "Under Review":
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {status}
          </span>
        );
      case "Rejected":
        return (
          <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full flex items-center gap-1">
            <FileText className="w-3 h-3" /> Draft
          </span>
        );
    }
  };


  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedReport) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase
        .from("project_reports")
        .update({
          status: newStatus,
          admin_feedback: feedbackMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id)
        .select()
        .single();

      if (error) throw error;
      toast.success(`Report status updated to ${newStatus}`);
      setSelectedReport({
        ...selectedReport,
        status: newStatus,
        admin_feedback: feedbackMsg,
      });
      loadReports();
    } catch (error: any) {
      toast.error("Failed to update report: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectReport = async () => {
    if (!selectedReport) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase
        .from("project_reports")
        .update({
          status: "Rejected",
          admin_feedback: feedbackMsg,
          description: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedReport.id)
        .select()
        .single();

      if (error) throw error;
      toast.success(`Report rejected. Student must re-upload.`);
      setSelectedReport({
        ...selectedReport,
        status: "Rejected",
        admin_feedback: feedbackMsg,
        description: null,
      });
      loadReports();
    } catch (err: any) {
      toast.error(`Failed to reject report: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Reports</h1>
          <p className="text-slate-500">Review and approve project reports</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-4 bg-slate-50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <FileText className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium">No reports found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Student
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Batch
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Title
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">
                    Last Updated
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {report.profiles?.full_name || "Unknown"}
                      </div>
                      <div className="text-sm text-slate-500">
                        {report.profiles?.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {report.batches?.name || "-"}
                    </td>
                    <td
                      className="px-6 py-4 font-medium text-slate-900 max-w-xs truncate"
                      title={report.title || "Untitled"}
                    >
                      {report.title || "Untitled Report"}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {report.updated_at
                        ? format(
                            new Date(report.updated_at),
                            "MMM d, yyyy HH:mm",
                          )
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        onClick={() => {
                          setSelectedReport(report);
                          setFeedbackMsg(report.admin_feedback || "");
                        }}
                        variant="secondary"
                        size="sm"
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white max-w-5xl w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Report Review: {selectedReport.profiles?.full_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500 text-sm">Status:</span>
                  {getStatusBadge(selectedReport.status)}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 p-2"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
              {/* Report Content */}
              <div className="flex-1 space-y-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {selectedReport.title || "Untitled Project"}
                  </h1>
                  <p className="text-lg text-slate-600">
                    by {selectedReport.profiles?.full_name}
                  </p>
                  <p className="text-slate-500">
                    {selectedReport.batches?.name}
                  </p>
                </div>

                {selectedReport.description ? (
                  <div className="pt-6 border-t border-slate-100 flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-xl">
                    <FileText className="w-16 h-16 text-slate-400 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Project Report Document</h3>
                    <p className="text-slate-500 mb-6 max-w-md">
                      The student has provided a document link (PDF or Google Drive) for their final project report.
                    </p>
                    <a
                      href={selectedReport.description}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 gap-2 bg-[#2563EB] hover:bg-blue-700 text-white"
                    >
                      <Eye className="w-4 h-4" />
                      View Document / Link
                    </a>
                  </div>
                ) : (
                  <div className="pt-6 border-t border-slate-100">
                     <p className="text-slate-500 italic text-center py-8">No document has been uploaded or linked by the student yet.</p>
                  </div>
                )}
              </div>

              {/* Review Panel */}
              <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-3">
                    Admin Review
                  </h3>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Feedback Comments
                    </label>
                    <textarea
                      value={feedbackMsg}
                      onChange={(e) => setFeedbackMsg(e.target.value)}
                      placeholder="Add comments or request modifications..."
                      className="w-full p-3 border border-slate-300 rounded-lg text-sm min-h-[120px] focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => handleUpdateStatus("Approved")}
                      disabled={
                        updating || selectedReport.status === "Approved"
                      }
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {updating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve Report
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus("Under Review")}
                      disabled={
                        updating || selectedReport.status === "Under Review"
                      }
                      variant="outline"
                      className="w-full text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                      Set 'Under Review'
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus("Draft")}
                      disabled={updating || selectedReport.status === "Draft"}
                      variant="outline"
                      className="w-full text-orange-600 hover:text-orange-700 border-orange-200 hover:bg-orange-50"
                    >
                      Request Modifications
                    </Button>
                    <Button
                      onClick={handleRejectReport}
                      disabled={updating || selectedReport.status === "Rejected"}
                      variant="outline"
                      className="w-full text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                    >
                      Reject & Require Re-upload
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus("Completed")}
                      disabled={
                        updating || selectedReport.status === "Completed"
                      }
                      variant="secondary"
                      className="w-full mt-2"
                    >
                      Mark Completed
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
