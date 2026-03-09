'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Definir la interfaz MediaItem aquí o importarla de un archivo compartido si existe
// Para este ejemplo, la definimos aquí, asumiendo que es la misma que en PostCard.tsx
export interface MediaItem {
  url: string; // Aseguramos que 'url' es siempre string
  type: string; // 'image' | 'video'
}

interface MediaViewerProps {
  mediaUrls: MediaItem[]; // Ahora espera un array de MediaItem
  currentIndex?: number;
  onClose: () => void;
}

const MediaViewer: React.FC<MediaViewerProps> = ({ mediaUrls = [], currentIndex = 0, onClose }) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(currentIndex);
    const mediaContainerRef = useRef<HTMLDivElement>(null); // Tipado para useRef
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // Función para construir la URL completa
    const getFullImageUrl = (url: string): string => { // url ahora es string
        if (!url) return ''; // Debería ser string, pero como fallback
        if (url.startsWith('http')) return url;
        // Asumiendo que el servidor corre en localhost:3001
        return `http://localhost:3001${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // Filtrar medios válidos y construir URLs completas
    // Aseguramos que media.url sea string antes de usar startsWith
    const validMedia = mediaUrls
        .filter(media => media && media.url)
        .map(media => ({
            ...media,
            url: getFullImageUrl(media.url) // getFullImageUrl ahora espera string
        }));

    const goToNext = useCallback(() => {
        if (validMedia.length > 0) {
            setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % validMedia.length);
        }
    }, [validMedia.length]);

    const goToPrev = useCallback(() => {
        if (validMedia.length > 0) {
            setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + validMedia.length) % validMedia.length);
        }
    }, [validMedia.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { // Tipado para KeyboardEvent
            if (e.key === 'ArrowRight') goToNext();
            else if (e.key === 'ArrowLeft') goToPrev();
            else if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, onClose]);

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => { // Tipado para TouchEvent
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => { // Tipado para TouchEvent
        touchEndX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = () => {
        const swipeThreshold = 50;
        if (touchStartX.current - touchEndX.current > swipeThreshold) {
            goToNext();
        } else if (touchEndX.current - touchStartX.current > swipeThreshold) {
            goToPrev();
        }
        touchStartX.current = 0;
        touchEndX.current = 0;
    };

    if (validMedia.length === 0) return null;

    const currentMedia = validMedia[currentMediaIndex];
    // currentMedia.url ahora es definitivamente string
    const isVideo = currentMedia.type === 'video' || currentMedia.url.match(/\.(mp4|webm|ogg)$/i);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div
                className="relative max-w-4xl w-full h-full max-h-[90vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
                ref={mediaContainerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white text-4xl font-bold bg-gray-800 bg-opacity-70 rounded-full w-12 h-12 flex items-center justify-center z-10 hover:bg-gray-700 transition"
                    aria-label="Cerrar visor de medios"
                >
                    &times;
                </button>

                {isVideo ? (
                    <video
                        src={currentMedia.url}
                        controls
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        // alt="Video del post" // alt no es un atributo válido para <video>
                    >
                        Tu navegador no soporta la etiqueta de video.
                    </video>
                ) : (
                    <img
                        src={currentMedia.url}
                        alt={`Media ${currentMediaIndex + 1}`}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => { // Tipado para SyntheticEvent
                            const target = e.target as HTMLImageElement; // Casteo para acceder a src
                            target.onerror = null;
                            target.src = 'https://placehold.co/600x400/333/eee?text=Error+al+cargar+imagen';
                        }}
                    />
                )}

                {validMedia.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-5xl bg-gray-800 bg-opacity-70 rounded-full w-16 h-16 flex items-center justify-center hover:bg-gray-700 transition z-10"
                            aria-label="Medio anterior"
                        >
                            &lsaquo;
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-5xl bg-gray-800 bg-opacity-70 rounded-full w-16 h-16 flex items-center justify-center hover:bg-gray-700 transition z-10"
                            aria-label="Medio siguiente"
                        >
                            &rsaquo;
                        </button>
                    </>
                )}

                {validMedia.length > 1 && (
                    <div className="absolute bottom-4 text-white bg-gray-800 bg-opacity-70 px-4 py-2 rounded-full text-lg">
                        {currentMediaIndex + 1} / {validMedia.length}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MediaViewer;