'use client'
import { useEffect, useState, useRef } from 'react' // Importa useRef
import { useRouter } from 'next/navigation'
import { jwtDecode } from 'jwt-decode'
import AdminPanel from '../components/AdminPanel'
import TeacherPanel from '../components/TeacherPanel'
import UserPanel from '../components/UserPanel'
import { io } from 'socket.io-client'; // Importa io para Socket.IO

// Define la URL del servidor de Socket.IO
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_SERVER_URL = API_BASE_URL.replace('/api', '');

export default function DashboardPage() {
  const router = useRouter()
  const [role, setRole] = useState(null)
  const [userId, setUserId] = useState(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Ref para la instancia de Socket.IO
  const socketRef = useRef(null);

  // Estado para almacenar los usuarios conectados (para pasar a AdminPanel si es necesario)
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [connectedUsersCount, setConnectedUsersCount] = useState(0);


  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const decoded = jwtDecode(token)
      const currentTime = Date.now() / 1000
      if (decoded.exp < currentTime) {
        localStorage.removeItem('token')
        localStorage.removeItem('userId')
        localStorage.removeItem('userRole')
        localStorage.removeItem('userName')
        localStorage.removeItem('userEmail')
        localStorage.removeItem('userClassGroupId')
        router.push('/login')
        return
      }

      setRole(decoded.role_id?.toString())
      setUserId(decoded.id)
      setUserName(decoded.name || '')
      setLoading(false)

      localStorage.setItem('userId', decoded.id);

    } catch (error) {
      console.error('Error decoding token:', error);
      localStorage.removeItem('token')
      localStorage.removeItem('userId')
      localStorage.removeItem('userRole')
      localStorage.removeItem('userName')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userClassGroupId')
      router.push('/login')
    }
  }, [router])


  // Lógica de conexión de Socket.IO (ahora en DashboardPage)
  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return; // Espera a que userId esté disponible

    if (!socketRef.current) {
      socketRef.current = io(SOCKET_SERVER_URL, {
        withCredentials: true,
      });
    }

    socketRef.current.on('connect', () => {
      console.log('🎉 [DashboardPage] Conectado al servidor Socket.IO:', socketRef.current.id);
      // Emitir el evento para marcar al usuario como online
      socketRef.current.emit('set-user-online', userId);
      console.log(`[DashboardPage] Emitido 'set-user-online' para userId: ${userId}`);
    });

    socketRef.current.on('online-users-updated', (users) => {
      console.log('🔄 [DashboardPage] Lista de usuarios online actualizada recibida:', users.length);
      setConnectedUsers(users);
      setConnectedUsersCount(users.length);
    });

    socketRef.current.on('disconnect', () => {
      console.log('🔌 [DashboardPage] Desconectado del servidor Socket.IO');
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('❌ [DashboardPage] Error de conexión Socket.IO:', err.message);
      // En caso de error de conexión, podrías querer intentar obtener los usuarios por HTTP como fallback
      // Sin embargo, para la lista de conectados en tiempo real, la conexión de socket es clave.
    });

    // Limpiar al desmontar el componente
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null; // Limpiar la referencia
        console.log('[DashboardPage] Socket.IO desconectado al desmontar DashboardPage.');
      }
    };
  }, [userId]); // Dependencia en userId para asegurar que se conecte una vez que el ID del usuario esté disponible

  // Lógica para enviar heartbeat periódicamente (opcional, pero buena práctica)
  // Mantenemos esta lógica aquí, ya que es a nivel de sesión de usuario
  useEffect(() => {
    const sendHeartbeat = async () => {
      const token = localStorage.getItem('token');
      const currentUserId = localStorage.getItem('userId');
      if (token && currentUserId) {
        try {
          // No necesitamos Axios aquí, si el socket está conectado, podemos usarlo para el heartbeat
          // Si el socket no está conectado, la ruta HTTP es un buen fallback
          if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('heartbeat', currentUserId); // Emitir un evento heartbeat por socket
            // console.log(`[DashboardPage] Heartbeat enviado por socket para userId: ${currentUserId}`);
          } else {
            // Fallback HTTP si el socket no está conectado (menos ideal para "online real-time")
            // await axios.put(`${API_BASE_URL}/users/me/last-seen`, {}, {
            //     headers: { Authorization: `Bearer ${token}` }
            // });
            // console.log(`[DashboardPage] Heartbeat enviado por HTTP para userId: ${currentUserId}`);
          }
        } catch (err) {
          console.error('[DashboardPage] Error enviando heartbeat:', err);
        }
      }
    };

    // Envía un heartbeat inicial y luego cada 60 segundos
    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, 60 * 1000);
    return () => clearInterval(intervalId);
  }, [userId]); // Dependencia en userId

  const logout = () => {
    // Cuando el usuario cierra sesión, emitir un evento para marcarlo como offline
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('set-user-offline', userId); // Nuevo evento para marcar offline
      console.log(`[DashboardPage] Emitido 'set-user-offline' para userId: ${userId}`);
    }

    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('userRole')
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userClassGroupId')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-black text-white">
        <p className="text-xl font-semibold animate-pulse">Validando sesión...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <header className="flex justify-between items-center mb-8 flex-wrap">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 md:mb-0">Bienvenido, {userName}</h1>
        <button
          onClick={logout}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md font-semibold transition"
        >
          Cerrar sesión
        </button>
      </header>

      {/* Renderiza el panel según el rol */}
      {role === '1' && (
        <AdminPanel
          connectedUsers={connectedUsers} // Pasa los usuarios conectados a AdminPanel
          connectedUsersCount={connectedUsersCount} // Pasa el contador a AdminPanel
        />
      )}
      {role === '2' && <TeacherPanel />}
      {role !== '1' && role !== '2' && <UserPanel currentUserId={userId} currentUserName={userName} setUserName={setUserName} />}
    </div>
  )
}
