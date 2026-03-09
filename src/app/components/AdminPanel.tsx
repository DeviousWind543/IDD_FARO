'use client';

import React, { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent, ReactNode } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Edit, Trash2, Save, X, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '');

// --- Definiciones de Tipos ---

// Exportar la interfaz User para que pueda ser importada en page.tsx
export interface User {
  id: string | number;
  name: string;
  email: string;
  role_id: number;
  class_group_id?: string | null;
  photo_url?: string | null;
  country?: string;
  last_seen?: string;
}

export interface Student {
  id: string;
  name: string;
  last_name: string;
  birthdate: string;
  cedula: string;
  guardian_name: string;
  guardian_phone: string;
  photo_url?: string | null;
  class_group_id?: string | null;
  direccion?: string;
  email?: string;
  gender?: string;
  phone?: string;
}

export interface MediaItem {
  url: string;
  type: string;
  name?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  media: MediaItem[];
  likes: number;
  comments: any[];
  createdAt: string;
  user_id?: string;
  user_name?: string;
  media_urls?: MediaItem[];
  currentMediaIndex?: number;
  created_at?: string;
}

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
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'system_crud';
  actor_id: number;
  actor_name: string;
  post_title?: string;
  content: string;
  read_status: boolean;
  created_at: string;
  related_entity_id?: string;
  related_entity_type?: string;
  recipient_id?: number | null;
}

type ModalProps = {
  show: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  theme?: 'light' | 'dark';
};

type MediaViewerModalProps = {
  postMediaArray: MediaItem[];
  initialMediaIndex: number;
  onClose: () => void;
  theme?: 'light' | 'dark';
};

type AdminPanelProps = {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  activeSection?: string;
  setActiveSection?: (section: string) => void;
  connectedUsers?: User[];
  connectedUsersCount?: number;
  allowedTabs?: string[];
  theme?: 'light' | 'dark'; // Nueva prop para el tema
};

// --- Componentes Modales con tema ---

