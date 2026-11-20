import { useState } from 'react'
import { Button, Panel } from '@/components/ui'

/** 제작 흐름 미리보기. 파일은 업로드하거나 분석하지 않는다. */
export function CuratedBookPage() {
  const [files, setFiles] = useState<File[]>([])
  const [topic, setTopic] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  return (
    <div className="col" style={{ gap: 16 }}>
      <Button to="/library" variant="ghost" size="sm">← 서재로 돌아가기</Button>
      <div className="col" style={{ gap: 6 }}>
        <span className="tag g" style={{ alignSelf: 'flex-start' }}>준비 중 · 화면 미리보기</span>
        <h1 style={{ fontSize: 24, margin: 0 }}>내 자료에 맞는 책 만들기</h1>
        <p className="lbl">내가 공부하는 주제에 맞춰 공식 무료 콘텐츠를 한 권으로 모아요.</p>
      </div>
      <Panel tone="white" stack gap={8}>
        <b>아직 책을 만들 수 없어요</b>
        <p>이 화면은 제작 흐름을 살펴보기 위한 미리보기예요. 선택한 파일은 업로드하거나 분석하지 않으며, 새 책도 저장되지 않아요.</p>
      </Panel>
      <div className="row" aria-label="진행 단계" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className={step === 1 ? 'chip on' : 'chip'}>1 자료와 주제</span>
        <span className={step === 2 ? 'chip on' : 'chip'}>2 구성 확인</span>
      </div>
      {step === 1 ? (
        <>
          <Panel title="참고 자료 선택" stack gap={12}>
            <p>강의 자료나 공부 중인 문서를 참고해 관련 내용을 찾을 예정이에요.</p>
            <label htmlFor="curation-files"><b>파일 선택</b></label>
            <input id="curation-files" className="input" type="file" multiple accept=".pdf,.pptx,.png,.txt,.md" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <span className="lbl">지원 예정: PDF, PPTX, PNG, TXT, MD · 파일은 현재 기기에서만 선택돼요.</span>
            {files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>)}</ul>}
          </Panel>
          <Panel title="관심 주제" stack gap={10}>
            <label htmlFor="curation-topic">어떤 내용을 모으고 싶나요?</label>
            <input id="curation-topic" className="input" placeholder="예: 운영체제의 CPU 스케줄링" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={100} />
            <span className="lbl">입력한 주제는 이 화면에서만 사용돼요.</span>
          </Panel>
          <Button full onClick={() => setStep(2)}>다음 단계 살펴보기</Button>
        </>
      ) : (
        <>
          <Panel title="구성 확인" stack gap={12}>
            <span className="lbl">미리보기 · 실제 검색 결과가 아니에요</span>
            <b>{topic.trim() || '나의 학습 주제'}</b>
            <p>선택한 참고 파일 {files.length}개를 바탕으로 주제를 확인하고, 이용 권리가 확인된 공식 무료 콘텐츠를 찾는 단계가 들어갈 예정이에요.</p>
            <div className="col" style={{ gap: 6 }}>
              <b>앞으로 확인할 내용</b>
              <p>관련 주제와 공식 콘텐츠 선택 → 목차와 원문 출처 확인 → 개인 책 생성</p>
            </div>
            <p className="lbl">관련된 공식 콘텐츠가 부족할 수 있어요. 결과마다 원문 출처를 확인할 수 있도록 준비할 예정이에요.</p>
          </Panel>
          <Button full disabled>책 만들기 준비 중</Button>
          <Button full variant="ghost" onClick={() => setStep(1)}>이전 단계</Button>
        </>
      )}
    </div>
  )
}
