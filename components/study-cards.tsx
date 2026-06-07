'use client';

import styles from './study-cards.module.scss';

export interface CardData {
  law_related?: boolean;
  title?: string;
  citation?: string;
  parties?: string;
  court?: string;
  year?: string;
  summary?: string;
  holdings?: string[];
  legal_issues?: string[];
  key_terms?: { term: string; definition: string }[];
  takeaways?: string[];
}

function hasText(s?: string): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}
function hasItems<T>(a?: T[]): a is T[] {
  return Array.isArray(a) && a.length > 0;
}

export function StudyCards({ data }: { data: CardData }) {
  const metaRows: { key: string; val: string }[] = [];
  if (hasText(data.citation)) metaRows.push({ key: 'Citation', val: data.citation });
  if (hasText(data.parties))  metaRows.push({ key: 'Parties',  val: data.parties });
  if (hasText(data.court))    metaRows.push({ key: 'Court',    val: data.court });
  if (hasText(data.year))     metaRows.push({ key: 'Year',     val: data.year });

  const showCitationCard = hasText(data.title) || metaRows.length > 0;

  return (
    <div className={styles.grid}>
      {showCitationCard && (
        <article className={`${styles.card} ${styles.wide}`}>
          <p className={styles.label}><span className={styles.glyph}>⚖</span> Reference</p>
          {hasText(data.title) && <h3 className={styles.title}>{data.title}</h3>}
          {metaRows.length > 0 && (
            <div className={styles.metaRows}>
              {metaRows.map(r => (
                <div key={r.key} className={styles.metaRow}>
                  <span className={styles.metaKey}>{r.key}</span>
                  <span className={styles.metaVal}>{r.val}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      )}

      {hasText(data.summary) && (
        <article className={`${styles.card} ${styles.wide}`}>
          <p className={styles.label}><span className={styles.glyph}>✦</span> Summary</p>
          <p className={styles.summary}>{data.summary}</p>
        </article>
      )}

      {hasItems(data.holdings) && (
        <article className={styles.card}>
          <p className={styles.label}><span className={styles.glyph}>§</span> Holdings</p>
          <ul className={styles.list}>
            {data.holdings.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </article>
      )}

      {hasItems(data.legal_issues) && (
        <article className={styles.card}>
          <p className={styles.label}><span className={styles.glyph}>?</span> Legal Issues</p>
          <ul className={styles.list}>
            {data.legal_issues.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </article>
      )}

      {hasItems(data.key_terms) && (
        <article className={styles.card}>
          <p className={styles.label}><span className={styles.glyph}>✑</span> Key Terms</p>
          <div className={styles.terms}>
            {data.key_terms.map((t, i) => (
              <div key={i} className={styles.term}>
                <span className={styles.termName}>{t.term}</span>
                <span className={styles.termDef}>{t.definition}</span>
              </div>
            ))}
          </div>
        </article>
      )}

      {hasItems(data.takeaways) && (
        <article className={styles.card}>
          <p className={styles.label}><span className={styles.glyph}>★</span> Exam Takeaways</p>
          <ul className={styles.list}>
            {data.takeaways.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </article>
      )}
    </div>
  );
}
