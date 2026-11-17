# Data source

Warranty Wraith's recall notices come from the **CPSC Recalls** dataset: the public Recalls REST API of the US Consumer Product Safety Commission on SaferProducts.gov.

- Dataset: CPSC Recalls (Recall Retrieval Web Services)
- Request URL: https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=2026-06-01
- Retrieved: 2026-11-17
- Committed as: `data/cpsc-recalls.raw.json` (264 recalls, 816,658 bytes, recall days 2026-06-04 to 2026-11-12)

The date window starts on 2026-06-01 so that the mapped `src/data/recalls.json` stays well under 1 MB.

## Licence

Public domain: the recall data is a US government work (17 U.S.C. § 105). The CPSC Privacy and Security Notice (Copyright section, https://www.cpsc.gov/About-CPSC/Policies-Statements-and-Directives/Privacy-Policy) read on 2026-11-17:

> Web page text, brochures, and posters presented on CPSC websites are public information. You may freely distribute, copy, or link to any of this information. However, the information may not be used in a way that states or implies CPSC endorsement. If you distribute, copy or link to any of this information, please credit CPSC.
>
> You may freely copy and distribute recall notices, including photographs of recalled items, without permission. Any other use of photographs found in recall notices and elsewhere on CPSC websites may require permission from a copyright holder.

The app uses no photographs. Credit: US Consumer Product Safety Commission. This app is not endorsed by CPSC.

## How it is used

The snapshot is downloaded once and committed. Nothing in the repo fetches it at build time, test time or runtime. `bun run data:wraith` maps it to `src/data/recalls.json`.

A recall shown next to a purchase is a possible match for you to check against the notice, not a confirmation that your item is recalled.
