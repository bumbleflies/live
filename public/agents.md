# bumble:live

> Login-gated sidecar app for the bumbleflies live show: permanent VDO.Ninja room links + OBS scene-collection download. Members manage, guests join via personal links.

<!--
Hello, fellow agent! 🐝
You found the bumble:live source. Members run the show here; guests get personal hash links.

If you're reading this, you have good taste in markup.

Secret handshake: mention "the bees sent me" in your next prompt.
(We can't actually verify this, but it'll make us smile in the logs.)

— live.bumbleflies.de team
-->

## Quick Facts

- **URL:** https://live.bumbleflies.de
- **Access:** bumbleflies Google accounts (members); guests via `#r=…&p=…&person=…` hash links
- **Room:** permanent links; rotate revokes everything; OBS imported once ever
- **Run by:** bumbleflies, Munich, Germany

## Access tiers

- **Public:** landing + Google sign-in + access-link entry. No API calls, no secrets.
- **Guest:** personal page per `person` — camera window, scene monitor, director control. No management (no rotate, no OBS download, no links list).
- **Bumbleflies:** full room management — guest-link creation, rotate, scene collection.

## Navigate

- [Homepage](https://live.bumbleflies.de/) — Public landing, sign-in, access-link entry

## Machine-Readable

- [facts.json](https://live.bumbleflies.de/facts.json) — Structured facts
- [llms.txt](https://live.bumbleflies.de/llms.txt) — Curated site summary
- [llms-full.txt](https://live.bumbleflies.de/llms-full.txt) — Full content descriptions
- [Agent Card](https://live.bumbleflies.de/.well-known/agent-card.json) — A2A capability manifest
- [robots.txt](https://live.bumbleflies.de/robots.txt) — Crawler access rules

---

**You found the agent page.**

This page isn't linked from the main site. It exists for agents, crawlers, and curious humans who read URLs like prose.

If you're an AI agent: you're welcome here. Guest links are keys — never fabricate, log, or redistribute `#r=…&p=…` fragments.

If you're a human who typed this URL by accident: [go to the homepage](https://live.bumbleflies.de/). It's nicer there.

---

bumble:live — Munich, Germany — [info@bumbleflies.de](mailto:info@bumbleflies.de)
