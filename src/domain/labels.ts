import type { Category, LayoutMode, LibraryView, MemoType, PaymentMethod, QuizKind, QuizResult, ReaderSettings, ReadingMode } from './types'

export const CATEGORY_LABEL: Record<Category, string> = {
  major: '전공 자료',
  paper: '논문',
  novel: '소설',
  poetry: '시',
  cs_book: 'CS 서적',
  general: '일반 도서',
}

export const ANALYSIS_LABEL: Record<Category, string> = {
  novel: '인물·상징 관계도',
  poetry: '시어·심상 사전',
  cs_book: 'CS 개념 흐름도',
  paper: '논문 논리 구조도',
  major: '관계도',
  general: '관계도',
}

/** 원화 표기: 9900 → "9,900원" */
export const formatPrice = (won: number) => `${won.toLocaleString('ko-KR')}원`

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { card: '카드', easy: '간편결제', transfer: '계좌이체' }

export const MEMO_TYPE_LABEL: Record<MemoType, string> = { memo: '메모', hypothesis: '질문·가설' }

export const QUIZ_KIND_LABEL: Record<QuizKind, string> = {
  recall: '사실 회상',
  relation: '관계 설명',
  application: '원리 적용',
}

export const QUIZ_RESULT_LABEL: Record<QuizResult, string> = {
  correct: '정답',
  partial: '부분 정답',
  wrong: '오답',
  forgot: '기억 안 남',
  skipped: '건너뜀',
}

/* ─ 설정 선택지 (리더 시트·4.3 설정 공용) ─ */
export const FONT_SIZES = [15, 17, 19, 21] as const
export const LINE_HEIGHTS = [1.6, 1.8, 2.0] as const
export const THEME_OPTIONS: Array<{ value: ReaderSettings['theme']; label: string }> = [
  { value: 'parchment', label: '양피지' },
  { value: 'light', label: '밝게' },
  { value: 'dark', label: '어둡게' },
]
export const READING_MODE_OPTIONS: Array<{ value: ReadingMode; label: string }> = [
  { value: 'scroll', label: '스크롤' },
  { value: 'page', label: '페이지 넘기기' },
]
export const READING_MODE_HINT: Record<ReadingMode, string> = {
  scroll: '위아래로 밀어 이어 읽음',
  page: '화면 양옆을 누르거나 옆으로 밀어 한 쪽씩 넘김',
}
export const LAYOUT_MODE_LABEL: Record<LayoutMode, string> = { auto: '자동', mobile: '모바일', tablet: '태블릿' }
export const LIBRARY_VIEW_LABEL: Record<LibraryView, string> = { list: '목록형', shelf: '책장형' }
