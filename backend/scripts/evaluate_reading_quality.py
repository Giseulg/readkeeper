"""Export a read-only Supabase pilot evaluation; never invent semantic scores."""
import argparse
import csv
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

from backend.app.reading import analysis_for, curated_case_view, open_db, rows, visible_genre

BOOKS = ('sample-good-luck', 'sample-preface-poem',
         '787b0dbd72c84041ba15f68a7f3a0c04', 'paper-solar-overlap-2026')
FIELDS = {'description', 'explanation', 'literal_meaning', 'contextual_meaning', 'imagery',
          'emotion', 'technique', 'reading_point', 'caution', 'purpose', 'operation',
          'distinction', 'analogy', 'analogy_limit', 'example', 'connection_reason',
          'interpretation', 'reason', 'personality', 'motivation', 'appearance', 'relation'}


def walk(value, path='root', inherited=None):
    if isinstance(value, dict):
        evidence = value.get('evidence', inherited or [])
        if 'first_value' in value and 'second_value' in value:
            yield f'{path}.comparison', f"{value.get('reference', '')} {value.get('metric', '')}: {value.get('first_label', '')}={value['first_value']}; {value.get('second_label', '')}={value['second_value']}", evidence
        if isinstance(value.get('attributes'), dict):
            for label, text in value['attributes'].items():
                if isinstance(text, str) and text.strip():
                    yield f'{path}.attributes.{label}', f"{value.get('name', '')} · {label}: {text}", evidence
        for key, item in value.items():
            if key in FIELDS and isinstance(item, str) and item.strip():
                for number, sentence in enumerate(re.split(r'(?<=[.!?])\s+(?=[가-힣A-Za-z‘“])', item)):
                    yield f'{path}.{key}.{number}', sentence, evidence
            elif key != 'evidence':
                yield from walk(item, f'{path}.{key}', evidence)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk(item, f'{path}.{index}', inherited)


def proofs(value):
    if isinstance(value, dict):
        if isinstance(value.get('ordinal'), int) and 'quote' in value:
            yield value
        for item in value.values():
            yield from proofs(item)
    elif isinstance(value, list):
        for item in value:
            yield from proofs(item)


def genre_for(analysis):
    if 'poetryDictionary' in analysis:
        data = analysis['poetryDictionary']
        return {'category': 'poetry', 'sections': [
            {'imagery': data['imagery'], 'summary': [], 'personas': []},
            {'complete_only': True, 'summary': data['overview'], 'personas': []}]}
    if 'studyMap' in analysis:
        return {'category': 'cs_book', 'sections': [{'flow': analysis['studyMap']['flow'], 'summary': [], 'personas': []}]}
    if 'researchMap' in analysis:
        return {'category': 'paper', 'sections': [{'logic': analysis['researchMap']['logic'], 'summary': [], 'personas': []}]}
    return analysis.get('genre')


