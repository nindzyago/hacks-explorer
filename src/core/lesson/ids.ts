/**
 * Vetted lists of the ids a passport may name (L5, oracle R6 R7; decision K86): CWE weaknesses,
 * MITRE ATT&CK techniques, OWASP Top 10 items and CVE records, each with its official name or
 * date as fetched from the source below. An id that is not here is an error (`unknown-id`): a
 * typo or an id nobody has checked never reaches the reader.
 *
 * Adding an id: open its page at the source, copy the name exactly (CVE: the NVD «Published»
 * date), add one line, update `fetched` if you re-checked the whole list. The lists cover what
 * plan/content-catalog.md names (scripts/content.test.mjs checks that), plus ids the fixtures use.
 */

export const ID_SOURCES = {
  cwe: {
    url: 'cwe-api.mitre.org/api/v1/cwe/weakness/{id}',
    version: 'CWE 4.21 (2026-10-28); names as on cwe.mitre.org/data/definitions/{id}.html',
    fetched: '2026-11-19',
  },
  attack: {
    url: 'attack.mitre.org/techniques/{id}/',
    version: 'ATT&CK Enterprise v20',
    fetched: '2026-11-19',
  },
  owasp: {
    url: 'owasp.org/Top10/2021/ and genai.owasp.org/llm-top-10/',
    version: 'OWASP Top 10:2021; OWASP Top 10 for LLM Applications 2025',
    fetched: '2026-11-19',
  },
  cves: {
    url: 'services.nvd.nist.gov/rest/json/cves/2.0?cveId={id}',
    version: 'NVD CVE API 2.0, field «published»',
    fetched: '2026-11-19',
  },
} as const;

/** CWE number → official name. */
export const CWE_ENTRIES: ReadonlyMap<number, string> = new Map([
  [22, 'Improper Limitation of a Pathname to a Restricted Directory'],
  [74, 'Improper Neutralization of Special Elements in Output Used by a Downstream Component'],
  [78, 'Improper Neutralization of Special Elements used in an OS Command'],
  [79, 'Improper Neutralization of Input During Web Page Generation'],
  [89, 'Improper Neutralization of Special Elements used in an SQL Command'],
  [94, 'Improper Control of Generation of Code'],
  [121, 'Stack-based Buffer Overflow'],
  [204, 'Observable Response Discrepancy'],
  [269, 'Improper Privilege Management'],
  [306, 'Missing Authentication for Critical Functionality'],
  [347, 'Improper Verification of Cryptographic Signature'],
  [352, 'Cross-Site Request Forgery'],
  [362, 'Concurrent Execution using Shared Resource with Improper Synchronization'],
  [384, 'Session Fixation'],
  [434, 'Unrestricted Upload of File with Dangerous Type'],
  [444, 'Inconsistent Interpretation of HTTP Requests'],
  [502, 'Deserialization of Untrusted Data'],
  [564, 'Use of Hibernate with HQL/SQL Query String Containing External Input'],
  [601, 'URL Redirection to Untrusted Site'],
  [611, 'Improper Restriction of XML External Entity Reference'],
  [639, 'Authorization Bypass Through User-Controlled Key'],
  [707, 'Improper Neutralization'],
  [759, 'Use of a One-Way Hash without a Salt'],
  [770, 'Allocation of Resources Without Limits or Throttling'],
  [862, 'Missing Authorization'],
  [915, 'Improperly Controlled Modification of Dynamically-Determined Object Attributes'],
  [916, 'Use of Password Hash With Insufficient Computational Effort'],
  [917, 'Improper Neutralization of Special Elements used in an Expression Language Statement'],
  [918, 'Server-Side Request Forgery'],
  [942, 'Permissive Cross-domain Security Policy with Untrusted Domains'],
  [943, 'Improper Neutralization of Special Elements in Data Query Logic'],
  [1021, 'Improper Restriction of Rendered UI Layers or Frames'],
  [1321, 'Improperly Controlled Modification of Object Prototype Attributes'],
  [1336, 'Improper Neutralization of Special Elements Used in a Template Engine'],
  [1427, 'Improper Neutralization of Input Used for LLM Prompting'],
]);

