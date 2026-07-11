import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useContentStore } from "../../stores/contentStore";
import { supabase } from "../../lib/supabase";
import {
  BookOpen,
  FileText,
  ChevronRight,
  Loader2,
  Calendar,
  PlayCircle,
  MonitorPlay,
  File,
  Link as LinkIcon,
  ChevronLeft,
  Menu,
  CheckCircle2,
  Circle,
  Archive,
} from "lucide-react";
import { formatDate } from "../../lib/utils";
import { Button } from "../../components/ui/button";

export default function MyContent() {
  const { profile } = useAuthStore();
  const {
    posts,
    selectedPost,
    selectedAttachment,
    isSidebarOpen,
    completedModules,
    setPosts,
    setSelectedPost,
    setSelectedAttachment,
    setIsSidebarOpen,
    toggleModuleCompletion,
  } = useContentStore();
  const [loading, setLoading] = useState(posts.length === 0);
  const [isBatchEnded, setIsBatchEnded] = useState(false);

  useEffect(() => {
    async function loadContent() {
      if (!profile) return;
      try {
        if (posts.length === 0) setLoading(true); // Only show spinner if we don't have cached data
        // Find student batch
        const { data: batchQuery } = await supabase
          .from("batch_students")
          .select("batch_id, batches(name, end_date)")
          .eq("student_id", profile.id)
          .single();

        if (batchQuery) {
          const batchId = batchQuery.batch_id;
          const batchInfo = batchQuery.batches as any;
          const today = new Date().toISOString().split("T")[0];

          if (batchInfo?.end_date && batchInfo.end_date < today) {
            setIsBatchEnded(true);
            setPosts([]);
            setLoading(false);
            return;
          }

          setIsBatchEnded(false);

          // Get released content
          const { data: contentData } = await supabase
            .from("content_posts")
            .select(
              `
              id,
              title,
              description,
              release_date,
              attachments
            `,
            )
            .eq("batch_id", batchId)
            .eq("is_published", true)
            .lte("release_date", today)
            .order("release_date", { ascending: false });

          // Update store if different (shallow)
          setPosts(contentData || []);

          // Fetch completed modules - wrapped in try/catch to avoid whole feature breaking if table is not yet created
          try {
            const { data: progressData } = await supabase
              .from("content_progress")
              .select("post_id")
              .eq("student_id", profile.id);

            if (progressData) {
              useContentStore
                .getState()
                .setCompletedModules(progressData.map((p) => p.post_id));
            }
          } catch (e) {
            console.warn("Could not load content progress, table missing?");
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, [profile?.id]);

  const handleToggleModule = async (postId: string) => {
    if (!profile) return;

    toggleModuleCompletion(postId);

    try {
      const isCompleted = completedModules.includes(postId);
      if (isCompleted) {
        await supabase
          .from("content_progress")
          .delete()
          .eq("student_id", profile.id)
          .eq("post_id", postId);
      } else {
        await supabase.from("content_progress").insert([
          {
            student_id: profile.id,
            post_id: postId,
          },
        ]);
      }
    } catch (err) {
      console.error("Failed to sync progress:", err);
      toggleModuleCompletion(postId);
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const renderViewer = () => {
    if (!selectedAttachment) {
      if (selectedPost) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center bg-white rounded-3xl border border-slate-200">
            <BookOpen className="h-16 w-16 mb-4 text-slate-300" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {selectedPost.title}
            </h2>
            <p className="max-w-md">
              {selectedPost.description ||
                "Select an attachment from the sidebar to view its content."}
            </p>
            {(!selectedPost.attachments ||
              selectedPost.attachments.length === 0) && (
              <p className="font-semibold text-orange-500 mt-4">
                No attachments available for this module.
              </p>
            )}
          </div>
        );
      }
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <MonitorPlay className="h-16 w-16 mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-500">
            Select a module to start learning
          </p>
        </div>
      );
    }

    const { type, url } = selectedAttachment;
    let embedContent = null;

    if (type === "youtube") {
      // Extract video ID
      let videoId = "";
      const match = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/,
      );
      if (match && match[1]) {
        videoId = match[1];
        embedContent = (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            className="w-full h-full rounded-2xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        );
      } else {
        embedContent = (
          <div className="p-4 text-red-500">
            Invalid YouTube URL.{" "}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open Link
            </a>
          </div>
        );
      }
    } else if (type === "upload" || type === "pdf" || type === "document" || type === "zip") {
      const isPdf = url.toLowerCase().includes(".pdf") || type === "pdf";
      const isArchive = url.toLowerCase().includes(".zip") || url.toLowerCase().includes(".rar") || url.toLowerCase().includes(".7z") || type === "zip";
      
      if (isPdf) {
        embedContent = (
          <div className="flex flex-col items-center justify-center h-full bg-white rounded-2xl border border-slate-200">
            <FileText className="h-16 w-16 text-red-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              PDF Document
            </h3>
            <p className="text-slate-500 mb-6 max-w-md text-center">
              Browser security prevents embedding PDFs here. Click below to view it securely.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition"
            >
              Open PDF Document
            </a>
          </div>
        );
      } else if (isArchive) {
        embedContent = (
          <div className="flex flex-col items-center justify-center h-full bg-white rounded-2xl border border-slate-200">
            <Archive className="h-16 w-16 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Compressed Folders / Archive
            </h3>
            <p className="text-slate-500 mb-6 max-w-md text-center">
              Click below to download this archive file and extract it on your device.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download
              className="bg-yellow-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-yellow-700 transition flex items-center gap-2"
            >
              <Archive className="h-5 w-5" />
              Download Archive
            </a>
          </div>
        );
      } else {
        // Use Google Docs viewer or Office Web Viewer for other documents
        const officeViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        embedContent = (
          <iframe
            src={officeViewerUrl}
            className="w-full h-full rounded-2xl border-none"
          ></iframe>
        );
      }
    } else {
      // Regular link
      embedContent = (
        <div className="flex flex-col items-center justify-center h-full bg-white rounded-2xl border border-slate-200">
          <LinkIcon className="h-16 w-16 text-blue-500 mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">
            Web Resource
          </h3>
          <p className="text-slate-500 mb-6 max-w-md text-center">
            This resource opens in a new tab or browser window.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Open Resource
          </a>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-slate-900 rounded-3xl overflow-hidden shadow-xl border border-slate-800">
        <div className="bg-slate-950 px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-white font-semibold truncate flex-1 pr-4">
            {selectedAttachment.title || "Attached Resource"}
          </h2>
        </div>
        <div className="flex-1 p-2">{embedContent}</div>
      </div>
    );
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "youtube":
        return <PlayCircle className="h-4 w-4" />;
      case "pdf":
      case "document":
      case "upload":
        return <File className="h-4 w-4" />;
      case "link":
      default:
        return <LinkIcon className="h-4 w-4" />;
    }
  };

  if (isBatchEnded) {
    return (
      <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] flex max-w-7xl mx-auto gap-4 items-center justify-center w-full">
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm max-w-lg w-full mx-4">
          <BookOpen className="h-16 w-16 mx-auto text-orange-400 mb-6" />
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Batch Ended</h2>
          <p className="text-slate-500 font-medium">
            Your batch has officially ended. Course materials and content are no longer accessible. You can still view your certificates and reports from the dashboard.
          </p>
        </div>
      </div>
    );
  }

  // If mobile view and post selected, show viewer only. Handled roughly by responsive classes.
  return (
    <div className="h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] lg:h-[calc(100vh-9rem)] min-h-[500px] flex max-w-7xl mx-auto gap-4 lg:gap-6 lg:-mt-2">
      {/* Sidebar Curriculum */}
      {isSidebarOpen && (
        <div
          className={`w-full md:w-72 lg:w-[320px] xl:w-80 flex-shrink-0 flex flex-col bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm ${selectedPost ? "hidden md:flex" : "flex"}`}
        >
          <div className="p-4 md:p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-900">
                Course Materials
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {posts.length} modules available
              </p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="hidden md:flex text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-1.5 md:p-2 rounded-xl transition shadow-sm border border-slate-200"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
            {posts.length === 0 ? (
              <div className="py-8 text-center">
                <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">
                  {isBatchEnded ? "Your batch has ended. Course materials are no longer accessible." : "No materials available yet."}
                </p>
              </div>
            ) : (
              posts.map((post) => {
                const isActive = selectedPost?.id === post.id;
                const isCompleted = completedModules.includes(post.id);
                return (
                  <div
                    key={post.id}
                    className={`rounded-2xl border transition-all ${isActive ? "border-blue-500 bg-blue-50/30" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <div
                      className="w-full text-left p-4 focus:outline-none flex flex-col cursor-pointer"
                      onClick={() => {
                        setSelectedPost(post);
                        setSelectedAttachment(null);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(post.release_date)}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleModule(post.id);
                          }}
                          className={`flex flex-col items-center justify-center transition-colors ${isCompleted ? "text-green-500" : "text-slate-300 hover:text-slate-400"}`}
                          title={
                            isCompleted
                              ? "Mark as Incomplete"
                              : "Mark as Completed"
                          }
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <h3
                        className={`font-bold line-clamp-1 pr-6 ${isActive ? "text-blue-700" : "text-slate-800"}`}
                      >
                        {post.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-3 text-xs font-medium text-slate-500">
                        <FileText className="h-4 w-4" />
                        {post.attachments?.length || 0} attachments
                      </div>
                    </div>

                    {/* Lessons/Attachments List */}
                    {isActive &&
                      post.attachments &&
                      post.attachments.length > 0 && (
                        <div className="border-t border-slate-200/60 p-2 bg-blue-50/10 rounded-b-2xl">
                          <div className="space-y-1">
                            {post.attachments.map((att: any, idx: number) => {
                              const isAttActive = selectedAttachment === att;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => setSelectedAttachment(att)}
                                  className={`w-full flex items-center justify-between text-left p-2.5 rounded-xl text-sm transition-colors ${isAttActive ? "bg-blue-600 text-white shadow-md" : "hover:bg-slate-100 text-slate-700 font-medium"}`}
                                >
                                  <div className="flex items-center gap-3 overflow-hidden pr-2">
                                    <div
                                      className={`p-1.5 rounded-md ${isAttActive ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"}`}
                                    >
                                      {getIconForType(att.type)}
                                    </div>
                                    <span className="truncate">
                                      {att.title || `Resource ${idx + 1}`}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Content Viewer */}
      <div
        className={`flex-1 flex flex-col ${!selectedPost ? "hidden md:flex" : "flex"}`}
      >
        <div className="mb-4 flex items-center gap-3">
          {selectedPost && (
            <div className="md:hidden">
              <button
                onClick={() => {
                  setSelectedPost(null);
                  setSelectedAttachment(null);
                }}
                className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Curriculum
              </button>
            </div>
          )}

          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="hidden md:flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 py-2 px-4 rounded-xl shadow-sm transition-colors group"
            >
              <Menu className="h-4 w-4 mr-2 group-hover:text-blue-600" /> Show
              Curriculum
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 bg-slate-50 md:rounded-3xl border-t md:border border-slate-200 overflow-hidden md:shadow-sm p-3 md:p-4 lg:p-6">
          {renderViewer()}
        </div>
      </div>
    </div>
  );
}
