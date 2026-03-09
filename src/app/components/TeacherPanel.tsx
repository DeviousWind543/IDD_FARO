'use client'
import { useEffect, useState, useCallback, useRef, ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
import PostCard from './PostCard'
import MediaViewer from './MediaViewer'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Edit, Trash2, Save, X } from 'lucide-react';
// Importar interfaces desde PostCard.tsx
import { Post, MediaItem, Comment as PostCardComment } from './PostCard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '')

// --- Definiciones de Tipos ---
type Comment = PostCardComment;

interface TeacherPanelProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  allowedTabs?: string[];
  onNotificationRead: () => Promise<void>;
  theme?: 'light' | 'dark'; // Prop para el tema
}

interface ClassGroup {
  id: number;
  name: string;
}

interface Alumno {
  id?: string;
  name: string;
  last_name: string;
  birthdate: string;
  cedula: string;
  guardian_name: string;
  guardian_phone: string;
  photo_url: string;
  class_group_id: number | string;
  direccion: string;
}

interface Notification {
  id: string;
  type: string;
  actor_name: string;
  post_title: string;
  content: string;
  read_status: boolean;
  created_at: string;
}

// Props para los modales
interface ModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  theme: 'light' | 'dark';
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
  loading: boolean;
  theme: 'light' | 'dark';
}

// Helper para clases CSS según el tema
const getThemeClass = (theme: 'light' | 'dark', lightClass: string, darkClass: string) => {
  return theme === 'light' ? lightClass : darkClass;
};

// Componente Modal con tema
const Modal: React.FC<ModalProps> = ({ children, isOpen, onClose, theme }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-md">
        <style jsx>{`
          @supports not (backdrop-filter: blur(12px)) {
            .backdrop-blur-md {
              background-color: rgba(0, 0, 0, 0.15) !important;
            }
          }
        `}</style>
      </div>

      <div
        className={`relative ${getThemeClass(
          theme,
          'bg-white text-gray-900 border-gray-200',
          'bg-gray-800 text-white border-gray-700'
        )} rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 overflow-y-auto max-h-[90vh] border transform transition-all duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// Componente ConfirmModal con tema
const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar',
  theme 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className={`${getThemeClass(
        theme,
        'bg-white text-gray-800',
        'bg-gray-800 text-white'
      )} rounded-lg shadow-xl max-w-sm w-full p-6 transform transition-all duration-300 scale-100 opacity-100`}>
        <div className={`flex justify-between items-center mb-4 pb-3 ${getThemeClass(
          theme,
          'border-b border-gray-200',
          'border-b border-gray-700'
        )}`}>
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className={`${getThemeClass(
              theme,
              'text-gray-400 hover:text-gray-600',
              'text-gray-400 hover:text-gray-300'
            )} text-2xl leading-none`}
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>

        <div className="mb-6">
          <p className={`${getThemeClass(
            theme,
            'text-gray-700',
            'text-gray-300'
          )} text-base`}>{message}</p>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-md border ${getThemeClass(
              theme,
              'border-gray-300 text-gray-700 hover:bg-gray-100',
              'border-gray-600 text-gray-300 hover:bg-gray-700'
            )} transition-colors duration-200`}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-md bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors duration-200"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const calcularEdad = (fechaNacimiento: string): string | number => {
  try {
    if (!fechaNacimiento) return 'N/A';

    const fechaNac = new Date(fechaNacimiento);
    if (isNaN(fechaNac.getTime())) return 'Inválida';

    const hoy = new Date();
    if (fechaNac > hoy) return 'Inválida';

    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }

    return edad >= 0 ? edad : 'Inválida';
  } catch (error) {
    console.error('Error calculando edad:', error);
    return 'Error';
  }
};

