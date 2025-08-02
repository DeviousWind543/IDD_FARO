'use client'
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const BASE_SERVER_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

const PostCard = ({ post, currentUserId, onDeletePost, onStartEditPost, onOpenMediaViewer, socket }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [hasLiked, setHasLiked] = useState(false);
    const [commentCount, setCommentCount] = useState(0);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [newCommentContent, setNewCommentContent] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentContent, setEditingCommentContent] = useState('');
    const [openCommentMenuId, setOpenCommentMenuId] = useState(null);
    const [currentDisplayedMediaIndex, setCurrentDisplayedMediaIndex] = useState(0);

    const userIdAsNumber = Number(currentUserId);
    const isPostOwner = (post.user_id && post.user_id === userIdAsNumber);

    // Función para construir la URL completa de la imagen
    const getFullImageUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        return `${BASE_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const currentMedia = post.media_urls && post.media_urls.length > 0
        ? post.media_urls[currentDisplayedMediaIndex]
        : null;

    const mediaToDisplayUrl = currentMedia ? getFullImageUrl(currentMedia.url) : null;
    const currentMediaType = currentMedia ? (currentMedia.type || (mediaToDisplayUrl?.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image')) : null;

    // Debugging
    useEffect(() => {
        console.log('Post ID:', post.id);
        console.log('Media URLs:', post.media_urls);
        console.log('Current Media:', currentMedia);
        console.log('Media URL to display:', mediaToDisplayUrl);
        console.log('BASE_SERVER_URL:', BASE_SERVER_URL);
    }, [post.id, mediaToDisplayUrl]);

    const handlePostMenuToggle = () => setShowMenu(!showMenu);

    const goToNextMedia = () => {
        if (post.media_urls && post.media_urls.length > 1) {
            setCurrentDisplayedMediaIndex(prevIndex => (prevIndex + 1) % post.media_urls.length);
        }
    };

    const goToPrevMedia = () => {
        if (post.media_urls && post.media_urls.length > 1) {
            setCurrentDisplayedMediaIndex(prevIndex => (prevIndex - 1 + post.media_urls.length) % post.media_urls.length);
        }
    };

    const fetchLikeStatus = useCallback(async () => {
        const token = localStorage.getItem('token');
        if (!currentUserId || !token) {
            setHasLiked(false);
            return;
        }
        try {
            const res = await axios.get(`${API_BASE_URL}/likes/check/${post.id}/${userIdAsNumber}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHasLiked(res.data.liked);
        } catch (error) {
            console.error('Error fetching like status:', error);
        }
    }, [post.id, userIdAsNumber, currentUserId]);

    const fetchLikeCount = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASE_URL}/likes/count/${post.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setLikeCount(res.data.like_count);
        } catch (error) {
            console.error('Error fetching like count:', error);
        }
    }, [post.id]);

    const handleLikeToggle = async () => {
        const token = localStorage.getItem('token');
        if (!currentUserId || !token) {
            toast.error('Debes iniciar sesión para dar "me gusta".');
            return;
        }
        try {
            setHasLiked(prev => !prev);
            setLikeCount(prev => (hasLiked ? prev - 1 : prev + 1));

            await axios.post(`${API_BASE_URL}/likes/toggle`, {
                post_id: post.id,
                user_id: userIdAsNumber,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Error toggling like:', error);
            setHasLiked(prev => !prev);
            setLikeCount(prev => (hasLiked ? prev + 1 : prev - 1));
            toast.error('Error al procesar el "me gusta".');
        }
    };

    const fetchComments = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            const res = await axios.get(`${API_BASE_URL}/comments/post/${post.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setComments(res.data);
            setCommentCount(res.data.length);
        } catch (error) {
            console.error('Error fetching comments:', error);
            toast.error('Error al obtener comentarios.');
        }
    }, [post.id]);

    const handleAddComment = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!currentUserId || !token) {
            toast.error('Debes iniciar sesión para comentar.');
            return;
        }
        if (!newCommentContent.trim()) {
            toast.warn('El comentario no puede estar vacío.');
            return;
        }
        try {
            await axios.post(`${API_BASE_URL}/comments`, {
                post_id: post.id,
                content: newCommentContent,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNewCommentContent('');
            toast.success('Comentario añadido exitosamente.');
        } catch (error) {
            console.error('Error adding comment:', error);
            toast.error('Error al añadir comentario.');
        }
    };

    const handleDeleteComment = async (commentId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Debes iniciar sesión para eliminar comentarios.');
            return;
        }
        try {
            await axios.delete(`${API_BASE_URL}/comments/${commentId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Comentario eliminado exitosamente.');
        } catch (error) {
            console.error('Error deleting comment:', error);
            toast.error('Error al eliminar comentario.');
        }
    };

    const handleStartEditComment = (comment) => {
        setEditingCommentId(comment.id);
        setEditingCommentContent(comment.content);
        setOpenCommentMenuId(null);
    };

    const handleCancelEditComment = () => {
        setEditingCommentId(null);
        setEditingCommentContent('');
    };

    const handleUpdateComment = async (e, commentId) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Debes iniciar sesión para actualizar comentarios.');
            return;
        }
        if (!editingCommentContent.trim()) {
            toast.warn('El comentario no puede estar vacío.');
            return;
        }
        try {
            await axios.put(`${API_BASE_URL}/comments/${commentId}`, {
                content: editingCommentContent,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingCommentId(null);
            setEditingCommentContent('');
            toast.success('Comentario actualizado exitosamente.');
        } catch (error) {
            console.error('Error updating comment:', error);
            toast.error('Error al actualizar comentario.');
        }
    };

    const handleCommentMenuToggle = (commentId) => {
        setOpenCommentMenuId(openCommentMenuId === commentId ? null : commentId);
    };

    const handleMediaClick = (initialIndex = 0) => {
        if (onOpenMediaViewer && post.media_urls && post.media_urls.length > 0) {
            // Pasar las URLs completas al visor de medios
            const fullMediaUrls = post.media_urls.map(media => ({
                ...media,
                url: getFullImageUrl(media.url)
            }));
            onOpenMediaViewer(fullMediaUrls, initialIndex);
        }
    };

    useEffect(() => {
        fetchLikeCount();
        fetchComments();
        if (currentUserId) {
            fetchLikeStatus();
        }

        if (socket) {
            const handleLikeUpdate = ({ postId, likeCount }) => {
                if (postId === post.id) {
                    setLikeCount(likeCount);
                }
            };

            const handleCommentAdded = ({ postId, comment }) => {
                if (postId === post.id) {
                    setComments(prevComments => [...prevComments, comment]);
                    setCommentCount(prevCount => prevCount + 1);
                }
            };

            const handleCommentUpdated = ({ postId, comment }) => {
                if (postId === post.id) {
                    setComments(prevComments =>
                        prevComments.map(c => (c.id === comment.id ? comment : c))
                    );
                }
            };

            const handleCommentDeleted = ({ postId, commentId }) => {
                if (postId === post.id) {
                    setComments(prevComments => prevComments.filter(c => c.id !== commentId));
                    setCommentCount(prevCount => prevCount - 1);
                }
            };

            socket.on('post-like-updated', handleLikeUpdate);
            socket.on('post-comment-added', handleCommentAdded);
            socket.on('post-comment-updated', handleCommentUpdated);
            socket.on('post-comment-deleted', handleCommentDeleted);

            return () => {
                socket.off('post-like-updated', handleLikeUpdate);
                socket.off('post-comment-added', handleCommentAdded);
                socket.off('post-comment-updated', handleCommentUpdated);
                socket.off('post-comment-deleted', handleCommentDeleted);
            };
        }
    }, [post.id, currentUserId, fetchLikeCount, fetchComments, fetchLikeStatus, socket]);

    return (
        <div className="bg-white rounded-lg shadow-lg relative w-full overflow-hidden flex flex-col mb-4">
            <div className="flex items-center p-4 pb-0">
                <img
                    src={getFullImageUrl(post.user_photo_url) || "https://placehold.co/50x50/4a5568/cbd5e0?text=👤"}
                    alt="Avatar del Creador"
                    className="w-12 h-12 rounded-full mr-4 object-cover"
                    onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://placehold.co/50x50/4a5568/cbd5e0?text=👤';
                    }}
                />
                <div>
                    <h3 className="text-lg font-semibold text-gray-800">{post.user_name || 'Usuario desconocido'}</h3>
                    <p className="text-sm text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
                </div>

                {isPostOwner && (
                    <div className="absolute top-4 right-4">
                        <button
                            onClick={handlePostMenuToggle}
                            className="text-gray-600 hover:text-gray-900 focus:outline-none text-2xl p-1"
                            aria-label="Opciones de publicación"
                        >
                            &#8942;
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                                <button
                                    onClick={() => { onStartEditPost(post); setShowMenu(false); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    Editar Publicación
                                </button>
                                <button
                                    onClick={() => { onDeletePost(post.id); setShowMenu(false); }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    Eliminar Publicación
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 pt-2 flex-grow">
                <h2 className="text-xl font-bold mb-2 text-gray-900">{post.title}</h2>
                <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-line">{post.content}</p>
            </div>

            {mediaToDisplayUrl && (
                <div className="w-full bg-gray-100 flex justify-center items-center overflow-hidden cursor-pointer relative group">
                    {currentMediaType === 'video' ? (
                        <video
                            src={mediaToDisplayUrl}
                            controls
                            className="w-full h-auto object-cover max-h-96"
                            alt="Video del post"
                            onClick={() => handleMediaClick(currentDisplayedMediaIndex)}
                        >
                            Tu navegador no soporta la etiqueta de video.
                        </video>
                    ) : (
                        <img
                            src={mediaToDisplayUrl}
                            alt="Imagen del post"
                            className="w-full h-auto object-cover max-h-96"
                            onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://placehold.co/600x400/333/eee?text=Error+al+cargar+imagen';
                                console.error(`Error loading image: ${mediaToDisplayUrl}`);
                            }}
                            onClick={() => handleMediaClick(currentDisplayedMediaIndex)}
                        />
                    )}

                    {post.media_urls && post.media_urls.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToPrevMedia(); }}
                                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full text-xl hover:bg-opacity-75 transition"
                                aria-label="Medio anterior"
                            >
                                &lsaquo;
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); goToNextMedia(); }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full text-xl hover:bg-opacity-75 transition"
                                aria-label="Medio siguiente"
                            >
                                &rsaquo;
                            </button>
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                                {currentDisplayedMediaIndex + 1} / {post.media_urls.length}
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="mt-auto p-4 border-t border-gray-200 flex justify-around text-gray-600 text-base">
                <button
                    onClick={handleLikeToggle}
                    className={`flex items-center px-3 py-1 rounded-full transition-colors ${
                        hasLiked ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
                    }`}
                >
                    {hasLiked ? '❤️' : '🤍'} <span className="ml-1">{likeCount} Me gusta</span>
                </button>
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center hover:bg-gray-100 px-3 py-1 rounded-full transition-colors"
                >
                    💬 <span className="ml-1">{commentCount} Comentarios</span>
                </button>
            </div>

            {showComments && (
                <div className="mt-0 p-4 border-t border-gray-200">
                    <h4 className="text-lg font-semibold mb-3 text-gray-800">Comentarios</h4>
                    {comments.length === 0 ? (
                        <p className="text-gray-600 mb-4">Sé el primero en comentar.</p>
                    ) : (
                        <div className="space-y-3 mb-4">
                            {comments.map((comment) => (
                                <div key={comment.id} className="bg-gray-50 p-3 rounded-md shadow-sm flex justify-between items-start relative">
                                    {editingCommentId === comment.id ? (
                                        <form onSubmit={(e) => handleUpdateComment(e, comment.id)} className="flex-grow flex flex-col space-y-2">
                                            <textarea
                                                value={editingCommentContent}
                                                onChange={(e) => setEditingCommentContent(e.target.value)}
                                                className="w-full p-2 rounded border border-gray-300 text-gray-800"
                                                rows="2"
                                                required
                                            ></textarea>
                                            <div className="flex space-x-2 mt-2">
                                                <button
                                                    type="submit"
                                                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEditComment}
                                                    className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500 text-sm"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="font-semibold text-gray-800">{comment.user_name || `Usuario ID: ${comment.user_id}`}</p>
                                                <p className="text-gray-700 text-sm">{comment.content}</p>
                                                <p className="text-xs text-gray-500 mt-1">{new Date(comment.created_at).toLocaleString()}</p>
                                            </div>
                                            {((userIdAsNumber === comment.user_id) || isPostOwner) && (
                                                <div className="absolute top-2 right-2">
                                                    <button
                                                        onClick={() => handleCommentMenuToggle(comment.id)}
                                                        className="text-gray-500 hover:text-gray-700 focus:outline-none text-xl p-1"
                                                        aria-label="Opciones del comentario"
                                                    >
                                                        &#8942;
                                                    </button>
                                                    {openCommentMenuId === comment.id && (
                                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                                            {userIdAsNumber === comment.user_id && (
                                                                <button
                                                                    onClick={() => handleStartEditComment(comment)}
                                                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                >
                                                                    Editar
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleAddComment} className="mt-4 flex">
                        <input
                            type="text"
                            value={newCommentContent}
                            onChange={(e) => setNewCommentContent(e.target.value)}
                            placeholder="Añadir un comentario..."
                            className="flex-grow p-2 rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-800"
                        />
                        <button
                            type="submit"
                            className="bg-yellow-500 text-white px-4 py-2 rounded-r-md hover:bg-yellow-600 transition"
                        >
                            Comentar
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default PostCard;