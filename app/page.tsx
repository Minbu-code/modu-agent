"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Stage = "접수" | "초기 확인" | "조사" | "심의 준비" | "조치" | "종결";

type CaseItem = {
  id: string;
  number: string;
  title: string;
  summary: string;
  location: string;
  date: string;
  stage: Stage;
  progress: number;
  status: "진행 중" | "검토 대기" | "종결";
  due: string;
};

type TaskItem = { id?: string; title: string; detail: string; done: boolean };

const stages: Stage[] = ["접수", "초기 확인", "조사", "심의 준비", "조치", "종결"];

const initialCases: CaseItem[] = [
  {
    id: "case-24-017",
    number: "2024-017",
    title: "쉬는 시간 중 학생 간 언쟁",
    summary: "복도에서 발생한 언쟁과 관련해 사실관계를 확인 중인 사안입니다.",
    location: "본관 2층 복도",
    date: "2024. 11. 18. 10:20",
    stage: "조사",
    progress: 46,
    status: "진행 중",
    due: "오늘",
  },
  {
    id: "case-24-016",
    number: "2024-016",
    title: "단체 채팅방 내 갈등 신고",
    summary: "온라인 대화와 관련한 신고 접수 후 초기 확인을 진행하고 있습니다.",
    location: "온라인",
    date: "2024. 11. 15. 16:40",
    stage: "초기 확인",
    progress: 18,
    status: "검토 대기",
    due: "내일",
  },
  {
    id: "case-24-012",
    number: "2024-012",
    title: "수업 중 반복적인 갈등 상황",
    summary: "교과 수업 중 반복된 갈등 상황에 대한 처리 결과를 정리했습니다.",
    location: "3학년 교실",
    date: "2024. 11. 04. 09:10",
    stage: "종결",
    progress: 100,
    status: "종결",
    due: "완료",
  },
];

const defaultTasks: TaskItem[] = [
  { title: "사안 관련 기초 사실 확인", detail: "확인된 사실과 확인이 필요한 내용을 구분해 기록합니다.", done: true },
  { title: "관련 학생 면담 일정 확인", detail: "면담 전 확인할 질문과 유의사항을 준비합니다.", done: false },
  { title: "보호자 안내 필요 여부 검토", detail: "안내 시점과 전달 내용을 담당교사가 확인합니다.", done: false },
  { title: "관리자 보고 초안 검토", detail: "AI 초안은 사실관계 확인 후 수정해 사용합니다.", done: false },
];

function statusClass(status: CaseItem["status"]) {
  if (status === "종결") return "status status-done";
  if (status === "검토 대기") return "status status-wait";
  return "status status-progress";
}