def write_csv(path, records, fields):
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--raw-poetry-dir', type=Path)
    args = parser.parse_args()
    # Refuse overwrite: a score must refer to one frozen snapshot.
    args.output.mkdir(parents=True, exist_ok=False)
    packets, claims, questions, checks = [], [], [], []
    with closing(open_db()) as db:
        for bid in BOOKS:
            book = db.execute('SELECT id,title,category FROM books WHERE id=?', (bid,)).fetchone()
            source = rows(db, 'SELECT ordinal,text FROM passages WHERE book_id=? ORDER BY ordinal', bid)
            analysis = analysis_for(db, bid)
            digest = hashlib.sha256(json.dumps([source, analysis], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            packets.append({'book': dict(book), 'sha256': digest, 'source': source, 'analysis': analysis,
                            'stage': 'published_current', 'raw_baseline': 'separate_artifacts_required'})
            source_by_id = {item['ordinal']: item['text'] for item in source}
            genre = genre_for(analysis)
            scope = {'genre': genre} if genre else {'nodes': analysis.get('nodes', []),
                    'edges': [{**edge, 'evidence': [{'ordinal': edge['ordinal'],
                               'quote': edge.get('quote') or source_by_id.get(edge['ordinal'], '')}]}
                              for edge in analysis.get('edges', [])]}
            citations = list(proofs(scope))
            bad = [p for p in citations if p['ordinal'] not in source_by_id
                   or not p['quote'] or p['quote'] not in source_by_id[p['ordinal']]]
            checks.append({'book_id': bid, 'check': '인용 문자열 일치', 'tested': len(citations),
                           'failures': len(bad), 'detail': json.dumps(bad, ensure_ascii=False)})
            for path, text, evidence in walk(scope):
                claims.append({'unit_id': hashlib.sha256(f'{bid}:{path}'.encode()).hexdigest()[:16],
                               'book_id': bid, 'snapshot_sha256': digest, 'path': path, 'claim': text,
                               'evidence_json': json.dumps(evidence, ensure_ascii=False),
                               'correct': '', 'supported': '', 'critical_error': '', 'note': ''})
            case = analysis.get('case')
            if isinstance(case, dict):
                public = curated_case_view(db, bid, case)
                forbidden = {'answer', 'explanation', 'slotExplanations'} & public.keys()
                checks.append({'book_id': bid, 'check': '풀이 전 정답·해설 필드 차단', 'tested': 1,
                               'failures': int(bool(forbidden)), 'detail': ','.join(sorted(forbidden))})
                card_by_id = {card['id']: card['text'] for card in case['cards']}
                for slot in case['slots']:
                    ids = slot.get('choiceIds', list(card_by_id))
                    if case.get('mode') == 'poetry_exam':
                        valid = len(ids) == 5 and len(set(ids)) == 5 and all(cid in card_by_id for cid in ids)
                        valid = valid and case['answer'].get(slot['id']) in ids and len({card_by_id[cid] for cid in ids}) == 5
                        checks.append({'book_id': bid, 'check': '5지선다 형식', 'tested': 1, 'failures': int(not valid), 'detail': slot['id']})
                    questions.append({'unit_id': f'{bid}:{slot["id"]}', 'book_id': bid,
                                      'snapshot_sha256': digest, 'kind': case.get('mode', 'card_connection'),
                                      'prompt': slot['label'], 'choices_json': json.dumps([card_by_id[cid] for cid in ids], ensure_ascii=False),
                                      'answer': card_by_id.get(case['answer'].get(slot['id']), ''),
                                      'explanation': case.get('slotExplanations', {}).get(slot['id'], case.get('explanation', '')),
                                      'evidence_json': json.dumps(case.get('evidenceBySlot', {}).get(slot['id'], case.get('evidence', []))),
                                      'single_best_answer': '', 'explanations_correct_count': '',
                                      'explanations_total_count': 5 if case.get('mode') == 'poetry_exam' else 1,
                                      'critical_error': '', 'note': ''})
            if genre:
                failures = 0
                for boundary in (-1, max(source_by_id) // 2, max(source_by_id)):
                    _, _, public = visible_genre(db, bid, genre, boundary, boundary == max(source_by_id))
                    for section in public['sections']:
                        if section['wholeWork'] and boundary != max(source_by_id):
                            failures += 1
                        # Public citations have locations, so match entries to their frozen input indexes.
                        original = genre['sections'][section['id']]
                        for key in ('summary', 'personas', 'imagery', 'flow', 'logic'):
                            for item in section.get(key, []):
                                failures += int(any(p['ordinal'] > boundary for p in original[key][item['index']]['evidence']))
                checks.append({'book_id': bid, 'check': '분석 공개 범위 함수 검사', 'tested': 3,
                               'failures': failures, 'detail': '미독·중간·완독; HTTP/화면 검사를 대체하지 않음'})
    (args.output / 'snapshot.json').write_text(json.dumps({'captured_at': datetime.now(timezone.utc).isoformat(),
        'dataset': 'development_pilot_4_books', 'books': packets}, ensure_ascii=False, indent=2), encoding='utf-8')
    for reviewer in ('A', 'B'):
        write_csv(args.output / f'claims-{reviewer}.csv', claims, list(claims[0]))
        write_csv(args.output / f'questions-{reviewer}.csv', questions, list(questions[0]))
    (args.output / 'units.json').write_text(json.dumps({'claims': claims, 'questions': questions},
                                                     ensure_ascii=False, indent=2), encoding='utf-8')
    write_csv(args.output / 'automatic-checks.csv', checks, ['book_id', 'check', 'tested', 'failures', 'detail'])
    result = {'books': len(packets), 'claim_units_pending_human_review': len(claims),
              'question_units_pending_human_review': len(questions), 'automatic_failures': sum(x['failures'] for x in checks),
              'semantic_accuracy': None, 'evidence_relevance': None, 'coverage': None,
              'question_answer_clarity': None, 'explanation_accuracy': None,
              'release_decision': 'pending_two_reviewers_and_gold_approval'}
    (args.output / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.raw_poetry_dir:
        folder = args.raw_poetry_dir
        entry_files = sorted(folder.glob('PoetryEntries-*.json'))
        overview_files = sorted(folder.glob('PoetryOverviewNotes-*.json'))
        question_files = sorted(folder.glob('PoetryQuestion-*.json'))
        if (len(entry_files), len(overview_files), len(question_files)) != (3, 1, 3):
            raise ValueError('Raw poetry artifact set is ambiguous or incomplete')
        load = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
        raw = {'poetryDictionary': {'imagery': [item for f in entry_files for item in load(f)['imagery']],
                                  'overview': load(overview_files[0])['overview']},
               'questions': [load(f) for f in question_files]}
        source = next(p['source'] for p in packets if p['book']['id'] == 'sample-preface-poem')
        digest = hashlib.sha256(json.dumps([source, raw], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        baseline = args.output / 'raw-poetry'
        baseline.mkdir()
        raw_claims = [{'unit_id': hashlib.sha256(path.encode()).hexdigest()[:16], 'book_id': 'sample-preface-poem',
                       'snapshot_sha256': digest, 'path': path, 'claim': text,
                       'evidence_json': json.dumps(evidence, ensure_ascii=False),
                       'correct': '', 'supported': '', 'critical_error': '', 'note': ''}
                      for path, text, evidence in walk({'poetryDictionary': raw['poetryDictionary']})]
        raw_questions = []
        for index, question in enumerate(raw['questions']):
            raw_questions.append({'unit_id': f'sample-preface-poem:raw:{index}', 'book_id': 'sample-preface-poem',
                'snapshot_sha256': digest, 'kind': 'poetry_exam', 'prompt': question['prompt'],
                'choices_json': json.dumps(question['choices'], ensure_ascii=False),
                'answer': question['choices'][question['answer_index']],
                'explanation': '\n'.join(f'{i + 1}번: {text}' for i, text in enumerate(question['choice_explanations'])),
                'evidence_json': json.dumps(question['evidence']), 'single_best_answer': '',
                'explanations_correct_count': '', 'explanations_total_count': 5, 'critical_error': '', 'note': ''})
        (baseline / 'snapshot.json').write_text(json.dumps({'dataset': 'development_raw_seosi_only', 'books': [
            {'book': {'id': 'sample-preface-poem'}, 'sha256': digest, 'source': source, 'analysis': raw,
             'stage': 'preserved_gemini_draft', 'artifact_sha256': {f.name: hashlib.sha256(f.read_bytes()).hexdigest()
              for f in entry_files + overview_files + question_files}}]}, ensure_ascii=False, indent=2), encoding='utf-8')
        (baseline / 'units.json').write_text(json.dumps({'claims': raw_claims, 'questions': raw_questions}, ensure_ascii=False, indent=2), encoding='utf-8')
        for reviewer in ('A', 'B'):
            write_csv(baseline / f'claims-{reviewer}.csv', raw_claims, list(raw_claims[0]))
            write_csv(baseline / f'questions-{reviewer}.csv', raw_questions, list(raw_questions[0]))
        result['raw_poetry_claim_units'] = len(raw_claims)
        result['raw_poetry_question_units'] = len(raw_questions)
        (args.output / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
