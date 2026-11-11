import React, { useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Search,
  LogOut,
  Sparkles,
  Brain,
  RotateCcw,
  Volume2,
  Check,
  X,
  User as UserIcon,
  Mail,
  Lock,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Filter
} from 'lucide-react';

export interface WordItem {
  id: string;
  english: string;
  korean: string;
  example?: string;
  category?: string;
  memorized: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const CATEGORIES = ['일상', '비즈니스', 'TOEIC/TOEFL', '수능/학업', '여행', '기타'];

const SAMPLE_WORDS = [
  {
    english: 'resilient',
    korean: '회복력 있는, 탄력 있는',
    example: 'She is a resilient leader who adapts quickly to changes.',
    category: '비즈니스',
    memorized: false
  },
  {
    english: 'ubiquitous',
    korean: '어디에나 있는, 아주 흔한',
    example: 'Smartphones have become ubiquitous in modern life.',
    category: 'TOEIC/TOEFL',
    memorized: false
  },
  {
    english: 'serendipity',
    korean: '뜻밖의 행운, 우연한 발견',
    example: 'Finding that cozy cafe was pure serendipity.',
    category: '일상',
    memorized: true
  },
  {
    english: 'eloquent',
    korean: '유창한, 설득력 있는',
    example: 'He gave an eloquent speech at the conference.',
    category: '수능/학업',
    memorized: false
  },
  {
    english: 'itinerary',
    korean: '여행 일정표',
    example: 'We planned a detailed itinerary for our trip to London.',
    category: '여행',
    memorized: false
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Auth form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Vocabulary data states
  const [words, setWords] = useState<WordItem[]>([]);
  const [wordsLoading, setWordsLoading] = useState(false);
  const [dbError, setDbError] = useState('');

  // UI view states
  const [activeTab, setActiveTab] = useState<'list' | 'flashcard' | 'quiz'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unmemorized' | 'memorized'>('all');

  // Word Form / Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
  const [formEnglish, setFormEnglish] = useState('');
  const [formKorean, setFormKorean] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formCategory, setFormCategory] = useState('일상');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Flashcard states
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz states
  const [quizQuestions, setQuizQuestions] = useState<{
    word: WordItem;
    options: string[];
    correctAnswer: string;
  }[]>([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          await setDoc(
            userRef,
            {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || '',
              photoURL: currentUser.photoURL || '',
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Failed to sync user profile:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to User's Words in Firestore: users/{userId}/words
  useEffect(() => {
    if (!user) {
      setWords([]);
      return;
    }

    setWordsLoading(true);
    setDbError('');
    const wordsRef = collection(db, 'users', user.uid, 'words');
    const q = query(wordsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: WordItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            english: data.english || '',
            korean: data.korean || '',
            example: data.example || '',
            category: data.category || '기타',
            memorized: Boolean(data.memorized),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
        });
        setWords(fetched);
        setWordsLoading(false);
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        setDbError('데이터를 불러오는 중 오류가 발생했습니다: ' + error.message);
        setWordsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Auth Handlers
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('이미 사용 중인 이메일입니다.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('비밀번호는 최소 6자 이상이어야 합니다.');
      } else {
        setAuthError(err.message || '인증 중 오류가 발생했습니다.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setAuthSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/unauthorized-domain') {
        setAuthError('현재 도메인이 Firebase 승인된 도메인(Authorized domains)에 등록되어 있지 않습니다. Firebase 콘솔에서 도메인을 추가해주세요.');
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Word CRUD Handlers
  const openAddModal = () => {
    setEditingWord(null);
    setFormEnglish('');
    setFormKorean('');
    setFormExample('');
    setFormCategory('일상');
    setIsModalOpen(true);
  };

  const openEditModal = (word: WordItem) => {
    setEditingWord(word);
    setFormEnglish(word.english);
    setFormKorean(word.korean);
    setFormExample(word.example || '');
    setFormCategory(word.category || '기타');
    setIsModalOpen(true);
  };

  const handleSaveWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formEnglish.trim() || !formKorean.trim()) return;

    setFormSubmitting(true);
    try {
      const wordsRef = collection(db, 'users', user.uid, 'words');

      if (editingWord) {
        const wordDocRef = doc(db, 'users', user.uid, 'words', editingWord.id);
        await updateDoc(wordDocRef, {
          english: formEnglish.trim(),
          korean: formKorean.trim(),
          example: formExample.trim(),
          category: formCategory,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(wordsRef, {
          english: formEnglish.trim(),
          korean: formKorean.trim(),
          example: formExample.trim(),
          category: formCategory,
          memorized: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert('저장 실패: ' + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteWord = async (wordId: string) => {
    if (!user) return;
    if (!window.confirm('이 단어를 삭제하시겠습니까?')) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid, 'words', wordId));
    } catch (err: any) {
      alert('삭제 실패: ' + err.message);
    }
  };

  const handleToggleMemorized = async (word: WordItem) => {
    if (!user) return;
    try {
      const wordDocRef = doc(db, 'users', user.uid, 'words', word.id);
      await updateDoc(wordDocRef, {
        memorized: !word.memorized,
        updatedAt: serverTimestamp()
      });
    } catch (err: any) {
      alert('상태 변경 실패: ' + err.message);
    }
  };

  const handleAddSampleWords = async () => {
    if (!user) return;
    setWordsLoading(true);
    try {
      const wordsRef = collection(db, 'users', user.uid, 'words');
      for (const item of SAMPLE_WORDS) {
        await addDoc(wordsRef, {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      alert('샘플 단어 추가 실패: ' + err.message);
    } finally {
      setWordsLoading(false);
    }
  };

  // Speech synthesis helper
  const speakWord = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Filtered Words
  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      const matchesSearch =
        w.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.korean.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.example && w.example.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = selectedCategory === '전체' || w.category === selectedCategory;
      const matchesStatus =
        filterStatus === 'all'
          ? true
          : filterStatus === 'memorized'
          ? w.memorized
          : !w.memorized;
      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [words, searchQuery, selectedCategory, filterStatus]);

  // Reset card index when filtered words change
  useEffect(() => {
    setCardIndex(0);
    setIsFlipped(false);
  }, [filteredWords.length, activeTab]);

  // Generate Quiz
  const startQuiz = () => {
    if (words.length === 0) return;

    const shuffled = [...words].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(10, shuffled.length));

    const fallbackPool = [
      '성취하다, 달성하다',
      '일시적인, 임시의',
      '필수적인, 극히 중요한',
      '자발적인, 즉흥적인',
      '다양한, 다채로운',
      '명백한, 분명한',
      '지속 가능한',
      '협력하다, 공동 작업하다'
    ];

    const questions = selected.map((target) => {
      const otherMeanings = words
        .filter((w) => w.id !== target.id && w.korean !== target.korean)
        .map((w) => w.korean);

      const distractorsPool = [...otherMeanings, ...fallbackPool.filter((f) => f !== target.korean)];
      const uniqueDistractors = Array.from(new Set(distractorsPool))
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const options = [...uniqueDistractors, target.korean].sort(() => Math.random() - 0.5);
      return {
        word: target,
        options,
        correctAnswer: target.korean
      };
    });

    setQuizQuestions(questions);
    setCurrentQuizIdx(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  useEffect(() => {
    if (activeTab === 'quiz') {
      startQuiz();
    }
  }, [activeTab]);

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(option);
    if (option === quizQuestions[currentQuizIdx].correctAnswer) {
      setQuizScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuizIdx + 1 < quizQuestions.length) {
      setCurrentQuizIdx((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      setQuizFinished(true);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600 font-medium">English Quiz 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Auth Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-4">
            <GraduationCap className="w-9 h-9" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            English Quiz
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            나만의 클라우드 영어 단어장 & 스마트 학습 웹앱
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-2xl border border-slate-100 sm:px-10">
            <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  !isSignUp
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  isSignUp
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                회원가입
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    이름 (닉네임)
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="홍길동"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  이메일 주소
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6자 이상 입력"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-100 transition-all disabled:opacity-50"
              >
                {authSubmitting
                  ? '처리 중...'
                  : isSignUp
                  ? '이메일로 회원가입'
                  : '이메일로 로그인'}
              </button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-slate-400">또는 간편 로그인</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={authSubmitting}
                className="mt-4 w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google 계정으로 계속하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged In -> Main Dashboard
  const memorizedCount = words.filter((w) => w.memorized).length;
  const progressPercent = words.length > 0 ? Math.round((memorizedCount / words.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg leading-tight">English Quiz</h1>
              <p className="text-xs text-slate-500">나만의 개인 단어장</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <UserIcon className="w-4 h-4 text-indigo-600" />
              )}
              <span>{user.displayName || user.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats & Progress Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">전체 등록 단어</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{words.length}개</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">암기 완료</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{memorizedCount}개</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">학습 달성률</p>
              <span className="text-sm font-bold text-indigo-600">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="inline-flex bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              단어장 관리
            </button>
            <button
              onClick={() => setActiveTab('flashcard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'flashcard'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              플래시카드
            </button>
            <button
              onClick={() => setActiveTab('quiz')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'quiz'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Brain className="w-4 h-4" />
              단어 퀴즈
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm shadow-indigo-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            새 단어 추가
          </button>
        </div>

        {dbError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {dbError}
          </div>
        )}

        {/* TAB 1: Word List & CRUD */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="영단어, 한국어 뜻, 예문 검색..."
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mr-1">
                  <Filter className="w-3.5 h-3.5" />
                  필터:
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="전체">모든 카테고리</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">전체 상태</option>
                  <option value="unmemorized">미암기 단어만</option>
                  <option value="memorized">암기 완료만</option>
                </select>
              </div>
            </div>

            {/* Word Cards List */}
            {wordsLoading ? (
              <div className="py-16 text-center text-slate-500 text-sm">단어장을 불러오는 중...</div>
            ) : words.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">아직 등록된 단어가 없습니다</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    직접 영어 단어를 추가하거나 샘플 단어 5개를 추가해 학습을 시작해보세요!
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={openAddModal}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all"
                  >
                    + 첫 단어 직접 추가하기
                  </button>
                  <button
                    onClick={handleAddSampleWords}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all"
                  >
                    샘플 단어 5개 자동 추가
                  </button>
                </div>
              </div>
            ) : filteredWords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center text-slate-500 text-sm">
                검색 조건에 맞는 단어가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredWords.map((word) => (
                  <div
                    key={word.id}
                    className={`bg-white rounded-2xl border p-5 transition-all hover:shadow-md flex flex-col justify-between gap-4 ${
                      word.memorized ? 'border-emerald-200/80 bg-emerald-50/10' : 'border-slate-200/80'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-600">
                            {word.category || '기타'}
                          </span>
                          {word.memorized && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                              암기완료
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleMemorized(word)}
                            title={word.memorized ? '미암기로 표시' : '암기 완료로 표시'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              word.memorized
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                            }`}
                          >
                            {word.memorized ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditModal(word)}
                            title="단어 수정"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteWord(word.id)}
                            title="단어 삭제"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <h3 className="text-xl font-bold text-slate-900">{word.english}</h3>
                        <button
                          onClick={() => speakWord(word.english)}
                          title="발음 듣기"
                          className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      <p className="text-base font-semibold text-indigo-950">{word.korean}</p>

                      {word.example && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          "{word.example}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Flashcard Study Mode */}
        {activeTab === 'flashcard' && (
          <div className="max-w-xl mx-auto py-4">
            {filteredWords.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <p className="text-slate-600 font-medium">학습할 단어가 없습니다.</p>
                <button
                  onClick={() => setActiveTab('list')}
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  단어장 목록으로 돌아가기
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>
                    카드 {cardIndex + 1} / {filteredWords.length}
                  </span>
                  <span>카드를 클릭하면 뜻이 나타납니다</span>
                </div>

                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="cursor-pointer bg-white rounded-3xl border border-slate-200 shadow-lg p-10 min-h-[300px] flex flex-col items-center justify-center text-center transition-all hover:border-indigo-300 select-none relative"
                >
                  <span className="absolute top-5 left-5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">
                    {filteredWords[cardIndex]?.category || '기타'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakWord(filteredWords[cardIndex]?.english || '');
                    }}
                    className="absolute top-5 right-5 p-2 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>

                  {!isFlipped ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        ENGLISH WORD
                      </p>
                      <h2 className="text-4xl font-extrabold text-slate-900">
                        {filteredWords[cardIndex]?.english}
                      </h2>
                      <p className="text-xs text-slate-400 pt-4">클릭해서 한국어 뜻 확인하기</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
                        MEANING
                      </p>
                      <h3 className="text-3xl font-bold text-slate-900">
                        {filteredWords[cardIndex]?.korean}
                      </h3>
                      {filteredWords[cardIndex]?.example && (
                        <p className="text-sm text-slate-600 italic max-w-md mx-auto pt-2">
                          "{filteredWords[cardIndex]?.example}"
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev > 0 ? prev - 1 : filteredWords.length - 1));
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    이전
                  </button>

                  <button
                    onClick={() => handleToggleMemorized(filteredWords[cardIndex])}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-2 ${
                      filteredWords[cardIndex]?.memorized
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {filteredWords[cardIndex]?.memorized ? '암기 완료됨' : '암기 완료 체크'}
                  </button>

                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev + 1 < filteredWords.length ? prev + 1 : 0));
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                  >
                    다음
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Multiple Choice Quiz Mode */}
        {activeTab === 'quiz' && (
          <div className="max-w-xl mx-auto py-4">
            {words.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <p className="text-slate-600 font-medium">
                  퀴즈를 진행하려면 먼저 단어를 1개 이상 추가해주세요!
                </p>
                <button
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                >
                  단어 추가하러 가기
                </button>
              </div>
            ) : quizFinished ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Brain className="w-9 h-9" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900">퀴즈 완료!</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    총 {quizQuestions.length}문제 중{' '}
                    <span className="text-indigo-600 font-bold">{quizScore}문제</span>를 맞혔습니다.
                  </p>
                </div>

                <div className="text-4xl font-black text-indigo-600">
                  {Math.round((quizScore / quizQuestions.length) * 100)}점
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={startQuiz}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                  >
                    <RotateCcw className="w-4 h-4" />
                    다시 풀기
                  </button>
                  <button
                    onClick={() => setActiveTab('list')}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold"
                  >
                    단어장으로 이동
                  </button>
                </div>
              </div>
            ) : (
              quizQuestions.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>
                      문제 {currentQuizIdx + 1} / {quizQuestions.length}
                    </span>
                    <span className="text-indigo-600">현재 점수: {quizScore}</span>
                  </div>

                  <div className="py-6 text-center space-y-2 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-semibold uppercase">
                      다음 영단어의 알맞은 뜻은?
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-3xl font-extrabold text-slate-900">
                        {quizQuestions[currentQuizIdx].word.english}
                      </h2>
                      <button
                        onClick={() => speakWord(quizQuestions[currentQuizIdx].word.english)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-indigo-600"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {quizQuestions[currentQuizIdx].options.map((option, idx) => {
                      const isCorrect = option === quizQuestions[currentQuizIdx].correctAnswer;
                      const isSelected = option === selectedAnswer;

                      let btnStyle = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-800';
                      if (selectedAnswer !== null) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold';
                        } else if (isSelected) {
                          btnStyle = 'border-rose-500 bg-rose-50 text-rose-900';
                        } else {
                          btnStyle = 'border-slate-100 text-slate-400 opacity-60';
                        }
                      }

                      return (
                        <button
                          key={idx}
                          disabled={selectedAnswer !== null}
                          onClick={() => handleAnswerSelect(option)}
                          className={`w-full p-4 rounded-2xl border text-left text-sm font-medium transition-all flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{option}</span>
                          {selectedAnswer !== null && isCorrect && (
                            <Check className="w-5 h-5 text-emerald-600" />
                          )}
                          {selectedAnswer !== null && isSelected && !isCorrect && (
                            <X className="w-5 h-5 text-rose-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedAnswer !== null && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={handleNextQuestion}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
                      >
                        {currentQuizIdx + 1 < quizQuestions.length ? '다음 문제' : '결과 보기'}
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Add / Edit Word Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingWord ? '단어 수정하기' : '새 영어 단어 추가'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  영어 단어 / 숙어 *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={formEnglish}
                  onChange={(e) => setFormEnglish(e.target.value)}
                  placeholder="예: resilient"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  한국어 뜻 *
                </label>
                <input
                  type="text"
                  required
                  maxLength={300}
                  value={formKorean}
                  onChange={(e) => setFormKorean(e.target.value)}
                  placeholder="예: 회복력 있는, 탄력 있는"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  카테고리
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  예문 (선택)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={formExample}
                  onChange={(e) => setFormExample(e.target.value)}
                  placeholder="예: She is a resilient leader who adapts quickly."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {formSubmitting ? '저장 중...' : editingWord ? '수정 완료' : '단어 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

