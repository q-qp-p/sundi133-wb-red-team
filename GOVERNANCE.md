# Governance

This document describes how the wb-red-team project is run. The project is part of the Open Secure AI Alliance, a Linux Foundation project, and follows its policies where they apply.

## Principles

- **Open:** anyone can use, contribute to, and participate in the project.
- **Transparent:** decisions and the reasoning behind them happen in public (GitHub issues, pull requests, and discussions).
- **Merit-based:** roles are earned through sustained, high-quality contributions.
- **Responsible:** the project exists to support authorized security testing. See the Responsible Use section of the [Code of Conduct](CODE_OF_CONDUCT.md).

## Roles

### Users

Anyone who uses the project. Users are encouraged to report bugs, request features, and share feedback.

### Contributors

Anyone who contributes code, documentation, attack modules, tests, reviews, or issue triage. Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md) and must be signed off under the Developer Certificate of Origin (DCO).

### Maintainers

Maintainers are listed in [MAINTAINERS.md](MAINTAINERS.md). They:

- Review and merge pull requests
- Triage issues and guide the roadmap
- Cut releases
- Respond to security reports
- Enforce the Code of Conduct

### Lead Maintainer

The lead maintainer coordinates releases and roadmap, represents the project within the foundation, and breaks ties when maintainers cannot reach consensus.

## Becoming a Maintainer

A contributor may be nominated by an existing maintainer after showing sustained contributions over roughly three months or more, such as:

- Multiple merged, non-trivial pull requests
- Helpful code reviews on others' pull requests
- Issue triage and community support

Nominations are made in a pull request that adds the candidate to `MAINTAINERS.md`. The nomination passes with approval from a majority of current maintainers and no unresolved objections after 7 days.

## Stepping Down and Removal

Maintainers may step down at any time by opening a pull request that moves them to the Emeritus section of `MAINTAINERS.md`.

A maintainer who has been inactive for 6 months may be moved to emeritus status after a maintainer tries to contact them. A maintainer may also be removed for Code of Conduct violations by a two-thirds vote of the other maintainers.

## Decision Making

The project uses **lazy consensus**:

- Most decisions happen in pull requests. A PR can be merged once it has approval from at least one maintainer who is not the author and has no outstanding change requests.
- Significant changes need a public issue or design doc left open for comment for at least 7 days before merging. These include new attack categories, breaking config or API changes, changes to judging or scoring, and new external dependencies.
- If consensus cannot be reached, maintainers vote. A simple majority decides; the lead maintainer breaks ties.

Changes to this document require approval from two-thirds of maintainers.

## Releases

Releases follow [Semantic Versioning](https://semver.org/). Any maintainer may propose a release; the lead maintainer or a delegate publishes it. Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## Code of Conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Intellectual Property

The project is licensed under the [MIT License](LICENSE). Contributors keep copyright on their contributions and license them under the project license by signing off under the [Developer Certificate of Origin](https://developercertificate.org/).
