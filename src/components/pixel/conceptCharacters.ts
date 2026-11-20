/**
 * 개념 도식 캐릭터 정의 (S 32x32 좌표). 규격: docs/pixel-character-spec.md §8, 콘텐츠별 구별 §13
 *
 * content = 소속 콘텐츠. 주 램프(ramp)는 콘텐츠 계열 램프, 보조 램프(ramp2)는 같은 계열 보조 또는 중립 램프만 쓴다.
 * 몸통 좌표는 도식 원형 좌표이고, 등록 때 콘텐츠 실루엣 상자에 맞춰 늘이고 줄인다(contentStyles.ts applyContentStyle).
 * 팔다리(arms·legs)는 실루엣이 없는 콘텐츠(현수형·공용)에서만 쓰인다.
 *
 * 몸통 = 개념을 설명할 때 실제로 그리는 도식. 가능하면 교재 예제 수치를 그대로 쓴다.
 * 눈은 도식의 꼭짓점·칸·노드 위에, 팔다리는 도식 가장자리에서 뻗는다.
 */
import type { DiagramCharacterDef } from './diagramCharacter'


export const CONCEPT_CHARACTERS: DiagramCharacterDef[] = [
  {
    key: 'd_fcfs',
    content: 'b_os',
    diagram: 'FCFS CPU 스케줄링 간트 차트: 도착 순서 P1(24)·P2(3)·P3(3), 시간축 눈금 0·24·27·30',
    ramp: 'famTeal',
    ramp2: 'famTealDeep',
    body: [
      // S 단순화: 짧은 블록은 최소 3칸으로 넓힘(순서·대소 관계 유지). 블록 사이 1칸 = 경계선
      { kind: 'rect', x: 3, y: 9, w: 18, h: 10 },
      { kind: 'rect', x: 22, y: 9, w: 3, h: 10, tone: 2 },
      { kind: 'rect', x: 26, y: 9, w: 3, h: 10 },
      // 시간축
      { kind: 'line', pts: [[2, 22], [29, 22]], w: 1, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 9, y: 13, look: 1 }, { x: 16, y: 13, look: 1 }],
      mouth: { x: 12, y: 16, w: 2 },
      arms: [{ from: [2, 12], to: [1, 4] }, { from: [30, 12], to: [30, 4] }],
      legs: [{ from: [8, 24], to: [8, 28] }, { from: [19, 24], to: [19, 28] }],
    },
  },
  {
    key: 'd_sjf',
    content: 'b_os',
    diagram: 'SJF: CPU 버스트 길이(3·6·7·8)를 짧은 순으로 세운 막대그래프 + 시간축',
    ramp: 'famTeal',
    ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 5, y: 15, w: 5, h: 5 },
      { kind: 'rect', x: 11, y: 10, w: 5, h: 10 },
      { kind: 'rect', x: 17, y: 8, w: 5, h: 12 },
      { kind: 'rect', x: 23, y: 6, w: 5, h: 14 },
      { kind: 'line', pts: [[3, 21], [29, 21]], w: 1, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 19, y: 11 }, { x: 25, y: 9 }],
      mouth: { x: 21, y: 15, w: 2 },
      arms: [{ from: [4, 17], to: [1, 13] }, { from: [29, 12], to: [31, 8] }],
      legs: [{ from: [12, 23], to: [11, 28] }, { from: [22, 23], to: [23, 28] }],
    },
  },
  {
    key: 'd_rr',
    content: 'b_os',
    diagram: '라운드 로빈: 시간 할당량 단위로 나뉜 원형 큐와 순환 화살표',
    ramp: 'famTeal',
    ramp2: 'stone',
    body: [
      { kind: 'ring', cx: 16, cy: 13, r: 10, w: 3 },
      // 할당량 경계(4칸)
      { kind: 'clear', x: 15, y: 2, w: 1, h: 4 },
      { kind: 'clear', x: 2, y: 12, w: 4, h: 1 },
      { kind: 'clear', x: 26, y: 12, w: 4, h: 1 },
      { kind: 'clear', x: 15, y: 20, w: 1, h: 4 },
      // 순환 방향 화살촉
      { kind: 'poly', pts: [[17, 0], [22, 3.5], [17, 7]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 13, y: 12 }, { x: 19, y: 12 }],
      mouth: { x: 15, y: 16, w: 2 },
      blush: true,
      arms: [{ from: [4, 17], to: [1, 20] }, { from: [28, 17], to: [30, 20] }],
      legs: [{ from: [12, 24], to: [11, 28] }, { from: [20, 24], to: [21, 28] }],
    },
  },
  {
    key: 'd_ready',
    content: 'b_os',
    diagram: '준비 큐: 프로세스 칸이 한 줄로 이어진 FIFO 큐, 오른쪽 맨 앞 칸이 CPU로 나감',
    ramp: 'famTeal',
    ramp2: 'famTealDeep',
    body: [
      { kind: 'rect', x: 2, y: 11, w: 23, h: 7 },
      { kind: 'clear', x: 7, y: 11, w: 1, h: 7 },
      { kind: 'clear', x: 13, y: 11, w: 1, h: 7 },
      { kind: 'clear', x: 19, y: 11, w: 1, h: 7 },
      { kind: 'rect', x: 20, y: 11, w: 5, h: 7, tone: 2 },
      // 나가는 화살표
      { kind: 'poly', pts: [[27, 10], [31, 14.5], [27, 19]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 22, y: 13 }, { x: 16, y: 13, look: 1 }],
      legs: [
        { from: [4, 19], to: [4, 24] }, { from: [10, 19], to: [10, 24] },
        { from: [16, 19], to: [16, 24] }, { from: [22, 19], to: [22, 24] },
      ],
    },
  },
  {
    key: 'd_sched',
    content: 'b_os',
    diagram: 'CPU 스케줄러: 준비 큐(왼쪽 칸 3개) → 선택 → CPU로 디스패치(오른쪽 화살표)',
    ramp: 'famTeal',
    ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 10, y: 5, w: 14, h: 15 },
      { kind: 'rect', x: 2, y: 6, w: 4, h: 3, tone: 2 },
      { kind: 'rect', x: 2, y: 11, w: 4, h: 3, tone: 2 },
      { kind: 'rect', x: 2, y: 16, w: 4, h: 3, tone: 2 },
      { kind: 'line', pts: [[25, 12], [27, 12]], w: 2, tone: 2 },
      { kind: 'poly', pts: [[28, 9], [31, 13], [28, 17]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 14, y: 10 }, { x: 20, y: 10 }],
      mouth: { x: 16, y: 15, w: 2 },
      arms: [{ from: [9, 13], to: [7, 13] }],
      legs: [{ from: [13, 21], to: [12, 27] }, { from: [21, 21], to: [22, 27] }],
    },
  },
  {
    key: 'd_convoy',
    content: 'b_os',
    diagram: '호위 효과: 긴 작업 블록 뒤에 짧은 작업들이 줄 선 간트 차트',
    ramp: 'famTeal',
    ramp2: 'famTealDeep',
    body: [
      { kind: 'rect', x: 2, y: 8, w: 18, h: 11 },
      { kind: 'rect', x: 21, y: 13, w: 3, h: 6, tone: 2 },
      { kind: 'rect', x: 25, y: 13, w: 3, h: 6, tone: 2 },
      { kind: 'rect', x: 29, y: 13, w: 2, h: 6, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 6, y: 12, look: -1 }, { x: 12, y: 12, look: -1 }],
      mouth: { x: 8, y: 16, w: 3 },
      legs: [{ from: [6, 20], to: [5, 26] }, { from: [16, 20], to: [17, 26] }, { from: [26, 20], to: [26, 25] }],
    },
  },
  {
    key: 'd_burst',
    content: 'b_os',
    diagram: 'CPU 버스트: CPU 사용(높음)과 I/O 대기(낮음)가 번갈아 나오는 실행 타임라인',
    ramp: 'famTeal',
    ramp2: 'leather',
    body: [
      { kind: 'line', pts: [[1, 17], [3, 17], [3, 6], [13, 6], [13, 17], [16, 17], [16, 9], [22, 9], [22, 17], [25, 17], [25, 11], [29, 11], [29, 17], [30, 17]] },
    ],
    rig: {
      eyes: [{ x: 6, y: 10 }, { x: 11, y: 10 }],
      mouth: { x: 8, y: 14, w: 2 },
      arms: [{ from: [2, 12], to: [0, 9] }],
      legs: [{ from: [14, 20], to: [13, 26] }, { from: [24, 20], to: [25, 26] }],
    },
  },
  {
    key: 'd_preempt',
    content: 'b_os',
    diagram: '선점형 스케줄링: 실행 중 P1을 P2가 끊고 들어오는 간트 차트 + 위에서 꽂히는 인터럽트 화살표',
    ramp: 'famTeal',
    ramp2: 'famTealDeep',
    body: [
      { kind: 'rect', x: 2, y: 12, w: 8, h: 7 },
      { kind: 'rect', x: 11, y: 10, w: 10, h: 9, tone: 2 },
      { kind: 'rect', x: 22, y: 12, w: 8, h: 7 },
      { kind: 'line', pts: [[15, 1], [15, 5]], tone: 2 },
      { kind: 'poly', pts: [[12, 5], [16, 9], [20, 5]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 14, y: 14 }, { x: 19, y: 14 }],
      mouth: { x: 16, y: 17, w: 1 },
      arms: [{ from: [10, 11], to: [7, 8] }, { from: [22, 11], to: [25, 8] }],
      legs: [{ from: [13, 20], to: [12, 26] }, { from: [19, 20], to: [20, 26] }],
    },
  },
  {
    key: 'd_nonpre',
    content: 'b_os',
    diagram: '비선점형 스케줄링: P1이 끝까지 실행된 뒤 P2 시작. P2 도착 화살표는 P1 끝에서 대기',
    ramp: 'famTeal',
    ramp2: 'stone',
    body: [
      { kind: 'rect', x: 2, y: 10, w: 19, h: 9 },
      { kind: 'rect', x: 22, y: 12, w: 8, h: 7, tone: 2 },
      { kind: 'line', pts: [[25, 2], [25, 6]], tone: 2, w: 2 },
      { kind: 'poly', pts: [[22, 6], [26, 10], [30, 6]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 8, y: 14 }, { x: 14, y: 14 }],
      mouth: { x: 10, y: 17, w: 2 },
      arms: [{ from: [1, 14], to: [0, 10] }],
      legs: [{ from: [6, 20], to: [5, 26] }, { from: [16, 20], to: [17, 26] }, { from: [26, 20], to: [26, 25] }],
    },
  },
  {
    key: 'd_criteria',
    content: 'b_os',
    diagram: '평가 기준: CPU 이용률·처리량·총처리 시간·대기 시간·응답 시간 5축 레이더 차트',
    ramp: 'famTeal',
    ramp2: 'clothParch',
    body: [
      { kind: 'poly', pts: [[16, 1], [29, 10], [24, 24], [8, 24], [3, 10]] },
      { kind: 'poly', pts: [[16, 5], [26, 11], [21, 21], [11, 20], [7, 11]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 13, y: 12 }, { x: 19, y: 12 }],
      mouth: { x: 15, y: 16, w: 2 },
      blush: true,
      arms: [{ from: [3, 13], to: [1, 17] }, { from: [29, 13], to: [31, 17] }],
      legs: [{ from: [12, 25], to: [11, 29] }, { from: [20, 25], to: [21, 29] }],
    },
  },
  /* ───── 순수이성비판(칸트) ───── */
  {
    key: 'd_synth',
    content: 'b_kant',
    diagram: '선험적 종합 판단: 판단 분류표 2x2(열 분석·종합, 행 선험·후험). 선험·종합 칸 강조, 분석·후험 칸은 비어 있음',
    ramp: 'famViolet',
    ramp2: 'famVioletDeep',
    body: [
      { kind: 'rect', x: 3, y: 4, w: 26, h: 18 },
      // 행·열 경계
      { kind: 'clear', x: 3, y: 13, w: 26, h: 1 },
      { kind: 'clear', x: 16, y: 4, w: 1, h: 18 },
      // 선험적 종합(오른쪽 위) 강조
      { kind: 'rect', x: 17, y: 4, w: 12, h: 9, tone: 2 },
      // 분석·후험(왼쪽 아래): 성립하지 않는 칸 → 테두리만
      { kind: 'clear', x: 5, y: 16, w: 9, h: 4 },
    ],
    rig: {
      eyes: [{ x: 20, y: 8 }, { x: 26, y: 8 }],
      mouth: { x: 22, y: 11, w: 2 },
      arms: [{ from: [2, 9], to: [0, 5] }, { from: [30, 9], to: [31, 5] }],
      legs: [{ from: [8, 23], to: [7, 28] }, { from: [24, 23], to: [25, 28] }],
    },
  },
  {
    key: 'd_turn',
    content: 'b_kant',
    diagram: '코페르니쿠스적 전회: 중심의 인식 주관과 그 둘레 궤도를 도는 대상, 회전 방향 화살촉',
    ramp: 'famViolet',
    ramp2: 'clothParch',
    body: [
      { kind: 'ring', cx: 16, cy: 13, r: 12, w: 2 },
      { kind: 'disc', cx: 16, cy: 13, r: 6 },
      // 궤도 위 대상
      { kind: 'disc', cx: 24.5, cy: 4.5, r: 3, tone: 2 },
      // 회전 방향
      { kind: 'poly', pts: [[1, 15], [4, 10], [7, 15]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 13, y: 12 }, { x: 19, y: 12 }],
      mouth: { x: 15, y: 16, w: 2 },
      legs: [{ from: [12, 26], to: [11, 29] }, { from: [20, 26], to: [21, 29] }],
    },
  },
  {
    key: 'd_sense',
    content: 'b_kant',
    diagram: '감성의 순수 직관 형식: 공간(3x3 좌표 격자) + 시간(한 방향 화살표 축)',
    ramp: 'famViolet',
    ramp2: 'stone',
    body: [
      { kind: 'rect', x: 5, y: 2, w: 22, h: 16 },
      { kind: 'clear', x: 12, y: 2, w: 1, h: 16 },
      { kind: 'clear', x: 20, y: 2, w: 1, h: 16 },
      { kind: 'clear', x: 5, y: 8, w: 22, h: 1 },
      { kind: 'clear', x: 5, y: 13, w: 22, h: 1 },
      // 시간축
      { kind: 'line', pts: [[3, 21], [25, 21]], tone: 2 },
      { kind: 'poly', pts: [[25, 18.5], [30, 22], [25, 25.5]], tone: 2 },
    ],
    rig: {
      eyes: [{ x: 8, y: 5 }, { x: 16, y: 5 }],
      mouth: { x: 15, y: 11, w: 2 },
      arms: [{ from: [4, 10], to: [1, 7] }, { from: [28, 10], to: [31, 7] }],
      legs: [{ from: [9, 24], to: [8, 28] }, { from: [20, 24], to: [20, 28] }],
    },
  },
  {
    key: 'd_noumenon',
    content: 'b_kant',
    diagram: '현상과 물자체: 인식되는 현상(채운 영역) | 경계 | 인식할 수 없는 물자체(빈 테두리)',
    ramp: 'famViolet',
    ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 2, y: 7, w: 13, h: 13 },
      { kind: 'rect', x: 17, y: 7, w: 13, h: 13, tone: 2 },
      { kind: 'clear', x: 19, y: 9, w: 9, h: 9 },
    ],
    rig: {
      eyes: [{ x: 6, y: 12, look: 1 }, { x: 11, y: 12, look: 1 }],
      mouth: { x: 8, y: 16, w: 2 },
      arms: [{ from: [1, 13], to: [0, 9] }],
      legs: [{ from: [6, 21], to: [5, 27] }, { from: [25, 21], to: [26, 27] }],
    },
  },
  {
    key: 'd_faculty',
    content: 'b_kant',
    diagram: '인식 능력 구조도: 감성(아래, 넓음)·지성(가운데, 강조)·이성(위) 3층',
    ramp: 'famViolet',
    ramp2: 'famVioletDeep',
    body: [
      { kind: 'rect', x: 2, y: 19, w: 28, h: 6 },
      { kind: 'rect', x: 6, y: 11, w: 20, h: 7, tone: 2 },
      { kind: 'rect', x: 10, y: 4, w: 12, h: 6 },
    ],
    rig: {
      eyes: [{ x: 12, y: 14 }, { x: 20, y: 14 }],
      mouth: { x: 15, y: 16, w: 2 },
      arms: [{ from: [5, 14], to: [1, 12] }, { from: [27, 14], to: [31, 12] }],
      legs: [{ from: [9, 26], to: [8, 29] }, { from: [23, 26], to: [24, 29] }],
    },
  },
  {
    key: 'd_categories',
    content: 'b_kant',
    diagram: '범주표: 양(위)·질(왼쪽)·관계(오른쪽, 강조)·양상(아래) 4묶음 x 3칸 = 12범주, 원전의 십자 배치',
    ramp: 'famViolet',
    ramp2: 'clothParch',
    body: [
      ...([
        [9, 1, 1], // 양
        [1, 11, 1], // 질
        [17, 11, 2], // 관계
        [9, 21, 1], // 양상
      ] as const).flatMap(([x, y, tone]) => [
        { kind: 'rect' as const, x, y, w: 14, h: 7, tone },
        { kind: 'clear' as const, x: x + 4, y, w: 1, h: 7 },
        { kind: 'clear' as const, x: x + 9, y, w: 1, h: 7 },
      ]),
    ],
    rig: {
      // 눈 = 질·관계 묶음의 가운데 칸
      eyes: [{ x: 8, y: 14, look: 1 }, { x: 24, y: 14, look: -1 }],
      legs: [{ from: [4, 19], to: [3, 25] }, { from: [27, 19], to: [28, 25] }],
    },
  },
  {
    key: 'd_causality',
    content: 'b_kant',
    diagram: '인과성: 원인 블록 → 결과 블록, 시간 순서 축',
    ramp: 'famViolet',
    ramp2: 'famVioletDeep',
    body: [
      { kind: 'rect', x: 1, y: 8, w: 12, h: 11 },
      { kind: 'line', pts: [[14, 13], [17, 13]], tone: 2 },
      { kind: 'poly', pts: [[17, 9.5], [21, 13.5], [17, 17.5]], tone: 2 },
      { kind: 'rect', x: 22, y: 8, w: 9, h: 11 },
      { kind: 'line', pts: [[1, 22], [30, 22]], w: 1, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 4, y: 12 }, { x: 10, y: 12 }],
      mouth: { x: 6, y: 16, w: 2 },
      legs: [{ from: [5, 24], to: [4, 28] }, { from: [26, 24], to: [27, 28] }],
    },
  },
  {
    key: 'd_reason',
    content: 'b_kant',
    diagram: '이성: 조건의 계열(올라가는 계단 3단)을 거슬러 무조건자(왼쪽 위 고리)로 손을 뻗지만 닿지 않음',
    ramp: 'famViolet',
    ramp2: 'stone',
    body: [
      { kind: 'rect', x: 1, y: 20, w: 8, h: 5 },
      { kind: 'rect', x: 10, y: 15, w: 8, h: 10 },
      { kind: 'rect', x: 19, y: 10, w: 10, h: 15 },
      { kind: 'ring', cx: 8, cy: 6, r: 4, w: 2, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 21, y: 14, look: -1 }, { x: 26, y: 14, look: -1 }],
      mouth: { x: 23, y: 18, w: 2 },
      arms: [{ from: [19, 11], to: [15, 6] }],
      legs: [{ from: [22, 26], to: [21, 29] }, { from: [27, 26], to: [28, 29] }],
    },
  },
  {
    key: 'd_antinomy',
    content: 'b_kant',
    diagram: '이율배반: 정립(왼쪽)과 반정립(오른쪽)이 가운데서 맞부딪치는 대립 도식',
    ramp: 'famViolet',
    ramp2: 'famVioletDeep',
    body: [
      { kind: 'rect', x: 1, y: 8, w: 10, h: 12 },
      { kind: 'poly', pts: [[11, 10], [15, 14], [11, 18]] },
      { kind: 'poly', pts: [[21, 10], [17, 14], [21, 18]], tone: 2 },
      { kind: 'rect', x: 21, y: 8, w: 10, h: 12, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 6, y: 13, look: 1 }, { x: 26, y: 13, look: -1 }],
      legs: [{ from: [5, 21], to: [4, 27] }, { from: [26, 21], to: [27, 27] }],
    },
  },
  {
    key: 'd_hash',
    content: 's_hash',
    diagram: '해시 테이블: 버킷 배열(위 4칸)과 체이닝 연결 리스트(아래로 매달린 노드)',
    ramp: 'famLime',
    ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 3, y: 5, w: 26, h: 8 },
      { kind: 'clear', x: 9, y: 5, w: 1, h: 8 },
      { kind: 'clear', x: 16, y: 5, w: 1, h: 8 },
      { kind: 'clear', x: 22, y: 5, w: 1, h: 8 },
      // 체인: 버킷0 → 노드 2개, 버킷3 → 노드 1개
      { kind: 'rect', x: 4, y: 17, w: 4, h: 3, tone: 2 },
      { kind: 'rect', x: 24, y: 17, w: 4, h: 3, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 13, y: 9 }, { x: 19, y: 9 }],
      arms: [{ from: [2, 9], to: [0, 4] }, { from: [30, 9], to: [31, 4] }],
      legs: [{ from: [6, 14], to: [6, 26] }, { from: [26, 14], to: [26, 26] }],
    },
  },
  {
    key: 'd_attention',
    content: 'b_attention',
    diagram: 'Transformer 셀프 어텐션: 토큰×토큰 어텐션 가중치 행렬(대각선이 진함)',
    ramp: 'famCrimson',
    ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 5, y: 4, w: 22, h: 18, tone: 2 },
      ...[0, 1, 2, 3].map((i) => ({ kind: 'rect' as const, x: 5 + i * 5 + (i ? 1 : 0), y: 4 + i * 4 + (i ? 1 : 0), w: 5, h: 4 })),
      { kind: 'rect', x: 11, y: 4, w: 3, h: 3 },
      { kind: 'rect', x: 16, y: 13, w: 4, h: 3 },
    ],
    rig: {
      eyes: [{ x: 10, y: 9 }, { x: 21, y: 9 }],
      mouth: { x: 15, y: 18, w: 2 },
      arms: [{ from: [4, 13], to: [1, 16] }, { from: [28, 13], to: [31, 16] }],
      legs: [{ from: [11, 23], to: [10, 28] }, { from: [21, 23], to: [22, 28] }],
    },
  },
  {
    key: 'd_node',
    diagram: '관계도 노드: 원 노드 1개와 이웃 노드로 이어진 간선. 전용 도식이 없는 개념의 기본형',
    ramp: 'clothParch',
    ramp2: 'stone',
    body: [
      { kind: 'disc', cx: 16, cy: 13, r: 9 },
      { kind: 'line', pts: [[6, 8], [3, 5]], w: 1, tone: 2 },
      { kind: 'line', pts: [[25, 8], [28, 5]], w: 1, tone: 2 },
      { kind: 'disc', cx: 2.5, cy: 3.5, r: 2.5, tone: 2 },
      { kind: 'disc', cx: 29.5, cy: 3.5, r: 2.5, tone: 2 },
    ],
    rig: {
      eyes: [{ x: 13, y: 12 }, { x: 19, y: 12 }],
      mouth: { x: 15, y: 16, w: 2 },
      blush: true,
      legs: [{ from: [12, 22], to: [11, 28] }, { from: [20, 22], to: [21, 28] }],
    },
  },
]

const versionCharacters = [
  ['v_major', '주 버전', 'clothBerry', 1],
  ['v_minor', '부 버전', 'clothSky', 2],
  ['v_patch', '수 버전', 'clothGreen', 3],
] as const

for (const [key, diagram, ramp, position] of versionCharacters) {
  CONCEPT_CHARACTERS.push({
    key, diagram, ramp, ramp2: 'clothParch',
    body: [
      { kind: 'rect', x: 6, y: 5, w: 20, h: 18 },
      // Three parts of X.Y.Z; the active position is taller and brighter.
      ...Array.from({ length: 3 }, (_, i) => ({
        kind: 'rect' as const, x: 9 + i * 5, y: i + 1 === position ? 16 : 19,
        w: 3, h: i + 1 === position ? 5 : 2, tone: 2 as const,
      })),
    ],
    rig: {
      eyes: [{ x: 12, y: 10 }, { x: 20, y: 10 }],
      mouth: { x: 15, y: 13, w: 2 },
      arms: [{ from: [6, 13], to: [3, 18] }, { from: [25, 13], to: [28, 18] }],
      legs: [{ from: [10, 22], to: [10, 28] }, { from: [22, 22], to: [22, 28] }],
    },
  })
}
