"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Stage = "접수" | "초기 확인" | "조사" | "심의 준비" | "조치" | "종결";
type CaseStatus = "진행 중" | "검토 대기" | "종결";
type Task = { id?: string; title: string; detail: string; done: boolean };
type CaseItem = { id: string; number: string; title: string; summary: string; location: string; date: string; stage: Stage; progress: number; status: CaseStatus; due: string };
type DocumentItem = { id: string; caseNumber: string; title: string; type: string; content: string; createdAt: string; status: string };
type MetricFilter = "active" | "check" | "urgent" | "closing" | null;

const stages: Stage[] = ["접수", "초기 확인", "조사", "심의 준비", "조치", "종결"];

const stageTasks: Record<Stage, Omit<Task, "id">[]> = {
  접수: [
    { title: "사안 기본 정보 확인", detail: "비식별 제목과 발생 일시·장소가 입력되었는지 확인합니다.", done: false },
    { title: "초기 사실관계 메모", detail: "확인된 사실과 확인이 필요한 내용을 나누어 기록합니다.", done: false },
    { title: "초기 대응 필요 여부 확인", detail: "안전 확보와 즉시 안내가 필요한지 담당교사가 판단합니다.", done: false },
  ],
  "초기 확인": [
    { title: "관련 학생 면담 일정 확인", detail: "면담 전 질문과 유의사항을 준비합니다.", done: false },
    { title: "보호자 안내 필요 여부 검토", detail: "안내 시점과 전달 내용을 담당교사가 확인합니다.", done: false },
    { title: "확인 자료 목록 정리", detail: "추가로 확인할 자료와 관계자를 목록화합니다.", done: false },
  ],
  조사: [
    { title: "관련 학생 면담 진행", detail: "면담 내용을 사실 중심으로 기록하고 추정과 구분합니다.", done: false },
    { title: "목격·참고 내용 확인", detail: "확인된 진술과 추가 확인 사항을 구분합니다.", done: false },
    { title: "조사 결과 요약", detail: "현재까지의 조사 경과와 미확인 사항을 정리합니다.", done: false },
  ],
  "심의 준비": [
    { title: "조사 자료 정리", detail: "심의에 필요한 비식별 자료를 순서대로 정리합니다.", done: false },
    { title: "관리자 보고 초안 검토", detail: "AI 초안은 사실관계 확인 후 수정해 사용합니다.", done: false },
    { title: "심의 준비사항 확인", detail: "담당교사가 학교 지침과 준비사항을 최종 확인합니다.", done: false },
  ],
  조치: [
    { title: "결정사항 기록 확인", detail: "확정된 사실과 결정사항을 구분하여 기록합니다.", done: false },
    { title: "안내 문구 검토", detail: "관계자 안내 문구가 중립적이고 사실에 근거하는지 확인합니다.", done: false },
    { title: "후속 조치 일정 확인", detail: "추후 확인할 일정과 담당 업무를 정리합니다.", done: false },
  ],
  종결: [
    { title: "처리 결과 확인", detail: "필요한 업무가 모두 완료되었는지 확인합니다.", done: false },
    { title: "종결 요약 작성", detail: "비식별 정보로 처리 결과를 요약합니다.", done: false },
    { title: "담당교사 최종 확인", detail: "종결 전 기록과 문서를 담당교사가 최종 확인합니다.", done: false },
  ],
};

const sampleCases: CaseItem[] = [
  { id: "sample-017", number: "2024-017", title: "쉬는 시간 중 학생 간 언쟁", summary: "복도에서 발생한 언쟁과 관련해 사실관계를 확인 중인 사안입니다.", location: "본관 2층 복도", date: "2024. 11. 18. 10:20", stage: "조사", progress: 46, status: "진행 중", due: "오늘" },
  { id: "sample-016", number: "2024-016", title: "단체 채팅방 내 갈등 신고", summary: "온라인 대화와 관련한 신고 접수 후 초기 확인을 진행하고 있습니다.", location: "온라인", date: "2024. 11. 15. 16:40", stage: "초기 확인", progress: 18, status: "검토 대기", due: "내일" },
  { id: "sample-012", number: "2024-012", title: "수업 중 반복적인 갈등 상황", summary: "수업 중 반복된 갈등 상황에 대한 처리를 정리했습니다.", location: "3학년 교실", date: "2024. 11. 04. 09:10", stage: "종결", progress: 100, status: "종결", due: "완료" },
];

