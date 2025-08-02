import Link from 'next/link';
import Image from 'next/image';

// Este es el componente de la página de inicio.
// Utiliza Tailwind CSS para un diseño moderno y responsivo.
export default function Home() {
  return (
    // Contenedor principal que centra todo el contenido en la pantalla
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      
      {/* Tarjeta o contenedor principal del contenido */}
      <div className="max-w-4xl w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden md:flex">
        
        {/* Sección de la imagen (lado izquierdo) */}
        {/* Aquí se ha reducido el tamaño del contenedor a 1/3 del ancho en pantallas medianas */}
        <div className="md:w-1/3 relative flex items-center justify-center p-4">
          <Image
            src="/Logo.png"
            alt="Logo"
            width={1200}
            height={800}
            className="w-full h-auto object-contain rounded-2xl"
            priority
          />
        </div>

        {/* Sección del contenido y botones (lado derecho) */}
        {/* Se ajusta el ancho para ocupar el espacio restante */}
        <div className="md:w-2/3 flex flex-col justify-center items-center p-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            Bienvenido a tu comunidad
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8">
            Únete y conecta con otros miembros de nuestra comunidad.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            {/* Botón de Iniciar Sesión con la sintaxis de Link actualizada */}
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 ease-in-out
                          bg-blue-600 text-white shadow-md hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50">
              Iniciar Sesión
            </Link>

            {/* Botón de Registrarse con la sintaxis de Link actualizada */}
            <Link 
              href="/register" 
              className="w-full sm:w-auto px-6 py-3 rounded-full font-semibold text-lg transition-all duration-300 ease-in-out
                          bg-white text-blue-600 border-2 border-blue-600 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-opacity-50">
              Registrarse
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
