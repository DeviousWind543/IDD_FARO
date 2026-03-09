'use client'
import React, { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react'
import axios from 'axios'
// Importar las interfaces directamente desde PostCard.tsx para consistencia
import PostCard, { Post, MediaItem, Comment } from './PostCard'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  PlusSquare,
  User,
  ClipboardList,
  Gift,
  Smartphone,
  X,
  ChevronLeft,
  ChevronRight,
  Menu // Asegúrate de que Menu esté importado
} from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '')

// --- Definiciones de Tipos ---
// Las interfaces Post, MediaItem, Comment ahora se importan de PostCard.tsx

interface UserProfile {
  name: string;
  email: string;
  photo_url: string | null; // Aquí sí puede ser null para el perfil del usuario
  role_id?: number;
}

// RawPost para el manejo de datos crudos del backend antes de la transformación
interface RawPost {
  id: string;
  title: string;
  content: string;
  user_id: string;
  user_name: string;
  user_photo_url?: string | null;
  media_urls?: string | MediaItem[]; // Puede venir como string JSON o array
  likes?: any[];
  comments?: any[];
  created_at: string;
}

interface StudentAttendanceData {
  id: string;
  name: string;
  last_name: string;
  cedula: string;
  class_group_name?: string;
  total_class_days: number;
  present_days: number;
  justified_days: number;
  absent_days: number;
}

interface ConfirmationModalProps {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface MediaViewerModalProps {
  postMediaArray: MediaItem[]; // Debe ser MediaItem[] con url: string
  initialMediaIndex: number;
  onClose: () => void;
}

interface MobileNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface UserPanelProps {
  currentUserId: string | number | null;
  currentUserName: string;
  setUserName: (name: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// --- Componentes Modales y Barra de Navegación Móvil ---

function ConfirmationModal({ show, message, onConfirm, onCancel }: ConfirmationModalProps) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 max-w-sm w-full mx-auto">
        <p className="text-white text-lg mb-6 text-center">{message}</p>
        <div className="flex flex-col sm:flex-row justify-center space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded transition w-full sm:w-auto"
          >
            Confirmar
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded transition w-full sm:w-auto"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaViewerModal({ postMediaArray, initialMediaIndex, onClose }: MediaViewerModalProps) {
  // Aseguramos que postMediaArray y sus elementos sean válidos
  const validPostMediaArray = postMediaArray.filter(media => media && typeof media.url === 'string' && media.url.trim() !== '');

  if (!validPostMediaArray || validPostMediaArray.length === 0 || initialMediaIndex === undefined || initialMediaIndex < 0 || initialMediaIndex >= validPostMediaArray.length) {
    return null;
  }
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState<number>(initialMediaIndex);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    setCurrentDisplayIndex(initialMediaIndex);
  }, [initialMediaIndex]);

  const currentMedia = validPostMediaArray[currentDisplayIndex];
  // La URL ya es string gracias al filtro y la interfaz MediaItem
  const mediaUrl = `${API_BASE_URL.replace('/api', '')}${currentMedia.url.startsWith('/') ? currentMedia.url : '/' + currentMedia.url}`;

  const handleNext = useCallback(() => {
    setCurrentDisplayIndex(prevIndex => Math.min(prevIndex + 1, validPostMediaArray.length - 1));
  }, [validPostMediaArray.length]);

