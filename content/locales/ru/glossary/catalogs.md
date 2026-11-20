# Каталоги и шкалы

`glossary` ru · `category` catalogs

## `cwe` CWE

`category` catalogs · `see` cve, owasp · `lessons` B1

Формы: CWE

Common Weakness Enumeration — каталог типов слабостей в программах и оборудовании, его ведёт
MITRE. CWE называет
класс ошибки, а не конкретную уязвимость: например, CWE-89 — SQL-инъекции.

## `cve` CVE

`category` catalogs · `see` cwe, cvss · `lessons` A2

Формы: CVE

Common Vulnerabilities and Exposures — общий список известных уязвимостей в конкретных
продуктах. Каждой даётся номер вида CVE-2021-44228, чтобы все говорили об одной и той же ошибке.

## `cvss` CVSS

`category` catalogs · `see` cve · `lessons` A3

Формы: CVSS

Common Vulnerability Scoring System — шкала тяжести уязвимостей от 0 до 10. Оценка складывается
из признаков: можно ли атаковать по сети, сложно ли это, нужны ли права и действия пользователя,
что страдает — конфиденциальность, целостность или доступность.

## `owasp` OWASP

`category` catalogs · `see` cwe, injection · `lessons` B1

Формы: OWASP, OWASP Top 10

Open Worldwide Application Security Project — открытое сообщество по безопасности
веб-приложений. Самый известный его документ — OWASP Top 10, список десяти главных классов
рисков; в выпуске 2021 года, на который ссылаются уроки, инъекции — пункт A03. В 2025 году вышел
новый выпуск.

## `mitre-attack` MITRE ATT&CK

`category` catalogs · `see` phishing, cwe · `lessons` I1

Формы: MITRE ATT&CK, ATT&CK

Открытая база знаний MITRE о тактиках и техниках атакующих, собранная по реальным атакам. У
каждой техники свой номер: T1566 — фишинг, T1566.002 — целевой фишинг со ссылкой.

## `cna` CNA

`category` catalogs · `see` cve, nvd · `lessons` A2

Формы: CNA

CVE Numbering Authority — организация, которой программа CVE разрешила выдавать номера CVE и
публиковать записи в своей области. Часто это сам производитель: например, Apache для своих
проектов.

## `nvd` NVD

`category` catalogs · `see` cve, cvss · `lessons` A2

Формы: NVD

National Vulnerability Database — база уязвимостей NIST, правительства США. Берёт записи CVE и
обычно добавляет к ним свою оценку CVSS, класс ошибки CWE и список затронутых продуктов.

## `kev` KEV

`category` catalogs · `see` cve, epss · `lessons` A3

Формы: KEV

Known Exploited Vulnerabilities — каталог CISA с уязвимостями, которые уже используют в настоящих
атаках. Попадание в KEV — сигнал чинить в первую очередь, независимо от оценки CVSS.

## `epss` EPSS

`category` catalogs · `see` cvss, kev · `lessons` A3

Формы: EPSS

Exploit Prediction Scoring System — модель FIRST, которая каждый день оценивает для каждой CVE
вероятность от 0 до 1, что её начнут использовать в атаках в ближайшие 30 дней.
