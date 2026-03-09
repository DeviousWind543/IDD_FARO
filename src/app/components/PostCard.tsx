'use client';
import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Heart, MessageCircle, Share2, MoreHorizontal, Edit, Trash2, Send, X,
  ChevronLeft, ChevronRight, User as UserIcon // Importar UserIcon para evitar conflicto con el tipo User
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const BASE_SERVER_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';

export interface MediaItem {
  url: string;
  type: string; // 'image' | 'video'
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Post { // Exportado para ser usado en TeacherPanel.tsx
  id: string;
  title: string;
  content: string;
  user_id: string;
  user_name: string;
  user_photo_url?: string | null; // Acepta string, null, o undefined
  media_urls: MediaItem[];
  likes: { user_id: string; post_id: string }[];
  comments: Comment[];
  created_at: string;
}

interface PostCardProps {
  post: Post;
  currentUserId: string | number | null; // Asegúrate de que el tipo sea consistente
  onDeletePost: (post: Post) => void; // CAMBIO AQUÍ: Ahora espera el objeto Post completo
  onStartEditPost: (post: Post) => void;
  onOpenMediaViewer: (media: MediaItem[], initialIndex: number) => void;
  socket: any; // Considera tipar esto más específicamente si es posible (Socket de socket.io-client)
  onLikeToggle: (postId: string) => void;
  onAddComment: (postId: string, content: string) => void;
  onDeleteComment: (commentId: string, postId: string) => void; // Actualizado el orden de los parámetros
  onUpdateComment: (commentId: string, postId: string, content: string) => void; // Actualizado el orden de los parámetros
  currentUserRole?: number; // ¡CORRECCIÓN DE ERROR! Añadido para resolver el error de tipado.
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onDeletePost, // onDeletePost ahora es el objeto Post completo
  onStartEditPost,
  onOpenMediaViewer,
  socket,
  onLikeToggle,
  onAddComment,
  onDeleteComment,
  onUpdateComment,
  currentUserRole, // Recibido aquí
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState<boolean>(false);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [showComments, setShowComments] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentContent, setNewCommentContent] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState<string>('');
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [currentDisplayedMediaIndex, setCurrentDisplayedMediaIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState<boolean>(false);

  const userIdAsNumber = Number(currentUserId);
  const isPostOwner = post.user_id && String(post.user_id) === String(currentUserId);

  // Utilidad para construir la URL de imagen/video
  const getFullImageUrl = useCallback((url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_SERVER_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }, []);

  const currentMedia =
    post.media_urls && post.media_urls.length > 0
      ? post.media_urls[currentDisplayedMediaIndex]
      : null;

  const mediaToDisplayUrl = currentMedia ? getFullImageUrl(currentMedia.url) : null;
  const currentMediaType = currentMedia
    ? currentMedia.type ||
      (mediaToDisplayUrl?.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image')
    : null;

  const handlePostMenuToggle = () => setShowMenu((prev) => !prev);

  const goToNextMedia = () => {
    if (post.media_urls && post.media_urls.length > 1) {
      setCurrentDisplayedMediaIndex((prevIndex) => (prevIndex + 1) % post.media_urls.length);
    }
  };

  const goToPrevMedia = () => {
    if (post.media_urls && post.media_urls.length > 1) {
      setCurrentDisplayedMediaIndex(
        (prevIndex) => (prevIndex - 1 + post.media_urls.length) % post.media_urls.length
      );
    }
  };

  // --- LIKE ---
  const fetchLikeStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!currentUserId || !token) {
      setHasLiked(false);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/likes/check/${post.id}/${userIdAsNumber}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHasLiked(res.data.liked);
    } catch (error) {
      setHasLiked(false);
    }
  }, [post.id, userIdAsNumber, currentUserId]);

  const fetchLikeCount = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_BASE_URL}/likes/count/${post.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setLikeCount(res.data.like_count);
    } catch (error) {
      setLikeCount(0);
    }
  }, [post.id]);

  const handleLikeToggle = async () => {
    const token = localStorage.getItem('token');
    if (!currentUserId || !token) {
      toast.error('Debes iniciar sesión para dar "me gusta".');
      return;
    }
    try {
      setHasLiked((prev) => !prev);
      setLikeCount((prev) => (hasLiked ? prev - 1 : prev + 1));
      await axios.post(
        `${API_BASE_URL}/likes/toggle`,
        {
          post_id: post.id,
          user_id: userIdAsNumber,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      setHasLiked((prev) => !prev);
      setLikeCount((prev) => (hasLiked ? prev + 1 : prev - 1));
      toast.error('Error al procesar el "me gusta".');
    }
  };

  // --- COMMENTS ---
  const fetchComments = useCallback(async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_BASE_URL}/comments/post/${post.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setComments(res.data);
      setCommentCount(res.data.length);
    } catch (error) {
      setComments([]);
      setCommentCount(0);
    }
  }, [post.id]);

  const handleAddComment = async (e: FormEvent) => {
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
      await axios.post(
        `${API_BASE_URL}/comments`,
        {
          post_id: post.id,
          content: newCommentContent,
          user_id: userIdAsNumber, // Ensure user_id is sent for the comment
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNewCommentContent('');
      toast.success('Comentario añadido exitosamente.');
      // Call the prop function to inform the parent (ManagerPanel) to re-fetch or update
      // The parent will then handle socket updates or direct re-fetching
      onAddComment(post.id, newCommentContent); // Pass post.id and content
    } catch (error) {
      toast.error('Error al añadir comentario.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Debes iniciar sesión para eliminar comentarios.');
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComments((prevComments) => prevComments.filter((comment) => comment.id !== commentId));
      setCommentCount((prevCount) => prevCount - 1);
      toast.success('Comentario eliminado exitosamente.');
      onDeleteComment(commentId, post.id); // Call the prop function, updated parameter order
    } catch (error) {
      toast.error('Error al eliminar comentario.');
    }
  };

  const handleStartEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentContent(comment.content);
    setOpenCommentMenuId(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentContent('');
  };

  const handleUpdateComment = async (e: FormEvent, commentId: string) => {
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
      await axios.put(
        `${API_BASE_URL}/comments/${commentId}`,
        { content: editingCommentContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingCommentId(null);
      setEditingCommentContent('');
      toast.success('Comentario actualizado exitosamente.');
      onUpdateComment(commentId, post.id, editingCommentContent); // Call the prop function, updated parameter order
    } catch (error) {
      toast.error('Error al actualizar comentario.');
    }
  };

  const handleCommentMenuToggle = (commentId: string) => {
    setOpenCommentMenuId(openCommentMenuId === commentId ? null : commentId);
  };

  const handleMediaClickInternal = useCallback((initialIndex = 0) => {
    if (onOpenMediaViewer && post.media_urls && post.media_urls.length > 0) {
      const fullMediaUrls = post.media_urls.map((media) => ({
        ...media,
        url: getFullImageUrl(media.url) || '', // Asegura que url no sea null para MediaItem
      }));
      onOpenMediaViewer(fullMediaUrls, initialIndex);
    }
  }, [onOpenMediaViewer, post.media_urls, getFullImageUrl]);

  // --- SOCKET.IO EVENTOS ---
  useEffect(() => {
    fetchLikeCount();
    fetchComments();
    if (currentUserId) {
      fetchLikeStatus();
    }

    if (socket) {
      const handleLikeUpdate = ({ postId, likeCount }: { postId: string; likeCount: number }) => {
        if (postId === post.id) {
          setLikeCount(likeCount);
        }
      };

      const handleCommentAdded = ({ postId, comment }: { postId: string; comment: Comment }) => {
        if (postId === post.id) {
          setComments((prevComments) => [...prevComments, comment]);
          setCommentCount((prevCount) => prevCount + 1);
        }
      };

      const handleCommentUpdated = ({ postId, comment }: { postId: string; comment: Comment }) => {
        if (postId === post.id) {
          setComments((prevComments) =>
            prevComments.map((c) => (c.id === comment.id ? comment : c))
          );
        }
      };

      const handleCommentDeleted = ({
        postId,
        commentId,
      }: {
        postId: string;
        commentId: string;
      }) => {
        if (postId === post.id) {
          setComments((prevComments) => prevComments.filter((c) => c.id !== commentId));
          setCommentCount((prevCount) => prevCount - 1);
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
    // eslint-disable-next-line
  }, [socket, post.id, currentUserId, fetchLikeCount, fetchComments, fetchLikeStatus]);

  // --- DESCRIPCION "Ver más/menos" ---
  const renderDescription = () => {
    if (!post.content) return null;
    // Mostrar solo 3 líneas
    if (!showFullDescription) {
      // Limita a 180 caracteres aprox como 3 líneas móviles (~60 chars/line)
      const shortText =
        post.content.length > 180 ? post.content.slice(0, 180).trimEnd() : post.content;
      const showVerMas = post.content.length > 180;
      return (
        <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-line break-words">
          {shortText}
          {showVerMas && (
            <>
              ...{' '}
              <button
                onClick={() => setShowFullDescription(true)}
                className="inline text-yellow-600 hover:underline font-semibold"
                type="button"
              >
                Ver más
              </button>
            </>
          )}
        </p>
      );
    } else {
      return (
        <p className="text-gray-700 mb-4 leading-relaxed whitespace-pre-line break-words">
          {post.content}{' '}
          <button
            onClick={() => setShowFullDescription(false)}
            className="inline text-yellow-600 hover:underline font-semibold"
            type="button"
          >
            Ver menos
          </button>
        </p>
      );
    }
  };

  // --- UI ---
  return (
    <div className="bg-white rounded-lg shadow-lg relative w-full overflow-hidden flex flex-col mb-4 max-w-md md:max-w-2xl mx-auto"> {/* Added max-w-md md:max-w-2xl mx-auto here */}
      <div className="flex items-center p-4 pb-0">
        <img
          src={
            getFullImageUrl(post.user_photo_url) || // Modificado para aceptar null/undefined
            'https://placehold.co/50x50/4a5568/cbd5e0?text=👤'
          }
          alt="Avatar del Creador"
          className="w-12 h-12 rounded-full mr-4 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).onerror = null;
            (e.target as HTMLImageElement).src =
              'https://placehold.co/50x50/4a5568/cbd5e0?text=👤';
          }}
        />
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {post.user_name || 'Usuario desconocido'}
          </h3>
          <p className="text-sm text-gray-500">{new Date(post.created_at).toLocaleString()}</p>
        </div>

        {isPostOwner && (
          <div className="absolute top-4 right-4">
            <button
              onClick={handlePostMenuToggle}
              className="text-gray-600 hover:text-gray-900 focus:outline-none text-2xl p-1"
              aria-label="Opciones de publicación"
              type="button"
            >
              &#8942;
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10">
                <button
                  onClick={() => {
                    onStartEditPost(post);
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  type="button"
                >
                  Editar Publicación
                </button>
                <button
                  onClick={() => {
                    onDeletePost(post); // CAMBIO AQUÍ: Ahora pasamos el objeto Post completo
                    setShowMenu(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  type="button"
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
        {renderDescription()}
      </div>

      {mediaToDisplayUrl && (
        <div className="w-full bg-gray-100 flex justify-center items-center overflow-hidden cursor-pointer relative group">
          {currentMediaType === 'video' ? (
            <video
              src={mediaToDisplayUrl}
              controls
              className="w-full h-auto object-cover max-h-96"
              onClick={() => handleMediaClickInternal(currentDisplayedMediaIndex)} // Llamada corregida
            >
              Tu navegador no soporta la etiqueta de video.
            </video>
          ) : (
            <img
              src={mediaToDisplayUrl}
              alt="Imagen del post"
              className="w-full h-auto object-cover max-h-96"
              onError={(e) => {
                (e.target as HTMLImageElement).onerror = null;
                (e.target as HTMLImageElement).src =
                  'https://placehold.co/600x400/333/eee?text=Error+al+cargar+imagen';
              }}
              onClick={() => handleMediaClickInternal(currentDisplayedMediaIndex)} // Llamada corregida
            />
          )}

          {post.media_urls && post.media_urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrevMedia();
                }}
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full text-xl hover:bg-opacity-75 transition"
                aria-label="Medio anterior"
                type="button"
              >
                &lsaquo;
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNextMedia();
                }}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full text-xl hover:bg-opacity-75 transition"
                aria-label="Medio siguiente"
                type="button"
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
          type="button"
        >
          {hasLiked ? '❤️' : '🤍'} <span className="ml-1">{likeCount} Me gusta</span>
        </button>
        <button
          onClick={() => setShowComments((prev) => !prev)}
          className="flex items-center hover:bg-gray-100 px-3 py-1 rounded-full transition-colors"
          type="button"
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
                <div
                  key={comment.id}
                  className="bg-gray-50 p-3 rounded-md shadow-sm flex justify-between items-start relative"
                >
                  {editingCommentId === comment.id ? (
                    <form
                      onSubmit={(e) => handleUpdateComment(e, comment.id)}
                      className="flex-grow flex flex-col space-y-2"
                    >
                      <textarea
                        value={editingCommentContent}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          setEditingCommentContent(e.target.value)
                        }
                        className="w-full p-2 rounded border border-gray-300 text-gray-800"
                        rows={2}
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
                        <p className="font-semibold text-gray-800">
                          {comment.user_name || `Usuario ID: ${comment.user_id}`}
                        </p>
                        <p className="text-gray-700 text-sm">{comment.content}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(comment.created_at).toLocaleString()}
                        </p>
                      </div>
                      {(userIdAsNumber === Number(comment.user_id) || post.user_id === currentUserId) && (
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={() => handleCommentMenuToggle(comment.id)}
                            className="text-gray-500 hover:text-gray-700 focus:outline-none text-xl p-1"
                            aria-label="Opciones del comentario"
                            type="button"
                          >
                            &#8942;
                          </button>
                          {openCommentMenuId === comment.id && (
                            <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                              {userIdAsNumber === Number(comment.user_id) && (
                                <button
                                  onClick={() => handleStartEditComment(comment)}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  type="button"
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                type="button"
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

          <form
          onSubmit={handleAddComment}
          className="mt-4 flex w-full max-w-full gap-2 flex-wrap sm:flex-nowrap"
          autoComplete="off"
        >
          <input
            type="text"
            value={newCommentContent}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setNewCommentContent(e.target.value)
            }
            placeholder="Añadir un comentario..."
            className="flex-grow min-w-0 p-2 rounded-md sm:rounded-l-md sm:rounded-r-none border border-gray-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-gray-800 text-base"
            maxLength={300}
            autoComplete="off"
          />
          <button
            type="submit"
            className="bg-yellow-500 hover:bg-yellow-600 transition text-white px-4 py-2 rounded-md sm:rounded-l-none sm:rounded-r-md text-base font-semibold whitespace-nowrap w-full sm:w-auto"
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