function formatOccurrence(value: string) {
  if (!value) return "미입력";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusClass(status: CaseStatus) {
  return status === "종결" ? "status status-done" : status === "검토 대기" ? "status status-wait" : "status status-progress";
}

function emptyTasks(stage: Stage): Task[] {
  return stageTasks[stage].map((task) => ({ ...task }));
}

function Sidebar({ activeNav, onNavigate, session, onSignOut }: { activeNav: string; onNavigate: (item: string) => void; session: Session; onSignOut: () => void }) {
  const items = ["대시보드", "사안 관리", "AI 업무지원", "문서 이력"];
  return <aside className="sidebar">
    <div className="brand"><img className="brand-mark brand-logo" src="/modu-logo.png" alt="모두의 학폭비서 로고" /><div><strong>모두의 학폭비서</strong><span>학교 업무 지원 도구</span></div></div>
    <div className="profile-card"><div className="avatar">{(session.user.email ?? "담").slice(0, 1).toUpperCase()}</div><div><strong>{session.user.email}</strong><span>담당교사 계정</span></div><button aria-label="로그아웃" onClick={onSignOut}>↪</button></div>
    <nav className="nav-list" aria-label="주요 메뉴">{items.map((item) => <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => onNavigate(item)}><span className="nav-icon">{item === "대시보드" ? "⌂" : item === "사안 관리" ? "▤" : item === "AI 업무지원" ? "✦" : "◷"}</span>{item}</button>)}</nav>
    <div className="sidebar-bottom"><button className="nav-item" onClick={() => onNavigate("개인 설정")}><span className="nav-icon">⚙</span>개인 설정</button><button className="nav-item" onClick={onSignOut}><span className="nav-icon">↪</span>로그아웃</button><div className="privacy-note"><span>✓</span><div><strong>개인정보 보호 중</strong><small>민감정보는 저장·전송 전 차단됩니다.</small></div></div></div>
  </aside>;
}

function CaseList({ cases, selectedId, onSelect }: { cases: CaseItem[]; selectedId: string; onSelect: (item: CaseItem) => void }) {
  return <div className="case-list">{cases.map((item) => <button key={item.id} className={selectedId === item.id ? "case-row selected" : "case-row"} onClick={() => onSelect(item)}><div className="case-number">{item.number}</div><div className="case-copy"><strong>{item.title}</strong><span>{item.summary}</span></div><div className="case-stage"><span>{item.stage}</span><div className="mini-progress"><i style={{ width: `${item.progress}%` }} /></div></div><div className="case-due"><span className={statusClass(item.status)}>{item.status}</span><small>{item.due}</small></div><span className="chevron">›</span></button>)}</div>;
}

