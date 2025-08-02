'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- CONFIGURACIÓN DE URLS ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '');

// Componente Modal de Confirmación
function ConfirmationModal({ show, message, onConfirm, onCancel }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 max-w-sm w-full">
                <p className="text-white text-lg mb-6 text-center">{message}</p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={onConfirm}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded transition"
                    >
                        Confirmar
                    </button>
                    <button
                        onClick={onCancel}
                        className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-5 rounded transition"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

// Componente Visor de Medios (Modal con Navegación y Swipe)
function MediaViewerModal({ postMediaArray, initialMediaIndex, onClose }) {
    if (!postMediaArray || postMediaArray.length === 0 || initialMediaIndex === undefined || initialMediaIndex < 0 || initialMediaIndex >= postMediaArray.length) {
        return null;
    }

    const [currentDisplayIndex, setCurrentDisplayIndex] = useState(initialMediaIndex);
    const touchStartX = useRef(0);

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
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
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

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX.current;
        const swipeThreshold = 50;

        if (deltaX > swipeThreshold) {
            handlePrev();
        } else if (deltaX < -swipeThreshold) {
            handleNext();
        }
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
                    {currentMedia?.type === 'image' ? (
                        <img src={mediaUrl} alt="Vista previa de imagen" className="max-w-full max-h-[80vh] object-contain mx-auto" />
                    ) : currentMedia?.type === 'video' ? (
                        <video controls src={mediaUrl} className="max-w-full max-h-[80vh] object-contain mx-auto">
                            Tu navegador no soporta el video.
                        </video>
                    ) : (
                        <p className="text-white">Tipo de medio no soportado.</p>
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
                        disabled={currentDisplayIndex === postMediaArray.length - 1}
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


export default function AdminPanel() {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('users');

    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [errorUsers, setErrorUsers] = useState('');
    const [editUserId, setEditUserId] = useState(null);
    const [editFormData, setEditFormData] = useState({ name: '', email: '', role_id: '3', password: '', class_group_id: '' });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newUserData, setNewUserData] = useState({ name: '', email: '', password: '', role_id: '3', class_group_id: '' });
    const [loggedInUserId, setLoggedInUserId] = useState(null);

    const [students, setStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [errorStudents, setErrorStudents] = useState('');
    const [studentGroupFilter, setStudentGroupFilter] = useState('');
    const [editStudentId, setEditStudentId] = useState(null);
    const [editStudentData, setEditStudentData] = useState({
        name: '',
        last_name: '',
        birthdate: '',
        cedula: '',
        guardian_name: '',
        guardian_phone: '',
        photo_url: '',
        class_group_id: '',
        direccion: '',
        email: '',
        gender: '',
        phone: '',
    });
    const [alumnoSearchTerm, setAlumnoSearchTerm] = useState('');
    const [alumnoSearchMonth, setAlumnoSearchMonth] = useState('');


    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [editPostId, setEditPostId] = useState(null);
    const [editPostData, setEditPostData] = useState({ title: '', content: '' });
    const [newMediaFiles, setNewMediaFiles] = useState([]);
    const [existingMediaToDelete, setExistingMediaToDelete] = useState([]);
    const [editingPostMedia, setEditingPostMedia] = useState([]);
    const [viewerMediaInfo, setViewerMediaInfo] = useState(null);

    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceSummary, setAttendanceSummary] = useState(null);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [attendanceDateFilter, setAttendanceDateFilter] = useState('');
    const [attendanceGroupFilter, setAttendanceGroupFilter] = useState('');
    const [groupedAttendance, setGroupedAttendance] = useState({}); // Nuevo estado para asistencia agrupada

    const [connectedUsers, setConnectedUsers] = useState([]);
    const [connectedUsersCount, setConnectedUsersCount] = useState(0);
    const [loadingConnectedUsers, setLoadingConnectedUsers] = useState(false);

    const [groups, setGroups] = useState([]);

    const socketRef = useRef(null);

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setLoggedInUserId(localStorage.getItem('userId'));
        }
    }, []);

    // Función para calcular la edad a partir de una fecha de nacimiento
    const calculateAge = (birthdateString) => {
        if (!birthdateString) return 'N/A';
        const birthdate = new Date(birthdateString);
        const today = new Date();
        let age = today.getFullYear() - birthdate.getFullYear();
        const monthDifference = today.getMonth() - birthdate.getMonth();

        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthdate.getDate())) {
            age--;
        }
        return age >= 0 ? age : 'N/A'; // Evitar edades negativas si la fecha es en el futuro
    };

    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        setErrorUsers('');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
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

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStudents(res.data);
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

            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `listado_alumnos_${new Date().toISOString().slice(0,10)}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Listado de alumnos en PDF descargado correctamente.');
        } catch (err) {
            console.error('Error descargando listado de alumnos PDF:', err);
            toast.error(`Error descargando PDF: ${err.response?.data?.message || err.message}`);
        }
    };


    const fetchGroups = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/class-groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGroups(res.data);
        } catch (err) {
            console.error('Error cargando grupos', err);
            setGroups([]);
        }
    }, []);

    const fetchPosts = useCallback(async () => {
        setLoadingPosts(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/posts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const formattedPosts = res.data.map(post => ({
                ...post,
                author_name: post.user_name,
                media: post.media_urls || [],
                currentMediaIndex: 0,
            }));
            setPosts(formattedPosts);
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
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${currentToken}` },
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', `reporte_asistencia_${attendanceDateFilter || 'todos'}${attendanceGroupFilter ? `_grupo_${attendanceGroupFilter}` : ''}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(downloadUrl);

            toast.success('Reporte PDF descargado correctamente.');
        } catch (err) {
            console.error('Error descargando reporte PDF:', err);
            toast.error(`Error descargando reporte PDF: ${err.response?.data?.error || err.message}`);
        }
    };

    const fetchAttendanceReports = useCallback(async () => {
        setLoadingAttendance(true);
        setAttendanceRecords([]);
        setAttendanceSummary(null);
        setGroupedAttendance({}); // Limpiar datos agrupados al inicio de una nueva búsqueda

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
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${currentToken}` }
            });

            setAttendanceSummary(res.data.summary);

            const records = res.data.records || [];
            setAttendanceRecords(records); // Mantener la lista plana si es necesaria para otras lógicas

            // Agrupar registros por fecha si no se ha aplicado un filtro de fecha específico
            if (!attendanceDateFilter) {
                const newGroupedAttendance = records.reduce((acc, record) => {
                    // Formatear la fecha para usarla como clave de agrupación
                    const dateKey = new Date(record.date).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                    if (!acc[dateKey]) {
                        acc[dateKey] = [];
                    }
                    acc[dateKey].push(record);
                    return acc;
                }, {});

                // Ordenar registros dentro de cada grupo por nombre de alumno
                for (const dateKey in newGroupedAttendance) {
                    newGroupedAttendance[dateKey].sort((a, b) => {
                        const nameA = (a.student_name + ' ' + (a.student_last_name || '')).trim().toLowerCase();
                        const nameB = (b.student_name + ' ' + (b.student_last_name || '')).trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                    });
                }
                setGroupedAttendance(newGroupedAttendance);
            } else {
                // Si hay un filtro de fecha, no agrupar, solo mostrar los registros de ese día
                setGroupedAttendance({
                    [new Date(attendanceDateFilter).toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })]: records.sort((a, b) => {
                        const nameA = (a.student_name + ' ' + (a.student_last_name || '')).trim().toLowerCase();
                        const nameB = (b.student_name + ' ' + (b.student_last_name || '')).trim().toLowerCase();
                        return nameA.localeCompare(nameB);
                    })
                });
            }

        } catch (err) {
            console.error('Error cargando informes de asistencia:', err);
            toast.error(`Error cargando informes de asistencia: ${err.response?.data?.error || err.message}`);
            setAttendanceRecords([]);
            setAttendanceSummary(null);
            setGroupedAttendance({});
        } finally {
            setLoadingAttendance(false);
        }
    }, [attendanceDateFilter, attendanceGroupFilter]);

    const fetchConnectedUsersInitial = useCallback(async () => {
        setLoadingConnectedUsers(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE_URL}/users/connected`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConnectedUsers(res.data);
            setConnectedUsersCount(res.data.length);
        } catch (err) {
            console.error('Error al obtener usuarios conectados inicialmente por HTTP:', err);
            setConnectedUsers([]);
            setConnectedUsersCount(0);
        } finally {
            setLoadingConnectedUsers(false);
        }
    }, []);

    const sendHeartbeat = useCallback(async () => {
        const token = localStorage.getItem('token');
        const currentUserId = localStorage.getItem('userId');
        if (token && currentUserId) {
            try {
                await axios.put(`${API_BASE_URL}/users/me/last-seen`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } catch (err) {
                console.error('Error enviando heartbeat HTTP:', err);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (!socketRef.current) {
            socketRef.current = io(SOCKET_SERVER_URL, {
                withCredentials: true,
            });
        }

        socketRef.current.on('connect', () => {
            console.log('🎉 Conectado al servidor Socket.IO:', socketRef.current.id);
            const userId = localStorage.getItem('userId');
            if (userId) {
                socketRef.current.emit('set-user-online', userId);
            }
        });

        socketRef.current.on('online-users-updated', (users) => {
            console.log('🔄 Lista de usuarios online actualizada recibida:', users.length);
            setConnectedUsers(users);
            setConnectedUsersCount(users.length);
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔌 Desconectado del servidor Socket.IO');
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('❌ Error de conexión Socket.IO:', err.message);
            fetchConnectedUsersInitial();
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                console.log('Socket.IO desconectado al desmontar el componente.');
            }
        };
    }, [loggedInUserId, fetchConnectedUsersInitial]);

    useEffect(() => {
        sendHeartbeat();
        fetchConnectedUsersInitial();

        const heartbeatIntervalId = setInterval(sendHeartbeat, 60 * 1000);
        const pollingIntervalId = setInterval(fetchConnectedUsersInitial, 30 * 1000);

        return () => {
            clearInterval(heartbeatIntervalId);
            clearInterval(pollingIntervalId);
        };
    }, [sendHeartbeat, fetchConnectedUsersInitial]);

    useEffect(() => {
        switch (activeTab) {
            case 'users':
                fetchUsers();
                fetchGroups();
                break;
            case 'posts':
                fetchPosts();
                break;
            case 'attendance':
                fetchGroups();
                break;
            case 'list':
                fetchStudents();
                fetchGroups();
                break;
            case 'connected':
                fetchConnectedUsersInitial();
                break;
            default:
                break;
        }
    }, [activeTab, fetchUsers, fetchPosts, fetchGroups, fetchStudents, fetchAttendanceReports, fetchConnectedUsersInitial]);


    const handleEditClick = (user) => {
        setEditUserId(user.id);
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
        setEditFormData({ name: '', email: '', role_id: '3', password: '', class_group_id: '' });
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleEditFormSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        if (!editUserId) {
            toast.error('Error: ID de usuario para editar no encontrado.');
            return;
        }

        try {
            const payload = {
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
            setEditFormData({ name: '', email: '', role_id: '3', password: '', class_group_id: '' });
            toast.success('Usuario actualizado correctamente');
        } catch (error) {
            console.error('Error actualizando usuario:', error);
            toast.error(`Error actualizando usuario: ${error.response?.data?.message || error.message}`);
        }
    };

    const handleDeleteUser = (userId) => {
        setModalMessage('¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.');
        setConfirmAction(() => async () => {
            const token = localStorage.getItem('token');
            try {
                await axios.delete(`${API_BASE_URL}/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                await fetchUsers();
                toast.success('Usuario eliminado correctamente');
            } catch (error) {
                console.error('Error eliminando usuario:', error);
                toast.error(`Error eliminando usuario: ${error.response?.data?.message || error.message}`);
            } finally {
                setShowConfirmModal(false);
            }
        });
        setShowConfirmModal(true);
    };


    const handleCreateFormChange = (e) => {
        const { name, value } = e.target;
        setNewUserData((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateUserSubmit = async (e) => {
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
                } catch (assignError) {
                    console.error('Error al asignar el profesor al grupo de clase:', assignError.response?.data || assignError.message);
                    toast.error(`Error al asignar el profesor al grupo: ${assignError.response?.data?.error || assignError.message}`);
                }
            }

            await fetchUsers();
            setNewUserData({ name: '', email: '', password: '', role_id: '3', class_group_id: '' });
            setShowCreateForm(false);
            toast.success('Usuario creado correctamente');
        } catch (error) {
            console.error('Error creando usuario:', error);
            toast.error(`Error creando usuario: ${error.response?.data?.message || error.message}`);
        }
    };

    const handleGroupFilterChange = (e) => {
        setStudentGroupFilter(e.target.value);
    };

    const handleEditStudentClick = (student) => {
        setEditStudentId(student.id);
        setEditStudentData({
            name: student.name || '', // Asegurar que no sea null
            last_name: student.last_name || '',
            email: student.email || '',
            gender: student.gender || '',
            phone: student.phone || '',
            birthdate: student.birthdate ? student.birthdate.split('T')[0] : '',
            cedula: student.cedula || '', // Asegurar que no sea null
            guardian_name: student.guardian_name || '', // Asegurar que no sea null
            guardian_phone: student.guardian_phone || '', // Asegurar que no sea null
            photo_url: student.photo_url || '',
            class_group_id: student.class_group_id || '',
            direccion: student.direccion || '',
        });
    };

    const handleCancelStudentEdit = () => {
        setEditStudentId(null);
        setEditStudentData({
            name: '',
            last_name: '',
            email: '',
            birthdate: '',
            gender: '',
            phone: '',
            cedula: '',
            guardian_name: '',
            guardian_phone: '',
            photo_url: '',
            class_group_id: '',
            direccion: '',
        });
    };

    const handleEditStudentChange = (e) => {
        const { name, value } = e.target;
        setEditStudentData(prev => ({ ...prev, [name]: value }));
    };

    const handleEditStudentSubmit = async (e) => {
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
        } catch (error) {
            console.error('Error al actualizar alumno:', error.response?.data || error.message);
            toast.error(`Error al actualizar alumno: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleDeleteStudent = (studentId) => {
        setModalMessage('¿Seguro que deseas eliminar este alumno? Esta acción no se puede deshacer.');
        setConfirmAction(() => async () => {
            const token = localStorage.getItem('token');
            try {
                await axios.delete(`${API_BASE_URL}/alumnos/${studentId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                await fetchStudents();
                toast.success('Alumno eliminado correctamente');
            } catch (error) {
                console.error('Error al eliminar alumno:', error);
                toast.error(`Error al eliminar alumno: ${error.response?.data?.message || error.message}`);
            } finally {
                setShowConfirmModal(false);
            }
        });
        setShowConfirmModal(true);
    };

    const handleDeletePost = (postId) => {
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
            } catch (error) {
                console.error('Error eliminando post:', error);
                toast.error(`Error eliminando post: ${error.response?.data?.message || error.message}`);
            } finally {
                setShowConfirmModal(false);
            }
        });
        setShowConfirmModal(true);
    };

    const handleEditPostClick = (post) => {
        setEditPostId(post.id);
        setEditPostData({
            title: post.title,
            content: post.content,
        });
        setNewMediaFiles([]);
        setExistingMediaToDelete([]);
        setEditingPostMedia(post.media_urls || []);
    };

    const handleCancelPostEdit = () => {
        setEditPostId(null);
        setEditPostData({ title: '', content: '' });
        setNewMediaFiles([]);
        setExistingMediaToDelete([]);
        setEditingPostMedia([]);
    };

    const handleEditPostChange = (e) => {
        const { name, value } = e.target;
        setEditPostData((prev) => ({ ...prev, [name]: value }));
    };

    const handleNewMediaFilesChange = (e) => {
        setNewMediaFiles(Array.from(e.target.files));
    };

    const handleEditPostSubmit = async (e) => {
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
        } catch (error) {
            console.error('Error actualizando publicación:', error.response?.data || error.message);
            toast.error(`Error actualizando publicación: ${error.response?.data?.error || error.message}`);
        }
    };

    const handleNextMediaInPost = (postId) => {
        setPosts(prevPosts =>
            prevPosts.map(post => {
                if (post.id === postId && post.media && post.media.length > 0) {
                    return {
                        ...post,
                        currentMediaIndex: Math.min(post.currentMediaIndex + 1, post.media.length - 1)
                    };
                }
                return post;
            })
        );
    };

    const handlePrevMediaInPost = (postId) => {
        setPosts(prevPosts =>
            prevPosts.map(post => {
                if (post.id === postId && post.media && post.media.length > 0) {
                    return {
                        ...post,
                        currentMediaIndex: Math.max(post.currentMediaIndex - 1, 0)
                    };
                }
                return post;
            })
        );
    };


    return (
        <section className="min-h-screen bg-gray-900 text-white p-8 max-w-7xl mx-auto rounded-lg shadow-lg">
            <h1 className="text-4xl font-bold mb-8 text-lime-400">Panel de Administrador</h1>

            <div className="flex space-x-4 mb-8 overflow-x-auto">
                {['users', 'posts', 'attendance', 'list', 'connected'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 rounded-md font-semibold transition whitespace-nowrap ${
                            activeTab === tab ? 'bg-lime-400 text-gray-900' : 'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        {tab === 'connected' && connectedUsersCount > 0 && (
                            <span className="ml-2 px-2 py-1 bg-red-500 text-white rounded-full text-xs">
                                {connectedUsersCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {activeTab === 'users' && (
                <>
                    <h2 className="text-3xl font-bold mb-6 text-lime-400">Gestión de Usuarios</h2>
                    <button
                        onClick={() => setShowCreateForm((prev) => !prev)}
                        className="mb-6 bg-lime-400 text-gray-900 font-bold px-4 py-2 rounded-md hover:bg-lime-500 transition"
                    >
                        {showCreateForm ? 'Cancelar Creación' : 'Agregar Nuevo Usuario'}
                    </button>

                    {showCreateForm && (
                        <form
                            onSubmit={handleCreateUserSubmit}
                            className="mb-8 bg-gray-800 p-6 rounded-md shadow space-y-4 max-w-lg mx-auto md:mx-0"
                        >
                            <input
                                type="text"
                                name="name"
                                placeholder="Nombre"
                                value={newUserData.name}
                                onChange={handleCreateFormChange}
                                required
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            />
                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                value={newUserData.email}
                                onChange={handleCreateFormChange}
                                required
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            />
                            <input
                                type="password"
                                name="password"
                                placeholder="Contraseña"
                                value={newUserData.password}
                                onChange={handleCreateFormChange}
                                required
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            />
                            <select
                                name="role_id"
                                value={newUserData.role_id}
                                onChange={handleCreateFormChange}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            >
                                <option value="1">Administrador</option>
                                <option value="2">Profesor</option>
                                <option value="3">Usuario</option>
                            </select>

                            <select
                                name="class_group_id"
                                value={newUserData.class_group_id}
                                onChange={handleCreateFormChange}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            >
                                <option value="">Sin grupo</option>
                                {Array.isArray(groups) && groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                className="w-full bg-lime-400 hover:bg-lime-500 font-bold py-2 rounded transition text-gray-900"
                            >
                                Crear Usuario
                            </button>
                        </form>
                    )}

                    {loadingUsers ? (
                        <p className="text-gray-400">Cargando usuarios...</p>
                    ) : errorUsers ? (
                        <p className="text-red-500">{errorUsers}</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md">
                            <table className="w-full border-collapse text-white bg-gray-800">
                                <thead>
                                    <tr className="bg-gray-700 text-lime-400">
                                        <th className="p-3 border border-gray-600 text-left">Nombre</th><th className="p-3 border border-gray-600 text-left">Email</th><th className="p-3 border border-gray-600 text-left">Rol</th><th className="p-3 border border-gray-600 text-left">Grupo de Clase</th><th className="p-3 border border-gray-600 text-left">Nueva Contraseña</th><th className="p-3 border border-gray-600 text-left">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(users) && users.map((user) =>
                                    editUserId === user.id ? (
                                        <tr key={user.id} className="bg-gray-600">
                                            <td className="p-2 border border-gray-600">
                                                <input
                                                    type="text"
                                                    name="name"
                                                    value={editFormData.name}
                                                    onChange={handleEditFormChange}
                                                    className="w-full p-1 rounded bg-gray-700 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    type="email"
                                                    name="email"
                                                    value={editFormData.email}
                                                    onChange={handleEditFormChange}
                                                    className="w-full p-1 rounded bg-gray-700 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <select
                                                    name="role_id"
                                                    value={editFormData.role_id}
                                                    onChange={handleEditFormChange}
                                                    className="w-full p-2 rounded bg-gray-700 border border-gray-500 text-white"
                                                >
                                                    <option value="1">Administrador</option>
                                                    <option value="2">Profesor</option>
                                                    <option value="3">Usuario</option>
                                                </select>
                                            </td><td className="p-2 border border-gray-600">
                                                <select
                                                    name="class_group_id"
                                                    value={editFormData.class_group_id}
                                                    onChange={handleEditFormChange}
                                                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white"
                                                >
                                                    <option value="">Sin grupo</option>
                                                    {Array.isArray(groups) && groups.map((group) => (
                                                        <option key={group.id} value={group.id}>
                                                            {group.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    type="password"
                                                    name="password"
                                                    placeholder="Nueva contraseña (opcional)"
                                                    value={editFormData.password}
                                                    onChange={handleEditFormChange}
                                                    className="w-full p-1 rounded bg-gray-700 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600 space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={handleEditFormSubmit}
                                                    className="bg-lime-600 hover:bg-lime-700 px-3 py-1 rounded text-gray-900 font-semibold"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelClick}
                                                    className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded text-white"
                                                >
                                                    Cancelar
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr
                                            key={user.id}
                                            className="hover:bg-gray-700 cursor-pointer transition"
                                        >
                                            <td className="p-3 border border-gray-600">{user.name}</td><td className="p-3 border border-gray-600">{user.email}</td><td className="p-3 border border-gray-600">
                                                {user.role_id === 1
                                                    ? 'Administrador'
                                                    : user.role_id === 2
                                                        ? 'Profesor'
                                                        : 'Usuario'}
                                            </td><td className="p-3 border border-gray-600">
                                                {Array.isArray(groups) && groups.find((g) => g.id === user.class_group_id)?.name || '—'}
                                            </td><td className="p-3 border border-gray-600">—</td><td className="p-3 border border-gray-600 space-x-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditClick(user)}
                                                    className="bg-yellow-500 hover:bg-yellow-600 px-3 py-1 rounded text-gray-900 font-semibold"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white font-semibold"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'posts' && (
                <>
                    <h2 className="text-3xl font-bold mb-6 text-lime-400">Publicaciones</h2>
                    {loadingPosts ? (
                        <p className="text-gray-400">Cargando posts...</p>
                    ) : Array.isArray(posts) && posts.length === 0 ? (
                        <p className="text-gray-400">No hay publicaciones para mostrar.</p>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {Array.isArray(posts) && posts.map((post) => (
                                <div key={post.id} className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 w-full">
                                    {editPostId === post.id ? (
                                        <form onSubmit={handleEditPostSubmit} className="space-y-4">
                                            <input
                                                type="text"
                                                name="title"
                                                value={editPostData.title}
                                                onChange={handleEditPostChange}
                                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                                                placeholder="Título del post"
                                                required
                                            />
                                            <textarea
                                                name="content"
                                                value={editPostData.content}
                                                onChange={handleEditPostChange}
                                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white h-32 focus:ring-lime-400 focus:border-lime-400"
                                                placeholder="Contenido del post"
                                                required
                                            ></textarea>

                                            {Array.isArray(editingPostMedia) && editingPostMedia.length > 0 && (
                                                <div className="mt-4 border border-gray-700 p-3 rounded-md">
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">Medios existentes:</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {editingPostMedia.map((mediaItem, index) => (
                                                            <div key={index} className="relative group w-24 h-24 object-cover rounded-md overflow-hidden bg-gray-700 flex items-center justify-center">
                                                                {mediaItem.type === 'image' ? (
                                                                    <img
                                                                        src={`${API_BASE_URL.replace('/api', '')}${mediaItem.url.startsWith('/') ? mediaItem.url : '/' + mediaItem.url}`}
                                                                        alt={`Existente ${index}`}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : mediaItem.type === 'video' ? (
                                                                    <video className="w-full h-full object-cover">
                                                                        <source src={`${API_BASE_URL.replace('/api', '')}${mediaItem.url.startsWith('/') ? mediaItem.url : '/' + mediaItem.url}`} type="video/mp4" />
                                                                        Tu navegador no soporta el video.
                                                                    </video>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs">Tipo no soportado</span>
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
                                                <label htmlFor="newMediaFiles" className="block text-sm font-medium text-gray-300">
                                                    Subir nuevas imágenes/videos:
                                                </label>
                                                <input
                                                    type="file"
                                                    id="newMediaFiles"
                                                    name="media"
                                                    multiple
                                                    onChange={handleNewMediaFilesChange}
                                                    className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100"
                                                />
                                                {newMediaFiles.length > 0 && (
                                                    <p className="text-sm text-gray-400">Archivos seleccionados: {newMediaFiles.map(f => f.name).join(', ')}</p>
                                                )}
                                            </div>

                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    type="submit"
                                                    className="bg-lime-600 hover:bg-lime-700 px-4 py-2 rounded text-gray-900 font-semibold"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelPostEdit}
                                                    className="bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded text-white"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <p className="text-gray-400 text-sm mb-1">
                                                Por: <span className="font-semibold">{post.user_name || 'Desconocido'}</span>{' '}
                                                • {new Date(post.created_at).toLocaleDateString()}
                                            </p>
                                            <h3 className="text-2xl font-bold mb-2 text-lime-300">{post.title}</h3>
                                            <p className="text-gray-300 mb-4">{post.content}</p>

                                            {Array.isArray(post.media) && post.media.length > 0 && (
                                                <div className="relative mb-4 rounded-md overflow-hidden bg-gray-700">
                                                    {post.media[post.currentMediaIndex]?.type === 'image' ? (
                                                        <img
                                                            src={`${API_BASE_URL.replace('/api', '')}${post.media[post.currentMediaIndex].url.startsWith('/') ? post.media[post.currentMediaIndex].url : '/' + post.media[post.currentMediaIndex].url}`}
                                                            alt={`Medio de publicación ${post.id}-${post.currentMediaIndex}`}
                                                            className="w-full h-64 object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                                                            onClick={() => setViewerMediaInfo({ mediaArray: post.media, initialIndex: post.currentMediaIndex })}
                                                        />
                                                    ) : post.media[post.currentMediaIndex]?.type === 'video' ? (
                                                        <video
                                                            controls
                                                            src={`${API_BASE_URL.replace('/api', '')}${post.media[post.currentMediaIndex].url.startsWith('/') ? post.media[post.currentMediaIndex].url : '/' + post.media[post.currentMediaIndex].url}`}
                                                            className="w-full h-64 object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                                                            onClick={() => setViewerMediaInfo({ mediaArray: post.media, initialIndex: post.currentMediaIndex })}
                                                        >
                                                            Tu navegador no soporta el video.
                                                        </video>
                                                    ) : (
                                                        <div className="w-full h-64 flex items-center justify-center text-gray-400">
                                                            No hay vista previa disponible para este tipo de medio.
                                                        </div>
                                                    )}

                                                    {post.media.length > 1 && (
                                                        <>
                                                            <button
                                                                onClick={() => handlePrevMediaInPost(post.id)}
                                                                disabled={post.currentMediaIndex === 0}
                                                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-gray-900 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                                aria-label="Medio anterior"
                                                            >
                                                                &#10094;
                                                            </button>
                                                            <button
                                                                onClick={() => handleNextMediaInPost(post.id)}
                                                                disabled={post.currentMediaIndex === post.media.length - 1}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-900 bg-opacity-70 text-white p-2 rounded-full hover:bg-opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                                                aria-label="Medio siguiente"
                                                            >
                                                                &#10095;
                                                            </button>
                                                            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
                                                                {post.currentMediaIndex + 1} / {post.media.length}
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
                                                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white font-semibold transition"
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

            {activeTab === 'attendance' && (
                <div className="bg-gray-800 p-6 rounded-md shadow-lg border border-gray-700">
                    <h2 className="text-3xl font-bold mb-6 text-lime-400">Informes de Asistencia</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
                        <div>
                            <label htmlFor="attendanceDate" className="block text-sm font-medium text-gray-300 mb-1">
                                Fecha (Opcional):
                            </label>
                            <input
                                type="date"
                                id="attendanceDate"
                                value={attendanceDateFilter}
                                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            />
                        </div>
                        <div>
                            <label htmlFor="attendanceGroup" className="block text-sm font-medium text-gray-300 mb-1">
                                Grupo de Clase (Opcional):
                            </label>
                            <select
                                id="attendanceGroup"
                                value={attendanceGroupFilter}
                                onChange={(e) => setAttendanceGroupFilter(e.target.value)}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            >
                                <option value="">Todos los grupos</option>
                                {Array.isArray(groups) && groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchAttendanceReports}
                            disabled={loadingAttendance}
                            className="bg-lime-500 text-gray-900 font-bold py-2 px-4 rounded hover:bg-lime-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingAttendance ? 'Generando...' : 'Generar Informe en Pantalla'}
                        </button>
                    </div>

                    {attendanceSummary && (
                        <div className="bg-gray-700 p-4 rounded-md shadow-inner mb-6 text-center md:text-left">
                            <h3 className="text-xl font-semibold text-lime-300 mb-3">Resumen del Informe</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <p className="text-gray-300">
                                    <span className="font-bold text-white">Alumnos en el Reporte:</span> {attendanceSummary.totalStudentsInReport}
                                </p>
                                <p className="text-gray-300">
                                    <span className="font-bold text-white">Total Asistencia (Presentes + Justificados):</span> {attendanceSummary.totalAssisted}
                                </p>
                                <p className="text-gray-300">
                                    <span className="font-bold text-white">Presentes:</span> {attendanceSummary.totalPresent}
                                </p>
                                <p className="text-gray-300">
                                    <span className="font-bold text-white">Ausentes:</span> {attendanceSummary.totalAbsent}
                                </p>
                                <p className="text-gray-300">
                                    <span className="font-bold text-white">Justificados:</span> {attendanceSummary.totalJustified}
                                </p>
                                <p className="text-gray-300 text-lg font-bold">
                                    <span className="text-lime-300">Porcentaje de Asistencia:</span> {attendanceSummary.attendancePercentage}%
                                </p>
                            </div>
                        </div>
                    )}

                    {Object.keys(groupedAttendance).length > 0 && (
                        <button
                            onClick={handleDownloadPdf}
                            className="mb-6 bg-blue-600 text-white font-bold px-4 py-2 rounded-md hover:bg-blue-700 transition"
                        >
                            Descargar Reporte PDF
                        </button>
                    )}

                    {loadingAttendance ? (
                        <p className="text-gray-400">Cargando registros de asistencia...</p>
                    ) : Object.keys(groupedAttendance).length === 0 ? (
                        <p className="text-gray-400">No hay registros de asistencia para los filtros seleccionados.</p>
                    ) : (
                        <div className="bg-gray-900 rounded-md overflow-hidden p-3">
                            {/* Iterar sobre las fechas agrupadas */}
                            {Object.keys(groupedAttendance).sort((a, b) => new Date(a) - new Date(b)).map((dateKey, dateIndex) => (
                                <div key={dateKey} className="mb-8">
                                    {/* Separador de día */}
                                    <div className="text-center bg-gray-700 text-lime-400 py-3 rounded-t-md mb-2">
                                        <h3 className="text-xl font-bold">{dateKey}</h3>
                                    </div>
                                    <table className="w-full border-collapse text-white">
                                        <thead>
                                            <tr className="bg-gray-700 text-lime-400">
                                                <th className="p-3 border border-gray-600 text-left">N°</th>
                                                <th className="p-3 border border-gray-600 text-left">Alumno</th>
                                                <th className="p-3 border border-gray-600 text-left">Grupo</th>
                                                <th className="p-3 border border-gray-600 text-left">Fecha</th>
                                                <th className="p-3 border border-gray-600 text-left">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedAttendance[dateKey].map((record, index) => (
                                                <tr key={record.id} className="hover:bg-gray-700 transition">
                                                    <td className="p-3 border border-gray-600">{index + 1}</td>
                                                    <td className="p-3 border border-gray-600">
                                                        {record.student_name} {record.student_last_name || ''}
                                                    </td>
                                                    <td className="p-3 border border-gray-600">{record.class_group_name || 'Sin grupo'}</td>
                                                    <td className="p-3 border border-gray-600">{new Date(record.date).toLocaleDateString()}</td>
                                                    <td className={`p-3 border border-gray-600 font-semibold ${
                                                        record.status === 'present' ? 'text-green-400' :
                                                        record.status === 'absent' ? 'text-red-400' :
                                                        'text-yellow-400'
                                                    }`}>
                                                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {/* Línea separadora entre días, excepto para el último día */}
                                    {dateIndex < Object.keys(groupedAttendance).length - 1 && (
                                        <hr className="my-6 border-t-2 border-gray-600" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'list' && (
                <>
                    <h2 className="text-3xl font-bold mb-6 text-lime-400">Listado de Alumnos</h2>

                    <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-gray-800 rounded-lg shadow-inner">
                        <div className="flex-grow">
                            <label htmlFor="alumnoSearch" className="block text-sm font-medium text-gray-300 mb-1">
                                Buscar (Nombre, Apellido, Cédula, Representante):
                            </label>
                            <input
                                type="text"
                                id="alumnoSearch"
                                value={alumnoSearchTerm}
                                onChange={(e) => setAlumnoSearchTerm(e.target.value)}
                                placeholder="Ej: Juan Pérez, 1234567890, María..."
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            />
                        </div>
                        <div>
                            <label htmlFor="alumnoSearchMonth" className="block text-sm font-medium text-gray-300 mb-1">
                                Mes de Nacimiento:
                            </label>
                            <select
                                id="alumnoSearchMonth"
                                value={alumnoSearchMonth}
                                onChange={(e) => setAlumnoSearchMonth(e.target.value)}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
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
                            <label htmlFor="studentGroupFilter" className="block text-sm font-medium text-gray-300 mb-1">
                                Filtrar por Grupo:
                            </label>
                            <select
                                id="studentGroupFilter"
                                value={studentGroupFilter}
                                onChange={handleGroupFilterChange}
                                className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white focus:ring-lime-400 focus:border-lime-400"
                            >
                                <option value="">Todos los grupos</option>
                                {Array.isArray(groups) && groups.map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={fetchStudents}
                            className="bg-lime-500 text-gray-900 font-bold py-2 px-4 rounded hover:bg-lime-600 transition"
                        >
                            Buscar Alumnos
                        </button>
                        <button
                            onClick={handleDownloadAlumnosPdf}
                            className="bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition"
                        >
                            Descargar PDF
                        </button>
                    </div>

                    {loadingStudents ? (
                        <p className="text-gray-400">Cargando alumnos...</p>
                    ) : errorStudents ? (
                        <p className="text-red-500">{errorStudents}</p>
                    ) : Array.isArray(students) && students.length === 0 ? (
                        <p className="text-gray-400">No se encontraron alumnos para los filtros seleccionados.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md">
                            <table className="w-full border-collapse text-white bg-gray-800">
                                <thead>
                                    <tr className="bg-gray-700  text-lime-400">
                                        <th className="p-3 border border-gray-600 text-left">#</th><th className="p-3 border border-gray-600 text-left">Nombre</th><th className="p-3 border border-gray-600 text-left">Apellido</th><th className="p-3 border border-gray-600 text-left">Cédula</th><th className="p-3 border border-gray-600 text-left">Fecha Nac.</th><th className="p-3 border border-gray-600 text-left">Edad</th><th className="p-3 border border-gray-600 text-left">Representante</th><th className="p-3 border border-gray-600 text-left">Tel. Rep.</th><th className="p-3 border border-gray-600 text-left">Dirección</th><th className="p-3 border border-gray-600 text-left">Grupo</th><th className="p-3 border border-gray-600 text-left">Foto</th><th className="p-3 border border-gray-600 text-left">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(students) && students.map((student, index) =>
                                    editStudentId === student.id ? (
                                        <tr key={student.id} className="bg-gray-700">
                                            <td className="p-2 border border-gray-600">{index + 1}</td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="name"
                                                    value={editStudentData.name}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="last_name"
                                                    value={editStudentData.last_name}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="cedula"
                                                    value={editStudentData.cedula}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    type="date"
                                                    name="birthdate"
                                                    value={editStudentData.birthdate?.split('T')[0] || ''}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                {calculateAge(student.birthdate)}
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="guardian_name"
                                                    value={editStudentData.guardian_name}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="guardian_phone"
                                                    value={editStudentData.guardian_phone}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="direccion"
                                                    value={editStudentData.direccion}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600">
                                                <select
                                                    name="class_group_id"
                                                    value={editStudentData.class_group_id}
                                                    onChange={handleEditStudentChange}
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                >
                                                    <option value="" disabled>
                                                        Seleccione grupo
                                                    </option>
                                                    {Array.isArray(groups) && groups.map((group) => (
                                                        <option key={group.id} value={group.id}>
                                                            {group.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td><td className="p-2 border border-gray-600">
                                                <input
                                                    name="photo_url"
                                                    value={editStudentData.photo_url}
                                                    onChange={handleEditStudentChange}
                                                    placeholder="URL de la foto"
                                                    className="w-full p-1 rounded bg-gray-600 border border-gray-500 text-white"
                                                />
                                            </td><td className="p-2 border border-gray-600 space-x-1">
                                                <button
                                                    onClick={handleEditStudentSubmit}
                                                    className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={handleCancelStudentEdit}
                                                    className="bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded text-white"
                                                >
                                                    Cancelar
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr key={student.id} className="hover:bg-gray-700 cursor-pointer transition">
                                            <td className="p-3 border border-gray-600">{index + 1}</td><td className="p-3 border border-gray-600">{student.name}</td><td className="p-3 border border-gray-600">{student.last_name}</td><td className="p-3 border border-gray-600">{student.cedula}</td><td className="p-3 border border-gray-600">{student.birthdate?.split('T')[0]}</td><td className="p-3 border border-gray-600">{calculateAge(student.birthdate)}</td><td className="p-3 border border-gray-600">{student.guardian_name}</td><td className="p-3 border border-gray-600">{student.guardian_phone}</td><td className="p-3 border border-gray-600">{student.direccion}</td><td className="p-3 border border-gray-600">
                                                {Array.isArray(groups) && groups.find((g) => g.id === student.class_group_id)?.name || 'Desconocido'}
                                            </td><td className="p-3 border border-gray-600">
                                                {student.photo_url ? (
                                                    <img
                                                        src={`${API_BASE_URL.replace('/api', '')}${student.photo_url.startsWith('/') ? student.photo_url : '/' + student.photo_url}`}
                                                        alt={student.name}
                                                        className="w-12 h-12 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-xs">
                                                        {student.name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </td><td className="p-3 border border-gray-600 space-x-1">
                                                <button
                                                    onClick={() => handleEditStudentClick(student)}
                                                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteStudent(student.id)}
                                                    className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-white"
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'connected' && (
                <div className="bg-gray-800 p-6 rounded-md shadow-lg border border-gray-700">
                    <h2 className="text-3xl font-bold mb-6 text-lime-400">Usuarios Conectados</h2>
                    {loadingConnectedUsers ? (
                        <p className="text-gray-400">Cargando usuarios conectados...</p>
                    ) : Array.isArray(connectedUsers) && connectedUsers.length === 0 ? (
                        <p className="text-gray-400">No hay usuarios conectados en este momento.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-md">
                            <table className="w-full border-collapse text-white bg-gray-900">
                                <thead>
                                    <tr className="bg-gray-700 text-lime-400">
                                        <th className="p-3 border border-gray-600 text-left">Nombre</th><th className="p-3 border border-gray-600 text-left">Email</th><th className="p-3 border border-gray-600 text-left">Última Actividad</th><th className="p-3 border border-gray-600 text-left">Foto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(connectedUsers) && connectedUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-700 transition">
                                            <td className="p-3 border border-gray-600">{user.name}</td><td className="p-3 border border-gray-600">{user.email}</td><td className="p-3 border border-gray-600">
                                                {new Date(user.last_seen).toLocaleString('es-EC')}
                                            </td><td className="p-3 border border-gray-600">
                                                {user.photo_url ? (
                                                    <img
                                                        src={`${API_BASE_URL.replace('/api', '')}${user.photo_url.startsWith('/') ? user.photo_url : '/' + user.photo_url}`}
                                                        alt={user.name}
                                                        className="w-10 h-10 object-cover rounded-full"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-xs">
                                                        {user.name.charAt(0).toUpperCase()}
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
            <ToastContainer />
            <ConfirmationModal
                show={showConfirmModal}
                message={modalMessage}
                onConfirm={() => {
                    if (confirmAction) {
                        confirmAction();
                    }
                }}
                onCancel={() => setShowConfirmModal(false)}
            />

            <MediaViewerModal
                postMediaArray={viewerMediaInfo?.mediaArray}
                initialMediaIndex={viewerMediaInfo?.initialIndex}
                onClose={() => setViewerMediaInfo(null)}
            />
        </section>
    );
}
