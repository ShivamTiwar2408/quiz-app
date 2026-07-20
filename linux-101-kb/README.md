# Linux from the Kernel Out

A first-principles field guide to Linux, organized around one idea: the kernel is the boundary between software and hardware, and nearly every Linux concept is machinery for crossing that boundary safely — or guarding it.

**Live:** https://shivamtiwar2408.github.io/quiz-app/linux-101-kb/guide/index.html

Built from Fireship's *100+ Linux Things you Need to Know* (https://www.youtube.com/watch?v=LKCVKw9CzFo).

## Contents

- **The one mental model** — hardware core, kernel ring, userspace, syscalls as the only door
- **The kernel** — Unix/POSIX lineage, what Linux actually is (a kernel), the boot sequence, kernel responsibilities, protection rings & system calls
- **Userland** — GNU & coreutils, the shell & terminal, file commands, redirection & pipes, Bash scripts
- **Users & filesystem** — users/root/sudo, the filesystem hierarchy, PATH & environment, file permissions (rwx ↔ octal)
- **Runtime** — processes & signals (SIGTERM vs SIGKILL), everyday utilities (grep/sed/gzip/tar)
- **The ecosystem** — distributions: package managers, release models, desktop environments, and the major families