  const handlePrev = useCallback(() => {
    setCurrentDisplayIndex(prevIndex => Math.max(prevIndex - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        handleNext();
      } else if (event.key === 'ArrowLeft') {
        handlePrev();
      } else if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrev, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    const swipeThreshold = 50;
    if (deltaX > swipeThreshold) {
      handlePrev();
    } else if (deltaX < -swipeThreshold) {
      handleNext();
    }
    // Reset touch coordinates
    touchStartX.current = 0;
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 p-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative max-w-4xl max-h-full bg-gray-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white text-3xl font-bold bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-600 z-10"
          aria-label="Cerrar"
        >
          &times;
        </button>
        <div className="p-4 flex-grow flex items-center justify-center">
          {currentMedia?.type?.startsWith('image') && mediaUrl ? (
            <img src={mediaUrl} alt="Vista previa de imagen" className="max-w-full max-h-[80vh] object-contain mx-auto" />
          ) : currentMedia?.type?.startsWith('video') && mediaUrl ? (
            <video controls src={mediaUrl} className="max-w-full max-h-[80vh] object-contain mx-auto">
              Tu navegador no soporta el video.
            </video>
          ) : (
            <p className="text-white">Tipo de medio no soportado o URL de medio no válida.</p>
          )}
        </div>
        <div className="absolute inset-y-0 left-0 flex items-center">
          <button
            onClick={handlePrev}
            disabled={currentDisplayIndex === 0}
            className="bg-gray-700 bg-opacity-75 text-white p-3 rounded-r-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Anterior"
          >
            &#10094;
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={handleNext}
            disabled={currentDisplayIndex === validPostMediaArray.length - 1}
            className="bg-gray-700 bg-opacity-75 text-white p-3 rounded-l-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Siguiente"
          >
            &#10095;
          </button>
        </div>
      </div>
    </div>
  );
}

// MobileNavBar ahora solo contiene los botones de navegación fijos
function MobileNavBar({ activeTab, setActiveTab }: MobileNavBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around items-center py-2 z-20 h-16">
      <button
        onClick={() => setActiveTab('feed')}
        className={`flex flex-col items-center p-2 transition-all ${activeTab === 'feed' ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}
      >
        <Home size={20} />
        <span className="text-xs mt-1">Inicio</span>
      </button>

      <button
        onClick={() => setActiveTab('createPost')}
        className={`flex flex-col items-center p-2 transition-all ${activeTab === 'createPost' ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}
      >
        <PlusSquare size={20} />
        <span className="text-xs mt-1">Publicar</span>
      </button>

      <button
        onClick={() => setActiveTab('profile')}
        className={`flex flex-col items-center p-2 transition-all ${activeTab === 'profile' ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}
      >
        <User size={20} />
        <span className="text-xs mt-1">Perfil</span>
      </button>

      <button
        onClick={() => setActiveTab('asistencias')}
        className={`flex flex-col items-center p-2 transition-all ${activeTab === 'asistencias' ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}
      >
        <ClipboardList size={20} />
        <span className="text-xs mt-1">Asistencia</span>
      </button>

      <button
        onClick={() => setActiveTab('donations')}
        className={`flex flex-col items-center p-2 transition-all ${activeTab === 'donations' ? 'text-yellow-300' : 'text-gray-400 hover:text-white'}`}
      >
        <Gift size={20} />
        <span className="text-xs mt-1">Donaciones</span>
      </button>
    </div>
  )
}


// --- Componente UserPanel ---

export default function UserPanel({ currentUserId, currentUserName, setUserName, activeTab, setActiveTab }: UserPanelProps) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [newPostData, setNewPostData] = useState<{ title: string; content: string; }>({
    title: '',
    content: '',
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [canUserCreatePosts, setCanUserCreatePosts] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<number | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: currentUserName,
    email: '',
    photo_url: null,
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [cedulaInput, setCedulaInput] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<StudentAttendanceData | null>(null);
  const [attendanceMessage, setAttendanceMessage] = useState<string>('');
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<StudentAttendanceData[]>([]);
  const [searchError, setSearchError] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [viewerMediaInfo, setViewerMediaInfo] = useState<{ mediaArray: MediaItem[]; initialIndex: number; } | null>(null);


  // Parsea las URLs de medios que pueden venir como string JSON
  const parseMediaUrls = useCallback((mediaUrls: unknown): MediaItem[] => {
    if (typeof mediaUrls === 'string' && mediaUrls) {
      try {
        // Asegúrate de que cada item tenga una URL válida (string)
        const parsed: any[] = JSON.parse(mediaUrls);
        return parsed.map(item => ({
          url: typeof item.url === 'string' ? item.url : '', // Asegura que url sea string
          type: typeof item.type === 'string' ? item.type : 'image' // Default a 'image' si no está definido
        })).filter(item => item.url !== ''); // Filtra elementos con URL vacía
      } catch (e) {
        console.error("Error parsing media_urls string:", e);
        return [];
      }
    }
    // Si ya es un array de MediaItem, asegúrate de que las URLs sean string
    if (Array.isArray(mediaUrls)) {
      return mediaUrls.map(item => ({
        url: typeof item.url === 'string' ? item.url : '',
        type: typeof item.type === 'string' ? item.type : 'image'
      })).filter(item => item.url !== '');
    }
    return [];
  }, []);

  // Efecto para obtener el ID y rol del usuario logueado de localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId');
      const storedUserRole = localStorage.getItem('userRole');
      const storedRoleNumber = localStorage.getItem('role');

      setLoggedInUserId(storedUserId);
      setUserRole(storedRoleNumber ? Number(storedRoleNumber) : null);
      setCanUserCreatePosts(storedUserRole === 'admin' || storedUserRole === 'teacher');

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
      }
    }
  }, [router]);

