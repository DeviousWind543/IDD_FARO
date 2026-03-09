'use client';

import React, { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent, ReactNode } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Edit, Trash2, Save, X, Eye, EyeOff, PlusSquare, Home, User, ClipboardList, Gift, Smartphone, Menu, Search, Download, Eraser } from 'lucide-react';

// Importar interfaces desde AdminPanel.
import { User as ConnectedUser, Student, Notification as AdminNotification } from './AdminPanel';

// Importamos Post, MediaItem y Comment directamente de PostCard.tsx
import PostCard, { Post, MediaItem, Comment as PostCardComment } from './PostCard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '');

interface ClassGroup {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'justified';
  student_id: string;
  student_name: string;
  student_last_name?: string;
  class_group_id?: string;
  class_group_name?: string;
}

interface AttendanceSummary {
  totalStudentsInReport: number;
  totalAssisted: number;
  totalPresent: number;
  totalAbsent: number;
  totalJustified: number;
  attendancePercentage: number;
  totalClassDays: number;
}

// Extended notification type to include CRUD notifications
interface Notification extends AdminNotification {}

interface BackendPost {
  id: string;
  title: string;
  content: string;
  user_id: string | number;
  user_name: string;
  user_photo_url?: string | null;
  media_urls: MediaItem[];
  likes: { user_id: string; post_id: string }[];
  comments: PostCardComment[];
  created_at: string;
  updated_at?: string;
}

type ManagerPanelProps = {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  theme?: 'light' | 'dark';
};

// --- Modal Component for Creating Post ---
interface CreatePostModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  newPostTitle: string;
  setNewPostTitle: (title: string) => void;
  newPostContent: string;
  setNewPostContent: (content: string) => void;
  newPostMedia: File[];
  setNewPostMedia: React.Dispatch<React.SetStateAction<File[]>>;
  loading: boolean;
  SOCKET_SERVER_URL: string;
  theme: 'light' | 'dark';
}

