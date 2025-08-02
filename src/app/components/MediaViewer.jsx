'use client'
import React, { useState, useEffect, useCallback, useRef } from 'react';

const MediaViewer = ({ mediaUrls = [], currentIndex = 0, onClose }) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(currentIndex);
    const mediaContainerRef = useRef(null);
    const touchStartX = useRef(0);
    const touchEndX = useRef(0);

    // Función para construir la URL completa
    const getFullImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `http://localhost:3001${url.startsWith('/') ? '' : '/'}${url}`;
    };

    // Filtrar medios válidos y construir URLs completas
    const validMedia = mediaUrls
        .filter(media => media && media.url)
        .map(media => ({
            ...media,
            url: getFullImageUrl(media.url)
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
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') goToNext();
            else if (e.key === 'ArrowLeft') goToPrev();
            else if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrev, onClose]);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e) => {
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
                        alt="Video del post"
                    >
                        Tu navegador no soporta la etiqueta de video.
                    </video>
                ) : (
                    <img
                        src={currentMedia.url}
                        alt={`Media ${currentMediaIndex + 1}`}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://placehold.co/600x400/333/eee?text=Error+al+cargar+imagen';
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