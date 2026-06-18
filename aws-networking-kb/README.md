# AWS Networking — From Zero to the VPC Picture

A first-principles, visual guide to AWS networking, built in the same style as the
[vLLM guide](../vllm-kb/guide/index.html).

**Live page:** https://shivamtiwar2408.github.io/quiz-app/aws-networking-kb/guide/index.html

## What it covers

The guide builds up, one concept at a time, around a single running question:
*"What really happens when you put a Lambda inside a VPC — and why do its calls to
Bedrock/S3/DynamoDB suddenly time out?"*

1. **VPC** — your isolated virtual network and CIDR notation
2. **Subnets** — public vs private (decided purely by the route table)
3. **Private vs public IPs** — and why a VPC Lambda only ever gets a private one
4. **Route tables** — destination→target, and longest-prefix match (interactive demo)
5. **Internet Gateway** — the public door, and its public-IP requirement
6. **NAT Gateway** — the outbound-only valve, and its two-meter pricing
7. **Security Groups** — the stateful, allow-only firewall
8. **ENI** — the virtual network card that *literally* lives in the subnet
9. **Hyperplane ENIs** — how Lambda plugs in, and the "just use a public subnet" trap debunked
10. **VPC Endpoints** — gateway (free, S3/DynamoDB) vs interface (PrivateLink)
11. **The before & after picture** — elaborate SVG diagrams tying it all together

## Sources

Every technical claim is drawn from official AWS documentation:

- Amazon VPC User Guide — *How Amazon VPC works* and *NAT gateways*
- AWS PrivateLink — *Concepts* (interface vs gateway endpoints)
- AWS Lambda Developer Guide — *Giving Lambda functions access to resources in a VPC*
  (Lambda-managed VPC, internet access when attached, Hyperplane ENIs)

## Tech

Single self-contained `guide/index.html` — no build step, no dependencies. All
diagrams are hand-authored inline SVG; the small amount of JavaScript powers the
scroll reveal, outline navigation, the interactive route-table demo, and the quizzes.
Served as a static file by the repo's GitHub Pages workflow.