function ConfirmationModal({ show, message, onConfirm, onCancel, theme = 'dark' }: ModalProps) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
      <div className={`p-6 rounded-lg shadow-xl border max-w-sm w-full ${
        theme === 'light'
          ? 'bg-white border-gray-300 text-gray-800'
          : 'bg-gray-800 border-gray-700 text-white'
      }`}>
        <p className="text-lg mb-6 text-center">{message}</p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={onConfirm}
            className={`${
              theme === 'light'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } font-bold py-2 px-5 rounded transition`}
          >
            Confirmar
          </button>
          <button
            onClick={onCancel}
            className={`${
              theme === 'light'
                ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                : 'bg-gray-500 hover:bg-gray-600 text-white'
            } font-bold py-2 px-5 rounded transition`}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function MediaViewerModal({ postMediaArray, initialMediaIndex, onClose, theme = 'dark' }: MediaViewerModalProps) {
  if (!postMediaArray || postMediaArray.length === 0 || initialMediaIndex === undefined || initialMediaIndex < 0 || initialMediaIndex >= postMediaArray.length) {
    return null;
  }
  const [currentDisplayIndex, setCurrentDisplayIndex] = useState<number>(initialMediaIndex);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    setCurrentDisplayIndex(initialMediaIndex);
  }, [initialMediaIndex]);

  const currentMedia = postMediaArray[currentDisplayIndex];
  const mediaUrl = `${API_BASE_URL.replace('/api', '')}${currentMedia?.url?.startsWith('/') ? currentMedia.url : '/' + currentMedia?.url}`;

  const handleNext = useCallback(() => {
    setCurrentDisplayIndex(prevIndex => Math.min(prevIndex + 1, postMediaArray.length - 1));
  }, [postMediaArray.length]);

  const handlePrev = useCallback(() => {
    setCurrentDisplayIndex(prevIndex => Math.max(prevIndex - 1, 0));
  }, [postMediaArray.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') handleNext();
      else if (event.key === 'ArrowLeft') handlePrev();
      else if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    const swipeThreshold = 50;
    if (deltaX > swipeThreshold) handlePrev();
    else if (deltaX < -swipeThreshold) handleNext();
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900 bg-opacity-90 flex items-center justify-center z-50 p-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`relative max-w-4xl max-h-full rounded-lg shadow-xl overflow-hidden flex flex-col ${
        theme === 'light' ? 'bg-white' : 'bg-gray-800'
      }`}>
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 text-3xl font-bold rounded-full w-10 h-10 flex items-center justify-center hover:opacity-80 z-10 ${
            theme === 'light'
              ? 'bg-gray-300 text-gray-800 hover:bg-gray-400'
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
          aria-label="Cerrar"
        >
          &times;
        </button>
        <div className="p-4 flex-grow flex items-center justify-center">
          {currentMedia?.type?.startsWith('image') ? (
            <img src={mediaUrl} alt="Vista previa de imagen" className="max-w-full max-h-[80vh] object-contain mx-auto" />
          ) : currentMedia?.type?.startsWith('video') ? (
            <video controls src={mediaUrl} className="max-w-full max-h-[80vh] object-contain mx-auto">
              Tu navegador no soporta el video.
            </video>
          ) : (
            <p className={theme === 'light' ? 'text-gray-800' : 'text-white'}>
              Tipo de medio no soportado.
            </p>
          )}
        </div>
        <div className="absolute inset-y-0 left-0 flex items-center">
          <button
            onClick={handlePrev}
            disabled={currentDisplayIndex === 0}
            className={`${
              theme === 'light'
                ? 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            } bg-opacity-75 p-3 rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed transition`}
            aria-label="Anterior"
          >
            &#10094;
          </button>
        </div>
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={handleNext}
            disabled={currentDisplayIndex === postMediaArray.length - 1}
            className={`${
              theme === 'light'
                ? 'bg-gray-300 text-gray-800 hover:bg-gray-400'
                : 'bg-gray-700 text-white hover:bg-gray-600'
            } bg-opacity-75 p-3 rounded-l-lg disabled:opacity-50 disabled:cursor-not-allowed transition`}
            aria-label="Siguiente"
          >
            &#10095;
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Componente AdminPanel ---

export default function AdminPanel({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  activeSection,
  setActiveSection,
  connectedUsers: propsConnectedUsers,
  connectedUsersCount: propsConnectedUsersCount,
  allowedTabs = ['users', 'posts', 'attendance', 'list', 'connected', 'activity-log'],
  theme = 'dark', // Valor por defecto
}: AdminPanelProps) {
  const router = useRouter();

  // Estados para la gestión de pestañas y secciones
  const [activeTab, setActiveTab] = useState<string>('users');
  const panelActiveTab = propActiveTab ?? activeTab;
  const panelSetActiveTab = propSetActiveTab ?? setActiveTab;

  // Estados para la gestión de usuarios
  const [userSearch, setUserSearch] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [errorUsers, setErrorUsers] = useState<string>('');
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{ name: string; email: string; role_id: string; password: string; class_group_id: string | null; }>({ name: '', email: '', role_id: '4', password: '', class_group_id: '' });
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newUserData, setNewUserData] = useState<{ name: string; email: string; password: string; role_id: string; class_group_id: string | null; }>({ name: '', email: '', password: '', role_id: '4', class_group_id: '' });
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);

  // Estados para la gestión de alumnos
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [errorStudents, setErrorStudents] = useState<string>('');
  const [studentGroupFilter, setStudentGroupFilter] = useState<string>('');
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [editStudentData, setEditStudentData] = useState<Student>({
    id: '', name: '', last_name: '', birthdate: '', cedula: '', guardian_name: '', guardian_phone: '',
    photo_url: '', class_group_id: '', direccion: '', email: '', gender: '', phone: '',
  });
  const [alumnoSearchTerm, setAlumnoSearchTerm] = useState<string>('');
  const [alumnoSearchMonth, setAlumnoSearchMonth] = useState<string>('');

  // Estados para la gestión de posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [editPostData, setEditPostData] = useState<{ title: string; content: string; }>({ title: '', content: '' });
  const [newMediaFiles, setNewMediaFiles] = useState<File[]>([]);
  const [existingMediaToDelete, setExistingMediaToDelete] = useState<string[]>([]);
  const [editingPostMedia, setEditingPostMedia] = useState<MediaItem[]>([]);
  const [viewerMediaInfo, setViewerMediaInfo] = useState<{ mediaArray: MediaItem[]; initialIndex: number; } | null>(null);

  // Estados para informes de asistencia
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState<boolean>(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('');
  const [attendanceGroupFilter, setAttendanceGroupFilter] = useState<string>('');
  const [groupedAttendance, setGroupedAttendance] = useState<Record<string, AttendanceRecord[]>>({});

  // Estados para usuarios conectados
  const [connectedUsers, setConnectedUsers] = useState<User[]>(propsConnectedUsers || []);
  const [connectedUsersCount, setConnectedUsersCount] = useState<number>(propsConnectedUsersCount || 0);
  const [loadingConnectedUsers, setLoadingConnectedUsers] = useState<boolean>(false);

  // Estados para grupos de clase
  const [groups, setGroups] = useState<ClassGroup[]>([]);

  // Referencia para el socket
  const socketRef = useRef<Socket | null>(null);

  // Estados para el modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>('');
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);

  // NUEVO ESTADO: Para las notificaciones de actividad del sistema (CRUD)
  const [systemNotifications, setSystemNotifications] = useState<Notification[]>([]);
  const [loadingSystemNotifications, setLoadingSystemNotifications] = useState<boolean>(false);

  // Helper para obtener clases según el tema
  const getThemeClasses = {
    container: theme === 'light' 
      ? 'bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800' 
      : 'bg-gradient-to-br from-gray-900 to-gray-800 text-white',
    card: theme === 'light'
      ? 'bg-white border border-gray-200'
      : 'bg-gray-800 border border-gray-700',
    input: theme === 'light'
      ? 'bg-white border border-gray-300 text-gray-800 focus:ring-lime-500 focus:border-lime-500'
      : 'bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400',
    select: theme === 'light'
      ? 'bg-white border border-gray-300 text-gray-800 focus:ring-lime-500 focus:border-lime-500'
      : 'bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400',
    tableHeader: theme === 'light'
      ? 'bg-gray-100 text-lime-700 border-gray-300'
      : 'bg-gray-700 text-lime-400 border-gray-600',
    tableCell: theme === 'light'
      ? 'border-gray-300'
      : 'border-gray-600',
    tableRowHover: theme === 'light'
      ? 'hover:bg-gray-50'
      : 'hover:bg-gray-700',
    buttonPrimary: theme === 'light'
      ? 'bg-lime-500 hover:bg-lime-600 text-gray-900'
      : 'bg-lime-400 hover:bg-lime-500 text-gray-900',
    buttonSecondary: theme === 'light'
      ? 'bg-blue-500 hover:bg-blue-600 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonDanger: theme === 'light'
      ? 'bg-red-500 hover:bg-red-600 text-white'
      : 'bg-red-600 hover:bg-red-700 text-white',
    textMuted: theme === 'light'
      ? 'text-gray-600'
      : 'text-gray-400',
    textAccent: theme === 'light'
      ? 'text-lime-700'
      : 'text-lime-400',
    borderAccent: theme === 'light'
      ? 'border-lime-500'
      : 'border-lime-400',
  };

  // Efecto para obtener el ID del usuario logueado de localStorage al cargar el componente
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    setLoggedInUserId(userId);
  }, []);

  // Efecto para cargar datos iniciales cuando el componente se monta
  useEffect(() => {
    fetchPosts();
    fetchAttendanceReports();
    fetchStudents();
    fetchGroups();
    fetchUsers();
    fetchConnectedUsers();
    fetchSystemNotifications();
  }, []);

  // Filtra usuarios por búsqueda
  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Función para calcular la edad a partir de una fecha de nacimiento
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

  // --- Funciones de Fetch de Datos ---
  // (Estas funciones se mantienen igual, solo cambian las clases CSS)

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<User[]>(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setUsers(res.data);
      } else {
        console.warn("API de usuarios no devolvió un array:", res.data);
        setUsers([]);
      }
    } catch (err) {
      setErrorUsers('Error cargando usuarios');
      console.error('Error fetching users:', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true);
    setErrorStudents('');
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      if (studentGroupFilter) {
        queryParams.append('groupId', studentGroupFilter);
      }
      if (alumnoSearchTerm) {
        queryParams.append('search', alumnoSearchTerm);
      }
      if (alumnoSearchMonth) {
        queryParams.append('month', alumnoSearchMonth);
      }

      let url = `${API_BASE_URL}/alumnos`;
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const res = await axios.get<Student[]>(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setStudents(res.data);
      } else {
        console.warn("API de alumnos no devolvió un array:", res.data);
        setStudents([]);
      }
    } catch (err) {
      setErrorStudents('Error cargando alumnos');
      console.error('Error fetching students:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [studentGroupFilter, alumnoSearchTerm, alumnoSearchMonth]);

  const handleDownloadAlumnosPdf = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      if (studentGroupFilter) {
        queryParams.append('groupId', studentGroupFilter);
      }
      if (alumnoSearchTerm) {
        queryParams.append('search', alumnoSearchTerm);
      }
      if (alumnoSearchMonth) {
        queryParams.append('month', alumnoSearchMonth);
      }

      let url = `${API_BASE_URL}/alumnos/reports/pdf`;
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

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

      toast.success('Listado de alumnos en PDF descargado correctamente.');
    } catch (err: any) {
      console.error('Error descargando listado de alumnos PDF:', err);
      toast.error(`Error descargando PDF: ${err.response?.data?.message || err.message}`);
    }
  };

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<ClassGroup[]>(`${API_BASE_URL}/class-groups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setGroups(res.data);
      } else {
        console.warn("API de grupos no devolvió un array:", res.data);
        setGroups([]);
      }
    } catch (err) {
      console.error('Error cargando grupos', err);
      setGroups([]);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<Post[]>(`${API_BASE_URL}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        const formattedPosts: Post[] = res.data.map(post => ({
          ...post,
          authorName: post.user_name || 'Desconocido',
          media: post.media_urls || [],
          currentMediaIndex: 0,
          createdAt: new Date(post.created_at || '').toLocaleDateString(),
        }));
        setPosts(formattedPosts);
      } else {
        console.warn("API de posts no devolvió un array:", res.data);
        setPosts([]);
      }
    } catch (err) {
      console.error('Error cargando posts:', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  const handleDownloadPdf = async () => {
    try {
      let url = `${API_BASE_URL}/asistencia/reports/pdf`;
      const params = new URLSearchParams();

      if (attendanceDateFilter) {
        params.append('date', attendanceDateFilter);
      }
      if (attendanceGroupFilter) {
        params.append('class_group_id', attendanceGroupFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const currentToken = localStorage.getItem('token');
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${currentToken}` },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'reporte_asistencia.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Reporte PDF descargado correctamente.');
    } catch (err: any) {
      console.error('Error descargando reporte PDF:', err);
      toast.error(`Error descargando reporte PDF: ${err.response?.data?.error || err.message}`);
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

      if (attendanceDateFilter) {
        params.append('date', attendanceDateFilter);
      }
      if (attendanceGroupFilter) {
        params.append('class_group_id', attendanceGroupFilter);
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const currentToken = localStorage.getItem('token');
      const res = await axios.get<{ summary: AttendanceSummary; records: AttendanceRecord[] }>(url, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });

      setAttendanceSummary(res.data.summary);

      const records = res.data.records || [];
      if (!Array.isArray(records)) {
        console.warn("API de asistencia no devolvió un array de registros:", res.data.records);
        setAttendanceRecords([]);
        setGroupedAttendance({});
        return;
      }
      setAttendanceRecords(records);

      if (!attendanceDateFilter) {
        const newGroupedAttendance: Record<string, AttendanceRecord[]> = records.reduce((acc, record) => {
          const dateKey = new Date(record.date).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(record);
          return acc;
        }, {} as Record<string, AttendanceRecord[]>);

        for (const dateKey in newGroupedAttendance) {
          newGroupedAttendance[dateKey].sort((a, b) => {
            const nameA = (a.student_name + ' ' + (a.student_last_name || '')).trim().toLowerCase();
            const nameB = (b.student_name + ' ' + (b.student_last_name || '')).trim().toLowerCase();
            return nameA.localeCompare(nameB);
          });
        }
        setGroupedAttendance(newGroupedAttendance);
      } else {
        setGroupedAttendance({
          [new Date(attendanceDateFilter).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })]: records.sort((a, b) => {
            const nameA = (a.student_name + ' ' + (a.student_last_name || '')).trim().toLowerCase();
            const nameB = (b.student_name + ' ' + (b.student_last_name || '')).trim().toLowerCase();
            return nameA.localeCompare(nameB);
          })
        });
      }

    } catch (err: any) {
      console.error('Error cargando informes de asistencia:', err);
      toast.error(`Error cargando informes de asistencia: ${err.response?.data?.error || err.message}`);
      setAttendanceRecords([]);
      setAttendanceSummary(null);
      setGroupedAttendance({});
    } finally {
      setLoadingAttendance(false);
    }
  }, [attendanceDateFilter, attendanceGroupFilter]);

  const fetchConnectedUsers = useCallback(async () => {
    setLoadingConnectedUsers(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<User[]>(`${API_BASE_URL}/users/connected`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setConnectedUsers(res.data);
        setConnectedUsersCount(res.data.length);
      } else {
        console.warn("API de usuarios conectados no devolvió un array:", res.data);
        setConnectedUsers([]);
        setConnectedUsersCount(0);
      }
    } catch (err) {
      console.error('Error al obtener usuarios conectados:', err);
      setConnectedUsers([]);
      setConnectedUsersCount(0);
    } finally {
      setLoadingConnectedUsers(false);
    }
  }, []);

  const fetchSystemNotifications = useCallback(async () => {
    setLoadingSystemNotifications(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get<Notification[]>(`${API_BASE_URL}/notifications/system-crud`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemNotifications(res.data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (err: any) {
      console.error('Error fetching system notifications:', err);
      if (err.response && err.response.status === 403) {
        toast.error('Acceso denegado. No tienes permisos para ver el registro de actividad del sistema.');
      } else {
        toast.error('Error cargando notificaciones del sistema.');
      }
      setSystemNotifications([]);
    } finally {
      setLoadingSystemNotifications(false);
    }
  }, []);

  const handleMarkAllSystemNotificationsAsRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await axios.put(`${API_BASE_URL}/notifications/system-crud/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemNotifications(prev =>
        prev.map(n => ({ ...n, read_status: true }))
      );
      toast.success('Todas las notificaciones de sistema marcadas como leídas.');
    } catch (error: any) {
      console.error('Error marking all system notifications as read:', error);
      toast.error(`Error al marcar todas como leídas: ${error.response?.data?.message || error.message}`);
    }
  }, []);

  const handleMarkSystemNotificationAsRead = useCallback(async (notificationId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSystemNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read_status: true } : n)
      );
      toast.success('Notificación marcada como leída.');
    } catch (error: any) {
      console.error('Error marking system notification as read:', error);
      toast.error(`Error al marcar notificación como leída: ${error.response?.data?.message || error.message}`);
    }
  }, []);

  // (El resto de funciones se mantienen igual, solo cambian las clases CSS en el JSX)

  // Manejadores de eventos (se mantienen igual)
  const handleEditClick = (user: User) => {
    setEditUserId(user.id as string);
    setEditFormData({
      name: user.name,
      email: user.email,
      role_id: user.role_id.toString(),
      password: '',
      class_group_id: user.class_group_id || '',
    });
  };

  const handleCancelClick = () => {
    setEditUserId(null);
    setEditFormData({ name: '', email: '', role_id: '4', password: '', class_group_id: '' });
  };

  const handleEditFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!editUserId) {
      toast.error('Error: ID de usuario para editar no encontrado.');
      return;
    }

    try {
      const payload: { name: string; email: string; role_id: number; class_group_id: string | null; password?: string; } = {
        name: editFormData.name,
        email: editFormData.email,
        role_id: Number(editFormData.role_id),
        class_group_id: editFormData.class_group_id || null,
      };

      if (editFormData.password && editFormData.password.trim() !== '') {
        payload.password = editFormData.password;
      }

      await axios.put(`${API_BASE_URL}/users/${editUserId}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      await fetchUsers();
      setEditUserId(null);
      setEditFormData({ name: '', email: '', role_id: '4', password: '', class_group_id: '' });
      toast.success('Usuario actualizado correctamente');
    } catch (error: any) {
      console.error('Error actualizando usuario:', error);
      toast.error(`Error actualizando usuario: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleDeleteUser = (userId: string | number) => {
    setModalMessage('¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.');
    setConfirmAction(() => async () => {
      const token = localStorage.getItem('token');
      try {
        await axios.delete(`${API_BASE_URL}/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchUsers();
        toast.success('Usuario eliminado correctamente');
      } catch (error: any) {
        console.error('Error eliminando usuario:', error);
        toast.error(`Error eliminando usuario: ${error.response?.data?.message || error.message}`);
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handleCreateFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const payload = {
        ...newUserData,
        role_id: Number(newUserData.role_id),
        class_group_id: newUserData.class_group_id || null,
      };

      const res = await axios.post(`${API_BASE_URL}/users`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const newUserId = res.data.userId || res.data.id;

      if (payload.role_id === 2 && payload.class_group_id && newUserId) {
        try {
          await axios.put(
            `${API_BASE_URL}/class-groups/${payload.class_group_id}/assign-teacher/${newUserId}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log(`Profesor (ID: ${newUserId}) asignado al grupo (ID: ${payload.class_group_id}) correctamente.`);
        } catch (assignError: any) {
          console.error('Error al asignar el profesor al grupo de clase:', assignError.response?.data || assignError.message);
          toast.error(`Error al asignar el profesor al grupo: ${assignError.response?.data?.error || assignError.message}`);
        }
      }

      await fetchUsers();
      setNewUserData({ name: '', email: '', password: '', role_id: '4', class_group_id: '' });
      setShowCreateForm(false);
      toast.success('Usuario creado correctamente');
    } catch (error: any) {
      console.error('Error creando usuario:', error);
      toast.error(`Error creando usuario: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleGroupFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setStudentGroupFilter(e.target.value);
  };

  const handleEditStudentClick = (student: Student) => {
    setEditStudentId(student.id);
    setEditStudentData({
      name: student.name || '',
      last_name: student.last_name || '',
      email: student.email || '',
      gender: student.gender || '',
      phone: student.phone || '',
      birthdate: student.birthdate ? student.birthdate.split('T')[0] : '',
      cedula: student.cedula || '',
      guardian_name: student.guardian_name || '',
      guardian_phone: student.guardian_phone || '',
      photo_url: student.photo_url || '',
      class_group_id: student.class_group_id || '',
      direccion: student.direccion || '',
      id: student.id,
    });
  };

  const handleCancelStudentEdit = () => {
    setEditStudentId(null);
    setEditStudentData({
      id: '', name: '', last_name: '', email: '', birthdate: '', gender: '', phone: '', cedula: '',
      guardian_name: '', guardian_phone: '', photo_url: '', class_group_id: '', direccion: '',
    });
  };

  const handleEditStudentChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditStudentData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditStudentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    const payload = {
      name: editStudentData.name,
      last_name: editStudentData.last_name || null,
      email: editStudentData.email || null,
      gender: editStudentData.gender || null,
      phone: editStudentData.phone || null,
      birthdate: editStudentData.birthdate,
      cedula: editStudentData.cedula,
      guardian_name: editStudentData.guardian_name,
      guardian_phone: editStudentData.guardian_phone,
      photo_url: editStudentData.photo_url || null,
      direccion: editStudentData.direccion,
      class_group_id: editStudentData.class_group_id || null,
    };

    try {
      await axios.put(
        `${API_BASE_URL}/alumnos/${editStudentId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      await fetchStudents();
      handleCancelStudentEdit();
      toast.success('Alumno actualizado correctamente');
    } catch (error: any) {
      console.error('Error al actualizar alumno:', error.response?.data || error.message);
      toast.error(`Error al actualizar alumno: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    setModalMessage('¿Seguro que deseas eliminar este alumno? Esta acción no se puede deshacer.');
    setConfirmAction(() => async () => {
      const token = localStorage.getItem('token');
      try {
        await axios.delete(`${API_BASE_URL}/alumnos/${studentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchStudents();
        toast.success('Alumno eliminado correctamente');
      } catch (error: any) {
        console.error('Error al eliminar alumno:', error);
        toast.error(`Error al eliminar alumno: ${error.response?.data?.message || error.message}`);
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handleDeletePost = (postId: string) => {
    setModalMessage('¿Seguro que deseas eliminar este post? Esta acción no se puede deshacer.');
    setConfirmAction(() => async () => {
      const adminUserId = loggedInUserId || localStorage.getItem('userId');
      if (!adminUserId) {
        toast.error('Error: No se encontró el ID de administrador para eliminar la publicación.');
        setShowConfirmModal(false);
        return;
      }

      const token = localStorage.getItem('token');
      try {
        await axios.delete(`${API_BASE_URL}/posts/${postId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        await fetchPosts();
        toast.success('Post eliminado correctamente');
      } catch (error: any) {
        console.error('Error eliminando post:', error);
        toast.error(`Error eliminando post: ${error.response?.data?.message || error.message}`);
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handleEditPostClick = (post: Post) => {
    setEditPostId(post.id);
    setEditPostData({
      title: post.title,
      content: post.content,
    });
    setNewMediaFiles([]);
    setExistingMediaToDelete([]);
    setEditingPostMedia(post.media || []);
  };

  const handleCancelPostEdit = () => {
    setEditPostId(null);
    setEditPostData({ title: '', content: '' });
    setNewMediaFiles([]);
    setExistingMediaToDelete([]);
    setEditingPostMedia([]);
  };

  const handleEditPostChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditPostData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewMediaFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewMediaFiles(Array.from(e.target.files));
    }
  };

  const handleEditPostSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    if (!editPostId) {
      toast.error('Error: ID de publicación para editar no encontrado.');
      return;
    }

    const formData = new FormData();
    formData.append('title', editPostData.title);
    formData.append('content', editPostData.content);

    newMediaFiles.forEach((file) => {
      formData.append('new_media', file);
    });

    if (existingMediaToDelete.length > 0) {
      formData.append('media_to_delete', JSON.stringify(existingMediaToDelete));
    }

    try {
      await axios.put(`${API_BASE_URL}/posts/${editPostId}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await fetchPosts();
      handleCancelPostEdit();
      toast.success('Publicación actualizada correctamente');
    } catch (error: any) {
      console.error('Error actualizando publicación:', error.response?.data || error.message);
      toast.error(`Error actualizando publicación: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleNextMediaInPost = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId && post.media && post.media.length > 0) {
          return {
            ...post,
            currentMediaIndex: Math.min((post.currentMediaIndex || 0) + 1, post.media.length - 1)
          };
        }
        return post;
      })
    );
  };

  const handlePrevMediaInPost = (postId: string) => {
    setPosts(prevPosts =>
      prevPosts.map(post => {
        if (post.id === postId && post.media && post.media.length > 0) {
          return {
            ...post,
            currentMediaIndex: Math.max((post.currentMediaIndex || 0) - 1, 0)
          };
        }
        return post;
      })
    );
  };

  // Configuración de ToastContainer según el tema
  const toastTheme = theme === 'light' ? 'light' : 'dark';

  return (
    <section className={`min-h-screen p-8 max-w-7xl mx-auto rounded-lg shadow-lg ${getThemeClasses.container}`}>
      {/* Sección de Gestión de Usuarios */}
      {panelActiveTab === 'users' && (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-2">
            <h2 className={`text-3xl font-bold ${getThemeClasses.textAccent}`}>Gestión de Usuarios</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className={`w-full md:w-72 px-3 py-2 rounded ${getThemeClasses.input}`}
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  className={`px-4 py-2 rounded transition ${
                    theme === 'light'
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  X
                </button>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm((prev) => !prev)}
            className={`mb-6 font-bold px-4 py-2 rounded-md transition ${getThemeClasses.buttonPrimary}`}
          >
            {showCreateForm ? 'Cancelar Creación' : 'Agregar Nuevo Usuario'}
          </button>
          {showCreateForm && (
            <form
              onSubmit={handleCreateUserSubmit}
              className={`mb-8 p-6 rounded-md shadow space-y-4 max-w-lg mx-auto md:mx-0 ${getThemeClasses.card}`}
            >
              <input
                type="text"
                name="name"
                placeholder="Nombre"
                value={newUserData.name}
                onChange={handleCreateFormChange}
                required
                className={`w-full p-2 rounded ${getThemeClasses.input}`}
              />
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={newUserData.email}
                onChange={handleCreateFormChange}
                required
                className={`w-full p-2 rounded ${getThemeClasses.input}`}
              />
              <input
                type="password"
                name="password"
                placeholder="Contraseña"
                value={newUserData.password}
                onChange={handleCreateFormChange}
                required
                className={`w-full p-2 rounded ${getThemeClasses.input}`}
              />
              <select
                name="role_id"
                value={newUserData.role_id}
                onChange={handleCreateFormChange}
                className={`w-full p-2 rounded ${getThemeClasses.select}`}
              >
                <option value="1">Administrador</option>
                <option value="2">Profesor</option>
                <option value="3">Gerente</option>
                <option value="4">Usuario</option>
              </select>

              <select
                name="class_group_id"
                value={newUserData.class_group_id || ''}
                onChange={handleCreateFormChange}
                className={`w-full p-2 rounded ${getThemeClasses.select}`}
              >
                <option value="">Sin grupo</option>
                {Array.isArray(groups) &&
                  groups.map((group: ClassGroup) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
              <button
                type="submit"
                className={`w-full font-bold py-2 rounded transition ${getThemeClasses.buttonPrimary}`}
              >
                Crear Usuario
              </button>
            </form>
          )}

          {loadingUsers ? (
            <p className={getThemeClasses.textMuted}>Cargando usuarios...</p>
          ) : errorUsers ? (
            <p className="text-red-500">{errorUsers}</p>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className={`w-full border-collapse ${theme === 'light' ? 'text-gray-800 bg-white' : 'text-white bg-gray-800'}`}>
                <thead>
                  <tr className={getThemeClasses.tableHeader}>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Nombre</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[25%]`}>Email</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Rol</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Grupo de Clase</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Nueva Contraseña</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(filteredUsers) &&
                    filteredUsers.map((user) =>
                      editUserId === user.id ? (
                        <tr key={user.id} className={theme === 'light' ? 'bg-gray-100' : 'bg-gray-600'}>
                          <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                            <input
                              type="text"
                              name="name"
                              value={editFormData.name}
                              onChange={handleEditFormChange}
                              className={`w-full p-1 rounded ${
                                theme === 'light'
                                  ? 'bg-white border border-gray-300 text-gray-800'
                                  : 'bg-gray-700 border border-gray-500 text-white'
                              }`}
                            />
                          </td>
                          <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                            <input
                              type="email"
                              name="email"
                              value={editFormData.email}
                              onChange={handleEditFormChange}
                              className={`w-full p-1 rounded ${
                                theme === 'light'
                                  ? 'bg-white border border-gray-300 text-gray-800'
                                  : 'bg-gray-700 border border-gray-500 text-white'
                              }`}
                            />
                          </td>
                          <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                            <select
                              name="role_id"
                              value={editFormData.role_id}
                              onChange={handleEditFormChange}
                              className={`w-full p-2 rounded ${
                                theme === 'light'
                                  ? 'bg-white border border-gray-300 text-gray-800'
                                  : 'bg-gray-700 border border-gray-500 text-white'
                              }`}
                            >
                              <option value="1">Administrador</option>
                              <option value="2">Profesor</option>
                              <option value="3">Gerente</option>
                              <option value="4">Usuario</option>
                            </select>
                          </td>
                          <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                            <select
                              name="class_group_id"
                              value={editFormData.class_group_id || ''}
                              onChange={handleEditFormChange}
                              className={`w-full p-2 rounded ${
                                theme === 'light'
                                  ? 'bg-white border border-gray-300 text-gray-800'
                                  : 'bg-gray-700 border border-gray-600 text-white'
                              }`}
                            >
                              <option value="">Sin grupo</option>
                              {Array.isArray(groups) &&
                                groups.map((group: ClassGroup) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                            <input
                              type="password"
                              name="password"
                              placeholder="Nueva contraseña (opcional)"
                              value={editFormData.password}
                              onChange={handleEditFormChange}
                              className={`w-full p-1 rounded ${
                                theme === 'light'
                                  ? 'bg-white border border-gray-300 text-gray-800'
                                  : 'bg-gray-700 border border-gray-500 text-white'
                              }`}
                            />
                          </td>
                          <td className={`p-2 border ${getThemeClasses.tableCell} flex items-center justify-center space-x-1`}>
                            <button
                              type="button"
                              onClick={handleEditFormSubmit}
                              className="bg-lime-600 hover:bg-lime-700 p-1.5 rounded text-gray-900 font-semibold flex items-center justify-center"
                              title="Guardar"
                            >
                              <Save size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelClick}
                              className={`p-1.5 rounded flex items-center justify-center ${
                                theme === 'light'
                                  ? 'bg-gray-400 hover:bg-gray-500 text-gray-800'
                                  : 'bg-gray-500 hover:bg-gray-600 text-white'
                              }`}
                              title="Cancelar"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={user.id}
                          className={`${getThemeClasses.tableRowHover} cursor-pointer transition`}
                        >
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                            {user.name}
                          </td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                            {user.email}
                          </td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                            {user.role_id === 1
                              ? 'Administrador'
                              : user.role_id === 2
                                ? 'Profesor'
                                : user.role_id === 3
                                  ? 'Gerente'
                                  : 'Usuario'}
                          </td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                            {Array.isArray(groups) &&
                              groups.find((g: ClassGroup) => g.id === user.class_group_id)
                                ?.name || '—'}
                          </td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>—</td>
                          <td className={`p-3 border ${getThemeClasses.tableCell} flex items-center justify-center space-x-1`}>
                            <button
                              type="button"
                              onClick={() => handleEditClick(user)}
                              className="bg-yellow-500 hover:bg-yellow-600 p-1.5 rounded text-gray-900 font-semibold flex items-center justify-center"
                              title="Editar"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              className={`p-1.5 rounded text-white font-semibold flex items-center justify-center ${getThemeClasses.buttonDanger}`}
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Sección de Publicaciones */}
      {panelActiveTab === 'posts' && (
        <>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClasses.textAccent}`}>Publicaciones</h2>
          {loadingPosts ? (
            <p className={getThemeClasses.textMuted}>Cargando posts...</p>
          ) : Array.isArray(posts) && posts.length === 0 ? (
            <p className={getThemeClasses.textMuted}>No hay publicaciones para mostrar.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {Array.isArray(posts) && posts.map((post) => (
                <div key={post.id} className={`p-6 rounded-lg shadow-md border ${getThemeClasses.card}`}>
                  {editPostId === post.id ? (
                    <form onSubmit={handleEditPostSubmit} className="space-y-4">
                      <input
                        type="text"
                        name="title"
                        value={editPostData.title}
                        onChange={handleEditPostChange}
                        className={`w-full p-2 rounded ${getThemeClasses.input}`}
                        placeholder="Título del post"
                        required
                      />
                      <textarea
                        name="content"
                        value={editPostData.content}
                        onChange={handleEditPostChange}
                        className={`w-full p-2 rounded ${getThemeClasses.input} h-32`}
                        placeholder="Contenido del post"
                        required
                      ></textarea>

                      {Array.isArray(editingPostMedia) && editingPostMedia.length > 0 && (
                        <div className={`mt-4 border p-3 rounded-md ${
                          theme === 'light' ? 'border-gray-300' : 'border-gray-700'
                        }`}>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                          }`}>
                            Medios existentes:
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {editingPostMedia.map((mediaItem, index) => (
                              <div key={index} className={`relative group w-24 h-24 object-cover rounded-md overflow-hidden flex items-center justify-center ${
                                theme === 'light' ? 'bg-gray-100' : 'bg-gray-700'
                              }`}>
                                {mediaItem.type.startsWith('image/') ? (
                                  <img
                                    src={`${API_BASE_URL.replace('/api', '')}${mediaItem.url.startsWith('/') ? mediaItem.url : '/' + mediaItem.url}`}
                                    alt={`Existente ${index}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : mediaItem.type.startsWith('video/') ? (
                                  <video className="w-full h-full object-cover">
                                    <source src={`${API_BASE_URL.replace('/api', '')}${mediaItem.url.startsWith('/') ? mediaItem.url : '/' + mediaItem.url}`} type="video/mp4" />
                                    Tu navegador no soporta el video.
                                  </video>
                                ) : (
                                  <span className={`text-xs ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Tipo no soportado
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExistingMediaToDelete(prev => [...prev, mediaItem.url]);
                                    setEditingPostMedia(prev => prev.filter(item => item.url !== mediaItem.url));
                                  }}
                                  className="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-1 rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar este medio"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col space-y-2">
                        <label htmlFor="newMediaFiles" className={`block text-sm font-medium ${
                          theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                        }`}>
                          Subir nuevas imágenes/videos:
                        </label>
                        <input
                          type="file"
                          id="newMediaFiles"
                          name="media"
                          multiple
                          onChange={handleNewMediaFilesChange}
                          className={`w-full p-2 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-300 text-gray-800 file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100'
                              : 'bg-gray-700 border border-gray-600 text-white file:bg-lime-500 file:text-gray-900 hover:file:bg-lime-400'
                          } file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold`}
                        />
                        {newMediaFiles.length > 0 && (
                          <p className={`text-sm ${getThemeClasses.textMuted}`}>
                            Archivos seleccionados: {newMediaFiles.map(f => f.name).join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-2">
                        <button
                          type="submit"
                          className={`px-4 py-2 rounded font-semibold ${getThemeClasses.buttonPrimary}`}
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelPostEdit}
                          className={`px-4 py-2 rounded ${
                            theme === 'light'
                              ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                              : 'bg-gray-500 hover:bg-gray-600 text-white'
                          }`}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p className={`text-sm mb-1 ${getThemeClasses.textMuted}`}>
                        Por: <span className={`font-semibold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                          {post.authorName || 'Desconocido'}
                        </span>{' '}
                        • {post.createdAt}
                      </p>
                      <h3 className={`text-2xl font-bold mb-2 ${getThemeClasses.textAccent}`}>{post.title}</h3>
                      <p className={`mb-4 ${theme === 'light' ? 'text-gray-700' : 'text-gray-300'}`}>{post.content}</p>

                      {Array.isArray(post.media) && post.media.length > 0 && (
                        <div className={`relative mb-4 rounded-md overflow-hidden ${
                          theme === 'light' ? 'bg-gray-100' : 'bg-gray-700'
                        }`}>
                          {post.media[post.currentMediaIndex || 0]?.type?.startsWith('image') ? (
                            <img
                              src={`${API_BASE_URL.replace('/api', '')}${post.media[post.currentMediaIndex || 0].url.startsWith('/') ? post.media[post.currentMediaIndex || 0].url : '/' + post.media[post.currentMediaIndex || 0].url}`}
                              alt={`Medio de publicación ${post.id}-${post.currentMediaIndex}`}
                              className="w-full h-64 object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                              onClick={() => setViewerMediaInfo({ mediaArray: post.media, initialIndex: post.currentMediaIndex || 0 })}
                            />
                          ) : post.media[post.currentMediaIndex || 0]?.type?.startsWith('video') ? (
                            <video
                              controls
                              src={`${API_BASE_URL.replace('/api', '')}${post.media[post.currentMediaIndex || 0].url.startsWith('/') ? post.media[post.currentMediaIndex || 0].url : '/' + post.media[post.currentMediaIndex || 0].url}`}
                              className="w-full h-64 object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                              onClick={() => setViewerMediaInfo({ mediaArray: post.media, initialIndex: post.currentMediaIndex || 0 })}
                            >
                              Tu navegador no soporta el video.
                            </video>
                          ) : (
                            <div className={`w-full h-64 flex items-center justify-center ${getThemeClasses.textMuted}`}>
                              No hay vista previa disponible para este tipo de medio.
                            </div>
                          )}

                          {post.media.length > 1 && (
                            <>
                              <button
                                onClick={() => handleNextMediaInPost(post.id)}
                                disabled={(post.currentMediaIndex || 0) === post.media.length - 1}
                                className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition ${
                                  theme === 'light'
                                    ? 'bg-gray-800 bg-opacity-70 text-white'
                                    : 'bg-gray-900 bg-opacity-70 text-white'
                                }`}
                                aria-label="Medio anterior"
                              >
                                &#10094;
                              </button>
                              <button
                                onClick={() => handleNextMediaInPost(post.id)}
                                disabled={(post.currentMediaIndex || 0) === post.media.length - 1}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition ${
                                  theme === 'light'
                                    ? 'bg-gray-800 bg-opacity-70 text-white'
                                    : 'bg-gray-900 bg-opacity-70 text-white'
                                }`}
                                aria-label="Medio siguiente"
                              >
                                &#10095;
                              </button>
                              <span className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-1 rounded-full ${
                                theme === 'light'
                                  ? 'bg-gray-800 bg-opacity-70 text-white'
                                  : 'bg-gray-900 bg-opacity-70 text-white'
                              }`}>
                                {(post.currentMediaIndex || 0) + 1} / {post.media.length}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="flex space-x-2 mt-4">
                        <button
                          type="button"
                          onClick={() => handleEditPostClick(post)}
                          className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-gray-900 font-semibold transition"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className={`px-3 py-1 rounded font-semibold transition ${getThemeClasses.buttonDanger}`}
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sección de Informes de Asistencia */}
      {panelActiveTab === 'attendance' && (
        <div className={`p-6 rounded-md shadow-lg border ${getThemeClasses.card}`}>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClasses.textAccent}`}>Informes de Asistencia</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div>
              <label htmlFor="attendanceDate" className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Fecha (Opcional):
              </label>
              <input
                type="date"
                id="attendanceDate"
                value={attendanceDateFilter}
                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                className={`w-full p-2 rounded ${getThemeClasses.input}`}
              />
            </div>
            <div>
              <label htmlFor="attendanceGroup" className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Grupo de Clase (Opcional):
              </label>
              <select
                id="attendanceGroup"
                value={attendanceGroupFilter}
                onChange={(e) => setAttendanceGroupFilter(e.target.value)}
                className={`w-full p-2 rounded ${getThemeClasses.select}`}
              >
                <option value="">Todos los grupos</option>
                {Array.isArray(groups) && groups.map((group: ClassGroup) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchAttendanceReports}
              disabled={loadingAttendance}
              className={`font-bold py-2 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${getThemeClasses.buttonPrimary}`}
            >
              {loadingAttendance ? 'Generando...' : 'Generar Informe en Pantalla'}
            </button>
          </div>

          {attendanceSummary && (
            <div className={`p-4 rounded-md shadow-inner mb-6 text-center md:text-left ${
              theme === 'light' ? 'bg-gray-100' : 'bg-gray-700'
            }`}>
              <h3 className={`text-xl font-semibold mb-3 ${getThemeClasses.textAccent}`}>Resumen del Informe</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <p className={getThemeClasses.textMuted}>
                  <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    Alumnos en el Reporte:
                  </span> {attendanceSummary.totalStudentsInReport}
                </p>
                <p className={getThemeClasses.textMuted}>
                  <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    Total Asistencia (Presentes + Justificados):
                  </span> {attendanceSummary.totalAssisted}
                </p>
                <p className={getThemeClasses.textMuted}>
                  <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    Presentes:
                  </span> {attendanceSummary.totalPresent}
                </p>
                <p className={getThemeClasses.textMuted}>
                  <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    Ausentes:
                  </span> {attendanceSummary.totalAbsent}
                </p>
                <p className={getThemeClasses.textMuted}>
                  <span className={`font-bold ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    Justificados:
                  </span> {attendanceSummary.totalJustified}
                </p>
                <p className={`text-lg font-bold ${getThemeClasses.textAccent}`}>
                  <span className={getThemeClasses.textAccent}>Porcentaje de Asistencia:</span> {attendanceSummary.attendancePercentage}%
                </p>
              </div>
            </div>
          )}

          {Object.keys(groupedAttendance).length > 0 && (
            <button
              onClick={handleDownloadPdf}
              className={`mb-6 font-bold px-4 py-2 rounded-md transition ${getThemeClasses.buttonSecondary}`}
            >
              Descargar Reporte PDF
            </button>
          )}

          {loadingAttendance ? (
            <p className={getThemeClasses.textMuted}>Cargando registros de asistencia...</p>
          ) : Object.keys(groupedAttendance).length === 0 ? (
            <p className={getThemeClasses.textMuted}>No hay registros de asistencia para los filtros seleccionados.</p>
          ) : (
            <div className={`rounded-md overflow-hidden p-3 ${
              theme === 'light' ? 'bg-gray-50' : 'bg-gray-900'
            }`}>
              {Object.keys(groupedAttendance).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).map((dateKey, dateIndex) => (
                <div key={dateKey} className="mb-8">
                  <div className={`text-center py-3 rounded-t-md mb-2 ${
                    theme === 'light' ? 'bg-gray-200 text-lime-700' : 'bg-gray-700 text-lime-400'
                  }`}>
                    <h3 className="text-xl font-bold">{dateKey}</h3>
                  </div>
                  <table className={`w-full border-collapse ${theme === 'light' ? 'text-gray-800' : 'text-white'}`}>
                    <thead>
                      <tr className={getThemeClasses.tableHeader}>
                        <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>N°</th>
                        <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Alumno</th>
                        <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Grupo</th>
                        <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Fecha</th>
                        <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedAttendance[dateKey].map((record, index) => (
                        <tr key={record.id} className={`${getThemeClasses.tableRowHover} transition`}>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>{index + 1}</td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>{record.student_name} {record.student_last_name || ''}</td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>{record.class_group_name || 'Sin grupo'}</td>
                          <td className={`p-3 border ${getThemeClasses.tableCell}`}>{new Date(record.date).toLocaleDateString()}</td>
                          <td className={`p-3 border ${getThemeClasses.tableCell} font-semibold ${
                            record.status === 'present' ? 'text-green-500' :
                            record.status === 'absent' ? 'text-red-500' :
                            'text-yellow-500'
                          }`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dateIndex < Object.keys(groupedAttendance).length - 1 && (
                    <hr className={`my-6 border-t-2 ${
                      theme === 'light' ? 'border-gray-300' : 'border-gray-600'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sección de Listado de Alumnos */}
      {panelActiveTab === 'list' && (
        <>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClasses.textAccent}`}>Listado de Alumnos</h2>

          <div className={`flex flex-wrap items-end gap-4 mb-6 p-4 rounded-lg shadow-inner ${
            theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
          }`}>
            <div className="flex-grow">
              <label htmlFor="alumnoSearch" className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Buscar (Nombre, Apellido, Cédula, Representante):
              </label>
              <input
                type="text"
                id="alumnoSearch"
                value={alumnoSearchTerm}
                onChange={(e) => setAlumnoSearchTerm(e.target.value)}
                placeholder="Ej: Juan Pérez, 1234567890, María..."
                className={`w-full p-2 rounded ${getThemeClasses.input}`}
              />
            </div>
            <div>
              <label htmlFor="alumnoSearchMonth" className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Mes de Nacimiento:
              </label>
              <select
                id="alumnoSearchMonth"
                value={alumnoSearchMonth}
                onChange={(e) => setAlumnoSearchMonth(e.target.value)}
                className={`w-full p-2 rounded ${getThemeClasses.select}`}
              >
                <option value="">Todos los meses</option>
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>
            <div>
              <label htmlFor="studentGroupFilter" className={`block text-sm font-medium mb-1 ${
                theme === 'light' ? 'text-gray-700' : 'text-gray-300'
              }`}>
                Filtrar por Grupo:
              </label>
              <select
                id="studentGroupFilter"
                value={studentGroupFilter}
                onChange={handleGroupFilterChange}
                className={`w-full p-2 rounded ${getThemeClasses.select}`}
              >
                <option value="">Todos los grupos</option>
                {Array.isArray(groups) && groups.map((group: ClassGroup) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchStudents}
              className={`font-bold py-2 px-4 rounded hover:bg-lime-600 transition ${getThemeClasses.buttonPrimary}`}
            >
              Buscar Alumnos
            </button>
            <button
              onClick={handleDownloadAlumnosPdf}
              className={`font-bold py-2 px-4 rounded hover:bg-blue-700 transition ${getThemeClasses.buttonSecondary}`}
            >
              Descargar PDF
            </button>
          </div>

          {loadingStudents ? (
            <p className={getThemeClasses.textMuted}>Cargando alumnos...</p>
          ) : errorStudents ? (
            <p className="text-red-500">{errorStudents}</p>
          ) : Array.isArray(students) && students.length === 0 ? (
            <p className={getThemeClasses.textMuted}>No se encontraron alumnos para los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className={`w-full border-collapse ${
                theme === 'light' ? 'text-gray-800 bg-white' : 'text-white bg-gray-800'
              }`}>
                <thead>
                  <tr className={getThemeClasses.tableHeader}>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[3%]`}>#</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[10%]`}>Nombre</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[10%]`}>Apellido</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[8%]`}>Cédula</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[9%]`}>Fecha Nac.</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[5%]`}>Edad</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[12%]`}>Representante</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[9%]`}>Tel. Rep.</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[15%]`}>Dirección</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[8%]`}>Grupo</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[5%]`}>Foto</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left w-[8%]`}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(students) && students.map((student, index) => (
                    editStudentId === student.id ? (
                      <tr key={student.id} className={theme === 'light' ? 'bg-gray-100' : 'bg-gray-700'}>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{index + 1}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="name" value={editStudentData.name} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="last_name" value={editStudentData.last_name} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="cedula" value={editStudentData.cedula} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input type="date" name="birthdate" value={editStudentData.birthdate?.split('T')[0] || ''} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{calculateAge(student.birthdate)}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="guardian_name" value={editStudentData.guardian_name} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="guardian_phone" value={editStudentData.guardian_phone} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="direccion" value={editStudentData.direccion} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <select name="class_group_id" value={editStudentData.class_group_id || ''} onChange={handleEditStudentChange} className={`w-full p-1 rounded ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`}>
                            <option value="" disabled>Seleccione grupo</option>
                            {Array.isArray(groups) && groups.map((group: ClassGroup) => (
                              <option key={group.id} value={group.id}>{group.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          <input name="photo_url" value={editStudentData.photo_url || ''} onChange={handleEditStudentChange} placeholder="URL de la foto" className={`w-full p-1 rounded overflow-x-auto ${
                            theme === 'light'
                              ? 'bg-white border border-gray-400 text-gray-800'
                              : 'bg-gray-600 border border-gray-500 text-white'
                          }`} />
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell} space-x-2`}>
                          <button onClick={handleEditStudentSubmit} className="bg-green-600 hover:bg-green-700 p-2 rounded text-white" title="Guardar">
                            <Save size={16} />
                          </button>
                          <button onClick={handleCancelStudentEdit} className={`p-2 rounded ${
                            theme === 'light'
                              ? 'bg-gray-400 hover:bg-gray-500 text-gray-800'
                              : 'bg-gray-500 hover:bg-gray-600 text-white'
                          }`} title="Cancelar">
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={student.id} className={`${getThemeClasses.tableRowHover} cursor-pointer transition`}>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{index + 1}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.name}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.last_name}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.cedula}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.birthdate?.split('T')[0]}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{calculateAge(student.birthdate)}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.guardian_name}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.guardian_phone}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>{student.direccion}</td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          {Array.isArray(groups) && groups.find((g: ClassGroup) => g.id === student.class_group_id)?.name || 'Desconocido'}
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell}`}>
                          {student.photo_url ? (
                            <img
                              src={`${API_BASE_URL.replace('/api', '')}${student.photo_url.startsWith('/') ? student.photo_url : '/' + student.photo_url}`}
                              alt={student.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs ${
                              theme === 'light' ? 'bg-gray-200' : 'bg-gray-600'
                            }`}>
                              {(student.name || '').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className={`p-2 border ${getThemeClasses.tableCell} space-x-2`}>
                          <button onClick={() => handleEditStudentClick(student)} className="bg-blue-600 hover:bg-blue-700 p-2 rounded text-white" title="Editar">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDeleteStudent(student.id)} className={`p-2 rounded text-white ${getThemeClasses.buttonDanger}`} title="Eliminar">
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

      {/* Sección de Usuarios Conectados */}
      {panelActiveTab === 'connected' && (
        <div className={`p-6 rounded-md shadow-lg border ${getThemeClasses.card}`}>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClasses.textAccent}`}>Usuarios Conectados</h2>
          <p className={`mb-4 ${getThemeClasses.textMuted}`}>
            Esta lista se actualiza en tiempo real a medida que los usuarios se conectan o desconectan.
          </p>

          {loadingConnectedUsers ? (
            <p className={getThemeClasses.textMuted}>Cargando usuarios conectados...</p>
          ) : Array.isArray(connectedUsers) && connectedUsers.length === 0 ? (
            <p className={getThemeClasses.textMuted}>No hay usuarios conectados en este momento.</p>
          ) : (
            <div className="overflow-x-auto rounded-md">
              <table className={`w-full border-collapse ${
                theme === 'light' ? 'text-gray-800 bg-gray-50' : 'text-white bg-gray-900'
              }`}>
                <thead>
                  <tr className={getThemeClasses.tableHeader}>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Nombre</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Email</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Última Actividad</th>
                    <th className={`p-3 border ${getThemeClasses.tableCell} text-left`}>Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(connectedUsers) && connectedUsers.map((user: User) => (
                    <tr key={user.id} className={`${getThemeClasses.tableRowHover} transition`}>
                      <td className={`p-3 border ${getThemeClasses.tableCell}`}>{user.name}</td>
                      <td className={`p-3 border ${getThemeClasses.tableCell}`}>{user.email}</td>
                      <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                        {user.last_seen ? new Date(user.last_seen).toLocaleString('es-EC') : 'N/A'}
                      </td>
                      <td className={`p-3 border ${getThemeClasses.tableCell}`}>
                        {user.photo_url ? (
                          <img
                            src={user.photo_url.startsWith('http') ? user.photo_url : `${SOCKET_SERVER_URL}${user.photo_url}`}
                            alt={user.name}
                            className="w-10 h-10 object-cover rounded-full"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs ${
                            theme === 'light' ? 'bg-gray-300' : 'bg-gray-600'
                          }`}>
                            {(user.name || '').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* NUEVA SECCIÓN: Registro de Actividad del Sistema */}
      {panelActiveTab === 'activity-log' && (
        <div className={`p-6 rounded-md shadow-lg border ${getThemeClasses.card}`}>
          <h2 className={`text-3xl font-bold mb-6 ${getThemeClasses.textAccent}`}>Registro de Actividad del Sistema</h2>
          <p className={`mb-4 ${getThemeClasses.textMuted}`}>
            Aquí se muestran todas las notificaciones de creación, actualización y eliminación de datos en la plataforma.
          </p>

          <div className="mb-4 flex justify-end">
            <button
              onClick={handleMarkAllSystemNotificationsAsRead}
              className={`font-bold py-2 px-4 rounded transition mr-2 ${getThemeClasses.buttonSecondary}`}
              disabled={systemNotifications.filter(n => !n.read_status).length === 0}
            >
              Marcar todas como leídas
            </button>
            <button
              onClick={fetchSystemNotifications}
              className={`font-bold py-2 px-4 rounded transition ${
                theme === 'light'
                  ? 'bg-gray-300 hover:bg-gray-400 text-gray-800'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              Actualizar lista
            </button>
          </div>

          {loadingSystemNotifications ? (
            <p className={getThemeClasses.textMuted}>Cargando actividades recientes...</p>
          ) : systemNotifications.length === 0 ? (
            <p className={getThemeClasses.textMuted}>No hay actividades recientes para mostrar.</p>
          ) : (
            <ul className="space-y-3">
              {systemNotifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`p-4 rounded-lg shadow-md border-l-4 flex justify-between items-center ${
                    notification.read_status
                      ? theme === 'light'
                        ? 'bg-gray-100 border-gray-400 text-gray-600'
                        : 'bg-gray-700 border-gray-500 text-gray-400'
                      : theme === 'light'
                        ? 'bg-blue-50 border-blue-400 text-gray-800'
                        : 'bg-gray-600 border-blue-400 text-white'
                  }`}
                >
                  <div>
                    <p className={`font-semibold text-lg ${notification.read_status ? 'line-through' : ''}`}>
                      {notification.content}
                    </p>
                    <span className="text-sm block mt-1">
                      {new Date(notification.created_at).toLocaleString('es-ES', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {!notification.read_status && (
                    <button
                      onClick={() => handleMarkSystemNotificationAsRead(notification.id)}
                      className="ml-4 p-2 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center"
                      title="Marcar como leída"
                    >
                      <Eye size={20} />
                    </button>
                  )}
                  {notification.read_status && (
                    <span className={`ml-4 p-2 rounded-full flex items-center justify-center ${
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    }`} title="Leída">
                      <EyeOff size={20} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ToastContainer theme={toastTheme} />
      <ConfirmationModal
        show={showConfirmModal}
        message={modalMessage}
        onConfirm={() => {
          if (confirmAction) {
            confirmAction();
          }
        }}
        onCancel={() => setShowConfirmModal(false)}
        theme={theme}
      />

      <MediaViewerModal
        postMediaArray={viewerMediaInfo?.mediaArray || []}
        initialMediaIndex={viewerMediaInfo?.initialIndex || 0}
        onClose={() => setViewerMediaInfo(null)}
        theme={theme}
      />
    </section>
  );
}