function Workflow({ selected, tasks, onToggle, onAskAdvance }: { selected: CaseItem; tasks: Task[]; onToggle: (index: number) => void; onAskAdvance: () => void }) {
  const completed = tasks.filter((task) => task.done).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  return <section className="panel workflow-panel"><div className="panel-heading"><div><p className="section-kicker">SELECTED CASE · {selected.number}</p><h2>{selected.title}</h2></div><span className={statusClass(selected.status)}>{selected.status}</span></div><div className="case-summary"><div><span>발생 일시</span><strong>{selected.date}</strong></div><div><span>발생 장소</span><strong>{selected.location}</strong></div><div><span>현재 단계</span><strong>{selected.stage}</strong></div></div><div className="stage-track">{stages.map((stage, index) => <div key={stage} className={stages.indexOf(selected.stage) >= index ? "stage active" : "stage"}><span>{index + 1}</span><small>{stage}</small></div>)}</div><div className="task-header"><div><h3>{selected.stage} 단계 체크리스트</h3><span>{completed}/{tasks.length}개 완료 · 진행률 {progress}%</span></div><div className="progress-ring" style={{ background: `conic-gradient(var(--blue) ${progress}%, #e9edf4 0)` }}><span>{progress}%</span></div></div><div className="task-list">{tasks.map((task, index) => <label key={`${task.id ?? task.title}-${index}`} className={task.done ? "task done" : "task"}><input type="checkbox" checked={task.done} onChange={() => onToggle(index)} /><span className="checkmark">✓</span><span><strong>{task.title}</strong><small>{task.detail}</small></span></label>)}</div>{completed === tasks.length && selected.stage !== "종결" && <button className="advance-button" onClick={onAskAdvance}>✓ 체크리스트 완료 · 다음 단계로 이동</button>}</section>;
}

function MetricDetail({ filter, cases, selectedId, tasks, onSelect, onClear }: { filter: MetricFilter; cases: CaseItem[]; selectedId: string; tasks: Task[]; onSelect: (item: CaseItem) => void; onClear: () => void }) {
  if (!filter) return null;
  const titles: Record<Exclude<MetricFilter, null>, string> = { active: "진행 중인 사안", check: "오늘 확인할 업무", urgent: "마감 임박 업무", closing: "종결 대기 사안" };
  const filtered = filter === "active" ? cases.filter((item) => item.status !== "종결") : filter === "check" ? cases.filter((item) => item.status !== "종결" && item.progress < 100) : filter === "urgent" ? cases.filter((item) => item.status !== "종결" && item.due === "오늘") : cases.filter((item) => item.status === "검토 대기" || item.stage === "조치");
  return <section className="metric-detail-panel"><div className="panel-heading"><div><p className="section-kicker">FILTERED CASES</p><h3>{titles[filter]} <span className="detail-count">{filtered.length}건</span></h3></div><button className="text-button" onClick={onClear}>닫기 ×</button></div>{filtered.length === 0 ? <p className="no-results">현재 조건에 해당하는 사안이 없습니다.</p> : <div className="metric-detail-list">{filtered.map((item) => <button className={selectedId === item.id ? "metric-detail-row selected" : "metric-detail-row"} key={item.id} onClick={() => onSelect(item)}><div><strong>{item.number} · {item.title}</strong><span>{item.stage} · {item.status}</span></div>{filter === "check" ? <div className="pending-task-preview">{(item.id === selectedId ? tasks : emptyTasks(item.stage)).filter((task) => !task.done).slice(0, 2).map((task) => <small key={task.title}>• {task.title}</small>)}</div> : <span className={statusClass(item.status)}>{item.due}</span>}<span className="chevron">›</span></button>)}</div>}</section>;
}

