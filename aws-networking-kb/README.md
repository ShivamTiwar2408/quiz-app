# AWS Networking — A Reference Guide to VPC and Its Building Blocks

A clear, neutral, professional reference to how networking works inside Amazon Web
Services. Each entity is defined on its own terms and paired with a hand-drawn SVG
diagram. It is a general reference — not tied to any one service or use case.

**Live page:** https://shivamtiwar2408.github.io/quiz-app/aws-networking-kb/guide/index.html

## Contents

**Foundations**
- §1 VPC — Virtual Private Cloud
- §2 CIDR & IP addressing
- §3 Subnets (public vs private)
- §4 Private & public IP addresses

**Routing & connectivity**
- §5 Route tables (longest-prefix match)
- §6 Internet gateway
- §7 NAT gateway

**Security**
- §8 Security groups
- §9 Network ACLs

**Interfaces & private access**
- §10 Elastic network interface (ENI)
- §11 VPC endpoints — §11a Gateway endpoint, §11b Interface endpoint (PrivateLink)

**Synthesis**
- §12 How it all fits together
- Quick comparison tables (IGW vs NAT, gateway vs interface endpoint, SG vs NACL)

## Sources

Every definition and behaviour is drawn from official AWS documentation:

- **Amazon VPC User Guide** — *How Amazon VPC works*; *NAT gateways*;
  *Infrastructure security* (security groups vs network ACLs)
- **Amazon EC2 User Guide** — *Elastic network interfaces*
- **AWS PrivateLink documentation** — *Concepts* (VPC endpoint types)

## Tech

A single self-contained `guide/index.html` — no build step, no dependencies. It uses a
documentation layout (sticky sidebar table of contents + content column), entity
definition blocks, comparison tables, and inline SVG reference diagrams. The only
JavaScript highlights the active section in the sidebar. Served as a static file by
the repository's existing GitHub Pages workflow.