export default function Home() {
  const [cases, setCases] = useState(initialCases);
  const [selectedId, setSelectedId] = useState(initialCases[0].id);
  const [tasks, setTasks] = useState<TaskItem[]>(defaultTasks);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("대시보드");
  const [showRegister, setShowRegister] = useState(false);
  const [aiMode, setAiMode] = useState<"guide" | "report" | "message">("guide");
  const [aiLoading, setAiLoading] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured) {
      setDataLoading(false);
      return () => { mounted = false; };
    }
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
      if (mounted && data.session) void loadCases(data.session.user.id);
      else if (mounted) setDataLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession) void loadCases(nextSession.user.id);
      else setDataLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadCases(userId: string) {
    setDataLoading(true);
    const { data, error } = await supabase.from("cases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (!error && data?.length) {
      const mapped: CaseItem[] = data.map((item) => ({ id: item.id, number: item.case_number, title: item.anonymous_title, summary: item.anonymous_summary, location: item.occurrence_location, date: item.occurrence_datetime ? new Date(item.occurrence_datetime).toLocaleString("ko-KR") : "미입력", stage: item.current_stage as Stage, progress: item.progress_rate, status: item.status as CaseItem["status"], due: "확인 필요" }));
      setCases(mapped);
      setSelectedId(mapped[0].id);
      await loadTasks(mapped[0].id, userId);
    }
    setDataLoading(false);
  }

  async function loadTasks(caseId: string, userId = session?.user.id) {
    if (!userId) return;
    const { data, error } = await supabase.from("case_tasks").select("id, task_title, task_description, status").eq("case_id", caseId).eq("user_id", userId).order("created_at");
    if (!error && data?.length) setTasks(data.map((item) => ({ id: item.id, title: item.task_title, detail: item.task_description ?? "담당교사가 확인할 업무입니다.", done: item.status === "완료" })));
    else setTasks(defaultTasks);
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true); setAuthError("");
    if (!isSupabaseConfigured) {
      setAuthError("Vercel 환경변수에 Supabase URL과 Publishable Key를 등록해 주세요.");
      setAuthBusy(false);
      return;
    }
    const result = authMode === "signin" ? await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }) : await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (result.error) setAuthError(result.error.message);
    else if (authMode === "signup" && !result.data.session) setAuthError("가입이 완료되었습니다. 이메일 인증 후 로그인해 주세요.");
    setAuthBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); }

  const selected = cases.find((item) => item.id === selectedId) ?? cases[0];
  const completedTasks = tasks.filter((task) => task.done).length;
  const progress = Math.round((completedTasks / tasks.length) * 100);

  const aiContent = useMemo(() => {
    if (aiMode === "report") {
      return "현재까지 확인된 사실을 중심으로 경과를 정리하고, 확인되지 않은 내용은 별도 표시하는 방식으로 보고서 초안을 구성할 수 있습니다. 실제 제출 전 담당교사가 사실관계와 학교 지침을 확인해 주세요.";
    }
    if (aiMode === "message") {
      return "안녕하세요. 학교에서는 현재 관련 사실관계를 확인하고 있습니다. 확인이 완료되는 대로 필요한 절차와 안내사항을 다시 전달드리겠습니다. 본 문구는 참고용 초안이며 실제 안내 전 담당교사의 검토가 필요합니다.";
    }
    return "현재 단계에서는 관련 학생 면담 일정 확인과 보호자 안내 필요 여부 검토가 우선입니다. 사실로 확인된 내용과 추가 확인이 필요한 내용을 나누어 기록하고, 판단이나 책임을 단정하는 표현은 피하세요.";
  }, [aiMode]);

  function toggleTask(index: number) {
    setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, done: !task.done } : task));
    const task = tasks[index];
    if (session && task?.id) void supabase.from("case_tasks").update({ status: task.done ? "대기" : "완료", completed_at: task.done ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", task.id).eq("user_id", session.user.id);
    const nextProgress = Math.round(((tasks.filter((item) => item.done).length + (task?.done ? -1 : 1)) / tasks.length) * 100);
    if (session) void supabase.from("cases").update({ progress_rate: nextProgress, updated_at: new Date().toISOString() }).eq("id", selected.id).eq("user_id", session.user.id);
  }

  function generateAi() {
    setAiLoading(true);
    window.setTimeout(() => setAiLoading(false), 650);
  }

  function registerCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const summary = String(form.get("summary") ?? "");
    const sensitive = /(010[- ]?\d{3,4}[- ]?\d{4}|\d{6}[- ]?\d{7}|[가-힣]{2,4}(학생|보호자|선생님)?)/.test(summary);
    if (sensitive) {
      setPrivacyWarning("이름, 연락처 또는 식별 가능한 정보가 포함된 것으로 보입니다. 비식별 정보로 수정해 주세요.");
      return;
    }
    const next: CaseItem = {
      id: `case-${Date.now()}`,
      number: String(form.get("number") || "2024-018"),
      title: String(form.get("title") || "새로 등록한 사안"),
      summary,
      location: String(form.get("location") || "미입력"),
      date: String(form.get("date") || "2024. 11. 20."),
      stage: "접수",
      progress: 0,
      status: "진행 중",
      due: "확인 필요",
    };
    if (session) {
      void (async () => {
        const { data, error } = await supabase.from("cases").insert({ user_id: session.user.id, case_number: next.number, occurrence_datetime: next.date, occurrence_location: next.location, school_level: "", case_type: "", anonymous_title: next.title, anonymous_summary: next.summary, current_stage: next.stage, progress_rate: 0, status: next.status }).select().single();
        if (error || !data) { setPrivacyWarning(error?.message ?? "사안을 저장하지 못했습니다."); return; }
        const savedCase = { ...next, id: data.id };
        const taskRows = defaultTasks.map((task) => ({ case_id: data.id, user_id: session.user.id, stage: "접수", task_title: task.title, task_description: task.detail, status: "대기" }));
        const { data: savedTasks } = await supabase.from("case_tasks").insert(taskRows).select("id, task_title, task_description, status");
        setCases((current) => [savedCase, ...current]); setSelectedId(savedCase.id); setTasks(savedTasks?.map((task) => ({ id: task.id, title: task.task_title, detail: task.task_description ?? "", done: task.status === "완료" })) ?? defaultTasks.map((task) => ({ ...task, done: false })));
        setShowRegister(false); setPrivacyWarning("");
      })();
    } else {
      setCases((current) => [next, ...current]); setSelectedId(next.id); setTasks(defaultTasks.map((task) => ({ ...task, done: false }))); setShowRegister(false); setPrivacyWarning("");
    }
  }

  if (!session && !dataLoading) return (
    <main className="auth-screen"><div className="auth-card"><div className="auth-logo"><div className="brand-mark">학</div><div><strong>모두의 학폭비서</strong><span>학교 업무 지원 도구</span></div></div><p className="section-kicker">SECURE WORKSPACE</p><h1>{authMode === "signin" ? "업무를 이어서 시작하세요" : "담당교사 계정 만들기"}</h1><p className="auth-copy">사안 정보는 로그인한 사용자 본인만 조회할 수 있습니다.</p><form onSubmit={handleAuth}><label>이메일<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="teacher@school.kr" required /></label><label>비밀번호<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="6자 이상 입력" minLength={6} required /></label>{authError && <div className="auth-error">{authError}</div>}<button className="primary-button auth-submit" type="submit" disabled={authBusy}>{authBusy ? "처리 중..." : authMode === "signin" ? "로그인" : "계정 만들기"}</button></form><button className="auth-switch" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{authMode === "signin" ? "처음 사용하시나요? 계정 만들기" : "이미 계정이 있나요? 로그인"}</button><small className="auth-foot">개인정보는 비식별 원칙에 따라 입력해 주세요.</small></div></main>
  );

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">학</div>
          <div><strong>모두의 학폭비서</strong><span>학교 업무 지원 도구</span></div>
        </div>
        <div className="profile-card"><div className="avatar">{(session.user.email ?? "담").slice(0, 1).toUpperCase()}</div><div><strong>{session.user.email}</strong><span>담당교사 계정</span></div><button aria-label="로그아웃" onClick={signOut}>↪</button></div>
        <nav className="nav-list" aria-label="주요 메뉴">
          {["대시보드", "사안 관리", "AI 업무지원", "문서 이력"].map((item) => <button key={item} className={activeNav === item ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(item)}><span className="nav-icon">{item === "대시보드" ? "⌂" : item === "사안 관리" ? "▤" : item === "AI 업무지원" ? "✦" : "◷"}</span>{item}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setActiveNav("개인 설정")}><span className="nav-icon">⚙</span>개인 설정</button><button className="nav-item" onClick={signOut}><span className="nav-icon">↪</span>로그아웃</button><div className="privacy-note"><span>✓</span><div><strong>개인정보 보호 중</strong><small>민감정보는 저장·전송 전 차단됩니다.</small></div></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><p className="eyebrow">수요일, 2024년 11월 20일</p><h1>{activeNav === "대시보드" ? "오늘의 업무를 가볍게 시작해요" : activeNav}</h1></div><div className="top-actions"><button className="icon-button" aria-label="도움말">?</button><button className="primary-button" onClick={() => setShowRegister(true)}>+ 사안 등록</button></div></header>

        <div className="content-grid">
          <div className="main-column">
            <section className="metric-grid">
              <div className="metric-card"><div className="metric-label"><span className="metric-dot blue"/>진행 중인 사안</div><strong>{cases.filter((item) => item.status !== "종결").length}<small>건</small></strong><span className="metric-foot">전체 사안 기준</span></div>
              <div className="metric-card"><div className="metric-label"><span className="metric-dot orange"/>오늘 확인할 업무</div><strong>3<small>건</small></strong><span className="metric-foot">마감이 가까운 순서</span></div>
              <div className="metric-card"><div className="metric-label"><span className="metric-dot red"/>마감 임박 업무</div><strong>1<small>건</small></strong><span className="metric-foot danger-text">오늘 안에 확인 필요</span></div>
              <div className="metric-card"><div className="metric-label"><span className="metric-dot green"/>종결 대기 사안</div><strong>2<small>건</small></strong><span className="metric-foot">마지막 확인 단계</span></div>
            </section>

            <section className="panel case-panel"><div className="panel-heading"><div><p className="section-kicker">MY CASES</p><h2>최근 사안</h2></div><button className="text-button" onClick={() => setActiveNav("사안 관리")}>전체 보기 →</button></div><div className="case-list">{cases.map((item) => <button key={item.id} className={selectedId === item.id ? "case-row selected" : "case-row"} onClick={() => { setSelectedId(item.id); void loadTasks(item.id); }}><div className="case-number">{item.number}</div><div className="case-copy"><strong>{item.title}</strong><span>{item.summary}</span></div><div className="case-stage"><span>{item.stage}</span><div className="mini-progress"><i style={{ width: `${item.progress}%` }}/></div></div><div className="case-due"><span className={statusClass(item.status)}>{item.status}</span><small>{item.due}</small></div><span className="chevron">›</span></button>)}</div></section>

            <section className="panel workflow-panel"><div className="panel-heading"><div><p className="section-kicker">SELECTED CASE · {selected.number}</p><h2>{selected.title}</h2></div><span className={statusClass(selected.status)}>{selected.status}</span></div><div className="case-summary"><div><span>발생 일시</span><strong>{selected.date}</strong></div><div><span>발생 장소</span><strong>{selected.location}</strong></div><div><span>현재 단계</span><strong>{selected.stage}</strong></div></div><div className="stage-track">{stages.map((stage, index) => <div key={stage} className={stages.indexOf(selected.stage) >= index ? "stage active" : "stage"}><span>{index + 1}</span><small>{stage}</small></div>)}</div><div className="task-header"><div><h3>현재 단계 체크리스트</h3><span>{completedTasks}/{tasks.length}개 완료 · 진행률 {progress}%</span></div><div className="progress-ring" style={{ background: `conic-gradient(var(--blue) ${progress}%, #e9edf4 0)` }}><span>{progress}%</span></div></div><div className="task-list">{tasks.map((task, index) => <label key={task.title} className={task.done ? "task done" : "task"}><input type="checkbox" checked={task.done} onChange={() => toggleTask(index)}/><span className="checkmark">✓</span><span><strong>{task.title}</strong><small>{task.detail}</small></span></label>)}</div></section>
          </div>

          <aside className="right-column"><section className="ai-panel"><div className="ai-header"><div className="ai-orb">✦</div><div><p className="section-kicker">AI 업무 도우미</p><h2>지금 무엇을 도와드릴까요?</h2></div></div><p className="ai-caption">선택한 사안의 비식별 정보만 사용합니다. AI 결과는 참고용 초안이며 담당교사의 최종 확인이 필요합니다.</p><div className="ai-tabs"><button className={aiMode === "guide" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("guide")}>업무 안내</button><button className={aiMode === "report" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("report")}>보고서 초안</button><button className={aiMode === "message" ? "ai-tab active" : "ai-tab"} onClick={() => setAiMode("message")}>안내 문구</button></div><div className="ai-result"><span className="result-label">{aiMode === "guide" ? "NEXT STEP" : aiMode === "report" ? "REPORT DRAFT" : "MESSAGE DRAFT"}</span><p>{aiLoading ? "초안을 준비하고 있습니다..." : aiContent}</p><div className="result-actions"><button onClick={() => navigator.clipboard?.writeText(aiContent)}>복사</button><button onClick={generateAi}>↻ 다시 생성</button><button>편집하기</button></div></div><button className="ask-button" onClick={() => setAiMode("guide")}>✦ AI에게 질문하기</button></section><section className="panel caution-panel"><div className="panel-heading"><div><p className="section-kicker">CHECK BEFORE YOU USE</p><h3>담당교사 확인사항</h3></div><span className="caution-icon">!</span></div><ul><li>확인된 사실과 추정 내용을 구분했나요?</li><li>학생을 특정할 수 있는 정보가 없나요?</li><li>학교 지침과 실제 사실관계를 확인했나요?</li></ul></section></aside>
        </div>
      </section>

      {showRegister && <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="register-title"><div className="modal-heading"><div><p className="section-kicker">NEW CASE</p><h2 id="register-title">비식별 사안 등록</h2></div><button className="close-button" onClick={() => setShowRegister(false)}>×</button></div><p className="modal-intro">학생·보호자·교직원의 이름, 연락처, 주소 등 개인정보는 입력하지 마세요.</p><form onSubmit={registerCase}><div className="form-grid"><label>사안번호<input name="number" placeholder="예: 2024-018" required/></label><label>발생 일시<input name="date" placeholder="예: 2024. 11. 20. 13:30" required/></label><label>발생 장소<input name="location" placeholder="예: 본관 1층 복도" required/></label><label>사안 제목<input name="title" placeholder="비식별 제목을 입력하세요" required/></label></div><label className="full-label">비식별 사안 개요<textarea name="summary" rows={4} placeholder="확인된 상황을 학생을 특정할 수 없도록 작성하세요." required/></label>{privacyWarning && <div className="privacy-warning">⚠ {privacyWarning}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowRegister(false)}>취소</button><button type="submit" className="primary-button">사안 등록하기</button></div></form></div></div>}
    </main>
  );
}
