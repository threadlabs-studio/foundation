# Changelog

All notable changes to Threadlabs Foundation are documented here.

## 0.1.0

- The generated release runner skips a package whose name npm has never seen, since trusted publishing needs an existing package, and prints how to publish it by hand once and add the repository's release workflow and `npm` environment as its trusted publisher. The other packages publish, and the run succeeds.
- Introduce the composable repository standard, guided starter flow, read-only audits, immutable plan/apply lifecycle, verification and freshness evidence, GitHub policy adapter, and safe release preparation.
