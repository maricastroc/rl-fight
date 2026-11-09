"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useSyncExternalStore,
  type Dispatch,
  type ReactNode,
} from "react";
import { configProblems, DEFAULT_CERTIFICATE_CONFIG, type CertificateConfig } from "@/lib/certificate/config";
import { readJson, removeKey, writeJson } from "@/lib/browser/storage";
import { getGraduation } from "@/lib/graduations/catalog";
import type { ImportNote, KruangSummary, SheetStructure, SourceFormat } from "@/lib/import/types";
import type { Student } from "@/lib/students/model";
import { countIssues, validateStudents, type StudentIssue } from "@/lib/validation/validate";

export type Step = "import" | "review" | "configure" | "generate";

export const STEPS: { id: Step; number: string; label: string }[] = [
  { id: "import", number: "01", label: "Importar" },
  { id: "review", number: "02", label: "Conferir" },
  { id: "configure", number: "03", label: "Configurar" },
  { id: "generate", number: "04", label: "Gerar" },
];

export type ImportMeta = {
  fileName: string;
  format: SourceFormat | "manual";
  size: number;
  sheetName: string | null;
  structure: SheetStructure;
  summary: KruangSummary | null;
  notes: ImportNote[];
  importedAt: number;
};

export type SessionState = {
  version: 1;
  step: Step;
  students: Student[];
  importMeta: ImportMeta | null;
  config: CertificateConfig;
  /** Import notes the teacher already handled (added or dismissed). */
  resolvedNotes: string[];
  updatedAt: number;
};

export type SessionAction =
  | { type: "import"; students: Student[]; meta: ImportMeta }
  | { type: "student/update"; id: string; patch: Partial<Pick<Student, "name" | "graduation" | "reviewed">> }
  | { type: "student/add"; student: Student }
  | { type: "student/remove"; id: string }
  | { type: "note/resolve"; key: string }
  | { type: "config"; patch: Partial<CertificateConfig> }
  | { type: "step"; step: Step }
  | { type: "restore"; state: SessionState }
  | { type: "reset" };

const STORAGE_KEY = "kruang:session:v1";

export function noteKey(note: ImportNote): string {
  return `${note.kind}:${note.row}`;
}

function initialState(): SessionState {
  return {
    version: 1,
    step: "import",
    students: [],
    importMeta: null,
    config: DEFAULT_CERTIFICATE_CONFIG,
    resolvedNotes: [],
    updatedAt: 0,
  };
}

function reducer(state: SessionState, action: SessionAction): SessionState {
  const touch = (next: Omit<SessionState, "updatedAt">): SessionState => ({ ...next, updatedAt: Date.now() });

  switch (action.type) {
    case "import":
      return touch({
        ...state,
        step: "review",
        students: action.students,
        importMeta: action.meta,
        resolvedNotes: [],
      });
    case "student/update":
      return touch({
        ...state,
        students: state.students.map((student) => {
          if (student.id !== action.id) return student;
          const next = { ...student, ...action.patch };
          if (action.patch.name !== undefined && action.patch.name !== student.name) next.reviewed = undefined;
          if (action.patch.graduation !== undefined) next.inferred = undefined;
          return next;
        }),
      });
    case "student/add":
      return touch({ ...state, students: [...state.students, action.student] });
    case "student/remove":
      return touch({ ...state, students: state.students.filter((student) => student.id !== action.id) });
    case "note/resolve":
      return touch({ ...state, resolvedNotes: [...new Set([...state.resolvedNotes, action.key])] });
    case "config":
      return touch({ ...state, config: { ...state.config, ...action.patch } });
    case "step":
      return { ...state, step: action.step };
    case "restore":
      return action.state;
    case "reset":
      return initialState();
  }
}

function isSessionState(value: unknown): value is SessionState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<SessionState>;
  return state.version === 1 && Array.isArray(state.students) && typeof state.config === "object";
}

function hasWork(state: SessionState): boolean {
  return state.importMeta !== null || state.students.length > 0;
}

/**
 * The session left by a previous visit is read once and offered for resuming until the teacher
 * resumes or discards it; it is never applied silently.
 */
let savedOffer: SessionState | null | undefined;
const offerListeners = new Set<() => void>();

function readSavedOffer(): SessionState | null {
  if (savedOffer === undefined) {
    const stored = readJson<unknown>(STORAGE_KEY);
    savedOffer =
      isSessionState(stored) && hasWork(stored)
        ? { ...stored, resolvedNotes: stored.resolvedNotes ?? [], config: { ...DEFAULT_CERTIFICATE_CONFIG, ...stored.config } }
        : null;
  }
  return savedOffer;
}

function clearSavedOffer() {
  savedOffer = null;
  offerListeners.forEach((listener) => listener());
}

function subscribeSavedOffer(listener: () => void) {
  offerListeners.add(listener);
  return () => offerListeners.delete(listener);
}

type SessionContextValue = {
  state: SessionState;
  dispatch: Dispatch<SessionAction>;
  /** A session saved by a previous visit, offered for resuming until the teacher decides. */
  saved: SessionState | null;
  resume: () => void;
  discardSaved: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const saved = useSyncExternalStore(subscribeSavedOffer, readSavedOffer, () => null);

  useEffect(() => {
    if (state.updatedAt === 0) return;
    const timer = setTimeout(() => {
      if (hasWork(state)) writeJson(STORAGE_KEY, state);
      else removeKey(STORAGE_KEY);
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const resume = useCallback(() => {
    if (!saved) return;
    dispatch({ type: "restore", state: { ...saved, step: saved.step === "import" ? "review" : saved.step } });
    clearSavedOffer();
  }, [saved]);

  const discardSaved = useCallback(() => {
    clearSavedOffer();
    removeKey(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ state, dispatch, saved, resume, discardSaved }), [state, saved, resume, discardSaved]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}

export type SessionInsights = {
  issues: Map<string, StudentIssue[]>;
  errors: number;
  warnings: number;
  configErrors: ReturnType<typeof configProblems>;
  graduationCount: number;
  canReview: boolean;
  canConfigure: boolean;
  canGenerate: boolean;
};

export function useSessionInsights(): SessionInsights {
  const { state } = useSession();
  const issues = useMemo(() => validateStudents(state.students), [state.students]);
  return useMemo(() => {
    const { errors, warnings } = countIssues(issues);
    const configErrors = configProblems(state.config);
    const graduationCount = new Set(state.students.map((s) => s.graduation).filter((id) => getGraduation(id))).size;
    const canReview = state.importMeta !== null;
    const canConfigure = canReview && state.students.length > 0 && errors === 0;
    const canGenerate = canConfigure && !configErrors.examDate && !configErrors.city;
    return { issues, errors, warnings, configErrors, graduationCount, canReview, canConfigure, canGenerate };
  }, [issues, state.config, state.students, state.importMeta]);
}