// Componente PostEditForm con tema
const PostEditForm: React.FC<PostEditFormProps> = ({
  editPostData,
  onInputChange,
  onUpdatePost,
  onCancel,
  SOCKET_SERVER_URL,
  handleRemoveExistingMedia,
  editNewMedia,
  handleEditNewMediaChange,
  loading,
  theme
}) => {
  const buildMediaUrl = useCallback((url: string | null): string => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${SOCKET_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }, [SOCKET_SERVER_URL]);

  return (
    <form onSubmit={onUpdatePost} className="space-y-4">
      <h3 className={`font-semibold mb-2 ${getThemeClass(
        theme,
        'text-yellow-600',
        'text-yellow-300'
      )} text-xl`}>Editar Publicación</h3>

      <div className="space-y-2">
        <label htmlFor="post-title" className={`block text-sm font-medium ${getThemeClass(
          theme,
          'text-gray-600',
          'text-gray-400'
        )}`}>
          Título
        </label>
        <input
          id="post-title"
          name="title"
          value={editPostData.title}
          onChange={onInputChange}
          required
          placeholder="Título de la publicación"
          className={`p-2 rounded ${getThemeClass(
            theme,
            'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-transparent',
            'bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent'
          )} w-full`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="post-content" className={`block text-sm font-medium ${getThemeClass(
          theme,
          'text-gray-600',
          'text-gray-400'
        )}`}>
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
          className={`p-2 rounded ${getThemeClass(
            theme,
            'bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-yellow-500 focus:border-transparent',
            'bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent'
          )} w-full`}
        ></textarea>
      </div>

      {/* Sección de medios actuales */}
      {editPostData.media_urls && editPostData.media_urls.length > 0 && (
        <div className="mb-4">
          <p className={`text-sm font-medium ${getThemeClass(
            theme,
            'text-gray-700',
            'text-gray-300'
          )} mb-2`}>Medios actuales:</p>
          <div className="flex flex-wrap gap-3">
            {editPostData.media_urls.map((media, index) => {
              const mediaUrl = buildMediaUrl(media.url);
              const isVideo = media.type === 'video' || (media.url && media.url.match(/\.(mp4|webm|ogg)$/i));

              return (
                <div key={index} className="relative group modal-media-item">
                  <div className={`w-24 h-24 rounded-lg overflow-hidden border ${getThemeClass(
                    theme,
                    'border-gray-300 bg-gray-100',
                    'border-gray-600 bg-gray-700'
                  )}`}>
                    {isVideo ? (
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover"
                        controls
                        onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                          const target = e.target as HTMLVideoElement;
                          target.onerror = null;
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `
                              <div class="w-full h-full flex items-center justify-center media-placeholder ${getThemeClass(
                                theme,
                                'text-gray-500',
                                'text-gray-400'
                              )} text-xs">
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
                              <div class="w-full h-full flex items-center justify-center media-placeholder ${getThemeClass(
                                theme,
                                'text-gray-500',
                                'text-gray-400'
                              )} text-xs">
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

      {/* Input para nuevos archivos */}
      <div className="space-y-2">
        <label htmlFor="new-media" className={`block text-sm font-medium ${getThemeClass(
          theme,
          'text-gray-600',
          'text-gray-400'
        )}`}>
          {editPostData.media_urls?.length > 0 ? 'Agregar más medios' : 'Agregar medios'}
        </label>
        <input
          id="new-media"
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleEditNewMediaChange}
          className={`w-full p-2 rounded ${getThemeClass(
            theme,
            'bg-white border border-gray-300 text-gray-900',
            'bg-gray-700 border border-gray-600 text-white'
          )} mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100`}
        />
        {editNewMedia.length > 0 && (
          <div className={`text-sm ${getThemeClass(
            theme,
            'text-gray-600',
            'text-gray-400'
          )} mt-2`}>
            <p className="font-medium">Nuevos archivos seleccionados:</p>
            <ul className="list-disc list-inside">
              {editNewMedia.map((file, idx) => (
                <li key={idx}>{file.name} ({Math.round(file.size / 1024)} KB)</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          className="bg-green-600 text-white font-bold py-2 px-6 rounded hover:bg-green-700 transition flex items-center justify-center min-w-32"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-15" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Actualizando...
            </>
          ) : 'Actualizar Publicación'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`bg-gray-500 text-white font-bold py-2 px-6 rounded hover:bg-gray-600 transition ${getThemeClass(
            theme,
            'hover:bg-gray-600',
            'hover:bg-gray-500'
          )}`}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default function TeacherPanel({ activeTab, setActiveTab, allowedTabs, onNotificationRead, theme = 'dark' }: TeacherPanelProps) {
  const router = useRouter();
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editAlumnoId, setEditAlumnoId] = useState<string | null>(null);
  const [editAlumnoData, setEditAlumnoData] = useState<Alumno>({
    name: '',
    last_name: '',
    birthdate: '',
    cedula: '',
    guardian_name: '',
    guardian_phone: '',
    photo_url: '',
    class_group_id: '',
    direccion: '',
  });
  const [editAlumnoPhoto, setEditAlumnoPhoto] = useState<File | null>(null);
  const [newAlumnoData, setNewAlumnoData] = useState<Alumno>({
    name: '',
    last_name: '',
    birthdate: '',
    cedula: '',
    guardian_name: '',
    guardian_phone: '',
    photo_url: '',
    class_group_id: '',
    direccion: '',
  });
  const [newAlumnoPhoto, setNewAlumnoPhoto] = useState<File | null>(null);
  const [newPostData, setNewPostData] = useState<{ title: string; content: string; }>({
    title: '',
    content: '',
  });
  const [selectedNewPostMedia, setSelectedNewPostMedia] = useState<File[]>([]);
  const [showCreatePostForm, setShowCreatePostForm] = useState<boolean>(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [editPostData, setEditPostData] = useState<{
    title: string;
    content: string;
    media_urls: MediaItem[];
  }>({
    title: '',
    content: '',
    media_urls: []
  });
  const [editNewMedia, setEditNewMedia] = useState<File[]>([]);
  const [editMediaToDelete, setEditMediaToDelete] = useState<string[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [asistenciaDate, setAsistenciaDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [asistencia, setAsistencia] = useState<{ [key: string]: { presente: boolean; justificada: boolean } }>({});
  const [profesorId, setProfesorId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [userRoleString, setUserRoleString] = useState<string | null>(null);
  const [profesorName, setProfesorName] = useState<string>('');
  const [profileName, setProfileName] = useState<string>('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>('');
  const [profileSelectedImage, setProfileSelectedImage] = useState<File | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState<boolean>(false);
  const [viewerMediaUrls, setViewerMediaUrls] = useState<MediaItem[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
  }>({
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar'
  });
  const [confirmActionCallback, setConfirmActionCallback] = useState<(() => void) | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId');
      const storedUserRole = localStorage.getItem('userRole');
      const storedUserName = localStorage.getItem('userName');
      const storedRoleNumber = localStorage.getItem('role');

      setProfesorId(storedUserId);
      setLoggedInUserId(storedUserId);
      setUserRoleString(storedUserRole);
      setProfesorName(storedUserName || '');
      setRole(storedRoleNumber || '2');

      const token = localStorage.getItem('token');
      if (!token || storedUserRole !== 'teacher') {
        router.push('/login');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!loggedInUserId) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(SOCKET_SERVER_URL, {
      withCredentials: true,
      query: { userId: loggedInUserId }
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Conectado al servidor Socket.IO:', socket.id);
      socket.emit('set-user-online', loggedInUserId);
    });

    socket.on('disconnect', () => {});

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
      toast.error('Error de conexión en tiempo real.');
    });

    socket.on('new-notification', (notification: Notification) => {
      setNotifications((prevNotifications) => [notification, ...prevNotifications]);
      
      if (!notification.read_status) {
        onNotificationRead(); 
      }

      let notificationMessage = '';
      if (notification.type === 'like') {
        notificationMessage = `${notification.actor_name} le dio "Me gusta" a tu publicación de "${notification.post_title}"`;
      } else if (notification.type === 'comment') {
        notificationMessage = `${notification.actor_name} comentó "${notification.content}" en tu publicación "${notification.post_title}"`;
      } else {
        notificationMessage = notification.content;
      }
      toast.info(`Nueva notificación: ${notificationMessage}`);
    });

    socket.on('new-post', (newPost: Post) => {
      const parsedPost: Post = {
        ...newPost,
        media_urls: Array.isArray(newPost.media_urls) ? newPost.media_urls : (typeof newPost.media_urls === 'string' && newPost.media_urls ? JSON.parse(newPost.media_urls) : []),
        likes: newPost.likes || [],
        comments: newPost.comments || []
      };
      setPosts((prevPosts: Post[]) => [parsedPost, ...prevPosts]);
    });

    socket.on('post-updated', (updatedPost: Post) => {
      const parsedUpdatedPost: Post = {
        ...updatedPost,
        media_urls: Array.isArray(updatedPost.media_urls) ? updatedPost.media_urls : (typeof updatedPost.media_urls === 'string' && updatedPost.media_urls ? JSON.parse(updatedPost.media_urls) : []),
        likes: updatedPost.likes || [],
        comments: updatedPost.comments || []
      };
      setPosts((prevPosts: Post[]) =>
        prevPosts.map((post: Post) => post.id === parsedUpdatedPost.id ? parsedUpdatedPost : post)
      );
    });

    socket.on('post-deleted', ({ postId }: { postId: string }) => {
      setPosts((prevPosts: Post[]) => prevPosts.filter((post: Post) => post.id !== postId));
    });

    socket.on('comment-added', ({ postId, comment }: { postId: string; comment: PostCardComment }) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, comments: [...post.comments, comment] }
            : post
        )
      );
    });

    socket.on('comment-updated', ({ postId, comment }: { postId: string; comment: PostCardComment }) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
              ...post,
              comments: post.comments.map((c) =>
                c.id === comment.id ? comment : c
              ),
            }
            : post
        )
      );
    });

    socket.on('comment-deleted', ({ postId, commentId }: { postId: string; commentId: string }) => {
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? { ...post, comments: post.comments.filter((c) => c.id !== commentId) }
            : post
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [loggedInUserId, onNotificationRead]);

  const openConfirmModal = (title: string, message: string, confirmAction: () => void, confirmText: string = 'Confirmar', cancelText: string = 'Cancelar') => {
    setModalContent({ title, message, confirmText, cancelText });
    setConfirmActionCallback(() => confirmAction);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setModalContent({ title: '', message: '', confirmText: 'Confirmar', cancelText: 'Cancelar' });
    setConfirmActionCallback(null);
  };

  const handleModalConfirm = () => {
    if (confirmActionCallback) confirmActionCallback();
    closeConfirmModal();
  };

  const fetchNotifications = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!loggedInUserId || !currentToken) return;

    setLoading(true);
    try {
      const res = await axios.get<Notification[]>(`${API_BASE_URL}/notifications/${loggedInUserId}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setNotifications(res.data);
      const unreadCount = res.data.filter(n => !n.read_status).length;
      setUnreadNotificationCount(unreadCount);
    } catch (e) {
      console.error('Error cargando notificaciones:', e);
      toast.error('Error cargando notificaciones');
    } finally {
      setLoading(false);
    }
  }, [loggedInUserId]);

  const markNotificationAsRead = async (notificationId: string) => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    try {
      await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read_status: true } : n));
      onNotificationRead();
      toast.success('Notificación marcada como leída');
    } catch (e) {
      console.error('Error marcando notificación como leída:', e);
    }
  };

  const markAllNotificationsAsRead = async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    try {
      await axios.put(`${API_BASE_URL}/notifications/mark-all-read/${loggedInUserId}`, {}, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read_status: true })));
      onNotificationRead();
      toast.success('Todas las notificaciones marcadas como leídas');
    } catch (e) {
      console.error('Error marcando todas las notificaciones como leídas:', e);
    }
  };

  const openMediaViewer = (mediaUrls: MediaItem[], initialIndex: number = 0) => {
    const fullMediaUrls = mediaUrls.map(media => ({
      ...media,
      url: media.url.startsWith('http') ? media.url : `${SOCKET_SERVER_URL}${media.url}`
    }));
    setViewerMediaUrls(fullMediaUrls);
    setViewerInitialIndex(initialIndex);
    setIsMediaViewerOpen(true);
  };

  const closeMediaViewer = () => {
    setIsMediaViewerOpen(false);
    setViewerMediaUrls([]);
    setViewerInitialIndex(0);
  };

  const fetchProfileData = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) return;

    setLoading(true);
    try {
      const res = await axios.get<{ name: string; photo_url: string }>(`${API_BASE_URL}/users/${profesorId}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      if (res.data) {
        setProfileName(res.data.name || '');
        const fullPhotoUrl = res.data.photo_url ?
          (res.data.photo_url.startsWith('http') ? res.data.photo_url : `${SOCKET_SERVER_URL}${res.data.photo_url}`)
          : '';
        setProfilePhotoUrl(fullPhotoUrl);
      }
    } catch (e) {
      console.error('Error cargando datos del perfil:', e);
    } finally {
      setLoading(false);
    }
  }, [profesorId]);

  const fetchClassGroups = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    try {
      const res = await axios.get<ClassGroup[]>(`${API_BASE_URL}/class-groups`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setClassGroups(res.data);
    } catch (e) {
      console.error('Error cargando grupos de clase:', e);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return;
    setLoading(true);
    try {
      const res = await axios.get<Post[]>(`${API_BASE_URL}/posts`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      const parsedPosts: Post[] = res.data.map(post => {
        let media: MediaItem[] = [];
        if (Array.isArray(post.media_urls)) {
          media = post.media_urls;
        } else if (typeof post.media_urls === 'string') {
          try {
            media = JSON.parse(String(post.media_urls).trim()) as MediaItem[];
          } catch (parseError) {
            console.error(`Error al parsear media_urls para el post ${post.id}:`, parseError);
            media = [];
          }
        }

        if (Array.isArray(media)) {
          media = media.map(m => ({
            url: m.url,
            type: m.type || (m.url && m.url.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image')
          }));
        } else {
          media = [];
        }

        return {
          ...post,
          media_urls: media
        };
      });

      setPosts(parsedPosts);
    } catch (e) {
      console.error('Error cargando posts:', e);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlumnos = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) {
      setAlumnos([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get<Alumno[]>(`${API_BASE_URL}/alumnos/profesores/${profesorId}/alumnos`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setAlumnos(res.data);
    } catch (e) {
      console.error('Error cargando alumnos:', e);
      setAlumnos([]);
    } finally {
      setLoading(false);
    }
  }, [profesorId]);

  const fetchAsistencia = useCallback(async () => {
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !asistenciaDate || !currentToken) {
      setAsistencia({});
      return;
    }
    setLoading(true);

    try {
      const res = await axios.get<any[]>(
        `${API_BASE_URL}/asistencia?profesor_id=${profesorId}&fecha=${asistenciaDate}`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      );
      const mapAsistencia: { [key: string]: { presente: boolean; justificada: boolean } } = {};
      if (Array.isArray(res.data)) {
        res.data.forEach((a) => {
          mapAsistencia[a.alumno_id] = {
            presente: a.presente,
            justificada: a.justificada || false
          };
        });
      }
      const initialAsistenciaState: { [key: string]: { presente: boolean; justificada: boolean } } = {};
      if (alumnos.length > 0) {
        alumnos.forEach(alumno => {
          initialAsistenciaState[alumno.id!] = mapAsistencia[alumno.id!] || { presente: false, justificada: false };
        });
      }
      setAsistencia(initialAsistenciaState);
    } catch (e) {
      console.error('Error cargando asistencia:', e);
      setAsistencia({});
    } finally {
      setLoading(false);
    }
  }, [profesorId, asistenciaDate, alumnos]);

  useEffect(() => {
    if (profesorId && activeTab === 'asistencia') {
      if (alumnos.length === 0) {
        fetchAlumnos().then(() => fetchAsistencia());
      } else {
        fetchAsistencia();
      }
    }
  }, [profesorId, asistenciaDate, activeTab, fetchAlumnos, fetchAsistencia]);

  const saveAsistencia = async () => {
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) {
      toast.error('ID de profesor o token no disponible para guardar asistencia');
      return;
    }
    setLoading(true);
    try {
      const attendanceRecords = alumnos.map((alumno) => ({
        alumno_id: alumno.id,
        profesor_id: Number(profesorId),
        fecha: asistenciaDate,
        presente: asistencia[alumno.id!]?.presente || false,
        justificada: asistencia[alumno.id!]?.justificada || false,
      }));

      await axios.post(`${API_BASE_URL}/asistencia`, attendanceRecords, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      toast.success('Asistencia guardada exitosamente!');
      fetchAsistencia();
    } catch (e) {
      console.error('Error guardando asistencia:', e);
      toast.error('Error guardando asistencia');
    } finally {
      setLoading(false);
    }
  };

  const toggleAsistencia = (alumnoId: string, field: 'presente' | 'justificada') => {
    setAsistencia((prev) => {
      const currentAlumnoState = prev[alumnoId] || { presente: false, justificada: false };
      let updatedState = { ...currentAlumnoState, [field]: !currentAlumnoState[field] };

      if (field === 'presente' && updatedState.presente) {
        updatedState.justificada = false;
      }
      if (field === 'justificada' && updatedState.justificada) {
        updatedState.presente = false;
      }

      return {
        ...prev,
        [alumnoId]: updatedState,
      };
    });
  };

  const handleAlumnoInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>, isEdit: boolean = false) => {
    const { name, value, type } = e.target;

    if (type === 'file') {
      const inputElement = e.target as HTMLInputElement;
      if (inputElement.files && inputElement.files[0]) {
        if (isEdit) {
          setEditAlumnoPhoto(inputElement.files[0]);
        } else {
          setNewAlumnoPhoto(inputElement.files[0]);
        }
      }
    } else {
      const val = name === 'class_group_id' ? (value === '' ? '' : Number(value)) : value;
      if (isEdit) {
        setEditAlumnoData((prev) => ({ ...prev, [name]: val }));
      } else {
        setNewAlumnoData((prev) => ({ ...prev, [name]: val }));
      }
    }
  };

  const handleCreateAlumno = async (e: FormEvent) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) {
      toast.error('ID de profesor o token no disponible para crear alumno');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', newAlumnoData.name);
      formData.append('last_name', newAlumnoData.last_name);
      formData.append('birthdate', newAlumnoData.birthdate);
      formData.append('cedula', newAlumnoData.cedula);
      formData.append('guardian_name', newAlumnoData.guardian_name);
      formData.append('guardian_phone', newAlumnoData.guardian_phone);
      formData.append('direccion', newAlumnoData.direccion);
      formData.append('class_group_id', String(newAlumnoData.class_group_id));

      if (newAlumnoPhoto) {
        formData.append('photo', newAlumnoPhoto);
      }

      await axios.post(`${API_BASE_URL}/alumnos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${currentToken}`
        }
      });
      setNewAlumnoData({
        name: '',
        last_name: '',
        birthdate: '',
        cedula: '',
        guardian_name: '',
        guardian_phone: '',
        photo_url: '',
        class_group_id: '',
        direccion: '',
      });
      setNewAlumnoPhoto(null);
      fetchAlumnos();
      toast.success('Alumno creado exitosamente!');
    } catch (e) {
      console.error('Error creando alumno:', e);
      toast.error('Error creando alumno');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlumno = useCallback((alumnoId: string) => {
    openConfirmModal(
      'Confirmar Eliminación de Alumno',
      '¿Estás seguro de que quieres eliminar este alumno? Esta acción es irreversible.',
      async () => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
          toast.error('Token no disponible para eliminar alumno');
          return;
        }
        setLoading(true);
        try {
          await axios.delete(`${API_BASE_URL}/alumnos/${alumnoId}`, {
            headers: { Authorization: `Bearer ${currentToken}` }
          });
          toast.success('Alumno eliminado exitosamente!');
          fetchAlumnos();
        } catch (e) {
          console.error('Error eliminando alumno:', e);
          toast.error('Error eliminando alumno');
        } finally {
          setLoading(false);
        }
      },
      'Eliminar',
      'Cancelar'
    );
  }, [fetchAlumnos]);

  const handleEditClick = (alumno: Alumno) => {
    setEditAlumnoId(alumno.id || null);
    setEditAlumnoData({
      name: alumno.name,
      last_name: alumno.last_name || '',
      birthdate: alumno.birthdate ? new Date(alumno.birthdate).toISOString().split('T')[0] : '',
      cedula: alumno.cedula,
      guardian_name: alumno.guardian_name,
      guardian_phone: alumno.guardian_phone,
      photo_url: alumno.photo_url ?
        (alumno.photo_url.startsWith('http') ? alumno.photo_url : `${SOCKET_SERVER_URL}${alumno.photo_url}`)
        : '',
      class_group_id: alumno.class_group_id || '',
      direccion: alumno.direccion || '',
    });
    setEditAlumnoPhoto(null);
  };

  const handleCancelEdit = () => {
    setEditAlumnoId(null);
    setEditAlumnoData({
      name: '',
      last_name: '',
      birthdate: '',
      cedula: '',
      guardian_name: '',
      guardian_phone: '',
      photo_url: '',
      class_group_id: '',
      direccion: '',
    });
    setEditAlumnoPhoto(null);
  };

  const handleUpdateAlumno = async (e: FormEvent) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      toast.error('Token no disponible para actualizar alumno');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', editAlumnoData.name);
      formData.append('last_name', editAlumnoData.last_name);
      formData.append('birthdate', editAlumnoData.birthdate);
      formData.append('cedula', editAlumnoData.cedula);
      formData.append('guardian_name', editAlumnoData.guardian_name);
      formData.append('guardian_phone', editAlumnoData.guardian_phone);
      formData.append('direccion', editAlumnoData.direccion);
      formData.append('class_group_id', String(editAlumnoData.class_group_id));

      if (editAlumnoPhoto) {
        formData.append('photo', editAlumnoPhoto);
      } else {
        const relativePhotoUrl = editAlumnoData.photo_url.replace(SOCKET_SERVER_URL, '');
        if (relativePhotoUrl) {
          formData.append('current_photo_url', relativePhotoUrl);
        } else {
          formData.append('current_photo_url', '');
        }
      }

      await axios.put(`${API_BASE_URL}/alumnos/${editAlumnoId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${currentToken}`
        }
      });
      setEditAlumnoId(null);
      fetchAlumnos();
      toast.success('Alumno actualizado exitosamente!');
    } catch (e) {
      console.error('Error actualizando alumno:', e);
      toast.error('Error actualizando alumno');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = (postToDelete: Post) => {
    openConfirmModal(
      'Confirmar Eliminación',
      `¿Estás seguro de que quieres eliminar la publicación "${postToDelete.title}"? Esta acción es irreversible.`,
      async () => {
        const currentToken = localStorage.getItem('token');
        if (!profesorId || !currentToken) {
          toast.error('ID de profesor o token no disponible para eliminar publicación');
          return;
        }
        setLoading(true);
        try {
          await axios.delete(`${API_BASE_URL}/posts/${postToDelete.id}?user_id_auth=${profesorId}`, {
            headers: { Authorization: `Bearer ${currentToken}` }
          });
          toast.success('Publicación eliminada exitosamente');
          fetchPosts();
        } catch (e) {
          console.error('Error eliminando publicación:', e);
          toast.error('Error eliminando publicación');
        } finally {
          setLoading(false);
        }
      },
      'Eliminar',
      'Cancelar'
    );
  };

  const handlePostInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editPostId) {
      setEditPostData((prev) => ({ ...prev, [name]: value }));
    } else {
      setNewPostData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleNewPostMediaChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedNewPostMedia(Array.from(e.target.files as FileList));
    } else {
      setSelectedNewPostMedia([]);
    }
  };

  const handleRemoveSelectedNewMedia = (indexToRemove: number) => {
    setSelectedNewPostMedia(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleEditNewMediaChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setEditNewMedia(prevFiles => [...prevFiles, ...Array.from(e.target.files as FileList)]);
    }
  };

  const handleRemoveExistingMedia = (urlToRemove: string) => {
    setEditMediaToDelete(prev => [...prev, urlToRemove]);
    setEditPostData(prev => ({
      ...prev,
      media_urls: prev.media_urls.filter(media => media.url !== urlToRemove)
    }));
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) {
      toast.error('ID de profesor o token no disponible para crear post');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('user_id', profesorId);
      formData.append('title', newPostData.title);
      formData.append('content', String(newPostData.content).trim());

      if (selectedNewPostMedia.length > 0) {
        for (const file of selectedNewPostMedia) {
          formData.append('new_media', file);
        }
      }

      await axios.post(`${API_BASE_URL}/posts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${currentToken}`
        },
      });
      toast.success('Publicación creada exitosamente!');
      setNewPostData({ title: '', content: '' });
      setSelectedNewPostMedia([]);
      setShowCreatePostForm(false);
      fetchPosts();
    } catch (e) {
      console.error('Error creando publicación:', e);
      toast.error('Error creando publicación');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditPost = (post: Post) => {
    setEditPostId(post.id);
    setEditPostData({
      title: post.title,
      content: post.content,
      media_urls: post.media_urls || []
    });
    setEditNewMedia([]);
    setEditMediaToDelete([]);
  };

  const handleCancelEditPost = () => {
    setEditPostId(null);
    setEditPostData({ title: '', content: '', media_urls: [] });
    setEditNewMedia([]);
    setEditMediaToDelete([]);
  };

  const handleUpdatePost = async (e: FormEvent) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('token');
    if (!editPostId || !profesorId || !currentToken) {
      toast.error('ID de publicación, profesor o token no disponible para actualizar');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', editPostData.title);
      formData.append('content', editPostData.content);
      formData.append('user_id_auth', profesorId);

      editNewMedia.forEach((file) => {
        formData.append('new_media', file);
      });

      if (editMediaToDelete.length > 0) {
        formData.append('media_to_delete', JSON.stringify(editMediaToDelete));
      }

      await axios.put(`${API_BASE_URL}/posts/${editPostId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${currentToken}`
        },
      });
      toast.success('Publicación actualizada exitosamente!');
      setEditPostId(null);
      setEditPostData({ title: '', content: '', media_urls: [] });
      setEditNewMedia([]);
      setEditMediaToDelete([]);
      fetchPosts();
    } catch (e) {
      console.error('Error actualizando publicación:', e);
      toast.error('Error actualizando publicación');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfileSelectedImage(e.target.files[0]);
    } else {
      setProfileSelectedImage(null);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    const currentToken = localStorage.getItem('token');
    if (!profesorId || !currentToken) {
      toast.error('ID de profesor o token no disponible para actualizar perfil');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', profileName);
      if (profileSelectedImage) {
        formData.append('profile_image', profileSelectedImage);
      } else {
        const relativePhotoUrl = profilePhotoUrl.replace(SOCKET_SERVER_URL, '');
        if (relativePhotoUrl) {
          formData.append('current_photo_url', relativePhotoUrl);
        } else {
          formData.append('current_photo_url', '');
        }
      }

      await axios.put(`${API_BASE_URL}/users/${profesorId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${currentToken}`
        },
      });
      toast.success('Perfil actualizado exitosamente!');
      fetchProfileData();
      setProfileSelectedImage(null);
    } catch (e) {
      console.error('Error actualizando perfil:', e);
      toast.error('Error actualizando perfil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedInUserId) {
      fetchNotifications();
    }
  }, [loggedInUserId, fetchNotifications]);

  useEffect(() => {
    if (profesorId) {
      fetchClassGroups();
      if (activeTab === 'alumnos') {
        fetchAlumnos();
        handleCancelEdit();
      } else if (activeTab === 'posts') {
        fetchPosts();
        setShowCreatePostForm(false);
        handleCancelEditPost();
      } else if (activeTab === 'profile') {
        fetchProfileData();
      } else if (activeTab === 'notifications') {
        fetchNotifications();
      }
    }
  }, [activeTab, profesorId, fetchAlumnos, fetchPosts, fetchClassGroups, fetchProfileData, fetchNotifications]);

  if (typeof window !== 'undefined' && (!localStorage.getItem('token') || localStorage.getItem('userRole') !== 'teacher')) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${getThemeClass(
        theme,
        'bg-gradient-to-br from-slate-50 to-slate-100',
        'bg-gradient-to-br from-slate-900 to-slate-800'
      )} text-white`}>
        Redirigiendo...
      </div>
    );
  }

  const sortedAlumnosForAttendance = [...alumnos].sort((a, b) => {
    const lastNameA = a.last_name || '';
    const lastNameB = b.last_name || '';
    return lastNameA.localeCompare(lastNameB);
  });

  return (
    <section className={`min-h-screen p-8 max-w-full mx-auto rounded-lg shadow-lg ${getThemeClass(
      theme,
      'bg-gradient-to-br from-slate-50 to-slate-100 text-gray-900',
      'bg-gradient-to-br from-slate-900 to-slate-800 text-white'
    )}`}>
      {/* ALUMNOS */}
      {activeTab === 'alumnos' && (
        <>
          <h2 className={`text-2xl font-bold mb-4 ${getThemeClass(
            theme,
            'text-yellow-600',
            'text-yellow-300'
          )}`}>Lista de Alumnos (Asignados)</h2>

          {/* Formulario Crear alumno */}
          <form
            onSubmit={handleCreateAlumno}
            className={`mb-6 p-6 rounded-md shadow space-y-4 max-w-2xl ${getThemeClass(
              theme,
              'bg-white border border-gray-200',
              'bg-gray-800 border border-gray-700'
            )}`}
          >
            <h3 className={`font-semibold mb-2 ${getThemeClass(
              theme,
              'text-yellow-600',
              'text-yellow-300'
            )}`}>Agregar nuevo alumno</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                name="name"
                value={newAlumnoData.name}
                onChange={handleAlumnoInputChange}
                required
                placeholder="Nombre(s)"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />
              <input
                name="last_name"
                value={newAlumnoData.last_name}
                onChange={handleAlumnoInputChange}
                required
                placeholder="Apellido(s)"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />
              <input
                type="date"
                name="birthdate"
                value={newAlumnoData.birthdate}
                onChange={handleAlumnoInputChange}
                placeholder="Fecha de nacimiento"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />

              <input
                name="cedula"
                value={newAlumnoData.cedula}
                onChange={handleAlumnoInputChange}
                placeholder="Número de cédula"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />
              <input
                name="guardian_name"
                value={newAlumnoData.guardian_name}
                onChange={handleAlumnoInputChange}
                placeholder="Nombre del representante"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />
              <input
                name="guardian_phone"
                value={newAlumnoData.guardian_phone}
                onChange={handleAlumnoInputChange}
                placeholder="Número celular"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />
              <input
                name="direccion"
                value={newAlumnoData.direccion}
                onChange={handleAlumnoInputChange}
                placeholder="Dirección del alumno"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              />

              <label htmlFor="newAlumnoPhotoUpload" className={`block text-sm font-medium cursor-pointer ${getThemeClass(
                theme,
                'text-gray-700',
                'text-gray-300'
              )}`}>
                <input
                  id="newAlumnoPhotoUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAlumnoInputChange(e, false)}
                  className="hidden"
                />
                <span className={`inline-block py-2 px-4 rounded-md cursor-pointer border ${getThemeClass(
                  theme,
                  'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300',
                  'bg-gray-700 hover:bg-gray-600 text-white border-gray-600'
                )}`}>
                  {newAlumnoPhoto ? newAlumnoPhoto.name : 'Subir Foto del Alumno (Opcional)'}
                </span>
              </label>

              <select
                name="class_group_id"
                value={newAlumnoData.class_group_id}
                onChange={handleAlumnoInputChange}
                required
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )}`}
              >
                <option value="" disabled>
                  Seleccione grupo
                </option>
                {classGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="bg-yellow-300 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-400 transition"
            >
              Agregar Alumno
            </button>
          </form>

          {/* Lista alumnos con edición */}
          {loading ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>Cargando alumnos...</p>
          ) : !profesorId ? (
            <p className="text-red-500">Error: ID de profesor no disponible. Asegúrate de iniciar sesión.</p>
          ) : alumnos.length === 0 ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>No hay alumnos asignados a este profesor.</p>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className={`w-full rounded-md overflow-hidden ${getThemeClass(
                theme,
                'bg-white',
                'bg-gray-800'
              )}`}>
                <thead className={getThemeClass(
                  theme,
                  'bg-gray-100 text-yellow-700',
                  'bg-gray-700 text-yellow-300'
                )}>
                  <tr>
                    <th className="p-3 border">N°</th>
                    <th className="p-3 border">Nombre(s)</th>
                    <th className="p-3 border">Apellido(s)</th>
                    <th className="p-3 border">Fecha Nac.</th>
                    <th className="p-3 border">Edad</th>
                    <th className="p-3 border">Cédula</th>
                    <th className="p-3 border">Representante</th>
                    <th className="p-3 border">Celular</th>
                    <th className="p-3 border">Dirección</th>
                    <th className="p-3 border">Foto</th>
                    <th className="p-3 border">Grupo</th>
                    <th className="p-3 border">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map((alumno, index) => (
                    editAlumnoId === alumno.id ? (
                      <tr key={alumno.id} className={getThemeClass(theme, 'bg-gray-50', 'bg-gray-700')}>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{index + 1}</td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="name"
                            value={editAlumnoData.name}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="last_name"
                            value={editAlumnoData.last_name}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            type="date"
                            name="birthdate"
                            value={editAlumnoData.birthdate}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {calcularEdad(editAlumnoData.birthdate)}
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="cedula"
                            value={editAlumnoData.cedula}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="guardian_name"
                            value={editAlumnoData.guardian_name}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            placeholder="Nombre del representante"
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="guardian_phone"
                            value={editAlumnoData.guardian_phone}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            placeholder="Número celular"
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <input
                            name="direccion"
                            value={editAlumnoData.direccion}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            placeholder="Dirección del alumno"
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          />
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {editAlumnoPhoto ? (
                            <img src={URL.createObjectURL(editAlumnoPhoto)} alt="Nueva foto" className="w-12 h-12 object-cover rounded" />
                          ) : editAlumnoData.photo_url ? (
                            <img src={editAlumnoData.photo_url} alt="Foto actual" className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className={`w-12 h-12 flex items-center justify-center rounded ${getThemeClass(
                              theme,
                              'bg-gray-200 text-gray-500',
                              'bg-gray-600 text-gray-400'
                            )}`}>👤</div>
                          )}
                          <label htmlFor={`editAlumnoPhotoUpload-${alumno.id}`} className={`block text-xs font-medium cursor-pointer mt-1 ${getThemeClass(
                            theme,
                            'text-gray-700',
                            'text-gray-300'
                          )}`}>
                            <input
                              id={`editAlumnoPhotoUpload-${alumno.id}`}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleAlumnoInputChange(e, true)}
                              className="hidden"
                            />
                            <span className={`inline-block py-1 px-2 rounded-md cursor-pointer text-xs ${getThemeClass(
                              theme,
                              'bg-gray-200 hover:bg-gray-300 text-gray-800',
                              'bg-gray-600 hover:bg-gray-500 text-white'
                            )}`}>
                              Cambiar Foto
                            </span>
                          </label>
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          <select
                            name="class_group_id"
                            value={editAlumnoData.class_group_id}
                            onChange={(e) => handleAlumnoInputChange(e, true)}
                            className={`w-full p-1 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border border-gray-300 text-gray-900',
                              'bg-gray-600 border border-gray-500 text-white'
                            )}`}
                          >
                            <option value="" disabled>
                              Seleccione grupo
                            </option>
                            {classGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')} flex items-center justify-center space-x-1`}>
                          <button
                            onClick={handleUpdateAlumno}
                            className="bg-green-600 hover:bg-green-700 p-1.5 rounded text-white flex items-center justify-center"
                            title="Guardar"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className={`${getThemeClass(
                              theme,
                              'bg-gray-400 hover:bg-gray-500',
                              'bg-gray-500 hover:bg-gray-600'
                            )} p-1.5 rounded text-white flex items-center justify-center`}
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={alumno.id} className={getThemeClass(
                        theme,
                        'hover:bg-gray-50 transition',
                        'hover:bg-gray-700 transition'
                      )}>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{index + 1}</td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{alumno.name}</td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{alumno.last_name || 'N/A'}</td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {alumno.birthdate ? new Date(alumno.birthdate).toISOString().split('T')[0] : 'N/A'}
                        </td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {calcularEdad(alumno.birthdate)}
                        </td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{alumno.cedula}</td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {alumno.guardian_name}
                        </td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {alumno.guardian_phone}
                        </td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{alumno.direccion}</td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {alumno.photo_url ? (
                            <img
                              src={alumno.photo_url.startsWith('http') ? alumno.photo_url : `${SOCKET_SERVER_URL}${alumno.photo_url}`}
                              alt={`${alumno.name} ${alumno.last_name}`}
                              className="w-12 h-12 object-cover rounded"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = 'https://placehold.co/30x30/4a5568/cbd5e0?text=👤';
                              }}
                            />
                          ) : (
                            <div className={`w-12 h-12 flex items-center justify-center rounded ${getThemeClass(
                              theme,
                              'bg-gray-200 text-gray-500',
                              'bg-gray-600 text-gray-400'
                            )}`}>👤</div>
                          )}
                        </td>
                        <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>
                          {classGroups.find((g) => g.id === alumno.class_group_id)?.name || 'Desconocido'}
                        </td>
                        <td className={`p-2 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')} flex items-center justify-center space-x-1`}>
                          <button
                            onClick={() => handleEditClick(alumno)}
                            className="bg-blue-600 hover:bg-blue-700 p-1.5 rounded text-white flex items-center justify-center"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAlumno(alumno.id!)}
                            className="bg-red-600 hover:bg-red-700 p-1.5 rounded text-white flex items-center justify-center"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ASISTENCIA */}
      {activeTab === 'asistencia' && (
        <>
          <h2 className={`text-2xl font-bold mb-4 ${getThemeClass(
            theme,
            'text-yellow-600',
            'text-yellow-300'
          )}`}>Asistencia</h2>
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <label className={`font-semibold ${getThemeClass(
              theme,
              'text-yellow-600',
              'text-yellow-300'
            )}`} htmlFor="fechaAsistencia">
              Fecha:
            </label>
            <input
              id="fechaAsistencia"
              type="date"
              value={asistenciaDate}
              onChange={(e) => setAsistenciaDate(e.target.value)}
              className={`rounded p-2 border ${getThemeClass(
                theme,
                'bg-white border-gray-300 text-gray-900',
                'bg-gray-700 border-gray-600 text-white'
              )} w-full sm:w-auto`}
            />
            <button
              onClick={fetchAsistencia}
              className="bg-yellow-300 text-gray-900 px-4 py-2 rounded hover:bg-yellow-400 transition w-full sm:w-auto"
            >
              Cargar Asistencia
            </button>
          </div>

          {loading ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>Cargando asistencia...</p>
          ) : !profesorId ? (
            <p className="text-red-500">
              Error: ID de profesor no disponible. Asegúrate de iniciar sesión.
            </p>
          ) : alumnos.length === 0 ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>
              No hay alumnos asignados a este profesor para tomar asistencia.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className={`w-full rounded-md overflow-hidden ${getThemeClass(
                theme,
                'bg-white',
                'bg-gray-800'
              )}`}>
                <thead className={getThemeClass(
                  theme,
                  'bg-gray-100 text-yellow-700',
                  'bg-gray-700 text-yellow-300'
                )}>
                  <tr>
                    <th className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>Alumno</th>
                    <th className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>Presente</th>
                    <th className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>Justificación</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAlumnosForAttendance.map((alumno) => (
                    <tr key={alumno.id} className={getThemeClass(
                      theme,
                      'hover:bg-gray-50 transition',
                      'hover:bg-gray-700 transition'
                    )}>
                      <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')}`}>{`${alumno.name} ${alumno.last_name || ''}`}</td>
                      <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')} text-center`}>
                        <input
                          type="checkbox"
                          checked={asistencia[alumno.id!]?.presente || false}
                          onChange={() => toggleAsistencia(alumno.id!, 'presente')}
                          className={`form-checkbox h-5 w-5 text-blue-600 rounded ${getThemeClass(
                            theme,
                            'bg-gray-100 border-gray-300',
                            'bg-gray-700 border-gray-600'
                          )}`}
                        />
                      </td>
                      <td className={`p-3 border ${getThemeClass(theme, 'border-gray-300', 'border-gray-600')} text-center`}>
                        {!asistencia[alumno.id!]?.presente && (
                          <input
                            type="checkbox"
                            checked={asistencia[alumno.id!]?.justificada || false}
                            onChange={() => toggleAsistencia(alumno.id!, 'justificada')}
                            className={`form-checkbox h-5 w-5 text-green-600 rounded ${getThemeClass(
                              theme,
                              'bg-gray-100 border-gray-300',
                              'bg-gray-700 border-gray-600'
                            )}`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={saveAsistencia}
            className="mt-6 bg-yellow-300 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-400 transition"
          >
            Guardar Asistencia
          </button>
        </>
      )}

      {/* PUBLICACIONES */}
      {activeTab === 'posts' && (
        <>
          <h2 className={`text-2xl font-bold mb-4 ${getThemeClass(
            theme,
            'text-yellow-600',
            'text-yellow-300'
          )}`}>Publicaciones</h2>

          <button
            onClick={() => {
              setShowCreatePostForm(!showCreatePostForm);
              handleCancelEditPost();
            }}
            className="bg-yellow-300 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-400 transition mb-4"
          >
            {showCreatePostForm ? 'Cancelar Creación' : 'Crear Nueva Publicación'}
          </button>

          {showCreatePostForm && (
            <form onSubmit={handleCreatePost} className={`mb-6 p-6 rounded-md shadow space-y-4 max-w-2xl ${getThemeClass(
              theme,
              'bg-white border border-gray-200',
              'bg-gray-800 border border-gray-700'
            )}`}>
              <h3 className={`font-semibold mb-2 ${getThemeClass(
                theme,
                'text-yellow-600',
                'text-yellow-300'
              )}`}>Nueva Publicación</h3>
              <input
                name="title"
                value={newPostData.title}
                onChange={handlePostInputChange}
                required
                placeholder="Título de la publicación"
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )} w-full`}
              />
              <textarea
                name="content"
                value={newPostData.content}
                onChange={handlePostInputChange}
                required
                placeholder="Contenido de la publicación"
                rows={4}
                className={`p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )} w-full`}
              ></textarea>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleNewPostMediaChange}
                className={`w-full p-2 rounded ${getThemeClass(
                  theme,
                  'bg-white border border-gray-300 text-gray-900',
                  'bg-gray-700 border border-gray-600 text-white'
                )} mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100`}
              />
              {selectedNewPostMedia.length > 0 && (
                <div className="mb-4">
                  <p className={`text-sm font-medium ${getThemeClass(
                    theme,
                    'text-gray-700',
                    'text-gray-300'
                  )} mb-2`}>Archivos a subir:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedNewPostMedia.map((file, index) => (
                      <div key={index} className={`relative w-24 h-24 rounded-lg overflow-hidden border ${getThemeClass(
                        theme,
                        'border-gray-300',
                        'border-gray-600'
                      )}`}>
                        {file.type.startsWith('video/') ? (
                          <video src={URL.createObjectURL(file)} className="w-full h-full object-cover" controls />
                        ) : (
                          <img src={URL.createObjectURL(file)} alt={`Media ${index}`} className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSelectedNewMedia(index)}
                          className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-700"
                          title="Quitar este archivo"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="submit"
                className="bg-yellow-300 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-400 transition"
              >
                Publicar
              </button>
            </form>
          )}

          {loading ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>Cargando publicaciones...</p>
          ) : posts.length === 0 ? (
            <p className={getThemeClass(theme, 'text-gray-700', 'text-gray-300')}>No hay publicaciones disponibles.</p>
          ) : (
            <div className="flex justify-center">
              <div className="w-full sm:max-w-md md:max-w-xl lg:max-w-[300px] xl:max-w-[600px] 2xl:max-w-[900px]">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={profesorId}
                    onDeletePost={handleDeletePost}
                    onStartEditPost={handleStartEditPost}
                    onOpenMediaViewer={openMediaViewer}
                    socket={socketRef.current}
                    onLikeToggle={async () => { }}
                    onAddComment={async () => { }}
                    onDeleteComment={async () => { }}
                    onUpdateComment={async () => { }}
                    theme={theme} // Pasar el tema al PostCard
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* PERFIL */}
      {activeTab === 'profile' && (
        <>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClass(
            theme,
            'text-yellow-600',
            'text-yellow-300'
          )} text-center`}>Mi Perfil Personal</h2>
          {loading ? (
            <p className={`text-center text-lg ${getThemeClass(
              theme,
              'text-gray-700',
              'text-gray-300'
            )}`}>Cargando datos del perfil...</p>
          ) : !profesorId ? (
            <p className="text-red-500 text-center text-lg">Error: ID de profesor no disponible. Asegúrate de iniciar sesión.</p>
          ) : (
            <form onSubmit={handleUpdateProfile} className={`max-w-3xl mx-auto p-8 rounded-xl shadow-2xl space-y-6 border ${getThemeClass(
              theme,
              'bg-white border-gray-200',
              'bg-gray-800 border-gray-700'
            )}`}>
              <h3 className={`text-2xl font-semibold mb-6 ${getThemeClass(
                theme,
                'text-yellow-600',
                'text-yellow-300'
              )} text-center`}>Actualizar Información</h3>

              <div className="flex flex-col items-center mb-6">
                <label htmlFor="profilePhoto" className={`block text-xl font-medium mb-3 ${getThemeClass(
                  theme,
                  'text-gray-800',
                  'text-gray-200'
                )}`}>
                  Foto de Perfil 📸
                </label>
                <div className={`relative w-32 h-32 mb-4 rounded-full border-4 ${getThemeClass(
                  theme,
                  'border-yellow-500',
                  'border-yellow-400'
                )} overflow-hidden shadow-md`}>
                  {profileSelectedImage ? (
                    <img
                      src={URL.createObjectURL(profileSelectedImage)}
                      alt="Nueva foto de perfil"
                      className="w-full h-full object-cover"
                    />
                  ) : profilePhotoUrl ? (
                    <img
                      src={profilePhotoUrl}
                      alt="Foto de perfil actual"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://placehold.co/150x150/555/FFF?text=No+Foto';
                      }}
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${getThemeClass(
                      theme,
                      'bg-gray-200 text-gray-500',
                      'bg-gray-700 text-gray-400'
                    )} text-6xl`}>
                      👤
                    </div>
                  )}
                </div>
                <input
                  id="profilePhoto"
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className={`block w-full text-sm
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-yellow-500 file:text-gray-900
                          hover:file:bg-yellow-600 cursor-pointer
                          focus:outline-none focus:ring-1 focus:ring-yellow-400 ${getThemeClass(
                            theme,
                            'text-gray-600',
                            'text-gray-400'
                          )}`}
                />
                <p className={`text-sm mt-2 text-center ${getThemeClass(
                  theme,
                  'text-gray-600',
                  'text-gray-400'
                )}`}>
                  Selecciona una nueva imagen o déjalo vacío para mantener la actual.
                </p>
              </div>

              <div>
                <label htmlFor="profileName" className={`block text-lg font-medium mb-2 ${getThemeClass(
                  theme,
                  'text-gray-700',
                  'text-gray-300'
                )}`}>
                  Nombre Completo:
                </label>
                <input
                  id="profileName"
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  placeholder="Tu nombre"
                  className={`p-3 rounded-lg border w-full
                          focus:outline-none focus:ring-1 focus:ring-yellow-400
                          transition-all duration-200 shadow-sm ${getThemeClass(
                            theme,
                            'bg-white border-gray-300 text-gray-900 focus:border-yellow-500',
                            'bg-gray-700 border-gray-600 text-white focus:border-yellow-400'
                          )}`}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className={`w-full font-bold py-3 px-8 rounded-lg
                          transition duration-300 ease-in-out transform hover:scale-105
                          shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75 ${getThemeClass(
                            theme,
                            'bg-yellow-500 text-gray-900 hover:bg-yellow-600',
                            'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                          )}`}
                >
                  Guardar Cambios del Perfil
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* NOTIFICACIONES */}
      {activeTab === 'notifications' && (
        <>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClass(
            theme,
            'text-yellow-600',
            'text-yellow-300'
          )} text-center`}>Mis Notificaciones</h2>
          <div className={`p-6 rounded-xl shadow-lg border ${getThemeClass(
            theme,
            'bg-white border-gray-200',
            'bg-gray-800 border-gray-700'
          )}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xl font-semibold ${getThemeClass(
                theme,
                'text-yellow-600',
                'text-yellow-300'
              )}`}>Todas las Notificaciones</h3>
              {notifications.length > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className={`${getThemeClass(
                    theme,
                    'bg-yellow-500 hover:bg-yellow-600 text-gray-900',
                    'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                  )} px-4 py-2 rounded-md font-semibold transition`}
                >
                  Marcar Todas como Leídas
                </button>
              )}
            </div>
            {loading ? (
              <p className={getThemeClass(theme, 'text-gray-600', 'text-gray-400')}>Cargando notificaciones...</p>
            ) : notifications.length === 0 ? (
              <p className={getThemeClass(theme, 'text-gray-600', 'text-gray-400')}>No tienes notificaciones.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`p-4 rounded-lg shadow-md flex items-center justify-between transition duration-200
                        ${notification.read_status
                        ? getThemeClass(theme, 'bg-gray-100 text-gray-600', 'bg-gray-700 text-gray-400')
                        : getThemeClass(theme, 'bg-yellow-50 text-gray-800 border-l-4 border-yellow-500', 'bg-gray-600 text-white border-l-4 border-yellow-400')
                      }
                    `}
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        {notification.type === 'like' && (
                          <>👍 <span className={getThemeClass(theme, 'text-yellow-600', 'text-yellow-300')}>{notification.actor_name}</span> le dio "Me gusta" a tu publicación "{notification.post_title}".</>
                        )}
                        {notification.type === 'comment' && (
                          <>💬 <span className={getThemeClass(theme, 'text-yellow-600', 'text-yellow-300')}>{notification.actor_name}</span> comentó en tu publicación "{notification.post_title}": "{notification.content}"</>
                        )}
                      </p>
                      <span className={`text-sm block mt-1 ${getThemeClass(
                        theme,
                        'text-gray-500',
                        'text-gray-400'
                      )}`}>
                        {new Date(notification.created_at).toLocaleString('es-ES', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {!notification.read_status && (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className={`ml-4 px-3 py-1 rounded-md text-sm font-semibold ${getThemeClass(
                          theme,
                          'bg-yellow-500 hover:bg-yellow-600 text-gray-900',
                          'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                        )}`}
                      >
                        Marcar como Leída
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Modal para Editar Publicación */}
      <Modal isOpen={!!editPostId} onClose={handleCancelEditPost} theme={theme}>
        <PostEditForm
          editPostData={editPostData}
          onInputChange={handlePostInputChange}
          onUpdatePost={handleUpdatePost}
          onCancel={handleCancelEditPost}
          SOCKET_SERVER_URL={SOCKET_SERVER_URL}
          handleRemoveExistingMedia={handleRemoveExistingMedia}
          editNewMedia={editNewMedia}
          handleEditNewMediaChange={handleEditNewMediaChange}
          loading={loading}
          theme={theme}
        />
      </Modal>

      {/* Modal de Confirmación */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={closeConfirmModal}
        onConfirm={handleModalConfirm}
        title={modalContent.title}
        message={modalContent.message}
        confirmText={modalContent.confirmText}
        cancelText={modalContent.cancelText}
        theme={theme}
      />

      {/* Media Viewer */}
      {isMediaViewerOpen && (
        <MediaViewer
          mediaUrls={viewerMediaUrls}
          currentIndex={viewerInitialIndex}
          onClose={closeMediaViewer}
        />
      )}

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </section>
  );
}