/** ATT&CK Enterprise technique or sub-technique → name as on its page. */
export const ATTACK_TECHNIQUES: ReadonlyMap<string, string> = new Map([
  ['T1046', 'Network Service Discovery'],
  ['T1071', 'Application Layer Protocol'],
  ['T1110', 'Brute Force'],
  ['T1110.002', 'Brute Force: Password Cracking'],
  ['T1110.004', 'Brute Force: Credential Stuffing'],
  ['T1189', 'Drive-by Compromise'],
  ['T1190', 'Exploit Public-Facing Application'],
  ['T1195', 'Supply Chain Compromise'],
  ['T1204', 'User Execution'],
  ['T1204.002', 'User Execution: Malicious File'],
  ['T1210', 'Exploitation of Remote Services'],
  ['T1486', 'Data Encrypted for Impact'],
  ['T1499', 'Endpoint Denial of Service'],
  ['T1499.003', 'Endpoint Denial of Service: Application Exhaustion Flood'],
  ['T1505', 'Server Software Component'],
  ['T1505.003', 'Server Software Component: Web Shell'],
  ['T1539', 'Steal Web Session Cookie'],
  ['T1550', 'Use Alternate Authentication Material'],
  ['T1550.004', 'Use Alternate Authentication Material: Web Session Cookie'],
  ['T1557', 'Adversary-in-the-Middle'],
  ['T1565', 'Data Manipulation'],
  ['T1565.001', 'Data Manipulation: Stored Data Manipulation'],
  ['T1566', 'Phishing'],
  ['T1566.001', 'Phishing: Spearphishing Attachment'],
  ['T1566.002', 'Phishing: Spearphishing Link'],
  ['T1566.003', 'Phishing: Spearphishing via Service'],
  ['T1589', 'Gather Victim Identity Information'],
  ['T1589.002', 'Gather Victim Identity Information: Email Addresses'],
  ['T1595', 'Active Scanning'],
  ['T1598', 'Phishing for Information'],
  ['T1621', 'Multi-Factor Authentication Request Generation'],
]);

/** OWASP Top 10:2021 and Top 10 for LLM Applications 2025 → item name. */
export const OWASP_ITEMS: ReadonlyMap<string, string> = new Map([
  ['A01:2021', 'Broken Access Control'],
  ['A02:2021', 'Cryptographic Failures'],
  ['A03:2021', 'Injection'],
  ['A04:2021', 'Insecure Design'],
  ['A05:2021', 'Security Misconfiguration'],
  ['A06:2021', 'Vulnerable and Outdated Components'],
  ['A07:2021', 'Identification and Authentication Failures'],
  ['A08:2021', 'Software and Data Integrity Failures'],
  ['A09:2021', 'Security Logging and Monitoring Failures'],
  ['A10:2021', 'Server-Side Request Forgery (SSRF)'],
  ['LLM01:2025', 'Prompt Injection'],
  ['LLM02:2025', 'Sensitive Information Disclosure'],
  ['LLM03:2025', 'Supply Chain'],
  ['LLM04:2025', 'Data and Model Poisoning'],
  ['LLM05:2025', 'Improper Output Handling'],
  ['LLM06:2025', 'Excessive Agency'],
  ['LLM07:2025', 'System Prompt Leakage'],
  ['LLM08:2025', 'Vector and Embedding Weaknesses'],
  ['LLM09:2025', 'Misinformation'],
  ['LLM10:2025', 'Unbounded Consumption'],
]);

/** CVE id → date NVD published the record. */
export const CVE_RECORDS: ReadonlyMap<string, string> = new Map([
  ['CVE-2014-0160', '2014-04-07'],
  ['CVE-2014-6271', '2014-09-24'],
  ['CVE-2017-0144', '2017-03-17'],
  ['CVE-2017-5638', '2017-03-11'],
  ['CVE-2021-44228', '2021-12-10'],
  ['CVE-2024-3094', '2024-03-29'],
]);

export type IdWord = 'cwe' | 'owasp' | 'attack' | 'cves';

/**
 * Null when `value` (already in the passport's form: `89`, `A03:2021`, `T1566.002`,
 * `CVE-2021-44228`) is in its vetted list; otherwise the message for the author.
 */
export function unknownId(word: IdWord, value: string): string | null {
  const where = `src/core/lesson/ids.ts (${ID_SOURCES[word].version})`;
  if (word === 'cwe') {
    const n = /^[1-9]\d{0,4}$/.test(value) ? Number(value) : NaN;
    if (CWE_ENTRIES.has(n)) return null;
    return `\`cwe\`: CWE-${value} is not in the vetted list ${where}; check it at cwe.mitre.org/data/definitions/${value}.html and add it with its official name`;
  }
  if (word === 'attack') {
    if (ATTACK_TECHNIQUES.has(value)) return null;
    return `\`attack\`: ${value} is not in the vetted list ${where}; check it at attack.mitre.org/techniques/${value.replace('.', '/')}/ and add it with its name`;
  }
  if (word === 'owasp') {
    if (OWASP_ITEMS.has(value)) return null;
    return `\`owasp\`: ${value} is not in the vetted list ${where}; use an item of OWASP Top 10:2021 (A01:2021 … A10:2021) or of the LLM Top 10 2025 (LLM01:2025 … LLM10:2025)`;
  }
  if (CVE_RECORDS.has(value)) return null;
  return `\`cves\`: ${value} is not in the vetted list ${where}; check it at nvd.nist.gov/vuln/detail/${value} and add it with its NVD publication date`;
}
