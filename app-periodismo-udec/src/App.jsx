import React, { useState, useEffect, useMemo } from 'react';

// --- CONFIGURACIÓN API PHP ---
const getApiUrl = () => {
  const S = window.location;
  if (S.hostname === "localhost" || S.hostname === "127.0.0.1") return "./api.php";
  const q = S.protocol === "http:" ? "https:" : S.protocol;
  const D = S.host;
  let d = S.pathname;
  return d.endsWith("/") || (d = d + "/"), `${q}//${D}${d}api.php`;
};
const API_URL = getApiUrl();

// --- SNAPPING HELPER FOR ACADEMIC BLOCKS ---
const alignToAcademicBlock = (startMin, duration) => {
  const D = Math.round((startMin - 15) / 60) + 1;
  const d = Math.max(1, Math.min(10, D));
  const snappedStart = (d - 1) * 60 + 15;
  return {
    startMin: snappedStart,
    duration: duration,
    endMin: snappedStart + duration
  };
};

// --- OVERLAP RESOLUTION ALGORITHM FOR CALENDAR COLUMN LAYOUT ---
const computeOverlappingLayout = (dayClasses) => {
  const sorted = [...dayClasses].map(cls => {
    const snapped = alignToAcademicBlock(cls.startMin, cls.duration);
    return {
      ...cls,
      snappedStart: snapped.startMin,
      snappedEnd: snapped.endMin
    };
  }).sort((a, b) => a.snappedStart - b.snappedStart || (b.snappedEnd - b.snappedStart) - (a.snappedEnd - a.snappedStart));

  const clusters = [];
  for (const cls of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      const overlaps = cluster.some(other => 
        cls.snappedStart < other.snappedEnd && cls.snappedEnd > other.snappedStart
      );
      if (overlaps) {
        cluster.push(cls);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([cls]);
    }
  }

  const layoutClasses = [];
  for (const cluster of clusters) {
    const columns = [];
    for (const cls of cluster) {
      let colIdx = 0;
      let colPlaced = false;
      while (colIdx < columns.length) {
        const colOverlaps = columns[colIdx].some(other =>
          cls.snappedStart < other.snappedEnd && cls.snappedEnd > other.snappedStart
        );
        if (!colOverlaps) {
          columns[colIdx].push(cls);
          colPlaced = true;
          break;
        }
        colIdx++;
      }
      if (!colPlaced) {
        columns.push([cls]);
      }
    }

    const totalCols = columns.length;
    for (let c = 0; c < totalCols; c++) {
      for (const cls of columns[c]) {
        layoutClasses.push({
          ...cls,
          colWidth: 94 / totalCols,
          colLeft: 3 + (c * (94 / totalCols))
        });
      }
    }
  }

  return layoutClasses;
};

// --- DATOS DE RESPALDO (OFFLINE / INITIAL SEED) ---
const INITIAL_TEACHERS = [
  { id: 'T1', name: 'Dr. A. Vance', dept: 'ASTROFÍSICA' },
  { id: 'T2', name: 'Prof. Chen', dept: 'MATEMÁTICAS' },
  { id: 'T3', name: 'Dra. Reyes', dept: 'FÍSICA' },
  { id: 'T4', name: 'Dr. Smith', dept: 'INGENIERÍA' }
];

const INITIAL_ROOMS = [
  { id: 'R1', name: 'RM-104B', capacity: 60, status: 'ONLINE' },
  { id: 'R2', name: 'LAB-02', capacity: 30, status: 'ONLINE' },
  { id: 'R3', name: 'ENG-202', capacity: 45, status: 'MAINT' },
  { id: 'R4', name: 'AUDITORIO', capacity: 150, status: 'ONLINE' }
];

const INITIAL_CLASSES = [
  { id: 'C1', semester: 3, subject: 'CÁLCULO AVANZADO II', teacherId: 'T2', roomId: 'R1', day: 0, startMin: 0, duration: 120, color: 'purple' },
  { id: 'C2', semester: 3, subject: 'LABORATORIO FÍSICA IV', teacherId: 'T3', roomId: 'R2', day: 1, startMin: 60, duration: 120, color: 'cyan' },
  { id: 'C3', semester: 3, subject: 'INGENIERÍA ESTRUCTURAL', teacherId: 'T4', roomId: 'R3', day: 2, startMin: 180, duration: 90, color: 'rose' },
  { id: 'C4', semester: 3, subject: 'TALLER DE PROYECTOS', teacherId: 'T1', roomId: 'R4', day: 4, startMin: 0, duration: 180, color: 'cyan' },
];

// --- CONSTANTES ---
const VIEWS = { SCHEDULER: 'scheduler', ROOMS: 'rooms', PERSONNEL: 'personnel', SUBJECTS: 'subjects' };
const DAYS = [
  { id: 0, label: 'LUN', full: 'LUNES' },
  { id: 1, label: 'MAR', full: 'MARTES' },
  { id: 2, label: 'MIE', full: 'MIÉRCOLES' },
  { id: 3, label: 'JUE', full: 'JUEVES' },
  { id: 4, label: 'VIE', full: 'VIERNES' }
];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7];
const YEAR_LABELS = {
  1: 'PRIMER AÑO',
  2: 'SEGUNDO AÑO',
  3: 'TERCER AÑO',
  4: 'CUARTO AÑO',
  5: 'QUINTO AÑO',
  6: 'RAMOS ELECTIVOS',
  7: 'RAMOS COMPLEMENTARIOS'
};
const START_HOUR = 8;
const END_HOUR = 18;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

// --- ICONOS ---
const IconClock = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const IconUser = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
const IconMapPin = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconBookOpen = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
const IconAlert = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const IconSparkles = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const IconLock = () => <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;

// --- GEMINI API INTEGRATION ---
const apiKey = "";
async function callGemini(prompt, systemInstruction = "", expectJson = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
  };
  if (expectJson) payload.generationConfig = { responseMimeType: "application/json" };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return expectJson ? JSON.parse(text) : text;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
}