  // Fetch de publicaciones
  const fetchPosts = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get<RawPost[]>(`${API_BASE_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const formattedPosts: Post[] = res.data.map(rawPost => ({
        id: rawPost.id,
        title: rawPost.title,
        content: rawPost.content,
        user_id: rawPost.user_id,
        user_name: rawPost.user_name,
        user_photo_url: rawPost.user_photo_url || null,
        media_urls: parseMediaUrls(rawPost.media_urls), // Usar la función parseMediaUrls
        likes: rawPost.likes || [],
        comments: rawPost.comments || [],
        created_at: rawPost.created_at,
      }));
      setPosts(formattedPosts);
    } catch (e: any) {
      console.error('Error cargando posts:', e.response ? e.response.data : e.message);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [parseMediaUrls]);

  const handlePostInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewPostData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    } else {
      setSelectedImage(null);
    }
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!loggedInUserId || !token) {
      console.error('Debes iniciar sesión para crear publicaciones.');
      toast.error('Debes iniciar sesión para crear publicaciones.');
      return;
    }
    if (userRole !== 1 && userRole !== 2) {
      console.error('Solo los administradores y profesores pueden crear publicaciones.');
      toast.error('Solo los administradores y profesores pueden crear publicaciones.');
      return;
    }
    if (!newPostData.title.trim() || !newPostData.content.trim()) {
      console.error('El título y el contenido de la publicación no pueden estar vacíos.');
      toast.error('El título y el contenido de la publicación no pueden estar vacíos.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', newPostData.title);
      formData.append('content', newPostData.content);
      formData.append('user_id', String(loggedInUserId));
      if (selectedImage) {
        formData.append('image', selectedImage);
      }
      await axios.post(`${API_BASE_URL}/posts`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
      });
      toast.success('Publicación creada exitosamente!');
      setNewPostData({ title: '', content: '' });
      setSelectedImage(null);
      setActiveTab('feed');
      fetchPosts();
    } catch (e: any) {
      console.error('Error creando publicación:', e.response ? e.response.data : e.message);
      toast.error(`Error creando publicación: ${e.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDeletePost = useCallback((post: Post) => {
    setPostToDelete(post);
    setShowDeleteModal(true);
  }, []);

  const handleDeletePost = useCallback(async () => {
    if (!postToDelete) return;
    const postId = postToDelete.id;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!loggedInUserId || !token) {
      console.error('Error: No se encontró el ID de usuario autenticado o token para eliminar la publicación.');
      toast.error('Error de autenticación para eliminar la publicación.');
      setShowDeleteModal(false);
      return;
    }
    setLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      toast.success('Publicación eliminada exitosamente.');
      fetchPosts();
    } catch (e: any) {
      console.error('Error eliminando publicación:', e.response ? e.response.data : e.message);
      toast.error(`Error eliminando publicación: ${e.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
      setPostToDelete(null);
    }
  }, [postToDelete, loggedInUserId, fetchPosts]);

  const handleStartEditPost = useCallback((post: Post) => {
    toast.info('La edición de publicaciones no está implementada en este panel.');
  }, []);

  const handleLikeToggle = useCallback(async (postId: string) => {
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token) {
      toast.error('Debes iniciar sesión para dar "me gusta".');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/posts/${postId}/toggle-like`, { user_id: loggedInUserId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      console.error('Error al alternar like:', error.response?.data || error.message);
      toast.error('Error al dar/quitar "me gusta".');
    }
  }, [loggedInUserId]);

  const handleAddComment = useCallback(async (postId: string, content: string) => {
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token || !content.trim()) {
      toast.error('Debes iniciar sesión y escribir un comentario.');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/comments`, { post_id: postId, content, user_id: loggedInUserId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      console.error('Error al agregar comentario:', error.response?.data || error.message);
      toast.error('Error al agregar comentario.');
    }
  }, [loggedInUserId]);

  const handleDeleteComment = useCallback(async (postId: string, commentId: string) => {
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token) {
      toast.error('Debes iniciar sesión para eliminar comentarios.');
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Comentario eliminado exitosamente.');
    } catch (error: any) {
      console.error('Error al eliminar comentario:', error.response ? error.response.data : error.message);
      toast.error('Error al eliminar comentario.');
    }
  }, [loggedInUserId]);

  const handleUpdateComment = useCallback(async (postId: string, commentId: string, content: string) => {
    const token = localStorage.getItem('token');
    if (!loggedInUserId || !token || !content.trim()) {
      toast.error('Debes iniciar sesión y escribir un comentario para actualizar.');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/comments/${commentId}`, { content }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Comentario actualizado exitosamente.');
    } catch (error: any) {
      console.error('Error al actualizar comentario:', error.response ? error.response.data : error.message);
      toast.error('Error al actualizar comentario.');
    }
  }, [loggedInUserId]);

  const fetchUserProfile = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!loggedInUserId || !token) {
      return;
    }
    try {
      setLoading(true);
      const res = await axios.get<UserProfile>(`${API_BASE_URL}/users/${loggedInUserId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Asegurarse de que photo_url sea string o null
      setUserProfile({
        name: res.data.name,
        email: res.data.email,
        photo_url: res.data.photo_url ? `${API_BASE_URL.replace('/api', '')}${res.data.photo_url}` : null,
        role_id: res.data.role_id,
      });
      setUserRole(res.data.role_id || null);
      setCanUserCreatePosts(res.data.role_id === 1 || res.data.role_id === 2);
      setUserName(res.data.name);
    } catch (error: any) {
      console.error('Error fetching user profile:', error.response ? error.response.data : error.message);
      toast.error('Error al cargar el perfil del usuario.');
    } finally {
      setLoading(false);
    }
  }, [loggedInUserId, setUserName]);

  const handleProfileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfileImageFile(e.target.files[0]);
    } else {
      setProfileImageFile(null);
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!loggedInUserId || !token) {
      console.error('ID de usuario o token no disponible para actualizar perfil.');
      toast.error('Error de autenticación para actualizar perfil.');
      return;
    }
    if (!userProfile.name.trim()) {
      console.error('El nombre no puede estar vacío.');
      toast.error('El nombre no puede estar vacío.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', userProfile.name);
      if (profileImageFile) {
        formData.append('profile_image', profileImageFile);
      } else if (userProfile.photo_url === null) {
        formData.append('clear_image', 'true');
      }
      const res = await axios.put<UserProfile>(`${API_BASE_URL}/users/${loggedInUserId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
      });
      toast.success('Perfil actualizado exitosamente!');
      setEditingProfile(false);
      // Asegurarse de que photo_url sea string o null
      setUserProfile(prev => ({ ...prev, photo_url: res.data.photo_url ? `${API_BASE_URL.replace('/api', '')}${res.data.photo_url}` : null }));
      setProfileImageFile(null);
      fetchUserProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error.response ? error.response.data : error.message);
      toast.error(`Error actualizando perfil: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAttendanceLookup = useCallback(async () => {
    if (!cedulaInput.trim()) {
      setAttendanceMessage('Por favor ingrese la cédula o nombres y apellidos del estudiante.');
      setAttendanceData(null);
      return;
    }
    setAttendanceLoading(true);
    setAttendanceMessage('');
    setAttendanceData(null);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setAttendanceMessage('Error de autenticación. Por favor, inicie sesión.');
      setAttendanceLoading(false);
      return;
    }
    try {
      const res = await axios.get<{ student: StudentAttendanceData }>(`${API_BASE_URL}/asistencia/lookup?query=${encodeURIComponent(cedulaInput)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.student) {
        const student = res.data.student;
        const total = Number(student.total_class_days) || 0;
        const present = Number(student.present_days) || 0;
        const justified = Number(student.justified_days) || 0;

        setAttendanceData({
          ...student,
          total_class_days: total,
          present_days: present,
          justified_days: justified,
          absent_days: Math.max(0, total - present - justified)
        });
        setAttendanceMessage(`Asistencias para ${student.name} ${student.last_name || ''}.`);
      } else {
        setAttendanceMessage('No se encontraron asistencias para el estudiante con la información proporcionada.');
        setAttendanceData(null);
      }
    } catch (error: any) {
      console.error('Error al consultar asistencia:', error.response ? error.response.data : error.message);
      setAttendanceMessage(error.response?.data?.error || 'Error al consultar asistencia.');
      setAttendanceData(null);
    } finally {
      setAttendanceLoading(false);
    }
  }, [cedulaInput]);

  const handleStudentSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError('Por favor ingrese un término de búsqueda');
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    setSearchError('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setSearchError('Error de autenticación');
      setSearchLoading(false);
      return;
    }
    try {
      const res = await axios.get<StudentAttendanceData[]>(`${API_BASE_URL}/asistencia/student-search?query=${encodeURIComponent(searchQuery)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const formattedResults: StudentAttendanceData[] = res.data.map(student => {
        const total = Number(student.total_class_days) || 0;
        const present = Number(student.present_days) || 0;
        const justified = Number(student.justified_days) || 0;
        const absent = total - present - justified;
        return {
          ...student,
          total_class_days: total,
          present_days: present,
          justified_days: justified,
          absent_days: Math.max(0, absent)
        };
      });
      setSearchResults(formattedResults);
      if (formattedResults.length === 0) {
        setSearchError('No se encontraron estudiantes con ese criterio de búsqueda');
      }
    } catch (error: any) {
      console.error('Error buscando estudiantes:', error.response ? error.response.data : error.message);
      setSearchError(error.response?.data?.error || 'Error al buscar estudiantes');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const handleMediaClick = useCallback((mediaArray: MediaItem[], initialIndex: number) => {
    setViewerMediaInfo({ mediaArray, initialIndex });
  }, []);

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
      socket.emit('set-user-online', loggedInUserId);
    });

    socket.on('disconnect', () => {});

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message);
      toast.error('Error de conexión en tiempo real.');
    });

    socket.on('new-post', (rawNewPost: RawPost) => {
      toast.success(`Nueva publicación: ${rawNewPost.title}`, { autoClose: 3000 });
      const parsedPost: Post = {
        id: rawNewPost.id,
        title: rawNewPost.title,
        content: rawNewPost.content,
        user_id: rawNewPost.user_id,
        user_name: rawNewPost.user_name,
        user_photo_url: rawNewPost.user_photo_url || null,
        media_urls: parseMediaUrls(rawNewPost.media_urls), // Usar la función parseMediaUrls
        likes: rawNewPost.likes || [],
        comments: rawNewPost.comments || [],
        created_at: rawNewPost.created_at,
      };
      setPosts(prevPosts => [parsedPost, ...prevPosts]);
    });

    socket.on('post-updated', (rawUpdatedPost: RawPost) => {
      toast.info(`Publicación actualizada: ${rawUpdatedPost.title}`, { autoClose: 2000 });
      const parsedUpdatedPost: Post = {
        id: rawUpdatedPost.id,
        title: rawUpdatedPost.title,
        content: rawUpdatedPost.content,
        user_id: rawUpdatedPost.user_id,
        user_name: rawUpdatedPost.user_name,
        user_photo_url: rawUpdatedPost.user_photo_url || null,
        media_urls: parseMediaUrls(rawUpdatedPost.media_urls), // Usar la función parseMediaUrls
        likes: rawUpdatedPost.likes || [],
        comments: rawUpdatedPost.comments || [],
        created_at: rawUpdatedPost.created_at,
      };
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === parsedUpdatedPost.id
            ? parsedUpdatedPost
            : post
        )
      );
    });

    socket.on('post-deleted', ({ postId }: { postId: string }) => {
      toast.warn(`Publicación eliminada.`, { autoClose: 2000 });
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
    });

    socket.on('postLiked', ({ postId, userId }: { postId: string; userId: string }) => {
      toast.success(`¡Nuevo like en un post!`, { autoClose: 1500 });
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId && !post.likes.some(like => like.user_id === userId)
            ? { ...post, likes: [...post.likes, { user_id: userId, post_id: postId }] }
            : post
        )
      );
    });

    socket.on('postUnliked', ({ postId, userId }: { postId: string; userId: string }) => {
      toast.info(`Un like ha sido removido.`, { autoClose: 1500 });
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, likes: post.likes.filter(like => like.user_id !== userId) }
            : post
        )
      );
    });

    socket.on('new-comment', (newComment: Comment) => {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === newComment.post_id
            ? { ...post, comments: [...post.comments, newComment] }
            : post
        )
      );
    });

    socket.on('comment-updated', (updatedComment: Comment) => {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === updatedComment.post_id
            ? {
              ...post, comments: post.comments.map(c =>
                c.id === updatedComment.id ? updatedComment : c
              )
            }
            : post
        )
      );
    });

    socket.on('comment-deleted', ({ commentId, postId }: { commentId: string; postId: string }) => {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? { ...post, comments: post.comments.filter(c => c.id !== commentId) }
            : post
        )
      );
    });

    socket.on('new-notification', (notification: { message: string }) => {
      toast.info(`Nueva notificación: ${notification.message}`);
    });

    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('online-users-updated');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('new-post');
        socket.off('post-updated');
        socket.off('post-deleted');
        socket.off('postLiked');
        socket.off('postUnliked');
        socket.off('new-comment');
        socket.off('comment-updated');
        socket.off('comment-deleted');
        socket.off('new-notification');
      }
    };
  }, [loggedInUserId, parseMediaUrls]);

  useEffect(() => {
    if (loggedInUserId) {
      fetchPosts();
      fetchUserProfile();
    }
  }, [loggedInUserId, fetchPosts, fetchUserProfile]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-yellow-300">
        <p className="text-xl font-semibold animate-pulse">Cargando...</p>
      </div>
    );
  }
  if (!loggedInUserId) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-900 text-red-400">
        <p className="text-xl font-semibold mb-4">No estás autenticado.</p>
        <p>Por favor, inicia sesión para acceder al panel de usuario.</p>
      </div>
    );
  }
  return (
    <section className="min-h-screen bg-gray-900 text-white p-0 md:p-8 max-w-full mx-auto pb-16 md:pb-8">
      {/* Tabs - Solo visible en desktop */}
      <div className="hidden md:flex flex-wrap justify-center md:justify-start gap-2 md:gap-4 mb-8 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base whitespace-nowrap ${
            activeTab === 'feed' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          📰 Feed de Publicaciones
        </button>
        {canUserCreatePosts && (
          <button
            onClick={() => setActiveTab('createPost')}
            className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base whitespace-nowrap ${
              activeTab === 'createPost' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            ➕ Crear Publicación
          </button>
        )}
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base whitespace-nowrap ${
            activeTab === 'profile' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          👤 Mi Perfil
        </button>
        <button
          onClick={() => setActiveTab('asistencias')}
          className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base whitespace-nowrap ${
            activeTab === 'asistencias' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          📋 Asistencias
        </button>
        <button
          onClick={() => setActiveTab('donations')}
          className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base whitespace-nowrap ${
            activeTab === 'donations' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <Gift size={18} className="inline-block mr-2" /> Donaciones y Patrocinadores
        </button>
      </div>

      {/* Contenido principal - Ajustado para móvil */}
      <div className="w-full px-0 md:px-4">
        {/* --- Contenido del Feed --- */}
        {activeTab === 'feed' && (
          <>
            <h3 className="text-2xl font-bold mb-4 text-yellow-300 text-center md:text-left px-4">Últimas Publicaciones</h3>
            {posts.length === 0 ? (
              <p className="text-gray-400 text-center px-4">No hay publicaciones para mostrar. ¡Sé el primero en publicar algo!</p>
            ) : (
              <div className="flex flex-col items-center w-full">
                <div className="w-full max-w-screen-sm px-2 space-y-6">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUserId={loggedInUserId}
                      onDeletePost={handleStartDeletePost}
                      onStartEditPost={handleStartEditPost}
                      onLikeToggle={handleLikeToggle}
                      onAddComment={handleAddComment}
                      onDeleteComment={handleDeleteComment}
                      onUpdateComment={handleUpdateComment}
                      onOpenMediaViewer={handleMediaClick}
                      socket={socketRef.current}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* --- Contenido de Crear Publicación --- */}
        {activeTab === 'createPost' && canUserCreatePosts && (
          <form
            onSubmit={handleCreatePost}
            className="mb-6 bg-gray-800 p-6 rounded-md shadow space-y-4 w-full border border-gray-700 mx-auto max-w-lg"
          >
            <h3 className="font-semibold mb-2 text-yellow-300 text-xl text-center">Crear Nueva Publicación</h3>
            <div>
              <label htmlFor="postTitle" className="block text-sm font-medium text-gray-300 mb-1">
                Título
              </label>
              <input
                id="postTitle"
                name="title"
                value={newPostData.title}
                onChange={handlePostInputChange}
                required
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white mt-1 focus:ring-yellow-500 focus:border-yellow-500"
              />
            </div>
            <div>
              <label htmlFor="postContent" className="block text-sm font-medium text-gray-300 mb-1">
                Contenido
              </label>
              <textarea
                id="postContent"
                name="content"
                value={newPostData.content}
                onChange={handlePostInputChange}
                required
                rows={4}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white mt-1 focus:ring-yellow-500 focus:border-yellow-500"
              ></textarea>
            </div>
            <div>
              <label htmlFor="postImage" className="block text-sm font-medium text-gray-300 mb-1">
                Subir Imagen/Video (Opcional)
              </label>
              <input
                id="postImage"
                type="file"
                accept="image/*,video/*"
                onChange={handleImageChange}
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
              />
              {selectedImage && (
                <p className="text-sm text-gray-400 mt-2">Archivo seleccionado: {selectedImage.name}</p>
              )}
            </div>
            <button
              type="submit"
              className="bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-600 transition w-full"
            >
              Publicar
            </button>
          </form>
        )}
        {activeTab === 'createPost' && !canUserCreatePosts && (
          <p className="text-red-400 text-center text-lg mt-8 px-4">
            Tu rol actual no te permite crear publicaciones. Solo podras publicar en eventos especiales, Fechas especificas.
          </p>
        )}

        {/* --- Contenido de Mi Perfil --- */}
        {activeTab === 'profile' && (
          // Este es el contenedor principal de la sección de perfil.
          // `max-w-lg` limita el ancho en pantallas grandes, `w-full` lo hace adaptable en pequeñas.
          // `p-4` es el padding en móvil, `md:p-8` en desktop. Puedes ajustar `p-4` a `p-2` o `p-3` si quieres reducir el tamaño.
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-4 md:p-8 rounded-xl shadow-2xl w-77 max-w-lg mx-auto border border-gray-700 relative">
            {/* El tamaño del título se ajusta con `text-2xl md:text-3xl` */}
            <h3 className="font-extrabold text-2xl md:text-3xl mb-6 text-yellow-400 text-center">Mi Perfil</h3>
            {editingProfile ? (
              // El espaciado vertical de los elementos del formulario se controla con `space-y-4 md:space-y-6`
              <form onSubmit={handleUpdateProfile} className="space-y-4 md:space-y-6">
                <div>
                  <label htmlFor="profileName" className="block text-sm font-medium text-gray-300 mb-1">
                    Nombre
                  </label>
                  {/* El padding de los inputs se controla con `p-2` para móvil, `p-3` para desktop */}
                  <input
                    id="profileName"
                    name="name"
                    value={userProfile.name}
                    onChange={handleProfileInputChange}
                    required
                    className="w-full p-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-yellow-500 focus:border-yellow-500 transition"
                  />
                </div>

                <div>
                  <label htmlFor="profileEmail" className="block text-sm font-medium text-gray-300 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    id="profileEmail"
                    type="email"
                    value={userProfile.email}
                    readOnly
                    className="w-full p-2 rounded-lg bg-gray-700 border border-gray-600 text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label htmlFor="profilePhoto" className="block text-sm font-medium text-gray-300 mb-1">
                    Foto de Perfil
                  </label>
                  <input
                    id="profilePhoto"
                    type="file"
                    accept="image/*"
                    onChange={handleProfileImageChange}
                    className="w-full p-2 rounded-lg bg-gray-700 border border-gray-600 text-white mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 cursor-pointer"
                  />
                  {profileImageFile ? (
                    <p className="text-sm text-gray-400 mt-2">Nueva imagen seleccionada: <span className="font-semibold text-yellow-300">{profileImageFile.name}</span></p>
                  ) : userProfile.photo_url ? (
                    <div className="mt-4 flex flex-col items-center">
                      <p className="text-sm text-gray-400 mb-2">Foto actual:</p>
                      {/* Ajusta `w-24 h-24` para el tamaño de la imagen en móvil */}
                      <img src={userProfile.photo_url} alt="Foto de Perfil Actual" className="w-24 h-24 md:w-32 md:h-32 object-cover rounded-full border-4 border-yellow-500 shadow-lg" />
                      <button
                        type="button"
                        onClick={() => {
                          setUserProfile(prev => ({ ...prev, photo_url: null }));
                          setProfileImageFile(null);
                        }}
                        className="text-red-400 text-sm mt-3 hover:underline hover:text-red-500 transition"
                      >
                        Eliminar foto actual
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-2">No hay foto de perfil actual.</p>
                  )}
                </div>

                {/* El espaciado vertical de los botones se controla con `space-y-3` en móvil, `space-y-0` y `space-x-4` en desktop */}
                {/* El padding de los botones se controla con `py-2 px-4` en móvil, `py-3 px-8` en desktop */}
                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-4 md:mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-yellow-500 text-gray-900 font-bold py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors duration-300 shadow-md"
                  >
                    Guardar Cambios
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(false);
                      fetchUserProfile();
                    }}
                    className="flex-1 bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors duration-300 shadow-md"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              // El espaciado vertical de los elementos de visualización se controla con `space-y-4 md:space-y-6`
              <div className="flex flex-col items-center text-center space-y-4 md:space-y-6">
                {/* Ajusta `w-32 h-32` para el tamaño del contenedor de la imagen en móvil */}
                <div className="relative w-32 h-32 md:w-40 md:h-40">
                  <img
                    src={userProfile.photo_url || "https://placehold.co/150x150/555/FFF?text=No+Foto"}
                    alt="Foto de Perfil"
                    className="w-full h-full object-cover rounded-full border-4 border-yellow-500 shadow-xl"
                  />
                </div>

                {/* El espaciado vertical de los campos de información se controla con `space-y-2 md:space-y-3` */}
                <div className="space-y-2 md:space-y-3 text-gray-200 w-full">
                  {/* El padding de los cuadros de información se controla con `p-3` */}
                  <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
                    <p className="text-sm font-medium text-gray-400 mb-1">Nombre:</p>
                    {/* El tamaño del texto del nombre se controla con `text-xl md:text-2xl` */}
                    <p className="text-xl md:text-2xl font-bold text-white">{userProfile.name}</p>
                  </div>

                  <div className="bg-gray-700 p-3 rounded-lg shadow-inner">
                    <p className="text-sm font-medium text-gray-400 mb-1">Correo Electrónico:</p>
                    {/* El tamaño del texto del email se controla con `text-lg md:text-xl` */}
                    <p className="text-lg md:text-xl font-bold text-white break-words">{userProfile.email}</p>
                  </div>
                </div>

                {/* El padding de los botones se controla con `py-2 px-6` */}
                <button
                  onClick={() => setEditingProfile(true)}
                  className="w-full sm:w-auto bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-300 shadow-md transform hover:scale-105"
                >
                  Editar Perfil
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- CONTENIDO DE ASISTENCIAS --- */}
        {activeTab === 'asistencias' && (
          <div className="bg-gray-800 p-6 rounded-md shadow space-y-4 w-full border border-gray-700 mx-auto max-w-3xl">
            <h3 className="font-semibold mb-2 text-yellow-300 text-xl text-center">
              {userRole === 4 ? 'Buscar Estudiantes y Asistencias' : 'Consulta de Asistencias'}
            </h3>

            {userRole === 4 ? ( 
              <>
                <p className="text-center text-gray-300">
                  Busca estudiantes por nombre, apellido o cédula para ver sus asistencias.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 my-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Nombre, apellido o cédula"
                    onKeyPress={(e) => e.key === 'Enter' && handleStudentSearch()}
                  />
                  <button
                    onClick={handleStudentSearch}
                    disabled={searchLoading}
                    className={`bg-yellow-500 text-gray-900 font-bold py-2 px-4 sm:px-6 rounded transition w-full sm:w-auto ${
                      searchLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'
                    }`}
                  >
                    {searchLoading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {searchError && (
                  <div className="mt-2 p-3 rounded-md bg-red-900/50 text-red-300 text-center">
                    {searchError}
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <h4 className="text-lg font-bold text-yellow-300 mb-3 text-center">Resultados de Búsqueda</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {searchResults.map((student) => (
                        <div key={student.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                          <h4 className="font-bold text-white text-lg">
                            {student.name} {student.last_name}
                          </h4>
                          <p className="text-sm text-gray-300">Cédula: <span className="font-medium">{student.cedula || 'No registrada'}</span></p>
                          <p className="text-sm text-gray-300">Grupo: <span className="font-medium">{student.class_group_name || 'Sin grupo'}</span></p>

                          <div className="mt-3 pt-3 border-t border-gray-600">
                            <p className="text-sm text-gray-300">Días de clase: <span className="font-semibold text-yellow-300">{student.total_class_days}</span></p>
                            <p className="text-sm text-green-400">Asistencias: <span className="font-semibold">{student.present_days}</span></p>
                            <p className="text-sm text-blue-400">Justificadas: <span className="font-semibold">{student.justified_days}</span></p>
                            <p className="text-sm text-red-400">Faltas: <span className="font-semibold">{student.absent_days}</span></p>

                            {student.total_class_days > 0 && (
                              <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                                <div
                                  className="bg-yellow-500 h-2.5 rounded-full"
                                  style={{ width: `${((student.present_days + student.justified_days) / student.total_class_days) * 100}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : ( 
              <>
                <p className="text-center text-gray-300">
                  ¿Quieres saber las asistencias de tu hijo(a)? Digita su cédula o nombres y apellidos aquí abajo.
                </p>
                <div className="flex flex-col sm:flex-row justify-center my-4 gap-2">
                  <input
                    type="text"
                    value={cedulaInput}
                    onChange={(e) => setCedulaInput(e.target.value)}
                    className="w-full max-w-sm p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="Cédula o Nombres y Apellidos"
                    onKeyPress={(e) => e.key === 'Enter' && handleAttendanceLookup()}
                  />
                  <button
                    onClick={handleAttendanceLookup}
                    disabled={attendanceLoading}
                    className={`bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded transition w-full sm:w-auto ${attendanceLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'}`}
                  >
                    {attendanceLoading ? 'Consultando...' : 'Consultar'}
                  </button>
                </div>
                {attendanceMessage && (
                  <div className="mt-4 p-4 rounded-md bg-gray-700 text-center">
                    <p className="text-yellow-300">{attendanceMessage}</p>
                  </div>
                )}
                {attendanceData && (
                  <div className="mt-4 p-4 rounded-md bg-gray-700 text-center border border-yellow-500">
                    <h4 className="text-lg font-bold text-yellow-300 mb-2">Resultados de Asistencia</h4>
                    <p className="text-white">Nombre: <span className="font-semibold">{attendanceData.name} {attendanceData.last_name}</span></p>
                    <p className="text-white">Cédula: <span className="font-semibold">{attendanceData.cedula}</span></p>
                    <p className="text-white">Grupo: <span className="font-semibold">{attendanceData.class_group_name || 'No asignado'}</span></p>
                    <p className="text-white mt-2">Días de clase: <span className="font-semibold text-yellow-300">{attendanceData.total_class_days}</span></p>
                    <p className="text-green-400">Asistencias: <span className="font-semibold">{attendanceData.present_days}</span></p>
                    <p className="text-blue-400">Justificadas: <span className="font-semibold">{attendanceData.justified_days}</span></p>
                    <p className="text-red-400">Faltas: <span className="font-semibold">{attendanceData.absent_days}</span></p>
                    {attendanceData.total_class_days > 0 && (
                      <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                        <div
                          className="bg-yellow-500 h-2.5 rounded-full"
                          style={{ width: `${((attendanceData.present_days + attendanceData.justified_days) / attendanceData.total_class_days) * 100}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* --- NUEVA SECCIÓN: Donaciones y Patrocinadores --- */}
        {activeTab === 'donations' && (
          <div className="bg-gray-800 p-6 rounded-md shadow space-y-6 w-full border border-gray-700 mx-auto max-w-3xl">
            <h3 className="text-3xl font-bold mb-4 text-yellow-300 text-center flex flex-col sm:flex-row items-center justify-center">
              <Gift size={28} className="mr-0 sm:mr-3 mb-2 sm:mb-0" /> Donaciones y Patrocinadores
            </h3>
            <p className="text-gray-300 text-lg text-center">
              ¡Tu apoyo nos ayuda a seguir mejorando y creando herramientas útiles para la comunidad educativa!
              Explora nuestras aplicaciones gratuitas con publicidad o considera una donación directa.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sección de Apps con Publicidad */}
              <div className="bg-gray-700 p-5 rounded-lg shadow-inner border border-gray-600">
                <h4 className="text-2xl font-bold text-yellow-200 mb-4 flex items-center">
                  <Smartphone size={24} className="mr-2" /> Apps con Publicidad
                </h4>
                <p className="text-gray-300 mb-4">
                  Descarga y usa estas aplicaciones gratuitas. Al interactuar con la publicidad, nos ayudas a financiar el desarrollo.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center bg-gray-600 p-3 rounded-md shadow-sm">
                    <img src="https://placehold.co/50x50/333/FFF?text=App1" alt="Icono App 1" className="w-12 h-12 rounded-lg mr-4" />
                    <div>
                      <p className="font-semibold text-white text-lg">Matemáticas Divertidas</p>
                      <p className="text-sm text-gray-400">Juegos educativos para niños.</p>
                      <a href="https://example.com/app1.apk" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm block mt-1">
                        Descargar APK
                      </a>
                    </div>
                  </li>
                  <li className="flex items-center bg-gray-600 p-3 rounded-md shadow-sm">
                    <img src="https://placehold.co/50x50/333/FFF?text=App2" alt="Icono App 2" className="w-12 h-12 rounded-lg mr-4" />
                    <div>
                      <p className="font-semibold text-white text-lg">Mi Horario Escolar</p>
                      <p className="text-sm text-gray-400">Organiza tus clases y tareas.</p>
                      <a href="https://example.com/app2.apk" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm block mt-1">
                        Descargar APK
                      </a>
                    </div>
                  </li>
                  <li className="flex items-center bg-gray-600 p-3 rounded-md shadow-sm">
                    <img src="https://placehold.co/50x50/333/FFF?text=App3" alt="Icono App 3" className="w-12 h-12 rounded-lg mr-4" />
                    <div>
                      <p className="font-semibold text-white text-lg">Cuentos Interactivos</p>
                      <p className="text-sm text-gray-400">Historias animadas para aprender.</p>
                      <a href="https://example.com/app3.apk" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm block mt-1">
                        Descargar APK
                      </a>
                    </div>
                  </li>
                </ul>
              </div>
              {/* Sección de Donaciones Directas */}
              <div className="bg-gray-700 p-5 rounded-lg shadow-inner border border-gray-600">
                <h4 className="text-2xl font-bold text-yellow-200 mb-4 flex items-center">
                  <Gift size={24} className="mr-2" /> Donaciones Directas
                </h4>
                <p className="text-gray-300 mb-4">
                  Si deseas apoyar nuestro trabajo directamente, puedes hacerlo a través de los siguientes métodos. ¡Cada contribución es muy valorada!
                </p>
                <ul className="space-y-3">
                  <li className="bg-gray-600 p-3 rounded-md shadow-sm">
                    <p className="font-semibold text-white">PayPal:</p>
                    <a href="https://www.paypal.com/donate/?hosted_button_id=YOUR_PAYPAL_BUTTON_ID" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                      Donar vía PayPal
                    </a>
                  </li>
                  <li className="bg-gray-600 p-3 rounded-md shadow-sm">
                    <p className="font-semibold text-white">Transferencia Bancaria:</p>
                    <p className="text-sm text-gray-400">Banco: [Nombre del Banco]</p>
                    <p className="text-sm text-gray-400">Cuenta: [Número de Cuenta]</p>
                    <p className="text-sm text-gray-400">Beneficiario: [Tu Nombre/Organización]</p>
                  </li>
                  <li className="bg-gray-600 p-3 rounded-md shadow-sm">
                    <p className="font-semibold text-white">Patreon:</p>
                    <a href="https://www.patreon.com/yourproject" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm">
                      Conviértete en Patrocinador
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de navegación móvil (sin el botón flotante ni lógica de menú deslizante) */}
      <MobileNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Modal de Confirmación de Eliminación (para posts) */}
      <ConfirmationModal
        show={showDeleteModal}
        message={`¿Estás seguro de que quieres eliminar la publicación "${postToDelete?.title}"? Esta acción es irreversible.`}
        onConfirm={handleDeletePost}
        onCancel={() => {
          setShowDeleteModal(false);
          setPostToDelete(null);
        }}
      />

      {/* Media Viewer Modal */}
      <MediaViewerModal
        postMediaArray={viewerMediaInfo?.mediaArray || []}
        initialMediaIndex={viewerMediaInfo?.initialIndex || 0}
        onClose={() => setViewerMediaInfo(null)}
      />

      <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
    </section>
  );
}