export default function Home() {
  const [cases, setCases] = useState<CaseItem[]>(sampleCases);
  const [selectedId, setSelectedId] = useState(sampleCases[0].id);
  const [tasks, setTasks] = useState<Task[]>(emptyTasks(sampleCases[0].stage));
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("대시보드");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState("");
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [aiMode, setAiMode] = useState<"guide" | "report" | "message">("guide");
  const [aiLoading, setAiLoading] = useState(false);

  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const completed = tasks.filter((task) => task.done).length;
  const activeCaseCount = cases.filter((item) => item.status !== "종결").length;
  const checkCaseCount = cases.filter((item) => item.status !== "종결" && item.progress < 100).length;
  const urgentCaseCount = cases.filter((item) => item.status !== "종결" && item.due === "오늘").length;
  const closingCaseCount = cases.filter((item) => item.status === "검토 대기" || item.stage === "조치").length;
  const aiContent = useMemo(() => aiMode === "report" ? "현재까지 확인된 사실을 중심으로 경과를 정리하고, 확인되지 않은 내용은 별도로 표시하는 방식으로 보고서 초안을 구성할 수 있습니다. 실제 제출 전 담당교사가 사실관계와 학교 지침을 확인해 주세요." : aiMode === "message" ? "안녕하세요. 학교에서는 현재 관련 사실관계를 확인하고 있습니다. 확인이 완료되는 대로 필요한 절차와 안내사항을 다시 전달드리겠습니다. 본 문구는 참고용 초안이며 실제 안내 전 검토가 필요합니다." : "현재 단계에서는 관련 학생 면담 일정 확인과 보호자 안내 필요 여부 검토가 우선입니다. 확인된 사실과 추가 확인이 필요한 내용을 나누어 기록하고 판단을 단정하는 표현은 피하세요.", [aiMode]);

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured) { setDataLoading(false); return () => { mounted = false; }; }
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session); if (mounted && data.session) void loadCases(data.session.user.id); else if (mounted) setDataLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { if (!mounted) return; setSession(nextSession); if (nextSession) void loadCases(nextSession.user.id); else setDataLoading(false); });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadCases(userId: string) {
    setDataLoading(true);
    const { data } = await supabase.from("cases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data?.length) { const mapped = data.map((item) => ({ id: item.id, number: item.case_number, title: item.anonymous_title, summary: item.anonymous_summary, location: item.occurrence_location, date: item.occurrence_datetime ? formatOccurrence(item.occurrence_datetime) : "미입력", stage: item.current_stage as Stage, progress: item.progress_rate, status: item.status as CaseStatus, due: "확인 필요" })); setCases(mapped); setSelectedId(mapped[0].id); await loadTasks(mapped[0].id, mapped[0].stage, userId); }
    setDataLoading(false);
  }

  async function loadTasks(caseId: string, stage: Stage, userId = session?.user.id) {
    if (!userId) { setTasks(emptyTasks(stage)); return; }
    const { data } = await supabase.from("case_tasks").select("id, task_title, task_description, status").eq("case_id", caseId).eq("user_id", userId).eq("stage", stage).order("created_at");
    setTasks(data?.length ? data.map((item) => ({ id: item.id, title: item.task_title, detail: item.task_description ?? "담당교사가 확인할 업무입니다.", done: item.status === "완료" })) : emptyTasks(stage));
  }

  async function selectCase(item: CaseItem) { setSelectedId(item.id); await loadTasks(item.id, item.stage); }
  async function signOut() { await supabase.auth.signOut(); }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthError("");
    if (!isSupabaseConfigured) { setAuthError("Vercel 환경변수에 Supabase URL과 Publishable Key를 등록해 주세요."); setAuthBusy(false); return; }
    const result = authMode === "signin" ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }) : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (result.error) setAuthError(result.error.message); else if (authMode === "signup" && !result.data.session) setAuthError("가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
    setAuthBusy(false);
  }

  async function toggleTask(index: number) {
    const task = tasks[index]; const nextDone = !task.done;
    const nextProgress = Math.round(((tasks.filter((item) => item.done).length + (nextDone ? 1 : -1)) / tasks.length) * 100);
    setTasks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, done: nextDone } : item));
    setCases((current) => current.map((item) => item.id === selected.id ? { ...item, progress: nextProgress } : item));
    if (session && task.id) await supabase.from("case_tasks").update({ status: nextDone ? "완료" : "대기", completed_at: nextDone ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", task.id).eq("user_id", session.user.id);
    if (session) await supabase.from("cases").update({ progress_rate: nextProgress, updated_at: new Date().toISOString() }).eq("id", selected.id).eq("user_id", session.user.id);
  }

  async function advanceStage() {
    const currentIndex = stages.indexOf(selected.stage); if (currentIndex < 0 || currentIndex === stages.length - 1) return;
    const nextStage = stages[currentIndex + 1]; const nextTasks = emptyTasks(nextStage);
    setCases((current) => current.map((item) => item.id === selected.id ? { ...item, stage: nextStage, progress: 0, status: nextStage === "종결" ? "종결" : "진행 중" } : item));
    setTasks(nextTasks); setConfirmAdvance(false);
    if (session) { await supabase.from("cases").update({ current_stage: nextStage, progress_rate: 0, status: nextStage === "종결" ? "종결" : "진행 중", updated_at: new Date().toISOString() }).eq("id", selected.id).eq("user_id", session.user.id); await supabase.from("case_tasks").insert(nextTasks.map((task) => ({ case_id: selected.id, user_id: session.user.id, stage: nextStage, task_title: task.title, task_description: task.detail, status: "대기" }))); await loadTasks(selected.id, nextStage); }
  }

  async function registerCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const summary = String(form.get("summary") ?? "");
    if (/(010[- ]?\d{3,4}[- ]?\d{4}|\d{6}[- ]?\d{7}|[가-힣]{2,4}(학생|보호자|교직원)?)/.test(summary)) { setPrivacyWarning("개인을 식별할 수 있는 정보가 포함된 것으로 보입니다. 비식별 정보로 수정해 주세요."); return; }
    const year = String(form.get("year") || new Date().getFullYear());
    const serial = String(form.get("serial") || "").trim();
    const occurrenceDate = String(form.get("occurrenceDate") || "");
    const occurrenceTime = String(form.get("occurrenceTime") || "");
    const occurrenceDateTime = occurrenceDate && occurrenceTime ? `${occurrenceDate}T${occurrenceTime}` : occurrenceDate;
    if (!/^\d+$/.test(serial)) { setPrivacyWarning("사안번호는 숫자만 입력해 주세요."); return; }
    if (!occurrenceDate || !occurrenceTime) { setPrivacyWarning("발생 날짜와 시간을 모두 선택해 주세요."); return; }
    const draft = { number: `${year}-${serial.padStart(3, "0")}`, title: String(form.get("title") || "새로 등록한 사안"), summary, location: String(form.get("location") || "미입력"), date: formatOccurrence(occurrenceDateTime) };
    if (session) { const { data, error } = await supabase.from("cases").insert({ user_id: session.user.id, case_number: draft.number, occurrence_datetime: occurrenceDateTime, occurrence_location: draft.location, school_level: "", case_type: "", anonymous_title: draft.title, anonymous_summary: draft.summary, current_stage: "접수", progress_rate: 0, status: "진행 중" }).select().single(); if (error || !data) { setPrivacyWarning(error?.message ?? "사안을 저장하지 못했습니다."); return; } const rows = emptyTasks("접수").map((task) => ({ case_id: data.id, user_id: session.user.id, stage: "접수", task_title: task.title, task_description: task.detail, status: "대기" })); await supabase.from("case_tasks").insert(rows); const created: CaseItem = { id: data.id, ...draft, stage: "접수", progress: 0, status: "진행 중", due: "확인 필요" }; setCases((current) => [created, ...current]); setSelectedId(created.id); setTasks(emptyTasks("접수")); } else { const created: CaseItem = { id: `local-${Date.now()}`, ...draft, stage: "접수", progress: 0, status: "진행 중", due: "확인 필요" }; setCases((current) => [created, ...current]); setSelectedId(created.id); setTasks(emptyTasks("접수")); }
    setShowRegister(false); setPrivacyWarning("");
  }

  function saveDocument() { const doc: DocumentItem = { id: `doc-${Date.now()}`, caseNumber: selected.number, title: `${selected.title} - ${aiMode === "report" ? "관리자 보고 초안" : aiMode === "message" ? "안내 문구 초안" : "업무 안내"}`, type: aiMode === "report" ? "관리자 보고" : aiMode === "message" ? "보호자 안내" : "업무 요약", content: aiContent, createdAt: new Date().toLocaleString("ko-KR"), status: "초안" }; setDocuments((current) => [doc, ...current]); if (session) void supabase.from("generated_documents").insert({ case_id: selected.id, user_id: session.user.id, document_type: doc.type, title: doc.title, content: doc.content, model_name: "prototype" }); }

  if (dataLoading && !session) return <main className="auth-screen"><div className="auth-card loading-card"><div className="auth-logo"><img className="brand-mark brand-logo" src="/modu-logo.png" alt="모두의 학폭비서 로고" /><div><strong>모두의 학폭비서</strong><span>학교 업무 지원 도구</span></div></div><p className="section-kicker">SECURE WORKSPACE</p><h1>안전한 업무 공간을 준비하고 있어요</h1><p className="auth-copy">로그인 상태와 사안 정보를 확인하는 중입니다.</p><div className="loading-line" /></div></main>;
  if (!session) return <main className="auth-screen"><div className="auth-card"><div className="auth-logo"><img className="brand-mark brand-logo" src="/modu-logo.png" alt="모두의 학폭비서 로고" /><div><strong>모두의 학폭비서</strong><span>학교 업무 지원 도구</span></div></div><p className="section-kicker">SECURE WORKSPACE</p><h1>{authMode === "signin" ? "업무를 이어서 시작하세요" : "담당교사 계정 만들기"}</h1><p className="auth-copy">사안 정보는 로그인한 사용자 본인만 조회할 수 있습니다.</p><form onSubmit={handleAuth}><label>이메일<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="teacher@school.kr" required /></label><label>비밀번호<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="6자 이상 입력" minLength={6} required /></label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? "처리 중..." : authMode === "signin" ? "로그인" : "계정 만들기"}</button></form><button className="auth-switch" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{authMode === "signin" ? "처음 사용하시나요? 계정 만들기" : "이미 계정이 있나요? 로그인"}</button><small className="auth-foot">개인정보는 비식별 원칙에 따라 입력해 주세요.</small></div></main>;

  const renderAiPanel = (compact = false) => <section className={compact ? "ai-panel" : "panel ai-full-panel"}><div className="ai-header"><div className="ai-orb">✦</div><div><p className="section-kicker">AI 업무 도우미</p><h2>지금 무엇을 도와드릴까요?</h2></div></div><p className="ai-caption">선택한 사안의 비식별 정보만 사용합니다. AI 결과는 참고용 초안이며 담당교사의 최종 확인이 필요합니다.</p><div className="ai-tabs"><button className={aiMode === "guide" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("guide")}>업무 안내</button><button className={aiMode === "report" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("report")}>보고서 초안</button><button className={aiMode === "message" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("message")}>안내 문구</button></div><div className="ai-result"><span className="result-label">{aiMode === "guide" ? "NEXT STEP" : aiMode === "report" ? "REPORT DRAFT" : "MESSAGE DRAFT"}</span><p>{aiLoading ? "초안을 준비하고 있습니다..." : aiContent}</p><div className="result-actions"><button onClick={() => navigator.clipboard?.writeText(aiContent)}>복사</button><button onClick={() => { setAiLoading(true); window.setTimeout(() => setAiLoading(false), 650); }}>↻ 다시 생성</button><button onClick={saveDocument}>문서로 저장</button></div></div><button className="ask-button" onClick={() => setAiMode("guide")}>✦ AI에게 질문하기</button></section>;

  let pageContent: React.ReactNode;
  if (activeNav === "사안 관리") pageContent = <section className="page-panel"><div className="panel-heading"><div><p className="section-kicker">CASE MANAGEMENT</p><h2>사안 관리</h2></div><button className="primary-button" onClick={() => setShowRegister(true)}>+ 사안 등록</button></div><div className="case-filter"><span>전체 사안 {cases.length}건</span><input placeholder="사안번호 또는 제목 검색" onChange={(event) => { const value = event.target.value.toLowerCase(); setCases(value ? cases.filter((item) => `${item.number} ${item.title}`.toLowerCase().includes(value)) : cases); }} /></div><CaseList cases={cases} selectedId={selected.id} onSelect={selectCase} /><Workflow selected={selected} tasks={tasks} onToggle={toggleTask} onAskAdvance={() => setConfirmAdvance(true)} /></section>;
  else if (activeNav === "AI 업무지원") pageContent = <section className="page-panel"><div className="panel-heading"><div><p className="section-kicker">AI WORKSPACE</p><h2>AI 업무지원</h2><p className="page-description">현재 선택된 사안에 필요한 초안을 만들고 저장합니다.</p></div><span className={statusClass(selected.status)}>{selected.number} · {selected.stage}</span></div><div className="tool-card-grid"><button className="tool-card" onClick={() => setAiMode("guide")}><span>✦</span><strong>절차 안내</strong><small>현재 단계의 다음 업무를 확인합니다.</small></button><button className="tool-card" onClick={() => setAiMode("report")}><span>▤</span><strong>관리자 보고 초안</strong><small>비식별 사안 경과를 보고서 형태로 정리합니다.</small></button><button className="tool-card" onClick={() => setAiMode("message")}><span>◌</span><strong>안내 문구 초안</strong><small>중립적인 안내 문구를 작성합니다.</small></button></div>{renderAiPanel(false)}</section>;
  else if (activeNav === "문서 이력") pageContent = <section className="page-panel"><div className="panel-heading"><div><p className="section-kicker">DOCUMENT HISTORY</p><h2>문서 이력</h2></div><span className="history-count">{documents.length}건</span></div><div className="history-toolbar"><input placeholder="문서 제목 또는 사안번호 검색" /><select defaultValue="all"><option value="all">전체 문서 유형</option><option>관리자 보고</option><option>보호자 안내</option><option>업무 요약</option></select></div>{documents.length === 0 ? <div className="empty-state"><div>▤</div><h3>저장된 문서가 없습니다</h3><p>AI 업무지원에서 초안을 만든 뒤 ‘문서로 저장’을 눌러 보세요.</p><button className="secondary-button" onClick={() => setActiveNav("AI 업무지원")}>AI 업무지원으로 이동</button></div> : <div className="document-list">{documents.map((doc) => <article className="document-row" key={doc.id}><div><span className="document-type">{doc.type}</span><h3>{doc.title}</h3><p>{doc.caseNumber} · {doc.createdAt}</p></div><div><span className="status status-wait">{doc.status}</span><button className="text-button">열어보기</button></div></article>)}</div>}</section>;
  else pageContent = <><div className="content-grid"><div className="main-column"><section className="metric-grid"><button className={metricFilter === "active" ? "metric-card metric-clickable active-metric" : "metric-card metric-clickable"} onClick={() => setMetricFilter(metricFilter === "active" ? null : "active")}><div className="metric-label"><span className="metric-dot blue" />진행 중인 사안</div><strong>{activeCaseCount}<small>건</small></strong><span className="metric-foot">등록된 사안 기준 · 클릭해서 보기</span></button><button className={metricFilter === "check" ? "metric-card metric-clickable active-metric" : "metric-card metric-clickable"} onClick={() => setMetricFilter(metricFilter === "check" ? null : "check")}><div className="metric-label"><span className="metric-dot orange" />오늘 확인할 업무</div><strong>{checkCaseCount}<small>건</small></strong><span className="metric-foot">진행 중인 사안 기준 · 클릭해서 보기</span></button><button className={metricFilter === "urgent" ? "metric-card metric-clickable active-metric" : "metric-card metric-clickable"} onClick={() => setMetricFilter(metricFilter === "urgent" ? null : "urgent")}><div className="metric-label"><span className="metric-dot red" />마감 임박 업무</div><strong>{urgentCaseCount}<small>건</small></strong><span className="metric-foot danger-text">오늘 마감 사안 기준 · 클릭해서 보기</span></button><button className={metricFilter === "closing" ? "metric-card metric-clickable active-metric" : "metric-card metric-clickable"} onClick={() => setMetricFilter(metricFilter === "closing" ? null : "closing")}><div className="metric-label"><span className="metric-dot green" />종결 대기 사안</div><strong>{closingCaseCount}<small>건</small></strong><span className="metric-foot">조치·검토 대기 기준 · 클릭해서 보기</span></button></section><MetricDetail filter={metricFilter} cases={cases} selectedId={selected.id} tasks={tasks} onSelect={selectCase} onClear={() => setMetricFilter(null)} /><section className="panel case-panel"><div className="panel-heading"><div><p className="section-kicker">MY CASES</p><h2>최근 사안</h2></div><button className="text-button" onClick={() => setActiveNav("사안 관리")}>전체 보기 →</button></div><CaseList cases={cases} selectedId={selected.id} onSelect={selectCase} /></section><Workflow selected={selected} tasks={tasks} onToggle={toggleTask} onAskAdvance={() => setConfirmAdvance(true)} /></div><aside className="right-column">{renderAiPanel(true)}<section className="panel caution-panel"><div className="panel-heading"><div><p className="section-kicker">CHECK BEFORE YOU USE</p><h3>담당교사 확인사항</h3></div><span className="caution-icon">!</span></div><ul><li>확인된 사실과 추정 내용을 구분했나요?</li><li>학생을 특정할 수 있는 정보가 없나요?</li><li>학교 지침과 실제 사실관계를 확인했나요?</li></ul></section></aside></div></>;

  return <main className="app-shell"><Sidebar activeNav={activeNav} onNavigate={setActiveNav} session={session} onSignOut={signOut} /><section className="workspace"><header className="topbar"><div><p className="eyebrow">수요일, 2024년 11월 20일</p><h1>{activeNav}</h1></div><div className="top-actions"><button className="icon-button" aria-label="도움말">?</button><button className="primary-button" onClick={() => setShowRegister(true)}>+ 사안 등록</button></div></header>{pageContent}</section>{showRegister && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="section-kicker">NEW CASE</p><h2>비식별 사안 등록</h2></div><button className="close-button" onClick={() => setShowRegister(false)}>×</button></div><p className="modal-intro">학생·보호자·교직원의 이름, 연락처, 주소 등 개인정보는 입력하지 마세요.</p><form onSubmit={registerCase}><div className="form-grid"><label>연도<select name="year" defaultValue={String(new Date().getFullYear())} required>{Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 2 + index).map((year) => <option key={year} value={year}>{year}년</option>)}</select></label><label>사안번호<input name="serial" inputMode="numeric" pattern="[0-9]+" placeholder="예: 018" required /></label><label>발생 날짜<input name="occurrenceDate" type="date" required /></label><label>발생 시간<input name="occurrenceTime" type="time" step="60" required /></label><label>발생 장소<input name="location" placeholder="예: 본관 1층 복도" required /></label><label>사안 제목<input name="title" placeholder="비식별 제목을 입력하세요" required /></label></div><label className="full-label">비식별 사안 개요<textarea name="summary" rows={4} placeholder="확인된 상황을 학생을 특정할 수 없도록 작성하세요." required /></label>{privacyWarning && <div className="privacy-warning">⚠ {privacyWarning}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>취소</button><button type="submit" className="primary-button">사안 등록하기</button></div></form></div></div>}{confirmAdvance && <div className="modal-backdrop"><div className="modal confirm-modal" role="dialog" aria-modal="true"><div className="caution-icon">!</div><h2>다음 단계로 이동할까요?</h2><p>현재 단계의 체크리스트가 모두 완료되었습니다. ‘확인’을 누르면 <strong>{selected.stage}</strong> 단계가 종료되고 <strong>{stages[stages.indexOf(selected.stage) + 1]}</strong> 단계의 새 체크리스트가 생성됩니다.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmAdvance(false)}>검토하기</button><button className="primary-button" onClick={advanceStage}>확인하고 이동</button></div></div></div>}</main>;
}