function CreatePostModal({
  show, onClose, onSubmit, newPostTitle, setNewPostTitle, newPostContent, setNewPostContent, newPostMedia, setNewPostMedia, loading, SOCKET_SERVER_URL, theme
}: CreatePostModalProps) {
  if (!show) return null;

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024;

  const getThemeClass = (lightClass: string, darkClass: string) => {
    return theme === 'light' ? lightClass : darkClass;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files instanceof FileList) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles: File[] = [];
      
      selectedFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`El archivo "${file.name}" (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB) excede el tamaño máximo permitido de 1 GB.`);
        } else {
          validFiles.push(file);
        }
      });
      setNewPostMedia((prevFiles: File[]) => [...prevFiles, ...validFiles]);
      e.target.value = '';
    }
  };

  const handleRemoveNewMedia = (indexToRemove: number) => {
    setNewPostMedia((prevFiles: File[]) => prevFiles.filter((_file: File, index: number) => index !== indexToRemove));
  };

  const buildMediaUrlForPreview = (file: File): string => {
    return URL.createObjectURL(file);
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`${getThemeClass('bg-white', 'bg-gray-800')} p-6 rounded-lg shadow-xl border ${getThemeClass('border-gray-300', 'border-gray-700')} max-w-lg w-full relative`}>
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 ${getThemeClass('text-gray-700 hover:text-gray-900', 'text-white hover:text-gray-300')} transition-colors`}
          aria-label="Cerrar modal"
        >
          <X size={24} />
        </button>
        <h3 className={`text-xl font-semibold ${getThemeClass('text-gray-800', 'text-white')} mb-4 text-center`}>Crear Nueva Publicación</h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="modalNewPostTitle" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-300')} mb-1`}>Título:</label>
            <input
              type="text"
              id="modalNewPostTitle"
              className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              value={newPostTitle}
              onChange={(e) => setNewPostTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="modalNewPostContent" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-300')} mb-1`}>Contenido:</label>
            <textarea
              id="modalNewPostContent"
              className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500`}
              rows={4}
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              required
            ></textarea>
          </div>
          <div>
            <label htmlFor="modalNewPostMedia" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-300')} mb-1`}>Archivos multimedia (imágenes/videos):</label>
            <input
              type="file"
              id="modalNewPostMedia"
              name="new_media"
              className={`w-full ${getThemeClass('text-gray-700', 'text-white')} text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600`}
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
             {newPostMedia.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {newPostMedia.map((file, index) => {
                  const isVideo = file.type.startsWith('video/');
                  const previewUrl = buildMediaUrlForPreview(file);
                  return (
                    <div key={index} className={`relative group w-24 h-24 rounded-lg overflow-hidden border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('bg-gray-100', 'bg-gray-700')} flex items-center justify-center`}>
                      {isVideo ? (
                        <video src={previewUrl} className="w-full h-full object-cover" controls={false} />
                      ) : (
                        <img src={previewUrl} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveNewMedia(index)}
                        className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar este medio"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button type="submit" className={`w-full ${getThemeClass('bg-indigo-600 hover:bg-indigo-700', 'bg-indigo-600 hover:bg-indigo-700')} text-white font-bold py-2 px-4 rounded-md transition-colors`} disabled={loading}>
            {loading ? 'Publicando...' : 'Crear Publicación'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- Existing Modal Components ---
type ConfirmationModalProps = {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme: 'light' | 'dark';
};

function ConfirmationModal({ show, message, onConfirm, onCancel, theme }: ConfirmationModalProps) {
    if (!show) return null;
    
    const getThemeClass = (lightClass: string, darkClass: string) => {
      return theme === 'light' ? lightClass : darkClass;
    };
    
    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
        <div className={`${getThemeClass('bg-white', 'bg-gray-800')} p-6 rounded-lg shadow-xl border ${getThemeClass('border-gray-300', 'border-gray-700')} max-w-sm w-full`}>
          <p className={`${getThemeClass('text-gray-800', 'text-white')} text-lg mb-6 text-center`}>{message}</p>
          <div className="flex justify-center space-x-4">
            <button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded transition">Confirmar</button>
            <button onClick={onCancel} className={`${getThemeClass('bg-gray-300 hover:bg-gray-400', 'bg-gray-500 hover:bg-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} font-bold py-2 px-5 rounded transition`}>Cancelar</button>
          </div>
        </div>
      </div>
    );
}

type MediaViewerModalProps = {
  postMediaArray: MediaItem[];
  initialMediaIndex: number;
  onClose: () => void;
  theme: 'light' | 'dark';
};

function MediaViewerModal({ postMediaArray, initialMediaIndex, onClose, theme }: MediaViewerModalProps) {
  if (!postMediaArray || postMediaArray.length === 0 || initialMediaIndex === undefined || initialMediaIndex < 0 || initialMediaIndex >= postMediaArray.length) {
    return null;
  }
  
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState<number>(initialMediaIndex);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    setCurrentDisplayIndex(initialMediaIndex);
  }, [initialMediaIndex]);

  const currentMedia = postMediaArray[currentDisplayIndex];
  const mediaUrl = `${SOCKET_SERVER_URL}${currentMedia?.url && currentMedia.url.startsWith('/') ? currentMedia.url : '/' + (currentMedia?.url || '')}`;

  const getThemeClass = (lightClass: string, darkClass: string) => {
    return theme === 'light' ? lightClass : darkClass;
  };

  const handleNext = useCallback(() => setCurrentDisplayIndex(prev => Math.min(prev + 1, postMediaArray.length - 1)), [postMediaArray.length]);
  const handlePrev = useCallback(() => setCurrentDisplayIndex(prev => Math.max(prev - 1, 0)), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') handleNext();
      else if (event.key === 'ArrowLeft') handlePrev();
      else if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX > 50) handlePrev(); else if (deltaX < -50) handleNext();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 p-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className={`relative max-w-4xl max-h-full ${getThemeClass('bg-white', 'bg-gray-800')} rounded-lg shadow-xl overflow-hidden flex flex-col`}>
        <button onClick={onClose} className={`absolute top-3 right-3 ${getThemeClass('text-gray-700', 'text-white')} text-3xl font-bold ${getThemeClass('bg-gray-200', 'bg-gray-700')} rounded-full w-10 h-10 flex items-center justify-center ${getThemeClass('hover:bg-gray-300', 'hover:bg-gray-600')} z-10`} aria-label="Cerrar">&times;</button>
        <div className="p-4 flex-grow flex items-center justify-center">
          {currentMedia?.type?.startsWith('image') ? <img src={mediaUrl} alt="Vista previa" className="max-w-full max-h-[80vh] object-contain mx-auto" /> :
           currentMedia?.type?.startsWith('video') ? <video controls src={mediaUrl} className="max-w-full max-h-[80vh] object-contain mx-auto">Tu navegador no soporta el video.</video> :
           <p className={getThemeClass('text-gray-800', 'text-white')}>Tipo de medio no soportado.</p>}
        </div>
        {postMediaArray.length > 1 && (
          <>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <button onClick={handlePrev} disabled={currentDisplayIndex === 0} className={`${getThemeClass('bg-gray-200', 'bg-gray-700')} bg-opacity-75 ${getThemeClass('text-gray-800', 'text-white')} p-3 rounded-r-lg ${getThemeClass('hover:bg-gray-300', 'hover:bg-gray-600')} disabled:opacity-50 transition`} aria-label="Anterior">&#10094;</button>
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              <button onClick={handleNext} disabled={currentDisplayIndex === postMediaArray.length - 1} className={`${getThemeClass('bg-gray-200', 'bg-gray-700')} bg-opacity-75 ${getThemeClass('text-gray-800', 'text-white')} p-3 rounded-l-lg ${getThemeClass('hover:bg-gray-300', 'hover:bg-gray-600')} disabled:opacity-50 transition`} aria-label="Siguiente">&#10095;</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface MobileNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
}

function MobileNavBar({ activeTab, setActiveTab, theme }: MobileNavBarProps) {
  const getThemeClass = (lightClass: string, darkClass: string) => {
    return theme === 'light' ? lightClass : darkClass;
  };

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 ${getThemeClass('bg-white', 'bg-gray-800')} border-t ${getThemeClass('border-gray-300', 'border-gray-700')} flex justify-around items-center py-2 z-20 h-16`}>
      <button onClick={() => setActiveTab('posts')} className={`flex flex-col items-center p-2 transition-all rounded-md ${activeTab === 'posts' ? getThemeClass('text-indigo-600 bg-gray-100', 'text-lime-300 bg-gray-700') : getThemeClass('text-gray-600 hover:text-gray-900 hover:bg-gray-100', 'text-gray-400 hover:text-white hover:bg-gray-700')}`}>
        <Home size={20} /><span className="text-xs mt-1">Posts</span>
      </button>
      <button onClick={() => setActiveTab('attendance-reports')} className={`flex flex-col items-center p-2 transition-all rounded-md ${activeTab === 'attendance-reports' ? getThemeClass('text-indigo-600 bg-gray-100', 'text-lime-300 bg-gray-700') : getThemeClass('text-gray-600 hover:text-gray-900 hover:bg-gray-100', 'text-gray-400 hover:text-white hover:bg-gray-700')}`}>
        <ClipboardList size={20} /><span className="text-xs mt-1">Asistencia</span>
      </button>
      <button onClick={() => setActiveTab('student-list')} className={`flex flex-col items-center p-2 transition-all rounded-md ${activeTab === 'student-list' ? getThemeClass('text-indigo-600 bg-gray-100', 'text-lime-300 bg-gray-700') : getThemeClass('text-gray-600 hover:text-gray-900 hover:bg-gray-100', 'text-gray-400 hover:text-white hover:bg-gray-700')}`}>
        <User size={20} /><span className="text-xs mt-1">Estudiantes</span>
      </button>
      <button onClick={() => setActiveTab('connected-users')} className={`flex flex-col items-center p-2 transition-all rounded-md ${activeTab === 'connected-users' ? getThemeClass('text-indigo-600 bg-gray-100', 'text-lime-300 bg-gray-700') : getThemeClass('text-gray-600 hover:text-gray-900 hover:bg-gray-100', 'text-gray-400 hover:text-white hover:bg-gray-700')}`}>
        <Menu size={20} /><span className="text-xs mt-1">Usuarios</span>
      </button>
    </div>
  );
}

interface PostEditFormProps {
  editPostData: {
    title: string;
    content: string;
    media_urls: MediaItem[];
  };
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onUpdatePost: (e: FormEvent) => Promise<void>;
  onCancel: () => void;
  SOCKET_SERVER_URL: string;
  handleRemoveExistingMedia: (urlToRemove: string) => void;
  editNewMedia: File[];
  handleEditNewMediaChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleRemoveEditNewMedia: (indexToRemove: number) => void;
  loading: boolean;
  theme: 'light' | 'dark';
}

const PostEditForm: React.FC<PostEditFormProps> = ({
  editPostData,
  onInputChange,
  onUpdatePost,
  onCancel,
  SOCKET_SERVER_URL,
  handleRemoveExistingMedia,
  editNewMedia,
  handleEditNewMediaChange,
  handleRemoveEditNewMedia,
  loading,
  theme
}) => {
  const getThemeClass = (lightClass: string, darkClass: string) => {
    return theme === 'light' ? lightClass : darkClass;
  };

  const buildMediaUrl = useCallback((url: string): string => {
    if (url.startsWith('http')) return url;
    return `${SOCKET_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [SOCKET_SERVER_URL]);

  return (
    <form onSubmit={onUpdatePost} className="space-y-4">
      <h3 className={`font-semibold mb-2 ${getThemeClass('text-indigo-600', 'text-indigo-400')} text-xl`}>Editar Publicación</h3>

      <div className="space-y-2">
        <label htmlFor="post-title" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-400')}`}>
          Título
        </label>
        <input
          id="post-title"
          name="title"
          value={editPostData.title}
          onChange={onInputChange}
          required
          placeholder="Título de la publicación"
          className={`w-full p-2 rounded ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="post-content" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-400')}`}>
          Contenido
        </label>
        <textarea
          id="post-content"
          name="content"
          value={editPostData.content}
          onChange={onInputChange}
          required
          placeholder="Contenido de la publicación"
          rows={4}
          className={`w-full p-2 rounded ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:ring-2 focus:ring-indigo-500 focus:border-transparent`}
        ></textarea>
      </div>

      {editPostData.media_urls && editPostData.media_urls.length > 0 && (
        <div className="mb-4">
          <p className={`text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-300')} mb-2`}>Medios actuales:</p>
          <div className="flex flex-wrap gap-3">
            {editPostData.media_urls.map((media, index) => {
              const mediaUrl = buildMediaUrl(media.url);
              const isVideo = media.type === 'video' || (media.url && media.url.match(/\.(mp4|webm|ogg)$/i));

              return (
                <div key={index} className="relative group">
                  <div className={`w-24 h-24 rounded-lg overflow-hidden border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('bg-gray-100', 'bg-gray-700')} flex items-center justify-center`}>
                    {isVideo ? (
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover"
                        controls={false}
                        onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                          const target = e.target as HTMLVideoElement;
                          target.onerror = null;
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                Video no disponible
                              </div>
                            `;
                          }
                        }}
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt={`Media ${index}`}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                Imagen no disponible
                              </div>
                            `;
                          }
                        }}
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingMedia(media.url)}
                    className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar este medio"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="new-media" className={`block text-sm font-medium ${getThemeClass('text-gray-700', 'text-gray-400')}`}>
          {editPostData.media_urls?.length > 0 ? 'Agregar más medios' : 'Agregar medios'}
        </label>
        <input
          id="new-media"
          type="file"
          accept="image/*,video/*"
          multiple
          name="new_media"
          onChange={handleEditNewMediaChange}
          className={`w-full p-2 rounded ${getThemeClass('bg-white border border-gray-300 text-gray-700', 'bg-gray-700 border border-gray-600 text-white')} mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600`}
        />
        {editNewMedia.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {editNewMedia.map((file, index) => {
              const isVideo = file.type.startsWith('video/');
              const previewUrl = URL.createObjectURL(file);
              return (
                <div key={index} className={`relative group w-24 h-24 rounded-lg overflow-hidden border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('bg-gray-100', 'bg-gray-700')} flex items-center justify-center`}>
                  {isVideo ? (
                    <video src={previewUrl} className="w-full h-full object-cover" controls={false} />
                  ) : (
                    <img src={previewUrl} alt={`New Preview ${index}`} className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveEditNewMedia(index)}
                    className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar este medio"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          className="bg-indigo-600 text-white font-bold py-2 px-6 rounded hover:bg-indigo-700 transition flex items-center justify-center min-w-32"
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar Publicación'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`${getThemeClass('bg-gray-300 hover:bg-gray-400 text-gray-800', 'bg-gray-500 hover:bg-gray-600 text-white')} font-bold py-2 px-6 rounded transition`}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default function ManagerPanel({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  theme: propTheme = 'dark',
}: ManagerPanelProps) {
  const router = useRouter();
  const panelActiveTab = propActiveTab || 'posts';
  const panelSetActiveTab = propSetActiveTab || (() => {});
  
  const getThemeClass = (lightClass: string, darkClass: string) => {
    return propTheme === 'light' ? lightClass : darkClass;
  };

  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [newPostTitle, setNewPostTitle] = useState<string>('');
  const [newPostContent, setNewPostContent] = useState<string>('');
  const [newPostMedia, setNewPostMedia] = useState<File[]>([]);
  const [showCreatePostModal, setShowCreatePostModal] = useState<boolean>(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [editPostData, setEditPostData] = useState<{ title: string; content: string; }>({ title: '', content: '' });
  const [editNewMedia, setEditNewMedia] = useState<File[]>([]);
  const [existingMediaToDelete, setExistingMediaToDelete] = useState<string[]>([]);
  const [editingPostMedia, setEditingPostMedia] = useState<MediaItem[]>([]);
  const [viewerMediaInfo, setViewerMediaInfo] = useState<{ mediaArray: MediaItem[]; initialIndex: number; } | null>(null);
  const [loadingAction, setLoadingAction] = useState<boolean>(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [errorStudents, setErrorStudents] = useState<string>('');
  const [studentGroupFilter, setStudentGroupFilter] = useState<string>('');
  const [alumnoSearchTerm, setAlumnoSearchTerm] = useState<string>('');
  const [alumnoSearchMonth, setAlumnoSearchMonth] = useState<string>('');

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('');
  const [attendanceGroupFilter, setAttendanceGroupFilter] = useState<string>('');
  const [groupedAttendance, setGroupedAttendance] = useState<Record<string, AttendanceRecord[]>>({});

  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);
  const [connectedUsersCount, setConnectedUsersCount] = useState<number>(0);
  const [loadingConnectedUsers, setLoadingConnectedUsers] = useState<boolean>(false);

  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName');
    setLoggedInUserId(userId);
    setLoggedInUserName(userName);
  }, []);

  const calculateAge = (birthdateString: string | undefined): string | number => {
    if (!birthdateString) return 'N/A';
    const birthdate = new Date(birthdateString);
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const monthDifference = today.getMonth() - birthdate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }
    return age >= 0 ? age : 'N/A';
  };

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<ClassGroup[]>(`${API_BASE_URL}/class-groups`, { headers: { Authorization: `Bearer ${token}` } });
      setGroups(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading groups', err);
      setGroups([]);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<BackendPost[]>(`${API_BASE_URL}/posts`, { headers: { Authorization: `Bearer ${token}` } });
      if (Array.isArray(res.data)) {
        const formattedPosts: Post[] = res.data.map(post => ({
          id: post.id,
          title: post.title,
          content: post.content,
          user_id: String(post.user_id),
          user_name: post.user_name,
          user_photo_url: post.user_photo_url,
          media_urls: post.media_urls || [],
          likes: post.likes,
          comments: post.comments || [],
          created_at: post.created_at,
        }));
        setPosts(formattedPosts);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    setErrorStudents('');
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      if (studentGroupFilter) queryParams.append('groupId', studentGroupFilter);
      if (alumnoSearchTerm) queryParams.append('search', alumnoSearchTerm);
      if (alumnoSearchMonth) queryParams.append('month', alumnoSearchMonth);

      const url = `${API_BASE_URL}/alumnos?${queryParams.toString()}`;
      const res = await axios.get<Student[]>(url, { headers: { Authorization: `Bearer ${token}` } });
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setErrorStudents('Error loading students');
      console.error('Error fetching students:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [studentGroupFilter, alumnoSearchTerm, alumnoSearchMonth]);
  
  const handleDownloadAlumnosPdf = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      if (studentGroupFilter) queryParams.append('groupId', studentGroupFilter);
      if (alumnoSearchTerm) queryParams.append('search', alumnoSearchTerm);
      if (alumnoSearchMonth) queryParams.append('month', alumnoSearchMonth);

      const url = `${API_BASE_URL}/alumnos/reports/pdf?${queryParams.toString()}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'listado_alumnos.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Student list PDF downloaded correctly.');
      return;
    } catch (err: any) {
      console.error('Error downloading student list PDF:', err);
      toast.error(`Error downloading PDF: ${err.response?.data?.message || err.message}`);
      return;
    }
  };

  const fetchAttendanceReports = useCallback(async () => {
    setLoadingAttendance(true);
    setAttendanceRecords([]);
    setAttendanceSummary(null);
    setGroupedAttendance({});

    try {
      let url = `${API_BASE_URL}/asistencia/reports`;
      const params = new URLSearchParams();
      if (attendanceDateFilter) params.append('date', attendanceDateFilter);
      if (attendanceGroupFilter) params.append('class_group_id', attendanceGroupFilter);
      if (params.toString()) url += `?${params.toString()}`;
      
      const token = localStorage.getItem('token'); 
      const res = await axios.get<{ summary: AttendanceSummary; records: AttendanceRecord[] }>(url, { headers: { Authorization: `Bearer ${token}` } });
      
      setAttendanceSummary(res.data.summary);
      const records = res.data.records || [];
      if (!Array.isArray(records)) {
        setAttendanceRecords([]);
        setGroupedAttendance({});
        return;
      }
      setAttendanceRecords(records);
      
      const sortByName = (a: AttendanceRecord, b: AttendanceRecord) => {
        const nameA = `${a.student_name} ${a.student_last_name || ''}`.trim().toLowerCase();
        const nameB = `${b.student_name} ${b.student_last_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      };

      if (!attendanceDateFilter) {
        const newGroupedAttendance = records.reduce((acc, record) => {
          const dateKey = new Date(record.date).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(record);
          return acc;
        }, {} as Record<string, AttendanceRecord[]>);
        
        for (const dateKey in newGroupedAttendance) {
          newGroupedAttendance[dateKey].sort(sortByName);
        }
        setGroupedAttendance(newGroupedAttendance);
      } else {
        const dateKey = new Date(attendanceDateFilter).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        setGroupedAttendance({ [dateKey]: records.sort(sortByName) });
      }
    } catch (err: any) {
      console.error('Error loading attendance reports:', err);
      toast.error(`Error loading reports: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoadingAttendance(false);
    }
  }, [attendanceDateFilter, attendanceGroupFilter]);

  const fetchConnectedUsers = useCallback(async () => {
    setLoadingConnectedUsers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<ConnectedUser[]>(`${API_BASE_URL}/users/connected`, { headers: { Authorization: `Bearer ${token}` } });
      if (Array.isArray(res.data)) {
        setConnectedUsers(res.data);
        setConnectedUsersCount(res.data.length);
      }
    } catch (err) {
      console.error('Error fetching connected users:', err);
    } finally {
      setLoadingConnectedUsers(false);
    }
  }, []);
  
  const sendHeartbeat = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('token');
    if (token && loggedInUserId) {
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('heartbeat', loggedInUserId);
        } else {
          await axios.put(`${API_BASE_URL}/users/me/last-seen`, {}, { headers: { Authorization: `Bearer ${token}` } });
        }
        return;
      } catch (err) {
        console.error('Error sending heartbeat:', err);
        return;
      }
    }
    return;
  }, [loggedInUserId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (socketRef.current && socketRef.current.connected) {
        socketRef.current.disconnect();
    }

    if (!loggedInUserId) return;

    socketRef.current = io(SOCKET_SERVER_URL, {
        withCredentials: true,
        query: { userId: loggedInUserId }
    });
    const socket = socketRef.current;
    
    socket.off(); 

    socket.on('connect', () => {
        console.log('Connected to Socket.IO server:', socket.id);
        socket.emit('set-user-online', loggedInUserId);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
    });

    socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message);
        toast.error('Real-time connection error.');
    });

    const handleNewPost = (newPost: BackendPost) => {
        const formattedPost: Post = { ...newPost, user_id: String(newPost.user_id), user_photo_url: newPost.user_photo_url, media_urls: newPost.media_urls || [], likes: newPost.likes || [], comments: newPost.comments || [] };
        setPosts(prev => [formattedPost, ...prev]);
        toast.info(`New Post from ${newPost.user_name || 'someone'}!`);
    };
    const handlePostUpdated = (updatedPost: BackendPost) => {
        const formattedPost: Post = { ...updatedPost, user_id: String(updatedPost.user_id), user_photo_url: updatedPost.user_photo_url, media_urls: updatedPost.media_urls || [], likes: updatedPost.likes || [], comments: updatedPost.comments || [] };
        setPosts(prev => prev.map(p => p.id === formattedPost.id ? formattedPost : p));
        toast.info(`Post "${updatedPost.title}" updated.`);
    };
    const handlePostDeleted = ({ postId }: { postId: string }) => {
        setPosts(prev => prev.filter(p => p.id !== postId));
        toast.warn('A post has been deleted.');
    };
    const handleNewComment = ({postId, comment}: {postId: string, comment: PostCardComment}) => {
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const commentExists = p.comments.some(c => c.id === comment.id);
          if (!commentExists) {
            return { ...p, comments: [...(p.comments || []), comment] };
          }
        }
        return p;
      }));
    };

    const handleCommentUpdated = ({postId, comment}: {postId: string, comment: PostCardComment}) => setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || []).map(c => c.id === comment.id ? comment : c) } : p));
    
    const handleCommentDeleted = ({ postId, commentId }: { postId: string, commentId: string }) => { 
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: (p.comments || []).filter(c => c.id !== commentId) } : p));
        toast.warn('A comment has been deleted.');
    };

    const handleOnlineUsersUpdated = (users: ConnectedUser[]) => {
        setConnectedUsers(users);
        setConnectedUsersCount(users.length);
    };

    socket.on('online-users-updated', handleOnlineUsersUpdated);
    socket.on('new-post', handleNewPost);
    socket.on('post-updated', handlePostUpdated);
    socket.on('post-deleted', handlePostDeleted);
    socket.on('new-comment', handleNewComment);
    socket.on('comment-updated', handleCommentUpdated);
    socket.on('post-comment-deleted', handleCommentDeleted);
    socket.on('post-like-updated', fetchPosts);

    return () => {
        if (socket) {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.off('online-users-updated');
            socket.off('new-post');
            socket.off('post-updated');
            socket.off('post-deleted');
            socket.off('new-comment');
            socket.off('comment-updated');
            socket.off('post-comment-deleted');
            socket.off('post-like-updated');
            socket.disconnect();
        }
    };
}, [loggedInUserId, fetchConnectedUsers, fetchPosts]);


  useEffect(() => {
    const heartbeatIntervalId = setInterval(sendHeartbeat, 60 * 1000);
    fetchGroups();
    
    switch (panelActiveTab) {
        case 'posts': fetchPosts(); break;
        case 'attendance-reports': fetchAttendanceReports(); fetchGroups(); break;
        case 'student-list': fetchStudents(); fetchGroups(); break;
        case 'connected-users': fetchConnectedUsers(); break;
        default: if (panelActiveTab === 'posts') fetchPosts(); break;
    }
    
    return () => clearInterval(heartbeatIntervalId);
  }, [panelActiveTab, sendHeartbeat, fetchGroups, fetchPosts, fetchStudents, fetchAttendanceReports, fetchConnectedUsers]);

  const handleCreatePostSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('No se encontró token de autenticación.');
      return;
    }
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast.error('El título y contenido son obligatorios.');
      return;
    }

    try {
      setLoadingAction(true);
      const formData = new FormData();
      formData.append('title', newPostTitle);
      formData.append('content', newPostContent);
      newPostMedia.forEach(file => formData.append('new_media', file));

      await axios.post(`${API_BASE_URL}/posts`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Publicación creada correctamente');
      setShowCreatePostModal(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostMedia([]);
      fetchPosts();
    } catch (err: any) {
      console.error('Error creando publicación:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeletePost = (postToDelete: Post) => {
    setModalMessage(`Are you sure you want to delete the post "${postToDelete.title}"? This action is irreversible.`);
    setConfirmAction(() => async (): Promise<void> => {
      setLoadingAction(true);
      const token = localStorage.getItem('token');
      try {
        await axios.delete(`${API_BASE_URL}/posts/${postToDelete.id}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Post deleted'); 
        fetchPosts();
        return;
      }
      catch (error: any) { 
        console.error('Error deleting post:', error.response?.data || error.message);
        toast.error(`Error deleting post: ${error.response?.data?.message || error.message}`); 
        return;
      }
      finally { setShowConfirmModal(false); setLoadingAction(false); }
    });
    setShowConfirmModal(true);
  };

  const handleEditPostClick = (post: Post) => {
    setEditPostId(post.id);
    setEditPostData({ title: post.title, content: post.content });
    setEditNewMedia([]);
    setExistingMediaToDelete([]);
    setEditingPostMedia(Array.isArray(post.media_urls) ? [...post.media_urls] : []);
  };

  const handleRemoveExistingMedia = (urlToRemove: string) => {
    setExistingMediaToDelete(prev => [...prev, urlToRemove]);
    setEditingPostMedia(prev => prev.filter(media => media.url !== urlToRemove));
  };

  const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024 * 1024;

  const handleEditNewMediaChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files instanceof FileList) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles: File[] = [];

      selectedFiles.forEach(file => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`El archivo "${file.name}" (${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB) excede el tamaño máximo permitido de 1 GB.`);
        } else {
          validFiles.push(file);
        }
      });
      setEditNewMedia((prevFiles: File[]) => [...prevFiles, ...validFiles]);
      e.target.value = '';
    }
  };

  const handleRemoveEditNewMedia = (indexToRemove: number) => {
    setEditNewMedia((prevFiles: File[]) => prevFiles.filter((_file: File, index: number) => index !== indexToRemove));
  };

  const handleCancelPostEdit = () => {
    setEditPostId(null); setEditPostData({ title: '', content: '' }); setEditNewMedia([]); setExistingMediaToDelete([]); setEditingPostMedia([]);
  };

  const handleEditPostSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!editPostId) {
      toast.error('Post ID not found.');
      return;
    }
    setLoadingAction(true);
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('You need to be logged in to edit posts.');
      setLoadingAction(false);
      return;
    }
    const formData = new FormData();
    formData.append('title', editPostData.title);
    formData.append('content', editPostData.content);
    
    editNewMedia.forEach((file) => {
        formData.append('new_media', file);
    });

    if (existingMediaToDelete.length > 0) {
      formData.append('media_to_delete', JSON.stringify(existingMediaToDelete));
    }

    try {
      await axios.put(`${API_BASE_URL}/posts/${editPostId}`, formData, { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        } 
      });
      toast.success('Post updated'); handleCancelPostEdit(); fetchPosts();
      return;
    } catch (error: any) { 
      console.error('Error updating post:', error.response?.data || error.message);
      toast.error(`Error updating post: ${error.response?.data?.error || error.response?.data?.message || error.message}`); 
      return;
    }
    finally { setLoadingAction(false); }
  };
  
  const handleToggleLike = async (postId: string): Promise<void> => { 
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token) { 
      toast.error('You must be logged in to like.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/likes/toggle`, { post_id: postId, user_id: loggedInUserId }, { headers: { Authorization: `Bearer ${token}` } });
      return;
    } catch (error) { 
      console.error('Error toggling like:', error);
      toast.error('Error liking/unliking.'); 
      return;
    }
  };

  const handleAddComment = async (postId: string, content: string): Promise<void> => {
    if (!content.trim()) {
      toast.error('Comment cannot be empty.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token) {
      toast.error('You must be logged in to comment.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/comments`, { post_id: postId, content }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Comment added');
      return;
    } catch (error) { 
      console.error('Error adding comment:', error);
      toast.error('Error adding comment.'); 
      return;
    }
  };

  const handleDeleteComment = (commentId: string, postId: string) => { 
    setModalMessage('Are you sure you want to delete this comment?');
    setConfirmAction(() => async (): Promise<void> => {
      setLoadingAction(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('You need to be logged in to delete comments.');
        setShowConfirmModal(false);
        setLoadingAction(false);
        return;
      }
      try {
        await axios.delete(`${API_BASE_URL}/comments/${commentId}`, { headers: { Authorization: `Bearer ${token}` } });
        toast.success('Comment deleted');
        return;
      } catch (error) { 
      console.error('Error deleting comment:', error);
        toast.error('Error deleting comment.'); 
        return;
      }
      finally { setShowConfirmModal(false); setLoadingAction(false); }
    });
    setShowConfirmModal(true);
  };

  const handleEditComment = async (commentId: string, postId: string, newContent: string): Promise<void> => {
    if (!newContent.trim()) {
      toast.error('Comment cannot be empty.');
      return;
    }
    setLoadingAction(true);
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('You need to be logged in to update comments.');
      setLoadingAction(false);
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/comments/${commentId}`, { content: newContent }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Comment updated');
      return;
    } catch (error) { 
      console.error('Error updating comment:', error);
      toast.error('Error updating comment.'); 
      return;
    }
    finally { setLoadingAction(false); }
  };

  const handleDownloadPdf = async (): Promise<void> => {
    try {
      let url = `${API_BASE_URL}/asistencia/reports/pdf`;
      const params = new URLSearchParams();
      if (attendanceDateFilter) params.append('date', attendanceDateFilter);
      if (attendanceGroupFilter) params.append('class_group_id', attendanceGroupFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const token = localStorage.getItem('token');
      const response = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'attendance_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('PDF report downloaded.');
      return;
    } catch (err: any) {
      console.error('Error downloading PDF:', err);
      toast.error(`Error downloading PDF: ${err.response?.data?.error || err.message}`);
      return;
    }
  };

  const getRoleName = (roleId: number | string | undefined) => {
    switch (Number(roleId)) {
      case 1: return 'Admin';
      case 2: return 'Teacher';
      case 3: return 'Manager';
      case 4: return 'User';
      default: return 'Unknown';
    }
  };

  return (
    <section className={`min-h-screen ${getThemeClass('bg-gradient-to-br from-slate-50 to-slate-100 text-slate-900', 'bg-gray-900 text-white')} p-2 md:p-8 max-w-7xl xl:max-w-screen-xl mx-auto rounded-lg shadow-lg pb-20 md:pb-8`}>
      <h2 className={`text-3xl font-bold ${getThemeClass('text-indigo-600', 'text-indigo-400')} mb-6 text-center md:text-left`}>Panel de Gerente</h2>

      <div className={`hidden md:flex flex-wrap justify-center md:justify-start gap-2 mb-6 border-b ${getThemeClass('border-gray-300', 'border-gray-700')} pb-4`}>
        <button onClick={() => panelSetActiveTab('posts')} className={`px-4 py-2 rounded-md transition-all ${panelActiveTab === 'posts' ? getThemeClass('bg-indigo-600 text-white', 'bg-indigo-600 text-white') : getThemeClass('bg-gray-200 text-gray-800 hover:bg-gray-300', 'bg-gray-700 text-gray-300 hover:bg-gray-600')}`}>Publicaciones</button>
        <button onClick={() => panelSetActiveTab('attendance-reports')} className={`px-4 py-2 rounded-md transition-all ${panelActiveTab === 'attendance-reports' ? getThemeClass('bg-indigo-600 text-white', 'bg-indigo-600 text-white') : getThemeClass('bg-gray-200 text-gray-800 hover:bg-gray-300', 'bg-gray-700 text-gray-300 hover:bg-gray-600')}`}>Reportes de Asistencia</button>
        <button onClick={() => panelSetActiveTab('student-list')} className={`px-4 py-2 rounded-md transition-all ${panelActiveTab === 'student-list' ? getThemeClass('bg-indigo-600 text-white', 'bg-indigo-600 text-white') : getThemeClass('bg-gray-200 text-gray-800 hover:bg-gray-300', 'bg-gray-700 text-gray-300 hover:bg-gray-600')}`}>Lista de Estudiantes</button>
        <button onClick={() => panelSetActiveTab('connected-users')} className={`px-4 py-2 rounded-md transition-all ${panelActiveTab === 'connected-users' ? getThemeClass('bg-indigo-600 text-white', 'bg-indigo-600 text-white') : getThemeClass('bg-gray-200 text-gray-800 hover:bg-gray-300', 'bg-gray-700 text-gray-300 hover:bg-gray-600')}`}>Usuarios Conectados ({connectedUsersCount})</button>
      </div>

      <div className="w-full px-0 md:px-4 overflow-x-hidden">

        {panelActiveTab === 'posts' && (
          <div className="flex flex-col gap-6 w-full">
            <button
              onClick={() => setShowCreatePostModal(true)}
              className={`w-full md:w-auto ${getThemeClass('bg-indigo-600 hover:bg-indigo-700', 'bg-indigo-600 hover:bg-indigo-700')} text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mb-6`}
            >
              <PlusSquare size={24} /> Crear Nueva Publicación
            </button>

            {editPostId && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className={`${getThemeClass('bg-white', 'bg-gray-800')} p-6 rounded-lg shadow-xl border ${getThemeClass('border-gray-300', 'border-gray-700')} max-w-lg w-full relative`}>
                        <button
                            onClick={handleCancelPostEdit}
                            className={`absolute top-3 right-3 ${getThemeClass('text-gray-700 hover:text-gray-900', 'text-white hover:text-gray-300')} transition-colors`}
                            aria-label="Cerrar modal de edición"
                        >
                            <X size={24} />
                        </button>
                        <PostEditForm
                            editPostData={{ ...editPostData, media_urls: editingPostMedia }}
                            onInputChange={(e) => setEditPostData({ ...editPostData, [e.target.name]: e.target.value })}
                            onUpdatePost={handleEditPostSubmit}
                            onCancel={handleCancelPostEdit}
                            SOCKET_SERVER_URL={SOCKET_SERVER_URL}
                            handleRemoveExistingMedia={handleRemoveExistingMedia}
                            editNewMedia={editNewMedia}
                            handleEditNewMediaChange={handleEditNewMediaChange}
                            handleRemoveEditNewMedia={handleRemoveEditNewMedia}
                            loading={loadingAction}
                            theme={propTheme}
                        />
                    </div>
                </div>
            )}

            <h3 className={`text-2xl font-bold ${getThemeClass('text-indigo-600', 'text-lime-400')} mb-4`}>Todas las Publicaciones</h3>
            {loadingPosts ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>Cargando publicaciones...</p>
            ) : posts.length === 0 ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>No hay publicaciones para mostrar.</p>
            ) : (
              <div className="grid grid-cols-1 max-w-2xl mx-auto gap-6">
                {posts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={loggedInUserId}
                    onDeletePost={handleDeletePost}
                    onStartEditPost={handleEditPostClick}
                    onLikeToggle={handleToggleLike}
                    onAddComment={handleAddComment}
                    onDeleteComment={handleDeleteComment}
                    onUpdateComment={handleEditComment}
                    onOpenMediaViewer={(media: MediaItem[], initialIndex: number) => setViewerMediaInfo({ mediaArray: media, initialIndex })}
                    socket={socketRef.current}
                    currentUserRole={3}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {panelActiveTab === 'attendance-reports' && (
          <div className="grid grid-cols-1 max-w-full md:max-w-5xl mx-auto gap-6">
            <h3 className={`text-2xl font-bold ${getThemeClass('text-indigo-600', 'text-lime-400')} mb-6`}>Reportes de Asistencia</h3>

            <div className="flex flex-wrap items-center justify-start gap-2 mb-6">
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="attendanceGroupFilter" className="sr-only">Filtrar por Grupo:</label>
                    <select
                        id="attendanceGroupFilter"
                        className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:outline-none focus:ring-2 ${getThemeClass('focus:ring-indigo-500', 'focus:ring-lime-500')}`}
                        value={attendanceGroupFilter}
                        onChange={(e) => setAttendanceGroupFilter(e.target.value)}
                    >
                        <option value="">Todos los Grupos</option>
                        {groups.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="attendanceDateFilter" className="sr-only">Filtrar por Fecha:</label>
                    <input
                        type="date"
                        id="attendanceDateFilter"
                        className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:outline-none focus:ring-2 ${getThemeClass('focus:ring-indigo-500', 'focus:ring-lime-500')}`}
                        value={attendanceDateFilter}
                        onChange={(e) => setAttendanceDateFilter(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 flex-grow">
                    <button
                        onClick={fetchAttendanceReports}
                        className={`flex-1 ${getThemeClass('bg-indigo-600 hover:bg-indigo-700', 'bg-lime-600 hover:bg-lime-700')} text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Search size={18} /> <span className="hidden sm:inline">Buscar</span>
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        className={`flex-1 ${getThemeClass('bg-teal-600 hover:bg-teal-700', 'bg-teal-600 hover:bg-teal-700')} text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Download size={18} /> <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button
                        onClick={() => { setAttendanceDateFilter(''); setAttendanceGroupFilter(''); fetchAttendanceReports(); }}
                        className={`flex-1 ${getThemeClass('bg-gray-300 hover:bg-gray-400 text-gray-800', 'bg-gray-500 hover:bg-gray-600 text-white')} font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Eraser size={18} /> <span className="hidden sm:inline">Limpiar</span>
                    </button>
                </div>
            </div>

            {attendanceSummary && (
              <div className={`${getThemeClass('bg-gray-100 border border-gray-300', 'bg-gray-700 border border-gray-600')} p-4 rounded-md shadow-inner mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4`}>
                <p className={getThemeClass('text-gray-700', 'text-gray-300')}><span className={`font-semibold ${getThemeClass('text-gray-900', 'text-white')}`}>Total de Estudiantes en Reporte:</span> {attendanceSummary.totalStudentsInReport}</p>
                <p className={getThemeClass('text-gray-700', 'text-gray-300')}><span className={`font-semibold ${getThemeClass('text-green-600', 'text-green-400')}`}>Total Presentes:</span> {attendanceSummary.totalPresent}</p>
                <p className={getThemeClass('text-gray-700', 'text-gray-300')}><span className={`font-semibold ${getThemeClass('text-red-600', 'text-red-400')}`}>Total Ausentes:</span> {attendanceSummary.totalAbsent}</p>
                <p className={getThemeClass('text-gray-700', 'text-gray-300')}><span className={`font-semibold ${getThemeClass('text-yellow-600', 'text-yellow-400')}`}>Total Justificados:</span> {attendanceSummary.totalJustified}</p>
                <p className={getThemeClass('text-gray-700', 'text-gray-300')}><span className={`font-semibold ${getThemeClass('text-gray-900', 'text-white')}`}>Días de Clase Registrados:</span> {attendanceSummary.totalClassDays}</p>
                <p className={`${getThemeClass('text-gray-700', 'text-gray-300')} text-lg font-bold`}><span className={`font-semibold ${getThemeClass('text-purple-600', 'text-purple-400')}`}>Porcentaje de Asistencia:</span> {attendanceSummary.attendancePercentage.toFixed(2)}%</p>
              </div>
            )}

            {loadingAttendance ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>Cargando registros de asistencia...</p>
            ) : Object.keys(groupedAttendance).length === 0 ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>No se encontraron registros de asistencia para los filtros seleccionados.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className={`${getThemeClass('bg-gray-200 text-indigo-600', 'bg-gray-700 text-lime-400')} text-sm`}>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Estudiante</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Grupo</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(groupedAttendance).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map((dateKey) => (
                      <React.Fragment key={dateKey}>
                        <tr className={getThemeClass('bg-gray-100', 'bg-gray-600')}>
                          <td colSpan={4} className={`p-3 text-center font-bold text-lg ${getThemeClass('text-gray-800', 'text-white')}`}>{dateKey}</td>
                        </tr>
                        {groupedAttendance[dateKey].map((record) => (
                          <tr key={record.id} className={getThemeClass('hover:bg-gray-50', 'hover:bg-gray-700/50')}>
                            <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{record.student_name} {record.student_last_name || ''}</td>
                            <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{record.class_group_name || 'Sin grupo'}</td>
                            <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} font-semibold ${ record.status === 'present' ? getThemeClass('text-green-600', 'text-green-400') : record.status === 'absent' ? getThemeClass('text-red-600', 'text-red-400') : getThemeClass('text-yellow-600', 'text-yellow-400') }`}>
                              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {panelActiveTab === 'student-list' && (
        <div className="w-full max-w-full md:max-w-7xl mx-auto md:px-8 grid grid-cols-1 gap-6">
          <div className={`${getThemeClass('bg-white border border-gray-300', 'bg-gray-800 border border-gray-700')} p-2 sm:p-4 md:p-6 rounded-md shadow-lg w-full`}>

            <h3 className={`text-2xl font-bold ${getThemeClass('text-indigo-600', 'text-lime-400')} mb-6`}>Lista de Estudiantes ({students.length})</h3>
            
            <div className="flex flex-wrap items-center justify-start gap-2 mb-6">
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="studentGroupFilter" className="sr-only">Filtrar por Grupo:</label>
                    <select
                        id="studentGroupFilter"
                        className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:outline-none focus:ring-2 ${getThemeClass('focus:ring-indigo-500', 'focus:ring-lime-500')}`}
                        value={studentGroupFilter}
                        onChange={(e) => setStudentGroupFilter(e.target.value)}
                    >
                        <option value="">Todos los Grupos</option>
                        {groups.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="alumnoSearchTerm" className="sr-only">Buscar Estudiante:</label>
                    <input
                        type="text"
                        id="alumnoSearchTerm"
                        className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} placeholder-gray-400 focus:outline-none focus:ring-2 ${getThemeClass('focus:ring-indigo-500', 'focus:ring-lime-500')}`}
                        placeholder="Buscar por nombre, ID..."
                        value={alumnoSearchTerm}
                        onChange={(e) => setAlumnoSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="alumnoSearchMonth" className="sr-only">Filtrar por Mes de Nacimiento:</label>
                    <select
                        id="alumnoSearchMonth"
                        className={`w-full p-2 rounded-md ${getThemeClass('bg-white border border-gray-300 text-gray-900', 'bg-gray-700 border border-gray-600 text-white')} focus:outline-none focus:ring-2 ${getThemeClass('focus:ring-indigo-500', 'focus:ring-lime-500')}`}
                        value={alumnoSearchMonth}
                        onChange={(e) => setAlumnoSearchMonth(e.target.value)}
                    >
                        <option value="">Todos los Meses</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                            <option key={month} value={String(month).padStart(2, '0')}>
                                {new Date(0, month - 1).toLocaleString('es-EC', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 flex-grow">
                    <button
                        onClick={fetchStudents}
                        className={`flex-1 ${getThemeClass('bg-indigo-600 hover:bg-indigo-700', 'bg-lime-600 hover:bg-lime-700')} text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Search size={18} /> <span className="hidden sm:inline">Buscar</span>
                    </button>
                    <button
                        onClick={handleDownloadAlumnosPdf}
                        className={`flex-1 ${getThemeClass('bg-teal-600 hover:bg-teal-700', 'bg-teal-600 hover:bg-teal-700')} text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Download size={18} /> <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button
                        onClick={() => { setStudentGroupFilter(''); setAlumnoSearchTerm(''); setAlumnoSearchMonth(''); fetchStudents(); }}
                        className={`flex-1 ${getThemeClass('bg-gray-300 hover:bg-gray-400 text-gray-800', 'bg-gray-500 hover:bg-gray-600 text-white')} font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2`}
                    >
                        <Eraser size={18} /> <span className="hidden sm:inline">Limpiar</span>
                    </button>
                </div>
            </div>

            {loadingStudents ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} px-4 md:px-0 text-center`}>Cargando estudiantes...</p>
            ) : errorStudents ? (
              <p className="text-red-500 px-4 md:px-0 text-center">{errorStudents}</p>
            ) : Array.isArray(students) && students.length === 0 ? (
              <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} px-4 md:px-0 text-center`}>No se encontraron estudiantes.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className={`${getThemeClass('bg-gray-200 text-indigo-600', 'bg-gray-700 text-lime-400')} text-sm`}>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>N°</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Foto</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Nombres y Apellidos</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Edad</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden sm:table-cell`}>Cédula</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden md:table-cell`}>Fecha de Nacimiento</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden md:table-cell`}>Acudiente</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden md:table-cell`}>Teléfono Acudiente</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden md:table-cell`}>Dirección</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left hidden md:table-cell`}>Grupo</th>
                    </tr>
                  </thead>
                  <tbody>
                     {Array.isArray(students) && students.map((student, index) => (
                      <tr key={student.id} className={getThemeClass('hover:bg-gray-50', 'hover:bg-gray-700/50')}>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{index + 1}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')}`}>
                          {student.photo_url ? (
                            <img
                              src={student.photo_url.startsWith('http') ? student.photo_url : `${SOCKET_SERVER_URL}${student.photo_url}`}
                              alt={student.name}
                              className="w-10 h-10 object-cover rounded-full"
                            />
                          ) : (
                            <div className={`w-10 h-10 ${getThemeClass('bg-gray-200', 'bg-gray-600')} rounded-full flex items-center justify-center text-lg ${getThemeClass('text-gray-800', 'text-white')}`}>
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{student.name} {student.last_name}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{calculateAge(student.birthdate)} años</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden sm:table-cell`}>{student.cedula}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden md:table-cell`}>{student.birthdate?.split('T')[0]}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden md:table-cell`}>{student.guardian_name}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden md:table-cell`}>{student.guardian_phone}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden md:table-cell`}>{student.direccion}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')} hidden md:table-cell`}>{groups.find(g => g.id === student.class_group_id)?.name || 'Sin Grupo'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}
        
      {panelActiveTab === 'connected-users' && (
      <div className="w-full md:max-w-6xl mx-auto">
        <div className={`${getThemeClass('bg-white border border-gray-300', 'bg-gray-800 border border-gray-700')} p-4 md:p-6 rounded-md shadow-lg`}>
          <h3 className={`text-2xl font-bold ${getThemeClass('text-indigo-600', 'text-lime-400')} mb-6`}>Usuarios Conectados</h3>
          <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} mb-4`}>Lista de usuarios con actividad reciente.</p>

          {loadingConnectedUsers ? (
            <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>Cargando usuarios...</p>
          ) : connectedUsers.length === 0 ? (
            <p className={`${getThemeClass('text-gray-600', 'text-gray-400')} text-center`}>No hay usuarios conectados.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:hidden">
                {connectedUsers.map((user) => (
                  <div key={user.id} className={`${getThemeClass('bg-gray-100', 'bg-gray-700')} p-4 rounded-lg shadow-md`}>
                    <div className="flex items-center gap-4">
                      {user.photo_url ? (
                        <img
                          src={user.photo_url.startsWith('http') ? user.photo_url : `${SOCKET_SERVER_URL}${user.photo_url}`}
                          alt={user.name}
                          className="w-12 h-12 object-cover rounded-full"
                        />
                      ) : (
                        <div className={`w-12 h-12 ${getThemeClass('bg-gray-200', 'bg-gray-600')} rounded-full flex items-center justify-center text-lg ${getThemeClass('text-gray-800', 'text-white')}`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className={`font-bold ${getThemeClass('text-gray-800', 'text-white')}`}>{user.name}</p>
                        <p className={`text-sm ${getThemeClass('text-gray-600', 'text-gray-400')}`}>{user.country || 'N/A'}</p>
                        <p className={`text-sm ${getThemeClass('text-gray-600', 'text-gray-400')}`}>
                          {user.last_seen
                            ? new Date(user.last_seen).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
                            : 'N/A'}
                        </p>
                        <p className={`text-xs ${getThemeClass('text-gray-500', 'text-gray-500')}`}>{user.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block">
                <table className="w-full table-auto border-collapse">
                  <thead>
                    <tr className={`${getThemeClass('bg-gray-200 text-indigo-600', 'bg-gray-700 text-lime-400')} text-sm`}>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Foto</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Nombre</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>País</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Tiempo de Conexión</th>
                      <th className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} text-left`}>Correo Electrónico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectedUsers.map((user) => (
                      <tr key={user.id} className={getThemeClass('hover:bg-gray-50', 'hover:bg-gray-700/50')}>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')}`}>
                          {user.photo_url ? (
                            <img
                              src={user.photo_url.startsWith('http') ? user.photo_url : `${SOCKET_SERVER_URL}${user.photo_url}`}
                              alt={user.name}
                              className="w-10 h-10 object-cover rounded-full"
                            />
                          ) : (
                            <div className={`w-10 h-10 ${getThemeClass('bg-gray-200', 'bg-gray-600')} rounded-full flex items-center justify-center text-lg ${getThemeClass('text-gray-800', 'text-white')}`}>
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{user.name}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{user.country || 'N/A'}</td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>
                          {user.last_seen
                            ? new Date(user.last_seen).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
                            : 'N/A'}
                        </td>
                        <td className={`p-3 border ${getThemeClass('border-gray-300', 'border-gray-600')} ${getThemeClass('text-gray-800', 'text-white')}`}>{user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    )}
</div>

    <CreatePostModal
      show={showCreatePostModal}
      onClose={() => setShowCreatePostModal(false)}
      onSubmit={handleCreatePostSubmit}
      newPostTitle={newPostTitle}
      setNewPostTitle={setNewPostTitle}
      newPostContent={newPostContent}
      setNewPostContent={setNewPostContent}
      newPostMedia={newPostMedia}
      setNewPostMedia={setNewPostMedia}
      loading={loadingAction}
      SOCKET_SERVER_URL={SOCKET_SERVER_URL}
      theme={propTheme}
    />

    <ToastContainer theme={propTheme === 'light' ? 'light' : 'dark'} />
    <ConfirmationModal
      show={showConfirmModal}
      message={modalMessage}
      onConfirm={() => confirmAction && confirmAction()}
      onCancel={() => setShowConfirmModal(false)}
      theme={propTheme}
    />
    {viewerMediaInfo && (
      <MediaViewerModal
        postMediaArray={viewerMediaInfo.mediaArray}
        initialMediaIndex={viewerMediaInfo.initialIndex}
        onClose={() => setViewerMediaInfo(null)}
        theme={propTheme}
      />
    )}
    <MobileNavBar activeTab={panelActiveTab} setActiveTab={panelSetActiveTab} theme={propTheme} />
    </section>
  );
}