export default function App() {
  const [session, setSession] = useState(null);
  const isAdmin = !!session;

  const [currentView, setCurrentView] = useState(VIEWS.SCHEDULER);

  // Datos
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // Estado UI
  const [selectedSemester, setSelectedSemester] = useState(3);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, data: null });
  const [roomModalState, setRoomModalState] = useState({ isOpen: false, data: null });
  const [teacherModalState, setTeacherModalState] = useState({ isOpen: false, data: null });
  const [subjectModalState, setSubjectModalState] = useState({ isOpen: false, data: null });
  const [loginModal, setLoginModal] = useState({ isOpen: false, isRegister: false });

  // IA States
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- CARGA DINÁMICA DE SUPABASE CDN ---


  // --- AUTHENTICATION & SESSION LOADING ---
  useEffect(() => {
    const savedSession = localStorage.getItem("op_session");
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem("op_session");
      }
    }
  }, []);

  // --- API DATA LOADING & POLLING ---
  useEffect(() => {
    fetchInitialData();
    const interval = setInterval(() => {
      fetchInitialData();
    }, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      const res = await fetch(`${API_URL}?action=get_all`);
      if (!res.ok) throw new Error("Error de conexión con la API PHP");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setClasses(data.classes || []);
      setTeachers(data.teachers || []);
      setRooms(data.rooms || []);
      setSubjects(data.subjects || []);
      setIsOffline(false);
    } catch (err) {
      console.warn("Modo Offline activado:", err.message);
      setIsOffline(true);
      setClasses(INITIAL_CLASSES);
      setTeachers(INITIAL_TEACHERS);
      setRooms(INITIAL_ROOMS);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE CONFLICTOS ---
  const classesWithConflicts = useMemo(() => {
    return classes.map(cls => {
      const clsStart = cls.startMin;
      const clsEnd = cls.startMin + cls.duration;

      const conflicts = classes.filter(other => {
        if (cls.id === other.id) return false;
        if (cls.day !== other.day) return false;

        const otherStart = other.startMin;
        const otherEnd = other.startMin + other.duration;
        const overlaps = clsStart < otherEnd && clsEnd > otherStart;

        if (!overlaps) return false;

        const clsTeachers = cls.teacherId ? cls.teacherId.split(',').map(t => t.trim()) : [];
        const otherTeachers = other.teacherId ? other.teacherId.split(',').map(t => t.trim()) : [];
        const sharesTeacher = clsTeachers.some(t => otherTeachers.includes(t));

        return (cls.roomId === other.roomId) || sharesTeacher;
      });

      return { ...cls, hasConflict: conflicts.length > 0 };
    });
  }, [classes]);

  const currentSemesterClasses = classesWithConflicts.filter(c => c.semester === selectedSemester);

  // --- OPERACIONES CRUD ---
  const saveRecord = async (table, recordData, idPrefix) => {
    const docId = recordData.id || `${idPrefix}_${Date.now()}`;
    const { hasConflict, conflicts, ...cleanData } = recordData;
    const finalRecord = { ...cleanData, id: docId };

    if (!isOffline) {
      try {
        const res = await fetch(`${API_URL}?action=upsert&table=${table}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalRecord)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al guardar en el servidor");
        }
      } catch (err) {
        console.warn(`Error guardando ${table} en DB (se usará memoria local):`, err.message);
      }
    }

    const updater = (prev) => {
      const exists = prev.find(p => p.id === docId);
      return exists ? prev.map(p => p.id === docId ? finalRecord : p) : [...prev, finalRecord];
    };

    if (table === 'classes') setClasses(updater);
    if (table === 'rooms') setRooms(updater);
    if (table === 'teachers') setTeachers(updater);
    if (table === 'subjects') setSubjects(updater);
  };

  const deleteRecord = async (table, id) => {
    if (!isOffline) {
      try {
        const res = await fetch(`${API_URL}?action=delete&table=${table}&id=${id}`, {
          method: 'POST'
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Error al eliminar en el servidor");
        }
      } catch (err) {
        console.warn(`Error eliminando de DB (se usará memoria local):`, err.message);
      }
    }

    if (table === 'classes') setClasses(prev => prev.filter(c => c.id !== id));
    if (table === 'rooms') setRooms(prev => prev.filter(r => r.id !== id));
    if (table === 'teachers') setTeachers(prev => prev.filter(t => t.id !== id));
    if (table === 'subjects') setSubjects(prev => prev.filter(s => s.id !== id));
  };

  const saveClass = (classData) => {
    saveRecord('classes', classData, 'CLASS');
    setModalState({ isOpen: false, data: null });
  };
  const deleteClass = (id) => {
    deleteRecord('classes', id);
    setModalState({ isOpen: false, data: null });
  };
  const saveRoom = (roomData) => {
    saveRecord('rooms', roomData, 'ROOM');
    setRoomModalState({ isOpen: false, data: null });
  };
  const deleteRoom = (id) => {
    deleteRecord('rooms', id);
    setRoomModalState({ isOpen: false, data: null });
  };
  const saveTeacher = (teacherData) => {
    saveRecord('teachers', teacherData, 'T');
    setTeacherModalState({ isOpen: false, data: null });
  };
  const deleteTeacher = (id) => {
    deleteRecord('teachers', id);
    setTeacherModalState({ isOpen: false, data: null });
  };
  const saveSubject = (subjectData) => {
    saveRecord('subjects', subjectData, 'SUBJ');
    setSubjectModalState({ isOpen: false, data: null });
  };
  const deleteSubject = (id) => {
    deleteRecord('subjects', id);
    setSubjectModalState({ isOpen: false, data: null });
  };

  // --- PROCESAMIENTO IA (SMART SCHEDULER) ---
  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    setIsAiLoading(true);
    try {
      const sysPrompt = `Eres la IA de App Periodismo UdeC. Analiza la petición de horario.
      Profesores disponibles: ${JSON.stringify(teachers.map(t => ({ id: t.id, name: t.name })))}
      Salas disponibles: ${JSON.stringify(rooms.map(r => ({ id: r.id, name: r.name })))}
      Devuelve estrictamente un JSON con:
      - subject (string)
      - teacherId (string o null)
      - roomId (string o null)
      - day (int 0=LUN a 4=VIE)
      - startMin (int, minutos desde las 08:00. Ej 10:00 = 120, 14:30 = 390. Default 0)
      - duration (int, 45, 90 o 135)
      - color (string "cyan", "purple", "rose", "emerald")`;

      const result = await callGemini(aiInput, sysPrompt, true);
      setModalState({ isOpen: true, data: { ...result, semester: selectedSemester } });
      setAiInput("");
    } catch (error) {
      console.error("Error IA:", error);
      setAiInput("ERROR: Enlace perdido con nodo IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleAdmin = () => {
    if (isAdmin) {
      setSession(null);
      localStorage.removeItem("op_session");
    } else {
      setLoginModal({ isOpen: true, isRegister: false });
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] text-cyan-500 font-mono flex items-center justify-center">ENLAZANDO CON NODO DE DATOS...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-mono flex flex-col selection:bg-cyan-900 selection:text-cyan-100">
      {/* TOP NAVIGATION TACTICAL BAR */}
      <header className="h-16 border-b border-[#222] bg-[#0a0a0a] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-cyan-500 rounded-sm grid place-items-center text-black font-bold text-xs">PU</div>
            <h1 className="text-lg font-bold tracking-widest text-white">APP PERIODISMO UDEC <span className="text-cyan-500 text-sm opacity-50">// SUPABASE UPLINK</span></h1>
          </div>
          <nav className="flex gap-4 ml-8 text-xs tracking-wider">
            <button onClick={() => setCurrentView(VIEWS.SCHEDULER)} className={`px-3 py-1 border border-transparent transition-all ${currentView === VIEWS.SCHEDULER ? 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10' : 'hover:text-white'}`}>HORARIO</button>
            <button onClick={() => setCurrentView(VIEWS.ROOMS)} className={`px-3 py-1 border border-transparent transition-all ${currentView === VIEWS.ROOMS ? 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10' : 'hover:text-white'}`}>SALAS</button>
            <button onClick={() => setCurrentView(VIEWS.PERSONNEL)} className={`px-3 py-1 border border-transparent transition-all ${currentView === VIEWS.PERSONNEL ? 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10' : 'hover:text-white'}`}>PERSONAL</button>
            <button onClick={() => setCurrentView(VIEWS.SUBJECTS)} className={`px-3 py-1 border border-transparent transition-all ${currentView === VIEWS.SUBJECTS ? 'text-cyan-400 border-cyan-500/30 bg-cyan-900/10' : 'hover:text-white'}`}>ASIGNATURAS</button>
          </nav>
        </div>

        <div className="flex items-center gap-6 text-xs tracking-wider">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse'}`}></div>
            <span className={isOffline ? 'text-rose-500' : 'text-emerald-500'}>{isOffline ? 'SYS_OFFLINE' : 'DB_ONLINE'}</span>
          </div>

          {/* ADMIN TOGGLE */}
          <div className="flex items-center gap-3 border-l border-[#333] pl-6">
            <span className={isAdmin ? 'text-cyan-400' : 'text-gray-500'}>
              {isAdmin ? 'ADMIN CONECTADO' : 'MODO ESTUDIANTE'}
            </span>
            <button
              onClick={toggleAdmin}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${isAdmin ? 'bg-cyan-600' : 'bg-[#222]'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isAdmin ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex overflow-hidden">
        {currentView === VIEWS.SCHEDULER && (
          <>
            {/* SIDEBAR: SEMESTERS */}
            <aside className="w-64 border-r border-[#222] bg-[#0d0d0d] flex flex-col shrink-0">
              <div className="p-4 border-b border-[#222]">
                <div className="text-[10px] text-gray-500 tracking-widest mb-1">SELECTOR_CURSO</div>
                <div className="text-xs text-emerald-500 flex items-center gap-1"><div className="w-1 h-1 bg-emerald-500 rounded-full"></div> REJILLA ACTIVA</div>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                {SEMESTERS.map(sem => (
                  <button
                    key={sem}
                    onClick={() => setSelectedSemester(sem)}
                    className={`w-full text-left px-6 py-4 flex items-center justify-between transition-colors border-l-2
                      ${selectedSemester === sem
                        ? 'border-cyan-500 bg-[#1a1a24] text-cyan-50'
                        : 'border-transparent text-gray-500 hover:bg-[#111] hover:text-gray-300'}`}
                  >
                    <span className="tracking-widest text-sm">{YEAR_LABELS[sem]}</span>
                    {selectedSemester === sem && <div className="grid grid-cols-2 gap-0.5"><div className="w-1.5 h-1.5 bg-cyan-500"></div><div className="w-1.5 h-1.5 bg-cyan-500"></div><div className="w-1.5 h-1.5 bg-cyan-500"></div><div className="w-1.5 h-1.5 bg-cyan-500/30"></div></div>}
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-[#222] text-[10px] text-gray-600 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div> NODO: {isOffline ? 'LOCAL_MEMORY' : 'MYSQL_DB'}
              </div>
            </aside>

            {/* SCHEDULE GRID */}
            <div className="flex-1 overflow-auto bg-[#0a0a0a] relative p-6">
              <div className="min-w-[800px] h-full flex flex-col border border-[#222]">
                {/* HEADER (DAYS) */}
                <div className="flex border-b border-[#222] bg-[#0d0d0d]">
                  <div className="w-16 shrink-0 border-r border-[#222] grid place-items-center">
                    <IconClock />
                  </div>
                  {DAYS.map((day, idx) => (
                    <div key={day.id} className={`flex-1 text-center py-3 border-r border-[#222] last:border-0 ${day.id === new Date().getDay() - 1 ? 'text-emerald-500' : ''}`}>
                      <div className="font-bold text-sm tracking-widest">{day.label}</div>
                      <div className="text-[10px] opacity-50 mt-1">OCT 1{4 + idx}</div>
                    </div>
                  ))}
                </div>

                {/* BODY (GRID) */}
                <div className="flex-1 flex relative">
                  {/* TIME LABELS (Y-Axis) */}
                  <div className="w-16 shrink-0 border-r border-[#222] bg-[#0d0d0d] flex flex-col">
                    {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                      <div key={i} className="flex-1 relative" style={{ minHeight: '60px' }}>
                        <span className="absolute -top-2.5 w-full text-center text-xs text-gray-600">{(START_HOUR + i).toString().padStart(2, '0')}:00</span>
                        {i === (END_HOUR - START_HOUR - 1) && (
                          <span className="absolute -bottom-2.5 w-full text-center text-xs text-gray-600">{(END_HOUR).toString().padStart(2, '0')}:00</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* MAIN GRID LINES & COLUMNS */}
                  <div className="flex-1 flex relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiMxYTFhMWEiLz48L3N2Zz4=')]">
                    {/* Horizontal Hour Lines */}
                    <div className="absolute inset-0 flex flex-col pointer-events-none">
                      {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                        <div key={i} className="flex-1 border-b border-[#222]/50"></div>
                      ))}
                    </div>

                    {/* Columns (Days) */}
                    {DAYS.map(day => (
                      <div key={day.id} className="flex-1 border-r border-[#222] relative group">
                        {/* Interactive overlay for adding class */}
                        {isAdmin && (
                          <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-cyan-900/5 cursor-crosshair transition-opacity z-0"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              const percentage = y / rect.height;
                              let startMin = Math.floor(percentage * TOTAL_MINUTES);
                              startMin = Math.round(startMin / 15) * 15;
                              setModalState({ isOpen: true, data: { day: day.id, startMin, duration: 45, semester: selectedSemester, color: 'cyan' } });
                            }}
                          >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-500/50">+ AÑADIR CLASE</div>
                          </div>
                        )}

                        {/* Render Blocks for this day with Overlap Division */}
                        {computeOverlappingLayout(currentSemesterClasses.filter(c => c.day === day.id)).map(cls => (
                          <ClassBlock
                            key={cls.id}
                            cls={cls}
                            teachers={teachers}
                            rooms={rooms}
                            isAdmin={isAdmin}
                            onClick={() => isAdmin && setModalState({ isOpen: true, data: cls })}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI UPLINK TERMINAL */}
              {isAdmin && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[650px] z-20">
                  <form onSubmit={handleAiSubmit} className="flex bg-[#0d0d0d] border border-cyan-500/50 p-2 shadow-[0_0_20px_rgba(0,255,255,0.1)] tactical-corners backdrop-blur-md">
                    <div className="flex items-center px-3 text-cyan-500 border-r border-[#333] opacity-80">
                      <IconSparkles />
                    </div>
                    <input
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Uplink IA: Ej. 'Cálculo Avanzado con Dr Vance el Jueves a las 11 en RM-104B'"
                      className="flex-1 bg-transparent text-sm text-cyan-50 placeholder-cyan-900/50 px-4 outline-none font-mono"
                      disabled={isAiLoading}
                    />
                    <button
                      type="submit"
                      disabled={isAiLoading || !aiInput.trim()}
                      className="px-6 py-2 bg-cyan-950/40 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-900/60 text-xs font-bold tracking-widest disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {isAiLoading ? 'PROCESANDO...' : '✨ EJECUTAR'}
                    </button>
                  </form>
                </div>
              )}

              {/* FLOATING ACTION BUTTON */}
              {isAdmin && (
                <button
                  onClick={() => setModalState({ isOpen: true, data: { day: 0, startMin: 0, duration: 45, semester: selectedSemester, color: 'cyan' } })}
                  className="absolute bottom-10 right-10 w-14 h-14 bg-[#0d0d0d] border border-cyan-500 text-cyan-400 text-2xl grid place-items-center hover:bg-cyan-900/30 transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)] tactical-corners z-20"
                >
                  +
                </button>
              )}
            </div>
          </>
        )}

        {/* OTRAS VISTAS */}
        {currentView === VIEWS.ROOMS && <RoomsView rooms={rooms} isAdmin={isAdmin} onAddRoom={() => setRoomModalState({ isOpen: true, data: { status: 'ONLINE', capacity: 30 } })} onEditRoom={(room) => setRoomModalState({ isOpen: true, data: room })} />}
        {currentView === VIEWS.PERSONNEL && <PersonnelView teachers={teachers} isAdmin={isAdmin} onAddTeacher={() => setTeacherModalState({ isOpen: true, data: {} })} onEditTeacher={(teacher) => setTeacherModalState({ isOpen: true, data: teacher })} />}
        {currentView === VIEWS.SUBJECTS && <SubjectsView subjects={subjects} isAdmin={isAdmin} onAddSubject={() => setSubjectModalState({ isOpen: true, data: {} })} onEditSubject={(subject) => setSubjectModalState({ isOpen: true, data: subject })} />}
      </main>

      {/* MODAL AUTENTICACIÓN SUPABASE */}
      {loginModal.isOpen && (
        <AuthModal
          isRegister={loginModal.isRegister}
          onClose={() => setLoginModal({ isOpen: false, isRegister: false })}
          onToggleMode={() => setLoginModal(prev => ({ ...prev, isRegister: !prev.isRegister }))}
        />
      )}

      {/* MODAL EDICIÓN CLASE */}
      {modalState.isOpen && (
        <ClassModal
          data={modalState.data}
          teachers={teachers}
          rooms={rooms}
          onClose={() => setModalState({ isOpen: false, data: null })}
          onSave={saveClass}
          onDelete={deleteClass}
        />
      )}

      {/* MODAL EDICIÓN SALA */}
      {roomModalState.isOpen && (
        <RoomModal
          data={roomModalState.data}
          onClose={() => setRoomModalState({ isOpen: false, data: null })}
          onSave={saveRoom}
          onDelete={deleteRoom}
        />
      )}

      {/* MODAL EDICIÓN PERSONAL */}
      {teacherModalState.isOpen && (
        <TeacherModal
          data={teacherModalState.data}
          onClose={() => setTeacherModalState({ isOpen: false, data: null })}
          onSave={saveTeacher}
          onDelete={deleteTeacher}
        />
      )}

      {/* MODAL EDICIÓN ASIGNATURA */}
      {subjectModalState.isOpen && (
        <SubjectModal
          data={subjectModalState.data}
          onClose={() => setSubjectModalState({ isOpen: false, data: null })}
          onSave={saveSubject}
          onDelete={deleteSubject}
        />
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .tactical-corners { position: relative; }
        .tactical-corners::before { content: ''; position: absolute; top: -1px; left: -1px; width: 6px; height: 6px; border-top: 2px solid #00e5ff; border-left: 2px solid #00e5ff; }
        .tactical-corners::after { content: ''; position: absolute; bottom: -1px; right: -1px; width: 6px; height: 6px; border-bottom: 2px solid #00e5ff; border-right: 2px solid #00e5ff; }
        .conflict-borders { border: 1px solid #ff003c !important; box-shadow: 0 0 10px rgba(255,0,60,0.2) !important; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  );
}

function SubjectsView({ subjects, isAdmin, onAddSubject, onEditSubject }) {
  const [selectedSubject, setSelectedSubject] = useState(null);

  return (
    <div className="flex-1 p-8 bg-[#0a0a0a] overflow-auto flex relative">
      <div className="flex-1 pr-8 border-r border-[#222]">
        <div className="mb-8 border-b border-[#222] pb-6">
          <h2 className="text-2xl font-bold tracking-widest text-white mb-2">NÓMINA DE ASIGNATURAS <span className="text-cyan-500 text-sm opacity-50">// DATABASE v2.4</span></h2>
        </div>
        <div className="border border-[#222] rounded-sm overflow-hidden bg-[#111]">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] text-gray-500 tracking-widest border-b border-[#222] bg-[#0d0d0d]">
              <tr><th className="p-4 font-normal">ID_TAG</th><th className="p-4 font-normal">CÓDIGO</th><th className="p-4 font-normal">NOMBRE ASIGNATURA</th></tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {subjects.map(s => (
                <tr key={s.id} onClick={() => setSelectedSubject(s)} className={`hover:bg-[#1a1a1a] cursor-pointer ${selectedSubject?.id === s.id ? 'bg-[#1a1a1a] border-l-2 border-cyan-500' : ''}`}>
                  <td className="p-4 text-cyan-400 font-bold">{s.id}</td>
                  <td className="p-4 text-gray-200">{s.code || 'SIN CÓDIGO'}</td>
                  <td className="p-4 text-gray-400 text-xs tracking-wider">{s.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-80 pl-8 bg-[#0a0a0a] flex flex-col">
        <div className="text-[10px] text-gray-500 tracking-widest mb-4 border-b border-[#222] pb-2">EXPEDIENTE DE ASIGNATURA</div>
        {selectedSubject ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 border border-[#222] p-4 bg-[#111] tactical-corners">
              <div className="w-16 h-16 rounded-sm bg-[#222] border border-[#333] grid place-items-center text-gray-500"><IconBookOpen /></div>
              <div>
                <div className="text-cyan-400 font-bold text-sm">{selectedSubject.name}</div>
                <div className="text-xs text-gray-500 tracking-widest">{selectedSubject.id} // {selectedSubject.code || 'S/C'}</div>
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => onEditSubject(selectedSubject)} className="w-full py-3 bg-[#111] border border-[#333] hover:bg-[#1a1a1a] text-cyan-400 text-xs font-bold flex justify-center items-center transition-colors">
                📝 MODIFICAR ASIGNATURA
              </button>
            )}
          </div>
        ) : (
          <div className="border border-[#222] p-4 bg-[#111] opacity-50"><div className="text-xs text-center text-gray-600 mt-4">SELECCIONE UNA ASIGNATURA</div></div>
        )}
      </div>

      {/* FLOATING ACTION BUTTON */}
      {isAdmin && (
        <button
          onClick={onAddSubject}
          className="absolute bottom-10 right-10 w-14 h-14 bg-[#0d0d0d] border border-cyan-500 text-cyan-400 text-2xl grid place-items-center hover:bg-cyan-900/30 transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)] tactical-corners z-20"
        >
          +
        </button>
      )}
    </div>
  );
}

function SubjectModal({ data, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(data || {});
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#333] tactical-corners shadow-2xl">
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
          <h2 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2">
            <IconBookOpen /> {formData.id ? 'MODIFICAR_ASIGNATURA' : 'NUEVA_ASIGNATURA'}
          </h2>
          <span className="text-[10px] text-gray-600">ID: {formData.id || 'NUEVO'}</span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">ID REFERENCIA (Opcional si es nueva)</label>
            <input
              type="text" name="id" value={formData.id || ''} onChange={handleChange} disabled={!!data?.id}
              className="w-full bg-black border border-[#333] p-2 text-white outline-none transition-colors text-sm disabled:opacity-50"
              placeholder="Ej. SUBJ_5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">CÓDIGO ASIGNATURA</label>
            <input
              type="text" name="code" value={formData.code || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm uppercase"
              placeholder="Ej. PER-101"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">NOMBRE ASIGNATURA</label>
            <input
              type="text" name="name" value={formData.name || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm"
              placeholder="Ej. Periodismo informativo"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[#222] flex justify-between bg-[#111]">
          {formData.id ? (
            <button onClick={() => onDelete(formData.id)} className="px-4 py-2 border border-rose-900 text-rose-500 hover:bg-rose-950/50 text-xs font-bold transition-colors">
              <IconAlert /> ELIMINAR
            </button>
          ) : <div></div>}

          <div className="flex gap-4">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-white text-xs font-bold transition-colors">CANCELAR</button>
            <button
              onClick={() => onSave({ ...formData, code: formData.code?.toUpperCase() })} disabled={!formData.name}
              className="px-6 py-2 bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs tracking-wider transition-colors disabled:opacity-50"
            >
              ✓ CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES SECUNDARIOS ---

function AuthModal({ isRegister, onClose, onToggleMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Código de operador o clave incorrecta");
      }
      setSession(data.session);
      localStorage.setItem("op_session", JSON.stringify(data.session));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#333] tactical-corners shadow-2xl p-6">
        <h2 className="text-cyan-400 font-bold tracking-widest text-lg mb-4 flex items-center gap-2">
          <IconLock /> {isRegister ? 'NUEVA CREDENCIAL' : 'AUTORIZACIÓN REQUERIDA'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">CÓDIGO OPERADOR (EMAIL)</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">CLAVE DE CIFRADO</label>
            <input
              type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none text-sm"
            />
          </div>

          {error && <div className="text-rose-500 text-[10px] bg-rose-950/30 p-2 border border-rose-900 flex gap-2"><IconAlert /> {error}</div>}

          <div className="pt-4 flex justify-between gap-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-white text-xs font-bold transition-colors">ABORTAR</button>
            <button type="submit" disabled={loading} className="flex-1 bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs tracking-wider transition-colors disabled:opacity-50">
              {loading ? 'PROCESANDO...' : (isRegister ? 'REGISTRAR' : 'INICIAR SESIÓN')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center border-t border-[#222] pt-4">
          <button onClick={onToggleMode} className="text-[10px] text-gray-500 hover:text-cyan-400 tracking-widest">
            {isRegister ? '¿YA TIENES ACCESO? INICIA SESIÓN' : 'SOLICITAR NUEVAS CREDENCIALES'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassBlock({ cls, teachers, rooms, isAdmin, onClick }) {
  const snapped = alignToAcademicBlock(cls.startMin, cls.duration);
  const topPercent = (snapped.startMin / TOTAL_MINUTES) * 100;
  const heightPercent = (snapped.duration / TOTAL_MINUTES) * 100;
  
  const teacherIds = cls.teacherId ? cls.teacherId.split(',').map(id => id.trim()) : [];
  const matchedTeachers = teachers.filter(t => teacherIds.includes(t.id));
  const teacherNames = matchedTeachers.map(t => t.name).join(', ') || 'SIN ASIGNAR';
  
  const room = rooms.find(r => r.id === cls.roomId);
  const formatTime = (mins) => {
    const total = (START_HOUR * 60) + mins;
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  };

  const colors = {
    cyan: 'border-cyan-500 bg-[#00e5ff]/5 text-cyan-300',
    purple: 'border-purple-500 bg-purple-500/5 text-purple-300',
    rose: 'border-rose-500 bg-rose-500/5 text-rose-300',
    emerald: 'border-emerald-500 bg-emerald-500/5 text-emerald-300'
  };

  const themeClass = cls.hasConflict ? 'conflict-borders bg-rose-950/20 text-rose-300' : colors[cls.color || 'cyan'];

  const widthPercent = cls.colWidth !== undefined ? cls.colWidth : 94;
  const leftPercent = cls.colLeft !== undefined ? cls.colLeft : 3;

  return (
    <div
      className={`absolute border border-l-4 p-2 overflow-hidden z-10 transition-all ${themeClass} ${isAdmin ? 'cursor-pointer hover:brightness-125' : ''}`}
      style={{ top: `${topPercent}%`, height: `${heightPercent}%`, width: `${widthPercent}%`, left: `${leftPercent}%` }}
      onClick={onClick}
    >
      <div className="font-bold text-xs truncate mb-1 text-white leading-tight">{cls.subject}</div>
      <div className="text-[10px] opacity-70 truncate mb-1" title={teacherNames}>{teacherNames}</div>

      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end text-[9px] opacity-80">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center"><IconClock /> {formatTime(snapped.startMin)} - {formatTime(snapped.endMin)}</span>
          <span className="flex items-center text-gray-400"><IconMapPin /> {room?.name || 'S/S'}</span>
        </div>
      </div>

      {cls.hasConflict && (
        <div className="absolute right-0 top-0 bg-rose-500 text-white text-[8px] font-bold px-1 py-0.5 flex items-center gap-1 animate-pulse">
          <IconAlert /> CONFLICTO
        </div>
      )}
    </div>
  );
}

function ClassModal({ data, teachers, rooms, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(data || {});
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  const timeOptions = [];
  for (let m = 0; m <= TOTAL_MINUTES - 45; m += 15) {
    const h = Math.floor((START_HOUR * 60 + m) / 60).toString().padStart(2, '0');
    const min = ((START_HOUR * 60 + m) % 60).toString().padStart(2, '0');
    timeOptions.push({ value: m, label: `${h}:${min}` });
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#333] tactical-corners shadow-2xl">
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
          <h2 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2">
            <IconMapPin /> {formData.id ? 'MODIFICAR_SECUENCIA' : 'NUEVA_SECUENCIA'}
          </h2>
          <span className="text-[10px] text-gray-600">ID: {formData.id || 'NUEVO'}</span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">NOMBRE ASIGNATURA</label>
            <input
              type="text" name="subject" value={formData.subject || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">PROFESOR</label>
              <select name="teacherId" value={formData.teacherId || ''} onChange={handleChange} className="w-full bg-black border border-[#333] p-2 text-white outline-none text-sm">
                <option value="">Seleccionar...</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">SALA / UBICACIÓN</label>
              <select name="roomId" value={formData.roomId || ''} onChange={handleChange} className="w-full bg-black border border-[#333] p-2 text-white outline-none text-sm">
                <option value="">Seleccionar...</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} [Cap: {r.capacity}]</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">INICIO (24H)</label>
              <select name="startMin" value={formData.startMin ?? 0} onChange={handleChange} className="w-full bg-black border border-[#333] p-2 text-white outline-none text-sm">
                {timeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">DURACIÓN</label>
              <select name="duration" value={formData.duration ?? 45} onChange={handleChange} className="w-full bg-black border border-[#333] p-2 text-white outline-none text-sm">
                <option value={45}>45 Minutos (1 Bloque)</option>
                <option value={90}>90 Minutos (2 Bloques)</option>
                <option value={135}>135 Minutos (3 Bloques)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">DÍA CICLO</label>
            <div className="flex bg-black border border-[#333] p-1">
              {DAYS.map(d => (
                <button
                  key={d.id} type="button" onClick={() => setFormData({ ...formData, day: d.id })}
                  className={`flex-1 text-[10px] py-1 text-center transition-colors ${formData.day === d.id ? 'bg-cyan-500 text-black font-bold' : 'text-gray-500 hover:text-white'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">TEMA VISUAL</label>
            <div className="flex gap-2">
              {['cyan', 'purple', 'rose', 'emerald'].map(c => (
                <button
                  key={c} type="button" onClick={() => setFormData({ ...formData, color: c })}
                  className={`w-6 h-6 rounded-sm border ${formData.color === c ? 'border-white' : 'border-transparent'} bg-${c}-500/50 hover:bg-${c}-500`}
                  style={{ backgroundColor: c === 'cyan' ? '#00e5ff' : c === 'purple' ? '#a855f7' : c === 'rose' ? '#f43f5e' : '#10b981' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#222] flex justify-between bg-[#111]">
          {formData.id ? (
            <button onClick={() => onDelete(formData.id)} className="px-4 py-2 border border-rose-900 text-rose-500 hover:bg-rose-950/50 text-xs font-bold transition-colors">
              <IconAlert /> ELIMINAR
            </button>
          ) : <div></div>}

          <div className="flex gap-4">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-white text-xs font-bold transition-colors">CANCELAR</button>
            <button
              onClick={() => onSave(formData)} disabled={!formData.subject || !formData.teacherId || !formData.roomId}
              className="px-6 py-2 bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs tracking-wider transition-colors disabled:opacity-50"
            >
              ✓ CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomsView({ rooms, isAdmin, onAddRoom, onEditRoom }) {
  return (
    <div className="flex-1 p-8 bg-[#0a0a0a] overflow-auto relative">
      <div className="flex justify-between items-start mb-8 border-b border-[#222] pb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-widest text-white mb-2">REGISTRO DE SALAS <span className="text-cyan-500 text-sm opacity-50">// INFRAESTRUCTURA</span></h2>
        </div>
        <div className="flex gap-4">
          <div className="border border-[#333] p-3 text-center min-w-32 bg-[#111]">
            <div className="text-[10px] text-gray-500 tracking-widest mb-1">CAPACIDAD TOTAL</div>
            <div className="text-xl text-white font-bold">{rooms.reduce((acc, r) => acc + r.capacity, 0)}</div>
          </div>
          <div className="border border-[#333] p-3 text-center min-w-32 bg-[#111]">
            <div className="text-[10px] text-gray-500 tracking-widest mb-1">NODOS ACTIVOS</div>
            <div className="text-xl text-emerald-500 font-bold">{rooms.filter(r => r.status === 'ONLINE').length}</div>
          </div>
        </div>
      </div>

      <div className="border border-[#222] rounded-sm overflow-hidden bg-[#111]">
        <table className="w-full text-left text-sm">
          <thead className="text-[10px] text-gray-500 tracking-widest border-b border-[#222] bg-[#0d0d0d]">
            <tr>
              <th className="p-4 font-normal">ID_REF</th>
              <th className="p-4 font-normal">DESCRIPCIÓN</th>
              <th className="p-4 font-normal">CAPACIDAD</th>
              <th className="p-4 font-normal">ESTADO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222]">
            {rooms.map(room => (
              <tr key={room.id} onClick={() => isAdmin && onEditRoom(room)} className={`transition-colors group ${isAdmin ? 'hover:bg-[#1a1a1a] cursor-pointer' : 'hover:bg-[#1a1a1a]'}`}>
                <td className="p-4 text-cyan-400 font-bold">{room.id}</td>
                <td className="p-4 text-gray-300">{room.name}</td>
                <td className="p-4 text-gray-400">{room.capacity} Asientos</td>
                <td className="p-4">
                  {room.status === 'ONLINE' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] border border-emerald-900 bg-emerald-950/30 text-emerald-400 rounded-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div> ONLINE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] border border-rose-900 bg-rose-950/30 text-rose-400 rounded-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_5px_#f43f5e]"></div> MANTENIMIENTO
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FLOATING ACTION BUTTON */}
      {isAdmin && (
        <button
          onClick={onAddRoom}
          className="absolute bottom-10 right-10 w-14 h-14 bg-[#0d0d0d] border border-cyan-500 text-cyan-400 text-2xl grid place-items-center hover:bg-cyan-900/30 transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)] tactical-corners z-20"
        >
          +
        </button>
      )}
    </div>
  );
}

function RoomModal({ data, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(data || {});
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'number' ? Number(value) : value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#333] tactical-corners shadow-2xl">
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
          <h2 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2">
            <IconMapPin /> {formData.id ? 'MODIFICAR_SALA' : 'NUEVA_SALA'}
          </h2>
          <span className="text-[10px] text-gray-600">ID: {formData.id || 'NUEVO'}</span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">ID REFERENCIA (Opcional si es nueva)</label>
            <input
              type="text" name="id" value={formData.id || ''} onChange={handleChange} disabled={!!data?.id}
              className="w-full bg-black border border-[#333] p-2 text-white outline-none transition-colors text-sm disabled:opacity-50"
              placeholder="Ej. R5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">NOMBRE DE SALA</label>
            <input
              type="text" name="name" value={formData.name || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm"
              placeholder="Ej. LAB-03"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">CAPACIDAD</label>
              <input
                type="number" name="capacity" value={formData.capacity ?? 30} onChange={handleChange} min={1}
                className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 tracking-wider mb-1">ESTADO</label>
              <select name="status" value={formData.status || 'ONLINE'} onChange={handleChange} className="w-full bg-black border border-[#333] p-2 text-white outline-none text-sm">
                <option value="ONLINE">ONLINE</option>
                <option value="MAINT">MANTENIMIENTO</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#222] flex justify-between bg-[#111]">
          {formData.id ? (
            <button onClick={() => onDelete(formData.id)} className="px-4 py-2 border border-rose-900 text-rose-500 hover:bg-rose-950/50 text-xs font-bold transition-colors">
              <IconAlert /> ELIMINAR
            </button>
          ) : <div></div>}

          <div className="flex gap-4">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-white text-xs font-bold transition-colors">CANCELAR</button>
            <button
              onClick={() => onSave(formData)} disabled={!formData.name || !formData.capacity}
              className="px-6 py-2 bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs tracking-wider transition-colors disabled:opacity-50"
            >
              ✓ CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherModal({ data, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(data || {});
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0d0d0d] border border-[#333] tactical-corners shadow-2xl">
        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#111]">
          <h2 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2">
            <IconUser /> {formData.id ? 'MODIFICAR_FICHA' : 'NUEVO_OPERADOR'}
          </h2>
          <span className="text-[10px] text-gray-600">ID: {formData.id || 'NUEVO'}</span>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">ID REFERENCIA (Opcional si es nuevo)</label>
            <input
              type="text" name="id" value={formData.id || ''} onChange={handleChange} disabled={!!data?.id}
              className="w-full bg-black border border-[#333] p-2 text-white outline-none transition-colors text-sm disabled:opacity-50"
              placeholder="Ej. T5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">NOMBRE OPERADOR</label>
            <input
              type="text" name="name" value={formData.name || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm"
              placeholder="Ej. Dra. Vance"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-500 tracking-wider mb-1">DEPARTAMENTO</label>
            <input
              type="text" name="dept" value={formData.dept || ''} onChange={handleChange}
              className="w-full bg-black border border-[#333] p-2 text-white focus:border-cyan-500 outline-none transition-colors text-sm uppercase"
              placeholder="Ej. MATEMÁTICAS"
            />
          </div>
        </div>

        <div className="p-4 border-t border-[#222] flex justify-between bg-[#111]">
          {formData.id ? (
            <button onClick={() => onDelete(formData.id)} className="px-4 py-2 border border-rose-900 text-rose-500 hover:bg-rose-950/50 text-xs font-bold transition-colors">
              <IconAlert /> ELIMINAR
            </button>
          ) : <div></div>}

          <div className="flex gap-4">
            <button onClick={onClose} className="px-4 py-2 text-gray-500 hover:text-white text-xs font-bold transition-colors">CANCELAR</button>
            <button
              onClick={() => onSave({ ...formData, dept: formData.dept?.toUpperCase() })} disabled={!formData.name || !formData.dept}
              className="px-6 py-2 bg-cyan-500 text-black hover:bg-cyan-400 font-bold text-xs tracking-wider transition-colors disabled:opacity-50"
            >
              ✓ CONFIRMAR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonnelView({ teachers, isAdmin, onAddTeacher, onEditTeacher }) {
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [dossier, setDossier] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDossier = async (teacher) => {
    setIsGenerating(true); setDossier("");
    try {
      const response = await callGemini(`Analizar operador: ${teacher.name}, Departamento: ${teacher.dept}.`, `Eres el sistema de inteligencia clasificada de una academia militar sci-fi. Genera un breve "Dossier Táctico" de exactamente 2 párrafos cortos para este profesor. Inventa detalles ficticios sobre su trasfondo militar. Usa tono analítico.`, false);
      setDossier(response);
    } catch (err) { setDossier("ERROR_EN_ENLACE_DE_DATOS"); } finally { setIsGenerating(false); }
  };

  return (
    <div className="flex-1 p-8 bg-[#0a0a0a] overflow-auto flex">
      <div className="flex-1 pr-8 border-r border-[#222]">
        <div className="mb-8 border-b border-[#222] pb-6">
          <h2 className="text-2xl font-bold tracking-widest text-white mb-2">NÓMINA DE PERSONAL <span className="text-cyan-500 text-sm opacity-50">// DATABASE v2.4</span></h2>
        </div>
        <div className="border border-[#222] rounded-sm overflow-hidden bg-[#111]">
          <table className="w-full text-left text-sm">
            <thead className="text-[10px] text-gray-500 tracking-widest border-b border-[#222] bg-[#0d0d0d]">
              <tr><th className="p-4 font-normal">ID_TAG</th><th className="p-4 font-normal">NOMBRE OPERADOR</th><th className="p-4 font-normal">DEPARTAMENTO</th></tr>
            </thead>
            <tbody className="divide-y divide-[#222]">
              {teachers.map(t => (
                <tr key={t.id} onClick={() => { setSelectedTeacher(t); setDossier(""); }} className={`hover:bg-[#1a1a1a] cursor-pointer ${selectedTeacher?.id === t.id ? 'bg-[#1a1a1a] border-l-2 border-cyan-500' : ''}`}>
                  <td className="p-4 text-cyan-400 font-bold">{t.id}</td>
                  <td className="p-4 text-gray-200 flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-[#222] border border-[#333] grid place-items-center text-xs"><IconUser /></div>{t.name}</td>
                  <td className="p-4 text-gray-400 text-xs tracking-wider">{t.dept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-80 pl-8 bg-[#0a0a0a] flex flex-col">
        <div className="text-[10px] text-gray-500 tracking-widest mb-4 border-b border-[#222] pb-2">EXPEDIENTE DEL OPERADOR</div>
        {selectedTeacher ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 border border-[#222] p-4 bg-[#111] tactical-corners">
              <div className="w-16 h-16 rounded-sm bg-[#222] border border-[#333] grid place-items-center text-gray-500"><IconUser /></div>
              <div>
                <div className="text-cyan-400 font-bold text-sm">{selectedTeacher.name}</div>
                <div className="text-xs text-gray-500 tracking-widest">{selectedTeacher.id} // {selectedTeacher.dept}</div>
              </div>
            </div>
            <button onClick={() => generateDossier(selectedTeacher)} disabled={isGenerating} className="w-full py-3 bg-purple-900/20 border border-purple-500/50 text-purple-400 text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.15)] flex justify-center items-center">
              <IconSparkles /> {isGenerating ? 'DESENCRIPTANDO...' : '✨ DESCIFRAR DOSSIER IA'}
            </button>
            {isAdmin && (
              <button onClick={() => onEditTeacher(selectedTeacher)} className="w-full py-3 bg-[#111] border border-[#333] hover:bg-[#1a1a1a] text-cyan-400 text-xs font-bold flex justify-center items-center transition-colors">
                📝 MODIFICAR FICHA
              </button>
            )}
            {dossier && <div className="border border-[#222] p-4 bg-[#0d0d0d] text-xs leading-relaxed text-gray-400 overflow-auto max-h-[400px]"><div className="text-[10px] text-purple-500 mb-3 font-bold">NIVEL 4 // ACCESO CONCEDIDO</div>{dossier}</div>}
          </div>
        ) : (
          <div className="border border-[#222] p-4 bg-[#111] opacity-50"><div className="text-xs text-center text-gray-600 mt-4">SELECCIONE UN OPERADOR</div></div>
        )}
      </div>

      {/* FLOATING ACTION BUTTON */}
      {isAdmin && (
        <button
          onClick={onAddTeacher}
          className="absolute bottom-10 right-10 w-14 h-14 bg-[#0d0d0d] border border-cyan-500 text-cyan-400 text-2xl grid place-items-center hover:bg-cyan-900/30 transition-colors shadow-[0_0_15px_rgba(0,255,255,0.2)] tactical-corners z-20"
        >
          +
        </button>
      )}
    </div>
  );
}