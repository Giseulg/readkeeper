"""Prepare coverage sheets or score frozen evaluation sheets without a DB write."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

from .evaluate_reading_quality import write_csv


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        result = list(csv.DictReader(stream))
    if len({row['unit_id'] for row in result}) != len(result):
        raise ValueError(f'Duplicate IDs: {path.name}')
    return result


def ratio(values):
    return {'passed': sum(values), 'total': len(values),
            'percent': round(100 * sum(values) / len(values), 2) if values else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('folder', type=Path)
    parser.add_argument('--prepare', action='store_true')
    args = parser.parse_args()
    folder = args.folder
    snapshot = json.loads((folder / 'snapshot.json').read_text(encoding='utf-8'))
    manifest = json.loads((folder / 'units.json').read_text(encoding='utf-8'))
    hashes = {}
    for packet in snapshot['books']:
        digest = hashlib.sha256(json.dumps([packet['source'], packet['analysis']], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        if digest != packet['sha256']:
            raise ValueError('Snapshot changed; start a new evaluation run')
        hashes[packet['book']['id']] = digest
    if args.prepare:
        gold = json.loads(Path(__file__).with_name('reading_quality_gold.json').read_text(encoding='utf-8'))
        gold['criteria'] = [r for r in gold['criteria'] if r['book_id'] in hashes]
        rows = []
        for criterion in gold['criteria']:
            packet = next(p for p in snapshot['books'] if p['book']['id'] == criterion['book_id'])
            if not set(criterion['source_ordinals']) <= {p['ordinal'] for p in packet['source']}:
                raise ValueError(f'Invalid gold source: {criterion["id"]}')
            rows.append({'unit_id': criterion['id'], 'book_id': criterion['book_id'],
                         'snapshot_sha256': hashes[criterion['book_id']], 'required': criterion['required'],
                         'source_ordinals': json.dumps(criterion['source_ordinals']), 'reject': criterion['reject'],
                         'criterion_approved': '', 'covered': '', 'matched_unit_ids': '', 'note': ''})
        for name in ('coverage-A.csv', 'coverage-B.csv', 'gold-draft.json'):
            if (folder / name).exists():
                raise ValueError('Coverage sheets already exist; never overwrite a review')
        for reviewer in ('A', 'B'):
            write_csv(folder / f'coverage-{reviewer}.csv', rows, list(rows[0]))
        (folder / 'gold-draft.json').write_text(json.dumps(gold, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'Prepared {len(rows)} draft criteria; both reviewers must approve before coverage is final')
        return
    manual = {'claims': {'correct', 'supported', 'critical_error', 'note'},
              'questions': {'single_best_answer', 'explanations_correct_count', 'critical_error', 'note'}}
    output, votes, missing = {}, {}, 0
    for reviewer in ('A', 'B'):
        groups = {}
        for kind in ('claims', 'questions'):
            data = read_csv(folder / f'{kind}-{reviewer}.csv')
            expected = {r['unit_id']: r for r in manifest[kind]}
            if {r['unit_id'] for r in data} != expected.keys():
                raise ValueError(f'Changed unit set: {kind}-{reviewer}')
            for row in data:
                if any(row[key] != str(value) for key, value in expected[row['unit_id']].items() if key not in manual[kind]):
                    raise ValueError('Evaluation content changed; freeze a new run instead')
                for field in manual[kind] - {'note'}:
                    value = row[field]
                    maximum = int(row['explanations_total_count']) if field == 'explanations_correct_count' else 1
                    if value and (not value.isdigit() or not 0 <= int(value) <= maximum or str(int(value)) != value):
                        raise ValueError(f'Invalid score: {row["unit_id"]}:{field}')
                    if not value:
                        missing += 1
                    votes.setdefault((kind, row['unit_id'], field), {})[reviewer] = value
            groups[kind] = data
        coverage = read_csv(folder / f'coverage-{reviewer}.csv')
        gold = json.loads((folder / 'gold-draft.json').read_text(encoding='utf-8'))
        if {r['unit_id'] for r in coverage} != {r['id'] for r in gold['criteria']}:
            raise ValueError('Changed coverage criteria')
        for row in coverage:
            criterion = next(r for r in gold['criteria'] if r['id'] == row['unit_id'])
            if any(row[key] != criterion[key] for key in ('book_id', 'required', 'reject')) or json.loads(row['source_ordinals']) != criterion['source_ordinals']:
                raise ValueError('Coverage criterion changed')
            if row['snapshot_sha256'] != hashes[row['book_id']]:
                raise ValueError('Coverage snapshot mismatch')
            for field in ('criterion_approved', 'covered'):
                if row[field] not in ('', '0', '1'):
                    raise ValueError('Coverage scores must be blank, 0 or 1')
                missing += int(not row[field])
                votes.setdefault(('coverage', row['unit_id'], field), {})[reviewer] = row[field]
            if row['covered'] == '1' and not row['matched_unit_ids'].strip():
                raise ValueError('Covered criterion requires matching analysis unit IDs')
            allowed = {r['unit_id'] for r in manifest['claims'] if r['book_id'] == row['book_id']}
            if row['matched_unit_ids'] and not {x.strip() for x in row['matched_unit_ids'].split(',')} <= allowed:
                raise ValueError('Unknown matching analysis unit ID')
        metrics = {}
        for bid in [*hashes, 'all_books_pooled']:
            claims = [r for r in groups['claims'] if bid == 'all_books_pooled' or r['book_id'] == bid]
            questions = [r for r in groups['questions'] if bid == 'all_books_pooled' or r['book_id'] == bid]
            cov = [r for r in coverage if bid == 'all_books_pooled' or r['book_id'] == bid]
            explanations = [r for r in questions if r['explanations_correct_count']]
            total = sum(int(r['explanations_total_count']) for r in explanations)
            correct = sum(int(r['explanations_correct_count']) for r in explanations)
            metrics[bid] = {'accuracy': ratio([int(r['correct']) for r in claims if r['correct']]),
                            'expected_claim_units': len(claims), 'expected_question_units': len(questions),
                            'expected_coverage_criteria': len(cov),
                            'critical_errors': sum(int(r['critical_error']) for r in claims + questions if r['critical_error']),
                            'evidence_relevance': ratio([int(r['supported']) for r in claims if r['supported']]),
                            'answer_clarity': ratio([int(r['single_best_answer']) for r in questions if r['single_best_answer']]),
                            'coverage': ratio([int(r['covered']) for r in cov if r['criterion_approved'] == '1' and r['covered']]),
                            'explanations': {'passed': correct, 'total': total, 'percent': round(100 * correct / total, 2) if total else None}}
        output[reviewer] = metrics
    paired = [(key, pair) for key, pair in votes.items() if pair.get('A') and pair.get('B')]
    disagreements = [':'.join(key) for key, pair in paired if pair['A'] != pair['B']]
    result = {'reviewers': output, 'missing_scores': missing, 'agreement': ratio([int(pair['A'] == pair['B']) for _, pair in paired]),
              'agreement_by_field': {field: ratio([int(pair['A'] == pair['B']) for key, pair in paired if key[2] == field])
                                     for field in sorted({key[2] for key in votes})},
              'disagreements': disagreements, 'release_decision': 'pending_explicit_human_adjudication_and_threshold_review',
              'note': 'Incomplete denominators are provisional; an empty sheet never means 100%. Scores are not an independent held-out benchmark.'}
    (folder / 'human-scores.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'missing_scores': missing, 'paired_decisions': len(paired), 'disagreements': len(disagreements),
                      'release_decision': result['release_decision']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
