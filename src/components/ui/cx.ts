/** falsy 값을 제외하고 클래스명 결합 */
export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')
