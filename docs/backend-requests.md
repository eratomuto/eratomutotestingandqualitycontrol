# Back-end requests from the front end

One line each: what, why. For Palaash.

- Postal codes: exact match against 13 codes only. Real Nova Scotia codes (e.g. B3S 0B6) and nonsense get the same 100 km. Needs lookup by first three characters.
- When the front end resolves an unknown postal code via the town picker, it sends that town's code as home_clinic_zip, so the server's referral records the town, not the clinic. Needs a way to send the town as approximate or keep the original code.
- Keyword fallback matches American spellings only ('tumor'), so Canadian/British spellings ('tumour', 'oedema', 'anaemia', 'haemorrhage') are missed in both the Python fallback and the front-end mockTriage.
