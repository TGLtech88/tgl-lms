import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ContentState {
  posts: any[];
  selectedPost: any | null;
  selectedAttachment: any | null;
  isSidebarOpen: boolean;
  completedModules: string[];
  setPosts: (posts: any[]) => void;
  setSelectedPost: (post: any | null) => void;
  setSelectedAttachment: (attachment: any | null) => void;
  setIsSidebarOpen: (isOpen: boolean) => void;
  setCompletedModules: (moduleIds: string[]) => void;
  toggleModuleCompletion: (postId: string) => void;
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      posts: [],
      selectedPost: null,
      selectedAttachment: null,
      isSidebarOpen: true,
      completedModules: [],
      setPosts: (posts) => set({ posts }),
      setSelectedPost: (post) => set({ selectedPost: post }),
      setSelectedAttachment: (attachment) => set({ selectedAttachment: attachment }),
      setIsSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
      setCompletedModules: (moduleIds) => set({ completedModules: moduleIds }),
      toggleModuleCompletion: (postId) => set((state) => {
        const isCompleted = state.completedModules.includes(postId);
        if (isCompleted) {
          return { completedModules: state.completedModules.filter(id => id !== postId) };
        } else {
          return { completedModules: [...state.completedModules, postId] };
        }
      }),
    }),
    {
      name: 'content-storage', 

      // This will store the state in localStorage by default
      // so if they refresh, change chrome tabs and Chrome unloads it, or minimise it, it persists
    }
  )
);
