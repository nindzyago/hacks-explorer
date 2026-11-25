# Security policy

This policy is about vulnerabilities in the Hacks Explorer site and its code: the pages at
https://hacks.antipic.com, the build, and this repository. The attacks described in the lessons
are teaching material about other systems; they are not vulnerabilities of this site.

## Reporting a vulnerability

Please do not open a public issue or pull request for a vulnerability.

The repository is public: https://github.com/nindzyago/hacks-explorer. Report a vulnerability
privately through GitHub's private vulnerability reporting: open the "Security" tab of the
repository, then "Report a vulnerability". Only you and the maintainers see the report until a
fix is published. If that button is ever missing, write to the owner of the repository through
the contact on their GitHub profile and ask for a private channel; do not put the details in the
first message.

Please include:

- what is affected (a page address, a file, a commit);
- what an attacker could do with it;
- how to see it happen, in as few steps as you can;
- whether you want to be credited, and under which name.

What happens next:

- we confirm we received the report within 7 days;
- we tell you whether we consider it a vulnerability and what we plan to do;
- after the fix is published, we credit you in the release notes if you wish.

This is a volunteer project. There is **no bug bounty** and no payment for reports.

## What is in scope

- Script injection or content injection on the site (for example through a lesson file, an
  address, or `localStorage`).
- Anything that makes the site send data to another server, load an outside script or font, or
  set cookies: the site promises not to do any of that.
- Weak security headers or a misconfiguration of the deployment (`public/_headers`,
  `wrangler.jsonc`).
- A dependency vulnerability that is reachable from the site or the build.
- A lesson that contains a ready-to-run exploit, a real address or domain, or step-by-step
  instructions against a real product: report it the same way, or as a normal issue if it is
  not sensitive.

## Out of scope

- The attacks in the lessons themselves: they describe made-up systems.
- Reports from automated scanners without a demonstrated impact.
- Missing best-practice headers that have no security effect on a static site without logins
  or cookies.
- Denial of service by flooding, and social engineering of the maintainers.

## Rules for testing

Test only against your own local copy (`npm run dev` or `npm run build` and a local server).
Do not attack the hosting provider, do not run load tests against the public site, and do not
access data that is not yours.

## Supported versions

Only the latest version of the site, built from the main branch, is supported.
