'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import PostCard from './PostCard'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client';

// Define la URL base de tu API usando una variable de entorno
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
// Para Socket.IO, la URL base del backend, sin el sufijo '/api'
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '');

export default function UserPanel({ currentUserName, setUserName }) {
    const router = useRouter();

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'createPost', 'profile', 'asistencias'

    // --- Estados para crear un nuevo post ---
    const [newPostData, setNewPostData] = useState({
        title: '',
        content: '',
    });
    const [selectedImage, setSelectedImage] = useState(null);
    const [canUserCreatePosts, setCanUserCreatePosts] = useState(false);
    const [userRole, setUserRole] = useState(null); // Estado para el rol del usuario (número)
    const [loggedInUserId, setLoggedInUserId] = useState(null); // Estado para el ID del usuario logueado

    // --- Estados para editar perfil ---
    const [editingProfile, setEditingProfile] = useState(false);
    const [userProfile, setUserProfile] = useState({
        name: currentUserName,
        email: '',
        photo_url: '',
    });
    const [profileImageFile, setProfileImageFile] = useState(null);

    // Ref para la instancia de Socket.IO para que persista entre renders
    const socketRef = useRef(null);

    // --- NUEVOS ESTADOS PARA LA FUNCIÓN DE ASISTENCIA ---
    const [cedulaInput, setCedulaInput] = useState('');
    const [attendanceData, setAttendanceData] = useState(null);
    const [attendanceMessage, setAttendanceMessage] = useState('');
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    // --- NUEVOS ESTADOS PARA LA BÚSQUEDA DE ESTUDIANTES (ROL 3) ---
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState('');

    // --- NUEVOS ESTADOS PARA EL MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ---
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [postToDelete, setPostToDelete] = useState(null);

    // Obtener el userId y el rol del localStorage al cargar el componente
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedUserId = localStorage.getItem('userId');
            const storedUserRole = localStorage.getItem('userRole'); // 'admin', 'teacher', 'student'
            const storedRoleNumber = localStorage.getItem('role'); // '1', '2', '3'

            setLoggedInUserId(storedUserId);
            setUserRole(Number(storedRoleNumber)); // Convertir a número para comparaciones
            setCanUserCreatePosts(storedUserRole === 'admin' || storedUserRole === 'teacher');

            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
            }
        }
    }, [router]);

    // --- Funciones para Posts ---
    const fetchPosts = useCallback(async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/posts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPosts(res.data);
        } catch (e) {
            console.error('Error cargando posts:', e.response ? e.response.data : e.message);
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handlePostInputChange = (e) => {
        const { name, value } = e.target;
        setNewPostData((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        setSelectedImage(e.target.files[0]);
    };

    const handleCreatePost = async (e) => {
        e.preventDefault();
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!loggedInUserId || !token) {
            console.error('Debes iniciar sesión para crear publicaciones.');
            return;
        }
        if (userRole !== 1 && userRole !== 2) {
            console.error('Solo los administradores y profesores pueden crear publicaciones.');
            return;
        }
        if (!newPostData.title.trim() || !newPostData.content.trim()) {
            console.error('El título y el contenido de la publicación no pueden estar vacíos.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', newPostData.title);
            formData.append('content', newPostData.content);
            formData.append('user_id', loggedInUserId);
            if (selectedImage) {
                formData.append('image', selectedImage);
            }

            await axios.post(`${API_BASE_URL}/posts`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                },
            });
            console.log('Publicación creada exitosamente!');
            setNewPostData({ title: '', content: '' });
            setSelectedImage(null);
            fetchPosts();
            setActiveTab('feed');
        } catch (e) {
            console.error('Error creando publicación:', e.response ? e.response.data : e.message);
        } finally {
            setLoading(false);
        }
    };

    // Nueva función para iniciar el proceso de eliminación (mostrar modal)
    const handleStartDeletePost = useCallback((post) => {
        setPostToDelete(post);
        setShowDeleteModal(true);
    }, []);

    // Función de eliminación que se ejecuta después de la confirmación
    const handleDeletePost = useCallback(async () => {
        if (!postToDelete) return;

        const postId = postToDelete.id;
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

        if (!loggedInUserId || !token) {
            console.error('Error: No se encontró el ID de usuario autenticado o token para eliminar la publicación.');
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
            console.log('Publicación eliminada exitosamente.');
            setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        } catch (e) {
            console.error('Error eliminando publicación:', e.response ? e.response.data : e.message);
        } finally {
            setLoading(false);
            setShowDeleteModal(false);
            setPostToDelete(null);
        }
    }, [postToDelete, loggedInUserId, setPosts]);

    const handleStartEditPost = useCallback((post) => {
        console.log('La edición de publicaciones no está implementada en este panel.');
    }, []);

    // --- Funciones para Perfil ---
    const fetchUserProfile = useCallback(async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!loggedInUserId || !token) {
            console.log('No loggedInUserId or token available for fetching profile.');
            return;
        }
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/users/${loggedInUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUserProfile({
                name: res.data.name,
                email: res.data.email,
                photo_url: res.data.photo_url ? `${API_BASE_URL.replace('/api', '')}${res.data.photo_url}` : '',
            });
            setUserRole(res.data.role_id);
            setCanUserCreatePosts(res.data.role_id === 1 || res.data.role_id === 2);
            setUserName(res.data.name);
        } catch (error) {
            console.error('Error fetching user profile:', error.response ? error.response.data : error.message);
        } finally {
            setLoading(false);
        }
    }, [loggedInUserId, setUserName]);

    const handleProfileInputChange = (e) => {
        const { name, value } = e.target;
        setUserProfile((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfileImageChange = (e) => {
        setProfileImageFile(e.target.files[0]);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!loggedInUserId || !token) {
            console.error('ID de usuario o token no disponible para actualizar perfil.');
            return;
        }
        if (!userProfile.name.trim()) {
            console.error('El nombre no puede estar vacío.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', userProfile.name);

            if (profileImageFile) {
                formData.append('profile_image', profileImageFile);
            } else if (userProfile.photo_url === null || userProfile.photo_url === '') {
                formData.append('clear_image', 'true');
            }

            const res = await axios.put(`${API_BASE_URL}/users/${loggedInUserId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                },
            });
            console.log('Perfil actualizado exitosamente!');
            setEditingProfile(false);
            setUserProfile(prev => ({ ...prev, photo_url: res.data.photo_url ? `${API_BASE_URL.replace('/api', '')}${res.data.photo_url}` : null }));
            setProfileImageFile(null);
            fetchUserProfile();
        } catch (error) {
            console.error('Error updating profile:', error.response ? error.response.data : error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- EFECTO PARA SOCKET.IO ---
    useEffect(() => {
        if (!loggedInUserId) return;

        socketRef.current = io(SOCKET_SERVER_URL, {
            withCredentials: true,
        });

        socketRef.current.on('connect', () => {
            console.log('🎉 UserPanel: Conectado al servidor Socket.IO:', socketRef.current.id);
            socketRef.current.emit('set-user-online', loggedInUserId);
        });

        socketRef.current.on('disconnect', () => {
            console.log('🔌 UserPanel: Desconectado del servidor Socket.IO');
        });

        socketRef.current.on('connect_error', (err) => {
            console.error('❌ UserPanel: Error de conexión Socket.IO:', err.message);
        });
        
        socketRef.current.on('newPost', (newPost) => {
            console.log('Recibido nuevo post en tiempo real:', newPost);
            setPosts(prevPosts => [newPost, ...prevPosts]);
        });

        socketRef.current.on('postUpdated', (updatedPost) => {
            console.log('Post actualizado en tiempo real:', updatedPost);
            setPosts(prevPosts =>
                prevPosts.map(post => (post.id === updatedPost.id ? updatedPost : post))
            );
        });

        socketRef.current.on('postDeleted', (postId) => {
            console.log('Post eliminado en tiempo real:', postId);
            setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                console.log('UserPanel: Socket.IO desconectado al desmontar el componente.');
            }
        };
    }, [loggedInUserId]);

    // Este useEffect se encarga de cargar los posts y el perfil cuando el loggedInUserId está disponible
    useEffect(() => {
        if (loggedInUserId) {
            fetchPosts();
            fetchUserProfile();
        }
    }, [loggedInUserId, fetchPosts, fetchUserProfile]);

    
    // --- FUNCIÓN PARA BUSCAR ESTUDIANTES (ROL 3) ---
    const handleStudentSearch = async () => {
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
            const res = await axios.get(`${API_BASE_URL}/asistencia/student-search?query=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setSearchResults(res.data);
            if (res.data.length === 0) {
                setSearchError('No se encontraron estudiantes con ese criterio de búsqueda');
            }
        } catch (error) {
            console.error('Error buscando estudiantes:', error);
            setSearchError(error.response?.data?.error || 'Error al buscar estudiantes');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

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
        <section className="min-h-screen bg-gray-900 text-white p-4 md:p-8 max-w-full mx-auto rounded-lg shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-yellow-300">Panel de Usuario</h2>

            {/* Tabs */}
            <div className="flex flex-wrap space-x-2 md:space-x-4 mb-8">
                <button
                    onClick={() => setActiveTab('feed')}
                    className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base ${
                        activeTab === 'feed' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                >
                    📰 Feed de Publicaciones
                </button>
                {canUserCreatePosts && (
                    <button
                        onClick={() => setActiveTab('createPost')}
                        className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base ${
                            activeTab === 'createPost' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                        ➕ Crear Publicación
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base ${
                        activeTab === 'profile' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                >
                    👤 Mi Perfil
                </button>

                {/* === BOTÓN DE ASISTENCIAS === */}
                <button
                    onClick={() => setActiveTab('asistencias')}
                    className={`px-4 py-2 md:px-6 md:py-2 rounded-md font-semibold transition text-sm md:text-base ${
                        activeTab === 'asistencias' ? 'bg-yellow-300 text-gray-900' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                >
                    📋 Asistencias
                </button>
            </div>

            {/* --- Contenido del Feed --- */}
            {activeTab === 'feed' && (
                <>
                    <h3 className="text-2xl font-bold mb-4 text-yellow-300">Últimas Publicaciones</h3>
                    {posts.length === 0 ? (
                        <p className="text-gray-400">No hay publicaciones para mostrar. ¡Sé el primero en publicar algo!</p>
                    ) : (
                        <div className="flex justify-center">
                            <div className="w-full sm:max-w-md md:max-w-xl lg:max-w-[300px] xl:max-w-[600px] 2xl:max-w-[900px]">
                                {posts.map((post) => (
                                    <PostCard
                                        key={post.id}
                                        post={post}
                                        currentUserId={loggedInUserId}
                                        onDeletePost={() => handleStartDeletePost(post)}
                                        onStartEditPost={handleStartEditPost}
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
                    className="mb-6 bg-gray-800 p-6 rounded-md shadow space-y-4 max-w-2xl mx-auto border border-gray-700"
                >
                    <h3 className="font-semibold mb-2 text-yellow-300 text-xl">Crear Nueva Publicación</h3>
                    <div>
                        <label htmlFor="postTitle" className="block text-sm font-medium text-gray-300">
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
                        <label htmlFor="postContent" className="block text-sm font-medium text-gray-300">
                            Contenido
                        </label>
                        <textarea
                            id="postContent"
                            name="content"
                            value={newPostData.content}
                            onChange={handlePostInputChange}
                            required
                            rows="4"
                            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white mt-1 focus:ring-yellow-500 focus:border-yellow-500"
                        ></textarea>
                    </div>
                    <div>
                        <label htmlFor="postImage" className="block text-sm font-medium text-gray-300">
                            Subir Imagen (Opcional)
                        </label>
                        <input
                            id="postImage"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                        />
                        {selectedImage && (
                            <p className="text-sm text-gray-400 mt-2">Imagen seleccionada: {selectedImage.name}</p>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded hover:bg-yellow-600 transition"
                    >
                        Publicar
                    </button>
                </form>
            )}
            {activeTab === 'createPost' && !canUserCreatePosts && (
                <p className="text-red-400 text-center text-lg mt-8">
                    Tu rol actual no te permite crear publicaciones. Solo los administradores y profesores pueden hacerlo.
                </p>
            )}

            {/* --- Contenido de Mi Perfil --- */}
            {activeTab === 'profile' && (
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 md:p-8 rounded-xl shadow-2xl max-w-2xl mx-auto border border-gray-700 relative">
                    <h3 className="font-extrabold text-3xl mb-6 text-yellow-400 text-center">Mi Perfil</h3>

                    {editingProfile ? (
                        <form onSubmit={handleUpdateProfile} className="space-y-6">
                            <div>
                                <label htmlFor="profileName" className="block text-sm font-medium text-gray-300 mb-1">
                                    Nombre
                                </label>
                                <input
                                    id="profileName"
                                    name="name"
                                    value={userProfile.name}
                                    onChange={handleProfileInputChange}
                                    required
                                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-yellow-500 focus:border-yellow-500 transition"
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
                                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-400 cursor-not-allowed"
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
                                    className="w-full p-3 rounded-lg bg-gray-700 border border-gray-600 text-white mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100 cursor-pointer"
                                />
                                {profileImageFile ? (
                                    <p className="text-sm text-gray-400 mt-2">Nueva imagen seleccionada: <span className="font-semibold text-yellow-300">{profileImageFile.name}</span></p>
                                ) : userProfile.photo_url ? (
                                    <div className="mt-4 flex flex-col items-center">
                                        <p className="text-sm text-gray-400 mb-2">Foto actual:</p>
                                        <img src={userProfile.photo_url} alt="Foto de Perfil Actual" className="w-32 h-32 object-cover rounded-full border-4 border-yellow-500 shadow-lg" />
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

                            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-6">
                                <button
                                    type="submit"
                                    className="flex-1 bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition-colors duration-300 shadow-md"
                                >
                                    Guardar Cambios
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingProfile(false);
                                        fetchUserProfile();
                                    }}
                                    className="flex-1 bg-gray-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors duration-300 shadow-md"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="relative w-40 h-40">
                                <img
                                    src={userProfile.photo_url || "https://placehold.co/150x150/555/FFF?text=No+Foto"}
                                    alt="Foto de Perfil"
                                    className="w-full h-full object-cover rounded-full border-4 border-yellow-500 shadow-xl"
                                />
                            </div>

                            <div className="space-y-3 text-gray-200 w-full">
                                <div className="bg-gray-700 p-4 rounded-lg shadow-inner">
                                    <p className="text-sm font-medium text-gray-400 mb-1">Nombre:</p>
                                    <p className="text-2xl font-bold text-white">{userProfile.name}</p>
                                </div>
                                <div className="bg-gray-700 p-4 rounded-lg shadow-inner">
                                    <p className="text-sm font-medium text-gray-400 mb-1">Correo Electrónico:</p>
                                    <p className="text-xl font-bold text-white break-words">{userProfile.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingProfile(true)}
                                className="w-full sm:w-auto bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors duration-300 shadow-md transform hover:scale-105"
                            >
                                Editar Perfil
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {/* --- CONTENIDO DE ASISTENCIAS ACTUALIZADO --- */}
            {activeTab === 'asistencias' && (
                <div className="bg-gray-800 p-6 rounded-md shadow space-y-4 max-w-2xl mx-auto border border-gray-700">
                    <h3 className="font-semibold mb-2 text-yellow-300 text-xl text-center">
                        {userRole === 3 ? 'Buscar Estudiantes y Asistencias' : 'Consulta de Asistencias'}
                    </h3>
                    
                    {userRole === 3 ? (
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
                                    className={`bg-yellow-500 text-gray-900 font-bold py-2 px-4 sm:px-6 rounded transition ${
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {searchResults.map((student) => (
                                            <div key={student.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                                                <h4 className="font-bold text-yellow-300">
                                                    {student.name} {student.last_name}
                                                </h4>
                                                <p className="text-sm text-gray-400">Cédula: {student.cedula || 'No registrada'}</p>
                                                <p className="text-sm text-gray-400">Grupo: {student.class_group_name || 'Sin grupo'}</p>
                                                
                                                <div className="mt-3 pt-3 border-t border-gray-600">
                                                    <p className="text-sm">
                                                        <span className="text-green-400">Asistencias: {student.present_days}</span>
                                                        {' | '}
                                                        <span className="text-blue-400">Justificadas: {student.justified_days}</span>
                                                        {' | '}
                                                        <span className="text-red-400">Faltas: {student.total_days - student.attended_days}</span>
                                                    </p>
                                                    <p className="text-sm mt-1">
                                                        Total días: {student.total_days} | Asistencia total: {student.attended_days}
                                                    </p>
                                                    {student.total_days > 0 && (
                                                        <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                                                            <div 
                                                                className="bg-yellow-500 h-2.5 rounded-full" 
                                                                style={{ width: `${(student.attended_days / student.total_days) * 100}%` }}
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
                            <div className="flex justify-center my-4">
                                <input
                                    type="text"
                                    value={cedulaInput}
                                    onChange={(e) => setCedulaInput(e.target.value)}
                                    className="w-full max-w-sm p-2 rounded bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-yellow-500 focus:border-yellow-500"
                                    placeholder="Cédula o Nombres y Apellidos"
                                />
                            </div>
                            <div className="flex justify-center">
                                <button
                                    onClick={handleAttendanceLookup}
                                    disabled={attendanceLoading}
                                    className={`bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded transition ${attendanceLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'}`}
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
                                    <p className="text-white">Nombre: <span className="font-semibold">{attendanceData.name}</span></p>
                                    <p className="text-white">Cédula: <span className="font-semibold">{attendanceData.cedula}</span></p>
                                    <p className="text-white">Asistencias: <span className="font-semibold">{attendanceData.attendedDays} de {attendanceData.totalDays}</span></p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* --- MODAL DE CONFIRMACIÓN DE ELIMINACIÓN --- */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl max-w-sm w-full border border-red-500 transform scale-105">
                        <h4 className="text-xl font-bold text-red-400 mb-4 text-center">Confirmar Eliminación</h4>
                        <p className="text-gray-300 text-center mb-6">
                            ¿Estás seguro de que quieres eliminar esta publicación? Esta acción no se puede deshacer.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setPostToDelete(null);
                                }}
                                className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-700 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeletePost}
                                className="bg-red-600 text-white font-bold py-2 px-6 rounded-md hover:bg-red-700 transition"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}